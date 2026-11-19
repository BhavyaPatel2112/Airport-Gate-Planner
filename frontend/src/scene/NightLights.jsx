import { memo, useMemo } from 'react'
import layout from './layout/stands-layout.json'
import { cityBlocks } from './Ground'

// Lights that fade in after dusk: runway edges, approach strobes, taxiway edges, apron masts, city windows.

function runwayLights(rw) {
  const [ax, ay] = rw.a
  const [bx, by] = rw.b
  const len = Math.hypot(bx - ax, by - ay)
  const ux = (bx - ax) / len
  const uy = (by - ay) / len
  const nx = -uy
  const ny = ux
  const half = rw.width / 2 + 2
  const pts = []
  for (let d = 0; d <= len; d += 36) {
    pts.push([ax + ux * d + nx * half, ay + uy * d + ny * half, 'edge'])
    pts.push([ax + ux * d - nx * half, ay + uy * d - ny * half, 'edge'])
  }
  for (let k = -1; k <= 1; k += 2) {
    pts.push([ax + nx * half * k * 0.5, ay + ny * half * k * 0.5, 'green'])
    pts.push([bx + nx * half * k * 0.5, by + ny * half * k * 0.5, 'red'])
  }
  const strobes = []
  for (let i = 1; i <= 8; i++) {
    strobes.push([bx + ux * i * 28, by + uy * i * 28, i])
    strobes.push([ax - ux * i * 28, ay - uy * i * 28, i])
  }
  return { pts, strobes }
}

function NightLights() {
  const data = useMemo(() => {
    const rws = layout.runways.map(runwayLights)
    const taxi = []
    for (const t of layout.taxiways) {
      for (let i = 1; i < t.pts.length; i++) {
        const [ax, ay] = t.pts[i - 1]
        const [bx, by] = t.pts[i]
        const len = Math.hypot(bx - ax, by - ay)
        for (let d = 0; d < len; d += 30) {
          const k = d / len
          const nx = -(by - ay) / len
          const ny = (bx - ax) / len
          taxi.push([ax + (bx - ax) * k + nx * 10, ay + (by - ay) * k + ny * 10])
          taxi.push([ax + (bx - ax) * k - nx * 10, ay + (by - ay) * k - ny * 10])
        }
      }
    }
    const windows = cityBlocks().filter((b) => b.lit)
    const masts = [[1340, 60], [1340, 460], [1340, 860], [2330, 60], [2330, 460], [2330, 860], [1830, 860],
      [500, 1030], [900, 1030], [1300, 1030], [1640, 1130], [2000, 1130], [2330, 1130]]
    return { rws, taxi, windows, masts }
  }, [])
  return (
    <g>
      {data.masts.map(([x, y], i) => (
        <circle key={'m' + i} cx={x} cy={y} r="120" fill="url(#mastGlow)" />
      ))}
      {data.windows.map((b, i) => (
        <rect key={'w' + i} x={b.x + b.w * 0.3} y={b.y + b.h * 0.3} width={2.4} height={2.4}
          fill={b.tone > 0.5 ? '#ffd27a' : '#fff1c9'} opacity={0.55 + b.tone * 0.4} />
      ))}
      {data.taxi.map(([x, y], i) => <circle key={'t' + i} cx={x} cy={y} r="1.6" fill="#4d8bff" />)}
      {data.rws.map((r, j) => (
        <g key={j}>
          {r.pts.map(([x, y, kind], i) => (
            <circle key={i} cx={x} cy={y} r={kind === 'edge' ? 1.8 : 2.4}
              fill={kind === 'edge' ? '#fff4d6' : kind === 'green' ? '#3dff8a' : '#ff4040'} />
          ))}
          {r.strobes.map(([x, y, i], k) => (
            <circle key={'s' + k} className="strobe" cx={x} cy={y} r="3" fill="#ffffff"
              style={{ animationDelay: (i * 0.06).toFixed(2) + 's' }} />
          ))}
        </g>
      ))}
    </g>
  )
}

export default memo(NightLights)
