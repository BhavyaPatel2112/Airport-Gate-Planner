package com.gateplanner.algo.sort;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MergeSortTest {

    @Test
    void emptyAndSingle() {
        assertTrue(MergeSort.sort(new ArrayList<Integer>(), Integer::compare).isEmpty());
        assertEquals(List.of(4), MergeSort.sort(List.of(4), Integer::compare));
    }

    @Test
    void sortsRandomInts() {
        Random rnd = new Random(3);
        int[] a = new int[2000];
        for (int i = 0; i < a.length; i++) {
            a[i] = rnd.nextInt(100);
        }
        int[] out = MergeSort.sort(a);
        for (int i = 1; i < out.length; i++) {
            assertTrue(out[i - 1] <= out[i]);
        }
    }

    @Test
    void isStable() {
        List<String> in = List.of("b1", "a1", "b2", "a2");
        List<String> out = MergeSort.sort(in, (x, y) -> Character.compare(x.charAt(0), y.charAt(0)));
        assertEquals(List.of("a1", "a2", "b1", "b2"), out);
    }

    @Test
    void alreadySortedAndReversed() {
        assertArrayEquals(new int[] {1, 2, 3}, MergeSort.sort(new int[] {1, 2, 3}));
        assertArrayEquals(new int[] {1, 2, 3}, MergeSort.sort(new int[] {3, 2, 1}));
    }

    @Test
    void doesNotChangeInput() {
        int[] a = {5, 1, 4};
        MergeSort.sort(a);
        assertArrayEquals(new int[] {5, 1, 4}, a);
    }
}
