package com.gateplanner.engine;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.matching.BipartiteMatcher;
import com.gateplanner.algo.matching.GreedyFirstFit;
import com.gateplanner.algo.matching.MinCostMatcher;
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

    /**
     * What one conflict window looked like, kept only when a caller wants to explain the repair step by step.
     * {@code options} holds, per visit, the stands that were open and empty for its whole visit (its edges).
     */
    public record WindowInfo(int index, List<String> visits, int firstStart, int sharedMinute, int stands, int edges,
                             int augmentations, int matched, int greedyMatched, double ms,
                             Map<String, List<String>> options, List<String> cutVisits, List<String> cutStands) {
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
        Map<String, String> why = new HashMap<>();
        int queries = 0;
        int conflicts = 0;
        for (Turnaround v : changed) {
            String standId = plan.standOf(v.getId());
            if (standId == null || kicked.contains(v)) {
                continue;
            }
            if (!plan.openDuring(standId, v.getStart(), v.getOccupiedEnd())) {
                kicked.add(v);
                why.put(v.getId(), "Its new times (" + Clock.hhmm(v.getStart()) + " to " + Clock.hhmm(v.getOccupiedEnd())
                        + ") run into a closure of stand " + standId);
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
                Turnaround keeper = loser == w ? v : w;
                kicked.add(loser);
                why.put(loser.getId(), loser == w
                        ? "Delayed " + keeper.getLabel() + " is still on stand " + standId + " (with its safety gap until "
                            + Clock.hhmm(keeper.getOccupiedEnd()) + ") when this flight needs it at " + Clock.hhmm(loser.getStart())
                        : "After its delay it would overlap " + keeper.getLabel() + ", which is due on stand " + standId
                            + " at " + Clock.hhmm(keeper.getStart()));
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
                why.putIfAbsent(h.value(), "Stand " + c.standId() + " is closed from " + Clock.hhmm(c.from()) + " to "
                        + Clock.hhmm(c.to()) + (c.reason() == null || c.reason().isBlank() ? "" : " (" + c.reason() + ")"));
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
        Outcome o = placeAll(plan, toPlace, useMatching && !plan.isGreedyRecovery(), trace, cause, from, why);
        return new Outcome(o.events(), kicked.size(), o.placed(), o.unplaced(), o.windows(), o.matchingSnapshot());
    }

    /** Places visits that currently have no stand, window by window. */
    public static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                                   String cause) {
        return placeAll(plan, visits, useMatching, trace, cause, new HashMap<>());
    }

    static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                            String cause, Map<String, String> previousStand) {
        return placeAll(plan, visits, useMatching, trace, cause, previousStand, Map.of());
    }

    /**
     * As above; {@code why} holds, per visit id, the reason it had to leave its stand, which is
     * joined with the reason for the new stand into the event text shown on the flight card.
     */
    static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                            String cause, Map<String, String> previousStand, Map<String, String> why) {
        return placeAll(plan, visits, useMatching, trace, cause, previousStand, why, null);
    }

    /** As above; when {@code log} is not null, one {@link WindowInfo} per conflict window is added to it. */
    static Outcome placeAll(PlanState plan, List<Turnaround> visits, boolean useMatching, TraceRecorder trace,
                            String cause, Map<String, String> previousStand, Map<String, String> why,
                            List<WindowInfo> log) {
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
        int minCostRounds = 0;
        Map<String, Object> snapshot = null;
        int snapshotScore = -1;
        List<String> reasons = new ArrayList<>();
        for (List<Turnaround> w : windows) {
            long tw = System.nanoTime();
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
                int best = matcher.solve();
                augment += matcher.augmentations();
                match = matcher.matchLeft();
                // among all matchings of that maximum size, take the one that moves the fewest aircraft and
                // tows them the shortest distance (min-cost flow); Edmonds-Karp still supplies the size and the cut
                List<List<Long>> cost = new ArrayList<>();
                for (int i = 0; i < w.size(); i++) {
                    String prev = previousStand.get(w.get(i).getId());
                    List<Long> c = new ArrayList<>();
                    for (int j : adj.get(i)) {
                        c.add(moveCost(plan, prev, right.get(j)));
                    }
                    cost.add(c);
                }
                MinCostMatcher mc = new MinCostMatcher(w.size(), right.size(), adj, cost);
                if (mc.solve() == best) {
                    match = mc.matchLeft();
                    minCostRounds += mc.rounds();
                }
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
            if (log != null) {
                log.add(windowInfo(log.size() + 1, w, right, adj, match, matcher, violator, useMatching, tw));
            }
            for (int i = 0; i < w.size(); i++) {
                Turnaround t = w.get(i);
                String old = previousStand.get(t.getId());
                if (match[i] >= 0) {
                    String standId = right.get(match[i]).getId();
                    plan.place(t, standId);
                    placed++;
                    EventType type = old == null ? EventType.ASSIGN : old.equals(standId) ? EventType.STAY : EventType.MOVE;
                    String text = useMatching ? "Maximum matching" : "Greedy first-fit";
                    if (type != EventType.STAY) {
                        text = moveReason(t, right.get(match[i]), right, adj.get(i), w.size(), useMatching, why.get(t.getId()));
                    }
                    events.add(new PlanEvent(t.getId(), type, old, standId, t.getStart(), text));
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
                            + "window the matching is maximum (no augmenting path left); min-cost flow then chose, among "
                            + "matchings of that size, the one with the fewest moves and shortest tows."
                        : placed + " placed, " + unplaced + " unplaced. First-fit can block a visit that had fewer options.");
        if (unplaced > 0 && useMatching) {
            trace.add("Minimum cut (Hall's theorem)", 5, "Explain unplaced visits", unplaced, 0,
                    "O(V + E) residual search", reasons.get(0));
        }
        return new Outcome(events, visits.size(), placed, unplaced, windows.size(), snapshot);
    }

    private static WindowInfo windowInfo(int index, List<Turnaround> w, List<Stand> right, List<List<Integer>> adj,
                                         int[] match, BipartiteMatcher matcher, MinCutExplainer.HallViolator violator,
                                         boolean useMatching, long t0) {
        List<String> ids = new ArrayList<>();
        Map<String, List<String>> options = new LinkedHashMap<>();
        int edges = 0;
        int matched = 0;
        for (int i = 0; i < w.size(); i++) {
            ids.add(w.get(i).getId());
            List<String> opt = new ArrayList<>();
            for (int j : adj.get(i)) {
                opt.add(right.get(j).getId());
            }
            options.put(w.get(i).getId(), opt);
            edges += opt.size();
            matched += match[i] >= 0 ? 1 : 0;
        }
        int greedy = 0;
        for (int m : GreedyFirstFit.match(w.size(), right.size(), adj)) {
            greedy += m >= 0 ? 1 : 0;
        }
        List<String> cutVisits = new ArrayList<>();
        List<String> cutStands = new ArrayList<>();
        if (violator != null) {
            for (int i : violator.flights()) {
                cutVisits.add(w.get(i).getId());
            }
            for (int j : violator.stands()) {
                cutStands.add(right.get(j).getId());
            }
        }
        int shared = 0;
        for (Turnaround t : w) {
            shared = Math.max(shared, t.getStart());
        }
        return new WindowInfo(index, ids, w.get(0).getStart(), shared, right.size(), edges,
                matcher == null ? 0 : matcher.augmentations(), matched, useMatching ? greedy : matched,
                TraceRecorder.since(t0), options, cutVisits, cutStands);
    }

    /** Cost of putting a visit on a stand: staying is free, moving costs a lot plus the towing distance. */
    static final long MOVE_COST = 100_000L;
    static final long REMOTE_COST = 200L;

    static long moveCost(PlanState plan, String previous, Stand s) {
        long c = s.isContact() ? 0 : REMOTE_COST;
        if (previous == null || previous.equals(s.getId())) {
            return c;
        }
        Stand p = plan.stand(previous);
        double d = p == null ? 0 : Math.hypot(p.getX() - s.getX(), p.getY() - s.getY());
        return c + MOVE_COST + Math.round(d);
    }

    /** Straight-line towing distance between two stands, in metres. */
    public static double towMetres(PlanState plan, String a, String b) {
        Stand p = plan.stand(a);
        Stand q = plan.stand(b);
        return p == null || q == null ? 0 : Math.hypot(p.getX() - q.getX(), p.getY() - q.getY());
    }

    /** Plain English: why the visit had to move, and why it got this particular stand. */
    static String moveReason(Turnaround t, Stand chosen, List<Stand> right, List<Integer> options, int windowSize,
                             boolean useMatching, String leftBecause) {
        String cls = StandClass.of(t).label();
        String when = Clock.hhmm(t.getStart()) + " to " + Clock.hhmm(t.getOccupiedEnd());
        boolean contactOption = false;
        for (int k : options) {
            contactOption |= right.get(k).isContact();
        }
        StringBuilder b = new StringBuilder();
        if (leftBecause != null) {
            b.append(leftBecause).append(". ");
        }
        b.append("Stand ").append(chosen.getId()).append(" can take a ").append(cls).append(" flight and is open and empty from ")
                .append(when).append(" including the safety gap. ");
        if (chosen.isContact()) {
            b.append("It is a jet-bridge stand, preferred over remote stands. ");
        } else if (contactOption) {
            b.append("It is a remote stand: the free jet-bridge stands were needed by other flights in the same window. ");
        } else {
            b.append("It is a remote stand because no jet-bridge ").append(cls).append(" stand was free for that time. ");
        }
        b.append(options.size()).append(options.size() == 1 ? " stand was" : " stands were").append(" possible; ")
                .append(useMatching
                        ? "maximum matching re-placed all " + windowSize + " flights of this window together."
                        : "greedy first-fit took the first free one in order.");
        return b.toString();
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
