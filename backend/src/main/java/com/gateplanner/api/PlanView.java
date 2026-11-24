package com.gateplanner.api;

import com.gateplanner.engine.GatePlanner;
import com.gateplanner.engine.PlanService;
import com.gateplanner.model.Closure;
import com.gateplanner.model.Flight;
import com.gateplanner.model.Notice;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;
import com.gateplanner.model.TraceEntry;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Full plan as JSON: everything the frontend needs to draw and animate the airport. */
public record PlanView(String planId, int day, int version, int bufferPercentile, String recovery, String summary,
                       Stats stats,
                       Object certificate, List<StandView> stands, List<VisitView> visits, List<Closure> closures,
                       List<Notice> notices, List<PlanEvent> events, List<TraceEntry> trace,
                       Map<String, Object> snapshots, List<String> warnings) {

    public record Stats(int visits, int placed, int unplaced, int cancelled, int standsUsed, int standsAvailable,
                        int busiest, int busiestMinute, int contactPlaced) {
    }

    public record StandView(String id, String terminal, String size, boolean contact, boolean international, double x,
                            double y, String taxiway, String group, String source) {
    }

    public record FlightView(String number, String airline, String airlineCode, String aircraft, String iata,
                             String city, int scheduled, int actual, int delay, String realGate, boolean cancelled) {
    }

    public record VisitView(String id, String label, String airline, String airlineCode, String size, boolean intl,
                            String terminal, String registration, boolean paired, boolean synthetic,
                            boolean cancelled, int start, int end, int buffer, int schedStart, int schedEnd,
                            int actualStart, int actualEnd, String stand, String originalStand, String status,
                            String reason, FlightView arrival, FlightView departure) {
    }

    private static final List<String> SNAPSHOT_KEYS = List.of("rbtree", "matching", "fibheap", "suffix", "replan");

    public static PlanView of(PlanService.Operation op) {
        return of(op.plan(), op.summary(), op.events(), op.trace().entries());
    }

    public static PlanView of(PlanState plan, String summary, List<PlanEvent> events, List<TraceEntry> trace) {
        List<StandView> stands = new ArrayList<>();
        for (Stand s : plan.getStands()) {
            stands.add(new StandView(s.getId(), s.getTerminal(), s.getSize().name(), s.isContact(), s.isInternational(),
                    s.getX(), s.getY(), s.getTaxiway(), s.getGroup(), s.getSource()));
        }
        List<VisitView> visits = new ArrayList<>();
        int placed = 0;
        int unplaced = 0;
        int cancelled = 0;
        int contact = 0;
        for (Turnaround t : plan.getVisits()) {
            String stand = plan.standOf(t.getId());
            String status;
            if (t.isCancelled()) {
                status = "CANCELLED";
                cancelled++;
            } else if (stand == null) {
                status = "UNPLACED";
                unplaced++;
            } else {
                status = "PLACED";
                placed++;
                if (plan.stand(stand).isContact()) {
                    contact++;
                }
            }
            visits.add(new VisitView(t.getId(), t.getLabel(), t.getAirline(), t.getAirlineCode(), t.getSize().name(),
                    t.isInternational(), t.getTerminal(), t.getRegistration(), t.isPaired(), t.isSynthetic(),
                    t.isCancelled(), t.getStart(), t.getEnd(), t.getBuffer(), t.getSchedStart(), t.getSchedEnd(),
                    t.getActualStart(), t.getActualEnd(), stand, plan.originalStandOf(t.getId()), status,
                    plan.reasonOf(t.getId()), flight(t.getArrival(), t.isCancelled()),
                    flight(t.getDeparture(), t.isCancelled())));
        }
        GatePlanner.Certificate cert = (GatePlanner.Certificate) plan.getCertificate();
        Stats stats = new Stats(visits.size(), placed, unplaced, cancelled, plan.standsInUse(), plan.getStands().size(),
                cert == null ? 0 : cert.busiestMoment(), cert == null ? 0 : cert.busiestMinute(), contact);
        Map<String, Object> snaps = new LinkedHashMap<>();
        for (String k : SNAPSHOT_KEYS) {
            if (plan.getLastSnapshots().containsKey(k)) {
                snaps.put(k, plan.getLastSnapshots().get(k));
            }
        }
        return new PlanView(plan.getId(), plan.getDay(), plan.getVersion(), plan.getBufferPercentile(),
                plan.isGreedyRecovery() ? "GREEDY" : "MATCHING", summary, stats,
                cert, stands, visits, plan.getClosures(), plan.getNotices(), events, trace, snaps, plan.getWarnings());
    }

    private static FlightView flight(Flight f, boolean cancelled) {
        if (f == null) {
            return null;
        }
        return new FlightView(f.getNumber(), f.getAirline(), f.getAirlineCode(), f.getAircraft(), f.getOtherAirport(),
                f.getCity(), f.getScheduledMin(), f.getActualMin(), f.getDelayMin(), f.getRealGate(),
                cancelled || f.isCancelled());
    }
}
