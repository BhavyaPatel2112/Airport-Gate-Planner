import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock, useClockMinute, useClockState, hhmm, DAY_END } from '../state/clock'
import { Icon } from './icons'

const SPEEDS = [1, 60, 300, 600, 1440]

export default function TimeControls() {
  const app = useApp()
  const minute = useClockMinute()
  const { playing, speed } = useClockState()
  const [occ, setOcc] = useState(null)
  const [busiest, setBusiest] = useState(null)
  const bar = useRef(null)
  const planId = app.plan && app.plan.planId
  const version = app.plan && app.plan.version

  useEffect(() => {
    if (!planId) return
    let live = true
    Promise.all([api.occupancy(planId), api.busiest(planId, 60)]).then(([o, b]) => {
      if (live) {
        setOcc(o.minutes)
        setBusiest(b)
      }
    }).catch(() => {})
    return () => { live = false }
  }, [planId, version])

  function seek(e) {
    const r = bar.current.getBoundingClientRect()
    const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    clock.set({ minute: k * DAY_END })
  }

  let path = ''
  let peak = 1
  if (occ) {
    for (const v of occ) peak = Math.max(peak, v)
    const pts = []
    for (let m = 0; m < 1440; m += 4) pts.push((m / 1440) * 1000 + ',' + (40 - (occ[m] / peak) * 36).toFixed(1))
    path = 'M0,40 L' + pts.join(' L') + ' L1000,40 Z'
  }

  return (
    <div className="timebar panel">
      <button className="play" onClick={() => clock.set({ playing: !playing })} title={playing ? 'Pause' : 'Play'}>
        {playing ? <Icon.pause /> : <Icon.play />}
      </button>
      <div className="speeds">
        {SPEEDS.map((s) => (
          <button key={s} className={speed === s ? 'on' : ''} onClick={() => clock.set({ speed: s })}>{s}x</button>
        ))}
      </div>
      <div className="timeline" ref={bar} onPointerDown={(e) => { seek(e); e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={(e) => { if (e.buttons) seek(e) }}>
        <svg viewBox="0 0 1000 40" preserveAspectRatio="none">
          {busiest && (
            <rect x={(busiest.start / 1440) * 1000} width={((busiest.end - busiest.start) / 1440) * 1000} y="0" height="40"
              fill="rgba(255,176,32,0.16)" />
          )}
          {path && <path d={path} fill="url(#occGrad)" stroke="#38d7ff" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          <defs>
            <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38d7ff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#38d7ff" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <line key={h} x1={(h / 24) * 1000} x2={(h / 24) * 1000} y1="34" y2="40" stroke="rgba(255,255,255,0.3)"
              vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="hours">{[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h}>{String(h).padStart(2, '0')}</span>)}</div>
        <div className="cursor" style={{ left: (minute / 1440) * 100 + '%' }}><span>{hhmm(minute)}</span></div>
      </div>
      <div className="time-meta">
        {occ && <div><b>{occ[Math.min(1439, minute)]}</b> stands busy now</div>}
        {busiest && <div className="busiest">Busiest hour {busiest.from} to {busiest.to}, peak {busiest.peakBusy}</div>}
      </div>
    </div>
  )
}
