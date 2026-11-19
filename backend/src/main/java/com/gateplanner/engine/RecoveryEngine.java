package com.gateplanner.engine;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.matching.BipartiteMatcher;
import com.gateplanner.algo.matching.GreedyFirstFit;
import com.gateplanner.algo.matching.MinCutExplainer;
import com.gateplanner.algo.sort.CountingSort;
import com.gateplanner.model.Closure;
import com.gateplanner.model.EventType;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;
import com.gateplanner.model.StandClass;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Recovers the plan after a disruption.
 *
 * <ol>
 *   <li><b>Detect:</b> each changed visit asks its stand's red-black interval tree for overlaps
 *       (O(log n + k)). Of two overlapping visits the one that starts later must move: the earlier
 *       aircraft is physically on the stand. Closures kick every visit their window overlaps.</li>
 *   <li><b>Group:</b> the affected visits are sorted by start (counting sort) and cut into
 *       conflict windows: groups whose intervals all share one common minute. Two visits of the same
 *       window can never share a stand.</li>
 *   <li><b>Match:</b> per window, a bipartite graph links each visit to every compatible stand that
 *       is open and empty for its whole interval (interval tree query per stand). Edmonds-Karp finds
 *       a maximum matching. Inside a window that is optimal: no assignment can place more of these
 *       visits given the stands already in use.</li>
 *   <li><b>Explain:</b> when visits stay unmatched, the minimum cut gives a set S of visits whose
 *       usable stands N(S) are fewer than |S| (Hall's theorem), turned into a plain sentence.</li>
 * </ol>
 *
 * <p><b>Limitation:</b> visits that were not affected are not moved to make room, and each window
 * is matched after the previous one, so the result across windows is not guaranteed optimal. The
 * full problem with preferences is NP-hard.</p>
 *
 * <p><b>Time:</b> O(c log n) detection for c changed visits; per window of size g with s stands,
 * O(g s log n) to build the graph and O(g (g + s + E)) for Edmonds-Karp. <b>Space:</b> O(g s).</p>
 */
public final class RecoveryEngine {

    /** Result of a recovery. */
    public record Outcome(List<PlanEvent> events, int affected, int placed, int unplaced, int windows,
                          Map<String, Object> matchingSnapshot) {
    }

    private static final int SNAPSHOT_LEFT = 24;
    private static final int SNAPSHOT_RIGHT = 36;

    private RecoveryEngine() {
    }

    /**
     * Finds visits that must move because of changed times or new closures, takes them off their
     * stands, and re-places them together with every visit that is still unplaced.
     *
     * @param changed       visits whose times changed (already back on their old stands)
     * @param closures      new closures to enforce (may be empty)
     * @param useMatching   true for maximum matching, false for greedy first-fit (the baseline)
     * @param extra         visits that need a stand and have none yet (rush hour arrivals)
     */
    public static Outcome recover(PlanState plan, Collection<Turnaround> changed, Collection<Closure> closures,
                                  Collection<Turnaround> extra, boolean useMatching, TraceRecorder trace, String cause) {
        long t0 = System.nanoTime();
        Set<Turnaround> kicked = new LinkedHashSet<>();
        int queries = 0;
        int conflicts = 0;
        for (Turnaround v : changed) {
            String standId = plan.standOf(v.getId());
            if (standId == null || kicked.contains(v)) {
                continue;
            }
            if (!plan.openDuring(standId, v.getStart(), v.getOccupiedEnd())) {
                kicked.add(v);
                continue;
            }
            List<RedBlackIntervalTree.Node<String>> hits = plan.tree(standId).overlaps(v.getStart(), v.getOccupiedEnd());
            queries++;
            for (RedBlackIntervalTree.Node<String> h : hits) {
                Turnaround w = plan.visit(h.value());
                if (w == v || kicked.contains(w)) {
                    continue;
                }
                conflicts++;
                Turnaround loser = w.getStart() > v.getStart() ? w : v;
                kicked.add(loser);
                if (loser == v) {
                    break;
                }
            }
        }
        for (Closure c : closures) {
            if (plan.tree(c.standId()) == null) {
                continue;
            }
            queries++;
            for (RedBlackIntervalTree.Node<String> h : plan.tree(c.standId()).overlaps(c.from(), c.to())) {
                kicked.add(plan.visit(h.value()));
            }
        }
        trace.add("Red-black interval tree", 3, "Find visits that now overlap (" + cause + ")", Math.max(1, queries),
                TraceRecorder.since(t0), "O(log n + k) per query",
                PlanService.plural(conflicts, "overlap") + " found on shared stands" + (closures.isEmpty() ? "" : ", "
                        + PlanService.plural(closures.size(), "closure window") + " checked") + "; "
                        + PlanService.plural(kicked.size(), "visit") + " must move");
        Map<String, String> from = new HashMap<>();
        for (Turnaround t : kicked) {
            from.put(t.getId(), plan.unplace(t));
        }
        List<Turnaround> toPlace = new ArrayList<>(kicked);
        for (Turnaround t : extra) {
            if (!toPlace.contains(t)) {
                toPlace.add(t);
            }
        }
        for (Turnaround t : plan.unplacedVisits()) {
            if (!toPlace.contains(t)) {
                toPlace.add(t);
            }
        }
        Outcome o = placeAll(plan, toPlace, useMatching, trace, cause, from);
        return new Outcome(o.events(), kicked.size(), o.placed(), o.unplaced(), o.windows(), o.matchingSnapshot());
    }

    /** Places visits that currently have no stand, window by window. */
    public static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                                   String cause) {
        return placeAll(plan, visits, useMatching, trace, cause, new HashMap<>());
    }

    static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                            String cause, Map<String, String> previousStand) {
        List<PlanEvent> events = new ArrayList<>();
        if (visits.isEmpty()) {
            return new Outcome(events, 0, 0, 0, 0, null);
        }
        int maxKey = PlanState.HORIZON - 1;
        List<Turnaround> sorted = CountingSort.sort(visits, t -> Math.min(maxKey, Math.max(0, t.getStart())), maxKey);
        List<List<Turnaround>> windows = new ArrayList<>();
        List<Turnaround> cur = new ArrayList<>();
        int minEnd = Integer.MAX_VALUE;
        for (Turnaround t : sorted) {
            if (!cur.isEmpty() && t.getStart() >= minEnd) {
                windows.add(cur);
                cur = new ArrayList<>();
                minEnd = Integer.MAX_VALUE;
            }
            cur.add(t);
            minEnd = Math.min(minEnd, t.getOccupiedEnd());
        }
        windows.add(cur);

        long t0 = System.nanoTime();
        int placed = 0;
        int unplaced = 0;
        int edgesTotal = 0;
        int augment = 0;
        Map<String, Object> snapshot = null;
        int snapshotScore = -1;
        List<String> reasons = new ArrayList<>();
        for (List<Turnaround> w : windows) {
            List<Stand> right = new ArrayList<>();
            Map<String, Integer> rightIndex = new LinkedHashMap<>();
            List<List<Integer>> adj = new ArrayList<>();
            for (Turnaround t : w) {
                List<Integer> list = new ArrayList<>();
                for (Stand s : preferenceOrder(plan, t, previousStand.get(t.getId()))) {
                    if (plan.isFreeFor(s, t)) {
                        Integer idx = rightIndex.get(s.getId());
                        if (idx == null) {
                            idx = right.size();
                            right.add(s);
                            rightIndex.put(s.getId(), idx);
                        }
                        list.add(idx);
                    }
                }
                adj.add(list);
                edgesTotal += list.size();
            }
            int[] match;
            BipartiteMatcher matcher = null;
            if (useMatching) {
                matcher = new BipartiteMatcher(w.size(), right.size(), adj);
                matcher.solve();
                augment += matcher.augmentations();
                match = matcher.matchLeft();
            } else {
                match = GreedyFirstFit.match(w.size(), right.size(), adj);
            }
            MinCutExplainer.HallViolator violator = null;
            boolean anyUnmatched = false;
            for (int m : match) {
                anyUnmatched |= m < 0;
            }
            if (anyUnmatched && matcher != null) {
                violator = MinCutExplainer.explain(matcher);
            }
            for (int i = 0; i < w.size(); i++) {
                Turnaround t = w.get(i);
                String old = previousStand.get(t.getId());
                if (match[i] >= 0) {
                    String standId = right.get(match[i]).getId();
                    plan.place(t, standId);
                    placed++;
                    EventType type = old == null ? EventType.ASSIGN : old.equals(standId) ? EventType.STAY : EventType.MOVE;
                    events.add(new PlanEvent(t.getId(), type, old, standId, t.getStart(),
                            useMatching ? "Maximum matching" : "Greedy first-fit"));
                } else {
                    String reason = explain(plan, t, w, adj.get(i).isEmpty(), violator);
                    plan.markUnplaced(t, reason);
                    unplaced++;
                    reasons.add(reason);
                    events.add(new PlanEvent(t.getId(), EventType.UNPLACED, old, null, t.getStart(), reason));
                }
            }
            int score = (anyUnmatched ? 1000 : 0) + w.size();
            if (score > snapshotScore) {
                snapshotScore = score;
                snapshot = matchingSnapshot(plan, w, right, adj, match, violator, useMatching);
            }
        }
        String algo = useMatching ? "Bipartite matching (Edmonds-Karp max flow)" : "Greedy first-fit";
        trace.add(algo, 5, "Re-place " + PlanService.plural(visits.size(), "visit") + " in "
                        + PlanService.plural(windows.size(), "conflict window"),
                visits.size() + edgesTotal, TraceRecorder.since(t0),
                useMatching ? "O(g (g + s + E)) per window" : "O(g + E) per window",
                useMatching
                        ? placed + " placed, " + unplaced + " unplaced; " + augment + " augmenting paths. Inside each "
                            + "window the matching is maximum (no augmenting path left)."
                        : placed + " placed, " + unplaced + " unplaced. First-fit can block a visit that had fewer options.");
        if (unplaced > 0 && useMatching) {
            trace.add("Minimum cut (Hall's theorem)", 5, "Explain unplaced visits", unplaced, 0,
                    "O(V + E) residual search", reasons.get(0));
        }
        return new Outcome(events, visits.size(), placed, unplaced, windows.size(), snapshot);
    }

    /** Previous stand first, then contact stands, then remote stands, each in file order. */
    static List<Stand> preferenceOrder(PlanState plan, Turnaround t, String previous) {
        List<Stand> out = new ArrayList<>();
        if (previous != null && plan.stand(previous) != null) {
            out.add(plan.stand(previous));
        }
        for (boolean contact : new boolean[] {true, false}) {
            for (Stand s : plan.getStands()) {
                if (s.isContact() == contact && !s.getId().equals(previous) && s.canHost(t)) {
                    out.add(s);
                }
            }
        }
        return out;
    }

    /** Plain English reason for an unplaced visit. */
    static String explain(PlanState plan, Turnaround t, List<Turnaround> window, boolean noEdges,
                          MinCutExplainer.HallViolator violator) {
        String when = Clock.hhmm(t.getStart()) + " and " + Clock.hhmm(t.getOccupiedEnd());
        StandClass cls = StandClass.of(t);
        int total = 0;
        int closed = 0;
        for (Stand s : plan.getStands()) {
            if (s.canHost(t)) {
                total++;
                if (!plan.openDuring(s.getId(), t.getStart(), t.getOccupiedEnd())) {
                    closed++;
                }
            }
        }
        if (total == 0) {
            return "No stand at Mumbai can take a " + cls.label() + " flight.";
        }
        if (noEdges) {
            return "No " + cls.label() + " stand is free between " + when + ": " + total + " stands can take it, "
                    + closed + " closed by notices and " + (total - closed) + " already busy.";
        }
        if (violator != null && !violator.flights().isEmpty()) {
            int s = violator.flights().size();
            int ns = violator.stands().size();
            int minStart = Integer.MAX_VALUE;
            for (int i : violator.flights()) {
                minStart = Math.min(minStart, window.get(i).getStart());
            }
            return s + " " + cls.label() + " flights need a stand around " + Clock.hhmm(minStart)
                    + " but only " + ns + " stands are free for them (minimum cut, Hall's theorem: " + s + " > " + ns
                    + "). " + (closed > 0 ? closed + " " + cls.label() + " stands are closed by notices then." : "");
        }
        return "All stands that could take this " + cls.label() + " flight between " + when
                + " were given to other flights in the same window.";
    }

    private static Map<String, Object> matchingSnapshot(PlanState plan, List<Turnaround> w, List<Stand> right,
                                                        List<List<Integer>> adj, int[] match,
                                                        MinCutExplainer.HallViolator violator, boolean matching) {
        int nl = Math.min(SNAPSHOT_LEFT, w.size());
        List<Integer> rightKeep = new ArrayList<>();
        Map<Integer, Integer> rightMap = new HashMap<>();
        for (int i = 0; i < nl; i++) {
            for (int j : adj.get(i)) {
                if (!rightMap.containsKey(j) && rightKeep.size() < SNAPSHOT_RIGHT) {
                    rightMap.put(j, rightKeep.size());
                    rightKeep.add(j);
                }
            }
        }
        List<Map<String, Object>> left = new ArrayList<>();
        for (int i = 0; i < nl; i++) {
            Turnaround t = w.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("label", t.getLabel());
            m.put("size", t.getSize());
            m.put("intl", t.isInternational());
            m.put("start", t.getStart());
            m.put("end", t.getOccupiedEnd());
            left.add(m);
        }
        List<Map<String, Object>> rightOut = new ArrayList<>();
        for (int j : rightKeep) {
            Stand s = right.get(j);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("size", s.getSize());
            m.put("contact", s.isContact());
            rightOut.add(m);
        }
        List<int[]> edges = new ArrayList<>();
        List<int[]> matched = new ArrayList<>();
        for (int i = 0; i < nl; i++) {
            for (int j : adj.get(i)) {
                Integer r = rightMap.get(j);
                if (r != null) {
                    edges.add(new int[] {i, r});
                    if (match[i] == j) {
                        matched.add(new int[] {i, r});
                    }
                }
            }
        }
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("method", matching ? "matching" : "greedy");
        snap.put("left", left);
        snap.put("right", rightOut);
        snap.put("edges", edges);
        snap.put("matched", matched);
        snap.put("windowSize", w.size());
        snap.put("standsConsidered", right.size());
        if (violator != null) {
            List<Integer> vl = new ArrayList<>();
            for (int i : violator.flights()) {
                if (i < nl) {
                    vl.add(i);
                }
            }
            List<Integer> vr = new ArrayList<>();
            for (int j : violator.stands()) {
                Integer r = rightMap.get(j);
                if (r != null) {
                    vr.add(r);
                }
            }
            snap.put("cutLeft", vl);
            snap.put("cutRight", vr);
            snap.put("deficiency", violator.deficiency());
        }
        return snap;
    }
}
