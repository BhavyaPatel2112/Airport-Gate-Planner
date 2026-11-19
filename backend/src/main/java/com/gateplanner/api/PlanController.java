package com.gateplanner.api;

import com.gateplanner.engine.PlanService;
import com.gateplanner.engine.TraceRecorder;
import com.gateplanner.model.PlanState;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds plans and handles delays, cancellations, real-time replay, explanations and the race. */
@RestController
@RequestMapping("/api/plan")
public class PlanController {

    public record CreateRequest(@NotNull @Min(1) @Max(2) Integer day, @Min(50) @Max(99) Integer bufferPercentile) {
    }

    public record DelayRequest(@NotBlank String flight, @NotNull Integer minutes, Integer atMinute) {
    }

    public record CancelRequest(@NotBlank String flight, Integer atMinute) {
    }

    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    @PostMapping
    public PlanView create(@Valid @RequestBody CreateRequest req) {
        return PlanView.of(plans.create(req.day(), req.bufferPercentile() == null ? 75 : req.bufferPercentile()));
    }

    @GetMapping("/{id}")
    public PlanView get(@PathVariable String id) {
        PlanState p = plans.get(id);
        return PlanView.of(p, "Plan " + id, List.of(), List.of());
    }

    @GetMapping("/{id}/occupancy")
    public Map<String, Object> occupancy(@PathVariable String id) {
        long t0 = System.nanoTime();
        long[] values = plans.occupancy(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minutes", values);
        out.put("timeMs", TraceRecorder.since(t0));
        out.put("method", "Lazy segment tree: every point value read in O(n)");
        return out;
    }

    @GetMapping("/{id}/busiest")
    public Map<String, Object> busiest(@PathVariable String id, @RequestParam(defaultValue = "60") int window) {
        return plans.busiest(id, window);
    }

    @PostMapping("/{id}/delay")
    public PlanView delay(@PathVariable String id, @Valid @RequestBody DelayRequest req) {
        return PlanView.of(plans.delay(id, req.flight(), req.minutes(), req.atMinute()));
    }

    @PostMapping("/{id}/cancel")
    public PlanView cancel(@PathVariable String id, @Valid @RequestBody CancelRequest req) {
        return PlanView.of(plans.cancel(id, req.flight(), req.atMinute()));
    }

    @PostMapping("/{id}/real-times")
    public PlanView realTimes(@PathVariable String id) {
        return PlanView.of(plans.applyRealTimes(id));
    }

    @GetMapping("/{id}/why/{flight}")
    public PlanService.Why why(@PathVariable String id, @PathVariable String flight) {
        return plans.why(id, flight);
    }

    @PostMapping("/{id}/race")
    public PlanService.RaceResult race(@PathVariable String id) {
        return plans.race(id);
    }
}
