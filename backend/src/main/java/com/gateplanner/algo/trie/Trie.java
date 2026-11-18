package com.gateplanner.algo.trie;

import java.util.ArrayList;
import java.util.List;

/**
 * Prefix tree for flight search with autocomplete. Keys are normalised to upper case letters,
 * digits and spaces (37 symbols), and each node keeps an array of 37 children, so walking a
 * prefix of length m costs O(m) no matter how many flights are stored. Children are visited in
 * ASCII order (space, digits, letters), so suggestions come out alphabetically.
 *
 * <p><b>Time:</b> insert O(m); prefix search O(m + s) where s is the number of nodes visited to
 * collect up to {@code limit} results. <b>Space:</b> O(total key length x 37) in the worst case.</p>
 *
 * @param <V> value stored at the end of each key
 */
public final class Trie<V> {

    private static final int SYMBOLS = 37;

    private static final class Node<V> {
        @SuppressWarnings("unchecked")
        private final Node<V>[] next = (Node<V>[]) new Node[SYMBOLS];
        private List<V> values;
    }

    private final Node<V> root = new Node<>();
    private int keys;
    private int nodes = 1;

    public int keyCount() {
        return keys;
    }

    public int nodeCount() {
        return nodes;
    }

    /** Normalises a key: upper case, keeps letters, digits and single spaces. */
    public static String normalise(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toUpperCase().toCharArray()) {
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                b.append(c);
            } else if (c == ' ' && b.length() > 0 && b.charAt(b.length() - 1) != ' ') {
                b.append(' ');
            }
        }
        return b.toString().trim();
    }

    public void insert(String key, V value) {
        String k = normalise(key);
        if (k.isEmpty()) {
            throw new IllegalArgumentException("Key has no letters or digits");
        }
        Node<V> x = root;
        for (int i = 0; i < k.length(); i++) {
            int c = index(k.charAt(i));
            if (x.next[c] == null) {
                x.next[c] = new Node<>();
                nodes++;
            }
            x = x.next[c];
        }
        if (x.values == null) {
            x.values = new ArrayList<>();
            keys++;
        }
        if (!x.values.contains(value)) {
            x.values.add(value);
        }
    }

    /** Exact lookup. */
    public List<V> get(String key) {
        Node<V> x = walk(normalise(key));
        return x == null || x.values == null ? List.of() : new ArrayList<>(x.values);
    }

    /** Up to {@code limit} distinct values whose key starts with {@code prefix}. */
    public List<V> startsWith(String prefix, int limit) {
        List<V> out = new ArrayList<>();
        String p = normalise(prefix);
        if (p.isEmpty() || limit <= 0) {
            return out;
        }
        Node<V> x = walk(p);
        if (x != null) {
            collect(x, out, limit);
        }
        return out;
    }

    private Node<V> walk(String k) {
        Node<V> x = root;
        for (int i = 0; i < k.length() && x != null; i++) {
            x = x.next[index(k.charAt(i))];
        }
        return x;
    }

    private void collect(Node<V> x, List<V> out, int limit) {
        if (out.size() >= limit) {
            return;
        }
        if (x.values != null) {
            for (V v : x.values) {
                if (out.size() >= limit) {
                    return;
                }
                if (!out.contains(v)) {
                    out.add(v);
                }
            }
        }
        for (Node<V> child : x.next) {
            if (child != null) {
                collect(child, out, limit);
            }
        }
    }

    /** Symbol order follows ASCII: space, then digits, then letters. */
    private static int index(char c) {
        if (c >= '0' && c <= '9') {
            return 1 + (c - '0');
        }
        if (c >= 'A' && c <= 'Z') {
            return 11 + (c - 'A');
        }
        return 0;
    }
}
