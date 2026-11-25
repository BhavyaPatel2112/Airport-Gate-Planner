package com.gateplanner.engine;

import com.gateplanner.model.EventType;
import com.gateplanner.model.Flight;
import com.gateplanner.model.MovementType;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Turnaround;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Monsoon storms and rush hours. Both take a seed, so the same seed always gives the same
 * disruption.
 *
 * <p><b>Storm:</b> each arrival in the window is hit with a probability that grows with severity;
 * a hit flight is delayed by its airline's real arrival delay at the severity percentile
 * (randomized Quickselect), at least 10 minutes, plus a seeded jitter of 0 to 10 minutes.</p>
 *
 * <p><b>Rush hour:</b> adds N simulated arrivals that copy the airline, terminal and size mix of
 * real visits, starting 20 to 110 minutes after the clock. They are placed by matching; any that
 * do not fit stay in the holding stack.</p>
 */
@Service
public class DisruptionEngine {

    private final PlanService plans;

    public DisruptionEngine(PlanService plans) {
        this.plans = plans;
    }

    public synchronized PlanService.Operation storm(String planId, int severity, long seed, int from, int to) {
        if (severity < 50 || severity > 99) {
            throw new InvalidInputException("Storm severity percentile must be between 50 and 99");
        }
        if (to <= from) {
            throw new InvalidInputException("Storm end must be after its start");
        }
        return stormOn(plans.get(planId), severity, seed, from, to);
    }

    /** The storm on a plan object, so it can also run on copies. */
    public PlanService.Operation stormOn(PlanState plan, int severity, long seed, int from, int to) {
        DelayStats stats = plans.data().delayStats();
        TraceRecorder trace = new TraceRecorder();
        Random rnd = new Random(seed);
        double hitProbability = 0.45 + 0.5 * (severity - 50) / 49.0;
        List<Turnaround> hit = new ArrayList<>();
        List<PlanEvent> events = new ArrayList<>();
        long t0 = System.nanoTime();
        int selections = 0;
        for (Turnaround t : PlanService.inStartOrder(plan.getVisits())) {
            if (t.isCancelled() || t.getArrival() == null || t.getStart() < from || t.getStart() >= to) {
                continue;
            }
            if (rnd.nextDouble() >= hitProbability) {
                continue;
            }
            double p = stats.arrivalPercentile(t.getAirlineCode(), severity, seed);
            selections++;
            int delay = (int) Math.max(10, Math.round(p)) + rnd.nextInt(11);
            int newStart = t.getStart() + delay;
            int minTurn = t.getSize() == SizeClass.WIDE ? PlanService.MIN_TURN_WIDE : PlanService.MIN_TURN_NARROW;
            int newEnd = t.getDeparture() == null ? t.getEnd() + delay : Math.max(t.getEnd(), newStart + minTurn);
            PlanService.retime(plan, t, newStart, newEnd);
            hit.add(t);
            events.add(new PlanEvent(t.getId(), EventType.DELAY, plan.standOf(t.getId()), plan.standOf(t.getId()),
                    newStart, "Monsoon delay " + delay + " min"));
        }
        trace.add("Randomized Quickselect", 6, "Storm delay per airline at the " + severity + "th percentile",
                selections, TraceRecorder.since(t0), "Expected O(n) per selection",
                hit.size() + " arrivals hit between " + Clock.hhmm(from) + " and " + Clock.hhmm(to) + " (seed " + seed
                        + ", hit chance " + Math.round(hitProbability * 100) + "%)");
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, hit, List.of(), List.of(), true, trace, "monsoon");
        events.addAll(o.events());
        plans.finish(plan, events, trace, o, null);
        return new PlanService.Operation(plan, events, trace, "Monsoon storm: " + PlanService.plural(hit.size(), "arrival") + " delayed, "
                + o.affected() + " had to move, " + o.unplaced() + " without a stand");
    }

    public synchronized PlanService.Operation rush(String planId, int count, long seed, int atMinute) {
        if (count < 1 || count > 200) {
            throw new InvalidInputException("Rush hour count must be between 1 and 200");
        }
        PlanState plan = plans.get(planId);
        TraceRecorder trace = new TraceRecorder();
        Random rnd = new Random(seed);
        List<Turnaround> templates = new ArrayList<>();
        for (Turnaround t : plan.getVisits()) {
            if (!t.isSynthetic() && !t.isCancelled() && t.getArrival() != null) {
                templates.add(t);
            }
        }
        int existing = 0;
        for (Turnaround t : plan.getVisits()) {
            if (t.isSynthetic()) {
                existing++;
            }
        }
        List<Turnaround> added = new ArrayList<>();
        List<PlanEvent> events = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Turnaround tpl = templates.get(rnd.nextInt(templates.size()));
            Flight a = tpl.getArrival();
            int start = Math.max(0, atMinute + 20 + rnd.nextInt(91));
            int turn = tpl.getSize() == SizeClass.WIDE ? Turnaround.WIDE_TURN : Turnaround.NARROW_TURN;
            String number = a.getAirlineCode() + " " + (9001 + existing + i);
            Flight f = new Flight(number, a.getAirlineCode(), a.getAirline(), MovementType.ARR, a.getAircraft(),
                    tpl.getSize(), tpl.isInternational(), a.getOtherAirport(), a.getCity(), start, start,
                    tpl.getTerminal(), "", false, "", false);
            Turnaround t = new Turnaround("RUSH" + (existing + i + 1), f, null, tpl.getSize(), tpl.isInternational(),
                    tpl.getTerminal(), a.getAirlineCode(), a.getAirline(), "", false, true, start, start + turn,
                    start, start + turn);
            t.setBuffer(tpl.getBuffer());
            plan.addVisit(t);
            added.add(t);
            events.add(new PlanEvent(t.getId(), EventType.HOLD, null, null, start, "Rush hour arrival (simulated)"));
        }
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(), List.of(), added, true, trace, "rush hour");
        events.addAll(o.events());
        plans.finish(plan, events, trace, o, null);
        int holding = plan.unplacedVisits().size();
        return new PlanService.Operation(plan, events, trace, "Rush hour: " + count + " simulated arrivals, "
                + (count - countUnplaced(plan, added)) + " placed" + (holding > 0 ? ", holding stack now " + holding : ""));
    }

    private static int countUnplaced(PlanState plan, List<Turnaround> list) {
        int c = 0;
        for (Turnaround t : list) {
            if (plan.standOf(t.getId()) == null) {
                c++;
            }
        }
        return c;
    }
}
