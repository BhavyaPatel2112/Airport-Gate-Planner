import { useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'

// Suffix tree search path: each edge label with its matched characters lit one by one.

export default function SuffixTreeView() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [local, setLocal] = useState(null)
  const [err, setErr] = useState(null)
  const base = app.plan && app.plan.snapshots && app.plan.snapshots.suffix
  const snap = local || app.searchResult || base

  async function search(e) {
    e.preventDefault()
    if (!q.trim() || !app.plan) return
    try {
      const r = await api.searchNotices(app.plan.planId, q)
      setLocal({ pattern: r.query, path: r.path, hits: r.hits.length, textLength: r.textLength, nodes: r.treeNodes,
        suffixTreeMs: r.suffixTreeMs, kmpMs: r.kmpMs })
      setErr(null)
    } catch (ex) {
      setErr(ex.message)
    }
  }

  let delay = 0
  return (
    <div className="m-suffix">
      <form className="sx-form" onSubmit={search}>
        <input className="input" placeholder="Search notices, for example STAND 64 or CLSD" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small" type="submit">Search</button>
      </form>
      {err && <div className="form-error">{err}</div>}
      {!snap && <div className="empty-note">Type a notice in the teletype or search here: the walk down the suffix tree appears below.</div>}
      {snap && (
        <>
          <div className="m-meta">
            <span className="chip cyan">pattern “{snap.pattern}”</span>
            <span className="chip">{snap.hits} matches</span>
            <span className="chip">{snap.nodes} nodes over {snap.textLength} chars</span>
            {snap.suffixTreeMs !== undefined && <span className="chip">tree {snap.suffixTreeMs} ms · KMP {snap.kmpMs} ms</span>}
          </div>
          <div className="sx-path" key={snap.pattern + snap.hits}>
            <div className="sx-node root">root</div>
            {snap.path.map((s, i) => {
              const chars = s.edge.split('')
              const row = (
                <div key={i} className="sx-step">
                  <div className="sx-edge">
                    {chars.map((c, k) => {
                      const lit = k < s.matched
                      const d = lit ? (delay += 0.07) : 0
                      return (
                        <span key={k} className={'sx-ch' + (lit ? ' lit' : '')} style={lit ? { animationDelay: d + 's' } : undefined}>
                          {c === ' ' ? '·' : c}
                        </span>
                      )
                    })}
                  </div>
                  <div className={'sx-node' + (i === snap.path.length - 1 ? (snap.hits ? ' found' : ' miss') : '')}>
                    node {s.nodeId} · {s.childCount} {s.childCount === 1 ? 'branch' : 'branches'}
                  </div>
                </div>
              )
              return row
            })}
          </div>
          <div className="m-foot">
            The tree is built once from the suffix array and LCP array. A search follows one path from the root, comparing only the
            pattern's characters: O(m), then O(occ) to list matches. KMP rescans the whole text for every pattern.
          </div>
        </>
      )}
    </div>
  )
}
