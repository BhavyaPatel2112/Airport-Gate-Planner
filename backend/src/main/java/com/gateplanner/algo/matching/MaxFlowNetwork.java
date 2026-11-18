package com.gateplanner.algo.matching;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Flow network with the Edmonds-Karp maximum flow algorithm (Ford-Fulkerson with shortest
 * augmenting paths found by breadth-first search).
 *
 * <p><b>Time:</b> O(V E^2) in general. For bipartite matching every augmenting path adds one unit,
 * so there are at most min(L, R) augmentations of O(V + E) each: O(min(L, R) (V + E)).
 * <b>Space:</b> O(V + E).</p>
 *
 * <p><b>Correctness:</b> the max-flow min-cut theorem. When BFS can no longer reach the sink, the
 * set of vertices it did reach is the source side of a cut whose capacity equals the flow, so the
 * flow is maximum and that cut is minimum.</p>
 */
public final class MaxFlowNetwork {

    private final int n;
    private final List<List<Integer>> adj;
    private final List<int[]> edges = new ArrayList<>();
    private int augmentations;

    public MaxFlowNetwork(int vertices) {
        if (vertices < 2) {
            throw new IllegalArgumentException("A flow network needs at least a source and a sink");
        }
        this.n = vertices;
        this.adj = new ArrayList<>(vertices);
        for (int i = 0; i < vertices; i++) {
            adj.add(new ArrayList<>());
        }
    }

    public int vertexCount() {
        return n;
    }

    /** Adds a directed edge and its reverse residual edge. Returns the forward edge index. */
    public int addEdge(int from, int to, int capacity) {
        if (from < 0 || from >= n || to < 0 || to >= n) {
            throw new IllegalArgumentException("Vertex out of range");
        }
        if (capacity < 0) {
            throw new IllegalArgumentException("Capacity must not be negative");
        }
        int id = edges.size();
        edges.add(new int[] {from, to, capacity, 0});
        edges.add(new int[] {to, from, 0, 0});
        adj.get(from).add(id);
        adj.get(to).add(id + 1);
        return id;
    }

    /** Runs Edmonds-Karp from {@code s} to {@code t} and returns the maximum flow value. */
    public int maxFlow(int s, int t) {
        if (s == t) {
            throw new IllegalArgumentException("Source and sink must differ");
        }
        int flow = 0;
        int[] parentEdge = new int[n];
        while (true) {
            Arrays.fill(parentEdge, -1);
            ArrayDeque<Integer> queue = new ArrayDeque<>();
            queue.add(s);
            parentEdge[s] = -2;
            while (!queue.isEmpty() && parentEdge[t] == -1) {
                int u = queue.poll();
                for (int id : adj.get(u)) {
                    int[] e = edges.get(id);
                    if (parentEdge[e[1]] == -1 && e[2] - e[3] > 0) {
                        parentEdge[e[1]] = id;
                        queue.add(e[1]);
                    }
                }
            }
            if (parentEdge[t] == -1) {
                return flow;
            }
            int bottleneck = Integer.MAX_VALUE;
            for (int v = t; v != s; v = edges.get(parentEdge[v])[0]) {
                int[] e = edges.get(parentEdge[v]);
                bottleneck = Math.min(bottleneck, e[2] - e[3]);
            }
            for (int v = t; v != s; v = edges.get(parentEdge[v])[0]) {
                int id = parentEdge[v];
                edges.get(id)[3] += bottleneck;
                edges.get(id ^ 1)[3] -= bottleneck;
            }
            flow += bottleneck;
            augmentations++;
        }
    }

    public int flowOn(int edgeId) {
        return edges.get(edgeId)[3];
    }

    public int augmentations() {
        return augmentations;
    }

    /** Vertices reachable from {@code s} in the residual graph: the source side of a minimum cut. */
    public boolean[] residualReachable(int s) {
        boolean[] seen = new boolean[n];
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        queue.add(s);
        seen[s] = true;
        while (!queue.isEmpty()) {
            int u = queue.poll();
            for (int id : adj.get(u)) {
                int[] e = edges.get(id);
                if (!seen[e[1]] && e[2] - e[3] > 0) {
                    seen[e[1]] = true;
                    queue.add(e[1]);
                }
            }
        }
        return seen;
    }
}
