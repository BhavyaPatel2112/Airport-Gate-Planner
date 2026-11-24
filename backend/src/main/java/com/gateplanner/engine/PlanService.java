package com.gateplanner.engine;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.matching.BipartiteMatcher;
import com.gateplanner.algo.matching.GreedyFirstFit;
import com.gateplanner.algo.matching.MinCutExplainer;
import com.gateplanner.algo.segtree.LazySegmentTree;
import com.gateplanner.algo.sort.CountingSort;
import com.gateplanner.data.AirportData;
import com.gateplanner.model.Closure;
import com.gateplanner.model.EventType;
import com.gateplanner.model.Notice;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Application service for plans: build, delay, cancel, replay real times, explain and race.
 * Each operation returns an {@link Operation} with the events to animate and the X-ray trace.
 */
@Service
public class PlanService {

    /** Narrow-body and wide-body minimum ground time when a late arrival squeezes a turnaround. */
    public static final int MIN_TURN_NARROW = 30;
    public static final int MIN_TURN_WIDE = 60;
    private static final int MAX_PLANS = 40;

    /** Result of one change to a plan. */
    public record Operation(PlanState plan, List<PlanEvent> events, TraceRecorder trace, String summary) {
    }

    /** Why a visit is on its stand, or why it has none. */
    public record Why(String visit, String label, String stand, String status, String standClass, String chosenBy,
                      String freeFrom, String freeUntil, String previousVisit, String nextVisit,
                      List<String> alternatives, String reason, List<String> lastEvents) {
    }

    /** Greedy against matching on the same disruption. */
    public record RaceSide(String method, int placed, int unplaced, double timeMs, List<String> unplacedFlights,
                           Map<String, Object> snapshot) {
    }

    public record RaceResult(String scenario, int affected, RaceSide greedy, RaceSide matching,
                             List<Map<String, Object>> differences, Map<String, Object> textbook) {
    }

    private final AirportData data;
    private final NoticeEngine notices;
    private final Map<String, PlanState> plans = new ConcurrentHashMap<>();
    private final List<String> order = new ArrayList<>();

    public PlanService(AirportData data) {
        this.data = data;
        this.notices = new NoticeEngine(data.stands());
    }

    public AirportData data() {
        return data;
    }

    public NoticeEngine noticeEngine() {
        return notices;
    }

    /** Builds a new plan for a day with buffers at the given delay percentile. */
    public Operation create(int day, int bufferPercentile) {
        if (bufferPercentile < 50 || bufferPercentile > 99) {
            throw new InvalidInputException("Buffer percentile must be between 50 and 99");
        }
        AirportData.Day d = data.day(day);
        TraceRecorder trace = new TraceRecorder();
        List<Turnaround> visits = new ArrayList<>();
        for (Turnaround t : d.visits()) {
            visits.add(t.copy());
        }
        long t0 = System.nanoTime();
        Map<String, Integer> buffers = data.delayStats().buffers(bufferPercentile);
        for (Turnaround t : visits) {
            t.setBuffer(buffers.getOrDefault(t.getAirlineCode(),
                    data.delayStats().bufferFor(t.getAirlineCode(), bufferPercentile)));
        }
        trace.add("Randomized Quickselect", 6, "Delay buffer per airline at the " + bufferPercentile + "th percentile",
                data.delayStats().allDepartureDelays().length, TraceRecorder.since(t0), "Expected O(n) per airline",
                buffers.size() + " airlines, seed " + DelayStats.DEFAULT_SEED + ": the same seed always gives the same buffers");
        String id = UUID.randomUUID().toString().substring(0, 8);
        PlanState plan = new PlanState(id, day, bufferPercentile, data.stands(), visits, d.flightIndex());
        plan.getWarnings().addAll(d.warnings());
        int n = 1;
        for (String raw : data.baseNotices()) {
            Notice notice = notices.parse(String.format("N%02d", n++), raw);
            plan.getNotices().add(notice);
            plan.getClosures().addAll(NoticeEngine.closuresOf(notice));
        }
        NoticeEngine.Index idx = notices.index(plan.getNotices());
        notices.mentions(idx, standIds(), trace);
        List<PlanEvent> events = GatePlanner.assign(plan, trace);
        events.forEach(plan::log);
        GatePlanner.Certificate cert = (GatePlanner.Certificate) plan.getCertificate();
        store(plan);
        snapshotTree(plan, busiestStand(plan), null);
        return new Operation(plan, events, trace, "Planned " + countActive(plan) + " stand visits on "
                + cert.standsUsed() + " of " + plan.getStands().size() + " stands");
    }

    public PlanState get(String id) {
        PlanState p = plans.get(id);
        if (p == null) {
            throw new NotFoundException("Plan " + id + " not found. Build a plan first with POST /api/plan");
        }
        return p;
    }

    private synchronized void store(PlanState plan) {
        plans.put(plan.getId(), plan);
        order.add(plan.getId());
        while (order.size() > MAX_PLANS) {
            plans.remove(order.remove(0));
        }
    }

    /** Resolves a flight number or visit id, or throws 404. */
    public Turnaround visit(PlanState plan, String flight) {
        Turnaround t = plan.findVisit(flight);
        if (t == null) {
            throw new NotFoundException("Flight " + flight + " not found on day " + plan.getDay());
        }
        return t;
    }

    /**
     * Moves a visit to new times while keeping it on its stand (overlaps are allowed in the tree
     * until recovery resolves them).
     */
    public static void retime(PlanState plan, Turnaround t, int start, int end) {
        String stand = plan.unplace(t);
        t.setTimes(Math.max(0, start), Math.max(Math.max(0, start) + 10, end));
        if (stand != null) {
            plan.place(t, stand);
        }
    }

    /** Delays one flight and recovers. */
    public synchronized Operation delay(String planId, String flight, int minutes, Integer atMinute) {
        PlanState plan = get(planId);
        if (minutes < 0) {
            throw new InvalidInputException("Delay must not be negative (use cancel for a cancelled flight)");
        }
        if (minutes > 24 * 60) {
            throw new InvalidInputException("Delay must be at most 1440 minutes");
        }
        Turnaround t = visit(plan, flight);
        if (t.isCancelled()) {
            throw new InvalidInputException("Flight " + flight + " is cancelled");
        }
        TraceRecorder trace = new TraceRecorder();
        List<PlanEvent> events = new ArrayList<>();
        if (minutes == 0) {
            return new Operation(plan, events, trace, "Delay of 0 minutes: nothing changes");
        }
        String key = flight.replace(" ", "").toUpperCase();
        boolean isDeparture = t.getDeparture() != null && t.getDeparture().getKey().equals(key)
                && (t.getArrival() == null || !t.getArrival().getKey().equals(key));
        int newStart = t.getStart();
        int newEnd = t.getEnd();
        if (isDeparture) {
            newEnd += minutes;
        } else {
            newStart += minutes;
            int minTurn = t.getSize() == SizeClass.WIDE ? MIN_TURN_WIDE : MIN_TURN_NARROW;
            newEnd = t.getDeparture() == null ? t.getEnd() + minutes : Math.max(t.getEnd(), newStart + minTurn);
        }
        String before = plan.standOf(t.getId());
        retime(plan, t, newStart, newEnd);
        events.add(new PlanEvent(t.getId(), EventType.DELAY, before, before, newStart,
                (isDeparture ? "Departure" : "Arrival") + " delayed by " + minutes + " min"));
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(t), List.of(), List.of(), true, trace,
                "delay " + flight);
        events.addAll(o.events());
        String summary;
        if (o.affected() == 0) {
            summary = flight + " delayed " + minutes + " min: absorbed by the buffer, stand " + before + " kept";
            events.add(new PlanEvent(t.getId(), EventType.STAY, before, before, newStart, "Absorbed by the buffer"));
        } else {
            summary = flight + " delayed " + minutes + " min: " + plural(o.affected(), "visit") + " had to move, "
                    + o.placed() + " placed, " + o.unplaced() + " without a stand";
        }
        finish(plan, events, trace, o, before);
        return new Operation(plan, events, trace, summary);
    }

    /** Cancels a flight; its stand frees up (decrease-key on the radar heap) and waiting visits retry. */
    public synchronized Operation cancel(String planId, String flight, Integer atMinute) {
        PlanState plan = get(planId);
        Turnaround t = visit(plan, flight);
        if (t.isCancelled()) {
            throw new InvalidInputException("Flight " + flight + " is already cancelled");
        }
        TraceRecorder trace = new TraceRecorder();
        List<PlanEvent> events = new ArrayList<>();
        String stand = plan.unplace(t);
        t.setCancelled(true);
        plan.clearReason(t);
        events.add(new PlanEvent(t.getId(), EventType.CANCEL, stand, null, t.getStart(),
                "Cancelled; the stand is released"));
        if (stand != null) {
            AvailabilityRadar.onStandFreed(plan, plan.stand(stand), atMinute == null ? t.getStart() : atMinute, trace);
        }
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(), List.of(), List.of(), true, trace,
                "cancel " + flight);
        events.addAll(o.events());
        finish(plan, events, trace, o, stand);
        return new Operation(plan, events, trace, flight + " cancelled" + (stand == null ? "" : ", stand " + stand
                + " released") + (o.placed() > 0 ? "; " + plural(o.placed(), "waiting visit") + " placed" : ""));
    }

    /** Replays the real actual times from the data: every visit moves to its real on and off block times. */
    public synchronized Operation applyRealTimes(String planId) {
        PlanState plan = get(planId);
        TraceRecorder trace = new TraceRecorder();
        List<PlanEvent> events = new ArrayList<>();
        List<Turnaround> changed = new ArrayList<>();
        int early = 0;
        long t0 = System.nanoTime();
        for (Turnaround t : plan.getVisits()) {
            if (t.isCancelled() || t.isSynthetic()) {
                continue;
            }
            if (t.getActualStart() != t.getStart() || t.getActualEnd() != t.getEnd()) {
                if (t.getActualEnd() < t.getEnd()) {
                    early++;
                }
                retime(plan, t, t.getActualStart(), t.getActualEnd());
                changed.add(t);
            }
        }
        trace.add("Red-black interval tree", 3, "Move " + changed.size() + " visits to their real times",
                changed.size() * 2, TraceRecorder.since(t0), "O(log n) per delete and insert",
                "Each visit is deleted and re-inserted on its stand's tree; " + early + " left their stand early");
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, changed, List.of(), List.of(), true, trace,
                "real times");
        events.addAll(o.events());
        int absorbed = changed.size() - o.affected();
        finish(plan, events, trace, o, null);
        return new Operation(plan, events, trace, "Real times applied to " + changed.size() + " visits: "
                + absorbed + " absorbed by buffers, " + o.affected() + " had to move, " + o.unplaced()
                + " without a stand");
    }

    /** Applies closures (from a notice or a storm) and recovers. */
    public Operation applyClosures(PlanState plan, List<Closure> closures, TraceRecorder trace, String cause) {
        List<PlanEvent> events = new ArrayList<>();
        plan.getClosures().addAll(closures);
        for (Closure c : closures) {
            events.add(new PlanEvent(null, EventType.CLOSE_STAND, c.standId(), null, c.from(), c.reason()));
        }
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(), closures, List.of(), true, trace, cause);
        events.addAll(o.events());
        finish(plan, events, trace, o, closures.isEmpty() ? null : closures.get(0).standId());
        return new Operation(plan, events, trace, cause + ": " + plural(o.affected(), "visit") + " had to move, "
                + o.placed() + " placed, " + o.unplaced() + " without a stand");
    }

    /** Common bookkeeping after an operation: log, certificate, snapshots, version. */
    public void finish(PlanState plan, List<PlanEvent> events, TraceRecorder trace, RecoveryEngine.Outcome o,
                       String focusStand) {
        events.forEach(plan::log);
        plan.setCertificate(GatePlanner.certificate(plan, trace));
        if (o != null && o.matchingSnapshot() != null) {
            plan.getLastSnapshots().put("matching", o.matchingSnapshot());
        }
        String stand = focusStand;
        if (stand == null) {
            for (PlanEvent e : events) {
                if (e.toStand() != null) {
                    stand = e.toStand();
                    break;
                }
            }
        }
        if (stand != null) {
            snapshotTree(plan, stand, null);
        }
        plan.bumpVersion();
    }

    /** Stores a red-black tree snapshot of one stand for the machine view. */
    public void snapshotTree(PlanState plan, String standId, int[] query) {
        if (standId == null || plan.tree(standId) == null) {
            return;
        }
        RedBlackIntervalTree<String> tree = plan.tree(standId);
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("stand", standId);
        snap.put("rootId", tree.rootId());
        snap.put("size", tree.size());
        snap.put("height", tree.height());
        snap.put("blackHeight", tree.isEmpty() ? 0 : tree.validate());
        snap.put("nodes", tree.snapshot(v -> plan.visit(v) == null ? v : plan.visit(v).getLabel()));
        snap.put("ops", tree.lastOperations());
        if (query != null) {
            List<Integer> hits = new ArrayList<>();
            for (RedBlackIntervalTree.Node<String> n : tree.overlaps(query[0], query[1])) {
                hits.add(n.id());
            }
            snap.put("query", query);
            snap.put("highlight", hits);
        }
        plan.getLastSnapshots().put("rbtree", snap);
    }

    /** Explains a visit's stand. */
    public Why why(String planId, String flight) {
        PlanState plan = get(planId);
        Turnaround t = visit(plan, flight);
        List<String> last = new ArrayList<>();
        for (PlanEvent e : plan.getEventLog()) {
            if (t.getId().equals(e.flight())) {
                last.add(e.type() + (e.toStand() != null ? " to " + e.toStand() : "") + ": " + e.reason());
            }
        }
        while (last.size() > 5) {
            last.remove(0);
        }
        String cls = com.gateplanner.model.StandClass.of(t).label();
        if (t.isCancelled()) {
            return new Why(t.getId(), t.getLabel(), null, "CANCELLED", cls, null, null, null, null, null, List.of(),
                    "This flight is cancelled, so it needs no stand.", last);
        }
        String standId = plan.standOf(t.getId());
        List<String> alternatives = new ArrayList<>();
        for (Stand s : plan.getStands()) {
            if (!s.getId().equals(standId) && plan.isFreeFor(s, t)) {
                alternatives.add(s.getId());
            }
        }
        if (standId == null) {
            return new Why(t.getId(), t.getLabel(), null, "UNPLACED", cls, null, null, null, null, null, alternatives,
                    plan.reasonOf(t.getId()), last);
        }
        RedBlackIntervalTree<String> tree = plan.tree(standId);
        String prev = null;
        String next = null;
        int freeFrom = 0;
        int freeUntil = PlanState.HORIZON;
        for (RedBlackIntervalTree.Node<String> n : tree.inOrder()) {
            if (n.value().equals(t.getId())) {
                continue;
            }
            if (n.end() <= t.getStart() && n.end() >= freeFrom) {
                freeFrom = n.end();
                prev = plan.visit(n.value()).getLabel() + " leaves " + Clock.hhmm(n.end());
            }
            if (n.start() >= t.getOccupiedEnd() && n.start() < freeUntil) {
                freeUntil = n.start();
                next = plan.visit(n.value()).getLabel() + " arrives " + Clock.hhmm(n.start());
            }
        }
        String chosenBy = "Interval partitioning: the compatible stand that became free earliest";
        for (int i = plan.getEventLog().size() - 1; i >= 0; i--) {
            PlanEvent e = plan.getEventLog().get(i);
            if (t.getId().equals(e.flight()) && (e.type() == EventType.MOVE || e.type() == EventType.ASSIGN
                    || e.type() == EventType.STAY)) {
                if (e.reason() != null && e.reason().contains("matching")) {
                    chosenBy = "Maximum matching during recovery (Edmonds-Karp)";
                }
                break;
            }
        }
        snapshotTree(plan, standId, new int[] {t.getStart(), t.getOccupiedEnd()});
        Stand s = plan.stand(standId);
        String reason = "Stand " + standId + " is a " + (s.isContact() ? "contact (jet bridge)" : "remote (bus)") + " "
                + com.gateplanner.model.StandClass.of(s).label() + " stand, open and empty from "
                + Clock.hhmm(freeFrom) + " to " + (freeUntil >= PlanState.HORIZON ? "end of day" : Clock.hhmm(freeUntil))
                + ". This visit needs it " + Clock.hhmm(t.getStart()) + " to " + Clock.hhmm(t.getEnd()) + " plus a "
                + t.getBuffer() + " min buffer (" + t.getAirline() + " delay at the " + plan.getBufferPercentile()
                + "th percentile).";
        return new Why(t.getId(), t.getLabel(), standId, "PLACED", cls, chosenBy, Clock.hhmm(freeFrom),
                freeUntil >= PlanState.HORIZON ? "end of day" : Clock.hhmm(freeUntil), prev, next,
                alternatives.size() > 8 ? alternatives.subList(0, 8) : alternatives, reason, last);
    }

    /** Busy stands per minute for the day (segment tree point values). */
    public long[] occupancy(String planId) {
        PlanState plan = get(planId);
        long[] all = plan.getOccupancy().values();
        long[] day = new long[24 * 60];
        System.arraycopy(all, 0, day, 0, day.length);
        return day;
    }

    /** The busiest window of {@code window} minutes, by total stand-minutes (segment tree range sums). */
    public Map<String, Object> busiest(String planId, int window) {
        if (window < 5 || window > 360) {
            throw new InvalidInputException("Window must be between 5 and 360 minutes");
        }
        PlanState plan = get(planId);
        LazySegmentTree seg = plan.getOccupancy();
        long t0 = System.nanoTime();
        long best = -1;
        int bestStart = 0;
        for (int s = 0; s + window <= 24 * 60; s++) {
            long sum = seg.rangeSum(s, s + window);
            if (sum > best) {
                best = sum;
                bestStart = s;
            }
        }
        long peak = seg.rangeMax(bestStart, bestStart + window);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("window", window);
        out.put("start", bestStart);
        out.put("end", bestStart + window);
        out.put("from", Clock.hhmm(bestStart));
        out.put("to", Clock.hhmm(bestStart + window));
        out.put("averageBusy", Math.round(10.0 * best / window) / 10.0);
        out.put("peakBusy", peak);
        out.put("timeMs", TraceRecorder.since(t0));
        out.put("method", "Segment tree range sum for every window start: O(L log L)");
        return out;
    }

    /** Copies a plan so the race can run two methods on the same disruption. */
    public PlanState copy(PlanState src) {
        List<Turnaround> visits = new ArrayList<>();
        for (Turnaround t : src.getVisits()) {
            visits.add(t.copy());
        }
        AirportData.Day d = data.day(src.getDay());
        PlanState p = new PlanState(src.getId() + "-copy", src.getDay(), src.getBufferPercentile(), src.getStands(),
                visits, d.flightIndex());
        p.getClosures().addAll(src.getClosures());
        p.getNotices().addAll(src.getNotices());
        for (Turnaround t : p.getVisits()) {
            String s = src.standOf(t.getId());
            if (s != null) {
                p.place(t, s);
            } else if (src.reasonOf(t.getId()) != null) {
                p.markUnplaced(t, src.reasonOf(t.getId()));
            }
        }
        return p;
    }

    /**
     * The race: closes the two international south-east pier arms (mixed wide and narrow stands)
     * for two hours and recovers twice on copies of the plan, once with greedy first-fit and once
     * with maximum matching. Every hourly window of the day is tried and the window where the two
     * methods differ most is shown (the scenario text says so); the textbook case explains why.
     */
    public RaceResult race(String planId) {
        PlanState plan = get(planId);
        List<Stand> pier = new ArrayList<>();
        for (Stand s : plan.getStands()) {
            if (s.getGroup().equals("SE-S") || s.getGroup().equals("SE-N")) {
                pier.add(s);
            }
        }
        int bestFrom = 0;
        int bestGap = Integer.MIN_VALUE;
        int bestAffected = -1;
        int tried = 0;
        for (int from = 0; from + 120 <= 24 * 60; from += 60) {
            List<Closure> closures = closuresFor(pier, from);
            PlanState g = copy(plan);
            PlanState m = copy(plan);
            g.getClosures().addAll(closures);
            m.getClosures().addAll(closures);
            RecoveryEngine.Outcome go = RecoveryEngine.recover(g, List.of(), closures, List.of(), false,
                    new TraceRecorder(), "race greedy");
            RecoveryEngine.Outcome mo = RecoveryEngine.recover(m, List.of(), closures, List.of(), true,
                    new TraceRecorder(), "race matching");
            tried++;
            int gap = mo.placed() - go.placed();
            if (gap > bestGap || (gap == bestGap && mo.affected() > bestAffected)) {
                bestGap = gap;
                bestFrom = from;
                bestAffected = mo.affected();
            }
        }
        List<Closure> closures = closuresFor(pier, bestFrom);
        String scenario = pier.size() + " stands on the south-east international pier (wide and narrow) closed "
                + Clock.hhmm(bestFrom) + " to " + Clock.hhmm(bestFrom + 120) + ". Of " + tried
                + " two-hour windows tried, this one shows the largest difference between the two methods.";
        PlanState g = copy(plan);
        PlanState m = copy(plan);
        RaceSide greedy = raceSide(g, closures, false);
        RaceSide matching = raceSide(m, closures, true);
        List<Map<String, Object>> diffs = new ArrayList<>();
        int affected = 0;
        for (Turnaround t : plan.getVisits()) {
            String before = plan.standOf(t.getId());
            String gs = g.standOf(t.getId());
            String ms = m.standOf(t.getId());
            boolean moved = before != null && (!before.equals(gs) || !before.equals(ms));
            if (moved || (gs == null) != (ms == null)) {
                affected++;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("visit", t.getId());
                row.put("label", t.getLabel());
                row.put("size", t.getSize());
                row.put("start", t.getStart());
                row.put("before", before);
                row.put("greedy", gs);
                row.put("matching", ms);
                diffs.add(row);
            }
        }
        return new RaceResult(scenario, affected, greedy, matching, diffs, textbook());
    }

    private static List<Closure> closuresFor(List<Stand> stands, int from) {
        List<Closure> out = new ArrayList<>();
        for (Stand s : stands) {
            out.add(new Closure(s.getId(), from, from + 120, "RACE", "Race scenario"));
        }
        return out;
    }

    private RaceSide raceSide(PlanState c, List<Closure> closures, boolean matching) {
        c.getClosures().addAll(closures);
        TraceRecorder tr = new TraceRecorder();
        long t0 = System.nanoTime();
        RecoveryEngine.Outcome o = RecoveryEngine.recover(c, List.of(), closures, List.of(), matching, tr,
                matching ? "race matching" : "race greedy");
        double ms = TraceRecorder.since(t0);
        List<String> un = new ArrayList<>();
        for (PlanEvent e : o.events()) {
            if (e.type() == EventType.UNPLACED) {
                un.add(c.visit(e.flight()).getLabel());
            }
        }
        return new RaceSide(matching ? "Maximum matching" : "Greedy first-fit", o.placed(), o.unplaced(), ms, un,
                o.matchingSnapshot());
    }

    /** Section 3.2 example: A fits stands 1 and 2, B only fits stand 1. */
    private Map<String, Object> textbook() {
        List<List<Integer>> adj = List.of(List.of(0, 1), List.of(0));
        int[] g = GreedyFirstFit.match(2, 2, adj);
        BipartiteMatcher m = new BipartiteMatcher(2, 2, adj);
        m.solve();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("flights", List.of("A (fits stands 1 and 2)", "B (fits stand 1 only)"));
        out.put("greedy", List.of(label(g[0]), label(g[1])));
        int[] mm = m.matchLeft();
        out.put("matching", List.of(label(mm[0]), label(mm[1])));
        out.put("greedyPlaced", GreedyFirstFit.size(g));
        out.put("matchingPlaced", m.size());
        out.put("violator", MinCutExplainer.explain(m).flights().size());
        return out;
    }

    private static String label(int stand) {
        return stand < 0 ? "no stand" : "stand " + (stand + 1);
    }

    /** Trie autocomplete over flight numbers, airlines, cities and registrations. */
    public List<Turnaround> search(int day, String q, int limit) {
        AirportData.Day d = data.day(day);
        List<String> ids = d.search().startsWith(q, limit);
        Map<String, Turnaround> byId = new HashMap<>();
        for (Turnaround t : d.visits()) {
            byId.put(t.getId(), t);
        }
        List<Turnaround> out = new ArrayList<>();
        for (String id : ids) {
            out.add(byId.get(id));
        }
        return out;
    }

    public List<String> standIds() {
        List<String> ids = new ArrayList<>();
        for (Stand s : data.stands()) {
            ids.add(s.getId());
        }
        return ids;
    }

    private static int countActive(PlanState plan) {
        int c = 0;
        for (Turnaround t : plan.getVisits()) {
            if (!t.isCancelled()) {
                c++;
            }
        }
        return c;
    }

    private static String busiestStand(PlanState plan) {
        String best = null;
        int size = -1;
        for (Stand s : plan.getStands()) {
            int n = plan.tree(s.getId()).size();
            if (n > size) {
                size = n;
                best = s.getId();
            }
        }
        return best;
    }

    /** "1 visit", "3 visits". */
    public static String plural(int n, String word) {
        return n + " " + word + (n == 1 ? "" : "s");
    }

    /** Visits sorted by start with counting sort (used by views that list visits in time order). */
    public static List<Turnaround> inStartOrder(Collection<Turnaround> visits) {
        int max = PlanState.HORIZON - 1;
        return CountingSort.sort(new ArrayList<>(visits), t -> Math.min(max, Math.max(0, t.getStart())), max);
    }
}
