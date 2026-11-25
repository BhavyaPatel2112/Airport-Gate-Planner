// The story flight is nonstop, New York to Mumbai (AI 116, about 16 hours). The six syllabus units come up one after
// another along the way: `at` is how far along the route each one appears, `when` the time into the flight.
// Flight counts in the saved data, after merging duplicate rows (837 and 871 rows in the CSV files).
export const DATA_FLIGHTS = { day1: 835, day2: 847, total: 1682 }

export const START = { id: 'JFK', lat: 40.64, lon: -73.78, city: 'New York' }

export const STOPS = [
  {
    id: 'U1', at: 1 / 7, when: '2 hours in', city: 'Unit 1', unit: 1, title: 'Sorting and selection',
    question: 'Put every flight in order first.',
    body: 'Each stand visit needs a stand from the minute it lands until it leaves. Before planning, counting sort lines up every visit by that start minute in one pass, without comparing two flights. Median of medians and Quickselect pick a value at any rank in linear time.',
    algos: ['Counting sort', 'Median of medians'], match: 'Counting sort', viz: 'sort'
  },
  {
    id: 'U2', at: 2 / 7, when: '4½ hours in', city: 'Unit 2', unit: 2, title: 'Advanced heaps',
    question: 'Which stand frees up first?',
    body: 'Every stand waits in a Fibonacci heap ordered by the time it becomes free. For each flight the planner takes the compatible stand that frees up earliest. When a flight is cancelled, decrease-key moves its stand to the front in constant time.',
    algos: ['Fibonacci heap', 'Binary heap baseline'], match: 'Fibonacci heap', viz: 'heap'
  },
  {
    id: 'U3', at: 3 / 7, when: '7 hours in', city: 'Unit 3', unit: 3, title: 'Trees for intervals and ranges',
    question: 'Does this flight clash with another, and is the plan the smallest possible?',
    body: 'Each stand keeps a red-black interval tree of its visits, so a delayed flight finds every clash in O(log n + k). A lazy segment tree counts busy stands minute by minute. Its highest point is the busiest moment, and the plan uses exactly that many stands: proof that no plan can use fewer.',
    algos: ['Red-black interval tree', 'Lazy segment tree'], match: 'Segment tree', viz: 'intervals'
  },
  {
    id: 'U4', at: 4 / 7, when: '9 hours in', city: 'Unit 4', unit: 4, title: 'String structures',
    question: 'Read the airport\'s notices automatically.',
    body: 'Notices such as "VABB STAND 92 CLSD 1000-1200" close stands and taxiways. A suffix tree built from a suffix array and LCP array finds every stand and taxiway id inside all notices at once. A trie gives instant flight search as you type.',
    algos: ['Suffix tree', 'Trie', 'KMP baseline'], match: 'Suffix tree', viz: 'text'
  },
  {
    id: 'U5', at: 5 / 7, when: '11½ hours in', city: 'Unit 5', unit: 5, title: 'Network flow',
    question: 'When things go wrong, fix everything at once.',
    body: 'After a storm or a closure, the affected flights and the free compatible stands form a bipartite graph. Edmonds-Karp maximum flow finds the largest set of flights that can be re-placed together, and min-cost flow picks the way that moves the fewest aircraft the shortest distance. If some still cannot fit, the minimum cut explains why (Hall\'s theorem).',
    algos: ['Edmonds-Karp matching', 'Min-cost flow', 'Minimum cut'], match: 'Bipartite matching', viz: 'match'
  },
  {
    id: 'U6', at: 6 / 7, when: '13½ hours in', city: 'Unit 6', unit: 6, title: 'Randomized algorithms and hardness',
    question: 'How late will each airline be, and how hard is the full problem?',
    body: 'Randomized Quickselect finds each airline\'s real delay at the 75th percentile in expected linear time; that becomes the safety gap after each visit. Gate assignment with preferences is NP-hard, so an exact branch-and-bound solver runs only on small cases to compare against.',
    algos: ['Randomized Quickselect', 'Exact solver (NP-hard)'], match: 'Quickselect', viz: 'select'
  }
]

export const MUMBAI = { id: 'BOM', lat: 19.09, lon: 72.87, city: 'Mumbai' }
