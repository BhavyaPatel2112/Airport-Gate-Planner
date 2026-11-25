package com.gateplanner.engine;

import com.gateplanner.model.EventType;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Extra disruptions for the scenario lab.
 *
 * <p><b>Ground delay (fog):</b> air traffic control holds every arrival due in a time window for the
 * same number of minutes. Unlike the monsoon storm, every flight in the window is hit equally, so
 * the effect on stands depends only on how tightly the plan was packed.</p>
 *
 * <p><b>Aircraft swap:</b> the airline flies a wide-body instead of a narrow-body (or the other way
 * round). A bigger aircraft no longer fits a narrow stand, so the visit is taken off its stand and
 * placed again by the recovery engine.</p>
 *
 * <p>Both reuse the recovery engine, so the plan's recovery method (maximum matching or greedy
 * first-fit) decides how the damage is repaired.</p>
 */
@Service
public class ScenarioEngine {

    private final PlanService plans;

    public ScenarioEngine(PlanService plans) {
        this.plans = plans;
    }

    public synchronized PlanService.Operation groundDelay(String planId, int from, int to, int minutes) {
        if (minutes < 5 || minutes > 240) {
            throw new InvalidInputException("Ground delay must be between 5 and 240 minutes");
        }
        if (from < 0 || to > PlanState.HORIZON || to <= from) {
            throw new InvalidInputException("Ground delay window must run forwards inside the plan horizon");
        }
        PlanState plan = plans.get(planId);
        TraceRecorder trace = new TraceRecorder();
        List<Turnaround> hit = new ArrayList<>();
        List<PlanEvent> events = new ArrayList<>();
        long t0 = System.nanoTime();
        for (Turnaround t : PlanService.inStartOrder(plan.getVisits())) {
            if (t.isCancelled() || t.getArrival() == null || t.getStart() < from || t.getStart() >= to) {
                continue;
            }
            int newStart = t.getStart() + minutes;
            int minTurn = t.getSize() == SizeClass.WIDE ? PlanService.MIN_TURN_WIDE : PlanService.MIN_TURN_NARROW;
            int newEnd = t.getDeparture() == null ? t.getEnd() + minutes : Math.max(t.getEnd(), newStart + minTurn);
            PlanService.retime(plan, t, newStart, newEnd);
            hit.add(t);
            events.add(new PlanEvent(t.getId(), EventType.DELAY, plan.standOf(t.getId()), plan.standOf(t.getId()),
                    newStart, "Ground delay " + minutes + " min"));
        }
        trace.add("Red-black interval tree", 3, "Re-time " + hit.size() + " held arrivals", Math.max(1, hit.size() * 2),
                TraceRecorder.since(t0), "O(log n) per delete and insert",
                "Every arrival between " + Clock.hhmm(from) + " and " + Clock.hhmm(to) + " is held " + minutes + " min");
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, hit, List.of(), List.of(), true, trace, "ground delay");
        events.addAll(o.events());
        plans.finish(plan, events, trace, o, null);
        return new PlanService.Operation(plan, events, trace, "Fog ground delay: " + PlanService.plural(hit.size(), "arrival")
                + " held " + minutes + " min, " + o.affected() + " had to move, " + o.unplaced() + " without a stand");
    }

    public synchronized PlanService.Operation swap(String planId, String flight, String size) {
        SizeClass target;
        try {
            target = SizeClass.valueOf(size.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidInputException("Aircraft size must be NARROW or WIDE");
        }
        PlanState plan = plans.get(planId);
        Turnaround old = plans.visit(plan, flight);
        if (old.isCancelled()) {
            throw new InvalidInputException("Flight " + flight + " is cancelled");
        }
        if (old.getSize() == target) {
            throw new InvalidInputException(flight + " already flies a " + target.name().toLowerCase() + "-body aircraft");
        }
        TraceRecorder trace = new TraceRecorder();
        List<PlanEvent> events = new ArrayList<>();
        long t0 = System.nanoTime();
        String before = plan.unplace(old);
        Turnaround swapped = old.resized(target);
        plan.replaceVisit(swapped);
        boolean stillFits = before != null && plan.stand(before).canHost(swapped)
                && plan.openDuring(before, swapped.getStart(), swapped.getOccupiedEnd());
        trace.add("Red-black interval tree", 3, "Take " + swapped.getLabel() + " off stand " + (before == null ? "none" : before),
                1, TraceRecorder.since(t0), "O(log n) delete",
                stillFits ? "The stand can still take the new aircraft" : "The stand cannot take the new aircraft size");
        if (stillFits) {
            plan.place(swapped, before);
            events.add(new PlanEvent(swapped.getId(), EventType.STAY, before, before, swapped.getStart(),
                    "Aircraft swapped to " + target.name().toLowerCase() + "-body; stand still fits"));
            plans.finish(plan, events, trace, null, before);
            return new PlanService.Operation(plan, events, trace, flight + " swapped to a " + target.name().toLowerCase()
                    + "-body: stand " + before + " still fits");
        }
        events.add(new PlanEvent(swapped.getId(), EventType.HOLD, before, null, swapped.getStart(),
                "Aircraft swapped to " + target.name().toLowerCase() + "-body"));
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(), List.of(), List.of(swapped), true, trace,
                "aircraft swap " + flight);
        events.addAll(o.events());
        plans.finish(plan, events, trace, o, before);
        String now = plan.standOf(swapped.getId());
        return new PlanService.Operation(plan, events, trace, flight + " swapped to a " + target.name().toLowerCase()
                + "-body: " + (now == null ? "no stand fits, it waits in the holding stack" : "moved from " + before + " to " + now));
    }

    /**
     * Fix everything that can still be fixed: every flight from {@code from} onwards, and every flight
     * still without a stand, is taken off its stand and re-placed together, window by window, with the
     * plan's repair method. Flights keep their current stand when they can (it is tried first), closures
     * and delays stay in force, and flights that started earlier are not touched.
     */
    public synchronized PlanService.Operation replan(String planId, int from) {
        return replan(planId, from, false);
    }

    /** Flights still without a stand when the same re-plan uses greedy first-fit (run on a copy of the plan). */
    private static int greedyReplanLeft(PlanState copy, int from) {
        List<Turnaround> redo = new ArrayList<>();
        java.util.Map<String, String> previous = new java.util.HashMap<>();
        for (Turnaround t : PlanService.inStartOrder(copy.getVisits())) {
            if (!t.isCancelled() && (t.getStart() >= from || copy.standOf(t.getId()) == null)) {
                String old = copy.unplace(t);
                if (old != null) {
                    previous.put(t.getId(), old);
                }
                redo.add(t);
            }
        }
        return RecoveryEngine.placeAll(copy, redo, false, new TraceRecorder(), "re-plan (greedy check)", previous).unplaced();
    }

    /** Longest hold before a flight is counted as a diversion. */
    static final int MAX_HOLD = 8 * 60;

    /**
     * As {@link #replan(String, int)}; with {@code hold}, every flight still without a stand afterwards
     * waits (in the holding pattern or at its origin) until the earliest moment a compatible stand is
     * open and empty for its whole visit, checked in 5 minute steps with the stands' interval trees.
     */
    public synchronized PlanService.Operation replan(String planId, int from, boolean hold) {
        return replanOn(plans.get(planId), from, hold);
    }

    /** The re-plan on a plan object, so it can also run on copies (the story flight compares two of them). */
    public PlanService.Operation replanOn(PlanState plan, int from, boolean hold) {
        return replanOn(plan, from, hold, true);
    }

    /** As above; without {@code explain} the guided replay (and its greedy comparison copy) is skipped. */
    public PlanService.Operation replanOn(PlanState plan, int from, boolean hold, boolean explain) {
        long tAll = System.nanoTime();
        TraceRecorder trace = new TraceRecorder();
        int before = plan.unplacedVisits().size();
        boolean matching = !plan.isGreedyRecovery();
        // the same re-plan with greedy first-fit, on a copy, so the guided replay can compare the two honestly
        int greedyLeft = matching && explain ? greedyReplanLeft(plans.copy(plan), from) : -1;
        List<Turnaround> redo = new ArrayList<>();
        java.util.Map<String, String> previous = new java.util.HashMap<>();
        java.util.Set<String> strandedIds = new java.util.LinkedHashSet<>();
        long tSort = System.nanoTime();
        List<Turnaround> ordered = PlanService.inStartOrder(plan.getVisits());
        double sortMs = TraceRecorder.since(tSort);
        for (Turnaround t : ordered) {
            if (t.isCancelled()) {
                continue;
            }
            boolean stranded = plan.standOf(t.getId()) == null;
            if (t.getStart() >= from || stranded) {
                String old = plan.unplace(t);
                if (old != null) {
                    previous.put(t.getId(), old);
                } else {
                    strandedIds.add(t.getId());
                }
                redo.add(t);
            }
        }
        java.util.Map<String, String> why = new java.util.HashMap<>();
        for (String id : previous.keySet()) {
            why.put(id, "The re-plan from " + Clock.hhmm(from) + " looked at every remaining flight together, so stands could be "
                    + "shuffled to make room for flights that had none");
        }
        List<RecoveryEngine.WindowInfo> windows = new ArrayList<>();
        RecoveryEngine.Outcome o = RecoveryEngine.placeAll(plan, redo, matching, trace, "re-plan", previous, why, windows);
        java.util.Map<String, String> strandedWhy = new java.util.HashMap<>();
        List<PlanEvent> events = new ArrayList<>();
        int rescued = 0;
        int moved = 0;
        for (PlanEvent e : o.events()) {
            if (e.type() == EventType.STAY) {
                continue;
            }
            if (e.type() == EventType.UNPLACED) {
                strandedWhy.put(e.flight(), e.reason());
            }
            if (e.type() == EventType.ASSIGN) {
                rescued++;
            }
            if (e.type() == EventType.MOVE) {
                moved++;
            }
            events.add(e);
        }
        int held = 0;
        int heldMinutes = 0;
        int diverted = 0;
        int allChecks = 0;
        List<ReplanExplainer.Hold> holds = new ArrayList<>();
        List<String> divertedIds = new ArrayList<>();
        if (hold) {
            long t0 = System.nanoTime();
            int checks = 0;
            for (Turnaround t : PlanService.inStartOrder(plan.unplacedVisits())) {
                int start = t.getStart();
                int end = t.getEnd();
                int minTurn = t.getSize() == SizeClass.WIDE ? PlanService.MIN_TURN_WIDE : PlanService.MIN_TURN_NARROW;
                Stand found = null;
                int wait = 0;
                int mine = 0;
                int compatible = RecoveryEngine.preferenceOrder(plan, t, null).size();
                for (int d = 5; d <= MAX_HOLD && found == null; d += 5) {
                    int s2 = start + d;
                    int e2 = t.getDeparture() == null ? end + d : Math.max(end, s2 + minTurn);
                    if (s2 >= PlanState.HORIZON) {
                        break;
                    }
                    t.setTimes(s2, e2);
                    for (Stand s : RecoveryEngine.preferenceOrder(plan, t, null)) {
                        checks++;
                        mine++;
                        if (plan.isFreeFor(s, t)) {
                            found = s;
                            wait = d;
                            break;
                        }
                    }
                }
                if (found == null) {
                    t.setTimes(start, end);
                    diverted++;
                    divertedIds.add(t.getId());
                    plan.markUnplaced(t, "No compatible stand frees up within " + (MAX_HOLD / 60) + " hours of " + Clock.hhmm(start)
                            + ". In real operations this flight would divert to a nearby airport such as Pune.");
                    continue;
                }
                plan.place(t, found.getId());
                holds.add(new ReplanExplainer.Hold(t.getId(), start, wait, mine, compatible, found.getId(),
                        strandedWhy.get(t.getId())));
                held++;
                heldMinutes += wait;
                events.add(new PlanEvent(t.getId(), EventType.DELAY, null, found.getId(), t.getStart(), "Held " + wait + " min"));
                events.add(new PlanEvent(t.getId(), EventType.ASSIGN, null, found.getId(), t.getStart(),
                        "No stand could take it when it was due at " + Clock.hhmm(start) + ", even after the re-plan. It waits "
                                + wait + " min (in the holding pattern, or at its origin before take-off) until stand "
                                + found.getId() + " is open and empty from " + Clock.hhmm(t.getStart()) + " to "
                                + Clock.hhmm(t.getOccupiedEnd()) + ", the earliest moment any compatible stand frees up."));
            }
            allChecks = checks;
            trace.add("Red-black interval tree", 3, "Hold stranded flights until a stand frees", Math.max(1, checks),
                    TraceRecorder.since(t0), "O(s log n) per 5 minute step",
                    held + " flights held until a stand frees" + (diverted > 0 ? ", " + diverted + " would divert" : ""));
        }
        plans.finish(plan, events, trace, o, null);
        if (explain) plan.getLastSnapshots().put("replan", ReplanExplainer.explain(new ReplanExplainer.Input(plan, from, before, redo.size(),
                windows, previous, strandedIds, events, holds, divertedIds, o.unplaced(), greedyLeft, sortMs,
                TraceRecorder.since(tAll), allChecks, matching)));
        String extra = hold ? ", then " + held + " held until a stand freed" + (held > 0 ? " (average " + heldMinutes / held + " min)" : "")
                + ", " + diverted + " would divert" : ", " + o.unplaced() + " still without a stand";
        return new PlanService.Operation(plan, events, trace, "Re-planned " + PlanService.plural(redo.size(), "flight")
                + " from " + Clock.hhmm(from) + ": " + rescued + " stranded flights now have a stand, " + moved + " moved" + extra
                + " (was " + before + " without a stand)");
    }
}
