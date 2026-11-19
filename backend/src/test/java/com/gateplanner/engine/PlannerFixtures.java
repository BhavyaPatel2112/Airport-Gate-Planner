package com.gateplanner.engine;

import com.gateplanner.model.Flight;
import com.gateplanner.model.MovementType;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/** Small hand-made airports for engine tests. */
final class PlannerFixtures {

    private PlannerFixtures() {
    }

    static Stand stand(String id, SizeClass size, boolean contact) {
        return new Stand(id, "T2", size, contact, false, 0, 0, "K", "G", "assumed");
    }

    static Turnaround visit(String id, int start, int end, SizeClass size) {
        Flight f = new Flight(id, "AI", "Air India", MovementType.ARR, "Airbus A320", size, false, "DEL", "New Delhi",
                start, start, "T2", "", false, "", false);
        return new Turnaround(id, f, null, size, false, "T2", "AI", "Air India", "", false, false, start, end, start, end);
    }

    static PlanState plan(List<Stand> stands, List<Turnaround> visits) {
        List<Turnaround> copies = new ArrayList<>();
        for (Turnaround t : visits) {
            copies.add(t.copy());
        }
        return new PlanState("test", 1, 90, stands, copies, new HashMap<>());
    }
}
