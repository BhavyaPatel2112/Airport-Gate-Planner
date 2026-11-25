package com.gateplanner.api;

import com.gateplanner.engine.DelayStats;
import com.gateplanner.engine.InvalidInputException;
import com.gateplanner.engine.PlanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Airline delay statistics: leaderboard and selection timings. */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final PlanService plans;

    public StatsController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping("/delays")
    public Map<String, Object> delays(@RequestParam(defaultValue = "90") double percentile,
                                      @RequestParam(defaultValue = "42") long seed) {
        if (percentile < 50 || percentile > 99) {
            throw new InvalidInputException("Percentile must be between 50 and 99");
        }
        DelayStats stats = plans.data().delayStats();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("percentile", percentile);
        out.put("seed", seed);
        out.put("airlines", stats.leaderboard(percentile, seed));
        out.put("timing", stats.timing(percentile, seed));
        out.put("buffers", stats.buffers(percentile));
        return out;
    }
}
