import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function DelayLeaderboard() {
  const [p, setP] = useState(90)
  const [seed, setSeed] = useState(42)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    api.delayStats(p, seed).then((d) => { setData(d); setErr(null) }).catch((e) => setErr(e.message))
  }, [p, seed])

  const max = data ? Math.max(30, ...data.airlines.map((a) => a.p90)) : 60
  return (
    <div className="leader">
      <div className="leader-controls">
        <label>Percentile <b className="mono">p{p}</b>
          <input type="range" min="50" max="99" value={p} onChange={(e) => setP(Number(e.target.value))} className="slider" />
        </label>
        <label>Seed <input className="input mono" style={{ width: 80 }} value={seed}
          onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
      </div>
      {err && <div className="form-error">{err}</div>}
      {data && (
        <>
          <div className="timing">
            <div><span>Randomized Quickselect</span><b className="mono">{data.timing.quickselectMs} ms</b><i>{data.timing.quickselectComparisons.toLocaleString()} comparisons</i></div>
            <div><span>Median-of-medians</span><b className="mono">{data.timing.medianOfMediansMs} ms</b><i>{data.timing.medianOfMediansComparisons.toLocaleString()} comparisons</i></div>
            <div><span>Full merge sort</span><b className="mono">{data.timing.fullSortMs} ms</b><i>sorts all {data.timing.n.toLocaleString()} delays</i></div>
            <div><span>All airlines p{p}</span><b className="mono">{data.timing.value} min</b><i>same answer from all three</i></div>
          </div>
          <table className="race-table leader-table">
            <thead><tr><th>Airline</th><th>Departures</th><th>Median</th><th>p90</th><th>p{p}</th><th>On time</th><th style={{ width: '32%' }}>Delay at p{p}</th></tr></thead>
            <tbody>
              {data.airlines.map((a) => (
                <tr key={a.code}>
                  <td><b>{a.name}</b> <span className="muted mono">{a.code}</span></td>
                  <td className="mono">{a.flights}</td>
                  <td className="mono">{a.median}</td>
                  <td className="mono">{a.p90}</td>
                  <td className="mono"><b>{a.atPercentile}</b></td>
                  <td className="mono">{a.onTimeShare}%</td>
                  <td>
                    <div className="bar"><span style={{ width: Math.max(2, (Math.max(0, a.atPercentile) / max) * 100) + '%' }}
                      className={a.atPercentile > 45 ? 'bad' : a.atPercentile > 20 ? 'warn' : 'ok'} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="drawer-note">Real departure delays (actual minus scheduled) from both days. Every percentile is a randomized
            Quickselect in Java (expected O(n)); the same seed always gives the same answer. Ordered by the backend with merge sort.
            On time means no more than 15 minutes late. Plan buffers use the 75th percentile by default (capped at 60 minutes).</p>
        </>
      )}
    </div>
  )
}
