package com.gateplanner.algo.sort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Top-down merge sort, our own implementation, used as the comparison-sort baseline for
 * counting sort.
 *
 * <p><b>Time:</b> O(n log n) in every case. <b>Space:</b> O(n) for the merge buffer.
 * Stable, because the merge takes from the left half on ties.</p>
 */
public final class MergeSort {

    private MergeSort() {
    }

    public static <T> List<T> sort(List<T> items, Comparator<? super T> cmp) {
        @SuppressWarnings("unchecked")
        T[] a = (T[]) items.toArray();
        @SuppressWarnings("unchecked")
        T[] buf = (T[]) new Object[a.length];
        sort(a, buf, 0, a.length, cmp);
        List<T> out = new ArrayList<>(a.length);
        for (T t : a) {
            out.add(t);
        }
        return out;
    }

    public static int[] sort(int[] values) {
        int[] a = values.clone();
        int[] buf = new int[a.length];
        sortInts(a, buf, 0, a.length);
        return a;
    }

    private static <T> void sort(T[] a, T[] buf, int lo, int hi, Comparator<? super T> cmp) {
        if (hi - lo < 2) {
            return;
        }
        int mid = (lo + hi) >>> 1;
        sort(a, buf, lo, mid, cmp);
        sort(a, buf, mid, hi, cmp);
        if (cmp.compare(a[mid - 1], a[mid]) <= 0) {
            return;
        }
        int i = lo;
        int j = mid;
        int k = lo;
        while (i < mid && j < hi) {
            buf[k++] = cmp.compare(a[i], a[j]) <= 0 ? a[i++] : a[j++];
        }
        while (i < mid) {
            buf[k++] = a[i++];
        }
        while (j < hi) {
            buf[k++] = a[j++];
        }
        System.arraycopy(buf, lo, a, lo, hi - lo);
    }

    private static void sortInts(int[] a, int[] buf, int lo, int hi) {
        if (hi - lo < 2) {
            return;
        }
        int mid = (lo + hi) >>> 1;
        sortInts(a, buf, lo, mid);
        sortInts(a, buf, mid, hi);
        int i = lo;
        int j = mid;
        int k = lo;
        while (i < mid && j < hi) {
            buf[k++] = a[i] <= a[j] ? a[i++] : a[j++];
        }
        while (i < mid) {
            buf[k++] = a[i++];
        }
        while (j < hi) {
            buf[k++] = a[j++];
        }
        System.arraycopy(buf, lo, a, lo, hi - lo);
    }
}
