package com.gateplanner.engine;

import com.gateplanner.model.Stand;

import java.util.List;

/**
 * Priority queue of stands keyed by the minute each stand becomes free. The planner asks for the
 * stand that frees earliest; cancellations and early departures lower a key (decrease-key).
 * Implemented by {@link FibStandAvailabilityQueue} on a Fibonacci heap.
 */
public interface StandAvailabilityQueue {

    /** Adds a stand that becomes free at {@code freeAt}. */
    void add(Stand stand, int freeAt);

    /** True when no stand is queued. */
    boolean isEmpty();

    int size();

    /** The stand that frees earliest, without removing it, or null. */
    Stand peek();

    /** Minute at which {@link #peek()} becomes free. */
    int peekFreeAt();

    /** Removes and returns the stand that frees earliest. */
    Stand poll();

    /** True when the stand is queued. */
    boolean contains(String standId);

    /** Current key of a queued stand. */
    int freeAt(String standId);

    /** Changes a queued stand's free time; lowering it is a decrease-key. */
    void update(Stand stand, int freeAt);

    /** Number of decrease-key operations so far. */
    int decreaseKeys();

    /** Structural events since the last call (links, cuts, marks), for the machine view. */
    List<String> drainEvents();
}
