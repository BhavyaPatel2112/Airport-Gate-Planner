package com.gateplanner.api;

import com.gateplanner.engine.PlanService;
import com.gateplanner.engine.ScenarioEngine;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Scenario lab: fog ground delay, aircraft swap, and re-planning everything that is still to come. */
@RestController
@RequestMapping("/api/plan/{id}")
public class ScenarioController {

    public record GroundDelayRequest(@NotNull Integer from, @NotNull Integer to, @NotNull Integer minutes) {
    }

    public record SwapRequest(@NotBlank String flight, @NotBlank String size) {
    }

    public record ReplanRequest(@NotNull Integer from, Boolean hold) {
    }

    private final ScenarioEngine scenarios;

    public ScenarioController(ScenarioEngine scenarios) {
        this.scenarios = scenarios;
    }

    @PostMapping("/ground-delay")
    public PlanView groundDelay(@PathVariable String id, @Valid @RequestBody GroundDelayRequest req) {
        return PlanView.of(scenarios.groundDelay(id, req.from(), req.to(), req.minutes()));
    }

    @PostMapping("/replan")
    public PlanView replan(@PathVariable String id, @Valid @RequestBody ReplanRequest req) {
        PlanService.Operation op = scenarios.replan(id, req.from(), Boolean.TRUE.equals(req.hold()));
        PlanView view = PlanView.of(op);
        // the guided replay belongs to this answer only
        op.plan().getLastSnapshots().remove("replan");
        return view;
    }

    @PostMapping("/swap")
    public PlanView swap(@PathVariable String id, @Valid @RequestBody SwapRequest req) {
        return PlanView.of(scenarios.swap(id, req.flight(), req.size()));
    }
}
