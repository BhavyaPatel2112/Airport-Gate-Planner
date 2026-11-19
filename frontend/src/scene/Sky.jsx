import { memo, useMemo } from 'react'

// Sky band behind the tilted airport: gradient from the clock, Mumbai skyline, stars and the sea link.

function Skyline({ night }) {
  const towers = useMemo(() => {
    let s = 7
    const r = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const out = []
    let x = 0
    while (x < 1600) {
      const w = 14 + r() * 34
      const h = 18 + r() * (x > 900 && x < 1250 ? 120 : 60)
      out.push({ x, w, h, lit: r() })
      x += w + r() * 6
    }
    return out
  }, [])
  const fill = night > 0.5 ? '#0a0f1e' : '#3d4a63'
  return (
    <svg className="skyline" viewBox="0 0 1600 160" preserveAspectRatio="none">
      {/* cable-stayed sea link on the left */}
      <g stroke={fill} strokeWidth="2" opacity="0.9">
        <line x1="40" y1="150" x2="420" y2="150" strokeWidth="5" />
        <line x1="170" y1="150" x2="170" y2="70" strokeWidth="5" />
        <line x1="290" y1="150" x2="290" y2="82" strokeWidth="5" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <line x1="170" y1={74 + i * 6} x2={100 - i * 12} y2="150" strokeWidth="1" />
            <line x1="170" y1={74 + i * 6} x2={240 + i * 10} y2="150" strokeWidth="1" />
            <line x1="290" y1={86 + i * 6} x2={232 - i * 8} y2="150" strokeWidth="1" />
            <line x1="290" y1={86 + i * 6} x2={350 + i * 12} y2="150" strokeWidth="1" />
          </g>
        ))}
      </g>
      {towers.map((t, i) => (
        <g key={i}>
          <rect x={460 + t.x * 0.72} y={160 - t.h} width={t.w * 0.72} height={t.h} fill={fill} />
          {night > 0.5 && t.lit > 0.4 && (
            <rect x={460 + t.x * 0.72 + 3} y={160 - t.h + 6} width={2} height={2} fill="#ffd27a" opacity="0.8" />
          )}
        </g>
      ))}
    </svg>
  )
}

function Stars({ night }) {
  const stars = useMemo(() => {
    const out = []
    let s = 99
    for (let i = 0; i < 80; i++) {
      s = (s * 16807) % 2147483647
      const x = (s % 1000) / 10
      s = (s * 16807) % 2147483647
      const y = (s % 1000) / 60
      out.push([x, y, (s % 7) / 7])
    }
    return out
  }, [])
  return (
    <div className="stars" style={{ opacity: night }}>
      {stars.map(([x, y, b], i) => (
        <span key={i} style={{ left: x + '%', top: y + '%', opacity: 0.4 + b * 0.6, animationDelay: b * 3 + 's' }} />
      ))}
    </div>
  )
}

function Sky({ light, storm }) {
  const top = storm ? '#1f2633' : light.top
  const horizon = storm ? '#4a5466' : light.horizon
  return (
    <div className="sky" style={{ background: 'linear-gradient(180deg, ' + top + ' 0%, ' + horizon + ' 100%)' }}>
      <Stars night={storm ? 0 : light.night} />
      <Skyline night={light.night} />
    </div>
  )
}

export default memo(Sky)
