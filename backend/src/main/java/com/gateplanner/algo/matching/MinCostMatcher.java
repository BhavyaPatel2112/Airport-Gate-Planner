package com.gateplanner.algo.matching;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.PriorityQueue;

/**
 * Minimum-cost maximum bipartite matching by min-cost max-flow (successive shortest paths).
 *
 * <p>Same network as {@link BipartiteMatcher}: source to every flight, flight to each stand it may use,
 * stand to sink, every capacity 1. Each flight-to-stand edge also has a cost (for the planner: 0 to
 * stay on its own stand, a large penalty plus the towing distance to move, a small penalty for a
 * remote stand). Each round finds the cheapest augmenting path from source to sink with Dijkstra on
 * reduced costs (Johnson potentials keep them non-negative even on the residual back edges) and pushes
 * one unit of flow along it. After k rounds the flow is a cheapest matching of size k, so when no path
 * is left the matching is both maximum (as large as Edmonds-Karp's) and the cheapest of that size.</p>
 *
 * <p><b>Time:</b> O(F (E + V) log V) for a matching of size F. <b>Space:</b> O(V + E).</p>
 */
public final class MinCostMatcher {

    private final int left;
    private final int right;
    private final List<List<Integer>> adjacency;
    private final List<List<Long>> costs;
    private int[] matchLeft;
    private long totalCost;
    private int rounds;

    // residual graph in arrays
    private int[] to;
    private int[] cap;
    private long[] cost;
    private int[] next;
    private int[] head;
    private int edges;

    /**
     * @param adjacency for each left vertex, the right vertices it may be matched to
     * @param costs     for each left vertex, the cost of each of those edges (same order, non-negative)
     */
    public MinCostMatcher(int left, int right, List<List<Integer>> adjacency, List<List<Long>> costs) {
        if (adjacency.size() != left || costs.size() != left) {
            throw new IllegalArgumentException("Adjacency and costs must have one entry per left vertex");
        }
        for (int i = 0; i < left; i++) {
            if (adjacency.get(i).size() != costs.get(i).size()) {
                throw new IllegalArgumentException("Left vertex " + i + " needs one cost per edge");
            }
            for (long c : costs.get(i)) {
                if (c < 0) {
                    throw new IllegalArgumentException("Costs must be non-negative");
                }
            }
        }
        this.left = left;
        this.right = right;
        this.adjacency = adjacency;
        this.costs = costs;
    }

    private void addEdge(int u, int v, int c, long w) {
        to[edges] = v; cap[edges] = c; cost[edges] = w; next[edges] = head[u]; head[u] = edges++;
        to[edges] = u; cap[edges] = 0; cost[edges] = -w; next[edges] = head[v]; head[v] = edges++;
    }

    /** Solves and returns the matching size. */
    public int solve() {
        int n = left + right + 2;
        int source = 0;
        int sink = n - 1;
        int m = left + right;
        for (List<Integer> a : adjacency) {
            m += a.size();
        }
        to = new int[2 * m];
        cap = new int[2 * m];
        cost = new long[2 * m];
        next = new int[2 * m];
        head = new int[n];
        Arrays.fill(head, -1);
        edges = 0;
        for (int i = 0; i < left; i++) {
            addEdge(source, 1 + i, 1, 0);
        }
        for (int i = 0; i < left; i++) {
            List<Integer> a = adjacency.get(i);
            for (int k = 0; k < a.size(); k++) {
                int j = a.get(k);
                if (j < 0 || j >= right) {
                    throw new IllegalArgumentException("Right vertex " + j + " out of range");
                }
                addEdge(1 + i, 1 + left + j, 1, costs.get(i).get(k));
            }
        }
        for (int j = 0; j < right; j++) {
            addEdge(1 + left + j, sink, 1, 0);
        }
        long[] pot = new long[n];
        long[] dist = new long[n];
        int[] via = new int[n];
        int flow = 0;
        totalCost = 0;
        rounds = 0;
        while (true) {
            Arrays.fill(dist, Long.MAX_VALUE);
            Arrays.fill(via, -1);
            dist[source] = 0;
            PriorityQueue<long[]> pq = new PriorityQueue<>((x, y) -> Long.compare(x[0], y[0]));
            pq.add(new long[] {0, source});
            while (!pq.isEmpty()) {
                long[] top = pq.poll();
                int u = (int) top[1];
                if (top[0] > dist[u]) {
                    continue;
                }
                for (int e = head[u]; e != -1; e = next[e]) {
                    if (cap[e] <= 0) {
                        continue;
                    }
                    int v = to[e];
                    long nd = dist[u] + cost[e] + pot[u] - pot[v];
                    if (nd < dist[v]) {
                        dist[v] = nd;
                        via[v] = e;
                        pq.add(new long[] {nd, v});
                    }
                }
            }
            if (dist[sink] == Long.MAX_VALUE) {
                break;
            }
            for (int v = 0; v < n; v++) {
                if (dist[v] != Long.MAX_VALUE) {
                    pot[v] += dist[v];
                }
            }
            // every edge has capacity 1, so each shortest path carries exactly one unit
            for (int v = sink; v != source; v = to[via[v] ^ 1]) {
                cap[via[v]] -= 1;
                cap[via[v] ^ 1] += 1;
                totalCost += cost[via[v]];
            }
            flow++;
            rounds++;
        }
        matchLeft = new int[left];
        Arrays.fill(matchLeft, -1);
        for (int i = 0; i < left; i++) {
            for (int e = head[1 + i]; e != -1; e = next[e]) {
                int v = to[e];
                if (v > left && v <= left + right && (e & 1) == 0 && cap[e] == 0) {
                    matchLeft[i] = v - 1 - left;
                }
            }
        }
        return flow;
    }

    /** For each left vertex, the matched right vertex or -1. */
    public int[] matchLeft() {
        if (matchLeft == null) {
            throw new IllegalStateException("Call solve() first");
        }
        return matchLeft.clone();
    }

    /** Sum of the costs of the matched edges. */
    public long totalCost() {
        return totalCost;
    }

    /** Shortest augmenting paths found (one per matched flight). */
    public int rounds() {
        return rounds;
    }

    /** Convenience: all costs zero except those listed, for tests and small examples. */
    public static List<List<Long>> zeroCosts(List<List<Integer>> adjacency) {
        List<List<Long>> out = new ArrayList<>();
        for (List<Integer> a : adjacency) {
            List<Long> c = new ArrayList<>();
            for (int k = 0; k < a.size(); k++) {
                c.add(0L);
            }
            out.add(c);
        }
        return out;
    }
}
