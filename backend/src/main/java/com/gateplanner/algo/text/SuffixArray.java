package com.gateplanner.algo.text;

/**
 * Suffix array by prefix doubling with radix (counting) sort. After round k every suffix is
 * ranked by its first 2^k characters; the next round sorts pairs (rank[i], rank[i + 2^k]).
 *
 * <p><b>Time:</b> O(n log n): log n rounds, each a two-pass counting sort in O(n).
 * <b>Space:</b> O(n).</p>
 */
public final class SuffixArray {

    private SuffixArray() {
    }

    /**
     * Builds the suffix array of {@code text}. Characters are compared by their code (0 to 65535).
     */
    public static int[] build(String text) {
        int n = text.length();
        int[] sa = new int[n];
        if (n == 0) {
            return sa;
        }
        int[] rank = new int[n];
        int[] tmp = new int[n];
        int alphabet = 0;
        for (int i = 0; i < n; i++) {
            rank[i] = text.charAt(i) + 1;
            alphabet = Math.max(alphabet, rank[i]);
        }
        int classes = alphabet + 1;
        for (int k = 1; ; k <<= 1) {
            final int kf = k;
            // sort by second key, then stable sort by first key (LSD radix sort)
            int[] bySecond = countingSortBy(identity(n), i -> i + kf < n ? rank[i + kf] : 0, classes);
            sa = countingSortBy(bySecond, i -> rank[i], classes);
            tmp[sa[0]] = 1;
            for (int i = 1; i < n; i++) {
                int a = sa[i - 1];
                int b = sa[i];
                boolean same = rank[a] == rank[b]
                        && (a + k < n ? rank[a + k] : 0) == (b + k < n ? rank[b + k] : 0);
                tmp[b] = tmp[a] + (same ? 0 : 1);
            }
            System.arraycopy(tmp, 0, rank, 0, n);
            classes = rank[sa[n - 1]] + 1;
            if (rank[sa[n - 1]] == n) {
                break;
            }
        }
        return sa;
    }

    private static int[] identity(int n) {
        int[] a = new int[n];
        for (int i = 0; i < n; i++) {
            a[i] = i;
        }
        return a;
    }

    private static int[] countingSortBy(int[] order, java.util.function.IntUnaryOperator key, int classes) {
        int[] count = new int[classes + 1];
        for (int i : order) {
            count[key.applyAsInt(i) + 1]++;
        }
        for (int c = 1; c <= classes; c++) {
            count[c] += count[c - 1];
        }
        int[] out = new int[order.length];
        for (int i : order) {
            out[count[key.applyAsInt(i)]++] = i;
        }
        return out;
    }
}
