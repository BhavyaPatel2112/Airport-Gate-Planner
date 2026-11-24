package com.gateplanner.algo.select;

/**
 * Deterministic linear-time selection (Blum, Floyd, Pratt, Rivest, Tarjan). Splits the values into
 * groups of five, takes each group's median, and recursively finds the median of those medians as
 * the pivot. That pivot is guaranteed to have at least about 3n/10 values on each side, so
 * T(n) &lt;= T(n/5) + T(7n/10) + O(n) = O(n) in the worst case.
 *
 * <p><b>Time:</b> O(n) worst case (larger constant than Quickselect). <b>Space:</b> O(n).</p>
 */
public final class MedianOfMedians {

    private long comparisons;

    public long comparisons() {
        return comparisons;
    }

    /** Returns the k-th smallest value (k = 0 is the minimum). The input is not changed. */
    public double select(double[] values, int k) {
        if (values.length == 0) {
            throw new IllegalArgumentException("Cannot select from an empty list");
        }
        if (k < 0 || k >= values.length) {
            throw new IllegalArgumentException("k = " + k + " is outside 0.." + (values.length - 1));
        }
        double[] a = values.clone();
        return select(a, 0, a.length - 1, k);
    }

    private double select(double[] a, int lo, int hi, int k) {
        while (true) {
            if (hi - lo < 5) {
                insertionSort(a, lo, hi);
                return a[k];
            }
            double pivot = pivot(a, lo, hi);
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

    /** Median of the group medians, placed by recursion on a compact array of medians. */
    private double pivot(double[] a, int lo, int hi) {
        int n = hi - lo + 1;
        int groups = (n + 4) / 5;
        double[] medians = new double[groups];
        for (int g = 0; g < groups; g++) {
            int s = lo + g * 5;
            int e = Math.min(s + 4, hi);
            insertionSort(a, s, e);
            medians[g] = a[s + (e - s) / 2];
        }
        return select(medians, 0, groups - 1, groups / 2);
    }

    private void insertionSort(double[] a, int lo, int hi) {
        for (int i = lo + 1; i <= hi; i++) {
            double v = a[i];
            int j = i - 1;
            while (j >= lo) {
                comparisons++;
                if (a[j] <= v) {
                    break;
                }
                a[j + 1] = a[j];
                j--;
            }
            a[j + 1] = v;
        }
    }

    private static void swap(double[] a, int i, int j) {
        double t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
}
