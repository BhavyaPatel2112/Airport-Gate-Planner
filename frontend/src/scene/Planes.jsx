import layout from './layout/stands-layout.json'
import { PlaneShape, PlaneShadow } from './PlaneIcon'
import { tailColour } from './lighting'
import { standIndex } from './geometry'

// Aircraft, their ground shadows and the jet bridges, redrawn every frame from planeState().

function Bridge({ s, docked }) {
  const rad = (s.heading * Math.PI) / 180
  const side = [Math.sin(rad), -Math.cos(rad)]
  const base = [s.bridge[0] + side[0] * 9, s.bridge[1] + side[1] * 9]
  const len = docked ? (s.size === 'WIDE' ? 20 : 15) : 7
  const ang = s.heading + 180 + (docked ? 18 : 30)
  return (
    <g transform={'translate(' + base[0] + ' ' + base[1] + ') rotate(' + ang + ')'}>
      <rect className="bridge" x={-len} y={-2.6} width={len} height={5.2} rx="1.2" fill="#aeb8c3" stroke="#5f6b78"
        strokeWidth="0.7" />
      <circle r="3.4" fill="#8f9aa6" stroke="#5f6b78" strokeWidth="0.7" />
    </g>
  )
}

export default function Planes({ items, selectedId, hoverId, onSelect, onHover, night, shadow, showLabels, strobeOn }) {
  const docked = new Set()
  for (const it of items) {
    if (it.state.phase === 'parked' && it.visit.stand) docked.add(it.visit.stand)
  }
  return (
    <g>
      <g className="bridges">
        {layout.stands.filter((s) => s.contact && s.bridge).map((s) => (
          <Bridge key={s.id} s={s} docked={docked.has(s.id)} />
        ))}
      </g>
      <g opacity={Math.max(0.12, shadow.opacity + 0.1)} filter="url(#blur2)">
        {items.map(({ visit, state }) => {
          const alt = state.alt || 0
          const dx = (shadow.dx || 2) + alt * 70
          const dy = (shadow.dy || 3) + alt * 110
          const sc = 1 - alt * 0.25
          return (
            <g key={visit.id} transform={'translate(' + (state.x + dx) + ' ' + (state.y + dy) + ') rotate(' + state.heading
              + ') scale(' + sc + ')'} fill="#000" opacity={state.opacity ?? 1}>
              <PlaneShadow wide={visit.size === 'WIDE'} />
            </g>
          )
        })}
      </g>
      {items.map(({ visit, state }) => {
        if (!state.smoke) return null
        return (
          <g key={'smoke' + visit.id} opacity={state.smoke * 0.8}>
            <circle cx={state.x + 14} cy={state.y - 5} r={4 + (1 - state.smoke) * 8} fill="#f2f2f2" filter="url(#blur2)" />
            <circle cx={state.x + 18} cy={state.y + 5} r={3 + (1 - state.smoke) * 7} fill="#e8e8e8" filter="url(#blur2)" />
          </g>
        )
      })}
      {items.map(({ visit, state }) => {
        const alt = state.alt || 0
        const scale = 1 + alt * 0.45
        const selected = visit.id === selectedId
        const hovered = visit.id === hoverId
        const moving = state.phase !== 'parked'
        const label = visit.arrival && (state.phase === 'approach' || state.phase === 'rollout' || state.phase === 'taxi-in'
          || state.phase === 'holding') ? visit.arrival.number : visit.departure ? visit.departure.number : visit.label
        return (
          <g key={visit.id} className="plane" opacity={state.opacity ?? 1}
            onClick={(e) => { e.stopPropagation(); onSelect(visit.id) }}
            onMouseEnter={() => onHover(visit.id)} onMouseLeave={() => onHover(null)}>
            {state.unplaced && (
              <circle cx={state.x} cy={state.y} r={34} fill="rgba(255,77,77,0.14)" stroke="#ff4d4d" strokeWidth="2"
                className="halo" />
            )}
            {selected && (
              <circle cx={state.x} cy={state.y} r={visit.size === 'WIDE' ? 46 : 34} fill="none" stroke="#38d7ff"
                strokeWidth="2.5" className="sel-ring" />
            )}
            <g transform={'translate(' + state.x + ' ' + state.y + ') rotate(' + state.heading + ') scale(' + scale + ')'}>
              <rect x={-26} y={-22} width={52} height={44} fill="transparent" />
              <PlaneShape wide={visit.size === 'WIDE'} tail={tailColour(visit.airlineCode)} night={night > 0.3}
                strobe={strobeOn && moving} />
            </g>
            {(selected || hovered || (showLabels && moving)) && (
              <g transform={'translate(' + (state.x + 16) + ' ' + (state.y - 30 - alt * 20) + ')'} pointerEvents="none">
                <rect x={0} y={-11} width={label.length * 7 + 12} height={17} rx="3"
                  fill={state.unplaced ? '#ff4d4d' : selected ? '#38d7ff' : 'rgba(10,15,25,0.85)'}
                  stroke={state.unplaced ? '#ff4d4d' : '#ffcc00'} strokeWidth="0.8" />
                <text x={6} y={1.5} fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono"
                  fill={selected || state.unplaced ? '#0b1220' : '#ffcc00'}>{label}</text>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

export function standPoint(id) {
  const s = standIndex[id]
  return s ? [s.x, s.y] : null
}
