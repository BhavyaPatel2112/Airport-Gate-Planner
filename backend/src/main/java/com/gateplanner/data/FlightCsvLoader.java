package com.gateplanner.data;

import com.gateplanner.model.Flight;
import com.gateplanner.model.MovementType;
import com.gateplanner.model.SizeClass;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads one day of flights from CSV. Validates every row and reports the line number of the first
 * problem. Duplicate flight numbers (same number and direction on the same day) are merged and a
 * warning is recorded. Missing actual times fall back to the scheduled time and are flagged.
 */
public final class FlightCsvLoader {

    public static final String HEADER = "flight,airline_code,airline,type,aircraft,size,international,"
            + "origin_or_dest,city,scheduled,actual,terminal,registration,status,real_gate,actual_missing";

    private static final int COLUMNS = 16;

    /** Result of loading: the flights plus warnings such as merged duplicates. */
    public record Result(List<Flight> flights, List<String> warnings) {
    }

    private FlightCsvLoader() {
    }

    /**
     * Parses the CSV.
     *
     * @param reader source of the CSV text
     * @param day    the day the file describes; times become minutes after this day's midnight
     * @throws DataFormatException for an empty file or a malformed row
     */
    public static Result load(Reader reader, LocalDate day) throws IOException {
        List<Flight> flights = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Integer> seen = new HashMap<>();
        LocalDateTime midnight = day.atStartOfDay();
        try (BufferedReader in = new BufferedReader(reader)) {
            String header = in.readLine();
            if (header == null || header.isBlank()) {
                throw new DataFormatException("Flight file is empty", 1);
            }
            if (!header.trim().equals(HEADER)) {
                throw new DataFormatException("Unexpected header, expected: " + HEADER, 1);
            }
            String line;
            int lineNo = 1;
            while ((line = in.readLine()) != null) {
                lineNo++;
                if (line.isBlank()) {
                    continue;
                }
                String[] c = line.split(",", -1);
                if (c.length != COLUMNS) {
                    throw new DataFormatException("Expected " + COLUMNS + " columns but found " + c.length, lineNo);
                }
                Flight f = parse(c, midnight, lineNo);
                String key = f.getKey() + "|" + f.getType();
                if (seen.containsKey(key)) {
                    warnings.add("Duplicate flight " + f.getNumber() + " (" + f.getType() + ") on line " + lineNo
                            + " merged with line " + seen.get(key));
                    continue;
                }
                seen.put(key, lineNo);
                if (f.isActualMissing()) {
                    warnings.add("Flight " + f.getNumber() + " has no actual time; scheduled time used");
                }
                flights.add(f);
            }
        }
        if (flights.isEmpty()) {
            throw new DataFormatException("Flight file has a header but no flights", 2);
        }
        return new Result(flights, warnings);
    }

    private static Flight parse(String[] c, LocalDateTime midnight, int lineNo) {
        String number = c[0].trim();
        if (number.isEmpty()) {
            throw new DataFormatException("Flight number is missing", lineNo);
        }
        MovementType type;
        try {
            type = MovementType.valueOf(c[3].trim());
        } catch (IllegalArgumentException e) {
            throw new DataFormatException("Type must be ARR or DEP, found '" + c[3] + "'", lineNo);
        }
        SizeClass size;
        try {
            size = SizeClass.valueOf(c[5].trim());
        } catch (IllegalArgumentException e) {
            throw new DataFormatException("Size must be NARROW or WIDE, found '" + c[5] + "'", lineNo);
        }
        String intl = c[6].trim();
        if (!intl.equals("true") && !intl.equals("false")) {
            throw new DataFormatException("International must be true or false", lineNo);
        }
        int scheduled = minutes(c[9], midnight, lineNo, "scheduled");
        boolean actualMissing = c[10].isBlank() || Boolean.parseBoolean(c[15].trim());
        int actual = c[10].isBlank() ? scheduled : minutes(c[10], midnight, lineNo, "actual");
        String terminal = c[11].trim();
        if (!terminal.equals("T1") && !terminal.equals("T2")) {
            throw new DataFormatException("Terminal must be T1 or T2, found '" + terminal + "'", lineNo);
        }
        return new Flight(number, c[1].trim(), c[2].trim(), type, c[4].trim(), size, Boolean.parseBoolean(intl),
                c[7].trim(), c[8].trim(), scheduled, actual, terminal, c[12].trim(),
                c[13].trim().equals("CANCELLED"), c[14].trim(), actualMissing);
    }

    private static int minutes(String text, LocalDateTime midnight, int lineNo, String field) {
        try {
            LocalDateTime t = LocalDateTime.parse(text.trim());
            long m = Duration.between(midnight, t).toMinutes();
            if (m < -24 * 60 || m > 2 * 24 * 60) {
                throw new DataFormatException("The " + field + " time is not on this day: " + text, lineNo);
            }
            return (int) m;
        } catch (DateTimeParseException e) {
            throw new DataFormatException("Bad " + field + " time '" + text + "', expected yyyy-MM-ddTHH:mm", lineNo);
        }
    }
}
