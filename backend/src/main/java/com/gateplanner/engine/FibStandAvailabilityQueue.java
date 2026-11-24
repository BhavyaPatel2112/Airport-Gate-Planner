package com.gateplanner.engine;

import com.gateplanner.algo.heap.FibonacciHeap;
import com.gateplanner.model.Stand;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Stand availability queue on our Fibonacci heap. Peek is O(1), poll is O(log n) amortised and
 * moving a stand's free time earlier is O(1) amortised (decrease-key), which matters because
 * cancellations and early departures happen far more often than a full replan.
 */
public final class FibStandAvailabilityQueue implements StandAvailabilityQueue {

    private final FibonacciHeap<Stand> heap = new FibonacciHeap<>();
    private final Map<String, FibonacciHeap.Node<Stand>> nodes = new HashMap<>();
    private int decreaseKeys;

    @Override
    public void add(Stand stand, int freeAt) {
        if (nodes.containsKey(stand.getId())) {
            throw new IllegalArgumentException("Stand " + stand.getId() + " is already queued");
        }
        nodes.put(stand.getId(), heap.insert(freeAt, stand));
    }

    @Override
    public boolean isEmpty() {
        return heap.isEmpty();
    }

    @Override
    public int size() {
        return heap.size();
    }

    @Override
    public Stand peek() {
        return heap.isEmpty() ? null : heap.minimum().value();
    }

    @Override
    public int peekFreeAt() {
        if (heap.isEmpty()) {
            throw new IllegalStateException("No stand queued");
        }
        return (int) heap.minimum().key();
    }

    @Override
    public Stand poll() {
        Stand s = heap.extractMin().value();
        nodes.remove(s.getId());
        return s;
    }

    @Override
    public boolean contains(String standId) {
        return nodes.containsKey(standId);
    }

    @Override
    public int freeAt(String standId) {
        FibonacciHeap.Node<Stand> n = nodes.get(standId);
        if (n == null) {
            throw new IllegalArgumentException("Stand " + standId + " is not queued");
        }
        return (int) n.key();
    }

    @Override
    public void update(Stand stand, int freeAt) {
        FibonacciHeap.Node<Stand> n = nodes.get(stand.getId());
        if (n == null) {
            add(stand, freeAt);
            return;
        }
        if (freeAt <= n.key()) {
            heap.decreaseKey(n, freeAt);
            decreaseKeys++;
        } else {
            heap.delete(n);
            nodes.put(stand.getId(), heap.insert(freeAt, stand));
        }
    }

    @Override
    public int decreaseKeys() {
        return decreaseKeys;
    }

    @Override
    public List<String> drainEvents() {
        return heap.drainEvents();
    }

    /** Snapshot of the heap's root list for the machine view. */
    public List<FibonacciHeap.TreeView> snapshot() {
        return heap.snapshot(Stand::getId);
    }

    public int rootCount() {
        return heap.rootCount();
    }

    public FibonacciHeap<Stand> heap() {
        return heap;
    }
}
