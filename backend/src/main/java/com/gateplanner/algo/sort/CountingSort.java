package com.gateplanner.algo.sort;

import java.util.ArrayList;
import java.util.List;
import java.util.function.ToIntFunction;

/**
 * Stable counting sort for items with small integer keys, such as a flight's start minute
 * (0 to 1439, or up to 2879 when delays run past midnight).
 *
 * <p><b>Time:</b> O(n + k) where n is the number of items and k the key range.
 * <b>Space:</b> O(n + k) for the count array and the output.</p>
 *
 * <p>It beats comparison sorts because it never compares two items: it counts how many items have
 * each key, turns the counts into starting positions with a prefix sum, and drops every item
 * straight into place. Stability (equal keys keep their input order) comes from the backwards
 * final pass.</p>
 */
public final class CountingSort {

    private CountingSort() {
    }

    /**
     * Sorts items by an integer key in {@code [0, maxKey]}.
     *
     * @throws IllegalArgumentException if a key falls outside the range
     */
    public static <T> List<T> sort(List<T> items, ToIntFunction<T> key, int maxKey) {
        if (maxKey < 0) {
            throw new IllegalArgumentException("maxKey must be at least 0");
        }
        int n = items.size();
        int[] keys = new int[n];
        int[] count = new int[maxKey + 2];
        for (int i = 0; i < n; i++) {
            int k = key.applyAsInt(items.get(i));
            if (k < 0 || k > maxKey) {
                throw new IllegalArgumentException("Key " + k + " is outside 0.." + maxKey);
            }
            keys[i] = k;
            count[k + 1]++;
        }
        for (int k = 1; k < count.length; k++) {
            count[k] += count[k - 1];
        }
        Object[] out = new Object[n];
        for (int i = 0; i < n; i++) {
            out[count[keys[i]]++] = items.get(i);
        }
        List<T> result = new ArrayList<>(n);
        for (Object o : out) {
            @SuppressWarnings("unchecked")
            T t = (T) o;
            result.add(t);
        }
        return result;
    }

    /** Sorts plain integer keys in {@code [0, maxKey]}; returns a new array. */
    public static int[] sort(int[] values, int maxKey) {
        int[] count = new int[maxKey + 1];
        for (int v : values) {
            if (v < 0 || v > maxKey) {
                throw new IllegalArgumentException("Key " + v + " is outside 0.." + maxKey);
            }
            count[v]++;
        }
        int[] out = new int[values.length];
        int pos = 0;
        for (int k = 0; k <= maxKey; k++) {
            for (int c = 0; c < count[k]; c++) {
                out[pos++] = k;
            }
        }
        return out;
    }
}
