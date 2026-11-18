package com.gateplanner.algo.segtree;

import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LazySegmentTreeTest {

    @Test
    void singlePoint() {
        LazySegmentTree t = new LazySegmentTree(10);
        t.rangeAdd(3, 4, 5);
        assertEquals(5, t.pointQuery(3));
        assertEquals(0, t.pointQuery(4));
        assertEquals(5, t.rangeMax(0, 10));
        assertEquals(3, t.argMax(0, 10));
    }

    @Test
    void fullRangeAdd() {
        LazySegmentTree t = new LazySegmentTree(1440);
        t.rangeAdd(0, 1440, 2);
        assertEquals(2, t.rangeMax(0, 1440));
        assertEquals(2880, t.rangeSum(0, 1440));
    }

    @Test
    void overlappingRanges() {
        LazySegmentTree t = new LazySegmentTree(100);
        t.rangeAdd(10, 50, 1);
        t.rangeAdd(40, 60, 1);
        t.rangeAdd(45, 46, 1);
        assertEquals(3, t.rangeMax(0, 100));
        assertEquals(45, t.argMax(0, 100));
        assertEquals(2, t.pointQuery(40));
        t.rangeAdd(45, 46, -1);
        assertEquals(2, t.rangeMax(0, 100));
    }

    @Test
    void peakEqualsBruteForceOnRandomIntervals() {
        Random rnd = new Random(7);
        int n = 1440;
        LazySegmentTree t = new LazySegmentTree(n);
        int[] count = new int[n];
        for (int i = 0; i < 400; i++) {
            int s = rnd.nextInt(n - 1);
            int e = s + 1 + rnd.nextInt(Math.min(120, n - s - 1) + 1);
            e = Math.min(e, n);
            t.rangeAdd(s, e, 1);
            for (int m = s; m < e; m++) {
                count[m]++;
            }
        }
        int peak = 0;
        long sum = 0;
        for (int c : count) {
            peak = Math.max(peak, c);
            sum += c;
        }
        assertEquals(peak, t.rangeMax(0, n));
        assertEquals(sum, t.rangeSum(0, n));
        long[] values = t.values();
        for (int m = 0; m < n; m++) {
            assertEquals(count[m], values[m]);
        }
    }

    @Test
    void queryOutsideRangeIsRejected() {
        LazySegmentTree t = new LazySegmentTree(10);
        assertThrows(IllegalArgumentException.class, () -> t.rangeMax(5, 11));
        assertThrows(IllegalArgumentException.class, () -> t.rangeAdd(-1, 3, 1));
        assertThrows(IllegalArgumentException.class, () -> t.rangeSum(4, 4));
        assertThrows(IllegalArgumentException.class, () -> new LazySegmentTree(0));
    }
}
