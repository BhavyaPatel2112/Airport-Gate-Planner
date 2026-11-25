import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock, hhmm } from '../state/clock'
import { tailColour } from '../scene/lighting'

function Leg({ f, kind }) {
  if (!f) return null
  const late = f.actual - f.scheduled
  return (
    <div className="bp-leg">
      <div className="bp-kind">{kind === 'ARR' ? 'Arriving from' : 'Departing to'}</div>
      <div className="bp-city"><b>{f.iata}</b> {f.city}</div>
      <div className="bp-times mono">
        <span>STD/STA {hhmm(Math.max(0, f.scheduled))}</span>
        <span className={late > 15 ? 'late' : ''}>ACT {hhmm(Math.max(0, f.actual))}{late ? ' (' + (late > 0 ? '+' : '') + late + ')' : ''}</span>
      </div>
    </div>
  )
}

export default function BoardingPassCard() {
  const app = useApp()
  const v = app.visitsById[app.selected]
  const [why, setWhy] = useState(null)
  const [err, setErr] = useState(null)
  const planId = app.plan.planId
  const version = app.plan.version

  useEffect(() => {
    let live = true
    setErr(null)
    api.why(planId, v.id).then((w) => live && setWhy(w)).catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [planId, version, v.id])

  const flight = (v.departure || v.arrival).number
  const at = () => Math.floor(clock.get().minute)
  async function delay(min) {
    const f = (v.arrival && clock.get().minute < v.start) ? v.arrival.number : flight
    await app.run('delay', () => api.delay(planId, f, min, at())).catch(() => {})
  }
  async function cancel() {
    await app.run('cancel', () => api.cancel(planId, flight, at())).catch(() => {})
  }
  async function showTree() {
    if (!v.stand) return
    const snap = await api.snapshot('rbtree', planId, v.stand).catch(() => null)
    if (snap) {
      app.absorb({ ...app.plan, snapshots: { ...app.plan.snapshots, rbtree: snap }, events: [], trace: [] }, 'view')
      app.setMachineTab('rbtree')
    }
  }
  const color = tailColour(v.airlineCode)
  const status = v.status === 'PLACED' ? (v.originalStand && v.originalStand !== v.stand ? 'GATE CHANGED' : 'CONFIRMED')
    : v.status === 'UNPLACED' ? 'NO STAND' : 'CANCELLED'

  return (
    <motion.div className="bpass" initial={{ opacity: 0, y: -12, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', damping: 22, stiffness: 300 }}>
      <div className="bp-head" style={{ background: color }}>
        <div>
          <div className="bp-airline">{v.airline}</div>
          <div className="bp-sub">BOARDING PASS · STAND VISIT</div>
        </div>
        <button className="bp-close" onClick={() => app.select(null)} aria-label="Close">×</button>
      </div>
      <div className="bp-body">
        <div className="bp-main">
          <div className="bp-flight mono">{v.label}</div>
          <div className={'bp-status ' + v.status.toLowerCase()}>{status}</div>
        </div>
        <div className="bp-route">
          <Leg f={v.arrival} kind="ARR" />
          <div className="bp-plane">✈</div>
          <Leg f={v.departure} kind="DEP" />
        </div>
        <div className="bp-grid">
          <div><span>STAND</span><b className="mono">{v.stand || 'NONE'}</b></div>
          <div><span>ON BLOCK</span><b className="mono">{hhmm(v.start)}</b></div>
          <div><span>OFF BLOCK</span><b className="mono">{hhmm(v.end)}</b></div>
          <div><span>BUFFER</span><b className="mono">{v.buffer} min</b></div>
          <div><span>AIRCRAFT</span><b>{(v.arrival || v.departure).aircraft}</b></div>
          <div><span>REG</span><b className="mono">{v.registration || 'n/a'}</b></div>
        </div>
        <div className="bp-actions">
          <button className="btn small" onClick={() => delay(15)} disabled={app.busy || v.cancelled}>Delay 15</button>
          <button className="btn small" onClick={() => delay(45)} disabled={app.busy || v.cancelled}>Delay 45</button>
          <button className="btn small" onClick={() => delay(120)} disabled={app.busy || v.cancelled}>Delay 120</button>
          <button className="btn small danger" onClick={cancel} disabled={app.busy || v.cancelled}>Cancel</button>
          <button className="btn small" onClick={() => app.setFollow(app.follow === v.id ? null : v.id)}>
            {app.follow === v.id ? 'Unfollow' : 'Follow'}
          </button>
          <button className="btn small" onClick={showTree} disabled={!v.stand}>Stand tree</button>
        </div>
        <div className="bp-why">
          <div className="bp-why-title">Why this stand?</div>
          {err && <div className="bp-err">{err}</div>}
          {!why && !err && <div className="bp-loading">Asking the planner...</div>}
          {why && (
            <>
              <p>{why.reason}</p>
              {why.chosenBy && <div className="bp-row"><span>Chosen by</span>{why.chosenBy}</div>}
              {why.previousVisit && <div className="bp-row"><span>Before</span>{why.previousVisit}</div>}
              {why.nextVisit && <div className="bp-row"><span>After</span>{why.nextVisit}</div>}
              {why.alternatives && why.alternatives.length > 0 && (
                <div className="bp-row"><span>Also free</span>{why.alternatives.join(', ')}</div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="bp-stub">
        <div className="barcode" />
        <span className="mono">{v.id}</span>
      </div>
    </motion.div>
  )
}
