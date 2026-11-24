package com.gateplanner.algo.text;

import java.util.ArrayList;
import java.util.List;

/**
 * Suffix tree built from the suffix array and the LCP array. Used to search all active airport
 * notices for every stand id and taxiway id on each replan.
 *
 * <p><b>Construction:</b> walk the suffixes in suffix array order keeping the rightmost path of
 * the tree on a stack. For each new suffix, pop nodes deeper than its LCP with the previous
 * suffix; if the LCP falls inside an edge, split it with a new internal node; then hang the new
 * leaf there. Every node is pushed and popped at most once, so construction is O(n) after the
 * O(n log n) suffix array.</p>
 *
 * <p><b>Search:</b> follow the pattern down from the root, O(m) for a pattern of length m, then
 * collect the leaves under the end point, O(occ). So k searches cost O(n log n + sum(m) + occ),
 * against O(k (n + m)) for running Knuth-Morris-Pratt once per pattern.</p>
 *
 * <p><b>Correctness:</b> a pattern occurs at position i exactly when it is a prefix of suffix i,
 * and every suffix is a root to leaf path, so the occurrences are exactly the leaves below the
 * point where the pattern ends. A unique terminator (code 1) makes every suffix end at a leaf.</p>
 */
public final class SuffixTree {

    private static final char TERMINATOR = '\u0001';

    /** One node. {@code depth} is the string depth; {@code suffix} is a suffix start inside it. */
    private static final class Node {
        private final int depth;
        private int suffix;
        private final int leaf;
        private final List<Node> children = new ArrayList<>();
        private final int id;

        Node(int depth, int suffix, int leaf, int id) {
            this.depth = depth;
            this.suffix = suffix;
            this.leaf = leaf;
            this.id = id;
        }
    }

    /** One step of a search, for the machine view: the edge label and how much of it matched. */
    public record PathStep(int nodeId, String edge, int matched, int childCount) {
    }

    /** Result of a search: sorted occurrence positions and the path walked from the root. */
    public record SearchResult(List<Integer> positions, List<PathStep> path, boolean found) {
    }

    private final String text;
    private final Node root;
    private int nodeCount;

    public SuffixTree(String source) {
        if (source.indexOf(TERMINATOR) >= 0) {
            throw new IllegalArgumentException("Text must not contain the terminator character");
        }
        this.text = source + TERMINATOR;
        int[] sa = SuffixArray.build(text);
        int[] lcp = LcpArray.build(text, sa);
        root = new Node(0, 0, -1, nodeCount++);
        List<Node> stack = new ArrayList<>();
        stack.add(root);
        int n = text.length();
        for (int i = 0; i < n; i++) {
            int suffix = sa[i];
            int l = i == 0 ? 0 : lcp[i];
            Node last = null;
            while (top(stack).depth > l) {
                last = stack.remove(stack.size() - 1);
            }
            Node parent = top(stack);
            if (parent.depth < l) {
                Node mid = new Node(l, last.suffix, -1, nodeCount++);
                parent.children.remove(parent.children.size() - 1);
                parent.children.add(mid);
                mid.children.add(last);
                stack.add(mid);
                parent = mid;
            }
            Node leaf = new Node(n - suffix, suffix, suffix, nodeCount++);
            parent.children.add(leaf);
            stack.add(leaf);
        }
    }

    public int nodeCount() {
        return nodeCount;
    }

    /** Length of the indexed text, without the terminator. */
    public int length() {
        return text.length() - 1;
    }

    /** Every start position of {@code pattern} in the text, in increasing order. */
    public List<Integer> search(String pattern) {
        return find(pattern).positions();
    }

    /** Search that also returns the path walked, for the machine view. */
    public SearchResult find(String pattern) {
        List<PathStep> path = new ArrayList<>();
        if (pattern.isEmpty()) {
            return new SearchResult(List.of(), path, false);
        }
        Node x = root;
        int matched = 0;
        while (matched < pattern.length()) {
            Node next = null;
            for (Node c : x.children) {
                int pos = c.suffix + x.depth;
                if (pos < text.length() && text.charAt(pos) == pattern.charAt(matched)) {
                    next = c;
                    break;
                }
            }
            if (next == null) {
                path.add(new PathStep(x.id, "", 0, x.children.size()));
                return new SearchResult(List.of(), path, false);
            }
            int edgeStart = next.suffix + x.depth;
            int edgeLen = next.depth - x.depth;
            int k = 0;
            while (k < edgeLen && matched < pattern.length()) {
                if (text.charAt(edgeStart + k) != pattern.charAt(matched)) {
                    path.add(new PathStep(next.id, edgeLabel(edgeStart, edgeLen), k, next.children.size()));
                    return new SearchResult(List.of(), path, false);
                }
                k++;
                matched++;
            }
            path.add(new PathStep(next.id, edgeLabel(edgeStart, edgeLen), k, next.children.size()));
            x = next;
        }
        List<Integer> out = new ArrayList<>();
        leaves(x, out);
        // positions come out in suffix order; put them in text order with an insertion sort,
        // occurrence lists are short (a stand id appears in a few notices)
        for (int i = 1; i < out.size(); i++) {
            int v = out.get(i);
            int j = i - 1;
            while (j >= 0 && out.get(j) > v) {
                out.set(j + 1, out.get(j));
                j--;
            }
            out.set(j + 1, v);
        }
        return new SearchResult(out, path, true);
    }

    private String edgeLabel(int start, int len) {
        int end = Math.min(text.length(), start + Math.min(len, 24));
        String s = text.substring(start, end).replace(TERMINATOR, '$').replace('\n', '|');
        return len > 24 ? s + "..." : s;
    }

    private void leaves(Node x, List<Integer> out) {
        if (x.leaf >= 0) {
            out.add(x.leaf);
            return;
        }
        for (Node c : x.children) {
            leaves(c, out);
        }
    }

    private static Node top(List<Node> stack) {
        return stack.get(stack.size() - 1);
    }
}
