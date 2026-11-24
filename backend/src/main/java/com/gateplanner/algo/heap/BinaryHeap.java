package com.gateplanner.algo.heap;

import java.util.ArrayList;
import java.util.List;

/**
 * Array-based binary min-heap with handles, our own implementation. Baseline for the Fibonacci
 * heap on decrease-key heavy workloads.
 *
 * <p><b>Time:</b> insert, extract-min and decrease-key O(log n); find-min O(1).
 * <b>Space:</b> O(n).</p>
 *
 * @param <T> value stored with each key
 */
public final class BinaryHeap<T> {

    /** A heap entry; its position is tracked so decrease-key can find it. */
    public static final class Node<T> {
        private long key;
        private final long seq;
        private final T value;
        private int index;

        private Node(long key, long seq, T value) {
            this.key = key;
            this.seq = seq;
            this.value = value;
        }

        public long key() { return key; }
        public T value() { return value; }
        public boolean inHeap() { return index >= 0; }
    }

    private final List<Node<T>> heap = new ArrayList<>();
    private long seqCounter;
    private long swaps;

    public int size() {
        return heap.size();
    }

    public boolean isEmpty() {
        return heap.isEmpty();
    }

    public long swaps() {
        return swaps;
    }

    public Node<T> insert(long key, T value) {
        Node<T> x = new Node<>(key, seqCounter++, value);
        x.index = heap.size();
        heap.add(x);
        siftUp(x.index);
        return x;
    }

    public Node<T> minimum() {
        return heap.isEmpty() ? null : heap.get(0);
    }

    public Node<T> extractMin() {
        if (heap.isEmpty()) {
            throw new IllegalStateException("Heap is empty");
        }
        Node<T> top = heap.get(0);
        Node<T> last = heap.remove(heap.size() - 1);
        if (!heap.isEmpty()) {
            heap.set(0, last);
            last.index = 0;
            siftDown(0);
        }
        top.index = -1;
        return top;
    }

    public void decreaseKey(Node<T> x, long newKey) {
        if (x.index < 0) {
            throw new IllegalArgumentException("Node is no longer in the heap");
        }
        if (newKey > x.key) {
            throw new IllegalArgumentException("New key is larger than current key");
        }
        x.key = newKey;
        siftUp(x.index);
    }

    private boolean less(Node<T> a, Node<T> b) {
        return a.key < b.key || (a.key == b.key && a.seq < b.seq);
    }

    private void siftUp(int i) {
        while (i > 0) {
            int p = (i - 1) / 2;
            if (!less(heap.get(i), heap.get(p))) {
                return;
            }
            swap(i, p);
            i = p;
        }
    }

    private void siftDown(int i) {
        int n = heap.size();
        while (true) {
            int l = 2 * i + 1;
            int r = l + 1;
            int m = i;
            if (l < n && less(heap.get(l), heap.get(m))) {
                m = l;
            }
            if (r < n && less(heap.get(r), heap.get(m))) {
                m = r;
            }
            if (m == i) {
                return;
            }
            swap(i, m);
            i = m;
        }
    }

    private void swap(int i, int j) {
        Node<T> a = heap.get(i);
        Node<T> b = heap.get(j);
        heap.set(i, b);
        heap.set(j, a);
        a.index = j;
        b.index = i;
        swaps++;
    }
}
