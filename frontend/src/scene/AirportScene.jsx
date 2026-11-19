import { useEffect, useMemo, useRef, useState } from 'react'
import Ground, { GroundDefs } from './Ground'
import NightLights from './NightLights'
import Planes from './Planes'
import Sky from './Sky'
import Weather from './Weather'
import { WORLD, planeState, standIndex, HOLDING_PATTERN } from './geometry'
import { lightAt } from './lighting'
import { useClockValue, hhmm } from '../state/clock'
import { useApp } from '../state/app'
import './scene.css'

const MAX_ZOOM = 6
const HOME = { cx: 1290, cy: 610 }

/** Zoom that shows the whole airport (2550 x 1480 world units) in a panel of this aspect ratio. */
function fitZoom(aspect) {
  const vw = Math.max(2550, 1480 * aspect)
  return WORLD.w / vw
}

function ClosureLayer({ closures, minute }) {
  const active = closures.filter((c) => c.from <= minute && minute < c.to)
  const seen = new Set()
  return (
    <g>
      {active.map((c) => {
        if (seen.has(c.standId)) return null
        seen.add(c.standId)
        const s = standIndex[c.standId]
        if (!s) return null
        const w = s.size === 'WIDE' ? 56 : 42
        return (
          <g key={c.standId} transform={'translate(' + s.x + ' ' + s.y + ') rotate(' + s.heading + ')'}>
            <rect x={-w / 2} y={-w / 2 + 4} width={w} height={w - 8} fill="url(#hatch)" opacity="0.75" stroke="#e3262f"
              strokeWidth="1.5" />
            <g transform={'rotate(' + -s.heading + ')'}>
              <rect x={-19} y={-7} width={38} height={13} rx="2" fill="#e3262f" />
              <text x={0} y={2.5} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="Inter">CLOSED</text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

function EffectsLayer({ effects, now }) {
  return (
    <g pointerEvents="none">
      {effects.map((e, i) => {
        const age = (now - e.t0) / 1000
        if (age > 5) return null
        const fade = Math.max(0, 1 - age / 5)
        const from = e.from ? standIndex[e.from] : null
        const to = e.to ? standIndex[e.to] : null
        return (
          <g key={i} opacity={fade}>
            {from && (
              <circle cx={from.x} cy={from.y} r={30 + (age % 1) * 14} fill="none"
                stroke={e.kind === 'unplaced' ? '#ff4d4d' : '#ffb020'} strokeWidth="3" />
            )}
            {to && <circle cx={to.x} cy={to.y} r={26 + ((age * 1.4) % 1) * 18} fill="none" stroke="#3ddc84" strokeWidth="3" />}
            {from && to && (
              <path d={'M' + from.x + ' ' + from.y + ' Q ' + ((from.x + to.x) / 2) + ' ' + (Math.min(from.y, to.y) - 120) + ' '
                + to.x + ' ' + to.y} fill="none" stroke="#38d7ff" strokeWidth="2.6" strokeDasharray="10 8"
                className="route-dash" filter="url(#glow)" />
            )}
          </g>
        )
      })}
    </g>
  )
}

export default function AirportScene() {
  const app = useApp()
  const minute = useClockValue()
  const wrap = useRef(null)
  const [aspect, setAspect] = useState(2)
  const [cam, setCam] = useState({ ...HOME, z: 1 })
  const touched = useRef(false)

  useEffect(() => {
    const el = wrap.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => {
      const a = el.offsetWidth / Math.max(1, el.offsetHeight)
      setAspect(a)
      if (!touched.current) setCam({ ...HOME, z: fitZoom(a) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [app.tilt])
  const minZoom = fitZoom(aspect) * 0.8
  const drag = useRef(null)
  const [hoverId, setHoverId] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const light = lightAt(minute)
  const visits = app.plan ? app.plan.visits : []
  const closures = app.plan ? app.plan.closures : []

  const items = []
  for (const v of visits) {
    const st = planeState(v, minute)
    if (st) items.push({ visit: v, state: st })
  }

  // follow a flight: the camera centre is the aircraft itself while following
  const followed = app.follow ? items.find((it) => it.visit.id === app.follow) : null
  const lastFollow = useRef(null)
  if (followed) lastFollow.current = { cx: followed.state.x, cy: followed.state.y }
  useEffect(() => {
    if (!app.follow && lastFollow.current) {
      const p = lastFollow.current
      lastFollow.current = null
      setCam((c) => ({ ...c, cx: p.cx, cy: p.cy }))
    }
  }, [app.follow])
  const view = followed ? { cx: followed.state.x, cy: followed.state.y, z: Math.max(cam.z, 2.4) } : cam

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (app.focusStand && standIndex[app.focusStand]) {
      const s = standIndex[app.focusStand]
      touched.current = true
      setCam({ cx: s.x, cy: s.y, z: 3 })
    }
  }, [app.focusStand, app.focusTick])

  const vw = WORLD.w / view.z
  const vh = vw / aspect
  const viewBox = [view.cx - vw / 2, view.cy - vh / 2, vw, vh].map((n) => n.toFixed(1)).join(' ')

  function onWheel(e) {
    touched.current = true
    const z = Math.max(minZoom, Math.min(MAX_ZOOM, cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
    setCam((c) => ({ ...c, z }))
  }
  function onDown(e) {
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false }
  }
  function onMove(e) {
    const d = drag.current
    if (!d) return
    const k = vw / wrap.current.offsetWidth
    const dx = (e.clientX - d.x) * k
    const dy = (e.clientY - d.y) * k * (app.tilt ? 1.3 : 1)
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    if (d.moved) {
      touched.current = true
      if (app.follow) app.setFollow(null)
      setCam((c) => ({ ...c, cx: d.cx - dx, cy: d.cy - dy }))
    }
  }
  function onUp() {
    setTimeout(() => (drag.current = null), 0)
  }
  function onBackground() {
    if (drag.current && drag.current.moved) return
    app.select(null)
  }
  function onStandDouble(id) {
    const s = standIndex[id]
    touched.current = true
    setCam({ cx: s.x, cy: s.y, z: 3 })
  }

  const storm = app.storm && minute >= app.storm.from - 20 && minute <= app.storm.to + 20 ? app.storm : null
  const strobeOn = Math.floor(now / 600) % 2 === 0
  const holdingCount = items.filter((it) => it.state.unplaced).length
  const lightsOpacity = storm ? Math.max(0.55, light.night) : light.night
  const darkness = storm ? Math.max(light.darkness, 0.42) : light.darkness
  const sceneStyle = useMemo(() => ({
    '--sdx': light.shadow.dx + 'px', '--sdy': light.shadow.dy + 'px', '--so': light.shadow.opacity
  }), [light.shadow.dx, light.shadow.dy, light.shadow.opacity])

  return (
    <div className={'scene' + (storm ? ' storm' : '') + (app.tilt ? ' tilted' : '')} style={sceneStyle}>
      <Sky light={light} storm={!!storm} />
      <div className="clouds back" style={{ opacity: storm ? 0.9 : 0.55 - light.night * 0.3 }} />
      <div className="world" ref={wrap} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerLeave={onUp}>
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" onClick={onBackground}>
          <GroundDefs />
          <defs>
            <radialGradient id="mastGlow">
              <stop offset="0" stopColor="#ffe9b0" stopOpacity="0.32" />
              <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <Ground />
          {storm && <rect x={1300} y={22} width={1076} height={866} fill="#9fb6cc" opacity="0.12" className="puddles" />}
          <g>
            {Object.values(standIndex).map((s) => (
              <circle key={s.id} cx={s.x} cy={s.y} r="18" fill="transparent" onDoubleClick={() => onStandDouble(s.id)} />
            ))}
          </g>
          <ClosureLayer closures={closures} minute={minute} />
          <ellipse cx={HOLDING_PATTERN.cx} cy={HOLDING_PATTERN.cy} rx={HOLDING_PATTERN.rx} ry={HOLDING_PATTERN.ry}
            fill="none" stroke="#ff4d4d" strokeOpacity={holdingCount ? 0.45 : 0} strokeDasharray="6 10" strokeWidth="1.6" />
          <rect x={WORLD.x} y={WORLD.y} width={WORLD.w} height={WORLD.h} fill="#0b1220" opacity={darkness}
            pointerEvents="none" />
          <g opacity={lightsOpacity} pointerEvents="none"><NightLights /></g>
          <EffectsLayer effects={app.effects} now={now} />
          <Planes items={items} selectedId={app.selected} hoverId={hoverId} onSelect={app.select} onHover={setHoverId}
            night={light.night} shadow={light.shadow} showLabels={app.labels} strobeOn={strobeOn} />
        </svg>
      </div>
      <div className="clouds front" style={{ opacity: storm ? 0.75 : 0.35 - light.night * 0.25 }} />
      <Weather active={!!storm} severity={storm ? storm.severity : 50} reducedMotion={app.reducedMotion} />
      <div className="scene-hud">
        <div className="hud-pill mono">{hhmm(minute)} IST</div>
        {holdingCount > 0 && <div className="hud-pill danger">{holdingCount} holding without a stand</div>}
        {app.follow && <button className="hud-pill btnlike" onClick={() => app.setFollow(null)}>Following {app.followLabel} · stop</button>}
      </div>
      <div className="scene-tools">
        <button className="tool" title="Zoom in" onClick={() => { touched.current = true; setCam((c) => ({ ...c, z: Math.min(MAX_ZOOM, c.z * 1.25) })) }}>+</button>
        <button className="tool" title="Zoom out" onClick={() => { touched.current = true; setCam((c) => ({ ...c, z: Math.max(minZoom, c.z / 1.25) })) }}>-</button>
        <button className="tool" title="Reset view" onClick={() => { app.setFollow(null); touched.current = false; setCam({ ...HOME, z: fitZoom(aspect) }) }}>⌂</button>
        <button className={'tool' + (app.tilt ? ' on' : '')} title="3D tilt" onClick={() => app.setTilt(!app.tilt)}>3D</button>
        <button className={'tool' + (app.labels ? ' on' : '')} title="Flight labels" onClick={() => app.setLabels(!app.labels)}>Aa</button>
      </div>
      <div className="legend">
        <span><i className="lg narrow" /> narrow-body</span>
        <span><i className="lg wide" /> wide-body</span>
        <span><i className="lg closed" /> closed stand</span>
        <span><i className="lg hold" /> no stand</span>
      </div>
      {app.caption && <div className="caption">{app.caption}</div>}
    </div>
  )
}
