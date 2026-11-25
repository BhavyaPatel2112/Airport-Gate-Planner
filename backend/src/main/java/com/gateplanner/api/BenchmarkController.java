package com.gateplanner.api;

import com.gateplanner.algo.exact.ExactGateSolver;
import com.gateplanner.bench.BenchmarkRunner;
import com.gateplanner.engine.InfeasibleException;
import com.gateplanner.engine.InvalidInputException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Runs benchmark suites and the exact versus smart comparison. */
@RestController
@RequestMapping("/api")
public class BenchmarkController {

    public record BenchRequest(@NotBlank String suite, List<Integer> sizes, Long seed) {
    }

    public record ExactRequest(@NotNull Integer flights, Long seed) {
    }

    @GetMapping("/bench/suites")
    public Map<String, Object> suites() {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String s : BenchmarkRunner.SUITES) {
            out.put(s, BenchmarkRunner.defaultSizes(s));
        }
        return out;
    }

    @PostMapping("/bench/run")
    public Map<String, Object> run(@Valid @RequestBody BenchRequest req) {
        if (!BenchmarkRunner.SUITES.contains(req.suite())) {
            throw new InvalidInputException("Unknown suite " + req.suite() + ". Use one of " + BenchmarkRunner.SUITES);
        }
        int[] sizes = null;
        if (req.sizes() != null && !req.sizes().isEmpty()) {
            if (req.sizes().size() > 6) {
                throw new InvalidInputException("At most 6 sizes per run");
            }
            sizes = new int[req.sizes().size()];
            for (int i = 0; i < sizes.length; i++) {
                sizes[i] = req.sizes().get(i);
            }
        }
        long t0 = System.nanoTime();
        List<BenchmarkRunner.Row> rows = BenchmarkRunner.run(req.suite(), sizes, req.seed() == null ? 42L : req.seed());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("suite", req.suite());
        out.put("rows", rows);
        out.put("totalMs", Math.round((System.nanoTime() - t0) / 1e4) / 100.0);
        out.put("method", "1 warm-up run, then the median of 5 timed runs; fixed seed");
        return out;
    }

    @PostMapping("/exact")
    public Map<String, Object> exact(@Valid @RequestBody ExactRequest req) {
        int n = req.flights();
        if (n < 2) {
            throw new InvalidInputException("Use at least 2 flights");
        }
        if (n > ExactGateSolver.MAX_FLIGHTS) {
            throw new InfeasibleException("The exact solver is exponential and accepts at most "
                    + ExactGateSolver.MAX_FLIGHTS + " flights. For " + n + " flights use the smart planner.");
        }
        long seed = req.seed() == null ? 42L : req.seed();
        ExactGateSolver.Problem p = BenchmarkRunner.exactProblem(n, seed);
        ExactGateSolver.Solution exact = ExactGateSolver.branchAndBound(p);
        ExactGateSolver.Solution ours = ExactGateSolver.heuristic(p);
        ExactGateSolver.Solution brute = n <= ExactGateSolver.MAX_BRUTE_FORCE ? ExactGateSolver.bruteForce(p) : null;
        List<Map<String, Object>> flights = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("id", i);
            f.put("start", p.start()[i]);
            f.put("end", p.end()[i]);
            f.put("exact", exact.assignment()[i]);
            f.put("ours", ours.assignment()[i]);
            flights.add(f);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("flights", n);
        out.put("stands", p.stands());
        out.put("seed", seed);
        out.put("exact", exact);
        out.put("ours", ours);
        out.put("bruteForce", brute);
        out.put("gap", ours.cost() - exact.cost());
        out.put("assignments", flights);
        out.put("costRule", "contact stand 0, remote stand 3, narrow-body on a wide stand +1, no stand 20");
        return out;
    }
}
