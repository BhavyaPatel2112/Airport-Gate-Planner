package com.gateplanner.model;

/**
 * One step of the Algorithm X-ray: which algorithm ran, on how much input, how long it took,
 * its complexity and a one-line proof or explanation of why the result is correct.
 */
public record TraceEntry(String algorithm, int unit, String operation, int inputSize, double timeMs,
                         String complexity, String proof) {
}
