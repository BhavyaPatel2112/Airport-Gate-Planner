package com.gateplanner.engine;

import com.gateplanner.model.PlanState;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static com.gateplanner.engine.PlannerFixtures.plan;
import static com.gateplanner.engine.PlannerFixtures.stand;
import static com.gateplanner.engine.PlannerFixtures.visit;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatePlannerTest {

    @Test
    void standsUsedEqualPeakOverlap() {
        Random rnd = new Random(2);
        List<Stand> stands = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            stands.add(stand("S" + i, SizeClass.NARROW, i < 20));
        }
        List<Turnaround> visits = new ArrayList<>();
        for (int i = 0; i < 300; i++) {
            int s = rnd.nextInt(1300);
            visits.add(visit("V" + i, s, s + 30 + rnd.nextInt(60), SizeClass.NARROW));
        }
        PlanState p = plan(stands, visits);
        GatePlanner.assign(p, new TraceRecorder());
        GatePlanner.Certificate c = (GatePlanner.Certificate) p.getCertificate();
        int peak = 0;
        for (int m = 0; m < 1440; m++) {
            int busy = 0;
            for (Turnaround t : visits) {
                if (t.getStart() <= m && m < t.getEnd()) {
                    busy++;
                }
            }
            peak = Math.max(peak, busy);
        }
        assertTrue(c.optimal());
        assertEquals(peak, c.standsUsed());
        assertEquals(peak, c.sumOfPeaks());
    }

    @Test
    void neverPutsAWideBodyOnANarrowStand() {
        List<Stand> stands = List.of(stand("N1", SizeClass.NARROW, true), stand("W1", SizeClass.WIDE, true));
        PlanState p = plan(stands, List.of(visit("WIDE1", 100, 200, SizeClass.WIDE),
                visit("WIDE2", 150, 250, SizeClass.WIDE)));
        GatePlanner.assign(p, new TraceRecorder());
        assertEquals("W1", p.standOf("WIDE1"));
        assertNull(p.standOf("WIDE2"), "the only wide stand is busy");
        assertTrue(p.reasonOf("WIDE2").contains("wide-body"));
    }

    @Test
    void narrowOverflowNeverBlocksAWideBody() {
        List<Stand> stands = List.of(stand("N1", SizeClass.NARROW, true), stand("W1", SizeClass.WIDE, true));
        PlanState p = plan(stands, List.of(visit("NAR1", 100, 200, SizeClass.NARROW),
                visit("NAR2", 110, 150, SizeClass.NARROW), visit("WIDE", 160, 260, SizeClass.WIDE)));
        GatePlanner.assign(p, new TraceRecorder());
        assertEquals("W1", p.standOf("WIDE"));
        assertNotNull(p.standOf("NAR1"));
    }

    @Test
    void emptyDayGivesEmptyPlan() {
        PlanState p = plan(List.of(stand("S1", SizeClass.NARROW, true)), List.of());
        GatePlanner.assign(p, new TraceRecorder());
        assertEquals(0, ((GatePlanner.Certificate) p.getCertificate()).standsUsed());
    }

    @Test
    void contactStandsAreOpenedFirst() {
        PlanState p = plan(List.of(stand("REMOTE", SizeClass.NARROW, false), stand("BRIDGE", SizeClass.NARROW, true)),
                List.of(visit("V1", 100, 200, SizeClass.NARROW)));
        GatePlanner.assign(p, new TraceRecorder());
        assertEquals("BRIDGE", p.standOf("V1"));
    }
}
