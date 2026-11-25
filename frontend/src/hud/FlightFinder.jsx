import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock } from '../state/clock'

export default function FlightFinder() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!q.trim()) {
      setRes(null)
      return undefined
    }
    const t = setTimeout(() => {
      api.search(app.day, q).then((r) => { setRes(r); setErr(null) }).catch((e) => setErr(e.message))
    }, 120)
    return () => clearTimeout(t)
  }, [q, app.day])

  function pick(r) {
    const v = app.visitsById[r.visit]
    app.select(r.visit)
    app.setFollow(r.visit)
    if (v) clock.set({ minute: Math.max(0, v.start - 14) })
    app.setDrawer(null)
  }

  return (
    <div className="finder">
      <input className="input big" autoFocus placeholder="Flight number, airline, city or registration (try AI 2, Dubai, VT-)"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <div className="form-error">{err}</div>}
      {res && (
        <>
          <div className="finder-meta mono">
            Trie: {res.trieMs} ms · linear scan over all flights: {res.linearScanMs} ms · {res.results.length} suggestions
          </div>
          <div className="finder-list">
            {res.results.length === 0 && <div className="empty-note">No flight starts with “{q}”.</div>}
            {res.results.map((r) => (
              <button key={r.visit} className="finder-item" onClick={() => pick(r)}>
                <span className="mono fl">{r.label}</span>
                <span className="al">{r.airline}</span>
                <span className="ct">{r.iata} {r.city}</span>
                <span className="chip">{r.type}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="drawer-note">
        Search runs on a trie in Java (Unit 4): walking a prefix of length m costs O(m) however many flights are stored.
        Picking a result selects the aircraft, jumps the clock to its approach and follows it.
      </p>
    </div>
  )
}
