import { useEffect, useMemo, useState } from 'react'
import { hierarchy, tree } from 'd3-hierarchy'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { hhmm } from '../state/clock'

// Fibonacci heap of stands keyed by "free at": root list left to right, marked nodes ringed, minimum in yellow.

function layoutTrees(roots) {
  const out = []
  let x = 0
  let maxY = 0
  for (const r of roots) {
    const h = hierarchy(r, (d) => d.children)
    const t = tree().nodeSize([30, 46])(h)
    let minX = Infinity
    let maxX = -Infinity
    t.each((d) => {
      minX = Math.min(minX, d.x)
      maxX = Math.max(maxX, d.x)
      maxY = Math.max(maxY, d.y)
    })
    const ox = x - minX
    out.push({ t, ox })
    x += maxX - minX + 40
  }
  return { trees: out, width: x, height: maxY }
}

export default function FibonacciHeapView() {
  const app = useApp()
  const [snap, setSnap] = useState(app.plan && app.plan.snapshots && app.plan.snapshots.fibheap)
  const planId = app.plan && app.plan.planId
  const seq = app.lastOp && app.lastOp.seq

  useEffect(() => {
    if (!planId) return
    let live = true
    api.snapshot('fibheap', planId).then((s) => live && setSnap(s)).catch(() => {})
    const t = setInterval(() => api.snapshot('fibheap', planId).then((s) => live && setSnap(s)).catch(() => {}), 3000)
    return () => { live = false; clearInterval(t) }
  }, [planId, seq])

  const lay = useMemo(() => (snap ? layoutTrees(snap.roots) : null), [snap])
  if (!snap) return <div className="empty-note">The availability heap is built by the radar. It appears here once the radar has a clock time.</div>
  const pad = 30
  return (
    <div className="m-fib">
      <div className="m-meta">
        <span className="chip">{snap.size} stands</span>
        <span className="chip">{snap.roots.length} trees in root list</span>
        <span className="chip yellow">min: {snap.min}</span>
        <span className="chip">{snap.decreaseKeys} decrease-keys</span>
      </div>
      <div className="fib-scroll">
        <svg width={Math.max(lay.width + pad * 2, 320)} height={lay.height + pad * 2 + 20} className="m-svg fib">
          <line x1={pad} x2={lay.width + pad - 40} y1={pad} y2={pad} className="fib-rootline" />
          {lay.trees.map(({ t, ox }, ti) => (
            <g key={ti} transform={'translate(' + (ox + pad) + ' ' + pad + ')'}>
              {t.links().map((l, i) => (
                <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} className="fib-edge" />
              ))}
              {t.descendants().map((d, i) => {
                const isMin = d.depth === 0 && d.data.label === snap.min
                return (
                  <g key={i} transform={'translate(' + d.x + ' ' + d.y + ')'} className="fib-node">
                    <circle r="12" className={isMin ? 'fmin' : d.depth === 0 ? 'froot' : 'fn'} />
                    {d.data.marked && <circle r="15.5" className="fmark" />}
                    <text y="3.5" className="ft">{d.data.label}</text>
                    <text y="25" className="fk">{hhmm(d.data.key)}</text>
                    <title>Stand {d.data.label} free at {hhmm(d.data.key)}{d.data.marked ? ' (marked: lost a child)' : ''}</title>
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
      </div>
      {snap.events && snap.events.length > 0 ? (
        <div className="m-ops">{snap.events.map((e, i) => <span key={i} className="chip op">{e}</span>)}</div>
      ) : (
        <div className="m-foot">Cancel a flight to see decrease-key: its stand's key drops, the node is cut to the root list and its parent is marked. A second loss triggers a cascading cut.</div>
      )}
    </div>
  )
}
