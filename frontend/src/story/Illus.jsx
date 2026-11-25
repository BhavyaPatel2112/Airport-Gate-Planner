// Small animated diagrams for each story stop. Plain SVG with CSS animation.
const W = 360
const H = 170

function Sort() {
  const vals = [7, 2, 9, 4, 1, 8, 3, 6, 5, 10]
  const sorted = [...vals].sort((a, b) => a - b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      {vals.map((v, i) => {
        const to = sorted.indexOf(v)
        return (
          <g key={v} className="il-bar" style={{ '--dx': (to - i) * 32 + 'px', animationDelay: i * 0.06 + 's' }}>
            <rect x={22 + i * 32} y={140 - v * 11} width="22" height={v * 11} rx="4" fill={v === 10 ? '#ffb547' : '#8b7dff'} />
            <text x={33 + i * 32} y="158" textAnchor="middle">{String(v * 2).padStart(2, '0')}:00</text>
          </g>
        )
      })}
    </svg>
  )
}

function Heap() {
  const nodes = [[60, 40, '06:10', true], [150, 40, '06:25'], [250, 40, '07:05'], [130, 100, '06:40'], [170, 100, '07:30'], [230, 100, '07:15'], [270, 100, '08:00'], [250, 150, '08:20']]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      <line x1="40" y1="40" x2="300" y2="40" className="il-link dashed" />
      {[[150, 40, 130, 100], [150, 40, 170, 100], [250, 40, 230, 100], [250, 40, 270, 100], [270, 100, 250, 150]].map(([a, b, c, d], i) => (
        <line key={i} x1={a} y1={b} x2={c} y2={d} className="il-link" />
      ))}
      {nodes.map(([x, y, t, min], i) => (
        <g key={i} className={min ? 'il-node min' : 'il-node'}>
          <circle cx={x} cy={y} r="17" />
          <text x={x} y={y + 4} textAnchor="middle">{t}</text>
        </g>
      ))}
      <text x="60" y="76" textAnchor="middle" className="il-cap">free first</text>
    </svg>
  )
}

function Intervals() {
  const rows = [[[20, 110], [150, 240]], [[60, 180], [210, 320]], [[40, 90], [120, 200], [260, 330]], [[100, 230]]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      {rows.map((r, i) => r.map(([a, b], j) => (
        <rect key={i + '-' + j} x={a} y={18 + i * 24} width={b - a} height="15" rx="5" className={'il-int' + (i === 3 ? ' hot' : '')}
          style={{ animationDelay: (i * 2 + j) * 0.12 + 's' }} />
      )))}
      <path d="M20,160 L60,148 L100,140 L130,128 L160,124 L190,132 L220,128 L250,140 L290,146 L330,152" className="il-curve" />
      <line x1="160" x2="160" y1="10" y2="165" className="il-peak" />
      <text x="166" y="118" className="il-cap warm">busiest moment</text>
    </svg>
  )
}

function Text() {
  const s = 'VABB STAND 92 CLSD 1000-1200 DUE GSE WORK'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      <text x="14" y="52" className="il-mono">{s.split('').map((ch, i) => (
        <tspan key={i} className={i >= 11 && i <= 12 ? 'hit' : ''}>{ch}</tspan>
      ))}</text>
      <path d="M118,62 L118,92 L80,120" className="il-link" />
      <path d="M118,92 L160,120" className="il-link" />
      <circle cx="118" cy="92" r="6" className="il-dot" />
      <circle cx="80" cy="124" r="6" className="il-dot" />
      <circle cx="160" cy="124" r="6" className="il-dot on" />
      <text x="174" y="128" className="il-cap">"92" found: stand 92 closes</text>
    </svg>
  )
}

function Match() {
  const L = ['6E 233', 'AI 2927', 'EK 500', 'QR 556']
  const Rr = ['41A', '41B', '52', '67A']
  const m = [[0, 1], [1, 0], [2, 3], [3, 2]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      {L.map((l, i) => Rr.map((r, j) => (Math.abs(i - j) <= 2 ? <line key={i + '-' + j} x1="100" y1={25 + i * 38} x2="260" y2={25 + j * 38} className="il-edge" /> : null)))}
      {m.map(([i, j], k) => <line key={k} x1="100" y1={25 + i * 38} x2="260" y2={25 + j * 38} className="il-edge on" style={{ animationDelay: k * 0.35 + 's' }} />)}
      {L.map((l, i) => <g key={l}><circle cx="100" cy={25 + i * 38} r="6" className="il-dot on" /><text x="88" y={29 + i * 38} textAnchor="end" className="il-lbl">{l}</text></g>)}
      {Rr.map((r, j) => <g key={r}><circle cx="260" cy={25 + j * 38} r="6" className="il-dot" /><text x="274" y={29 + j * 38} className="il-lbl">Stand {r}</text></g>)}
    </svg>
  )
}

function Select() {
  const bars = [3, 6, 11, 16, 19, 17, 13, 10, 7, 5, 4, 3, 2, 2, 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus">
      {bars.map((b, i) => (
        <rect key={i} x={20 + i * 21} y={140 - b * 6} width="16" height={b * 6} rx="3" className={'il-hist' + (i <= 7 ? ' in' : '')}
          style={{ animationDelay: i * 0.05 + 's' }} />
      ))}
      <line x1={20 + 8 * 21 - 2} x2={20 + 8 * 21 - 2} y1="20" y2="146" className="il-peak" />
      <text x={20 + 8 * 21 + 4} y="30" className="il-cap warm">75th percentile = buffer</text>
      <text x="20" y="162" className="il-cap">on time</text>
      <text x="300" y="162" className="il-cap">very late</text>
    </svg>
  )
}

export default function Illus({ kind }) {
  if (kind === 'sort') return <Sort />
  if (kind === 'heap') return <Heap />
  if (kind === 'intervals') return <Intervals />
  if (kind === 'text') return <Text />
  if (kind === 'match') return <Match />
  if (kind === 'select') return <Select />
  return null
}
