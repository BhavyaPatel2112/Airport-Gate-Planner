import { useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock, hhmm } from '../state/clock'
import Dial from './Dial'

function pad4(m) {
  const x = Math.max(0, Math.min(1440, Math.round(m)))
  return String(Math.floor(x / 60)).padStart(2, '0') + String(x % 60).padStart(2, '0')
}

export default function ChaosDesk() {
  const app = useApp()
  const [severity, setSeverity] = useState(90)
  const [seed, setSeed] = useState(7)
  const [rush, setRush] = useState(30)
  const [flight, setFlight] = useState('')
  const [mins, setMins] = useState(45)
  const [stands, setStands] = useState('')
  const [hours, setHours] = useState(2)
  const id = app.plan && app.plan.planId
  const now = () => Math.floor(clock.get().minute)
  const off = !id || app.busy

  async function storm() {
    const from = now()
    app.setStorm({ severity, from, to: from + 180 })
    await app.run('storm', () => api.storm(id, severity, seed, from, from + 180)).catch(() => {})
  }
  async function closeStands() {
    const list = stands.toUpperCase().replace(/\s+/g, '').replace(/,+$/, '')
    if (!list) return
    const from = now()
    const text = 'VABB ' + (list.includes(',') ? 'STANDS ' : 'STAND ') + list + ' CLSD ' + pad4(from) + '-' + pad4(Math.min(1440, from + hours * 60))
    await app.run('notice', () => api.notice(id, text, 'apply')).catch(() => {})
  }

  return (
    <div className="panel desk">
      <div className="panel-head">
        <div className="panel-title"><span className="pict">!</span>Monsoon and chaos desk</div>
        <div className="spacer" />
        <span className="led-row"><i className={'led' + (app.storm ? ' red' : '')} />STORM <i className={'led' + (app.busy ? ' amber' : ' green')} />LINK</span>
      </div>
      <div className="desk-body">
        <div className="desk-sec weather">
          <Dial value={severity} min={50} max={99} onChange={setSeverity} label="Severity" unit="p" />
          <div className="desk-col">
            <label className="seed">SEED <input className="seg mono" value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
            <button className="big-btn red" onClick={storm} disabled={off}>MONSOON<br />STORM</button>
          </div>
        </div>
        <div className="desk-sec">
          <div className="desk-label">RUSH HOUR <span className="mono">+{rush}</span></div>
          <input type="range" min="5" max="80" value={rush} onChange={(e) => setRush(Number(e.target.value))} className="slider" />
          <button className="big-btn amber" disabled={off}
            onClick={() => app.run('rush', () => api.rush(id, rush, seed, now())).catch(() => {})}>INJECT ARRIVALS</button>
        </div>
        <div className="desk-sec">
          <div className="desk-label">FLIGHT</div>
          <div className="desk-row">
            <input className="seg mono wide" placeholder="AI 2927" value={flight} onChange={(e) => setFlight(e.target.value.toUpperCase())} />
            <input className="seg mono" value={mins} onChange={(e) => setMins(Number(e.target.value.replace(/[^\d-]/g, '')) || 0)} title="minutes" />
          </div>
          <div className="desk-row">
            <button className="big-btn" disabled={off || !flight}
              onClick={() => app.run('delay', () => api.delay(id, flight, mins, now())).catch(() => {})}>DELAY</button>
            <button className="big-btn dark" disabled={off || !flight}
              onClick={() => app.run('cancel', () => api.cancel(id, flight, now())).catch(() => {})}>CANCEL</button>
          </div>
        </div>
        <div className="desk-sec">
          <div className="desk-label">CLOSE STANDS <span className="mono">{hours}h from {hhmm(clock.get().minute)}</span></div>
          <input className="seg mono wide" placeholder="65A,65B,67A" value={stands} onChange={(e) => setStands(e.target.value)} />
          <div className="desk-row">
            <input type="range" min="1" max="6" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="slider" />
            <button className="big-btn" disabled={off || !stands} onClick={closeStands}>CLOSE</button>
          </div>
        </div>
        <div className="desk-sec plan">
          <div className="desk-label">BUFFER <span className="mono">p{app.buffer}</span></div>
          <input type="range" min="50" max="99" defaultValue={app.buffer} key={app.buffer}
            onMouseUp={(e) => app.setBuffer(Number(e.target.value))} onKeyUp={(e) => app.setBuffer(Number(e.target.value))}
            className="slider" />
          <div className="desk-row">
            <button className="big-btn green" disabled={off}
              onClick={() => app.run('real', () => api.realTimes(id)).catch(() => {})}>REAL DELAYS</button>
            <button className="big-btn dark" disabled={off} onClick={() => app.loadPlan().catch(() => {})}>RESET</button>
          </div>
          <button className="link-btn" onClick={() => app.setDrawer('stats')}>Airline delay leaderboard</button>
        </div>
      </div>
    </div>
  )
}
