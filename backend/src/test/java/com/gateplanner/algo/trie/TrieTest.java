package com.gateplanner.algo.trie;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TrieTest {

    @Test
    void emptyPrefixGivesNothing() {
        Trie<String> t = new Trie<>();
        t.insert("AI101", "v1");
        assertTrue(t.startsWith("", 5).isEmpty());
        assertTrue(t.startsWith("   ", 5).isEmpty());
    }

    @Test
    void noMatch() {
        Trie<String> t = new Trie<>();
        t.insert("AI101", "v1");
        assertTrue(t.startsWith("6E", 5).isEmpty());
        assertTrue(t.get("AI10").isEmpty());
    }

    @Test
    void exactMatch() {
        Trie<String> t = new Trie<>();
        t.insert("AI101", "v1");
        assertEquals(List.of("v1"), t.get("AI101"));
        assertEquals(List.of("v1"), t.startsWith("AI101", 5));
    }

    @Test
    void sharedPrefixesComeOutInOrderAndRespectLimit() {
        Trie<String> t = new Trie<>();
        t.insert("AI102", "b");
        t.insert("AI101", "a");
        t.insert("AI2927", "c");
        t.insert("AIR INDIA", "d");
        assertEquals(List.of("a", "b"), t.startsWith("AI10", 5));
        assertEquals(List.of("a", "b", "c"), t.startsWith("AI", 3));
        assertEquals(4, t.keyCount());
    }

    @Test
    void caseAndSpacesAreNormalised() {
        Trie<String> t = new Trie<>();
        t.insert("Air India", "x");
        assertEquals(List.of("x"), t.startsWith("air   in", 5));
        assertEquals("AIR INDIA", Trie.normalise("  air   india "));
        assertThrows(IllegalArgumentException.class, () -> t.insert("--", "y"));
    }

    @Test
    void duplicateValuesAreKeptOnce() {
        Trie<String> t = new Trie<>();
        t.insert("DEL", "v");
        t.insert("DEL", "v");
        assertEquals(1, t.get("DEL").size());
    }
}
