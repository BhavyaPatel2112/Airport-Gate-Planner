package com.gateplanner.engine;

import com.gateplanner.algo.segtree.LazySegmentTree;
import com.gateplanner.algo.sort.CountingSort;
import com.gateplanner.model.EventType;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;
import com.gateplanner.model.StandClass;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Builds the initial stand plan with interval partitioning.
 *
 * <ol>
 *   <li>Counting sort puts the visits in start order (O(n + k)).</li>
 *   <li>Each compatibility class has its own pool of stands. Stands already in use sit in a
 *       {@link StandAvailabilityQueue} (Fibonacci heap) keyed by the minute they become free. A
 *       visit takes the stand that frees earliest if it is free in time; otherwise the pool opens
 *       a new stand (contact stands first).</li>
 *   <li>Visits whose own class is full go to the holding stack and are then placed by maximum
 *       matching ({@link RecoveryEngine}) on any compatible stand with a gap, including a wide-body
 *       stand for a narrow-body aircraft; any left over get a minimum-cut reason. Doing overflow
 *       last means a narrow-body can never take the only wide stand a wide-body needed.</li>
 *   <li>Proof: inside one class all stands are interchangeable, and interval partitioning opens
 *       a new stand only when every open stand is busy, so the number of stands it opens equals
 *       the largest number of visits overlapping at one minute. No plan can do better, because
 *       overlapping visits need different stands. A lazy segment tree measures that peak.</li>
 * </ol>
 *
 * <p><b>Time:</b> O(n + k) sort, O(n log s) assignment for s stands (amortised heap operations),
 * O(n log k) for the segment tree. <b>Space:</b> O(n + s + k).</p>
 */
public final class GatePlanner {

    /** Certificate for one class: busiest moment versus stands opened. */
    public record ClassCertificate(String key, String label, int visits, int peak, int peakMinute, int standsUsed,
                                   int standsAvailable, int overflow, int unplaced, boolean tight) {
    }

    /** Certificate for the whole plan. */
    public record Certificate(List<ClassCertificate> classes, int standsUsed, int standsAvailable, int sumOfPeaks,
                              int busiestMoment, int busiestMinute, boolean optimal, String statement) {
    }

    private static final class Pool {
        private final StandClass cls;
        private final FibStandAvailabilityQueue open = new FibStandAvailabilityQueue();
        private final List<Stand> unused = new ArrayList<>();

        Pool(StandClass cls) {
            this.cls = cls;
        }
    }

    private GatePlanner() {
    }

    /**
     * Assigns every visit of the plan to a stand.
     *
     * @return the ASSIGN, HOLD and UNPLACED events
     */
    public static List<PlanEvent> assign(PlanState plan, TraceRecorder trace) {
        List<Turnaround> visits = new ArrayList<>();
        for (Turnaround t : plan.getVisits()) {
            if (!t.isCancelled()) {
                visits.add(t);
            }
        }
        int maxKey = PlanState.HORIZON - 1;
        List<Turnaround> sorted = trace.time("Counting sort", 1, "Sort " + visits.size() + " visits by start minute",
                visits.size(), "O(n + k), k = " + PlanState.HORIZON,
                "Stable: equal start minutes keep input order; no comparisons between visits",
                () -> CountingSort.sort(visits, t -> Math.min(maxKey, t.getStart()), maxKey));

        Map<String, Pool> pools = new LinkedHashMap<>();
        for (Stand s : plan.getStands()) {
            pools.computeIfAbsent(StandClass.of(s).key(), k -> new Pool(StandClass.of(s)));
        }
        // contact stands first, then remote, each in file order
        for (boolean contact : new boolean[] {true, false}) {
            for (Stand s : plan.getStands()) {
                if (s.isContact() == contact) {
                    pools.get(StandClass.of(s).key()).unused.add(s);
                }
            }
        }

        HoldingStack holding = new HoldingStack();
        List<PlanEvent> events = new ArrayList<>();
        long t0 = System.nanoTime();
        int heapOps = 0;
        for (Turnaround t : sorted) {
            Stand chosen = null;
            Pool pool = pools.get(StandClass.of(t).key());
            if (pool != null) {
                chosen = take(plan, pool, t);
                heapOps++;
            }
            if (chosen == null) {
                holding.push(t);
            } else {
                plan.place(t, chosen.getId());
                events.add(new PlanEvent(t.getId(), EventType.ASSIGN, null, chosen.getId(), t.getStart(),
                        "Earliest-free compatible stand"));
            }
        }
        int decreaseKeys = 0;
        for (Pool p : pools.values()) {
            decreaseKeys += p.open.decreaseKeys();
        }
        trace.add("Fibonacci heap", 2, "Interval partitioning: earliest-free stand per class", sorted.size(),
                TraceRecorder.since(t0), "O(1) insert, O(log s) amortised extract-min",
                heapOps + " heap lookups over " + pools.size() + " stand pools, " + holding.size()
                        + " visits sent to the holding stack" + (decreaseKeys > 0 ? ", " + decreaseKeys + " decrease-keys" : ""));

        if (!holding.isEmpty()) {
            List<Turnaround> waiting = holding.drainInOrder();
            for (Turnaround t : waiting) {
                events.add(new PlanEvent(t.getId(), EventType.HOLD, null, null, t.getStart(),
                        "No stand free at arrival time; sent to the holding stack"));
            }
            RecoveryEngine.Outcome outcome = RecoveryEngine.placeAll(plan, waiting, true, trace,
                    "holding stack");
            events.addAll(outcome.events());
        }
        Certificate cert = certificate(plan, trace);
        plan.setCertificate(cert);
        return events;
    }

    /** Earliest-free open stand that is free in time and not closed, else a new stand, else null. */
    private static Stand take(PlanState plan, Pool pool, Turnaround t) {
        List<Stand> skipped = new ArrayList<>();
        List<Integer> skippedFree = new ArrayList<>();
        Stand chosen = null;
        while (!pool.open.isEmpty() && pool.open.peekFreeAt() <= t.getStart()) {
            int freeAt = pool.open.peekFreeAt();
            Stand s = pool.open.poll();
            if (plan.openDuring(s.getId(), t.getStart(), t.getOccupiedEnd())) {
                chosen = s;
                break;
            }
            skipped.add(s);
            skippedFree.add(freeAt);
        }
        for (int i = 0; i < skipped.size(); i++) {
            pool.open.add(skipped.get(i), skippedFree.get(i));
        }
        if (chosen == null) {
            for (int i = 0; i < pool.unused.size(); i++) {
                Stand s = pool.unused.get(i);
                if (plan.openDuring(s.getId(), t.getStart(), t.getOccupiedEnd())) {
                    chosen = pool.unused.remove(i);
                    break;
                }
            }
        }
        if (chosen != null) {
            pool.open.add(chosen, t.getOccupiedEnd());
        }
        return chosen;
    }

    /**
     * Computes the optimality certificate. For each class, a segment tree over that class's
     * visits gives the busiest moment; the plan is tight for the class when the number of stands
     * hosting its visits equals that peak.
     */
    public static Certificate certificate(PlanState plan, TraceRecorder trace) {
        long t0 = System.nanoTime();
        Map<String, LazySegmentTree> trees = new LinkedHashMap<>();
        Map<String, StandClass> classes = new LinkedHashMap<>();
        Map<String, Integer> visitCount = new HashMap<>();
        Map<String, Integer> overflow = new HashMap<>();
        Map<String, Integer> unplaced = new HashMap<>();
        Map<String, Set<String>> used = new HashMap<>();
        Map<String, Integer> available = new HashMap<>();
        for (Stand s : plan.getStands()) {
            String k = StandClass.of(s).key();
            classes.putIfAbsent(k, StandClass.of(s));
            available.merge(k, 1, Integer::sum);
        }
        int ops = 0;
        for (Turnaround t : plan.getVisits()) {
            if (t.isCancelled()) {
                continue;
            }
            StandClass c = StandClass.of(t);
            String k = c.key();
            classes.putIfAbsent(k, c);
            LazySegmentTree tree = trees.computeIfAbsent(k, x -> new LazySegmentTree(PlanState.HORIZON));
            int s = PlanState.clamp(t.getStart());
            int e = PlanState.clamp(t.getOccupiedEnd());
            if (s < e) {
                tree.rangeAdd(s, e, 1);
                ops++;
            }
            visitCount.merge(k, 1, Integer::sum);
            String standId = plan.standOf(t.getId());
            if (standId == null) {
                unplaced.merge(k, 1, Integer::sum);
            } else if (!StandClass.of(plan.stand(standId)).key().equals(k)) {
                overflow.merge(k, 1, Integer::sum);
            } else {
                used.computeIfAbsent(k, x -> new HashSet<>()).add(standId);
            }
        }
        List<ClassCertificate> out = new ArrayList<>();
        int sumPeaks = 0;
        int usedTotal = 0;
        boolean allTight = true;
        for (Map.Entry<String, StandClass> e : classes.entrySet()) {
            String k = e.getKey();
            LazySegmentTree tree = trees.get(k);
            int peak = tree == null ? 0 : (int) tree.rangeMax(0, PlanState.HORIZON);
            int peakMinute = tree == null || peak == 0 ? 0 : tree.argMax(0, PlanState.HORIZON);
            int u = used.getOrDefault(k, Set.of()).size();
            int of = overflow.getOrDefault(k, 0);
            int un = unplaced.getOrDefault(k, 0);
            boolean tight = u == peak && of == 0 && un == 0;
            if (visitCount.getOrDefault(k, 0) > 0) {
                allTight &= tight;
            }
            sumPeaks += peak;
            usedTotal += u;
            out.add(new ClassCertificate(k, e.getValue().label(), visitCount.getOrDefault(k, 0), peak, peakMinute, u,
                    available.getOrDefault(k, 0), of, un, tight));
        }
        LazySegmentTree all = plan.getOccupancy();
        int busiest = (int) all.rangeMax(0, PlanState.HORIZON);
        int busiestMinute = busiest == 0 ? 0 : all.argMax(0, PlanState.HORIZON);
        String statement = allTight
                ? "In every stand class the stands used equal the busiest moment (" + sumPeaks + " = " + usedTotal
                    + "). Overlapping visits need different stands, so no plan can use fewer."
                : "Stands used equal the busiest moment in every class marked tight. Classes with overflow or "
                    + "unplaced visits are short of stands, so the lower bound is reached by all stands available.";
        trace.add("Segment tree (lazy range add, range max)", 3, "Busiest moment per stand class", ops,
                TraceRecorder.since(t0), "O(n log k) build, O(log k) per query",
                "Lower bound: at the peak minute every visit needs its own stand. Sum of class peaks = " + sumPeaks
                        + ", stands used = " + usedTotal);
        return new Certificate(out, usedTotal, plan.getStands().size(), sumPeaks, busiest, busiestMinute, allTight,
                statement);
    }
}
