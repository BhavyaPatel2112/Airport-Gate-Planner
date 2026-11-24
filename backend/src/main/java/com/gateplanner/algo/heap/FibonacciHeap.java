package com.gateplanner.algo.heap;

import java.util.ArrayList;
import java.util.List;

/**
 * Fibonacci heap (min-heap) with handles, used for stand availability ("which stand frees up
 * first?"), the holding stack of arrivals waiting for a stand, and the departures board.
 *
 * <p>Ties on equal keys are broken by insertion order, so results are deterministic.</p>
 *
 * <p><b>Time (amortised):</b> insert O(1), find-min O(1), merge O(1), decrease-key O(1),
 * extract-min O(log n), delete O(log n). <b>Space:</b> O(n).</p>
 *
 * <p>Why decrease-key is O(1) amortised: the node is cut and moved to the root list; its parent is
 * marked, and a parent that loses a second child is cut too (cascading cut). The potential
 * (roots + 2 x marked nodes) pays for the cascade. The marks also keep every subtree of degree k
 * at least F(k+2) nodes big, which bounds the degree by log base phi of n.</p>
 *
 * @param <T> value stored with each key
 */
public final class FibonacciHeap<T> {

    /** A heap entry. Keep it to call {@link #decreaseKey} or {@link #delete}. */
    public static final class Node<T> {
        private long key;
        private final long seq;
        private final T value;
        private int degree;
        private boolean mark;
        private Node<T> parent;
        private Node<T> child;
        private Node<T> left = this;
        private Node<T> right = this;
        private boolean removed;

        private Node(long key, long seq, T value) {
            this.key = key;
            this.seq = seq;
            this.value = value;
        }

        public long key() { return key; }
        public T value() { return value; }
        public boolean isMarked() { return mark; }
        public int degree() { return degree; }
        public boolean inHeap() { return !removed; }
    }

    /** A tree of the heap for the machine view. */
    public record TreeView(String label, long key, boolean marked, List<TreeView> children) {
    }

    private Node<T> min;
    private int size;
    private long seqCounter;
    private int links;
    private int cuts;
    private int cascadingCuts;
    private final List<String> events = new ArrayList<>();

    public int size() {
        return size;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    public Node<T> insert(long key, T value) {
        Node<T> x = new Node<>(key, seqCounter++, value);
        addToRootList(x);
        size++;
        return x;
    }

    public Node<T> minimum() {
        return min;
    }

    /** Moves every node of {@code other} into this heap in O(1). {@code other} becomes empty. */
    public void merge(FibonacciHeap<T> other) {
        if (other == null || other.min == null) {
            return;
        }
        if (min == null) {
            min = other.min;
        } else {
            Node<T> a = min.right;
            Node<T> b = other.min.left;
            min.right = other.min;
            other.min.left = min;
            a.left = b;
            b.right = a;
            if (less(other.min, min)) {
                min = other.min;
            }
        }
        size += other.size;
        other.min = null;
        other.size = 0;
    }

    /**
     * Removes and returns the minimum node.
     *
     * @throws IllegalStateException when the heap is empty
     */
    public Node<T> extractMin() {
        Node<T> z = min;
        if (z == null) {
            throw new IllegalStateException("Heap is empty");
        }
        if (z.child != null) {
            List<Node<T>> kids = siblings(z.child);
            for (Node<T> c : kids) {
                c.parent = null;
                c.mark = false;
                spliceIntoRoots(c);
            }
            z.child = null;
        }
        z.left.right = z.right;
        z.right.left = z.left;
        if (z == z.right) {
            min = null;
        } else {
            min = z.right;
            consolidate();
        }
        size--;
        z.removed = true;
        z.left = z;
        z.right = z;
        return z;
    }

    /**
     * Lowers a node's key in O(1) amortised.
     *
     * @throws IllegalArgumentException if the new key is larger than the current key
     */
    public void decreaseKey(Node<T> x, long newKey) {
        if (x.removed) {
            throw new IllegalArgumentException("Node is no longer in the heap");
        }
        if (newKey > x.key) {
            throw new IllegalArgumentException("New key " + newKey + " is larger than current key " + x.key);
        }
        events.add("decrease-key " + label(x) + " " + x.key + " to " + newKey);
        x.key = newKey;
        Node<T> y = x.parent;
        if (y != null && less(x, y)) {
            cut(x, y);
            cascadingCut(y);
        }
        if (less(x, min)) {
            min = x;
        }
    }

    /** Removes an arbitrary node in O(log n) amortised. */
    public void delete(Node<T> x) {
        if (x.removed) {
            throw new IllegalArgumentException("Node is no longer in the heap");
        }
        x.key = Long.MIN_VALUE;
        Node<T> y = x.parent;
        if (y != null) {
            cut(x, y);
            cascadingCut(y);
        }
        min = x;
        extractMin();
    }

    public int links() { return links; }
    public int cuts() { return cuts; }
    public int cascadingCuts() { return cascadingCuts; }

    /** Structural events (links, cuts, cascading cuts) since the last call, then clears them. */
    public List<String> drainEvents() {
        List<String> out = new ArrayList<>(events);
        events.clear();
        return out;
    }

    /** Number of trees in the root list. */
    public int rootCount() {
        return min == null ? 0 : siblings(min).size();
    }

    /** Snapshot of the root list (each root with its subtree) for the machine view. */
    public List<TreeView> snapshot(java.util.function.Function<T, String> label) {
        List<TreeView> out = new ArrayList<>();
        if (min == null) {
            return out;
        }
        for (Node<T> r : siblings(min)) {
            out.add(view(r, label));
        }
        return out;
    }

    // ----- internals -----

    private TreeView view(Node<T> x, java.util.function.Function<T, String> label) {
        List<TreeView> kids = new ArrayList<>();
        if (x.child != null) {
            for (Node<T> c : siblings(x.child)) {
                kids.add(view(c, label));
            }
        }
        return new TreeView(label.apply(x.value), x.key, x.mark, kids);
    }

    private boolean less(Node<T> a, Node<T> b) {
        return a.key < b.key || (a.key == b.key && a.seq < b.seq);
    }

    private void addToRootList(Node<T> x) {
        x.parent = null;
        x.left = x;
        x.right = x;
        if (min == null) {
            min = x;
        } else {
            spliceIntoRoots(x);
            if (less(x, min)) {
                min = x;
            }
        }
    }

    private void spliceIntoRoots(Node<T> x) {
        x.left = min;
        x.right = min.right;
        min.right.left = x;
        min.right = x;
    }

    private List<Node<T>> siblings(Node<T> start) {
        List<Node<T>> out = new ArrayList<>();
        Node<T> x = start;
        do {
            out.add(x);
            x = x.right;
        } while (x != start);
        return out;
    }

    private void consolidate() {
        int maxDegree = (int) Math.floor(Math.log(Math.max(size, 1)) / Math.log((1 + Math.sqrt(5)) / 2)) + 2;
        @SuppressWarnings("unchecked")
        Node<T>[] byDegree = (Node<T>[]) new Node[maxDegree + 1];
        for (Node<T> w : siblings(min)) {
            Node<T> x = w;
            int d = x.degree;
            while (d < byDegree.length && byDegree[d] != null) {
                Node<T> y = byDegree[d];
                if (less(y, x)) {
                    Node<T> t = x;
                    x = y;
                    y = t;
                }
                link(y, x);
                byDegree[d] = null;
                d++;
            }
            if (d >= byDegree.length) {
                Node<T>[] bigger = java.util.Arrays.copyOf(byDegree, d + 2);
                byDegree = bigger;
            }
            byDegree[d] = x;
        }
        min = null;
        for (Node<T> x : byDegree) {
            if (x != null) {
                x.left = x;
                x.right = x;
                if (min == null) {
                    min = x;
                } else {
                    spliceIntoRoots(x);
                    if (less(x, min)) {
                        min = x;
                    }
                }
            }
        }
    }

    /** Makes root {@code y} a child of root {@code x}. */
    private void link(Node<T> y, Node<T> x) {
        y.left.right = y.right;
        y.right.left = y.left;
        y.parent = x;
        if (x.child == null) {
            x.child = y;
            y.left = y;
            y.right = y;
        } else {
            y.left = x.child;
            y.right = x.child.right;
            x.child.right.left = y;
            x.child.right = y;
        }
        x.degree++;
        y.mark = false;
        links++;
    }

    private void cut(Node<T> x, Node<T> y) {
        if (x.right == x) {
            y.child = null;
        } else {
            x.left.right = x.right;
            x.right.left = x.left;
            if (y.child == x) {
                y.child = x.right;
            }
        }
        y.degree--;
        x.parent = null;
        x.mark = false;
        x.left = x;
        x.right = x;
        spliceIntoRoots(x);
        cuts++;
        events.add("cut " + label(x) + " from " + label(y));
    }

    private void cascadingCut(Node<T> y) {
        Node<T> z = y.parent;
        if (z != null) {
            if (!y.mark) {
                y.mark = true;
                events.add("mark " + label(y));
            } else {
                cascadingCuts++;
                events.add("cascading cut " + label(y));
                cut(y, z);
                cascadingCut(z);
            }
        }
    }

    private String label(Node<T> x) {
        return String.valueOf(x.value);
    }
}
