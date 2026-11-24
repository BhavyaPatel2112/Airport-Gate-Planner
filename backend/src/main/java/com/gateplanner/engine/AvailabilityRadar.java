package com.gateplanner.engine;

import com.gateplanner.algo.heap.FibonacciHeap;
import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;
import com.gateplanner.model.StandClass;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Stand availability radar. For a clock minute it builds a Fibonacci heap of all stands keyed by
 * the minute each one becomes free, keeps it on the plan, and lowers keys (decrease-key) when a
 * cancellation frees a stand sooner. It also lists the holding stack (visits without a stand) in
 * arrival order and the arrivals of the next hour as radar blips.
 *
 * <p><b>Time:</b> build O(s) inserts plus one O(log s) extract-min; each decrease-key O(1)
 * amortised; next free stand per class by extract-min on a fresh heap, O(log s) each.</p>
 */
public final class AvailabilityRadar {

    private static final String KEY_QUEUE = "radarQueue";
    private static final String KEY_MINUTE = "radarMinute";
    private static final String KEY_PULSES = "radarPulses";

    private AvailabilityRadar() {
    }

    /** Minute stand {@code s} becomes free when looking at {@code minute}. */
    static int freeAt(PlanState plan, Stand s, int minute) {
        int free = minute;
        boolean moved = true;
        // follow back-to-back visits: the stand is free once no visit covers the current point
        while (moved) {
            moved = false;
            List<RedBlackIntervalTree.Node<String>> hits = plan.tree(s.getId()).overlaps(free, free + 1);
            for (RedBlackIntervalTree.Node<String> h : hits) {
                if (h.end() > free) {
                    free = h.end();
                    moved = true;
                }
            }
            if (!plan.openDuring(s.getId(), free, free + 1)) {
                for (com.gateplanner.model.Closure c : plan.getClosures()) {
                    if (c.standId().equals(s.getId()) && c.overlaps(free, free + 1)) {
                        free = c.to();
                        moved = true;
                    }
                }
            }
        }
        return free;
    }

    @SuppressWarnings("unchecked")
    private static FibStandAvailabilityQueue queue(PlanState plan, int minute, TraceRecorder trace) {
        Object q = plan.getLastSnapshots().get(KEY_QUEUE);
        Object m = plan.getLastSnapshots().get(KEY_MINUTE);
        if (q instanceof FibStandAvailabilityQueue fq && m instanceof Integer mm && mm == minute) {
            return fq;
        }
        long t0 = System.nanoTime();
        FibStandAvailabilityQueue fq = new FibStandAvailabilityQueue();
        for (Stand s : plan.getStands()) {
            fq.add(s, freeAt(plan, s, minute));
        }
        // one extract-min (and re-insert) consolidates the root list into trees
        int key = fq.peekFreeAt();
        Stand first = fq.poll();
        fq.add(first, key);
        fq.drainEvents();
        if (trace != null) {
            trace.add("Fibonacci heap", 2, "Build stand availability heap at " + Clock.hhmm(minute),
                    plan.getStands().size(), TraceRecorder.since(t0), "O(1) insert, O(log n) extract-min",
                    "Next free stand: " + first.getId() + " at " + Clock.hhmm(key));
        }
        plan.getLastSnapshots().put(KEY_QUEUE, fq);
        plan.getLastSnapshots().put(KEY_MINUTE, minute);
        plan.getLastSnapshots().put(KEY_PULSES, new ArrayList<Map<String, Object>>());
        return fq;
    }

    /** Called when a stand is released early: decrease-key on the radar heap. */
    @SuppressWarnings("unchecked")
    public static void onStandFreed(PlanState plan, Stand s, int minute, TraceRecorder trace) {
        FibStandAvailabilityQueue q = queue(plan, minute, trace);
        int old = q.freeAt(s.getId());
        int now = freeAt(plan, s, minute);
        if (now < old) {
            long t0 = System.nanoTime();
            q.update(s, now);
            List<String> ev = q.drainEvents();
            trace.add("Fibonacci heap", 2, "Decrease-key: stand " + s.getId() + " free at " + Clock.hhmm(now)
                    + " instead of " + Clock.hhmm(old), q.size(), TraceRecorder.since(t0), "O(1) amortised",
                    ev.isEmpty() ? "Key lowered in place, heap order still holds" : String.join("; ", ev));
            List<Map<String, Object>> pulses = (List<Map<String, Object>>) plan.getLastSnapshots().get(KEY_PULSES);
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("stand", s.getId());
            p.put("from", old);
            p.put("to", now);
            p.put("events", ev);
            pulses.add(p);
            snapshot(plan, q, ev);
        }
    }

    private static void snapshot(PlanState plan, FibStandAvailabilityQueue q, List<String> events) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("structure", "Stand availability (Fibonacci heap)");
        snap.put("size", q.size());
        snap.put("roots", q.snapshot());
        snap.put("min", q.peek() == null ? null : q.peek().getId());
        snap.put("events", events);
        snap.put("decreaseKeys", q.decreaseKeys());
        plan.getLastSnapshots().put("fibheap", snap);
    }

    /** Radar view at a minute. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> view(PlanState plan, int minute, TraceRecorder trace) {
        FibStandAvailabilityQueue q = queue(plan, minute, trace);
        snapshot(plan, q, List.of());
        // next free stand per class: copy keys into a fresh heap and extract in order
        long t0 = System.nanoTime();
        FibonacciHeap<Stand> copy = new FibonacciHeap<>();
        for (Stand s : plan.getStands()) {
            copy.insert(q.freeAt(s.getId()), s);
        }
        Map<String, List<Map<String, Object>>> nextByClass = new LinkedHashMap<>();
        List<Map<String, Object>> next = new ArrayList<>();
        while (!copy.isEmpty()) {
            FibonacciHeap.Node<Stand> n = copy.extractMin();
            Stand s = n.value();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("stand", s.getId());
            row.put("freeAt", n.key());
            row.put("class", StandClass.of(s).label());
            row.put("contact", s.isContact());
            if (next.size() < 12) {
                next.add(row);
            }
            List<Map<String, Object>> list = nextByClass.computeIfAbsent(StandClass.of(s).label(), k -> new ArrayList<>());
            if (list.size() < 3) {
                list.add(row);
            }
        }
        double nextMs = TraceRecorder.since(t0);
        HoldingStack holding = new HoldingStack();
        for (Turnaround t : plan.unplacedVisits()) {
            if (t.getOccupiedEnd() >= minute) {
                holding.push(t);
            }
        }
        List<FibonacciHeap.TreeView> holdingSnap = holding.snapshot();
        List<Map<String, Object>> stack = new ArrayList<>();
        for (Turnaround t : holding.drainInOrder()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("visit", t.getId());
            row.put("label", t.getLabel());
            row.put("start", t.getStart());
            row.put("size", t.getSize());
            row.put("intl", t.isInternational());
            row.put("reason", plan.reasonOf(t.getId()));
            stack.add(row);
        }
        List<Map<String, Object>> blips = new ArrayList<>();
        for (Turnaround t : plan.getVisits()) {
            if (t.isCancelled() || t.getArrival() == null) {
                continue;
            }
            int eta = t.getStart() - minute;
            if (eta >= 0 && eta <= 60) {
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("visit", t.getId());
                b.put("label", t.getArrival().getNumber());
                b.put("from", t.getArrival().getOtherAirport());
                b.put("eta", eta);
                b.put("bearing", bearing(t.getArrival().getOtherAirport()));
                b.put("stand", plan.standOf(t.getId()));
                b.put("size", t.getSize());
                blips.add(b);
            }
        }
        if (trace != null) {
            trace.add("Fibonacci heap", 2, "Next free stand per class and holding stack order", plan.getStands().size()
                    + stack.size(), nextMs, "O(log n) amortised per extract-min",
                    stack.size() + " visits in the holding stack, served earliest arrival first");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minute", minute);
        out.put("nextFree", next);
        out.put("nextByClass", nextByClass);
        out.put("holding", stack);
        out.put("holdingHeap", holdingSnap);
        out.put("blips", blips);
        out.put("pulses", plan.getLastSnapshots().getOrDefault(KEY_PULSES, List.of()));
        out.put("heap", plan.getLastSnapshots().get("fibheap"));
        return out;
    }

    /** A stable pseudo bearing per origin airport so a flight always appears from the same side. */
    static int bearing(String iata) {
        Map<String, Integer> known = new HashMap<>();
        known.put("DEL", 10);
        known.put("BLR", 150);
        known.put("MAA", 130);
        known.put("HYD", 115);
        known.put("CCU", 70);
        known.put("DXB", 290);
        known.put("AUH", 285);
        known.put("DOH", 285);
        known.put("LHR", 320);
        known.put("SIN", 115);
        known.put("BKK", 95);
        known.put("GOI", 165);
        known.put("AMD", 350);
        known.put("JAI", 5);
        known.put("LKO", 25);
        known.put("PNQ", 140);
        if (known.containsKey(iata)) {
            return known.get(iata);
        }
        int h = 0;
        for (char c : iata.toCharArray()) {
            h = h * 31 + c;
        }
        return Math.floorMod(h, 360);
    }
}
