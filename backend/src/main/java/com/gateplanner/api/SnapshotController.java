package com.gateplanner.api;

import com.gateplanner.engine.InvalidInputException;
import com.gateplanner.engine.NotFoundException;
import com.gateplanner.engine.PlanService;
import com.gateplanner.model.PlanState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Structure snapshots for the machine view: rbtree, matching, fibheap or suffix. */
@RestController
@RequestMapping("/api/snapshots")
public class SnapshotController {

    private static final List<String> STRUCTURES = List.of("rbtree", "matching", "fibheap", "suffix");

    private final PlanService plans;

    public SnapshotController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping("/{structure}")
    public Object snapshot(@PathVariable String structure, @RequestParam String plan,
                           @RequestParam(required = false) String stand) {
        if (!STRUCTURES.contains(structure)) {
            throw new InvalidInputException("Unknown structure " + structure + ". Use one of " + STRUCTURES);
        }
        PlanState p = plans.get(plan);
        if (structure.equals("rbtree") && stand != null) {
            if (p.stand(stand.toUpperCase()) == null) {
                throw new NotFoundException("Stand " + stand + " not found");
            }
            plans.snapshotTree(p, stand.toUpperCase(), null);
        }
        Object snap = p.getLastSnapshots().get(structure);
        if (snap == null) {
            throw new NotFoundException("No " + structure + " snapshot yet. Run an operation that uses it first.");
        }
        return snap;
    }
}
