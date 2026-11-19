import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { hhmm } from '../state/clock'
import { MatchingGraph } from '../machine/MatchingView'

function Textbook({ tb }) {
  // A fits stands 1 and 2, B fits only stand 1
  const draw = (assign, title, placed) => (
    <div className="tb-card">
      <div className="tb-title">{title} <span className={placed === 2 ? 'ok' : 'bad'}>{placed} of 2 placed</span></div>
      <svg viewBox="0 0 220 110">
        {[['A', 25], ['B', 85]].map(([f, y]) => (
          <g key={f}><circle cx="30" cy={y} r="13" fill="#1d2a3f" stroke="#38d7ff" /><text x="30" y={y + 4} textAnchor="middle"
            fill="#e8eef7" fontSize="12" fontWeight="700">{f}</text></g>
        ))}
        {[['1', 25], ['2', 85]].map(([s, y]) => (
          <g key={s}><rect x="172" y={y - 13} width="30" height="26" rx="5" fill="#1d2a3f" stroke="#ffcc00" /><text x="187" y={y + 4}
            textAnchor="middle" fill="#ffcc00" fontSize="12" fontWeight="700">{s}</text></g>
        ))}
        {[[25, 25], [25, 85], [85, 25]].map(([a, b], i) => (
          <line key={i} x1="43" y1={a} x2="172" y2={b} stroke="#3a4a63" strokeWidth="1.5" strokeDasharray="4 4" />
        ))}
        {assign.map((s, i) => {
          if (s === 'no stand') return null
          const y1 = i === 0 ? 25 : 85
          const y2 = s === 'stand 1' ? 25 : 85
          return <line key={'m' + i} x1="43" y1={y1} x2="172" y2={y2} stroke="#3ddc84" strokeWidth="3" />
        })}
        {assign[1] === 'no stand' && <text x="62" y="90" fill="#ff4d4d" fontSize="11" fontWeight="700">B: no stand</text>}
      </svg>
    </div>
  )
  return (
    <div className="textbook">
      {draw(tb.greedy, 'Greedy first-fit', tb.greedyPlaced)}
      {draw(tb.matching, 'Maximum matching', tb.matchingPlaced)}
      <p>Flight A fits stands 1 and 2; flight B fits only stand 1. Greedy gives A the first free stand and strands B.
        Matching finds the augmenting path B to 1, A to 2 and places both.</p>
    </div>
  )
}

function Side({ s, other, color }) {
  const win = s.placed > other.placed
  return (
    <motion.div className={'race-side' + (win ? ' win' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rs-head" style={{ borderColor: color }}>
        <span>{s.method}</span>
        {win && <span className="chip winner">more placed</span>}
      </div>
      <div className="rs-nums">
        <div><b className="ok">{s.placed}</b><span>placed</span></div>
        <div><b className={s.unplaced ? 'bad' : ''}>{s.unplaced}</b><span>left without a stand</span></div>
        <div><b>{s.timeMs}</b><span>ms</span></div>
      </div>
      <div className="rs-list">
        {s.unplacedFlights.length === 0 ? <span className="muted">Every displaced flight found a stand.</span>
          : s.unplacedFlights.map((f) => <span key={f} className="chip bad">{f}</span>)}
      </div>
      {s.snapshot && <div className="rs-graph"><MatchingGraph snap={s.snapshot} height={260} /></div>}
    </motion.div>
  )
}

export default function RaceView() {
  const app = useApp()
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function start() {
    setBusy(true)
    setErr(null)
    try {
      setRes(await api.race(app.plan.planId))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="race">
      <div className="race-intro">
        <p>Same plan, same disruption, two ways to re-place the flights that lose their stand. The backend copies the
          plan twice and runs both in Java; nothing changes in the live plan.</p>
        <button className="btn primary" onClick={start} disabled={busy || !app.plan}>{busy ? 'Racing...' : res ? 'Run again' : 'Start the race'}</button>
      </div>
      {err && <div className="form-error">{err}</div>}
      {res && (
        <>
          <div className="race-scenario">{res.scenario}</div>
          <div className="race-grid">
            <Side s={res.greedy} other={res.matching} color="#ff7a6b" />
            <Side s={res.matching} other={res.greedy} color="#3ddc84" />
          </div>
          {res.differences.length > 0 && (
            <table className="race-table">
              <thead><tr><th>Flight</th><th>Size</th><th>On block</th><th>Before</th><th>Greedy</th><th>Matching</th></tr></thead>
              <tbody>
                {res.differences.slice(0, 30).map((d) => (
                  <tr key={d.visit}>
                    <td className="mono">{d.label}</td><td>{d.size === 'WIDE' ? 'Wide' : 'Narrow'}</td><td className="mono">{hhmm(d.start)}</td>
                    <td className="mono">{d.before || '-'}</td>
                    <td className={'mono ' + (d.greedy ? '' : 'bad')}>{d.greedy || 'none'}</td>
                    <td className={'mono ' + (d.matching ? 'ok' : 'bad')}>{d.matching || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="sub-h">Why matching wins: the textbook case</h3>
          <Textbook tb={res.textbook} />
        </>
      )}
    </div>
  )
}
