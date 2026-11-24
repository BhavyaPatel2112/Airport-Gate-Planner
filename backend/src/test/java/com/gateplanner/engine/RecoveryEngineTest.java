package com.gateplanner.engine;

import com.gateplanner.model.Closure;
import com.gateplanner.model.EventType;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.gateplanner.engine.PlannerFixtures.plan;
import static com.gateplanner.engine.PlannerFixtures.stand;
import static com.gateplanner.engine.PlannerFixtures.visit;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecoveryEngineTest {

    @Test
    void lateDepartureMovesTheNextArrival() {
        List<Stand> stands = List.of(stand("A", SizeClass.NARROW, true), stand("B", SizeClass.NARROW, true));
        PlanState p = plan(stands, List.of(visit("EARLY", 100, 160, SizeClass.NARROW),
                visit("NEXT", 170, 230, SizeClass.NARROW)));
        p.place(p.visit("EARLY"), "A");
        p.place(p.visit("NEXT"), "A");
        Turnaround early = p.visit("EARLY");
        PlanService.retime(p, early, 100, 200);
        RecoveryEngine.Outcome o = RecoveryEngine.recover(p, List.of(early), List.of(), List.of(), true,
                new TraceRecorder(), "test");
        assertEquals("A", p.standOf("EARLY"), "the aircraft already on the stand stays");
        assertEquals("B", p.standOf("NEXT"));
        assertTrue(o.events().stream().anyMatch(e -> e.type() == EventType.MOVE));
    }

    @Test
    void absorbedDelayChangesNothing() {
        PlanState p = plan(List.of(stand("A", SizeClass.NARROW, true)),
                List.of(visit("V1", 100, 160, SizeClass.NARROW), visit("V2", 200, 260, SizeClass.NARROW)));
        p.place(p.visit("V1"), "A");
        p.place(p.visit("V2"), "A");
        PlanService.retime(p, p.visit("V1"), 110, 170);
        RecoveryEngine.Outcome o = RecoveryEngine.recover(p, List.of(p.visit("V1")), List.of(), List.of(), true,
                new TraceRecorder(), "test");
        assertEquals(0, o.affected());
        assertEquals("A", p.standOf("V2"));
    }

    @Test
    void closureKicksVisitsAndExplainsShortage() {
        List<Stand> stands = List.of(stand("W1", SizeClass.WIDE, true), stand("W2", SizeClass.WIDE, true));
        PlanState p = plan(stands, List.of(visit("X", 100, 200, SizeClass.WIDE), visit("Y", 120, 220, SizeClass.WIDE)));
        p.place(p.visit("X"), "W1");
        p.place(p.visit("Y"), "W2");
        Closure c = new Closure("W1", 0, 1440, "N99", "test");
        p.getClosures().add(c);
        RecoveryEngine.Outcome o = RecoveryEngine.recover(p, List.of(), List.of(c), List.of(), true,
                new TraceRecorder(), "closure");
        assertEquals(1, o.unplaced());
        assertNull(p.standOf("X"));
        assertTrue(p.reasonOf("X").contains("closed by notices"));
    }

    @Test
    void matchingBeatsGreedyOnTheTextbookCase() {
        // A fits N1 and W1, B fits only W1; both overlap
        List<Stand> stands = List.of(stand("W1", SizeClass.WIDE, true), stand("N1", SizeClass.NARROW, true));
        Turnaround a = visit("A", 100, 200, SizeClass.NARROW);
        Turnaround b = visit("B", 110, 210, SizeClass.WIDE);
        PlanState greedy = plan(stands, List.of(a, b));
        PlanState matching = plan(stands, List.of(a, b));
        RecoveryEngine.Outcome g = RecoveryEngine.placeAll(greedy, List.of(greedy.visit("A"), greedy.visit("B")),
                false, new TraceRecorder(), "greedy");
        RecoveryEngine.Outcome m = RecoveryEngine.placeAll(matching, List.of(matching.visit("A"), matching.visit("B")),
                true, new TraceRecorder(), "matching");
        assertEquals(1, g.placed());
        assertEquals(2, m.placed());
        assertEquals("N1", matching.standOf("A"));
        assertEquals("W1", matching.standOf("B"));
    }

    @Test
    void neverPlacesOnAnIncompatibleOrBusyStand() {
        List<Stand> stands = List.of(stand("N1", SizeClass.NARROW, true), stand("N2", SizeClass.NARROW, false));
        PlanState p = plan(stands, List.of(visit("W", 100, 200, SizeClass.WIDE), visit("A", 100, 200, SizeClass.NARROW),
                visit("B", 120, 180, SizeClass.NARROW), visit("C", 130, 150, SizeClass.NARROW)));
        RecoveryEngine.placeAll(p, List.copyOf(p.getVisits()), true, new TraceRecorder(), "test");
        assertNull(p.standOf("W"));
        for (Stand s : stands) {
            p.tree(s.getId()).validate();
            assertTrue(p.tree(s.getId()).size() <= 1);
        }
        assertEquals(2, p.unplacedVisits().size());
    }
}
