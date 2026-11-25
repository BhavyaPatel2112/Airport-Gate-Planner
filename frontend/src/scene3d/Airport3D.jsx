import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { useClockMinute, useClockValue, hhmm } from '../state/clock'
import { planeState } from '../scene/geometry'
import Weather from '../scene/Weather'
import InsightsPanel from './InsightsPanel'
import { World3D } from './world'
import './scene3d.css'

const DAYS = { 1: 'Mon 16 Nov', 2: 'Tue 17 Nov' }

function Icon({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  )
}

const I = {
  overview: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
  t2: 'M12 3v18M4 7l8 5 8-5M4 17l8-5 8 5',
  t1: 'M3 15h18v4H3zM6 15V9h12v6',
  runway: 'M9 3l-4 18M15 3l4 18M12 5v2M12 10v2M12 15v2',
  follow: 'M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z',
  heat: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 1 3 3 4 0-3-1-5 0-8z',
  labels: 'M4 6h16M4 12h10M4 18h7',
  closed: 'M5 5l14 14M19 5L5 19',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  clay: 'M12 3a9 9 0 1 0 9 9c0-1-1-1-2-1h-3a2 2 0 0 1 0-4h1a4 4 0 0 0-5-4z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  panel: 'M3 4h18v16H3zM15 4v16',
  pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
}

function LocationPill({ day }) {
  const m = useClockMinute()
  return (
    <div className="loc-pill">
      <span className="loc-badge">BOM</span>
      <div>
        <div className="loc-name">Mumbai, Maharashtra · CSMIA</div>
        <div className="loc-sub"><span className="live-dot" /> {DAYS[day]} · {hhmm(m)} IST</div>
      </div>
    </div>
  )
}

function HoldingPill() {
  const app = useApp()
  const m = useClockValue()
  let n = 0
  if (app.plan) {
    for (const v of app.plan.visits) {
      const st = !v.stand && planeState(v, m)
      if (st && st.unplaced) n++
    }
  }
  if (!n) return null
  return <div className="g-pill danger">{n} holding without a stand</div>
}

export default function Airport3D() {
  const app = useApp()
  const host = useRef(null)
  const world = useRef(null)
  const [cam, setCam] = useState({ azimuth: 0, distance: 2000 })
  const [legend, setLegend] = useState(false)
  const [panel, setPanel] = useState(true)
  const [layers, setLayers] = useState({ heat: false, labels: true, closures: true })
  const [clay, setClay] = useState(false)
  const [preset, setPreset] = useState('overview')

  useEffect(() => {
    const w = new World3D(host.current, {
      onSelect: (id) => app.select(id),
      onCamera: setCam
    })
    world.current = w
    app.registerCamera((spec) => {
      setPreset(typeof spec === 'string' ? spec : '')
      w.flyTo(spec)
    })
    if (app.introPending) {
      w.playIntro()
      app.consumeIntro()
    } else {
      w.theme = 1
      w.flyTo('overview', 10)
    }
    return () => {
      app.registerCamera(null)
      w.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!world.current) return
    world.current.setData({
      visits: app.plan ? app.plan.visits : [],
      closures: app.plan ? app.plan.closures : [],
      selected: app.selected,
      follow: app.follow,
      effects: app.effects,
      storm: app.storm,
      layers
    })
  }, [app.plan, app.selected, app.follow, app.effects, app.storm, layers])

  useEffect(() => {
    if (world.current && app.focusStand) world.current.flyTo(app.focusStand)
  }, [app.focusStand, app.focusTick])

  useEffect(() => {
    if (world.current) world.current.setClay(clay)
  }, [clay])

  const minute = useClockMinute()
  const storm = app.storm && minute >= app.storm.from - 20 && minute <= app.storm.to + 20 ? app.storm : null
  const fly = (p) => {
    setPreset(p)
    app.setFollow(null)
    world.current && world.current.flyTo(p)
  }
  const toggle = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }))
  const followable = app.selected && app.visitsById[app.selected]
  const deg = Math.round(((cam.azimuth * 180) / Math.PI + 360) % 360)

  return (
    <div className={'scene3d' + (clay ? ' clay' : '') + (storm ? ' storm' : '') + (panel ? ' panel-open' : '')}>
      <div className="gl-host" ref={host} />
      <Weather active={!!storm} severity={storm ? storm.severity : 50} reducedMotion={app.reducedMotion} />

      <div className="g-top">
        <div className="g-legend">
          <button className="g-pill btn-pill" onClick={() => setLegend(!legend)}>Legend <span className="caret">{legend ? '▴' : '▾'}</span></button>
          <AnimatePresence>
            {legend && (
              <motion.div className="g-card legend-card" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="lg-row"><i className="sw plane" />Narrow-body aircraft</div>
                <div className="lg-row"><i className="sw plane wide" />Wide-body aircraft</div>
                <div className="lg-row"><i className="sw tail" />Tail colour: airline</div>
                <div className="lg-row"><i className="sw closed" />Stand closed by a notice</div>
                <div className="lg-row"><i className="sw hold" />Holding, no stand (min-cut reason)</div>
                <div className="lg-row"><i className="sw arc" />Reassignment path</div>
                <div className="lg-row"><i className="sw heat" />Stand use, next 90 min (heat layer)</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <LocationPill day={app.day} />
        <div className="g-right-pills">
          <HoldingPill />
          {app.follow && <button className="g-pill btn-pill accent" onClick={() => app.setFollow(null)}>Following {app.followLabel} · stop</button>}
          <button className={'g-pill btn-pill' + (panel ? ' on' : '')} onClick={() => setPanel(!panel)} title="Overall analytics">
            <Icon d={I.panel} /> Analytics
          </button>
        </div>
      </div>

      <AnimatePresence>{panel && <InsightsPanel onClose={() => setPanel(false)} />}</AnimatePresence>

      <div className="g-toolbar">
        <div className="tb-group">
          {[['overview', 'Overview'], ['t2', 'Terminal 2'], ['t1', 'Terminal 1'], ['runway', 'Runway 27'], ['west', 'Remote west']].map(([k, label]) => (
            <button key={k} className={'tb-btn' + (preset === k ? ' on' : '')} onClick={() => fly(k)} title={label}>
              <Icon d={I[k] || I.overview} /><span>{label}</span>
            </button>
          ))}
          <button className={'tb-btn' + (app.follow ? ' on' : '')} disabled={!followable}
            onClick={() => app.setFollow(app.follow ? null : app.selected)} title="Follow the selected aircraft">
            <Icon d={I.follow} /><span>Follow</span>
          </button>
        </div>
        <div className="tb-sep" />
        <div className="tb-group">
          <button className={'tb-btn icon' + (layers.heat ? ' on' : '')} onClick={() => toggle('heat')} title="Stand use heat map"><Icon d={I.heat} /></button>
          <button className={'tb-btn icon' + (layers.labels ? ' on' : '')} onClick={() => toggle('labels')} title="Flight labels"><Icon d={I.labels} /></button>
          <button className={'tb-btn icon' + (layers.closures ? ' on' : '')} onClick={() => toggle('closures')} title="Closed stands"><Icon d={I.closed} /></button>
          <button className={'tb-btn icon' + (clay ? ' on' : '')} onClick={() => setClay(!clay)} title="Clay model view"><Icon d={I.clay} /></button>
        </div>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={() => app.setView('2d')} title="Switch to the 2D map"><Icon d={I.map} /><span>2D map</span></button>
      </div>

      <div className="g-compass">
        <button className="zoom" onClick={() => world.current && world.current.zoom(0.8)}><Icon d={I.plus} /></button>
        <button className="zoom" onClick={() => world.current && world.current.zoom(1.25)}><Icon d={I.minus} /></button>
        <div className="coords mono">
          <div>19.0896° N · 72.8656° E</div>
          <div>{deg}° · cam {Math.round(cam.distance * 0.9).toLocaleString()} m</div>
        </div>
        <div className="rose" style={{ transform: 'rotate(' + -deg + 'deg)' }}>
          <svg viewBox="-20 -20 40 40" width="34" height="34">
            <circle r="18" fill="rgba(10,11,12,0.6)" stroke="rgba(255,255,255,0.25)" />
            <path d="M0 -14 L4 0 L0 -2 L-4 0 Z" fill="#ff5a4d" />
            <path d="M0 14 L4 0 L0 2 L-4 0 Z" fill="#d9d4cf" />
            <text y="-6" x="0" textAnchor="middle" fontSize="0" fill="#fff">N</text>
          </svg>
        </div>
      </div>
      {app.caption && <div className="caption">{app.caption}</div>}
    </div>
  )
}
