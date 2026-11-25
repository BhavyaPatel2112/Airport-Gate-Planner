# Benchmarks and dataset notes

## Method

- Every algorithm is compared with its baseline at three or more input sizes: the real day
  (about 650 stand visits), 10 times and 100 times that traffic.
- Inputs are generated from a fixed seed (42) with the shape of the real day: two traffic peaks,
  45 to 75 minute narrow-body visits, 90 to 150 minute wide-body visits.
- Each measurement: one warm-up run, then five timed runs; the median is reported.
- Raw results: one CSV per suite in this folder, and `all.csv` with everything.
- Regenerate: `./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.bench.BenchmarkRunner -Dexec.args="../docs/benchmarks"`
  from `backend/`. The same suites run live from the Proof and Benchmark Lab in the app.

Machine: Apple Silicon Mac, Java 17 (Homebrew OpenJDK 17.0.18). Absolute times vary by machine;
the growth between sizes is what matters.

## Results (median milliseconds)

| Suite | n | Ours | Baseline | Note |
|---|---|---|---|---|
| Counting sort vs merge sort | 650 / 6,500 / 65,000 | 0.08 / 0.41 / 1.37 | 0.10 / 1.17 / 7.45 | O(n + k) against O(n log n): 5 times faster at 100x |
| Segment tree vs recount | 650 / 6,500 / 65,000 | 0.32 / 1.21 / 10.3 | 9.4 / 53.2 / 542 | 200 delay updates with the peak after each: 53 times faster at 100x |
| Interval tree vs linear scan | 650 / 6,500 / 65,000 | 0.21 / 0.26 / 0.37 | 1.96 / 4.26 / 41.3 | 2,000 conflict queries on one stand's timeline: 113 times faster at 100x; tree height 16 / 23 / 29 |
| Matching vs greedy first-fit | 65 / 650 / 6,500 flights | 56 / 552 / 5,593 placed | 49 / 473 / 4,805 placed | Matching always places the maximum; greedy is faster but places up to 14 percent fewer |
| Trie vs linear scan | 650 / 6,500 / 65,000 keys | 0.64 / 0.76 / 0.56 | 2.2 / 11.0 / 132 | Prefix cost depends on the prefix, not on how many flights are stored |
| Fibonacci vs binary heap | 650 / 6,500 / 65,000 | 1.3 / 11.4 / 103 | 0.7 / 5.7 / 33 | See the note below |
| Suffix tree vs KMP | 65 / 650 / 6,500 searches | 1.4 / 1.1 / 4.0 | 1.9 / 1.9 / 17.9 | The tree is built once; KMP rescans the text for every search |
| Quickselect vs median-of-medians vs sort | 650 / 6,500 / 65,000 | 0.06 / 0.28 / 1.07 | 0.19 / 0.28 / 2.55 (MoM), 0.36 / 4.36 / 8.17 (sort) | All three return the same 90th percentile |
| Exact branch and bound vs our heuristic | 6 to 16 flights | heuristic under 0.01 ms | 0.03 ms at 8 flights, 62 ms at 14, 3.9 s at 16 | Exponential growth; the heuristic matched the optimum on these instances |

### What the results show

- **Fibonacci heap.** The Fibonacci heap has the better amortised bound for decrease-key (O(1)
  against O(log n)), but on this workload the array-based binary heap is about three times faster.
  Pointer-heavy nodes, allocation and cache misses cost more than the saved comparisons at these
  sizes. This is the expected practical result and we report it as measured. The Fibonacci heap
  still gives the planner O(1) insert and decrease-key, and its root list and cascading cuts are
  shown live in the machine view.
- **Matching.** Greedy first-fit is much faster but places fewer flights whenever a flight with
  few options is blocked by one with many. Matching is provably maximum (no augmenting path left).
- **NP-hardness.** Nodes explored by branch and bound grow from 80 at 6 flights to over 7 million
  at 14. Our planner answers in microseconds; on these seeded instances its cost equalled the exact
  optimum, but no such guarantee exists in general because the full problem is NP-hard.

## Dataset notes

### Stands (`data/stands.csv`)

- 136 stands: Terminal 2 (X-shaped, four piers with jet bridges, two remote columns and a south
  remote apron) and Terminal 1 (one row of stands).
- 71 stand ids were seen as gate numbers in the real flight data (`source = observed`); 65 were
  added to complete the layout (`source = assumed`). Positions are drawn to match the terminal
  shape; they are not survey coordinates.
- Classes: T2 domestic narrow 63, T2 domestic wide 3, T2 international narrow 28, T2 international
  wide 16, T1 domestic narrow 24, T1 international narrow 2.
- Each stand records the taxiway that serves it, so a taxiway notice closes the right stands.

### Notices (`data/notices.txt`)

24 notices in the official format. 12 close stands (some for a time window, some all day); the
rest are runway, lighting, bird, crane and drone notices that are accepted as text but flagged as
outside the model. The parser rejects unknown stands, unknown taxiways, invalid times and end times
before start times with a clear message.

### Delay statistics (`data/delay_stats.csv`)

Per airline from both days: departures, median delay, 90th percentile delay, on-time share (no
more than 15 minutes late) and the plan buffer at the 75th percentile. All percentiles come from
randomized Quickselect with seed 42.

Departure times in the source data are close to take-off, so measured departure delays include
taxi-out time (IndiGo median 29 minutes, 90th percentile 85). For this reason plan buffers use the
75th percentile by default and are capped at 60 minutes.
