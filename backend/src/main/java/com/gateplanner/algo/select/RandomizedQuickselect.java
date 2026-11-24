package com.gateplanner.algo.select;

import java.util.Random;

/**
 * Randomized Quickselect: finds the k-th smallest value without sorting. A random pivot splits the
 * values into smaller, equal and larger parts (three-way partition, so many equal delays are
 * fine) and the search continues only in the part that holds position k. This is the mandatory
 * randomized algorithm (Course Outcome 5): it computes every airline's delay percentile for buffers,
 * storm severity and statistics.
 *
 * <p><b>Time:</b> expected O(n) for any input, because a random pivot lands in the middle half
 * with probability 1/2, shrinking the range by a quarter, so the expected total work is a geometric
 * series, at most about 4n comparisons. Worst case O(n^2) with tiny probability.
 * <b>Space:</b> O(n) for the working copy; the loop itself uses O(1) extra.</p>
 *
 * <p>A fixed seed gives the same pivots and therefore identical results and comparison counts.</p>
 */
public final class RandomizedQuickselect {

    private final Random random;
    private long comparisons;

    public RandomizedQuickselect(long seed) {
        this.random = new Random(seed);
    }

    public long comparisons() {
        return comparisons;
    }

    /**
     * Returns the k-th smallest value (k = 0 is the minimum). The input array is not changed.
     *
     * @throws IllegalArgumentException when the array is empty or k is out of range
     */
    public double select(double[] values, int k) {
        if (values.length == 0) {
            throw new IllegalArgumentException("Cannot select from an empty list");
        }
        if (k < 0 || k >= values.length) {
            throw new IllegalArgumentException("k = " + k + " is outside 0.." + (values.length - 1));
        }
        double[] a = values.clone();
        int lo = 0;
        int hi = a.length - 1;
        while (true) {
            if (lo == hi) {
                return a[lo];
            }
            double pivot = a[lo + random.nextInt(hi - lo + 1)];
            // three-way partition: [lo, lt) < pivot, [lt, i) == pivot, (gt, hi] > pivot
            int lt = lo;
            int gt = hi;
            int i = lo;
            while (i <= gt) {
                comparisons++;
                if (a[i] < pivot) {
                    swap(a, lt++, i++);
                } else if (a[i] > pivot) {
                    swap(a, i, gt--);
                } else {
                    i++;
                }
            }
            if (k < lt) {
                hi = lt - 1;
            } else if (k > gt) {
                lo = gt + 1;
            } else {
                return pivot;
            }
        }
    }

    /**
     * Nearest-rank percentile: the smallest value with at least p percent of values at or below it.
     *
     * @param p percentile between 0 (exclusive) and 100 (inclusive)
     */
    public double percentile(double[] values, double p) {
        return select(values, rankFor(values.length, p));
    }

    /** Index of the nearest-rank percentile in a sorted list of length n. */
    public static int rankFor(int n, double p) {
        if (p <= 0 || p > 100) {
            throw new IllegalArgumentException("Percentile must be in (0, 100]");
        }
        if (n == 0) {
            throw new IllegalArgumentException("Cannot take a percentile of an empty list");
        }
        int k = (int) Math.ceil(p / 100.0 * n) - 1;
        return Math.max(0, Math.min(n - 1, k));
    }

    private static void swap(double[] a, int i, int j) {
        double t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
}
