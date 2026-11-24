package com.gateplanner.bench;

import com.gateplanner.algo.exact.ExactGateSolver;
import com.gateplanner.algo.heap.BinaryHeap;
import com.gateplanner.algo.heap.FibonacciHeap;
import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.matching.BipartiteMatcher;
import com.gateplanner.algo.matching.GreedyFirstFit;
import com.gateplanner.algo.segtree.LazySegmentTree;
import com.gateplanner.algo.select.MedianOfMedians;
import com.gateplanner.algo.select.RandomizedQuickselect;
import com.gateplanner.algo.sort.CountingSort;
import com.gateplanner.algo.sort.MergeSort;
import com.gateplanner.algo.text.KmpMatcher;
import com.gateplanner.algo.text.SuffixTree;
import com.gateplanner.algo.trie.Trie;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.Supplier;

/**
 * Benchmarks every algorithm against its baseline at three or more input sizes: the real day
 * (about 650 stand visits), 10 times and 100 times that. Inputs are generated from a fixed seed
 * with the real day's shape (start minutes, durations, delay distribution). Each measurement is
 * one warm-up run, then five timed runs; the median is reported.
 *
 * <p>Run all suites and save CSV files to docs/benchmarks:</p>
 * <pre>./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.bench.BenchmarkRunner -Dexec.args="../docs/benchmarks"</pre>
 */
public final class BenchmarkRunner {

    public static final List<String> SUITES = List.of("sort", "segtree", "interval", "matching", "trie", "heap",
            "text", "select", "exact");
    public static final int REAL_DAY = 650;
    private static final int RUNS = 5;

    /** One measurement row. {@code quality} is a result figure (placed flights, cost) where it matters. */
    public record Row(String suite, int n, String method, double medianMs, String quality, String note) {
    }

    private BenchmarkRunner() {
    }

    public static void main(String[] args) throws IOException {
        Path out = Path.of(args.length > 0 ? args[0] : "../docs/benchmarks");
        Files.createDirectories(out);
        List<Row> all = new ArrayList<>();
        for (String suite : SUITES) {
            List<Row> rows = run(suite, null, 42L);
            all.addAll(rows);
            write(out.resolve(suite + ".csv"), rows);
            System.out.println("benchmark " + suite + ": " + rows.size() + " rows");
        }
        write(out.resolve("all.csv"), all);
    }

    private static void write(Path file, List<Row> rows) throws IOException {
        try (PrintWriter w = new PrintWriter(Files.newBufferedWriter(file, StandardCharsets.UTF_8))) {
            w.println("suite,n,method,median_ms,quality,note");
            for (Row r : rows) {
                w.println(r.suite() + "," + r.n() + "," + r.method() + "," + r.medianMs() + "," + r.quality() + ","
                        + r.note().replace(",", ";"));
            }
        }
    }

    /** Default sizes per suite. */
    public static int[] defaultSizes(String suite) {
        if (suite.equals("exact")) {
            return new int[] {6, 8, 10, 12, 14, 16};
        }
        if (suite.equals("matching")) {
            return new int[] {65, 650, 6500};
        }
        return new int[] {REAL_DAY, REAL_DAY * 10, REAL_DAY * 100};
    }

    public static List<Row> run(String suite, int[] sizes, long seed) {
        int[] ns = sizes == null || sizes.length == 0 ? defaultSizes(suite) : sizes;
        List<Row> rows = new ArrayList<>();
        for (int n : ns) {
            if (n < 1 || n > 200_000) {
                throw new IllegalArgumentException("Benchmark size must be between 1 and 200000");
            }
            switch (suite) {
                case "sort" -> sort(n, seed, rows);
                case "segtree" -> segtree(n, seed, rows);
                case "interval" -> interval(n, seed, rows);
                case "matching" -> matching(n, seed, rows);
                case "trie" -> trie(n, seed, rows);
                case "heap" -> heap(n, seed, rows);
                case "text" -> text(n, seed, rows);
                case "select" -> select(n, seed, rows);
                case "exact" -> exact(Math.min(n, ExactGateSolver.MAX_FLIGHTS), seed, rows);
                default -> throw new IllegalArgumentException("Unknown suite " + suite + ". Use one of " + SUITES);
            }
        }
        return rows;
    }

    // ---------- measurement ----------

    static double median(Supplier<Object> work) {
        work.get();
        double[] t = new double[RUNS];
        for (int i = 0; i < RUNS; i++) {
            long t0 = System.nanoTime();
            Object r = work.get();
            t[i] = (System.nanoTime() - t0) / 1e6;
            if (r == null) {
                t[i] += 0;
            }
        }
        insertionSort(t);
        return Math.round(t[RUNS / 2] * 1000.0) / 1000.0;
    }

    private static void insertionSort(double[] a) {
        for (int i = 1; i < a.length; i++) {
            double v = a[i];
            int j = i - 1;
            while (j >= 0 && a[j] > v) {
                a[j + 1] = a[j];
                j--;
            }
            a[j + 1] = v;
        }
    }

    /** Start minutes shaped like a real day: two peaks (morning and evening). */
    static int[] starts(int n, Random rnd) {
        int[] s = new int[n];
        for (int i = 0; i < n; i++) {
            double peak = rnd.nextBoolean() ? 8 * 60 : 20 * 60;
            int v = (int) Math.round(peak + rnd.nextGaussian() * 180);
            s[i] = Math.max(0, Math.min(1439, v));
        }
        return s;
    }

    static int duration(Random rnd) {
        return rnd.nextDouble() < 0.12 ? 90 + rnd.nextInt(60) : 45 + rnd.nextInt(30);
    }

    // ---------- suites ----------

    private static void sort(int n, long seed, List<Row> rows) {
        int[] s = starts(n, new Random(seed));
        List<Integer> boxed = new ArrayList<>();
        for (int v : s) {
            boxed.add(v);
        }
        rows.add(new Row("sort", n, "counting sort", median(() -> CountingSort.sort(boxed, x -> x, 1439)), "",
                "O(n + k), k = 1440"));
        rows.add(new Row("sort", n, "merge sort", median(() -> MergeSort.sort(boxed, Integer::compare)), "",
                "O(n log n)"));
    }

    private static void segtree(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        int[] s = starts(n, rnd);
        int[] e = new int[n];
        for (int i = 0; i < n; i++) {
            e[i] = Math.min(2880, s[i] + duration(rnd));
        }
        int updates = 200;
        int[] who = new int[updates];
        int[] delay = new int[updates];
        for (int i = 0; i < updates; i++) {
            who[i] = rnd.nextInt(n);
            delay[i] = 5 + rnd.nextInt(60);
        }
        rows.add(new Row("segtree", n, "lazy segment tree", median(() -> {
            LazySegmentTree t = new LazySegmentTree(2880);
            int[] ee = e.clone();
            for (int i = 0; i < n; i++) {
                t.rangeAdd(s[i], ee[i], 1);
            }
            long peak = 0;
            for (int u = 0; u < updates; u++) {
                int i = who[u];
                int ne = Math.min(2880, ee[i] + delay[u]);
                if (ne > ee[i]) {
                    t.rangeAdd(ee[i], ne, 1);
                }
                ee[i] = ne;
                peak = t.rangeMax(0, 2880);
            }
            return peak;
        }), "", "build + " + updates + " delay updates, peak after each: O((n + q) log k)"));
        rows.add(new Row("segtree", n, "recount per minute", median(() -> {
            int[] ee = e.clone();
            long peak = 0;
            for (int u = 0; u < updates; u++) {
                int i = who[u];
                ee[i] = Math.min(2880, ee[i] + delay[u]);
                int[] count = new int[2880];
                for (int j = 0; j < n; j++) {
                    for (int m = s[j]; m < ee[j]; m++) {
                        count[m]++;
                    }
                }
                peak = 0;
                for (int c : count) {
                    peak = Math.max(peak, c);
                }
            }
            return peak;
        }), "", "recount every minute after each update: O(q n d)"));
    }

    private static void interval(int n, long seed, List<Row> rows) {
        // one long stand timeline (n visits back to back with gaps), the shape a stand's tree holds
        Random rnd = new Random(seed);
        int[] s = new int[n];
        int[] e = new int[n];
        RedBlackIntervalTree<Integer> tree = new RedBlackIntervalTree<>();
        for (int i = 0; i < n; i++) {
            s[i] = i * 60 + rnd.nextInt(10);
            e[i] = s[i] + 30 + rnd.nextInt(26);
            tree.insert(s[i], e[i], i);
        }
        int queries = 2000;
        int[] qs = new int[queries];
        for (int i = 0; i < queries; i++) {
            qs[i] = rnd.nextInt(n * 60);
        }
        rows.add(new Row("interval", n, "red-black interval tree", median(() -> {
            int hits = 0;
            for (int q : qs) {
                hits += tree.overlaps(q, q + 45).size();
            }
            return hits;
        }), "height " + tree.height(), queries + " conflict queries (all overlaps): O(log n + k) each"));
        rows.add(new Row("interval", n, "linear scan", median(() -> {
            int hits = 0;
            for (int q : qs) {
                for (int i = 0; i < n; i++) {
                    if (s[i] < q + 45 && q < e[i]) {
                        hits++;
                    }
                }
            }
            return hits;
        }), "", queries + " conflict queries: O(n) each"));
    }

    private static void matching(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        int stands = Math.max(4, (int) (n * 0.9));
        int wide = stands / 5;
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            boolean isWide = rnd.nextDouble() < 0.2;
            List<Integer> a = new ArrayList<>();
            int degree = 2 + rnd.nextInt(4);
            for (int d = 0; d < degree; d++) {
                int j = isWide ? rnd.nextInt(wide) : rnd.nextInt(stands);
                if (!a.contains(j)) {
                    a.add(j);
                }
            }
            // contact-first order puts the scarce wide stands early in every list
            for (int x = 1; x < a.size(); x++) {
                int v = a.get(x);
                int y = x - 1;
                while (y >= 0 && a.get(y) > v) {
                    a.set(y + 1, a.get(y));
                    y--;
                }
                a.set(y + 1, v);
            }
            adj.add(a);
        }
        int[] placed = new int[2];
        double mt = median(() -> {
            BipartiteMatcher m = new BipartiteMatcher(n, stands, adj);
            placed[0] = m.solve();
            return placed[0];
        });
        double gt = median(() -> {
            placed[1] = GreedyFirstFit.size(GreedyFirstFit.match(n, stands, adj));
            return placed[1];
        });
        rows.add(new Row("matching", n, "maximum matching", mt, placed[0] + " placed", "Edmonds-Karp: optimal count"));
        rows.add(new Row("matching", n, "greedy first-fit", gt, placed[1] + " placed", "first free stand in list order"));
    }

    private static void trie(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        String[] codes = {"AI", "6E", "QP", "IX", "SG", "EK", "EY", "BA", "SQ", "LH", "QR", "TK"};
        String[] keys = new String[n];
        Trie<Integer> trie = new Trie<>();
        for (int i = 0; i < n; i++) {
            keys[i] = codes[rnd.nextInt(codes.length)] + (100 + rnd.nextInt(9900));
            trie.insert(keys[i], i);
        }
        String[] prefixes = new String[500];
        for (int i = 0; i < prefixes.length; i++) {
            String k = keys[rnd.nextInt(n)];
            prefixes[i] = k.substring(0, Math.min(k.length(), 3 + rnd.nextInt(2)));
        }
        rows.add(new Row("trie", n, "trie prefix search", median(() -> {
            int c = 0;
            for (String p : prefixes) {
                c += trie.startsWith(p, 8).size();
            }
            return c;
        }), trie.nodeCount() + " nodes", "500 searches, top 8: O(m + s) each"));
        rows.add(new Row("trie", n, "linear scan", median(() -> {
            int c = 0;
            for (String p : prefixes) {
                int found = 0;
                for (String k : keys) {
                    if (k.startsWith(p) && found < 8) {
                        found++;
                    }
                }
                c += found;
            }
            return c;
        }), "", "500 searches: O(n m) each"));
    }

    private static void heap(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        int ops = n * 8;
        int[] keys = new int[n];
        for (int i = 0; i < n; i++) {
            keys[i] = 10_000 + rnd.nextInt(100_000);
        }
        int[] targets = new int[ops];
        int[] amounts = new int[ops];
        for (int i = 0; i < ops; i++) {
            targets[i] = rnd.nextInt(n);
            amounts[i] = 2_000 + rnd.nextInt(20_000);
        }
        rows.add(new Row("heap", n, "Fibonacci heap", median(() -> {
            FibonacciHeap<Integer> h = new FibonacciHeap<>();
            List<FibonacciHeap.Node<Integer>> nodes = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                nodes.add(h.insert(keys[i], i));
            }
            long sum = 0;
            for (int i = 0; i < ops; i++) {
                FibonacciHeap.Node<Integer> x = nodes.get(targets[i]);
                if (x.inHeap()) {
                    h.decreaseKey(x, x.key() - amounts[i]);
                }
                if (i % 8 == 7 && !h.isEmpty()) {
                    sum += h.extractMin().key();
                }
            }
            return sum;
        }), "", n + " inserts, " + ops + " decrease-keys, " + (ops / 8) + " extract-mins"));
        rows.add(new Row("heap", n, "binary heap", median(() -> {
            BinaryHeap<Integer> h = new BinaryHeap<>();
            List<BinaryHeap.Node<Integer>> nodes = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                nodes.add(h.insert(keys[i], i));
            }
            long sum = 0;
            for (int i = 0; i < ops; i++) {
                BinaryHeap.Node<Integer> x = nodes.get(targets[i]);
                if (x.inHeap()) {
                    h.decreaseKey(x, x.key() - amounts[i]);
                }
                if (i % 8 == 7 && !h.isEmpty()) {
                    sum += h.extractMin().key();
                }
            }
            return sum;
        }), "", "same workload, O(log n) decrease-key"));
    }

    private static void text(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        String[] words = {"VABB", "STAND", "CLSD", "TWY", "RWY", "DUE", "WIP", "GSE", "MAINT", "U/S", "LGT"};
        StringBuilder b = new StringBuilder();
        int lines = 40;
        for (int i = 0; i < lines; i++) {
            b.append(" VABB STAND ").append(10 + rnd.nextInt(80)).append(rnd.nextBoolean() ? "A" : "");
            for (int w = 0; w < 4; w++) {
                b.append(' ').append(words[rnd.nextInt(words.length)]);
            }
            b.append(" \n");
        }
        String text = b.toString();
        int searches = Math.max(10, n / 10);
        String[] patterns = new String[searches];
        for (int i = 0; i < searches; i++) {
            patterns[i] = " " + (10 + rnd.nextInt(80)) + (rnd.nextBoolean() ? "A" : "") + " ";
        }
        rows.add(new Row("text", searches, "suffix tree", median(() -> {
            SuffixTree t = new SuffixTree(text);
            int c = 0;
            for (String p : patterns) {
                c += t.search(p).size();
            }
            return c;
        }), text.length() + " chars", "build once, then O(m + occ) per search"));
        rows.add(new Row("text", searches, "KMP per search", median(() -> {
            int c = 0;
            for (String p : patterns) {
                c += KmpMatcher.search(text, p).size();
            }
            return c;
        }), "", "O(n + m) per search"));
    }

    private static void select(int n, long seed, List<Row> rows) {
        Random rnd = new Random(seed);
        double[] v = new double[n];
        for (int i = 0; i < n; i++) {
            v[i] = Math.round(Math.max(-20, rnd.nextGaussian() * 18 + 8));
        }
        int k = RandomizedQuickselect.rankFor(n, 90);
        double[] answer = new double[3];
        rows.add(new Row("select", n, "randomized Quickselect", median(() -> {
            answer[0] = new RandomizedQuickselect(seed).select(v, k);
            return answer[0];
        }), "p90 = " + answer[0], "expected O(n)"));
        rows.add(new Row("select", n, "median-of-medians", median(() -> {
            answer[1] = new MedianOfMedians().select(v, k);
            return answer[1];
        }), "p90 = " + answer[1], "worst case O(n)"));
        List<Double> boxed = new ArrayList<>();
        for (double d : v) {
            boxed.add(d);
        }
        rows.add(new Row("select", n, "full merge sort", median(() -> {
            answer[2] = MergeSort.sort(boxed, Double::compare).get(k);
            return answer[2];
        }), "p90 = " + answer[2], "O(n log n)"));
    }

    /** Small gate assignment instances shaped like a busy pier. */
    public static ExactGateSolver.Problem exactProblem(int n, long seed) {
        Random rnd = new Random(seed);
        int stands = Math.max(2, (n + 2) / 3);
        int[] s = new int[n];
        int[] e = new int[n];
        int[][] cost = new int[n][stands];
        for (int i = 0; i < n; i++) {
            s[i] = rnd.nextInt(240);
            e[i] = s[i] + 45 + rnd.nextInt(60);
            boolean wide = rnd.nextDouble() < 0.25;
            for (int j = 0; j < stands; j++) {
                boolean wideStand = j % 3 == 0;
                boolean contact = j < (stands + 1) / 2;
                cost[i][j] = wide && !wideStand ? -1 : (contact ? 0 : 3) + (wideStand && !wide ? 1 : 0);
            }
        }
        return new ExactGateSolver.Problem(s, e, cost, 20);
    }

    private static void exact(int n, long seed, List<Row> rows) {
        ExactGateSolver.Problem p = exactProblem(n, seed);
        ExactGateSolver.Solution[] r = new ExactGateSolver.Solution[3];
        double bb = median(() -> {
            r[0] = ExactGateSolver.branchAndBound(p);
            return r[0];
        });
        double h = median(() -> {
            r[1] = ExactGateSolver.heuristic(p);
            return r[1];
        });
        rows.add(new Row("exact", n, "branch and bound", bb, "cost " + r[0].cost() + ", " + r[0].nodes() + " nodes",
                "exact optimum, exponential worst case"));
        rows.add(new Row("exact", n, "our heuristic", h, "cost " + r[1].cost(), "O(n m), gap "
                + (r[1].cost() - r[0].cost())));
        if (n <= ExactGateSolver.MAX_BRUTE_FORCE) {
            double bf = median(() -> {
                r[2] = ExactGateSolver.bruteForce(p);
                return r[2];
            });
            rows.add(new Row("exact", n, "brute force", bf, "cost " + r[2].cost() + ", " + r[2].nodes() + " nodes",
                    "every feasible assignment"));
        }
    }
}
