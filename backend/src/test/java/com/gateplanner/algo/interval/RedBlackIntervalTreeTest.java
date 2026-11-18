package com.gateplanner.algo.interval;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RedBlackIntervalTreeTest {

    @Test
    void emptyTree() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        assertTrue(t.isEmpty());
        assertFalse(t.anyOverlap(0, 100));
        assertTrue(t.overlaps(0, 100).isEmpty());
        assertEquals(1, t.validate(), "only the black sentinel leaf");
        assertEquals(-1, t.rootId());
    }

    @Test
    void insertAndDeleteKeepRedBlackProperties() {
        Random rnd = new Random(11);
        RedBlackIntervalTree<Integer> t = new RedBlackIntervalTree<>();
        List<RedBlackIntervalTree.Node<Integer>> nodes = new ArrayList<>();
        for (int i = 0; i < 2000; i++) {
            int s = rnd.nextInt(1440);
            nodes.add(t.insert(s, s + 1 + rnd.nextInt(120), i));
            t.validate();
        }
        int n = t.size();
        assertTrue(t.height() <= 2 * (32 - Integer.numberOfLeadingZeros(n + 1)), "height bound 2 log(n+1)");
        for (int i = 0; i < 1500; i++) {
            int k = rnd.nextInt(nodes.size());
            t.delete(nodes.remove(k));
            t.validate();
        }
        assertEquals(500, t.size());
        List<RedBlackIntervalTree.Node<Integer>> order = t.inOrder();
        for (int i = 1; i < order.size(); i++) {
            assertTrue(order.get(i - 1).start() <= order.get(i).start());
        }
    }

    @Test
    void overlapQueryMatchesBruteForce() {
        Random rnd = new Random(5);
        RedBlackIntervalTree<Integer> t = new RedBlackIntervalTree<>();
        int[][] iv = new int[800][];
        for (int i = 0; i < iv.length; i++) {
            int s = rnd.nextInt(1440);
            iv[i] = new int[] {s, s + 5 + rnd.nextInt(90)};
            t.insert(iv[i][0], iv[i][1], i);
        }
        for (int q = 0; q < 300; q++) {
            int qs = rnd.nextInt(1440);
            int qe = qs + 1 + rnd.nextInt(60);
            Set<Integer> expected = new HashSet<>();
            for (int i = 0; i < iv.length; i++) {
                if (iv[i][0] < qe && qs < iv[i][1]) {
                    expected.add(i);
                }
            }
            Set<Integer> got = new HashSet<>();
            for (RedBlackIntervalTree.Node<Integer> n : t.overlaps(qs, qe)) {
                got.add(n.value());
            }
            assertEquals(expected, got);
            assertEquals(!expected.isEmpty(), t.anyOverlap(qs, qe));
        }
    }

    @Test
    void deleteRoot() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        RedBlackIntervalTree.Node<String> a = t.insert(10, 20, "a");
        t.insert(5, 8, "b");
        t.insert(30, 40, "c");
        int rootId = t.rootId();
        RedBlackIntervalTree.Node<String> root = a.id() == rootId ? a : t.inOrder().stream()
                .filter(n -> n.id() == rootId).findFirst().orElseThrow();
        t.delete(root);
        t.validate();
        assertEquals(2, t.size());
        assertFalse(t.overlaps(0, 100).stream().anyMatch(n -> n == root));
    }

    @Test
    void touchingIntervalsDoNotOverlap() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        t.insert(600, 645, "AI 101");
        assertFalse(t.anyOverlap(645, 700), "a visit ending 10:45 does not clash with one starting 10:45");
        assertFalse(t.anyOverlap(500, 600));
        assertTrue(t.anyOverlap(644, 700));
    }

    @Test
    void maxEndIsUpdatedAfterDelete() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        t.insert(10, 20, "a");
        RedBlackIntervalTree.Node<String> longOne = t.insert(12, 500, "long");
        t.insert(30, 40, "c");
        assertTrue(t.anyOverlap(400, 410));
        t.delete(longOne);
        t.validate();
        assertFalse(t.anyOverlap(400, 410));
    }

    @Test
    void rejectsEmptyInterval() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        assertThrows(IllegalArgumentException.class, () -> t.insert(10, 10, "x"));
        assertThrows(IllegalArgumentException.class, () -> t.delete(null));
    }

    @Test
    void recordsRotationsForTheMachineView() {
        RedBlackIntervalTree<String> t = new RedBlackIntervalTree<>();
        t.insert(1, 2, "a");
        t.insert(2, 3, "b");
        t.insert(3, 4, "c");
        assertTrue(t.lastOperations().stream().anyMatch(s -> s.contains("rotation")));
        assertEquals(3, t.snapshot(v -> v).size());
    }
}
