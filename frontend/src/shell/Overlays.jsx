import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import RaceView from '../hud/RaceView'
import DataDrawer from '../hud/DataDrawer'
import { BenchmarkLab, DelayLeaderboard, ChaosDesk } from '../panels'
import { useCam } from './camStore'
import Ico from './icons'
import { useClockMinute, hhmm } from '../state/clock'
import { STAND_GROUPS } from './scenario'
import layout from '../scene/layout/stands-layout.json'

const SHEETS = {
  lab: ['Benchmark lab', 'Our algorithms against their baselines on growing inputs, measured live in Java.'],
  race: ['Greedy first-fit against maximum matching', 'The same closure, repaired twice on copies of the plan.'],
  stats: ['Airline delay percentiles', 'Real departure delays per airline, selected with randomized Quickselect.'],
  data: ['Data and assumptions', 'Where the flights, stands and delays come from.']
}

export function Sheet() {
  const app = useApp()
  const s = app.sheet
  return (
    <AnimatePresence>
      {s && (
        <motion.div className="sheet-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => app.setSheet(null)}>
          <motion.div className="sheet glass" initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-h">
              <div><h2>{SHEETS[s][0]}</h2><p>{SHEETS[s][1]}</p></div>
              <button className="icon-btn" onClick={() => app.setSheet(null)} aria-label="Close"><Ico n="close" /></button>
            </div>
            <div className="sheet-body legacy">
              {s === 'lab' && <BenchmarkLab />}
              {s === 'race' && <RaceView />}
              {s === 'stats' && <DelayLeaderboard />}
              {s === 'data' && <DataDrawer />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const app = useApp()
  return (
    <div className="toasts">
      <AnimatePresence>
        {app.toasts.map((t) => (
          <motion.div key={t.id} className={'toast glass ' + t.kind} initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
            <Ico n={t.kind === 'error' ? 'alert' : t.kind === 'warn' ? 'info' : 'check'} size={14} />
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Compass() {
  const app = useApp()
  const cam = useCam()
  const deg = Math.round(((cam.azimuth * 180) / Math.PI + 360) % 360)
  return (
    <div className={'compass' + (app.rightOpen ? ' with-panel' : '')}>
      <button className="icon-btn glass" onClick={() => app.zoom(0.75)} aria-label="Zoom in"><Ico n="plus" /></button>
      <button className="icon-btn glass" onClick={() => app.zoom(1.33)} aria-label="Zoom out"><Ico n="minus" /></button>
      <button className="rose glass" onClick={() => app.flyTo('overview')} title="Reset the view">
        <svg viewBox="-20 -20 40 40" width="30" height="30" style={{ transform: 'rotate(' + -deg + 'deg)' }}>
          <path d="M0 -13 L4 0 L0 -2 L-4 0 Z" fill="#ff5a4e" />
          <path d="M0 13 L4 0 L0 2 L-4 0 Z" fill="#c9d1db" />
        </svg>
      </button>
    </div>
  )
}

export function Caption() {
  const app = useApp()
  return (
    <AnimatePresence>
      {app.caption && (
        <motion.div className={'caption glass' + (app.rightOpen ? ' with-panel' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
          {app.caption}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const FLIGHT_INPUT = '.ld-body .desk-body > .desk-sec:nth-child(3) input.seg.wide'
const STANDS_INPUT = '.ld-body .desk-body > .desk-sec:nth-child(4) input.seg.wide'

/** Types into one of the desk's inputs the way a person would, so the desk's own state updates. */
function fill(selector, value) {
  const el = document.querySelector(selector)
  if (!el) return
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}

/** Autofill for the desk: choose a flight or a group of stands instead of typing them. */
function DeskAutofill() {
  const app = useApp()
  const minute = useClockMinute(5)
  const visits = app.plan ? app.plan.visits : []
  const onStand = visits.filter((v) => v.stand && !v.cancelled && v.start <= minute && minute < v.end)
    .sort((a, b) => a.label.localeCompare(b.label))
  const number = (v) => (v.departure || v.arrival).number
  // typing suggestions straight in the desk's own boxes
  useEffect(() => {
    const t = setTimeout(() => {
      const f = document.querySelector(FLIGHT_INPUT)
      const st = document.querySelector(STANDS_INPUT)
      if (f) f.setAttribute('list', 'desk-flights')
      if (st) st.setAttribute('list', 'desk-stands')
    }, 50)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="desk-fill">
      <span className="df-k"><Ico n="sparkle" size={12} />Autofill</span>
      <label className="df-field">
        <span>Flight</span>
        <select value="" onChange={(e) => e.target.value && fill(FLIGHT_INPUT, e.target.value)}>
          <option value="">On a stand at {hhmm(minute)}…</option>
          {onStand.map((v) => <option key={v.id} value={number(v)}>{number(v)} · {v.airline} · stand {v.stand}</option>)}
        </select>
      </label>
      <button className="btn sm" onClick={() => app.startPick((id) => {
        const v = app.visitsById[id] || visits.find((x) => x.id === id)
        if (v) fill(FLIGHT_INPUT, number(v))
      })}><Ico n="pin" size={12} />Pick on map</button>
      <label className="df-field">
        <span>Stands</span>
        <select value="" onChange={(e) => e.target.value && fill(STANDS_INPUT, e.target.value)}>
          <option value="">A pier or apron…</option>
          {STAND_GROUPS.map((g) => <option key={g.key} value={g.stands.join(',')}>{g.name} ({g.count})</option>)}
        </select>
      </label>
      <datalist id="desk-flights">
        {visits.filter((v) => !v.cancelled).map((v) => <option key={v.id} value={number(v)}>{v.airline}{v.stand ? ' · stand ' + v.stand : ''}</option>)}
      </datalist>
      <datalist id="desk-stands">
        {layout.stands.map((st) => <option key={st.id} value={st.id} />)}
      </datalist>
    </div>
  )
}

/** Tanushree's chaos desk inside the Scenario lab ("Right now"): acts on the plan on screen at the current clock time. */
export function DeskInline() {
  return (
    <div className="desk-inline">
      <DeskAutofill />
      <div className="legacy ld-body"><ChaosDesk /></div>
    </div>
  )
}
