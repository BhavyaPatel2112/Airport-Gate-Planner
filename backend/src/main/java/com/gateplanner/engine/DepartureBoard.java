package com.gateplanner.engine;

import com.gateplanner.algo.heap.FibonacciHeap;
import com.gateplanner.model.Flight;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rows for the split-flap board: the next departures (or arrivals) after a clock minute, found by
 * repeated extract-min on a Fibonacci heap keyed by the current planned time. Only the first
 * {@code count} rows are extracted, so the cost is O(n) inserts plus O(count log n).
 */
public final class DepartureBoard {

    private DepartureBoard() {
    }

    public static Map<String, Object> rows(PlanState plan, int minute, int count, boolean departures,
                                           TraceRecorder trace) {
        long t0 = System.nanoTime();
        FibonacciHeap<Turnaround> heap = new FibonacciHeap<>();
        for (Turnaround t : plan.getVisits()) {
            Flight f = departures ? t.getDeparture() : t.getArrival();
            if (f == null) {
                continue;
            }
            int time = departures ? t.getEnd() : t.getStart();
            if (time >= minute - 10) {
                heap.insert(time, t);
            }
        }
        int inserted = heap.size();
        List<Map<String, Object>> rows = new ArrayList<>();
        while (!heap.isEmpty() && rows.size() < count) {
            FibonacciHeap.Node<Turnaround> n = heap.extractMin();
            Turnaround t = n.value();
            Flight f = departures ? t.getDeparture() : t.getArrival();
            int time = (int) n.key();
            int sched = f.getScheduledMin();
            String stand = plan.standOf(t.getId());
            String original = plan.originalStandOf(t.getId());
            String status;
            if (t.isCancelled()) {
                status = "CANCELLED";
            } else if (stand == null) {
                status = departures ? "STAND TBA" : "HOLDING";
            } else if (original != null && !original.equals(stand)) {
                status = "GATE CHANGE";
            } else if (departures && minute >= time) {
                status = "DEPARTED";
            } else if (!departures && minute >= time) {
                status = "LANDED";
            } else if (departures && minute >= time - 30) {
                status = "BOARDING";
            } else if (time - sched > 10) {
                status = "DELAYED";
            } else {
                status = "ON TIME";
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("visit", t.getId());
            row.put("flight", f.getNumber());
            row.put("airline", f.getAirline());
            row.put("airlineCode", f.getAirlineCode());
            row.put("city", f.getCity().isBlank() ? f.getOtherAirport() : f.getCity());
            row.put("iata", f.getOtherAirport());
            row.put("scheduled", Clock.hhmm(Math.max(0, sched)));
            row.put("expected", Clock.hhmm(time));
            row.put("gate", stand == null ? "" : stand);
            row.put("previousGate", original != null && !original.equals(stand) ? original : null);
            row.put("status", status);
            row.put("terminal", t.getTerminal());
            rows.add(row);
        }
        trace.add("Fibonacci heap", 2, "Next " + rows.size() + (departures ? " departures" : " arrivals")
                        + " after " + Clock.hhmm(minute), inserted, TraceRecorder.since(t0),
                "O(1) insert, O(log n) amortised extract-min",
                "Only the first " + rows.size() + " are extracted; the rest are never sorted");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minute", minute);
        out.put("type", departures ? "DEP" : "ARR");
        out.put("rows", rows);
        return out;
    }
}
