import { useMemo } from 'react'
import { hierarchy, tree } from 'd3-hierarchy'
import { useApp } from '../state/app'
import { hhmm } from '../state/clock'

// Red-black interval tree of one stand, laid out from the backend snapshot. Nodes slide when rotations move them.

export default function RedBlackTreeView() {
  const app = useApp()
  const snap = app.plan && app.plan.snapshots && app.plan.snapshots.rbtree
  const layoutData = useMemo(() => {
    if (!snap || !snap.nodes.length) return null
    const byId = {}
    for (const n of snap.nodes) byId[n.id] = n
    function build(id) {
      if (id < 0 || !byId[id]) return { empty: true }
      const n = byId[id]
      return { ...n, children: [build(n.left), build(n.right)] }
    }
    const root = hierarchy(build(snap.rootId), (d) => (d.empty ? null : d.children))
    const t = tree().nodeSize([46, 58])(root)
    let minX = Infinity
    let maxX = -Infinity
    let maxY = 0
    t.each((d) => {
      minX = Math.min(minX, d.x)
      maxX = Math.max(maxX, d.x)
      maxY = Math.max(maxY, d.y)
    })
    return { nodes: t.descendants(), links: t.links(), minX, maxX, maxY }
  }, [snap])

  if (!snap) return <div className="empty-note">Build a plan, then click a parked aircraft and choose “Stand tree”, or delay a flight.</div>
  if (!layoutData) return <div className="empty-note">Stand {snap.stand} has no visits right now: its tree is empty.</div>
  const pad = 40
  const w = layoutData.maxX - layoutData.minX + pad * 2
  const h = layoutData.maxY + pad * 2
  const hl = new Set(snap.highlight || [])
  const ox = -layoutData.minX + pad
  return (
    <div className="m-rb">
      <div className="m-meta">
        <span className="chip">Stand <b>{snap.stand}</b></span>
        <span className="chip">{snap.size} visits</span>
        <span className="chip">height {snap.height}</span>
        <span className="chip">black height {snap.blackHeight}</span>
        {snap.query && <span className="chip cyan">query {hhmm(snap.query[0])} to {hhmm(snap.query[1])}: {hl.size} overlap</span>}
      </div>
      <svg viewBox={'0 0 ' + Math.max(w, 300) + ' ' + Math.max(h, 160)} className="m-svg">
        {layoutData.links.map((l, i) => {
          if (l.target.data.empty) return null
          const d = 'path("M ' + (l.source.x + ox) + ' ' + (l.source.y + pad) + ' L ' + (l.target.x + ox) + ' ' + (l.target.y + pad) + '")'
          return <path key={l.target.data.id + '-' + i} className="rb-edge" style={{ d }} />
        })}
        {layoutData.nodes.map((n) => {
          if (n.data.empty) {
            return n.parent ? (
              <rect key={'nil' + n.parent.data.id + n.x} x={n.x + ox - 4} y={n.y + pad - 4} width="8" height="8" className="rb-nil" />
            ) : null
          }
          const d = n.data
          return (
            <g key={d.id} className="rb-node" style={{ transform: 'translate(' + (n.x + ox) + 'px,' + (n.y + pad) + 'px)' }}>
              {hl.has(d.id) && <circle r="25" className="rb-hl" />}
              <circle r="19" className={d.color === 'RED' ? 'rb-red' : 'rb-black'} />
              <text y="-3" className="rb-key">{hhmm(d.start)}</text>
              <text y="8" className="rb-sub">to {hhmm(d.end)}</text>
              <text y="31" className="rb-max">max {hhmm(d.maxEnd)}</text>
              <title>{d.label}: [{hhmm(d.start)}, {hhmm(d.end)}) maxEnd {hhmm(d.maxEnd)}</title>
            </g>
          )
        })}
      </svg>
      {snap.ops && snap.ops.length > 0 && (
        <div className="m-ops">{snap.ops.map((o, i) => (
          <span key={i} className="chip op">{o.replace(/\[(\d+), (\d+)\)/, (m, a, b) => '[' + hhmm(+a) + ', ' + hhmm(+b) + ')')}</span>
        ))}</div>
      )}
      <div className="m-foot">Each node is one stand visit [on block, off block + buffer). <b>max</b> is the latest end in its subtree, which lets an overlap query skip whole branches: O(log n + k).</div>
    </div>
  )
}
