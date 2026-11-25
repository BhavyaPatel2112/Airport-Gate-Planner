import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { tailColour } from '../scene/lighting'
import Ico from './icons'
import { DeparturesBoard } from '../panels'

export default function FlightsTab() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState(null)

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return undefined }
    const t = setTimeout(() => api.search(app.day, q.trim()).then(setHits).catch(() => setHits(null)), 150)
    return () => clearTimeout(t)
  }, [q, app.day])

  const open = (visitId) => {
    const v = app.visitsById[visitId]
    if (!v) return
    app.select(visitId)
    if (v.stand) app.focusOn(v.stand)
  }

  return (
    <div className="tab-body">
      <div className="search">
        <Ico n="search" size={15} />
        <input placeholder="Search a flight or airline" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {hits && (
        <div className="hits">
          <div className="hits-meta">Trie {hits.trieMs} ms · linear scan {hits.linearScanMs} ms · {hits.results.length} found</div>
          {hits.results.slice(0, 8).map((r) => (
            <button key={r.visit} className="row" onClick={() => open(r.visit)}>
              <i className="fin" style={{ background: tailColour(r.visit.replace(/[0-9].*$/, '').slice(0, 2)) }} />
              <b>{r.label}</b><span>{r.city}</span><em>{app.visitsById[r.visit] ? app.visitsById[r.visit].stand || 'no stand' : ''}</em>
            </button>
          ))}
        </div>
      )}
      <div className="legacy board-wrap"><DeparturesBoard /></div>
    </div>
  )
}
