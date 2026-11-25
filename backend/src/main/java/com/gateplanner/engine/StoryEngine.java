package com.gateplanner.engine;

import com.gateplanner.model.Closure;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The arrival at the end of the story flight: Air India AI 116 from New York (a real flight in the data)
 * reaches Mumbai just as a monsoon storm delays the arrivals ahead of it and waterlogging closes several
 * international wide-body stands. The same disruption is solved twice, on two copies of one plan:
 *
 * <ul>
 *   <li><b>today</b>: first come, first served. Greedy first-fit repairs the plan, and flights left without a
 *       stand circle until one frees up (interval tree search in 5 minute steps).</li>
 *   <li><b>ours</b>: every flight from the start of the storm is re-planned together, window by window, with
 *       maximum matching (Edmonds-Karp) and min-cost flow, which picks the assignment that moves the fewest
 *       aircraft over the shortest tows; anything still left then holds the same way.</li>
 * </ul>
 *
 * <p>A few storm patterns and closure sizes are tried, and the one where the story flight's holding time
 * differs most is kept, so the story shows a real difference that Java computed, never a scripted one.
 * The two plans are kept like any other plan, so the browser draws them from their ids.</p>
 */
@Service
public class StoryEngine {

    static final String STORY_FLIGHT = "AI 116";

    private final PlanService plans;
    private final DisruptionEngine storms;
    private final ScenarioEngine scenarios;
    private final Map<Integer, Map<String, Object>> cache = new HashMap<>();

    public StoryEngine(PlanService plans, DisruptionEngine storms, ScenarioEngine scenarios) {
        this.plans = plans;
        this.storms = storms;
        this.scenarios = scenarios;
    }

    private record Run(PlanState plan, int due, int hold, String stand, int stranded, int moved, double towMetres,
                       List<Map<String, Object>> moves, double ms, int heldFlights, int heldMinutes, int towed) {
    }

    public synchronized Map<String, Object> arrival(int day) {
        Map<String, Object> hit = cache.get(day);
        if (hit != null && alive(hit)) {
            return hit;
        }
        PlanState base = plans.create(day, 75).plan();
        Turnaround flight = base.findVisit(STORY_FLIGHT);
        if (flight == null) {
            throw new NotFoundException("The story flight " + STORY_FLIGHT + " is not in day " + day);
        }
        String id = flight.getId();
        int due0 = flight.getStart();
        int stormFrom = Math.max(0, due0 - 150);
        int stormTo = due0 + 30;
        int closeFrom = due0 - 60;
        int closeTo = due0 + 150;
        // candidate closures: whole international piers (one or two), or some of the wide-body stands
        Map<String, List<Stand>> groups = new LinkedHashMap<>();
        List<Stand> wide = new ArrayList<>();
        for (Stand s : base.getStands()) {
            if (s.getTerminal().equals(flight.getTerminal()) && s.isInternational() == flight.isInternational()) {
                groups.computeIfAbsent(s.getGroup(), g -> new ArrayList<>()).add(s);
                if (s.getSize() == SizeClass.WIDE) {
                    wide.add(s);
                }
            }
        }
        wide.sort(Comparator.comparing(Stand::getId));
        List<List<Stand>> sets = new ArrayList<>();
        List<String> keys = new ArrayList<>(groups.keySet());
        for (int i = 0; i < keys.size(); i++) {
            sets.add(groups.get(keys.get(i)));
            for (int j = i + 1; j < keys.size(); j++) {
                List<Stand> two = new ArrayList<>(groups.get(keys.get(i)));
                two.addAll(groups.get(keys.get(j)));
                sets.add(two);
            }
        }
        for (int k = wide.size() / 3; k <= wide.size() - 2; k += 3) {
            sets.add(wide.subList(0, k));
        }
        Run bestToday = null;
        Run bestOurs = null;
        List<Closure> bestClosures = null;
        long bestSeed = 0;
        double bestScore = Double.NEGATIVE_INFINITY;
        int n = 0;
        search:
        for (long seed : new long[] {7, 11, 23}) {
            for (List<Stand> set : sets) {
                List<Closure> closures = new ArrayList<>();
                for (Stand s : set) {
                    closures.add(new Closure(s.getId(), closeFrom, closeTo, null, "waterlogged apron"));
                }
                n++;
                Run today = fixedRun(base, base.getId() + "-t" + n, id, seed, stormFrom, stormTo, closures);
                Run ours = run(base, base.getId() + "-o" + n, id, false, seed, stormFrom, stormTo, closures);
                if (today.stand() == null || ours.stand() == null) {
                    continue;
                }
                // a real wait with the fixed plan, as little as possible with the planner, few aircraft towed
                double score = (today.hold() - ours.hold()) * 10.0 - ours.towed() * 4.0 - ours.moved()
                        + Math.min(today.hold(), 90) * 0.5;
                if (score > bestScore) {
                    bestScore = score;
                    bestToday = today;
                    bestOurs = ours;
                    bestClosures = closures;
                    bestSeed = seed;
                }
                // a clear case: a long wait with the fixed plan, none with the planner, at most one tow; stop looking
                if (today.hold() >= 45 && ours.hold() == 0 && ours.towed() <= 1) {
                    break search;
                }
            }
        }
        if (bestToday == null) {
            throw new InfeasibleException("No storm pattern leaves " + STORY_FLIGHT + " a stand on day " + day);
        }
        plans.register(bestToday.plan());
        plans.register(bestOurs.plan());
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("visit", id);
        f.put("number", STORY_FLIGHT);
        f.put("from", "New York (JFK)");
        f.put("aircraft", flight.getArrival() == null ? "" : flight.getArrival().getAircraft());
        f.put("scheduled", flight.getSchedStart());
        f.put("due", bestToday.due());
        out.put("flight", f);
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("title", "Monsoon storm over Mumbai");
        d.put("stormFrom", stormFrom);
        d.put("stormTo", stormTo);
        d.put("severity", 95);
        d.put("seed", bestSeed);
        d.put("closedStands", bestClosures.stream().map(Closure::standId).toList());
        d.put("closeFrom", closeFrom);
        d.put("closeTo", closeTo);
        d.put("lines", List.of(
                "Arrivals ahead of you are running up to an hour late",
                bestClosures.size() + " international stands are waterlogged and closed",
                STORY_FLIGHT + " is told to hold over the airport"));
        out.put("disruption", d);
        out.put("today", view(bestToday, "Fixed stand plan",
                "Stands are fixed the night before. When one is blocked, the next aircraft waits for it to clear, "
                        + "and the delay knocks on down the line."));
        out.put("ours", view(bestOurs, "Our Java planner",
                "Maximum matching re-plans everything together; min-cost flow moves the fewest aircraft the shortest way"));
        out.put("candidatesTried", n * 2);
        cache.put(day, out);
        return out;
    }

    private boolean alive(Map<String, Object> story) {
        try {
            for (String k : new String[] {"today", "ours"}) {
                @SuppressWarnings("unchecked")
                Map<String, Object> v = (Map<String, Object>) story.get(k);
                plans.get((String) v.get("planId"));
            }
            return true;
        } catch (NotFoundException e) {
            return false;
        }
    }

    /**
     * The usual way: no re-planning. Every flight keeps the stand it was given and waits until that stand is clear
     * and open, so one late aircraft delays the next one on the same stand, and so on (a domino of delays).
     */
    private Run fixedRun(PlanState base, String newId, String id, long seed, int stormFrom, int stormTo,
                         List<Closure> closures) {
        long t0 = System.nanoTime();
        // the storm draws the same delays on any copy of one plan; read them off a scratch copy
        PlanState scratch = plans.copy(base, newId + "-s");
        storms.stormOn(scratch, 95, seed, stormFrom, stormTo);
        PlanState p = plans.copy(base, newId);
        p.getClosures().addAll(closures);
        Map<String, List<Turnaround>> byStand = new HashMap<>();
        for (Turnaround t : PlanService.inStartOrder(p.getVisits())) {
            String st = p.standOf(t.getId());
            if (st != null) {
                byStand.computeIfAbsent(st, k -> new ArrayList<>()).add(t);
            }
        }
        int due = scratch.visit(id).getStart();
        int hold = 0;
        int delayed = 0;
        int minutes = 0;
        for (Map.Entry<String, List<Turnaround>> e : byStand.entrySet()) {
            for (Turnaround t : e.getValue()) {
                p.unplace(t);
            }
            int free = Integer.MIN_VALUE;
            for (Turnaround t : e.getValue()) {
                Turnaround w = scratch.visit(t.getId());
                int s = w.getStart();
                int en = w.getEnd();
                int at = Math.max(s, free);
                boolean moved = true;
                while (moved) {
                    moved = false;
                    for (Closure c : closures) {
                        // an aircraft already parked when the stand closes stays; later ones wait for it to reopen
                        if (c.standId().equals(e.getKey()) && s >= c.from() && c.overlaps(at, at + (en - s) + t.getBuffer())) {
                            at = c.to();
                            moved = true;
                        }
                    }
                }
                t.setTimes(at, en + (at - s));
                p.place(t, e.getKey());
                free = t.getOccupiedEnd();
                if (at > s) {
                    delayed++;
                    minutes += at - s;
                }
                if (t.getId().equals(id)) {
                    hold = at - s;
                }
            }
        }
        plans.finish(p, new ArrayList<>(), new TraceRecorder(), null, null);
        return new Run(p, due, hold, p.standOf(id), 0, 0, 0, List.of(), TraceRecorder.since(t0), delayed, minutes, 0);
    }

    private Run run(PlanState base, String newId, String id, boolean today, long seed, int stormFrom, int stormTo,
                    List<Closure> closures) {
        PlanState p = plans.copy(base, newId);
        p.setGreedyRecovery(today);
        Map<String, String> before = new HashMap<>();
        Map<String, Integer> startedAt = new HashMap<>();
        for (Turnaround t : p.getVisits()) {
            before.put(t.getId(), p.standOf(t.getId()));
            startedAt.put(t.getId(), t.getStart());
        }
        storms.stormOn(p, 95, seed, stormFrom, stormTo);
        plans.applyClosures(p, new ArrayList<>(closures), new TraceRecorder(), "Waterlogged stands");
        Turnaround t = p.visit(id);
        int due = t.getStart();
        int stranded = p.unplacedVisits().size();
        Map<String, Integer> startBefore = new HashMap<>();
        for (Turnaround v : p.unplacedVisits()) {
            startBefore.put(v.getId(), v.getStart());
        }
        long t0 = System.nanoTime();
        // today only the stranded flights are dealt with, one after another; ours re-plans from the storm onwards
        scenarios.replanOn(p, today ? PlanState.HORIZON : stormFrom, true, false);
        double ms = TraceRecorder.since(t0);
        int heldFlights = 0;
        int heldMinutes = 0;
        for (Map.Entry<String, Integer> e : startBefore.entrySet()) {
            Turnaround v = p.visit(e.getKey());
            if (p.standOf(v.getId()) != null && v.getStart() > e.getValue()) {
                heldFlights++;
                heldMinutes += v.getStart() - e.getValue();
            }
        }
        int moved = 0;
        int towed = 0;
        double tow = 0;
        double shift = 0;
        List<Map<String, Object>> moves = new ArrayList<>();
        for (Turnaround v : p.getVisits()) {
            String a = before.get(v.getId());
            String b = p.standOf(v.getId());
            if (a != null && b != null && !a.equals(b) && !v.getId().equals(id)) {
                moved++;
                // only an aircraft already on the ground when the plan changes is towed; the rest are simply
                // given another stand before they land
                boolean onGround = startedAt.get(v.getId()) < stormFrom;
                double m = RecoveryEngine.towMetres(p, a, b);
                shift += m;
                if (onGround) {
                    towed++;
                    tow += m;
                }
                Map<String, Object> mv = new LinkedHashMap<>();
                mv.put("visit", v.getId());
                mv.put("label", v.getLabel());
                mv.put("from", a);
                mv.put("to", b);
                mv.put("metres", Math.round(m));
                mv.put("start", v.getStart());
                mv.put("tow", onGround);
                moves.add(mv);
            }
        }
        moves.sort(Comparator.comparingInt(x -> (Integer) x.get("start")));
        p.getLastSnapshots().put("storyShiftMetres", shift);
        return new Run(p, due, t.getStart() - due, p.standOf(id), stranded, moved, tow, moves, ms, heldFlights,
                heldMinutes, towed);
    }

    private static Map<String, Object> view(Run r, String name, String how) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("planId", r.plan().getId());
        v.put("name", name);
        v.put("how", how);
        v.put("hold", r.hold());
        v.put("landAt", r.due() + r.hold());
        v.put("stand", r.stand());
        v.put("strandedAfterStorm", r.stranded());
        v.put("moved", r.moved());
        v.put("towed", r.towed());
        v.put("reassigned", r.moved() - r.towed());
        v.put("towKm", Math.round(r.towMetres() / 100.0) / 10.0);
        Object sh = r.plan().getLastSnapshots().remove("storyShiftMetres");
        v.put("shiftKm", sh == null ? 0 : Math.round((Double) sh / 100.0) / 10.0);
        v.put("heldFlights", r.heldFlights());
        v.put("heldMinutes", r.heldMinutes());
        v.put("ms", Math.round(r.ms() * 10) / 10.0);
        v.put("moves", r.moves());
        return v;
    }

    /** Clears the cache, for tests. */
    void forget() {
        cache.clear();
    }
}
