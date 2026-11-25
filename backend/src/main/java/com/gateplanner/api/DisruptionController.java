package com.gateplanner.api;

import com.gateplanner.engine.AvailabilityRadar;
import com.gateplanner.engine.DepartureBoard;
import com.gateplanner.engine.DisruptionEngine;
import com.gateplanner.engine.InvalidInputException;
import com.gateplanner.engine.PlanService;
import com.gateplanner.engine.TraceRecorder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Monsoon storm, rush hour, availability radar and the departures board. */
@RestController
@RequestMapping("/api/plan/{id}")
public class DisruptionController {

    public record StormRequest(@NotNull @Min(50) @Max(99) Integer severityPercentile, Long seed, Integer from,
                               Integer to) {
    }

    public record RushRequest(@NotNull @Min(1) @Max(200) Integer count, Long seed, Integer atMinute) {
    }

    private final DisruptionEngine disruptions;
    private final PlanService plans;

    public DisruptionController(DisruptionEngine disruptions, PlanService plans) {
        this.disruptions = disruptions;
        this.plans = plans;
    }

    @PostMapping("/storm")
    public PlanView storm(@PathVariable String id, @Valid @RequestBody StormRequest req) {
        int from = req.from() == null ? 14 * 60 : req.from();
        int to = req.to() == null ? from + 180 : req.to();
        return PlanView.of(disruptions.storm(id, req.severityPercentile(), req.seed() == null ? 7L : req.seed(), from, to));
    }

    @PostMapping("/rush")
    public PlanView rush(@PathVariable String id, @Valid @RequestBody RushRequest req) {
        return PlanView.of(disruptions.rush(id, req.count(), req.seed() == null ? 11L : req.seed(),
                req.atMinute() == null ? 6 * 60 : req.atMinute()));
    }

    @GetMapping("/radar")
    public Map<String, Object> radar(@PathVariable String id, @RequestParam(defaultValue = "360") int minute) {
        check(minute);
        TraceRecorder trace = new TraceRecorder();
        Map<String, Object> out = new java.util.LinkedHashMap<>(AvailabilityRadar.view(plans.get(id), minute, trace));
        out.put("trace", trace.entries());
        return out;
    }

    @GetMapping("/board")
    public Map<String, Object> board(@PathVariable String id, @RequestParam(defaultValue = "360") int minute,
                                     @RequestParam(defaultValue = "12") int count,
                                     @RequestParam(defaultValue = "DEP") String type) {
        check(minute);
        if (count < 1 || count > 40) {
            throw new InvalidInputException("Count must be between 1 and 40");
        }
        TraceRecorder trace = new TraceRecorder();
        Map<String, Object> out = new java.util.LinkedHashMap<>(
                DepartureBoard.rows(plans.get(id), minute, count, !"ARR".equalsIgnoreCase(type), trace));
        out.put("trace", trace.entries());
        return out;
    }

    private static void check(int minute) {
        if (minute < 0 || minute > 2 * 24 * 60) {
            throw new InvalidInputException("Minute must be between 0 and 2880");
        }
    }
}
