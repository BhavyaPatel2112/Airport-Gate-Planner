package com.gateplanner.data;

import com.gateplanner.model.Turnaround;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlightCsvLoaderTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 16);

    private static String row(String number, String type, String sched, String actual, String reg) {
        return number + ",AI,Air India," + type + ",Airbus A320,NARROW,false,DEL,New Delhi," + sched + "," + actual
                + ",T2," + reg + ",OPERATED,,false";
    }

    @Test
    void loadsAndPairsByRegistration() throws Exception {
        String csv = FlightCsvLoader.HEADER + "\n"
                + row("AI 1", "ARR", "2026-11-16T10:00", "2026-11-16T10:20", "VT-ABC") + "\n"
                + row("AI 2", "DEP", "2026-11-16T11:00", "2026-11-16T11:05", "VT-ABC") + "\n"
                + row("AI 3", "DEP", "2026-11-16T12:00", "2026-11-16T12:00", "") + "\n";
        FlightCsvLoader.Result r = FlightCsvLoader.load(new StringReader(csv), DAY);
        assertEquals(3, r.flights().size());
        assertEquals(600, r.flights().get(0).getScheduledMin());
        assertEquals(20, r.flights().get(0).getDelayMin());
        List<Turnaround> visits = TurnaroundBuilder.build(r.flights());
        assertEquals(2, visits.size());
        Turnaround paired = visits.stream().filter(Turnaround::isPaired).findFirst().orElseThrow();
        assertEquals(600, paired.getSchedStart());
        assertEquals(660, paired.getSchedEnd());
        Turnaround single = visits.stream().filter(t -> !t.isPaired()).findFirst().orElseThrow();
        assertEquals(720 - Turnaround.NARROW_TURN, single.getSchedStart());
    }

    @Test
    void emptyFileIsRejected() {
        DataFormatException e = assertThrows(DataFormatException.class,
                () -> FlightCsvLoader.load(new StringReader(""), DAY));
        assertEquals(1, e.getLine());
    }

    @Test
    void malformedRowReportsLineNumber() {
        String csv = FlightCsvLoader.HEADER + "\n" + row("AI 1", "ARR", "2026-11-16T10:00", "2026-11-16T10:20", "")
                + "\nAI 9,broken\n";
        DataFormatException e = assertThrows(DataFormatException.class,
                () -> FlightCsvLoader.load(new StringReader(csv), DAY));
        assertEquals(3, e.getLine());
        String badTime = FlightCsvLoader.HEADER + "\n" + row("AI 1", "ARR", "16/11 10:00", "", "");
        assertThrows(DataFormatException.class, () -> FlightCsvLoader.load(new StringReader(badTime), DAY));
    }

    @Test
    void duplicatesAreMergedWithWarning() throws Exception {
        String csv = FlightCsvLoader.HEADER + "\n" + row("AI 1", "ARR", "2026-11-16T10:00", "2026-11-16T10:20", "")
                + "\n" + row("AI 1", "ARR", "2026-11-16T10:00", "2026-11-16T10:25", "") + "\n";
        FlightCsvLoader.Result r = FlightCsvLoader.load(new StringReader(csv), DAY);
        assertEquals(1, r.flights().size());
        assertTrue(r.warnings().get(0).contains("Duplicate"));
    }

    @Test
    void missingActualFallsBackToScheduled() throws Exception {
        String csv = FlightCsvLoader.HEADER + "\n" + row("AI 1", "ARR", "2026-11-16T10:00", "", "") + "\n";
        FlightCsvLoader.Result r = FlightCsvLoader.load(new StringReader(csv), DAY);
        assertTrue(r.flights().get(0).isActualMissing());
        assertEquals(0, r.flights().get(0).getDelayMin());
        assertTrue(r.warnings().get(0).contains("scheduled time used"));
    }

    @Test
    void pastMidnightIsKept() throws Exception {
        String csv = FlightCsvLoader.HEADER + "\n" + row("AI 1", "ARR", "2026-11-16T23:50", "2026-11-17T00:40", "") + "\n";
        FlightCsvLoader.Result r = FlightCsvLoader.load(new StringReader(csv), DAY);
        assertEquals(1480, r.flights().get(0).getActualMin());
    }
}
