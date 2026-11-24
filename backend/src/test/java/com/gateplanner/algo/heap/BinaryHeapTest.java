package com.gateplanner.algo.heap;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BinaryHeapTest {

    @Test
    void extractsInOrder() {
        BinaryHeap<String> h = new BinaryHeap<>();
        for (int k : new int[] {9, 3, 7, 1}) {
            h.insert(k, "k" + k);
        }
        assertEquals(1, h.extractMin().key());
        assertEquals(3, h.extractMin().key());
    }

    @Test
    void decreaseKey() {
        BinaryHeap<String> h = new BinaryHeap<>();
        h.insert(5, "a");
        BinaryHeap.Node<String> b = h.insert(9, "b");
        h.decreaseKey(b, 1);
        assertEquals("b", h.minimum().value());
        assertThrows(IllegalArgumentException.class, () -> h.decreaseKey(b, 20));
    }

    @Test
    void emptyExtractThrows() {
        assertThrows(IllegalStateException.class, () -> new BinaryHeap<String>().extractMin());
    }

    @Test
    void tiesKeepInsertionOrder() {
        BinaryHeap<String> h = new BinaryHeap<>();
        h.insert(1, "first");
        h.insert(1, "second");
        assertEquals("first", h.extractMin().value());
    }

    @Test
    void agreesWithFibonacciHeap() {
        Random rnd = new Random(4);
        BinaryHeap<Integer> b = new BinaryHeap<>();
        FibonacciHeap<Integer> f = new FibonacciHeap<>();
        List<BinaryHeap.Node<Integer>> bn = new ArrayList<>();
        List<FibonacciHeap.Node<Integer>> fn = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            int k = rnd.nextInt(1000);
            bn.add(b.insert(k, i));
            fn.add(f.insert(k, i));
        }
        for (int i = 0; i < 500; i++) {
            int j = rnd.nextInt(500);
            if (bn.get(j).inHeap()) {
                long nk = bn.get(j).key() - rnd.nextInt(50);
                b.decreaseKey(bn.get(j), nk);
                f.decreaseKey(fn.get(j), nk);
            }
            if (i % 3 == 0) {
                assertEquals(f.extractMin().value(), b.extractMin().value());
            }
        }
        assertTrue(b.size() == f.size());
    }
}
