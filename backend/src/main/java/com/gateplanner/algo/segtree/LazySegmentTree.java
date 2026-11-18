package com.gateplanner.algo.segtree;

/**
 * Segment tree over minutes {@code [0, n)} with lazy range add, range maximum and range sum.
 * Each stand visit adds +1 over its interval, so a point value is the number of busy stands at
 * that minute and the range maximum is the busiest moment: the lower bound that proves the
 * planner uses the fewest stands.
 *
 * <p><b>Time:</b> O(log n) per range add or query, O(n) to build or to read every point.
 * <b>Space:</b> O(n) (4n nodes).</p>
 *
 * <p>Lazy propagation: an update that covers a whole node's range is stored at that node as a
 * pending add instead of being pushed to every leaf. It is pushed to the two children only when
 * a later operation needs to go below that node.</p>
 */
public final class LazySegmentTree {

    private final int n;
    private final long[] max;
    private final long[] sum;
    private final long[] lazy;

    public LazySegmentTree(int n) {
        if (n <= 0) {
            throw new IllegalArgumentException("Size must be positive");
        }
        this.n = n;
        this.max = new long[4 * n];
        this.sum = new long[4 * n];
        this.lazy = new long[4 * n];
    }

    public int size() {
        return n;
    }

    /** Adds {@code v} to every point in the half-open range {@code [l, r)}. */
    public void rangeAdd(int l, int r, long v) {
        check(l, r);
        add(1, 0, n - 1, l, r - 1, v);
    }

    /** Maximum over {@code [l, r)}. */
    public long rangeMax(int l, int r) {
        check(l, r);
        return queryMax(1, 0, n - 1, l, r - 1);
    }

    /** Sum over {@code [l, r)}. */
    public long rangeSum(int l, int r) {
        check(l, r);
        return querySum(1, 0, n - 1, l, r - 1);
    }

    /** Leftmost index in {@code [l, r)} holding the maximum. */
    public int argMax(int l, int r) {
        check(l, r);
        long target = rangeMax(l, r);
        return findFirst(1, 0, n - 1, l, r - 1, target);
    }

    public long pointQuery(int i) {
        return rangeMax(i, i + 1);
    }

    /** Every point value, in O(n). */
    public long[] values() {
        long[] out = new long[n];
        collect(1, 0, n - 1, out);
        return out;
    }

    private void check(int l, int r) {
        if (l < 0 || r > n || l >= r) {
            throw new IllegalArgumentException("Range [" + l + ", " + r + ") is outside [0, " + n + ")");
        }
    }

    private void apply(int node, int lo, int hi, long v) {
        max[node] += v;
        sum[node] += v * (hi - lo + 1);
        lazy[node] += v;
    }

    private void push(int node, int lo, int hi) {
        if (lazy[node] != 0) {
            int mid = (lo + hi) >>> 1;
            apply(2 * node, lo, mid, lazy[node]);
            apply(2 * node + 1, mid + 1, hi, lazy[node]);
            lazy[node] = 0;
        }
    }

    private void add(int node, int lo, int hi, int l, int r, long v) {
        if (r < lo || hi < l) {
            return;
        }
        if (l <= lo && hi <= r) {
            apply(node, lo, hi, v);
            return;
        }
        push(node, lo, hi);
        int mid = (lo + hi) >>> 1;
        add(2 * node, lo, mid, l, r, v);
        add(2 * node + 1, mid + 1, hi, l, r, v);
        max[node] = Math.max(max[2 * node], max[2 * node + 1]);
        sum[node] = sum[2 * node] + sum[2 * node + 1];
    }

    private long queryMax(int node, int lo, int hi, int l, int r) {
        if (r < lo || hi < l) {
            return Long.MIN_VALUE;
        }
        if (l <= lo && hi <= r) {
            return max[node];
        }
        push(node, lo, hi);
        int mid = (lo + hi) >>> 1;
        return Math.max(queryMax(2 * node, lo, mid, l, r), queryMax(2 * node + 1, mid + 1, hi, l, r));
    }

    private long querySum(int node, int lo, int hi, int l, int r) {
        if (r < lo || hi < l) {
            return 0;
        }
        if (l <= lo && hi <= r) {
            return sum[node];
        }
        push(node, lo, hi);
        int mid = (lo + hi) >>> 1;
        return querySum(2 * node, lo, mid, l, r) + querySum(2 * node + 1, mid + 1, hi, l, r);
    }

    private int findFirst(int node, int lo, int hi, int l, int r, long target) {
        if (r < lo || hi < l || max[node] < target) {
            return -1;
        }
        if (lo == hi) {
            return lo;
        }
        push(node, lo, hi);
        int mid = (lo + hi) >>> 1;
        int left = findFirst(2 * node, lo, mid, l, r, target);
        return left >= 0 ? left : findFirst(2 * node + 1, mid + 1, hi, l, r, target);
    }

    private void collect(int node, int lo, int hi, long[] out) {
        if (lo == hi) {
            out[lo] = max[node];
            return;
        }
        push(node, lo, hi);
        int mid = (lo + hi) >>> 1;
        collect(2 * node, lo, mid, out);
        collect(2 * node + 1, mid + 1, hi, out);
    }
}
