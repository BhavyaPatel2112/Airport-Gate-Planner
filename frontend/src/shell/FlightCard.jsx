import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock, hhmm } from '../state/clock'
import { tailColour } from '../scene/lighting'
import { standIndex } from '../scene/geometry'
import Ico from './icons'

/** Deterministic bars, so every flight has its own barcode. */
function Barcode({ seed }) {
  let h = 7
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const bars = []
  let x = 0
  for (let i = 0; i < 46 && x < 300; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    const w = 1 + (h % 3)
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y="0" width={w} height="34" />)
    x += w + 1 + ((h >> 4) % 3)
  }
  return <svg className="bp-code" viewBox={'0 0 ' + x + ' 34'} preserveAspectRatio="none">{bars}</svg>
}

function End({ f, here, label }) {
  return (
    <div className={'bp-end' + (label === 'To' ? ' r' : '')}>
      <span className="bp-k">{label}</span>
      <b className="bp-iata">{f ? f.iata : 'BOM'}</b>
      <span className="bp-city">{f ? f.city : here}</span>
    </div>
  )
}

/** The aircraft clicked in the 3D view, as a boarding pass: where it parks, when, and why the planner chose that stand. */
export default function FlightCard({ visit }) {
  const app = useApp()
  // keep showing the last known visit while the card animates out
  const v = (visit && app.visitsById[visit.id]) || visit
  const [why, setWhy] = useState(null)
  const planId = app.plan && app.plan.planId
  const version = app.plan && app.plan.version

  useEffect(() => {
    let live = true
    setWhy(null)
    if (!planId) return undefined
    api.why(planId, v.id).then((w) => live && setWhy(w)).catch(() => live && setWhy({ reason: 'No explanation available.' }))
    return () => { live = false }
  }, [planId, version, v.id])

  const flight = (v.departure || v.arrival).number
  const at = () => Math.floor(clock.get().minute)
  const delay = (min) => {
    const f = v.arrival && clock.get().minute < v.start ? v.arrival.number : flight
    app.run('delay', () => api.delay(planId, f, min, at())).catch(() => {})
  }
  const cancel = () => app.run('cancel', () => api.cancel(planId, flight, at())).catch(() => {})
  const moved = v.originalStand && v.originalStand !== v.stand
  // the latest move the Java planner logged for this flight, with its reason
  let moveWhy = null
  if (why && why.lastEvents && v.stand) {
    for (const e of why.lastEvents) {
      const m = /^(MOVE|ASSIGN) to [^:]+: (.*)$/.exec(e)
      if (m && m[2].length > 60) moveWhy = { kind: m[1], text: m[2] }
    }
  }
  const status = v.status === 'PLACED' ? (moved ? 'Moved' : 'On stand') : v.status === 'UNPLACED' ? 'No stand' : 'Cancelled'
  const st = v.stand && standIndex[v.stand]
  const kind = st ? (st.contact ? 'Jet bridge' : 'Remote, by bus') : 'Holding'
  const aircraft = (v.arrival || v.departure).aircraft
  const numbers = [v.arrival && v.arrival.number, v.departure && v.departure.number].filter(Boolean)
  const lateArr = v.arrival ? v.arrival.actual - v.arrival.scheduled : 0
  return (
    <motion.aside className="bpass" initial={{ opacity: 0, x: -18, rotate: -1.5 }} animate={{ opacity: 1, x: 0, rotate: 0 }}
      exit={{ opacity: 0, x: -18 }} transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      style={{ '--air': tailColour(v.airlineCode) }}>
      <div className="bp-top">
        <div className="bp-airline">
          <i className="bp-fin" />
          <div><b>{v.airline}</b><span>Boarding pass · Mumbai stand plan</span></div>
        </div>
        <button className="icon-btn sm bp-x" onClick={() => app.select(null)} aria-label="Close"><Ico n="close" size={14} /></button>
      </div>

      <div className="bp-route">
        <End f={v.arrival} here="Starts at Mumbai" label="From" />
        <div className="bp-mid">
          <span className="bp-line" />
          <span className="bp-via"><Ico n="plane" size={13} fill />via BOM</span>
          <span className="bp-line" />
        </div>
        <End f={v.departure} here="Ends at Mumbai" label="To" />
      </div>

      <div className="bp-grid">
        <div className="span2"><span>Flight</span><b className="num">{numbers.join('  ·  ')}</b></div>
        <div><span>Aircraft</span><b className="wrap">{aircraft}</b></div>
        <div className="bp-stand">
          <span>Stand</span>
          <b className="num">{v.stand || 'none'}</b>
          {moved && <em>{v.stand ? 'moved from ' + v.originalStand : 'was ' + v.originalStand}</em>}
        </div>
        <div><span>On stand</span><b className="num">{hhmm(v.start)}{lateArr > 10 && <em className="late"> +{lateArr}</em>}</b></div>
        <div><span>Leaves</span><b className="num">{hhmm(v.end)}</b></div>
        <div><span>Status</span><b className={'bp-status s-' + status.replace(' ', '').toLowerCase()}>{status}</b></div>
        <div><span>Terminal</span><b>{v.terminal}{v.intl ? ' · Intl' : ' · Dom'}</b></div>
        <div><span>Parking</span><b>{kind}</b></div>
        <div><span>Safety gap</span><b className="num">{v.buffer} min</b></div>
      </div>

      <div className="bp-tear"><i /><span /><i /></div>

      {moveWhy && (
        <div className="bp-why moved">
          <div className="bp-why-k"><Ico n="swap" size={12} />{moveWhy.kind === 'ASSIGN' ? 'Why it now has a stand' : 'Why it moved' + (moved ? ' from ' + v.originalStand + ' to ' + v.stand : '')}</div>
          <p>{moveWhy.text}</p>
        </div>
      )}
      <div className="bp-why">
        <div className="bp-why-k"><Ico n="sparkle" size={12} />Why {v.stand ? 'stand ' + v.stand : 'no stand'}</div>
        <p>{why ? why.reason : 'Asking the planner…'}</p>
        {why && why.chosenBy && <div className="bp-by">{why.chosenBy}</div>}
      </div>

      <div className="bp-actions">
        <span className="bp-actions-k">Try it on this flight</span>
        <div className="bp-btns">
          <button className="btn sm" disabled={app.busy || v.cancelled} onClick={() => delay(30)}>Delay 30 min</button>
          <button className="btn sm" disabled={app.busy || v.cancelled} onClick={() => delay(90)}>Delay 90 min</button>
          <button className="btn sm danger" disabled={app.busy || v.cancelled} onClick={cancel}>Cancel flight</button>
          <button className={'btn sm' + (app.follow === v.id ? ' on' : '')} onClick={() => app.setFollow(app.follow === v.id ? null : v.id)}>
            <Ico n="follow" size={13} />{app.follow === v.id ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>
      <div className="bp-foot">
        <Barcode seed={v.id} />
        <span className="num">{v.registration || v.id}</span>
      </div>
    </motion.aside>
  )
}
