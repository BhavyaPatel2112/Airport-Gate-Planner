package com.gateplanner.algo.text;

/**
 * Longest common prefix array by Kasai's algorithm. {@code lcp[i]} is the length of the longest
 * common prefix of suffixes {@code sa[i - 1]} and {@code sa[i]} ({@code lcp[0] = 0}).
 *
 * <p><b>Time:</b> O(n): the matched length h drops by at most 1 per step and never exceeds n.
 * <b>Space:</b> O(n).</p>
 */
public final class LcpArray {

    private LcpArray() {
    }

    public static int[] build(String text, int[] sa) {
        int n = text.length();
        if (sa.length != n) {
            throw new IllegalArgumentException("Suffix array length does not match the text");
        }
        int[] rank = new int[n];
        for (int i = 0; i < n; i++) {
            rank[sa[i]] = i;
        }
        int[] lcp = new int[n];
        int h = 0;
        for (int i = 0; i < n; i++) {
            if (rank[i] > 0) {
                int j = sa[rank[i] - 1];
                while (i + h < n && j + h < n && text.charAt(i + h) == text.charAt(j + h)) {
                    h++;
                }
                lcp[rank[i]] = h;
                if (h > 0) {
                    h--;
                }
            } else {
                h = 0;
            }
        }
        return lcp;
    }
}
