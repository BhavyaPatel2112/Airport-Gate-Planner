# Mumbai Airport, Live: Gate Planner

A live, animated stand (gate) planner for Chhatrapati Shivaji Maharaj International Airport, Mumbai
(ICAO VABB, IATA BOM), built on two real days of flights (16 and 17 November 2026).

It gives every flight a compatible stand on the fewest stands possible and proves it, adds safety
buffers from each airline's real delays, recovers in milliseconds when flights are delayed or
cancelled, a monsoon hits, or an airport notice closes stands, and explains every decision,
including exactly why a flight cannot be placed when that happens.

All planning runs in Java (Spring Boot). The React frontend only collects input and draws what the
backend returns.

Advanced Algorithm, Continuous Internal Assessment 3, Semester V, B.Tech CS AI and ML,
ATLAS SkillTech University. Team: Bhavya Patel and Tanushree Bhatt.

Live demo: https://mumbai-gate-planner.azurewebsites.net

![The airport with the Overview tab: 104 stands used, the proven minimum](docs/screenshots/overview.jpg)

## What it does

The app is one screen: the 3D airport in the middle, a timeline dock at the bottom and a side panel
with four tabs (Overview, Scenario lab, Algorithms, Flights). A short story flight introduces it.

| Feature | What you see | Algorithm (unit) |
|---|---|---|
| Story flight | A cabin where six overhead bins, one per syllabus unit, open to explain that unit; then a nonstop flight on a globe from New York to Mumbai | Display only |
| Story arrival | A real flight (AI 116) lands during a storm twice: once with a fixed stand plan, once with the planner | Bipartite matching and min-cost flow (U5) |
| 3D airport | A Three.js model built from the stand layout: terminals, jet bridges, aircraft that land, taxi, park and take off, ground vehicles and the city; camera views for the tower, whole airport, each terminal, the runway and the remote apron; layers for labels, closed stands and a stand use heat map | Display only; every position follows the stands and times from Java |
| Live day | Real flights replayed on a clock (1, 5 or 15 minutes a second); the timeline shows how many stands are busy | Counting sort (U1), segment tree (U3) |
| Overview tab | Stands used against the busiest moment, per stand class: the proof that no plan can use fewer | Interval partitioning on a Fibonacci heap (U2), segment tree lower bound (U3) |
| Scenario lab | Five ready scenarios (Monsoon afternoon, Fog at dawn, Pier closed at the peak, Greedy trap, Perfect storm), your own scenario built from nine disruption types, or "Right now" to act at the current time; every moved aircraft is listed with its old and new stand | Red-black interval tree (U3), Edmonds-Karp matching, min-cost flow (U5), randomized Quickselect (U6), suffix tree for notices (U4) |
| Holding stack | Flights left without a stand, each with a plain-English reason, and "Fix everything" to re-plan them | Minimum cut and Hall's theorem (U5), Fibonacci heap (U2) |
| Flight card | Click any aircraft: a boarding pass with its stand, why it moved and why this stand; delay or cancel it from there | Red-black interval tree (U3), bipartite matching (U5) |
| Algorithms tab | All six units with their live data structures (Fibonacci heap, red-black tree, matching, suffix tree, availability radar) and the time each took on this plan; the greedy against matching race and the benchmark lab | All, plus the NP-hardness study (U6) |
| Flights tab | Search by flight, airline, city or registration; departures board | Trie (U4) |
| Guide | A one-minute tour of the screen, reopened from the Guide button | None |

## Quick start

Prerequisites: Java 17, Node.js 26 (npm 11). Maven is not needed; the wrapper downloads it.

```bash
# 1. backend (http://localhost:8080)
cd backend
./mvnw spring-boot:run

# 2. frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and choose **Board the story flight** or **Go straight to the airport**.
The demo runs entirely from the saved CSV files; no internet connection is needed.

Useful URL options: `?start=1` goes straight to the airport, `?start=story` opens the story flight,
`?t=840` sets the clock (minutes after midnight), `?day=2` opens 17 November, `?guide=0` skips the
tour.

### Run the tests and benchmarks

```bash
cd backend
./mvnw test                                   # 132 JUnit tests
./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.bench.BenchmarkRunner -Dexec.args="../docs/benchmarks"
```

### Fetching fresh flight data (optional)

The saved data already covers both days. To fetch it again you need a free AeroDataBox key from
RapidAPI, set as an environment variable (never commit it):

```bash
export AERODATABOX_KEY="your-key"
cd backend
./mvnw -q compile exec:java -Dexec.mainClass=com.gateplanner.data.FlightFetcher -Dexec.args="fetch ../data 2026-11-16"
```

`convert` instead of `fetch` rebuilds the CSV files from the saved raw JSON in `data/raw/`.

## Data

| Data | Source | Real or assumed |
|---|---|---|
| Flights: 837 movements on 16 Nov, 871 on 17 Nov | AeroDataBox airport arrivals and departures for VABB (RapidAPI) | Real |
| Delays | Actual (revised) time minus scheduled time, same data | Real |
| Stands (136) | 71 ids observed as gates in the flight data; the rest complete the layout. Each row says `observed` or `assumed` | Partly assumed |
| Notices (24) | Written in the official format, for example `VABB STAND 45A2 CLSD 0100-0500` | Sample content |
| Rush hour arrivals | Generated from the real airline and size mix with a seed, labelled `RUSH` | Simulated |

Flight data attribution: AeroDataBox (https://aerodatabox.com) via RapidAPI. More detail on the
stand list, notices and delay statistics is in [docs/benchmarks/README.md](docs/benchmarks/README.md).

### Assumptions

- An arrival and a departure with the same aircraft registration, 25 minutes to 10 hours apart at
  the same terminal, form one stand visit (on block to off block). Otherwise a standard turnaround
  is used: 45 minutes narrow-body, 90 minutes wide-body.
- Wide-body aircraft (A330, A340, A350, A380, B777, B787, B747) need wide stands. International
  flights need international stands and domestic flights domestic stands; each flight stays at its
  own terminal.
- Each visit is followed by a buffer equal to the airline's real departure delay at the chosen
  percentile, capped at 60 minutes. The default is the 75th percentile: departure times in the
  data are close to take-off, so they include taxi-out, and at the 90th percentile every airline
  already exceeds the cap. The slider in the Scenario lab offers 50 to 99.
- The plan is built on scheduled times; the **Replay the real day** disruption replays the actual times and recovers.

## How the planner works

1. **Sort.** Counting sort orders the stand visits by start minute in O(n + k).
2. **Assign.** For each stand class (terminal, international or domestic, size) the stands in use
   sit in a Fibonacci heap keyed by the minute they become free. A visit takes the stand that frees
   earliest if it is free in time, otherwise the class opens a new stand (jet bridge stands first).
   Visits whose class is full go to a holding stack and are then placed by maximum matching on any
   compatible stand with a gap.
3. **Record.** Each placement goes into that stand's red-black interval tree and the occupancy
   segment tree.
4. **Prove.** Inside one class all stands are interchangeable and interval partitioning opens a new
   stand only when all open stands are busy, so stands used equals the busiest moment, which the
   segment tree measures. No plan can do better, because overlapping visits need different stands.
5. **Recover.** After a delay, cancellation, storm or closure, the interval trees find every visit
   that now overlaps another (the one that starts later moves). The moved visits are cut into
   conflict windows; in each window a bipartite graph of visits and free compatible stands is
   solved by Edmonds-Karp, which finds how many visits can be placed. Min-cost flow (successive
   shortest paths with Johnson potentials) then decides which: among the largest assignments it
   picks the one that moves the fewest aircraft over the shortest tows. When visits stay unmatched,
   the minimum cut gives a set S of visits whose usable stands N(S) are fewer than |S|: a proof by
   Hall's theorem, turned into a sentence.
6. **Notices.** On each replan the suffix tree over all notice text is searched for every stand id
   and taxiway id.

**Honest limitation.** Matching is optimal inside each conflict window; across windows, and with
preferences such as walking distance or airline piers, full gate assignment is NP-hard. The benchmark lab
compares our method with an exact branch and bound on small inputs.

## Algorithms

| Class | Unit | Time | Space | Baseline |
|---|---|---|---|---|
| `algo/sort/CountingSort` | 1 | O(n + k) | O(n + k) | `MergeSort`, O(n log n) |
| `algo/select/MedianOfMedians` | 1 | O(n) worst case | O(n) | Randomized Quickselect |
| `algo/heap/FibonacciHeap` | 2 | O(1) insert and decrease-key, O(log n) extract-min (amortised) | O(n) | `BinaryHeap` |
| `algo/interval/RedBlackIntervalTree` | 3 | O(log n) insert and delete, O(log n + k) overlaps | O(n) | Linear scan |
| `algo/segtree/LazySegmentTree` | 3 | O(log n) range add, max, sum | O(n) | Recount per minute |
| `algo/trie/Trie` | 4 | O(m) per prefix | O(total key length) | Linear scan |
| `algo/text/SuffixTree` (from `SuffixArray`, `LcpArray`) | 4 | O(n log n) build, O(m + occ) search | O(n) | `KmpMatcher`, O(n + m) per search |
| `algo/matching/BipartiteMatcher`, `MaxFlowNetwork`, `MinCutExplainer` | 5 | O(min(L, R)(V + E)) | O(V + E) | `GreedyFirstFit` |
| `algo/matching/MinCostMatcher` | 5 | O(F (E + V) log V) for a matching of size F | O(V + E) | Plain maximum matching |
| `algo/select/RandomizedQuickselect` | 6 | Expected O(n) | O(n) | Full sort |
| `algo/exact/ExactGateSolver` | 6 | Exponential (branch and bound) | O(n + m) | Brute force, our heuristic |

Every assessed algorithm is our own Java code; Java collections are used only as plain containers.
Every random process takes a seed.

## API examples

```bash
# build a plan for 16 November with buffers at the 75th percentile
curl -X POST localhost:8080/api/plan -H 'Content-Type: application/json' -d '{"day":1,"bufferPercentile":75}'

# delay a flight by 45 minutes at 10:00 and recover
curl -X POST localhost:8080/api/plan/{id}/delay -H 'Content-Type: application/json' \
  -d '{"flight":"AI 2927","minutes":45,"atMinute":600}'

# why is this flight on its stand?
curl localhost:8080/api/plan/{id}/why/AI2927

# close stands with a notice (mode: preview or apply)
curl -X POST localhost:8080/api/plan/{id}/notices -H 'Content-Type: application/json' \
  -d '{"text":"VABB STANDS 65A,65B CLSD 1400-1800","mode":"apply"}'

# monsoon storm at the 95th percentile, seed 7, 14:00 to 17:00
curl -X POST localhost:8080/api/plan/{id}/storm -H 'Content-Type: application/json' \
  -d '{"severityPercentile":95,"seed":7,"from":840,"to":1020}'

# greedy versus matching
curl -X POST localhost:8080/api/plan/{id}/race

# trie autocomplete and suffix tree notice search
curl 'localhost:8080/api/flights/search?q=AI2&day=1'
curl 'localhost:8080/api/notices/search?q=STAND%2064'
```

| Method and path | Purpose |
|---|---|
| `GET /api/flights?day=1`, `GET /api/flights/search?q=` | Flights for a day, trie autocomplete |
| `POST /api/plan`, `GET /api/plan/{id}` | Build or read a plan (assignments, certificate, trace, snapshots) |
| `GET /api/plan/{id}/occupancy`, `/busiest?window=60` | Busy stands per minute, busiest window |
| `POST /api/plan/{id}/delay`, `/cancel`, `/real-times` | Disruptions and real replay |
| `GET /api/plan/{id}/why/{flight}`, `POST /api/plan/{id}/race` | Explanation, greedy versus matching |
| `POST /api/plan/{id}/notices`, `DELETE /api/plan/{id}/notices/{nid}` | Validate, preview, apply or withdraw a notice |
| `POST /api/plan/{id}/storm`, `/rush`, `/ground-delay`, `/swap` | Storm, rush hour, fog ground delay, aircraft swap |
| `POST /api/plan/{id}/replan` | Re-plan every visit from a given minute (maximum matching, then min-cost flow) |
| `GET /api/story/arrival?day=1` | The story arrival: the same storm solved by a fixed plan and by the planner |
| `GET /api/stands`, `GET /api/notices` | Stand list, notice list |
| `GET /api/plan/{id}/radar`, `/board` | Availability radar, departures board |
| `GET /api/stats/delays`, `GET /api/snapshots/{structure}` | Delay leaderboard, machine view snapshots |
| `POST /api/bench/run`, `POST /api/exact` | Benchmarks, exact versus smart |

Errors use `{error, message, details}`: 400 for invalid input (for example a negative delay or
`Stand 999 not found`), 404 for an unknown plan or flight, 422 for valid but impossible requests
(for example the exact solver on more than 18 flights).

## Project layout

```
backend/   Spring Boot app: model, data import, algo (all assessed algorithms), engine, api, bench
frontend/  React + Vite: shell (one-screen layout and tabs), world (Three.js airport), story (welcome,
           story flight), machine and panels (algorithm views), state, api
data/      flights_day1.csv, flights_day2.csv, stands.csv, notices.txt, delay_stats.csv, raw/
docs/      benchmarks (CSV and notes), screenshots
```

## Screenshots

| Welcome screen | Story flight: the Unit 3 bin open |
|---|---|
| ![Welcome screen](docs/screenshots/welcome.jpg) | ![Story flight cabin](docs/screenshots/cabin-bins.jpg) |

| Scenario lab: Monsoon afternoon, 27 aircraft moved | Scenario lab: Greedy trap at night |
|---|---|
| ![Monsoon afternoon scenario](docs/screenshots/storm.jpg) | ![Greedy trap scenario](docs/screenshots/greedy-trap.jpg) |

| Flight card: why it moved and why this stand | Algorithms tab: live Fibonacci heap |
|---|---|
| ![Flight card](docs/screenshots/flight-card.jpg) | ![Algorithms tab](docs/screenshots/algorithms.jpg) |

## Contributions

Bhavya Patel: data import and flight fetching, domain model, counting sort, lazy segment tree,
red-black interval tree, Edmonds-Karp bipartite matching and min-cut, trie, the gate planner with its
optimality certificate, the recovery engine, the flight and plan endpoints, the app shell (layout,
top bar, side panel, dock, flight card, guide), the scenario lab screen and the overview and
algorithms tabs.

Tanushree: Fibonacci and binary heaps, suffix array, LCP, suffix tree and KMP, randomized
Quickselect and median-of-medians, the exact solver and NP-hardness study, availability radar,
notices, storms and rush hour, statistics and benchmarks, min-cost flow (fewest aircraft moved,
shortest tows), the scenario engine and the step-by-step "Fix everything" replay, the story arrival
(fixed stand plan against the planner), the 3D airport, the story flight, and the departures board,
announcements, chaos desk, notice teletype, leaderboard, benchmark lab and the Fibonacci heap and
suffix tree views.
