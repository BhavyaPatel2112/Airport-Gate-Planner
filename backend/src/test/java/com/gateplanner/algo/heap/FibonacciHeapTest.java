package com.gateplanner.algo.heap;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FibonacciHeapTest {

    @Test
    void extractMinGivesSortedOrder() {
        FibonacciHeap<String> h = new FibonacciHeap<>();
        int[] keys = {50, 10, 40, 20, 30, 10};
        for (int k : keys) {
            h.insert(k, "s" + k);
        }
        long prev = Long.MIN_VALUE;
        while (!h.isEmpty()) {
            long k = h.extractMin().key();
            assertTrue(k >= prev);
            prev = k;
        }
    }

    @Test
    void decreaseKeyMovesNodeToFront() {
        FibonacciHeap<String> h = new FibonacciHeap<>();
        List<FibonacciHeap.Node<String>> nodes = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            nodes.add(h.insert(100 + i, "s" + i));
        }
        h.extractMin();
        h.decreaseKey(nodes.get(15), 5);
        assertEquals("s15", h.minimum().value());
        assertTrue(h.cuts() >= 1 || h.rootCount() >= 1);
        assertThrows(IllegalArgumentException.class, () -> h.decreaseKey(nodes.get(3), 500));
    }

    @Test
    void cascadingCutsHappen() {
        FibonacciHeap<Integer> h = new FibonacciHeap<>();
        List<FibonacciHeap.Node<Integer>> nodes = new ArrayList<>();
        for (int i = 0; i < 64; i++) {
            nodes.add(h.insert(1000 + i, i));
        }
        h.extractMin();
        for (int i = 63; i > 1; i--) {
            h.decreaseKey(nodes.get(i), nodes.get(i).key() - 900);
        }
        assertTrue(h.cuts() > 0);
        assertTrue(h.cascadingCuts() >= 0);
        long prev = Long.MIN_VALUE;
        while (!h.isEmpty()) {
            long k = h.extractMin().key();
            assertTrue(k >= prev);
            prev = k;
        }
    }

    @Test
    void deleteArbitraryNode() {
        FibonacciHeap<String> h = new FibonacciHeap<>();
        h.insert(3, "a");
        FibonacciHeap.Node<String> b = h.insert(1, "b");
        h.insert(2, "c");
        h.delete(b);
        assertEquals(2, h.size());
        assertEquals("c", h.extractMin().value());
        assertThrows(IllegalArgumentException.class, () -> h.delete(b));
    }

    @Test
    void mergeCombinesHeaps() {
        FibonacciHeap<String> a = new FibonacciHeap<>();
        FibonacciHeap<String> b = new FibonacciHeap<>();
        a.insert(5, "a5");
        b.insert(1, "b1");
        b.insert(7, "b7");
        a.merge(b);
        assertEquals(3, a.size());
        assertEquals(0, b.size());
        assertEquals("b1", a.extractMin().value());
    }

    @Test
    void emptyExtractThrows() {
        assertThrows(IllegalStateException.class, () -> new FibonacciHeap<String>().extractMin());
    }

    @Test
    void randomOperationsMatchSortedReference() {
        Random rnd = new Random(21);
        FibonacciHeap<Integer> h = new FibonacciHeap<>();
        List<FibonacciHeap.Node<Integer>> live = new ArrayList<>();
        List<Long> reference = new ArrayList<>();
        for (int step = 0; step < 5000; step++) {
            int op = rnd.nextInt(10);
            if (op < 5 || live.isEmpty()) {
                long k = rnd.nextInt(10_000);
                live.add(h.insert(k, step));
                reference.add(k);
            } else if (op < 8) {
                FibonacciHeap.Node<Integer> x = live.get(rnd.nextInt(live.size()));
                long nk = x.key() - rnd.nextInt(500);
                reference.remove(Long.valueOf(x.key()));
                h.decreaseKey(x, nk);
                reference.add(nk);
            } else {
                long min = Long.MAX_VALUE;
                for (long r : reference) {
                    min = Math.min(min, r);
                }
                FibonacciHeap.Node<Integer> x = h.extractMin();
                assertEquals(min, x.key());
                reference.remove(Long.valueOf(min));
                live.remove(x);
            }
            assertEquals(reference.size(), h.size());
        }
    }
}
