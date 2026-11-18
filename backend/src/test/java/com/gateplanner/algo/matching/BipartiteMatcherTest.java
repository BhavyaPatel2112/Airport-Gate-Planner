package com.gateplanner.algo.matching;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BipartiteMatcherTest {

    @Test
    void noEdgesMeansNoMatching() {
        BipartiteMatcher m = new BipartiteMatcher(3, 2, List.of(List.of(), List.of(), List.of()));
        assertEquals(0, m.solve());
        MinCutExplainer.HallViolator v = MinCutExplainer.explain(m);
        assertEquals(3, v.unmatched().size());
        assertEquals(3, v.deficiency());
    }

    @Test
    void perfectMatching() {
        List<List<Integer>> adj = List.of(List.of(0, 1), List.of(1, 2), List.of(2, 0));
        BipartiteMatcher m = new BipartiteMatcher(3, 3, adj);
        assertEquals(3, m.solve());
        int[] match = m.matchLeft();
        Set<Integer> used = new HashSet<>();
        for (int i = 0; i < 3; i++) {
            assertTrue(adj.get(i).contains(match[i]));
            assertTrue(used.add(match[i]));
        }
    }

    @Test
    void hallViolatorIsFound() {
        // three wide-bodies all need stand 0 or 1: only two can be placed
        List<List<Integer>> adj = List.of(List.of(0, 1), List.of(0, 1), List.of(0, 1), List.of(2));
        BipartiteMatcher m = new BipartiteMatcher(4, 3, adj);
        assertEquals(3, m.solve());
        MinCutExplainer.HallViolator v = MinCutExplainer.explain(m);
        assertEquals(3, v.flights().size());
        assertEquals(2, v.stands().size());
        assertEquals(1, v.deficiency());
        assertEquals(3, v.cutCapacity());
    }

    @Test
    void greedyCounterexample() {
        // flight A fits stands 1 and 2, flight B only fits stand 1 (plan section 3.2)
        List<List<Integer>> adj = List.of(List.of(0, 1), List.of(0));
        assertEquals(1, GreedyFirstFit.size(GreedyFirstFit.match(2, 2, adj)));
        BipartiteMatcher m = new BipartiteMatcher(2, 2, adj);
        assertEquals(2, m.solve());
        assertEquals(1, m.matchLeft()[0]);
        assertEquals(0, m.matchLeft()[1]);
    }

    @Test
    void matchesBruteForceOnSmallGraphs() {
        Random rnd = new Random(9);
        for (int round = 0; round < 200; round++) {
            int l = 1 + rnd.nextInt(6);
            int r = 1 + rnd.nextInt(6);
            List<List<Integer>> adj = new ArrayList<>();
            for (int i = 0; i < l; i++) {
                List<Integer> a = new ArrayList<>();
                for (int j = 0; j < r; j++) {
                    if (rnd.nextDouble() < 0.35) {
                        a.add(j);
                    }
                }
                adj.add(a);
            }
            BipartiteMatcher m = new BipartiteMatcher(l, r, adj);
            assertEquals(brute(adj, 0, new boolean[r]), m.solve());
            assertTrue(m.size() >= GreedyFirstFit.size(GreedyFirstFit.match(l, r, adj)));
        }
    }

    @Test
    void invalidInputIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new BipartiteMatcher(2, 1, List.of(List.of())));
        BipartiteMatcher bad = new BipartiteMatcher(1, 1, List.of(List.of(5)));
        assertThrows(IllegalArgumentException.class, bad::solve);
        assertThrows(IllegalStateException.class, () -> new BipartiteMatcher(1, 1, List.of(List.of(0))).matchLeft());
    }

    @Test
    void maxFlowOnClassicNetwork() {
        MaxFlowNetwork n = new MaxFlowNetwork(4);
        n.addEdge(0, 1, 3);
        n.addEdge(0, 2, 2);
        n.addEdge(1, 2, 1);
        n.addEdge(1, 3, 2);
        n.addEdge(2, 3, 3);
        assertEquals(5, n.maxFlow(0, 3));
        boolean[] cut = n.residualReachable(0);
        assertTrue(cut[0]);
        assertTrue(!cut[3]);
    }

    private static int brute(List<List<Integer>> adj, int i, boolean[] used) {
        if (i == adj.size()) {
            return 0;
        }
        int best = brute(adj, i + 1, used);
        for (int j : adj.get(i)) {
            if (!used[j]) {
                used[j] = true;
                best = Math.max(best, 1 + brute(adj, i + 1, used));
                used[j] = false;
            }
        }
        return best;
    }
}
