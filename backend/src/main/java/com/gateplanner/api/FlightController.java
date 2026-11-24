package com.gateplanner.api;

import com.gateplanner.data.AirportData;
import com.gateplanner.engine.InvalidInputException;
import com.gateplanner.engine.PlanService;
import com.gateplanner.model.Flight;
import com.gateplanner.model.Turnaround;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Flights, stands and trie search. */
@RestController
@RequestMapping("/api")
public class FlightController {

    private final PlanService plans;

    public FlightController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping("/flights")
    public Map<String, Object> flights(@RequestParam(defaultValue = "1") int day) {
        AirportData.Day d = plans.data().day(day);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("day", day);
        out.put("date", d.date().toString());
        out.put("count", d.flights().size());
        out.put("visits", d.visits().size());
        out.put("warnings", d.warnings());
        out.put("flights", d.flights());
        return out;
    }

    @GetMapping("/flights/search")
    public Map<String, Object> search(@RequestParam String q, @RequestParam(defaultValue = "1") int day,
                                      @RequestParam(defaultValue = "8") int limit) {
        if (q.isBlank()) {
            throw new InvalidInputException("Search text is empty");
        }
        if (limit < 1 || limit > 50) {
            throw new InvalidInputException("Limit must be between 1 and 50");
        }
        long t0 = System.nanoTime();
        List<Turnaround> found = plans.search(day, q, limit);
        double trieMs = (System.nanoTime() - t0) / 1e6;
        long t1 = System.nanoTime();
        int linear = 0;
        String needle = q.replace(" ", "").toUpperCase();
        for (Turnaround t : plans.data().day(day).visits()) {
            for (Flight f : new Flight[] {t.getArrival(), t.getDeparture()}) {
                if (f != null && (f.getKey().startsWith(needle) || f.getAirline().toUpperCase().startsWith(q.toUpperCase())
                        || f.getCity().toUpperCase().startsWith(q.toUpperCase()))) {
                    linear++;
                }
            }
        }
        double scanMs = (System.nanoTime() - t1) / 1e6;
        List<Map<String, Object>> results = new ArrayList<>();
        for (Turnaround t : found) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("visit", t.getId());
            r.put("label", t.getLabel());
            r.put("airline", t.getAirline());
            Flight f = t.primary();
            r.put("city", f.getCity());
            r.put("iata", f.getOtherAirport());
            r.put("type", t.getArrival() != null && t.getDeparture() != null ? "TURN" : f.getType().name());
            results.add(r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", q);
        out.put("results", results);
        out.put("trieMs", Math.round(trieMs * 1000) / 1000.0);
        out.put("linearScanMs", Math.round(scanMs * 1000) / 1000.0);
        out.put("linearMatches", linear);
        return out;
    }

    @GetMapping("/stands")
    public Object stands() {
        return plans.data().stands();
    }
}
