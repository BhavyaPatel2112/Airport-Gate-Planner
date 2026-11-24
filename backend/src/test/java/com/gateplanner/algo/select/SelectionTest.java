package com.gateplanner.algo.select;

import com.gateplanner.algo.sort.MergeSort;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SelectionTest {

    private static double sortedAt(double[] v, int k) {
        List<Double> boxed = new ArrayList<>();
        for (double d : v) {
            boxed.add(d);
        }
        return MergeSort.sort(boxed, Double::compare).get(k);
    }

    @Test
    void firstAndLastPositions() {
        double[] v = {7, -3, 12, 0, 5};
        assertEquals(-3, new RandomizedQuickselect(1).select(v, 0));
        assertEquals(12, new RandomizedQuickselect(1).select(v, v.length - 1));
        assertEquals(-3, new MedianOfMedians().select(v, 0));
        assertEquals(12, new MedianOfMedians().select(v, v.length - 1));
    }

    @Test
    void manyDuplicates() {
        double[] v = new double[1000];
        for (int i = 0; i < v.length; i++) {
            v[i] = i % 3 == 0 ? 15 : 0;
        }
        for (int k : new int[] {0, 500, 665, 666, 667, 999}) {
            assertEquals(sortedAt(v, k), new RandomizedQuickselect(2).select(v, k));
            assertEquals(sortedAt(v, k), new MedianOfMedians().select(v, k));
        }
    }

    @Test
    void matchesSortOnRandomDelays() {
        Random rnd = new Random(13);
        for (int round = 0; round < 50; round++) {
            int n = 1 + rnd.nextInt(800);
            double[] v = new double[n];
            for (int i = 0; i < n; i++) {
                v[i] = Math.round(rnd.nextGaussian() * 20);
            }
            int k = rnd.nextInt(n);
            double expected = sortedAt(v, k);
            assertEquals(expected, new RandomizedQuickselect(round).select(v, k));
            assertEquals(expected, new MedianOfMedians().select(v, k));
        }
    }

    @Test
    void invalidKThrows() {
        double[] v = {1, 2, 3};
        assertThrows(IllegalArgumentException.class, () -> new RandomizedQuickselect(1).select(v, 3));
        assertThrows(IllegalArgumentException.class, () -> new RandomizedQuickselect(1).select(v, -1));
        assertThrows(IllegalArgumentException.class, () -> new MedianOfMedians().select(new double[0], 0));
        assertThrows(IllegalArgumentException.class, () -> RandomizedQuickselect.rankFor(10, 0));
    }

    @Test
    void sameSeedSameResultAndWork() {
        Random rnd = new Random(99);
        double[] v = new double[5000];
        for (int i = 0; i < v.length; i++) {
            v[i] = rnd.nextInt(200);
        }
        RandomizedQuickselect a = new RandomizedQuickselect(42);
        RandomizedQuickselect b = new RandomizedQuickselect(42);
        assertEquals(a.percentile(v, 90), b.percentile(v, 90));
        assertEquals(a.comparisons(), b.comparisons());
    }

    @Test
    void nearestRankPercentile() {
        double[] v = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
        assertEquals(9, new RandomizedQuickselect(3).percentile(v, 90));
        assertEquals(5, new RandomizedQuickselect(3).percentile(v, 50));
        assertEquals(10, new RandomizedQuickselect(3).percentile(v, 100));
    }
}
