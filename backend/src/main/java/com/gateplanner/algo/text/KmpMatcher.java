package com.gateplanner.algo.text;

import java.util.ArrayList;
import java.util.List;

/**
 * Knuth-Morris-Pratt string matching, the baseline for the suffix tree. The failure function
 * says, after a mismatch, how much of the pattern is already matched, so the text pointer never
 * moves backwards.
 *
 * <p><b>Time:</b> O(n + m) per pattern. <b>Space:</b> O(m).</p>
 */
public final class KmpMatcher {

    private KmpMatcher() {
    }

    /** Failure function: {@code fail[i]} is the longest proper border of {@code pattern[0..i]}. */
    public static int[] failure(String pattern) {
        int m = pattern.length();
        int[] fail = new int[m];
        int k = 0;
        for (int i = 1; i < m; i++) {
            while (k > 0 && pattern.charAt(i) != pattern.charAt(k)) {
                k = fail[k - 1];
            }
            if (pattern.charAt(i) == pattern.charAt(k)) {
                k++;
            }
            fail[i] = k;
        }
        return fail;
    }

    /** Every start position of {@code pattern} in {@code text}, in increasing order. */
    public static List<Integer> search(String text, String pattern) {
        List<Integer> out = new ArrayList<>();
        int m = pattern.length();
        if (m == 0 || m > text.length()) {
            return out;
        }
        int[] fail = failure(pattern);
        int k = 0;
        for (int i = 0; i < text.length(); i++) {
            while (k > 0 && text.charAt(i) != pattern.charAt(k)) {
                k = fail[k - 1];
            }
            if (text.charAt(i) == pattern.charAt(k)) {
                k++;
            }
            if (k == m) {
                out.add(i - m + 1);
                k = fail[k - 1];
            }
        }
        return out;
    }
}
