package com.gateplanner.algo.interval;

import java.util.ArrayList;
import java.util.List;

/**
 * Red-black interval tree (CLRS chapter 14 augmentation of a red-black tree). One tree per stand
 * stores the stand's occupied intervals; each node also stores {@code maxEnd}, the largest end
 * point in its subtree, so a query can skip every subtree that cannot overlap.
 *
 * <p>Intervals are half-open {@code [start, end)}: a visit ending at 14:00 does not clash with one
 * starting at 14:00. Nodes are ordered by start, then end, then insertion order, so equal intervals
 * are allowed.</p>
 *
 * <p><b>Time:</b> insert and delete O(log n); "is anything overlapping?" O(log n); "list every
 * overlap" O(log n + k) for k results; in-order walk O(n).
 * <b>Space:</b> O(n).</p>
 *
 * <p><b>Height bound:</b> every root to leaf path has the same number of black nodes and no red
 * node has a red child, so the longest path is at most twice the shortest: height &lt;= 2 log2(n+1).</p>
 *
 * @param <V> value stored with each interval (for example a stand visit id)
 */
public final class RedBlackIntervalTree<V> {

    private static final boolean RED = true;
    private static final boolean BLACK = false;

    /** A tree node. Callers keep it as a handle for {@link #delete(Node)}. */
    public static final class Node<V> {
        private int start;
        private int end;
        private int maxEnd;
        private boolean color;
        private Node<V> left;
        private Node<V> right;
        private Node<V> parent;
        private V value;
        private long seq;
        private int id;

        public int start() { return start; }
        public int end() { return end; }
        public int maxEnd() { return maxEnd; }
        public V value() { return value; }
        public boolean isRed() { return color == RED; }
        public int id() { return id; }
    }

    /** Plain description of one node for the machine view. Child ids are -1 for empty. */
    public record NodeView(int id, int start, int end, int maxEnd, String color, int left, int right, String label) {
    }

    private final Node<V> nil;
    private Node<V> root;
    private int size;
    private long seqCounter;
    private int idCounter;
    private int rotations;
    private final List<String> lastOps = new ArrayList<>();

    public RedBlackIntervalTree() {
        nil = new Node<>();
        nil.color = BLACK;
        nil.maxEnd = Integer.MIN_VALUE;
        nil.id = -1;
        nil.left = nil;
        nil.right = nil;
        nil.parent = nil;
        root = nil;
    }

    public int size() {
        return size;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    /** Total rotations since the tree was created (for the X-ray). */
    public int rotations() {
        return rotations;
    }

    /** Rotations and recolourings done by the most recent insert or delete, for animation. */
    public List<String> lastOperations() {
        return new ArrayList<>(lastOps);
    }

    /** Inserts {@code [start, end)} and returns the node handle. */
    public Node<V> insert(int start, int end, V value) {
        if (end <= start) {
            throw new IllegalArgumentException("Interval end must be after start: [" + start + ", " + end + ")");
        }
        lastOps.clear();
        Node<V> z = new Node<>();
        z.start = start;
        z.end = end;
        z.maxEnd = end;
        z.value = value;
        z.seq = seqCounter++;
        z.id = idCounter++;
        z.color = RED;
        z.left = nil;
        z.right = nil;
        Node<V> y = nil;
        Node<V> x = root;
        while (x != nil) {
            y = x;
            x = less(z, x) ? x.left : x.right;
        }
        z.parent = y;
        if (y == nil) {
            root = z;
        } else if (less(z, y)) {
            y.left = z;
        } else {
            y.right = z;
        }
        updateUp(z);
        insertFixup(z);
        size++;
        return z;
    }

    /** Removes a node previously returned by {@link #insert}. */
    public void delete(Node<V> z) {
        if (z == null || z == nil) {
            throw new IllegalArgumentException("Unknown node");
        }
        lastOps.clear();
        Node<V> y = z;
        boolean yOriginalColor = y.color;
        Node<V> x;
        if (z.left == nil) {
            x = z.right;
            transplant(z, z.right);
        } else if (z.right == nil) {
            x = z.left;
            transplant(z, z.left);
        } else {
            y = minimum(z.right);
            yOriginalColor = y.color;
            x = y.right;
            if (y.parent == z) {
                x.parent = y;
            } else {
                transplant(y, y.right);
                y.right = z.right;
                y.right.parent = y;
            }
            transplant(z, y);
            y.left = z.left;
            y.left.parent = y;
            y.color = z.color;
        }
        updateUp(x.parent);
        if (yOriginalColor == BLACK) {
            deleteFixup(x);
        }
        nil.parent = nil;
        size--;
    }

    /** True when some stored interval overlaps {@code [qs, qe)}. O(log n). */
    public boolean anyOverlap(int qs, int qe) {
        Node<V> x = root;
        while (x != nil) {
            if (x.start < qe && qs < x.end) {
                return true;
            }
            if (x.left != nil && x.left.maxEnd > qs) {
                x = x.left;
            } else {
                x = x.right;
            }
        }
        return false;
    }

    /** Every stored interval overlapping {@code [qs, qe)}, in start order. O(log n + k). */
    public List<Node<V>> overlaps(int qs, int qe) {
        List<Node<V>> out = new ArrayList<>();
        collect(root, qs, qe, out);
        return out;
    }

    /** All nodes in start order. */
    public List<Node<V>> inOrder() {
        List<Node<V>> out = new ArrayList<>(size);
        inOrder(root, out);
        return out;
    }

    /** Height of the tree (0 for empty). */
    public int height() {
        return height(root);
    }

    /**
     * Checks every invariant: binary search order, red nodes have black children, equal black
     * heights, black root and correct {@code maxEnd}. Returns the black height.
     *
     * @throws IllegalStateException when an invariant is broken
     */
    public int validate() {
        if (root.color != BLACK) {
            throw new IllegalStateException("Root must be black");
        }
        return check(root);
    }

    /** Snapshot of the whole tree for the machine view. */
    public List<NodeView> snapshot(java.util.function.Function<V, String> label) {
        List<NodeView> out = new ArrayList<>();
        for (Node<V> n : inOrder()) {
            out.add(new NodeView(n.id, n.start, n.end, n.maxEnd, n.color == RED ? "RED" : "BLACK",
                    n.left == nil ? -1 : n.left.id, n.right == nil ? -1 : n.right.id, label.apply(n.value)));
        }
        return out;
    }

    public int rootId() {
        return root == nil ? -1 : root.id;
    }

    // ----- internals -----

    private boolean less(Node<V> a, Node<V> b) {
        if (a.start != b.start) {
            return a.start < b.start;
        }
        if (a.end != b.end) {
            return a.end < b.end;
        }
        return a.seq < b.seq;
    }

    private void update(Node<V> n) {
        int m = n.end;
        if (n.left.maxEnd > m) {
            m = n.left.maxEnd;
        }
        if (n.right.maxEnd > m) {
            m = n.right.maxEnd;
        }
        n.maxEnd = m;
    }

    private void updateUp(Node<V> n) {
        while (n != nil) {
            update(n);
            n = n.parent;
        }
    }

    private void leftRotate(Node<V> x) {
        Node<V> y = x.right;
        x.right = y.left;
        if (y.left != nil) {
            y.left.parent = x;
        }
        y.parent = x.parent;
        if (x.parent == nil) {
            root = y;
        } else if (x == x.parent.left) {
            x.parent.left = y;
        } else {
            x.parent.right = y;
        }
        y.left = x;
        x.parent = y;
        update(x);
        update(y);
        rotations++;
        lastOps.add("left rotation at [" + x.start + ", " + x.end + ")");
    }

    private void rightRotate(Node<V> x) {
        Node<V> y = x.left;
        x.left = y.right;
        if (y.right != nil) {
            y.right.parent = x;
        }
        y.parent = x.parent;
        if (x.parent == nil) {
            root = y;
        } else if (x == x.parent.right) {
            x.parent.right = y;
        } else {
            x.parent.left = y;
        }
        y.right = x;
        x.parent = y;
        update(x);
        update(y);
        rotations++;
        lastOps.add("right rotation at [" + x.start + ", " + x.end + ")");
    }

    private void insertFixup(Node<V> z) {
        while (z.parent.color == RED) {
            if (z.parent == z.parent.parent.left) {
                Node<V> y = z.parent.parent.right;
                if (y.color == RED) {
                    z.parent.color = BLACK;
                    y.color = BLACK;
                    z.parent.parent.color = RED;
                    lastOps.add("recolour (uncle red)");
                    z = z.parent.parent;
                } else {
                    if (z == z.parent.right) {
                        z = z.parent;
                        leftRotate(z);
                    }
                    z.parent.color = BLACK;
                    z.parent.parent.color = RED;
                    rightRotate(z.parent.parent);
                }
            } else {
                Node<V> y = z.parent.parent.left;
                if (y.color == RED) {
                    z.parent.color = BLACK;
                    y.color = BLACK;
                    z.parent.parent.color = RED;
                    lastOps.add("recolour (uncle red)");
                    z = z.parent.parent;
                } else {
                    if (z == z.parent.left) {
                        z = z.parent;
                        rightRotate(z);
                    }
                    z.parent.color = BLACK;
                    z.parent.parent.color = RED;
                    leftRotate(z.parent.parent);
                }
            }
        }
        root.color = BLACK;
    }

    private void transplant(Node<V> u, Node<V> v) {
        if (u.parent == nil) {
            root = v;
        } else if (u == u.parent.left) {
            u.parent.left = v;
        } else {
            u.parent.right = v;
        }
        v.parent = u.parent;
    }

    private Node<V> minimum(Node<V> x) {
        while (x.left != nil) {
            x = x.left;
        }
        return x;
    }

    private void deleteFixup(Node<V> x) {
        while (x != root && x.color == BLACK) {
            if (x == x.parent.left) {
                Node<V> w = x.parent.right;
                if (w.color == RED) {
                    w.color = BLACK;
                    x.parent.color = RED;
                    leftRotate(x.parent);
                    w = x.parent.right;
                }
                if (w.left.color == BLACK && w.right.color == BLACK) {
                    w.color = RED;
                    x = x.parent;
                } else {
                    if (w.right.color == BLACK) {
                        w.left.color = BLACK;
                        w.color = RED;
                        rightRotate(w);
                        w = x.parent.right;
                    }
                    w.color = x.parent.color;
                    x.parent.color = BLACK;
                    w.right.color = BLACK;
                    leftRotate(x.parent);
                    x = root;
                }
            } else {
                Node<V> w = x.parent.left;
                if (w.color == RED) {
                    w.color = BLACK;
                    x.parent.color = RED;
                    rightRotate(x.parent);
                    w = x.parent.left;
                }
                if (w.right.color == BLACK && w.left.color == BLACK) {
                    w.color = RED;
                    x = x.parent;
                } else {
                    if (w.left.color == BLACK) {
                        w.right.color = BLACK;
                        w.color = RED;
                        leftRotate(w);
                        w = x.parent.left;
                    }
                    w.color = x.parent.color;
                    x.parent.color = BLACK;
                    w.left.color = BLACK;
                    rightRotate(x.parent);
                    x = root;
                }
            }
        }
        x.color = BLACK;
    }

    private void collect(Node<V> x, int qs, int qe, List<Node<V>> out) {
        if (x == nil || x.maxEnd <= qs) {
            return;
        }
        collect(x.left, qs, qe, out);
        if (x.start < qe && qs < x.end) {
            out.add(x);
        }
        if (x.start < qe) {
            collect(x.right, qs, qe, out);
        }
    }

    private void inOrder(Node<V> x, List<Node<V>> out) {
        if (x == nil) {
            return;
        }
        inOrder(x.left, out);
        out.add(x);
        inOrder(x.right, out);
    }

    private int height(Node<V> x) {
        if (x == nil) {
            return 0;
        }
        return 1 + Math.max(height(x.left), height(x.right));
    }

    private int check(Node<V> x) {
        if (x == nil) {
            return 1;
        }
        if (x.left != nil && (less(x, x.left) || x.left.parent != x)) {
            throw new IllegalStateException("Search order broken at [" + x.start + ", " + x.end + ")");
        }
        if (x.right != nil && (less(x.right, x) || x.right.parent != x)) {
            throw new IllegalStateException("Search order broken at [" + x.start + ", " + x.end + ")");
        }
        if (x.color == RED && (x.left.color == RED || x.right.color == RED)) {
            throw new IllegalStateException("Red node with a red child at [" + x.start + ", " + x.end + ")");
        }
        int expected = Math.max(x.end, Math.max(x.left.maxEnd, x.right.maxEnd));
        if (x.maxEnd != expected) {
            throw new IllegalStateException("maxEnd is stale at [" + x.start + ", " + x.end + ")");
        }
        int lh = check(x.left);
        int rh = check(x.right);
        if (lh != rh) {
            throw new IllegalStateException("Black heights differ at [" + x.start + ", " + x.end + ")");
        }
        return lh + (x.color == BLACK ? 1 : 0);
    }
}
