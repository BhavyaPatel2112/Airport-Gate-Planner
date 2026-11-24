package com.gateplanner.algo.text;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SuffixTreeTest {

    private static List<Integer> naive(String text, String p) {
        List<Integer> out = new ArrayList<>();
        if (p.isEmpty()) {
            return out;
        }
        for (int i = 0; i + p.length() <= text.length(); i++) {
            if (text.startsWith(p, i)) {
                out.add(i);
            }
        }
        return out;
    }

    @Test
    void emptyText() {
        SuffixTree t = new SuffixTree("");
        assertTrue(t.search("A").isEmpty());
        assertEquals(0, SuffixArray.build("").length);
        assertTrue(KmpMatcher.search("", "A").isEmpty());
    }

    @Test
    void patternLongerThanText() {
        SuffixTree t = new SuffixTree("STAND");
        assertTrue(t.search("STAND 42").isEmpty());
        assertTrue(KmpMatcher.search("STAND", "STAND 42").isEmpty());
    }

    @Test
    void repeatedCharacters() {
        String text = "AAAAAAA";
        SuffixTree t = new SuffixTree(text);
        assertEquals(naive(text, "AAA"), t.search("AAA"));
        assertEquals(naive(text, "AAA"), KmpMatcher.search(text, "AAA"));
        assertArrayEquals(new int[] {6, 5, 4, 3, 2, 1, 0}, SuffixArray.build(text));
    }

    @Test
    void allOccurrencesMatchNaiveOnNoticeText() {
        String text = " VABB STAND 42A CLSD 1400-1800 \n VABB STANDS 51-55 CLSD WIP \n VABB STAND 142 CLSD \n";
        SuffixTree t = new SuffixTree(text);
        for (String p : new String[] {" 42A ", "STAND", "CLSD", " 142 ", "1400", "VABB", "ZZZ", "\n"}) {
            assertEquals(naive(text, p), t.search(p), "pattern '" + p + "'");
        }
        assertEquals(1, t.search(" 42A ").size(), "42A is a whole token, 142 must not match");
    }

    @Test
    void suffixTreeAndKmpAgreeOnRandomText() {
        Random rnd = new Random(8);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 3000; i++) {
            b.append((char) ('A' + rnd.nextInt(4)));
        }
        String text = b.toString();
        SuffixTree t = new SuffixTree(text);
        for (int i = 0; i < 200; i++) {
            int s = rnd.nextInt(text.length() - 6);
            String p = text.substring(s, s + 1 + rnd.nextInt(6));
            assertEquals(KmpMatcher.search(text, p), t.search(p));
        }
    }

    @Test
    void lcpArrayIsCorrect() {
        String text = "BANANA";
        int[] sa = SuffixArray.build(text);
        assertArrayEquals(new int[] {5, 3, 1, 0, 4, 2}, sa);
        assertArrayEquals(new int[] {0, 1, 3, 0, 0, 2}, LcpArray.build(text, sa));
    }

    @Test
    void searchReturnsPathForMachineView() {
        SuffixTree t = new SuffixTree("VABB STAND 42 CLSD");
        SuffixTree.SearchResult r = t.find("STAND");
        assertTrue(r.found());
        assertTrue(!r.path().isEmpty());
        assertTrue(!t.find("XYZ").found());
    }

    @Test
    void kmpFailureFunction() {
        assertArrayEquals(new int[] {0, 0, 1, 2, 0}, KmpMatcher.failure("ABABC"));
    }
}
