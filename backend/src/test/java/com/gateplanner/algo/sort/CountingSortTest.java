package com.gateplanner.algo.sort;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CountingSortTest {

    record Item(int minute, String name) {
    }

    @Test
    void emptyListStaysEmpty() {
        assertTrue(CountingSort.sort(new ArrayList<Item>(), Item::minute, 1439).isEmpty());
    }

    @Test
    void singleItem() {
        List<Item> out = CountingSort.sort(List.of(new Item(600, "a")), Item::minute, 1439);
        assertEquals(1, out.size());
        assertEquals("a", out.get(0).name());
    }

    @Test
    void allSameMinuteKeepsInputOrder() {
        List<Item> in = List.of(new Item(5, "a"), new Item(5, "b"), new Item(5, "c"));
        List<Item> out = CountingSort.sort(in, Item::minute, 1439);
        assertEquals(List.of("a", "b", "c"), out.stream().map(Item::name).toList());
    }

    @Test
    void matchesMergeSortOnRandomData() {
        Random rnd = new Random(1);
        List<Item> in = new ArrayList<>();
        for (int i = 0; i < 5000; i++) {
            in.add(new Item(rnd.nextInt(1440), "f" + i));
        }
        List<Item> a = CountingSort.sort(in, Item::minute, 1439);
        List<Item> b = MergeSort.sort(in, (x, y) -> Integer.compare(x.minute(), y.minute()));
        assertEquals(b, a);
    }

    @Test
    void boundaryMinutesZeroAnd1439() {
        List<Item> in = List.of(new Item(1439, "late"), new Item(0, "early"), new Item(700, "mid"));
        List<Item> out = CountingSort.sort(in, Item::minute, 1439);
        assertEquals("early", out.get(0).name());
        assertEquals("late", out.get(2).name());
    }

    @Test
    void keyOutsideRangeIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> CountingSort.sort(List.of(new Item(1440, "x")), Item::minute, 1439));
        assertThrows(IllegalArgumentException.class, () -> CountingSort.sort(new int[] {-1}, 10));
    }

    @Test
    void intVariantSorts() {
        int[] out = CountingSort.sort(new int[] {3, 1, 2, 1}, 3);
        assertEquals(List.of(1, 1, 2, 3), List.of(out[0], out[1], out[2], out[3]));
    }
}
