package com.gateplanner.algo.exact;

import java.util.Arrays;

/**
 * Exact solver for the full gate assignment problem with preferences, used for the NP-hardness
 * study. Each flight occupies a fixed interval; each flight-stand pair is either forbidden or has a
 * preference cost (for example 0 for a contact stand, 3 for a remote stand that needs a bus); a
 * flight left without a stand costs {@code unplacedCost}. Goal: minimum total cost with no two
 * overlapping flights on one stand.
 *
 * <p><b>Why it is hard:</b> with stand eligibility and costs this is interval scheduling on
 * unrelated machines with eligibility constraints, shown NP-hard by Arkin and Silverberg (1987),
 * and adding passenger transfer costs makes it a quadratic assignment problem. So we do not claim
 * an optimal polynomial algorithm for it. Our planner solves the parts that are provably optimal
 * (fewest stands per class, maximum number of reassigned flights) and this solver measures how far
 * the heuristic is from the true optimum on small inputs.</p>
 *
 * <p><b>Branch and bound:</b> flights in start order; each flight tries its allowed stands from
 * cheapest to dearest, then "unplaced". A stand is free when its last end is at or before the
 * flight's start (all earlier flights start no later). Lower bound = cost so far + the cheapest
 * possible cost of every remaining flight ignoring conflicts; a branch is cut when the bound
 * reaches the best known cost. The greedy heuristic gives the first upper bound. Symmetry
 * breaking: among stands that are still empty and have identical cost columns, only the first is
 * tried, because the others lead to the same costs with stands renamed.</p>
 *
 * <p><b>Time:</b> O((m + 1)^n) in the worst case, far less with pruning. Brute force always
 * explores (m + 1)^n assignments. Heuristic: O(n m). <b>Space:</b> O(n + m) for the search.</p>
 */
public final class ExactGateSolver {

    /** Largest input the exact method accepts. */
    public static final int MAX_FLIGHTS = 18;
    /** Largest input the brute force accepts. */
    public static final int MAX_BRUTE_FORCE = 9;

    /** A small instance. {@code cost[i][j] < 0} means flight i may not use stand j. */
    public record Problem(int[] start, int[] end, int[][] cost, int unplacedCost) {

        public Problem {
            if (start.length != end.length || start.length != cost.length) {
                throw new IllegalArgumentException("start, end and cost must have one row per flight");
            }
            for (int i = 0; i < start.length; i++) {
                if (end[i] <= start[i]) {
                    throw new IllegalArgumentException("Flight " + i + " ends before it starts");
                }
            }
        }

        public int flights() {
            return start.length;
        }

        public int stands() {
            return cost.length == 0 ? 0 : cost[0].length;
        }
    }

    /**
     * A solution: stand per flight (-1 for unplaced), total cost, nodes explored and time taken.
     */
    public record Solution(int[] assignment, int cost, long nodes, double timeMs, String method) {
    }

    private ExactGateSolver() {
    }

    /** Greedy heuristic: flights in start order, each takes its cheapest free allowed stand. */
    public static Solution heuristic(Problem p) {
        long t0 = System.nanoTime();
        int n = p.flights();
        int m = p.stands();
        int[] order = startOrder(p);
        int[] lastEnd = new int[m];
        Arrays.fill(lastEnd, Integer.MIN_VALUE);
        int[] assign = new int[n];
        Arrays.fill(assign, -1);
        int cost = 0;
        long nodes = 0;
        for (int i : order) {
            int best = -1;
            for (int j = 0; j < m; j++) {
                nodes++;
                int c = p.cost()[i][j];
                if (c >= 0 && lastEnd[j] <= p.start()[i] && (best < 0 || c < p.cost()[i][best])) {
                    best = j;
                }
            }
            if (best >= 0) {
                assign[i] = best;
                lastEnd[best] = p.end()[i];
                cost += p.cost()[i][best];
            } else {
                cost += p.unplacedCost();
            }
        }
        return new Solution(assign, cost, nodes, (System.nanoTime() - t0) / 1e6, "heuristic");
    }

    /**
     * Exact optimum by branch and bound.
     *
     * @throws IllegalArgumentException when the instance has more than {@link #MAX_FLIGHTS} flights
     */
    public static Solution branchAndBound(Problem p) {
        if (p.flights() > MAX_FLIGHTS) {
            throw new IllegalArgumentException("Exact solver accepts at most " + MAX_FLIGHTS + " flights, got "
                    + p.flights() + ". Use the smart planner for larger inputs.");
        }
        long t0 = System.nanoTime();
        Search s = new Search(p, true);
        Solution h = heuristic(p);
        s.best = h.cost();
        s.bestAssign = h.assignment().clone();
        s.run();
        return new Solution(s.bestAssign, s.best, s.nodes, (System.nanoTime() - t0) / 1e6, "branch and bound");
    }

    /**
     * Exact optimum by trying every feasible assignment, with no pruning.
     *
     * @throws IllegalArgumentException when the instance has more than {@link #MAX_BRUTE_FORCE} flights
     */
    public static Solution bruteForce(Problem p) {
        if (p.flights() > MAX_BRUTE_FORCE) {
            throw new IllegalArgumentException("Brute force accepts at most " + MAX_BRUTE_FORCE + " flights");
        }
        long t0 = System.nanoTime();
        Search s = new Search(p, false);
        s.best = Integer.MAX_VALUE;
        s.run();
        return new Solution(s.bestAssign, s.best, s.nodes, (System.nanoTime() - t0) / 1e6, "brute force");
    }

    private static int[] startOrder(Problem p) {
        int n = p.flights();
        int[] order = new int[n];
        for (int i = 0; i < n; i++) {
            order[i] = i;
        }
        for (int i = 1; i < n; i++) {
            int v = order[i];
            int j = i - 1;
            while (j >= 0 && p.start()[order[j]] > p.start()[v]) {
                order[j + 1] = order[j];
                j--;
            }
            order[j + 1] = v;
        }
        return order;
    }

    /** Depth-first search shared by branch and bound (pruning on) and brute force (pruning off). */
    private static final class Search {
        private final Problem p;
        private final boolean prune;
        private final int[] order;
        private final int[] lastEnd;
        private final int[] assign;
        private final int[] suffixMin;
        private final int[][] standOrder;
        private final int[] columnClass;
        private int best;
        private int[] bestAssign;
        private long nodes;

        Search(Problem p, boolean prune) {
            this.p = p;
            this.prune = prune;
            int n = p.flights();
            int m = p.stands();
            this.order = startOrder(p);
            this.lastEnd = new int[m];
            Arrays.fill(lastEnd, Integer.MIN_VALUE);
            this.assign = new int[n];
            Arrays.fill(assign, -1);
            this.bestAssign = assign.clone();
            this.suffixMin = new int[n + 1];
            for (int k = n - 1; k >= 0; k--) {
                int i = order[k];
                int c = p.unplacedCost();
                for (int j = 0; j < m; j++) {
                    if (p.cost()[i][j] >= 0) {
                        c = Math.min(c, p.cost()[i][j]);
                    }
                }
                suffixMin[k] = suffixMin[k + 1] + c;
            }
            this.standOrder = new int[n][];
            for (int i = 0; i < n; i++) {
                int[] s = new int[m];
                for (int j = 0; j < m; j++) {
                    s[j] = j;
                }
                final int fi = i;
                for (int a = 1; a < m; a++) {
                    int v = s[a];
                    int b = a - 1;
                    while (b >= 0 && p.cost()[fi][s[b]] > p.cost()[fi][v]) {
                        s[b + 1] = s[b];
                        b--;
                    }
                    s[b + 1] = v;
                }
                standOrder[i] = s;
            }
            // stands whose cost column is identical for every flight are interchangeable
            this.columnClass = new int[m];
            for (int j = 0; j < m; j++) {
                columnClass[j] = j;
                for (int k = 0; k < j; k++) {
                    boolean same = true;
                    for (int i = 0; i < n && same; i++) {
                        same = p.cost()[i][j] == p.cost()[i][k];
                    }
                    if (same) {
                        columnClass[j] = columnClass[k];
                        break;
                    }
                }
            }
        }

        void run() {
            dfs(0, 0);
        }

        private void dfs(int k, int cost) {
            nodes++;
            if (prune && cost + suffixMin[k] >= best) {
                return;
            }
            if (k == order.length) {
                if (cost < best) {
                    best = cost;
                    bestAssign = assign.clone();
                }
                return;
            }
            int i = order[k];
            boolean[] triedEmpty = new boolean[columnClass.length];
            for (int j : standOrder[i]) {
                int c = p.cost()[i][j];
                if (c < 0 || lastEnd[j] > p.start()[i]) {
                    continue;
                }
                if (prune && lastEnd[j] == Integer.MIN_VALUE) {
                    // symmetry breaking: two empty, interchangeable stands lead to the same subtree
                    if (triedEmpty[columnClass[j]]) {
                        continue;
                    }
                    triedEmpty[columnClass[j]] = true;
                }
                int saved = lastEnd[j];
                lastEnd[j] = p.end()[i];
                assign[i] = j;
                dfs(k + 1, cost + c);
                assign[i] = -1;
                lastEnd[j] = saved;
            }
            dfs(k + 1, cost + p.unplacedCost());
        }
    }
}
