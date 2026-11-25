import { memo, useMemo } from 'react'
import layout from './layout/stands-layout.json'
import { WORLD, pathD } from './geometry'

// Static airport drawing: city, sea, grass, aprons, runways, taxiways, stand markings and terminals.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FENCE = { x: 300, y: -20, w: 2110, h: 1330 }

export function cityBlocks() {
  const r = rng(2026)
  const blocks = []
  const zones = [
    [140, -165, 2560, 140],
    [140, 1316, 2560, 230],
    [2418, -20, 280, 1340],
    [150, -20, 145, 1340]
  ]
  for (const [zx, zy, zw, zh] of zones) {
    const count = Math.round((zw * zh) / 2300)
    for (let i = 0; i < count; i++) {
      const w = 10 + r() * 30
      const h = 8 + r() * 26
      const x = zx + r() * (zw - w)
      const y = zy + r() * (zh - h)
      const tone = r()
      blocks.push({ x, y, w, h, tone, lit: r() < 0.55, rot: (r() - 0.5) * 8 })
    }
  }
  return blocks
}

function armRect(dir, start, end, half) {
  const c = layout.core
  const a = [c[0] + dir[0] * start, c[1] + dir[1] * start]
  const b = [c[0] + dir[0] * end, c[1] + dir[1] * end]
  const n = [-dir[1] * half, dir[0] * half]
  return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]
}

export const ARMS = (() => {
  const ca = Math.cos((layout.armAngle * Math.PI) / 180)
  const sa = Math.sin((layout.armAngle * Math.PI) / 180)
  return [[-ca, sa], [ca, sa], [-ca, -sa], [ca, -sa]]
})()

function runwayGeom(rw) {
  const [ax, ay] = rw.a
  const [bx, by] = rw.b
  const len = Math.hypot(bx - ax, by - ay)
  const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
  return { ax, ay, len, ang }
}

function Runway({ rw }) {
  const { ax, ay, len, ang } = runwayGeom(rw)
  const w = rw.width
  const keys = []
  for (let i = 0; i < 6; i++) {
    const off = -w / 2 + 4 + i * ((w - 8) / 6) + 1
    keys.push(<rect key={'a' + i} x={10} y={off} width={34} height={2.6} fill="#eef1f4" />)
    keys.push(<rect key={'b' + i} x={len - 44} y={off} width={34} height={2.6} fill="#eef1f4" />)
  }
  const tdz = []
  for (const d of [150, 230, 310]) {
    tdz.push(<rect key={'t' + d} x={d} y={-w / 2 + 5} width={22} height={3} fill="#e6e9ec" opacity="0.85" />)
    tdz.push(<rect key={'u' + d} x={d} y={w / 2 - 8} width={22} height={3} fill="#e6e9ec" opacity="0.85" />)
    tdz.push(<rect key={'v' + d} x={len - d - 22} y={-w / 2 + 5} width={22} height={3} fill="#e6e9ec" opacity="0.85" />)
    tdz.push(<rect key={'w' + d} x={len - d - 22} y={w / 2 - 8} width={22} height={3} fill="#e6e9ec" opacity="0.85" />)
  }
  return (
    <g transform={'translate(' + ax + ' ' + ay + ') rotate(' + ang + ')'}>
      <rect x={-14} y={-w / 2 - 10} width={len + 28} height={w + 20} fill="#5e6b4a" opacity="0.5" rx="4" />
      <rect x={0} y={-w / 2} width={len} height={w} fill="url(#asphalt)" />
      <rect x={0} y={-w / 2} width={len} height={w} fill="none" stroke="#f0f2f4" strokeWidth="1" opacity="0.8" />
      <line x1={60} y1={0} x2={len - 60} y2={0} stroke="#f2f4f6" strokeWidth="1.6" strokeDasharray="22 16" />
      {keys}
      {tdz}
      <text x={56} y={0} transform={'rotate(90 56 0)'} textAnchor="middle" dominantBaseline="middle" fill="#f6f7f8"
        fontFamily="JetBrains Mono" fontWeight="700" fontSize="15">{rw.ends[0]}</text>
      <text x={len - 56} y={0} transform={'rotate(-90 ' + (len - 56) + ' 0)'} textAnchor="middle" dominantBaseline="middle"
        fill="#f6f7f8" fontFamily="JetBrains Mono" fontWeight="700" fontSize="15">{rw.ends[1]}</text>
    </g>
  )
}

function Terminal2() {
  const c = layout.core
  const arms = ARMS.map((d) => armRect(d, layout.armStart, layout.armEnd, layout.armHalf))
  const coreW = 300
  const coreH = 168
  return (
    <g>
      <g className="building-shadow">
        {arms.map((p, i) => <path key={i} d={pathD(p) + 'Z'} />)}
        <rect x={c[0] - coreW / 2} y={c[1] - coreH / 2} width={coreW} height={coreH} rx="34" />
      </g>
      {arms.map((p, i) => (
        <g key={i}>
          <path d={pathD(p) + 'Z'} fill="url(#roofArm)" stroke="#9aa5b2" strokeWidth="1" />
          <line x1={(p[0][0] + p[3][0]) / 2} y1={(p[0][1] + p[3][1]) / 2} x2={(p[1][0] + p[2][0]) / 2}
            y2={(p[1][1] + p[2][1]) / 2} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
        </g>
      ))}
      <rect x={c[0] - coreW / 2} y={c[1] - coreH / 2} width={coreW} height={coreH} rx="34" fill="url(#roofCore)"
        stroke="#9aa5b2" strokeWidth="1.2" />
      <rect x={c[0] - coreW / 2 + 10} y={c[1] - coreH / 2 + 10} width={coreW - 20} height={coreH - 20} rx="26"
        fill="url(#coffer)" opacity="0.6" />
      {[-90, -45, 0, 45, 90].map((dx) => (
        <circle key={dx} cx={c[0] + dx} cy={c[1] - 18} r="7" fill="#cfe6f5" opacity="0.55" />
      ))}
      <text x={c[0]} y={c[1] + 40} textAnchor="middle" fontSize="15" fontWeight="800" letterSpacing="5" fill="#6d7887"
        fontFamily="Inter">TERMINAL 2</text>
      {/* landside forecourt and elevated road */}
      <path d={'M' + (c[0] - 160) + ' ' + (c[1] - 100) + ' Q ' + c[0] + ' ' + (c[1] - 150) + ' ' + (c[0] + 160) + ' ' + (c[1] - 100)}
        fill="none" stroke="#4f565f" strokeWidth="14" opacity="0.9" />
      <path d={'M' + (c[0] - 160) + ' ' + (c[1] - 100) + ' Q ' + c[0] + ' ' + (c[1] - 150) + ' ' + (c[0] + 160) + ' ' + (c[1] - 100)}
        fill="none" stroke="#c9ced4" strokeWidth="1" strokeDasharray="6 6" opacity="0.6" />
    </g>
  )
}

function Terminal1() {
  return (
    <g>
      <rect className="building-shadow" x={450} y={1140} width={830} height={70} rx="8" />
      <rect x={450} y={1140} width={830} height={70} rx="8" fill="url(#roofArm)" stroke="#9aa5b2" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={480 + i * 112} y={1158} width={80} height={34} rx="4" fill="#c3ccd6" opacity="0.7" />
      ))}
      <text x={865} y={1181} textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="5" fill="#6d7887">TERMINAL 1</text>
    </g>
  )
}

function StandMarks() {
  return (
    <g>
      {layout.stands.map((s) => {
        const rad = (s.heading * Math.PI) / 180
        const nose = [s.x + Math.cos(rad) * (s.size === 'WIDE' ? 32 : 22), s.y + Math.sin(rad) * (s.size === 'WIDE' ? 32 : 22)]
        const lx = s.x - Math.cos(rad) * (s.size === 'WIDE' ? 46 : 34)
        const ly = s.y - Math.sin(rad) * (s.size === 'WIDE' ? 46 : 34)
        return (
          <g key={s.id}>
            <line x1={s.lane[0]} y1={s.lane[1]} x2={nose[0]} y2={nose[1]} stroke="#f2c230" strokeWidth="1.1" opacity="0.85" />
            <line x1={nose[0] - Math.sin(rad) * 6} y1={nose[1] + Math.cos(rad) * 6} x2={nose[0] + Math.sin(rad) * 6}
              y2={nose[1] - Math.cos(rad) * 6} stroke="#f4f4f4" strokeWidth="1.4" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="700"
              fontFamily="JetBrains Mono" fill="#f6e7a6" opacity="0.92">{s.id}</text>
          </g>
        )
      })}
    </g>
  )
}

export function GroundDefs() {
  return (
    <defs>
      <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#5b6a43" />
        <path d="M0 10 h40 M0 30 h40" stroke="#62724a" strokeWidth="6" opacity="0.35" />
      </pattern>
      <pattern id="concrete" width="60" height="60" patternUnits="userSpaceOnUse">
        <rect width="60" height="60" fill="#8b929b" />
        <path d="M0 0 H60 V60" fill="none" stroke="#7e858e" strokeWidth="1" />
      </pattern>
      <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3f46" />
        <stop offset="1" stopColor="#30353b" />
      </linearGradient>
      <linearGradient id="roofCore" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f2f4f6" />
        <stop offset="0.55" stopColor="#d9dee4" />
        <stop offset="1" stopColor="#c3cad3" />
      </linearGradient>
      <linearGradient id="roofArm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9edf1" />
        <stop offset="1" stopColor="#cdd3db" />
      </linearGradient>
      <pattern id="coffer" width="18" height="18" patternUnits="userSpaceOnUse">
        <path d="M9 0 L18 9 L9 18 L0 9 Z" fill="none" stroke="#aeb7c2" strokeWidth="0.8" />
      </pattern>
      <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="10" height="10" fill="#ffffff" />
        <rect width="5" height="10" fill="#e3262f" />
      </pattern>
      <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0d4f7a" />
        <stop offset="0.8" stopColor="#1a6f97" />
        <stop offset="1" stopColor="#3e93b0" />
      </linearGradient>
      <filter id="blur6"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="blur2"><feGaussianBlur stdDeviation="2" /></filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

function Ground() {
  const blocks = useMemo(cityBlocks, [])
  const coast = 'M' + WORLD.x + ' ' + WORLD.y + ' L 120 ' + WORLD.y + ' C 80 200 150 420 100 700 C 60 980 130 1200 90 1560 L ' + WORLD.x + ' 1560 Z'
  const beach = 'M 120 ' + WORLD.y + ' C 80 200 150 420 100 700 C 60 980 130 1200 90 1560'
  return (
    <g>
      <rect x={WORLD.x} y={WORLD.y} width={WORLD.w} height={WORLD.h} fill="#77746a" />
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h}
          fill={b.tone < 0.33 ? '#8d8a80' : b.tone < 0.66 ? '#6c6b66' : '#a19a8b'}
          transform={'rotate(' + b.rot + ' ' + (b.x + b.w / 2) + ' ' + (b.y + b.h / 2) + ')'} />
      ))}
      <path d={coast} fill="url(#sea)" />
      <path d={beach} fill="none" stroke="#cdb98d" strokeWidth="18" />
      <g className="waves" stroke="#d4eef7" strokeWidth="1.4" fill="none" opacity="0.5">
        <path d="M-260 120 q 30 -10 60 0 t 60 0 t 60 0" />
        <path d="M-200 480 q 30 -10 60 0 t 60 0 t 60 0" />
        <path d="M-240 860 q 30 -10 60 0 t 60 0 t 60 0" />
        <path d="M-180 1240 q 30 -10 60 0 t 60 0 t 60 0" />
      </g>
      <text x={-150} y={720} transform="rotate(-90 -150 720)" textAnchor="middle" fill="#b9e3f2" opacity="0.65"
        fontSize="30" fontStyle="italic" letterSpacing="14" fontFamily="Georgia, serif">ARABIAN SEA</text>
      <rect x={FENCE.x} y={FENCE.y} width={FENCE.w} height={FENCE.h} fill="url(#grass)" stroke="#cfd5db"
        strokeWidth="2" strokeDasharray="10 6" />
      {/* aprons */}
      <rect x={1300} y={22} width={1076} height={866} rx="18" fill="url(#concrete)" />
      <rect x={440} y={1010} width={1000} height={134} rx="10" fill="url(#concrete)" />
      <rect x={1560} y={1108} width={800} height={176} rx="12" fill="url(#concrete)" />
      {/* taxiways */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {layout.taxiways.map((t) => <path key={t.id} d={pathD(t.pts)} stroke="#454b53" strokeWidth="18" />)}
        {Object.entries(layout.groups).map(([k, g]) => (
          <path key={k} d={pathD(g.lane)} stroke="#4c525a" strokeWidth="12" opacity="0.75" />
        ))}
        {/* runway exits */}
        <path d="M1790 930 L1748 868" stroke="#454b53" strokeWidth="18" />
        <path d="M1725 930 L1690 1000" stroke="#454b53" strokeWidth="18" />
        {layout.taxiways.map((t) => <path key={'c' + t.id} d={pathD(t.pts)} stroke="#f2c230" strokeWidth="1.5" />)}
        {Object.entries(layout.groups).map(([k, g]) => (
          <path key={'lc' + k} d={pathD(g.lane)} stroke="#f2c230" strokeWidth="1.3" opacity="0.9" />
        ))}
        <path d="M1790 930 L1748 868 M1725 930 L1690 1000" stroke="#f2c230" strokeWidth="1.5" />
        <path d="M1498 868 L1498 762 L1494 753 M2162 868 L2162 762 L2166 753" stroke="#f2c230" strokeWidth="1.3" />
      </g>
      {layout.runways.map((rw) => <Runway key={rw.id} rw={rw} />)}
      <StandMarks />
      <Terminal2 />
      <Terminal1 />
      {/* control tower */}
      <g>
        <ellipse className="building-shadow" cx={1188} cy={1262} rx="13" ry="13" />
        <circle cx={1180} cy={1256} r="13" fill="#d7dce2" stroke="#8d98a5" />
        <circle cx={1180} cy={1256} r="7" fill="#2e4b62" />
        <text x={1180} y={1282} textAnchor="middle" fontSize="8" fontWeight="700" fill="#e9edf1">ATC</text>
      </g>
      {/* taxiway signs */}
      {[['B', 1050, 852], ['A', 1050, 1016], ['W', 1404, 470], ['E', 2280, 470], ['N', 1850, 52], ['K', 1508, 820],
        ['R', 1592, 1100], ['S', 1080, 1046]].map(([t, x, y]) => (
        <g key={t} transform={'translate(' + x + ' ' + y + ')'}>
          <rect x="-7" y="-7" width="14" height="14" rx="2" fill="#111" stroke="#ffcc00" />
          <text x="0" y="0.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#ffcc00">{t}</text>
        </g>
      ))}
    </g>
  )
}

export default memo(Ground)
