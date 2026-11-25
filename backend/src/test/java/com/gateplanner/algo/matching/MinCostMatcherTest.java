package com.gateplanner.algo.matching;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MinCostMatcherTest {

    @Test
    void picksTheCheapestOfTwoPerfectMatchings() {
        // 0 can use stand 0 (cost 5) or 1 (cost 0); 1 can use stand 0 (cost 0) or 1 (cost 5)
        List<List<Integer>> adj = List.of(List.of(0, 1), List.of(0, 1));
        List<List<Long>> c = List.of(List.of(5L, 0L), List.of(0L, 5L));
        MinCostMatcher m = new MinCostMatcher(2, 2, adj, c);
        assertEquals(2, m.solve());
        assertArrayEquals(new int[] {1, 0}, m.matchLeft());
        assertEquals(0, m.totalCost());
    }

    @Test
    void sizeAlwaysEqualsMaximumMatchingAndCostIsMinimal() {
        Random r = new Random(7);
        for (int trial = 0; trial < 300; trial++) {
            int l = 1 + r.nextInt(6);
            int rr = 1 + r.nextInt(6);
            List<List<Integer>> adj = new ArrayList<>();
            List<List<Long>> cost = new ArrayList<>();
            for (int i = 0; i < l; i++) {
                List<Integer> a = new ArrayList<>();
                List<Long> c = new ArrayList<>();
                for (int j = 0; j < rr; j++) {
                    if (r.nextDouble() < 0.5) {
                        a.add(j);
                        c.add((long) r.nextInt(20));
                    }
                }
                adj.add(a);
                cost.add(c);
            }
            MinCostMatcher mc = new MinCostMatcher(l, rr, adj, cost);
            int size = mc.solve();
            BipartiteMatcher ek = new BipartiteMatcher(l, rr, adj);
            assertEquals(ek.solve(), size, "same size as Edmonds-Karp");
            long[] best = {Long.MAX_VALUE};
            brute(adj, cost, 0, new boolean[rr], 0, 0, size, best);
            assertEquals(best[0], mc.totalCost(), "cheapest among maximum matchings");
            // the reported matching is valid and costs what it says
            int[] m = mc.matchLeft();
            long sum = 0;
            boolean[] used = new boolean[rr];
            int n = 0;
            for (int i = 0; i < l; i++) {
                if (m[i] >= 0) {
                    assertEquals(false, used[m[i]]);
                    used[m[i]] = true;
                    sum += cost.get(i).get(adj.get(i).indexOf(m[i]));
                    n++;
                }
            }
            assertEquals(size, n);
            assertEquals(mc.totalCost(), sum);
        }
    }

    private static void brute(List<List<Integer>> adj, List<List<Long>> cost, int i, boolean[] used, int matched, long c,
                              int target, long[] best) {
        if (i == adj.size()) {
            if (matched == target) {
                best[0] = Math.min(best[0], c);
            }
            return;
        }
        brute(adj, cost, i + 1, used, matched, c, target, best);
        List<Integer> a = adj.get(i);
        for (int k = 0; k < a.size(); k++) {
            int j = a.get(k);
            if (!used[j]) {
                used[j] = true;
                brute(adj, cost, i + 1, used, matched + 1, c + cost.get(i).get(k), target, best);
                used[j] = false;
            }
        }
    }

    @Test
    void rejectsNegativeCosts() {
        assertThrows(IllegalArgumentException.class,
                () -> new MinCostMatcher(1, 1, List.of(List.of(0)), List.of(List.of(-1L))));
    }
}
