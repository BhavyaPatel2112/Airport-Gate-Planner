package com.gateplanner.data;

import com.gateplanner.algo.trie.Trie;
import com.gateplanner.engine.DelayStats;
import com.gateplanner.model.Flight;
import com.gateplanner.model.Stand;
import com.gateplanner.model.Turnaround;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Loads the saved data once at startup: stands, two days of real flights, the stand visits built
 * from them, delay statistics and the sample notices. The demo never needs the internet.
 */
@Component
public class AirportData {

    /** Flights, visits and the search index for one day. */
    public record Day(int number, LocalDate date, List<Flight> flights, List<Turnaround> visits,
                      Map<String, String> flightIndex, Trie<String> search, List<String> warnings) {
    }

    private final Path dir;
    private final List<Stand> stands;
    private final Day day1;
    private final Day day2;
    private final DelayStats delayStats;
    private final List<String> notices;

    public AirportData(@Value("${gateplanner.data-dir:../data}") String dataDir,
                       @Value("${gateplanner.first-day:2026-11-16}") String firstDay) {
        this.dir = Path.of(dataDir);
        try {
            this.stands = StandLoader.load(Files.newBufferedReader(dir.resolve("stands.csv"), StandardCharsets.UTF_8));
            LocalDate d1 = LocalDate.parse(firstDay);
            this.day1 = loadDay(1, d1);
            this.day2 = loadDay(2, d1.plusDays(1));
            List<Flight> all = new ArrayList<>(day1.flights());
            all.addAll(day2.flights());
            this.delayStats = new DelayStats(all);
            this.notices = NoticeLoader.load(Files.newBufferedReader(dir.resolve("notices.txt"), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read data from " + dir.toAbsolutePath(), e);
        }
    }

    private Day loadDay(int n, LocalDate date) throws IOException {
        FlightCsvLoader.Result r = FlightCsvLoader.load(
                Files.newBufferedReader(dir.resolve("flights_day" + n + ".csv"), StandardCharsets.UTF_8), date);
        List<Turnaround> visits = TurnaroundBuilder.build(r.flights());
        Map<String, String> index = TurnaroundBuilder.flightIndex(visits);
        Trie<String> trie = new Trie<>();
        for (Turnaround t : visits) {
            for (Flight f : new Flight[] {t.getArrival(), t.getDeparture()}) {
                if (f == null) {
                    continue;
                }
                trie.insert(f.getKey(), t.getId());
                trie.insert(f.getNumber(), t.getId());
                trie.insert(f.getAirline(), t.getId());
                if (!f.getCity().isBlank()) {
                    trie.insert(f.getCity(), t.getId());
                }
                if (!f.getOtherAirport().isBlank()) {
                    trie.insert(f.getOtherAirport(), t.getId());
                }
                if (!f.getRegistration().isBlank()) {
                    trie.insert(f.getRegistration(), t.getId());
                }
            }
        }
        return new Day(n, date, r.flights(), visits, index, trie, r.warnings());
    }

    public List<Stand> stands() {
        return stands;
    }

    public Day day(int n) {
        if (n == 1) {
            return day1;
        }
        if (n == 2) {
            return day2;
        }
        throw new com.gateplanner.engine.InvalidInputException("Day must be 1 or 2");
    }

    public DelayStats delayStats() {
        return delayStats;
    }

    public List<String> baseNotices() {
        return notices;
    }
}
