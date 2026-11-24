import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { clock, useClockState, useClockValue, hhmm } from '../state/clock'
import { STEP_TYPES } from './scenario'
import Ico from './icons'

const SPEEDS = [[1, '1×'], [60, '1 min/s'], [300, '5 min/s'], [900, '15 min/s']]
const CAMS = [['tower', 'Tower view', 'tower'], ['overview', 'Whole airport', 'overview'], ['t2', 'Terminal 2', 't2'], ['t1', 'Terminal 1', 't1'],
  ['runway', 'Runway', 'runway'], ['west', 'Remote apron', 'remote']]

function Timeline() {
  const app = useApp()
  const minute = useClockValue()
  const ref = useRef(null)
  const data = app.occupancy
  const W = 1000
  const H = 34
  let path = ''
  if (data) {
    let peak = 1
    for (let i = 0; i < 1440; i++) peak = Math.max(peak, data[i])
    const pts = []
    for (let m = 0; m < 1440; m += 6) pts.push(((m / 1440) * W).toFixed(1) + ',' + (H - (data[m] / peak) * (H - 4)).toFixed(1))
    path = 'M0,' + H + ' L' + pts.join(' L') + ' L' + W + ',' + H + ' Z'
  }
  const seek = (e) => {
    const r = ref.current.getBoundingClientRect()
    const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    clock.set({ minute: k * 1440 })
  }
  const onDown = (e) => {
    seek(e)
    const move = (ev) => seek(ev)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const x = (Math.min(1440, minute) / 1440) * 100
  return (
    <div className="timeline" ref={ref} onPointerDown={onDown}>
      <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b7dff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#8b7dff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {path && <path d={path} fill="url(#tlFill)" />}
        {path && <path d={path.replace(/^M0,\d+ L/, 'M').replace(/ L1000,\d+ Z$/, '')} fill="none" stroke="#a99fff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
      </svg>
      {(app.scenarioMarks || []).map((mk, i) => (
        <span key={i} className={'tl-mark t-' + mk.type} style={{ left: (mk.at / 1440) * 100 + '%' }} title={STEP_TYPES[mk.type].title + ' at ' + hhmm(mk.at)} />
      ))}
      <div className="tl-hours">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} style={{ left: (h / 24) * 100 + '%' }}>{String(h).padStart(2, '0') + ':00'}</span>)}</div>
      <div className="tl-head" style={{ left: x + '%' }}><span className="num">{hhmm(minute)}</span></div>
    </div>
  )
}

export default function Dock() {
  const app = useApp()
  const { playing, speed } = useClockState()
  const [layersOpen, setLayersOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const current = CAMS.find(([k]) => k === app.camPreset)
  const toggle = (k) => app.setLayers({ ...app.layers, [k]: !app.layers[k] })
  const followable = app.selected && app.visitsById[app.selected]
  return (
    <div className={'dock glass' + (app.rightOpen ? ' with-panel' : '')}>
      <button className="play" onClick={() => clock.set({ playing: !playing })} aria-label={playing ? 'Pause' : 'Play'}>
        <Ico n={playing ? 'pause' : 'play'} size={18} fill />
      </button>
      <div className="speeds">
        {SPEEDS.map(([s, label]) => (
          <button key={s} className={speed === s ? 'on' : ''} onClick={() => clock.set({ speed: s, playing: true })}>{label}</button>
        ))}
      </div>
      <Timeline />
      <div className="dock-sep" />
      <div className="layers-wrap">
        <button className={'btn ghost dock-lbl' + (viewOpen ? ' on' : '')} onClick={() => { setViewOpen(!viewOpen); setLayersOpen(false) }}
          title="Choose where the camera looks">
          <Ico n={current ? current[2] : app.camPreset === 'roam' ? 'roam' : app.follow ? 'follow' : 'overview'} size={15} />
          <span>{current ? current[1] : app.camPreset === 'roam' ? 'Free roam' : app.follow ? 'Following' : 'View'}</span>
          <Ico n="chevronDown" size={13} />
        </button>
        <AnimatePresence>
          {viewOpen && (
            <motion.div className="popover glass view-pop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <div className="pop-title">Camera</div>
              {CAMS.map(([k, label, icon]) => (
                <button key={k} className={'pop-item' + (app.camPreset === k ? ' on' : '')} onClick={() => { app.flyTo(k); setViewOpen(false) }}>
                  <Ico n={icon} size={15} /><span>{label}</span>
                </button>
              ))}
              <div className="pop-sep" />
              <button className={'pop-item' + (app.camPreset === 'roam' ? ' on' : '')} onClick={() => { app.setRoam(app.camPreset !== 'roam'); setViewOpen(false) }}>
                <Ico n="roam" size={15} /><span>Free roam</span><em>W A S D</em>
              </button>
              <button className={'pop-item' + (app.follow ? ' on' : '')} disabled={!followable}
                onClick={() => { app.setFollow(app.follow ? null : app.selected); setViewOpen(false) }}>
                <Ico n="follow" size={15} /><span>{app.follow ? 'Stop following' : 'Follow the selected aircraft'}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="layers-wrap">
        <button className={'btn ghost dock-lbl' + (layersOpen ? ' on' : '')} onClick={() => { setLayersOpen(!layersOpen); setViewOpen(false) }}
          title="Map layers, legend and graphics">
          <Ico n="layers" size={15} /><span>Layers</span>
        </button>
        <AnimatePresence>
          {layersOpen && (
            <motion.div className="popover glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <div className="pop-title">Layers</div>
              {[['labels', 'labels', 'Flight labels'], ['closures', 'closed', 'Closed stands'], ['heat', 'heat', 'Stand use heat map'],
                ['vehicles', 'vehicle', 'Ground vehicles']].map(([k, icon, label]) => (
                <label key={k} className="switch-row">
                  <Ico n={icon} /><span>{label}</span>
                  <input type="checkbox" checked={!!app.layers[k]} onChange={() => toggle(k)} />
                  <i className="switch" />
                </label>
              ))}
              <div className="pop-title">Legend</div>
              <div className="legend">
                <div><i className="lg plane" />Aircraft, fin in airline colour</div>
                <div><i className="lg ghost" />Holding: no stand free (circling)</div>
                <div><i className="lg hatch" />Stand closed by a notice</div>
                <div><i className="lg arc" />Flight moved to a new stand</div>
                <div><i className="lg ring" />Selected aircraft</div>
              </div>
              <div className="pop-title">Graphics</div>
              <div className="sg small">
                {['high', 'medium', 'low'].map((q) => (
                  <button key={q} className={app.quality === q ? 'on' : ''} onClick={() => app.setQuality(q)}>{q}</button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
