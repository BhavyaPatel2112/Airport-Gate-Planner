package com.gateplanner.engine;

import com.gateplanner.algo.heap.FibonacciHeap;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.List;

/**
 * Arrivals waiting for a stand, ordered by arrival time on a Fibonacci heap: the earliest
 * arrival is always served first. Insert O(1), next O(log n) amortised.
 */
public final class HoldingStack {

    private final FibonacciHeap<Turnaround> heap = new FibonacciHeap<>();

    public void push(Turnaround t) {
        heap.insert(t.getStart(), t);
    }

    public boolean isEmpty() {
        return heap.isEmpty();
    }

    public int size() {
        return heap.size();
    }

    public Turnaround pop() {
        return heap.extractMin().value();
    }

    /** Empties the stack in priority order. */
    public List<Turnaround> drainInOrder() {
        List<Turnaround> out = new ArrayList<>(heap.size());
        while (!heap.isEmpty()) {
            out.add(heap.extractMin().value());
        }
        return out;
    }

    public List<FibonacciHeap.TreeView> snapshot() {
        return heap.snapshot(Turnaround::getLabel);
    }
}
