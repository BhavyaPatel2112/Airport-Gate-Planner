package com.gateplanner.engine;

import com.gateplanner.algo.select.MedianOfMedians;
import com.gateplanner.algo.select.RandomizedQuickselect;
import com.gateplanner.algo.sort.MergeSort;
import com.gateplanner.model.Flight;
import com.gateplanner.model.MovementType;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Real airline delay statistics from both days of Mumbai data. Percentiles come from randomized
 * Quickselect (expected O(n) per query) with a fixed seed, so the same seed always gives the same
 * buffers. Airlines with fewer than {@link #MIN_SAMPLES} flights use the all-airline figure.
 */
public final class DelayStats {

    public static final int MIN_SAMPLES = 6;
    public static final int MAX_BUFFER = 60;
    public static final long DEFAULT_SEED = 42L;

    /** One airline's delay profile in minutes. */
    public record AirlineDelay(String code, String name, int flights, double median, double p90, double atPercentile,
                               double onTimeShare) {
    }

    /** Timing of the three ways to get a percentile, for the statistics panel. */
    public record SelectionTiming(int n, double quickselectMs, long quickselectComparisons, double medianOfMediansMs,
                                  long medianOfMediansComparisons, double fullSortMs, double value) {
    }

    private final Map<String, double[]> depDelays = new LinkedHashMap<>();
    private final Map<String, double[]> arrDelays = new LinkedHashMap<>();
    private final Map<String, String> names = new HashMap<>();
    private final double[] allDep;
    private final double[] allArr;

    public DelayStats(List<Flight> flights) {
        Map<String, List<Double>> dep = new LinkedHashMap<>();
        Map<String, List<Double>> arr = new LinkedHashMap<>();
        List<Double> ad = new ArrayList<>();
        List<Double> aa = new ArrayList<>();
        for (Flight f : flights) {
            if (f.isCancelled() || f.isActualMissing()) {
                continue;
            }
            names.putIfAbsent(f.getAirlineCode(), f.getAirline());
            double d = f.getDelayMin();
            if (f.getType() == MovementType.DEP) {
                dep.computeIfAbsent(f.getAirlineCode(), k -> new ArrayList<>()).add(d);
                ad.add(d);
            } else {
                arr.computeIfAbsent(f.getAirlineCode(), k -> new ArrayList<>()).add(d);
                aa.add(d);
            }
        }
        dep.forEach((k, v) -> depDelays.put(k, toArray(v)));
        arr.forEach((k, v) -> arrDelays.put(k, toArray(v)));
        allDep = toArray(ad);
        allArr = toArray(aa);
    }

    /** Departure delay at percentile {@code p} for an airline. */
    public double departurePercentile(String airline, double p, long seed) {
        double[] v = depDelays.get(airline);
        if (v == null || v.length < MIN_SAMPLES) {
            v = allDep;
        }
        return new RandomizedQuickselect(seed).percentile(v, p);
    }

    /** Arrival delay at percentile {@code p} for an airline. */
    public double arrivalPercentile(String airline, double p, long seed) {
        double[] v = arrDelays.get(airline);
        if (v == null || v.length < MIN_SAMPLES) {
            v = allArr;
        }
        return new RandomizedQuickselect(seed).percentile(v, p);
    }

    /** Buffer for a stand visit: the airline's departure delay at the chosen percentile, 0 to 60 minutes. */
    public int bufferFor(String airline, double p) {
        double d = departurePercentile(airline, p, DEFAULT_SEED);
        return (int) Math.max(0, Math.min(MAX_BUFFER, Math.round(d)));
    }

    /** Per-airline buffers for every airline in the data. */
    public Map<String, Integer> buffers(double p) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String code : names.keySet()) {
            out.put(code, bufferFor(code, p));
        }
        return out;
    }

    /**
     * Leaderboard of airlines with at least {@link #MIN_SAMPLES} departures, worst delay at the
     * chosen percentile first (sorted with our merge sort).
     */
    public List<AirlineDelay> leaderboard(double p, long seed) {
        List<AirlineDelay> rows = new ArrayList<>();
        for (Map.Entry<String, double[]> e : depDelays.entrySet()) {
            double[] v = e.getValue();
            if (v.length < MIN_SAMPLES) {
                continue;
            }
            RandomizedQuickselect q = new RandomizedQuickselect(seed);
            int onTime = 0;
            for (double d : v) {
                if (d <= 15) {
                    onTime++;
                }
            }
            rows.add(new AirlineDelay(e.getKey(), names.get(e.getKey()), v.length, q.percentile(v, 50),
                    q.percentile(v, 90), q.percentile(v, p), Math.round(1000.0 * onTime / v.length) / 10.0));
        }
        return MergeSort.sort(rows, (a, b) -> Double.compare(b.atPercentile(), a.atPercentile()));
    }

    /** Compares Quickselect, median-of-medians and a full merge sort on all departure delays. */
    public SelectionTiming timing(double p, long seed) {
        double[] v = allDep;
        int k = RandomizedQuickselect.rankFor(v.length, p);
        long t0 = System.nanoTime();
        RandomizedQuickselect q = new RandomizedQuickselect(seed);
        double value = q.select(v, k);
        double qs = TraceRecorder.since(t0);
        t0 = System.nanoTime();
        MedianOfMedians m = new MedianOfMedians();
        m.select(v, k);
        double mm = TraceRecorder.since(t0);
        t0 = System.nanoTime();
        List<Double> boxed = new ArrayList<>();
        for (double d : v) {
            boxed.add(d);
        }
        MergeSort.sort(boxed, Double::compare);
        double fs = TraceRecorder.since(t0);
        return new SelectionTiming(v.length, qs, q.comparisons(), mm, m.comparisons(), fs, value);
    }

    public double[] allDepartureDelays() {
        return allDep.clone();
    }

    public String airlineName(String code) {
        return names.getOrDefault(code, code);
    }

    public List<String> airlines() {
        return new ArrayList<>(names.keySet());
    }

    /**
     * Writes the airline delay table to {@code data/delay_stats.csv}. Run from the backend folder:
     * {@code ./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.engine.DelayStats}
     */
    public static void main(String[] args) throws java.io.IOException {
        String dataDir = args.length > 0 ? args[0] : "../data";
        List<Flight> all = new ArrayList<>();
        java.time.LocalDate day1 = java.time.LocalDate.of(2026, 11, 16);
        for (int d = 0; d < 2; d++) {
            java.nio.file.Path csv = java.nio.file.Path.of(dataDir, "flights_day" + (d + 1) + ".csv");
            all.addAll(com.gateplanner.data.FlightCsvLoader.load(java.nio.file.Files.newBufferedReader(csv),
                    day1.plusDays(d)).flights());
        }
        DelayStats stats = new DelayStats(all);
        java.nio.file.Path out = java.nio.file.Path.of(dataDir, "delay_stats.csv");
        try (java.io.PrintWriter w = new java.io.PrintWriter(java.nio.file.Files.newBufferedWriter(out))) {
            w.println("airline_code,airline,departures,median_delay_min,p90_delay_min,on_time_pct,buffer_p75_min");
            for (AirlineDelay a : stats.leaderboard(90, DEFAULT_SEED)) {
                w.println(a.code() + "," + a.name() + "," + a.flights() + "," + a.median() + "," + a.p90() + ","
                        + a.onTimeShare() + "," + stats.bufferFor(a.code(), 75));
            }
        }
        System.out.println("wrote " + out);
    }

    private static double[] toArray(List<Double> list) {
        double[] a = new double[list.size()];
        for (int i = 0; i < a.length; i++) {
            a[i] = list.get(i);
        }
        return a;
    }
}
