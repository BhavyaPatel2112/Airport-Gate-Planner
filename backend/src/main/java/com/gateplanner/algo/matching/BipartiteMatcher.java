package com.gateplanner.algo.matching;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Maximum bipartite matching through maximum flow. Left vertices are flights, right vertices are
 * stands. The network is: source to every flight (capacity 1), flight to every compatible free
 * stand (capacity 1), every stand to sink (capacity 1). An integral maximum flow is a maximum
 * matching.
 *
 * <p><b>Time:</b> O(min(L, R) (L + R + E)) with Edmonds-Karp. <b>Space:</b> O(L + R + E).</p>
 */
public final class BipartiteMatcher {

    private final int left;
    private final int right;
    private final List<List<Integer>> adjacency;
    private MaxFlowNetwork network;
    private int[] matchLeft;
    private int size = -1;

    /**
     * @param left      number of left vertices
     * @param right     number of right vertices
     * @param adjacency for each left vertex, the right vertices it may be matched to
     */
    public BipartiteMatcher(int left, int right, List<List<Integer>> adjacency) {
        if (left < 0 || right < 0 || adjacency.size() != left) {
            throw new IllegalArgumentException("Adjacency list must have one entry per left vertex");
        }
        this.left = left;
        this.right = right;
        this.adjacency = adjacency;
    }

    /** Computes the maximum matching and returns its size. */
    public int solve() {
        int source = 0;
        int sink = left + right + 1;
        network = new MaxFlowNetwork(left + right + 2);
        List<int[]> middle = new ArrayList<>();
        for (int i = 0; i < left; i++) {
            network.addEdge(source, 1 + i, 1);
        }
        for (int i = 0; i < left; i++) {
            for (int j : adjacency.get(i)) {
                if (j < 0 || j >= right) {
                    throw new IllegalArgumentException("Right vertex " + j + " out of range");
                }
                int id = network.addEdge(1 + i, 1 + left + j, 1);
                middle.add(new int[] {i, j, id});
            }
        }
        for (int j = 0; j < right; j++) {
            network.addEdge(1 + left + j, sink, 1);
        }
        size = network.maxFlow(source, sink);
        matchLeft = new int[left];
        Arrays.fill(matchLeft, -1);
        for (int[] m : middle) {
            if (network.flowOn(m[2]) == 1) {
                matchLeft[m[0]] = m[1];
            }
        }
        return size;
    }

    /** For each left vertex the matched right vertex, or -1. */
    public int[] matchLeft() {
        requireSolved();
        return matchLeft.clone();
    }

    public int size() {
        requireSolved();
        return size;
    }

    public int leftCount() {
        return left;
    }

    public int rightCount() {
        return right;
    }

    public List<List<Integer>> adjacency() {
        return adjacency;
    }

    public int edgeCount() {
        int e = 0;
        for (List<Integer> a : adjacency) {
            e += a.size();
        }
        return e;
    }

    MaxFlowNetwork network() {
        requireSolved();
        return network;
    }

    public int augmentations() {
        requireSolved();
        return network.augmentations();
    }

    private void requireSolved() {
        if (size < 0) {
            throw new IllegalStateException("Call solve() first");
        }
    }
}
