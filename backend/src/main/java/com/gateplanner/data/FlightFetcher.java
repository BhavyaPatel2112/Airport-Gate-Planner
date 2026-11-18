package com.gateplanner.data;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Command line tool that downloads two days of Mumbai (VABB) arrivals and departures from the
 * AeroDataBox airport flights endpoint and converts them to {@code flights_day1.csv} and
 * {@code flights_day2.csv}.
 *
 * <p>Usage, from the backend folder:</p>
 * <pre>
 *   ./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.data.FlightFetcher -Dexec.args="fetch ../data 2026-11-16"
 *   ./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.data.FlightFetcher -Dexec.args="convert ../data 2026-11-16"
 * </pre>
 * The API key is read from the environment variable {@code AERODATABOX_KEY}. It is never written
 * to disk. The endpoint allows at most 12 hours per call, so two days take four calls.
 */
public final class FlightFetcher {

    private static final String HOST = "aerodatabox.p.rapidapi.com";
    private static final String QUERY = "?withLeg=true&direction=Both&withCancelled=true&withCodeshared=false"
            + "&withCargo=false&withPrivate=false&withLocation=false";

    /** Display names for airline codes where the data source uses a legal or outdated name. */
    private static final Map<String, String> AIRLINE_NAMES = new HashMap<>();

    static {
        String[][] names = {
            {"QP", "Akasa Air"}, {"S5", "Star Air"}, {"BA", "British Airways"}, {"SQ", "Singapore Airlines"},
            {"TG", "Thai Airways"}, {"LH", "Lufthansa"}, {"CX", "Cathay Pacific"}, {"SV", "Saudia"},
            {"QR", "Qatar Airways"}, {"TK", "Turkish Airlines"}, {"KU", "Kuwait Airways"}, {"MS", "EgyptAir"},
            {"IA", "Iraqi Airways"}, {"UL", "SriLankan Airlines"}, {"WY", "Oman Air"}, {"GF", "Gulf Air"},
            {"ET", "Ethiopian Airlines"}, {"MH", "Malaysia Airlines"}, {"VN", "Vietnam Airlines"},
            {"KQ", "Kenya Airways"}, {"OD", "Batik Air Malaysia"}, {"EK", "Emirates"}, {"EY", "Etihad Airways"},
            {"VS", "Virgin Atlantic"}, {"NH", "ANA"}, {"LX", "Swiss"}, {"AF", "Air France"}, {"KL", "KLM"},
            {"J9", "Jazeera Airways"}, {"J2", "Azerbaijan Airlines"}, {"XY", "flynas"}, {"OV", "SalamAir"},
            {"RJ", "Royal Jordanian"}, {"TC", "Air Tanzania"}, {"VZ", "Thai Vietjet"}, {"VJ", "VietJet Air"},
            {"G9", "Air Arabia"}, {"FZ", "flydubai"}, {"SK", "SAS"}, {"F3", "flyadeal"}, {"MK", "Air Mauritius"},
            {"IY", "Yemenia"}, {"RX", "Riyadh Air"}, {"9I", "Alliance Air"}, {"6E", "IndiGo"}, {"AI", "Air India"},
            {"IX", "Air India Express"}, {"SG", "SpiceJet"}
        };
        for (String[] n : names) {
            AIRLINE_NAMES.put(n[0], n[1]);
        }
    }

    private FlightFetcher() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.out.println("Usage: FlightFetcher fetch|convert <dataDir> <firstDay yyyy-mm-dd>");
            return;
        }
        Path dataDir = Path.of(args[1]);
        LocalDate day1 = LocalDate.parse(args[2]);
        if (args[0].equals("fetch")) {
            fetch(dataDir.resolve("raw"), day1);
        }
        convert(dataDir, day1);
    }

    /** Downloads four 12 hour windows (two days) into {@code rawDir}. */
    static void fetch(Path rawDir, LocalDate day1) throws IOException, InterruptedException {
        String key = System.getenv("AERODATABOX_KEY");
        if (key == null || key.isBlank()) {
            throw new IllegalStateException("Set the AERODATABOX_KEY environment variable first");
        }
        Files.createDirectories(rawDir);
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        for (int d = 0; d < 2; d++) {
            LocalDate day = day1.plusDays(d);
            String[][] windows = {{"00:00", "11:59", "0000-1159"}, {"12:00", "23:59", "1200-2359"}};
            for (String[] w : windows) {
                String url = "https://" + HOST + "/flights/airports/icao/VABB/" + day + "T" + w[0] + "/"
                        + day + "T" + w[1] + QUERY;
                HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                        .header("x-rapidapi-host", HOST)
                        .header("x-rapidapi-key", key)
                        .timeout(Duration.ofSeconds(60))
                        .GET().build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    throw new IOException("AeroDataBox returned " + response.statusCode() + " for " + day + " " + w[2]);
                }
                Path file = rawDir.resolve("vabb_" + day + "_" + w[2] + ".json");
                Files.writeString(file, response.body(), StandardCharsets.UTF_8);
                System.out.println("saved " + file.getFileName());
                Thread.sleep(1500);
            }
        }
    }

    /** Converts every raw JSON file into one CSV per day, removing duplicates between windows. */
    static void convert(Path dataDir, LocalDate day1) throws IOException {
        ObjectMapper mapper = JsonMapper.builder().build();
        Map<String, String[]> rows = new LinkedHashMap<>();
        List<Path> files;
        try (Stream<Path> s = Files.list(dataDir.resolve("raw"))) {
            files = s.filter(p -> p.toString().endsWith(".json")).sorted().toList();
        }
        for (Path file : files) {
            JsonNode root = mapper.readTree(file.toFile());
            addMovements(root.path("arrivals"), "ARR", rows);
            addMovements(root.path("departures"), "DEP", rows);
        }
        for (int d = 0; d < 2; d++) {
            LocalDate day = day1.plusDays(d);
            Path out = dataDir.resolve("flights_day" + (d + 1) + ".csv");
            int count = 0;
            try (PrintWriter w = new PrintWriter(Files.newBufferedWriter(out, StandardCharsets.UTF_8))) {
                w.println(FlightCsvLoader.HEADER);
                List<String[]> list = new ArrayList<>(rows.values());
                for (String[] r : list) {
                    if (LocalDateTime.parse(r[10]).toLocalDate().equals(day)) {
                        w.println(String.join(",", r));
                        count++;
                    }
                }
            }
            System.out.println("wrote " + out.getFileName() + " with " + count + " flights");
        }
    }

    private static void addMovements(JsonNode list, String type, Map<String, String[]> rows) {
        String side = type.equals("ARR") ? "arrival" : "departure";
        String other = type.equals("ARR") ? "departure" : "arrival";
        for (JsonNode f : list) {
            JsonNode here = f.path(side);
            JsonNode there = f.path(other).path("airport");
            String number = f.path("number").asString("").trim();
            String code = f.path("airline").path("iata").asString("");
            String airline = AIRLINE_NAMES.getOrDefault(code, f.path("airline").path("name").asString("Unknown"));
            String aircraft = f.path("aircraft").path("model").asString("");
            String scheduled = localTime(here.path("scheduledTime"));
            JsonNode revised = here.path("revisedTime");
            boolean actualMissing = revised.isMissingNode();
            String actual = actualMissing ? scheduled : localTime(revised);
            if (number.isEmpty() || scheduled == null) {
                continue;
            }
            String country = there.path("countryCode").asString("in");
            String terminal = "T" + here.path("terminal").asString("2");
            String status = f.path("status").asString("");
            String[] row = {
                number, code, clean(airline), type, clean(aircraft.isEmpty() ? "Unknown" : aircraft),
                com.gateplanner.model.SizeClass.fromAircraft(aircraft).name(),
                String.valueOf(!country.equalsIgnoreCase("in")),
                there.path("iata").asString(""), clean(there.path("name").asString("")),
                scheduled, actual, terminal, f.path("aircraft").path("reg").asString(""),
                status.equals("Canceled") ? "CANCELLED" : "OPERATED", here.path("gate").asString(""),
                String.valueOf(actualMissing)
            };
            rows.put(number + "|" + type + "|" + scheduled, row);
        }
    }

    private static String localTime(JsonNode time) {
        String local = time.path("local").asString(null);
        if (local == null || local.length() < 16) {
            return null;
        }
        return local.substring(0, 10) + "T" + local.substring(11, 16);
    }

    private static String clean(String s) {
        return s.replace(",", " ").replace("  ", " ").trim();
    }
}
