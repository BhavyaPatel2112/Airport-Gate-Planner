package com.gateplanner.model;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.segtree.LazySegmentTree;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Everything one plan knows: its stand visits, which stand each visit uses, one red-black interval
 * tree per stand, the occupancy segment tree, active closures and notices, and the event log.
 * Every change to a visit's stand goes through {@link #place} and {@link #unplace} so the trees
 * and the segment tree can never disagree.
 */
public final class PlanState {

    /** Minutes covered: two full days, so delays past midnight still fit. */
    public static final int HORIZON = 2 * 24 * 60;

    private final String id;
    private final int day;
    private int bufferPercentile;
    private final List<Stand> stands;
    private final Map<String, Stand> standById = new LinkedHashMap<>();
    private final Map<String, Turnaround> visits = new LinkedHashMap<>();
    private final Map<String, String> standOf = new HashMap<>();
    private final Map<String, String> originalStand = new HashMap<>();
    private final Map<String, String> unplacedReason = new HashMap<>();
    private final Map<String, RedBlackIntervalTree<String>> trees = new HashMap<>();
    private final Map<String, RedBlackIntervalTree.Node<String>> nodeOf = new HashMap<>();
    private final LazySegmentTree occupancy = new LazySegmentTree(HORIZON);
    private final List<Closure> closures = new ArrayList<>();
    private final List<Notice> notices = new ArrayList<>();
    private final List<PlanEvent> eventLog = new ArrayList<>();
    private final Map<String, String> flightIndex;
    private final List<String> warnings = new ArrayList<>();
    private int version;
    private Object certificate;
    private boolean greedyRecovery;
    private final Map<String, Object> lastSnapshots = new HashMap<>();

    public PlanState(String id, int day, int bufferPercentile, List<Stand> stands, Collection<Turnaround> visits,
                     Map<String, String> flightIndex) {
        this.id = id;
        this.day = day;
        this.bufferPercentile = bufferPercentile;
        this.stands = new ArrayList<>(stands);
        for (Stand s : stands) {
            standById.put(s.getId(), s);
            trees.put(s.getId(), new RedBlackIntervalTree<>());
        }
        for (Turnaround t : visits) {
            this.visits.put(t.getId(), t);
        }
        this.flightIndex = flightIndex;
    }

    public String getId() { return id; }
    public int getDay() { return day; }
    public int getBufferPercentile() { return bufferPercentile; }
    public void setBufferPercentile(int p) { this.bufferPercentile = p; }
    public List<Stand> getStands() { return stands; }
    public Stand stand(String standId) { return standById.get(standId); }
    public Collection<Turnaround> getVisits() { return visits.values(); }
    public Turnaround visit(String visitId) { return visits.get(visitId); }
    public void addVisit(Turnaround t) { visits.put(t.getId(), t); }
    /** Replaces a visit that has no stand with a new version of it (same id). */
    public void replaceVisit(Turnaround t) {
        if (standOf.containsKey(t.getId())) {
            throw new IllegalStateException(t.getLabel() + " must leave its stand before it is replaced");
        }
        visits.put(t.getId(), t);
    }
    public String standOf(String visitId) { return standOf.get(visitId); }
    public String originalStandOf(String visitId) { return originalStand.get(visitId); }
    public String reasonOf(String visitId) { return unplacedReason.get(visitId); }
    public RedBlackIntervalTree<String> tree(String standId) { return trees.get(standId); }
    public LazySegmentTree getOccupancy() { return occupancy; }
    public List<Closure> getClosures() { return closures; }
    public List<Notice> getNotices() { return notices; }
    public List<PlanEvent> getEventLog() { return eventLog; }
    public List<String> getWarnings() { return warnings; }
    public int getVersion() { return version; }
    public void bumpVersion() { version++; }
    public Object getCertificate() { return certificate; }
    public void setCertificate(Object c) { this.certificate = c; }
    public Map<String, Object> getLastSnapshots() { return lastSnapshots; }
    /** True when disruptions on this plan are repaired with greedy first-fit instead of maximum matching. */
    public boolean isGreedyRecovery() { return greedyRecovery; }
    public void setGreedyRecovery(boolean greedy) { this.greedyRecovery = greedy; }

    /** Resolves a flight number (with or without the space) or a visit id to a visit. */
    public Turnaround findVisit(String flightOrVisit) {
        if (flightOrVisit == null) {
            return null;
        }
        String key = flightOrVisit.replace(" ", "").toUpperCase();
        Turnaround t = visits.get(key);
        if (t != null) {
            return t;
        }
        String vid = flightIndex.get(key);
        return vid == null ? null : visits.get(vid);
    }

    /** Puts a visit on a stand: interval tree insert plus segment tree +1 over its interval. */
    public void place(Turnaround t, String standId) {
        if (standOf.containsKey(t.getId())) {
            throw new IllegalStateException(t.getLabel() + " already has a stand");
        }
        Stand s = standById.get(standId);
        if (s == null || !s.canHost(t)) {
            throw new IllegalStateException("Stand " + standId + " cannot take " + t.getLabel());
        }
        nodeOf.put(t.getId(), trees.get(standId).insert(t.getStart(), t.getOccupiedEnd(), t.getId()));
        standOf.put(t.getId(), standId);
        originalStand.putIfAbsent(t.getId(), standId);
        unplacedReason.remove(t.getId());
        addOccupancy(t, 1);
    }

    /** Takes a visit off its stand (if it has one). Returns the old stand id or null. */
    public String unplace(Turnaround t) {
        String standId = standOf.remove(t.getId());
        if (standId != null) {
            trees.get(standId).delete(nodeOf.remove(t.getId()));
            addOccupancy(t, -1);
        }
        return standId;
    }

    private void addOccupancy(Turnaround t, int delta) {
        int s = clamp(t.getStart());
        int e = clamp(t.getOccupiedEnd());
        if (s < e) {
            occupancy.rangeAdd(s, e, delta);
        }
    }

    public void markUnplaced(Turnaround t, String reason) {
        unplacedReason.put(t.getId(), reason);
    }

    public void clearReason(Turnaround t) {
        unplacedReason.remove(t.getId());
    }

    /** True when no closure on this stand overlaps {@code [s, e)}. */
    public boolean openDuring(String standId, int s, int e) {
        for (Closure c : closures) {
            if (c.standId().equals(standId) && c.overlaps(s, e)) {
                return false;
            }
        }
        return true;
    }

    /** True when the stand can take the visit: compatible, open and empty during its interval. */
    public boolean isFreeFor(Stand s, Turnaround t) {
        return s.canHost(t) && openDuring(s.getId(), t.getStart(), t.getOccupiedEnd())
                && !trees.get(s.getId()).anyOverlap(t.getStart(), t.getOccupiedEnd());
    }

    public void log(PlanEvent e) {
        eventLog.add(e);
    }

    public static int clamp(int minute) {
        return Math.max(0, Math.min(HORIZON, minute));
    }

    /** Visits currently without a stand (not cancelled). */
    public List<Turnaround> unplacedVisits() {
        List<Turnaround> out = new ArrayList<>();
        for (Turnaround t : visits.values()) {
            if (!t.isCancelled() && !standOf.containsKey(t.getId())) {
                out.add(t);
            }
        }
        return out;
    }

    /** Number of distinct stands holding at least one visit. */
    public int standsInUse() {
        int c = 0;
        for (RedBlackIntervalTree<String> tree : trees.values()) {
            if (!tree.isEmpty()) {
                c++;
            }
        }
        return c;
    }
}
