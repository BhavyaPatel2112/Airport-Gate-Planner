import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { useClockMinute } from '../state/clock'
import RedBlackTreeView from '../machine/RedBlackTreeView'
import MatchingView from '../machine/MatchingView'
import FibonacciHeapView from '../machine/FibonacciHeapView'
import SuffixTreeView from '../machine/SuffixTreeView'
import '../machine/machine.css'
import Ico from './icons'
import { RadarScope, NoticeTeletype } from '../panels'

export const UNITS = [
  { u: 1, name: 'Sorting and selection' },
  { u: 2, name: 'Advanced heaps' },
  { u: 3, name: 'Trees for intervals and ranges' },
  { u: 4, name: 'String structures' },
  { u: 5, name: 'Network flow' },
  { u: 6, name: 'Randomized algorithms and hardness' }
]

export const ALGOS = [
  { id: 'counting', u: 1, name: 'Counting sort', match: 'Counting sort', job: 'Sorts every stand visit by its start minute before planning.', cx: 'O(n + k)', base: 'Merge sort', view: 'sort' },
  { id: 'mom', u: 1, name: 'Median of medians', match: 'Median', job: 'Guaranteed linear-time selection, checked against Quickselect in the benchmark lab.', cx: 'O(n) worst case', base: 'Full sort', view: 'lab' },
  { id: 'fib', u: 2, name: 'Fibonacci heap', match: 'Fibonacci heap', job: 'Which compatible stand frees up first; cancellations use decrease-key.', cx: 'O(1) insert, O(log n) extract', base: 'Binary heap', view: 'fibheap' },
  { id: 'rbt', u: 3, name: 'Red-black interval tree', match: 'Red-black', job: 'One per stand. Finds which flights overlap after a delay in O(log n + k).', cx: 'O(log n + k) query', base: 'Scan every flight', view: 'rbtree' },
  { id: 'seg', u: 3, name: 'Segment tree (lazy)', match: 'Segment tree', job: 'Busy stands per minute. Its peak is the proof that the stand count is minimal.', cx: 'O(log n) range update', base: 'Recount per minute', view: 'seg' },
  { id: 'trie', u: 4, name: 'Trie', match: 'Trie', job: 'Flight search with autocomplete (try the flight box in the Scenario lab).', cx: 'O(m) per prefix', base: 'Linear scan', view: null },
  { id: 'suffix', u: 4, name: 'Suffix tree (from suffix array + LCP)', match: 'Suffix tree', job: 'Reads every notice: finds each stand and taxiway id mentioned.', cx: 'O(m + occ) per search', base: 'KMP per search', view: 'suffix' },
  { id: 'match', u: 5, name: 'Maximum bipartite matching (Edmonds-Karp)', match: 'Bipartite matching', job: 'Repairs the plan: re-places all affected flights at once.', cx: 'O(V E²)', base: 'Greedy first-fit', view: 'matching' },
  { id: 'cut', u: 5, name: 'Minimum cut (Hall\'s theorem)', match: 'Minimum cut', job: 'When flights cannot fit, proves why in one plain sentence.', cx: 'O(V + E) after flow', base: 'none', view: 'matching' },
  { id: 'qs', u: 6, name: 'Randomized Quickselect', match: 'Quickselect', job: 'Each airline\'s delay percentile: sets buffers and storm delays.', cx: 'Expected O(n)', base: 'Full sort', view: 'stats' },
  { id: 'exact', u: 6, name: 'Exact solver (NP-hard study)', match: 'Exact', job: 'Branch and bound on small inputs to show why full gate assignment is hard.', cx: 'Exponential', base: 'Brute force', view: 'lab' }
]

function SegView() {
  const app = useApp()
  const minute = useClockMinute()
  const d = app.occupancy
  if (!d) return <div className="viz-empty">No data yet.</div>
  let peak = 1
  let at = 0
  for (let i = 0; i < 1440; i++) if (d[i] > peak) { peak = d[i]; at = i }
  const W = 360
  const H = 120
  const pts = []
  for (let m = 0; m < 1440; m += 5) pts.push(((m / 1440) * W).toFixed(1) + ',' + (H - 6 - (d[m] / peak) * (H - 20)).toFixed(1))
  const x = (Math.min(1439, minute) / 1440) * W
  return (
    <div>
      <svg viewBox={'0 0 ' + W + ' ' + H} className="seg-svg">
        <path d={'M0,' + (H - 6) + ' L' + pts.join(' L') + ' L' + W + ',' + (H - 6) + ' Z'} fill="rgba(139,125,255,0.25)" />
        <path d={'M' + pts.join(' L')} fill="none" stroke="#a99fff" strokeWidth="1.4" />
        <line x1={(at / 1440) * W} x2={(at / 1440) * W} y1="10" y2={H - 6} stroke="#ffb547" strokeDasharray="3 3" />
        <text x={(at / 1440) * W + 4} y="18" className="seg-t">peak {peak}</text>
        <line x1={x} x2={x} y1="0" y2={H} stroke="#fff" strokeOpacity="0.6" />
      </svg>
      <div className="viz-foot">Each visit adds +1 to its minutes with one lazy range update. The highest point is the busiest
        moment; the plan uses exactly that many stands per class.</div>
    </div>
  )
}

function SortView() {
  const app = useApp()
  const v = app.plan ? app.plan.visits.slice(0, 400) : []
  const buckets = new Array(24).fill(0)
  for (const x of v) buckets[Math.min(23, Math.max(0, Math.floor(x.start / 60)))]++
  const max = Math.max(1, ...buckets)
  return (
    <div>
      <div className="sort-bars">
        {buckets.map((b, i) => <div key={i} style={{ height: (b / max) * 100 + '%' }} title={i + ':00 · ' + b + ' visits'} />)}
      </div>
      <div className="viz-foot">Counting sort puts each visit straight into the bucket for its start minute (0 to 2879), then reads
        the buckets in order. No two visits are ever compared.</div>
    </div>
  )
}

function Viz({ kind }) {
  const app = useApp()
  if (kind === 'rbtree') return <RedBlackTreeView />
  if (kind === 'matching') return <MatchingView />
  if (kind === 'fibheap') return <><FibonacciHeapView /><div className="legacy embed radar-embed"><RadarScope /></div></>
  if (kind === 'suffix') return <><SuffixTreeView /><div className="legacy embed tt-embed"><NoticeTeletype /></div></>
  if (kind === 'seg') return <SegView />
  if (kind === 'sort') return <SortView />
  if (kind === 'lab') return <button className="btn" onClick={() => app.setSheet('lab')}><Ico n="chart" />Open the benchmark lab</button>
  if (kind === 'stats') return <button className="btn" onClick={() => app.setSheet('stats')}><Ico n="chart" />Airline delay percentiles</button>
  return null
}

export default function AlgorithmsTab() {
  const app = useApp()
  const [open, setOpen] = useState(null)
  const last = {}
  for (const t of app.traceLog) {
    for (const a of ALGOS) if (!last[a.id] && t.algorithm && t.algorithm.includes(a.match)) last[a.id] = t
  }
  return (
    <div className="tab-body">
      <p className="lab-intro">All six syllabus units run inside the planner. Open one to see its live data structure and its last real run.</p>
      <div className="algo-actions">
        <button className="btn" onClick={() => app.setSheet('race')}><Ico n="compare" />Greedy vs matching race</button>
        <button className="btn" onClick={() => app.setSheet('lab')}><Ico n="chart" />Benchmarks</button>
      </div>
      {UNITS.map((unit) => (
        <section key={unit.u} className="unit">
          <div className="unit-h"><span className={'ub u' + unit.u}>Unit {unit.u}</span>{unit.name}</div>
          {ALGOS.filter((a) => a.u === unit.u).map((a) => {
            const t = last[a.id]
            const isOpen = open === a.id
            return (
              <div key={a.id} className={'algo' + (isOpen ? ' open' : '')}>
                <button className="algo-head" onClick={() => setOpen(isOpen ? null : a.id)}>
                  <div className="algo-t">
                    <b>{a.name}</b>
                    <span>{a.job}</span>
                  </div>
                  <div className="algo-r">
                    {t ? <span className="ran num">{t.timeMs < 1 ? t.timeMs.toFixed(2) : t.timeMs.toFixed(1)} ms</span> : <span className="ran idle">idle</span>}
                    <Ico n="chevronDown" size={14} className={'chev' + (isOpen ? ' up' : '')} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div className="algo-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <div className="algo-facts">
                        <div><span>Complexity</span><b>{a.cx}</b></div>
                        <div><span>Baseline</span><b>{a.base}</b></div>
                      </div>
                      {t && (
                        <div className="lastrun">
                          <div className="lr-op">{t.operation}</div>
                          <div className="lr-meta num">n = {t.inputSize.toLocaleString()} · {t.timeMs.toFixed(3)} ms · {t.complexity}</div>
                          <div className="lr-proof">{t.proof}</div>
                        </div>
                      )}
                      {a.view && <div className="algo-viz"><Viz kind={a.view} /></div>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
