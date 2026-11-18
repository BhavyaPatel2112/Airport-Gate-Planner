package com.gateplanner.algo.matching;

import java.util.Arrays;
import java.util.List;

/**
 * Baseline: greedy first-fit. Takes flights in the given order and gives each the first listed
 * stand that is still free. It never revisits a choice, so it can block a later flight that had
 * fewer options (flight A takes stand 1, flight B only fits stand 1 and is left out).
 *
 * <p><b>Time:</b> O(L + E). <b>Space:</b> O(L + R).</p>
 */
public final class GreedyFirstFit {

    private GreedyFirstFit() {
    }

    /** Returns, for each left vertex, the chosen right vertex or -1. */
    public static int[] match(int left, int right, List<List<Integer>> adjacency) {
        int[] matchLeft = new int[left];
        Arrays.fill(matchLeft, -1);
        boolean[] used = new boolean[right];
        for (int i = 0; i < left; i++) {
            for (int j : adjacency.get(i)) {
                if (!used[j]) {
                    used[j] = true;
                    matchLeft[i] = j;
                    break;
                }
            }
        }
        return matchLeft;
    }

    public static int size(int[] matchLeft) {
        int c = 0;
        for (int m : matchLeft) {
            if (m >= 0) {
                c++;
            }
        }
        return c;
    }
}
