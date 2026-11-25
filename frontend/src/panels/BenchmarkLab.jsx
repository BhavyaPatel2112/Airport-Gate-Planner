import { useState } from 'react'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, LogarithmicScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { api } from '../api/client'

ChartJS.register(LineElement, PointElement, LinearScale, LogarithmicScale, CategoryScale, Tooltip, Legend)

const SUITES = [
  ['sort', 'Counting sort', 'Merge sort', 1],
  ['segtree', 'Segment tree', 'Recount per minute', 3],
  ['interval', 'Interval tree', 'Linear scan', 3],
  ['matching', 'Matching', 'Greedy first-fit', 5],
  ['trie', 'Trie', 'Linear scan', 4],
  ['heap', 'Fibonacci heap', 'Binary heap', 2],
  ['text', 'Suffix tree', 'KMP per search', 4],
  ['select', 'Quickselect', 'Median-of-medians, full sort', 6]
]

const COLORS = ['#38d7ff', '#ff7a6b', '#ffcc00', '#3ddc84']

function chartData(rows) {
  const sizes = [...new Set(rows.map((r) => r.n))]
  const methods = [...new Set(rows.map((r) => r.method))]
  return {
    labels: sizes.map((n) => n.toLocaleString()),
    datasets: methods.map((m, i) => ({
      label: m,
      data: sizes.map((n) => {
        const r = rows.find((x) => x.n === n && x.method === m)
        return r ? Math.max(0.001, r.medianMs) : null
      }),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length],
      borderWidth: 2.5,
      pointRadius: 4,
      tension: 0.25
    }))
  }
}

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: { legend: { labels: { color: '#b4c0d2', boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + c.parsed.y + ' ms' } } },
  scales: {
    x: { title: { display: true, text: 'input size (stand visits)', color: '#7d8aa0' }, ticks: { color: '#b4c0d2' }, grid: { color: 'rgba(130,170,210,0.08)' } },
    y: { type: 'logarithmic', title: { display: true, text: 'median time (ms, log scale)', color: '#7d8aa0' }, ticks: { color: '#b4c0d2' }, grid: { color: 'rgba(130,170,210,0.08)' } }
  }
}

function Suite() {
  const [suite, setSuite] = useState('sort')
  const [res, setRes] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function run(s = suite) {
    setBusy(true)
    setErr(null)
    try {
      const r = await api.bench(s, null, 42)
      setRes((x) => ({ ...x, [s]: r }))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  const cur = res[suite]
  const meta = SUITES.find((x) => x[0] === suite)
  return (
    <div>
      <div className="lab-tabs">
        {SUITES.map(([k, ours, , u]) => (
          <button key={k} className={suite === k ? 'on' : ''} onClick={() => setSuite(k)}>
            <span className={'unit-badge u' + u}>U{u}</span>{ours}
          </button>
        ))}
      </div>
      <div className="lab-row">
        <div className="lab-desc"><b>{meta[1]}</b> against <b>{meta[2]}</b> at three sizes: the real day, 10 times and 100 times
          the traffic. One warm-up run, then the median of five, fixed seed 42.</div>
        <button className="btn primary" onClick={() => run()} disabled={busy}>{busy ? 'Running in Java...' : cur ? 'Run again' : 'Run benchmark'}</button>
      </div>
      {err && <div className="form-error">{err}</div>}
      {cur && (
        <div className="lab-result">
          <div className="lab-chart"><Line data={chartData(cur.rows)} options={OPTIONS} /></div>
          <table className="race-table">
            <thead><tr><th>n</th><th>Method</th><th>Median ms</th><th>Result</th><th>Note</th></tr></thead>
            <tbody>
              {cur.rows.map((r, i) => (
                <tr key={i}><td className="mono">{r.n.toLocaleString()}</td><td>{r.method}</td><td className="mono">{r.medianMs}</td>
                  <td className="mono">{r.quality}</td><td className="muted">{r.note}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ marginTop: 6 }}>Total run time {cur.totalMs} ms. Raw CSV for every suite is saved in docs/benchmarks.</div>
        </div>
      )}
    </div>
  )
}

function Exact() {
  const [n, setN] = useState(10)
  const [seed, setSeed] = useState(42)
  const [one, setOne] = useState(null)
  const [curve, setCurve] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function runOne() {
    setBusy(true)
    setErr(null)
    try {
      setOne(await api.exact(n, seed))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function runCurve() {
    setBusy(true)
    setErr(null)
    const pts = []
    try {
      for (const k of [6, 8, 10, 12, 14]) {
        const r = await api.exact(k, seed)
        pts.push({ n: k, exact: r.exact.timeMs, ours: r.ours.timeMs, nodes: r.exact.nodes, gap: r.gap })
        setCurve([...pts])
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="exact">
      <p className="lab-desc">Full gate assignment with preferences (contact stand cost 0, remote 3, narrow-body on a wide stand +1,
        no stand 20) is NP-hard: it contains interval scheduling with machine eligibility. Our planner solves the provable parts
        (fewest stands, most flights placed) in near-linear time; the exact branch and bound grows exponentially.</p>
      <div className="lab-row">
        <label>Flights <b className="mono">{n}</b>
          <input type="range" min="4" max="16" value={n} onChange={(e) => setN(Number(e.target.value))} className="slider" />
        </label>
        <label>Seed <input className="input mono" style={{ width: 70 }} value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        <button className="btn primary" onClick={runOne} disabled={busy}>Exact vs ours</button>
        <button className="btn" onClick={runCurve} disabled={busy}>Growth curve 6 to 14</button>
        <button className="btn ghost" onClick={() => api.exact(40, seed).catch((e) => setErr('422 from the backend: ' + e.message))}>Try 40 flights</button>
      </div>
      {n >= 15 && <div className="muted">15 or more flights take seconds in the exact solver. That is the point.</div>}
      {err && <div className="form-error">{err}</div>}
      {one && (
        <div className="exact-cards">
          <div><span>Exact (branch and bound)</span><b className="mono">cost {one.exact.cost}</b><i>{one.exact.nodes.toLocaleString()} nodes · {one.exact.timeMs} ms</i></div>
          <div><span>Our heuristic</span><b className="mono">cost {one.ours.cost}</b><i>{one.ours.timeMs} ms</i></div>
          {one.bruteForce && <div><span>Brute force</span><b className="mono">cost {one.bruteForce.cost}</b><i>{one.bruteForce.nodes.toLocaleString()} nodes · {one.bruteForce.timeMs} ms</i></div>}
          <div><span>Gap</span><b className={'mono ' + (one.gap === 0 ? 'ok' : 'bad')}>{one.gap}</b><i>{one.gap === 0 ? 'heuristic is optimal here' : 'heuristic is worse here'}</i></div>
        </div>
      )}
      {curve && (
        <div className="lab-chart small">
          <Line data={{
            labels: curve.map((p) => p.n + ' flights'),
            datasets: [
              { label: 'exact branch and bound (ms)', data: curve.map((p) => Math.max(0.001, p.exact)), borderColor: '#ff7a6b', backgroundColor: '#ff7a6b', borderWidth: 2.5 },
              { label: 'our heuristic (ms)', data: curve.map((p) => Math.max(0.001, p.ours)), borderColor: '#38d7ff', backgroundColor: '#38d7ff', borderWidth: 2.5 }
            ]
          }} options={OPTIONS} />
        </div>
      )}
    </div>
  )
}

export default function BenchmarkLab() {
  return (
    <div className="lab">
      <h3 className="sub-h">Benchmarks against baselines</h3>
      <Suite />
      <h3 className="sub-h">NP-hardness study: exact versus smart</h3>
      <Exact />
    </div>
  )
}
