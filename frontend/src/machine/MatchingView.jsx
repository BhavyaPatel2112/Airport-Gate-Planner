import { useApp } from '../state/app'
import { hhmm } from '../state/clock'

// Bipartite graph of the last recovery: flights left, stands right, matched edges in cyan, min-cut set in red.

export function MatchingGraph({ snap, height = 300 }) {
  const L = snap.left
  const R = snap.right
  const rowH = Math.max(15, Math.min(22, (height - 30) / Math.max(L.length, R.length, 1)))
  const H = Math.max(L.length, R.length) * rowH + 30
  const W = 360
  const ly = (i) => 20 + i * rowH + ((Math.max(L.length, R.length) - L.length) * rowH) / 2
  const ry = (j) => 20 + j * rowH + ((Math.max(L.length, R.length) - R.length) * rowH) / 2
  const cutL = new Set(snap.cutLeft || [])
  const cutR = new Set(snap.cutRight || [])
  const matchedL = new Set(snap.matched.map(([i]) => i))
  const matchedKey = new Set(snap.matched.map(([i, j]) => i + ':' + j))
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className="m-svg match">
      {snap.edges.map(([i, j], k) => {
        const m = matchedKey.has(i + ':' + j)
        const cut = cutL.has(i) && cutR.has(j)
        return (
          <line key={k} x1="118" y1={ly(i)} x2="262" y2={ry(j)} className={m ? 'me matched' : cut ? 'me cut' : 'me'}
            style={m ? { animationDelay: (k % 20) * 0.04 + 's' } : undefined} />
        )
      })}
      {L.map((f, i) => (
        <g key={f.id} transform={'translate(0 ' + ly(i) + ')'}>
          <rect x="4" y={-rowH / 2 + 2} width="112" height={rowH - 4} rx="4"
            className={'mn' + (cutL.has(i) ? ' cut' : '') + (!matchedL.has(i) ? ' unmatched' : '')} />
          <text x="10" y="4" className="mt">{f.label.length > 15 ? f.label.slice(0, 14) + '…' : f.label}</text>
          {f.size === 'WIDE' && <text x="110" y="4" className="mt w" textAnchor="end">W</text>}
          <title>{f.label}: {hhmm(f.start)} to {hhmm(f.end)}</title>
        </g>
      ))}
      {R.map((s, j) => (
        <g key={s.id} transform={'translate(264 ' + ry(j) + ')'}>
          <rect x="0" y={-rowH / 2 + 2} width="90" height={rowH - 4} rx="4" className={'sn' + (cutR.has(j) ? ' cut' : '')} />
          <text x="8" y="4" className="mt st">{s.id}</text>
          <text x="84" y="4" className="mt w" textAnchor="end">{s.size === 'WIDE' ? 'W' : ''}{s.contact ? '' : ' R'}</text>
        </g>
      ))}
    </svg>
  )
}

export default function MatchingView() {
  const app = useApp()
  const snap = app.plan && app.plan.snapshots && app.plan.snapshots.matching
  if (!snap) return <div className="empty-note">No recovery yet. Delay a flight, start a storm or close stands: the flights that must move and the free stands appear here.</div>
  const unmatched = snap.left.length - snap.matched.length
  return (
    <div className="m-match">
      <div className="m-meta">
        <span className="chip">{snap.method === 'matching' ? 'Edmonds-Karp' : 'Greedy'}</span>
        <span className="chip">window of {snap.windowSize} flights</span>
        <span className="chip">{snap.standsConsidered} free stands</span>
        <span className="chip cyan">{snap.matched.length} matched</span>
        {unmatched > 0 && <span className="chip bad">{unmatched} unmatched</span>}
      </div>
      <MatchingGraph snap={snap} height={300} />
      {snap.cutLeft && snap.cutLeft.length > 0 ? (
        <div className="m-foot hall">
          <b>Minimum cut:</b> the red flights S can only use the red stands N(S). |S| = {snap.cutLeft.length} &gt; |N(S)| = {snap.cutRight.length},
          so by Hall's theorem no plan can place them all. Shortage: {snap.deficiency}.
        </div>
      ) : (
        <div className="m-foot">Cyan edges are the maximum matching: no augmenting path is left, so no assignment places more of these flights.</div>
      )}
    </div>
  )
}
