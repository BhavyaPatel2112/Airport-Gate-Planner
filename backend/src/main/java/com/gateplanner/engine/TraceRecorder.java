package com.gateplanner.engine;

import com.gateplanner.model.TraceEntry;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/** Collects Algorithm X-ray entries for one request. */
public final class TraceRecorder {

    private final List<TraceEntry> entries = new ArrayList<>();

    public void add(String algorithm, int unit, String operation, int inputSize, double timeMs, String complexity,
                    String proof) {
        entries.add(new TraceEntry(algorithm, unit, operation, inputSize, round(timeMs), complexity, proof));
    }

    /** Runs {@code work}, records how long it took and returns its result. */
    public <T> T time(String algorithm, int unit, String operation, int inputSize, String complexity, String proof,
                      Supplier<T> work) {
        long t0 = System.nanoTime();
        T result = work.get();
        add(algorithm, unit, operation, inputSize, (System.nanoTime() - t0) / 1e6, complexity, proof);
        return result;
    }

    public List<TraceEntry> entries() {
        return new ArrayList<>(entries);
    }

    public static double round(double ms) {
        return Math.round(ms * 1000.0) / 1000.0;
    }

    public static double since(long t0) {
        return round((System.nanoTime() - t0) / 1e6);
    }
}
