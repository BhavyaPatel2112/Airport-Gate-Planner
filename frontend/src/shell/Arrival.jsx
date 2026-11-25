import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { api } from '../api/client'
import { clock, hhmm, useClockMinute } from '../state/clock'
import Ico from './icons'

/**
 * The end of the story flight. AI 116 from New York reaches Mumbai in a monsoon storm and lands twice:
 * first with the stand plan fixed the night before (it circles until its own stand clears), then, from the
 * same moment, with the Java planner (it lands on time). Both outcomes are computed in Java by
 * /api/story/arrival; this component only plays them back and draws the numbers.
 */
export default function Arrival() {
  const app = useApp()
  const [story, setStory] = useState(null)
  const [act, setAct] = useState('loading')
  const [dark, setDark] = useState(false)
  const views = useRef({})
  const timers = useRef([])
  const started = useRef(false)

  const clearAll = () => {
    for (const t of timers.current) { clearTimeout(t); clearInterval(t) }
    if (timers.current.raf) cancelAnimationFrame(timers.current.raf)
    timers.current = []
  }
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => clearAll(), [])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const s = await api.storyArrival(app.day)
        const [t, o] = await Promise.all([api.getPlan(s.today.planId), api.getPlan(s.ours.planId)])
        if (!live) return
        views.current = { today: t, ours: o }
        setStory(s)
      } catch (e) {
        app.toast('Could not load the arrival: ' + e.message, 'error')
        app.finishArrival()
      }
    })()
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // start once the data is here and the airport has been drawn
  useEffect(() => {
    if (!story || started.current) return undefined
    const t = setInterval(() => {
      if (app.getWorld() && !started.current) {
        started.current = true
        clearInterval(t)
        play('today')
      }
    }, 200)
    return () => clearInterval(t)
  }, [story]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Runs the clock through [minute, wall ms] key points, on wall time so it keeps pace however fast the 3D view
   * draws: fast while the aircraft only circles, slower for the approach and landing so they can be watched.
   */
  const runClock = (keys, done) => {
    const t0 = performance.now()
    clock.set({ minute: keys[0][0], playing: false })
    const total = keys[keys.length - 1][1]
    const step = () => {
      const t = performance.now() - t0
      let i = 1
      while (i < keys.length - 1 && t > keys[i][1]) i++
      const [m0, ta] = keys[i - 1]
      const [m1, tb] = keys[i]
      const k = Math.min(1, Math.max(0, (t - ta) / Math.max(1, tb - ta)))
      clock.set({ minute: m0 + (m1 - m0) * k })
      if (t >= total) {
        if (done) done()
        return
      }
      timers.current.raf = requestAnimationFrame(step)
    }
    timers.current.raf = requestAnimationFrame(step)
  }

  // the second landing starts again from the zoom-in: a short fade hides the jump back up
  const play = (kind) => {
    clearAll()
    if (started.current === 'played') {
      setDark(true)
      setAct('fade')
      later(() => { run(kind); setDark(false) }, 450)
    } else {
      started.current = 'played'
      run(kind)
    }
  }

  const run = (kind) => {
    const w = app.getWorld()
    const s = story
    const side = s[kind]
    const view = views.current[kind]
    const fid = s.flight.visit
    const due = s.flight.due
    const fv = view.visits.find((x) => x.id === fid)
    // the sequence is fast-forwarded: drop the costly ambient occlusion while it plays (restored afterwards)
    if (w.quality === 'high') w.setQuality('medium')
    // switching between the two plans is not a repair to animate: no automatic tows
    w.skipNextDiff = true
    app.showPlanView(view)
    app.setStorm({ severity: s.disruption.severity, from: s.disruption.stormFrom, to: Math.max(s.disruption.stormTo, side.landAt + 40) })
    // the waterlogged stands, ringed; with the planner also the nearest free stand each displaced arrival gets instead
    const t0 = Date.now()
    const fx = s.disruption.closedStands.map((id) => ({ kind: 'mark', to: id, tone: 'busy', t0 }))
    app.setEffects(fx)
    // with the fixed plan AI 116 circles until its own stand clears: drawn as it was, without a stand, until then
    const pend = new Map()
    if (side.hold > 0 && fv) pend.set(fid, { prev: { ...fv, stand: null, start: due, end: due + (fv.end - fv.start) }, until: side.landAt - 13 })
    w.setPending(pend)
    app.select(null)
    app.setFollow(null)
    // only the story flight keeps its label: hundreds of labels redrawn every frame make the replay stutter
    app.setLayers((l) => (l.labels ? { ...l, labels: false } : l))
    const start = side.hold > 0 ? due - 6 : due - 14
    clock.set({ minute: start, playing: false })
    // zoom in from high above the airport, as at the end of the flight
    w.flyTo('intro', 10)
    w.playIntro(3600)
    setAct(kind + '-intro')
    later(() => {
      if (side.hold > 0) w.frameStands([], 1600, true)
      else w.frameStands([side.stand, ...s.disruption.closedStands], 1600)
      app.select(fid)
      // with the planner: an arc from each displaced arrival's planned stand to the nearest free one it gets instead
      if (kind === 'ours') {
        const at = Date.now()
        app.setEffects([...fx, ...side.moves.filter((m) => m.metres < 700).slice(0, 10)
          .map((m) => ({ kind: 'move', from: m.from, to: m.to, t0: at }))])
      }
    }, 4200)
    later(() => {
      app.setFollow(fid)
      setAct(kind + '-run')
      const approach = side.landAt - 14
      const keys = side.hold > 0
        ? [[start, 0], [approach, Math.min(9000, Math.max(3000, (approach - start) * 110))], [side.landAt + 8, 0]]
        : [[start, 0], [side.landAt + 8, 0]]
      keys[keys.length - 1][1] = keys[keys.length - 2][1] + 7500
      runClock(keys, () => later(() => setAct(kind + '-done'), 1000))
    }, 6200)
  }

  const finish = () => {
    clearAll()
    app.finishArrival()
  }

  if (!story) {
    return (
      <div className="arr-skip"><button className="btn ghost sm" onClick={finish}>Skip to the control room<Ico n="skip" size={13} /></button></div>
    )
  }
  const s = story
  const kind = act.startsWith('ours') ? 'ours' : 'today'
  return (
    <>
      <div className={'arr-dark' + (dark ? ' on' : '')} />
      <div className="arr-skip"><button className="btn ghost sm" onClick={finish}>Skip to the control room<Ico n="skip" size={13} /></button></div>
      <AnimatePresence mode="wait">
        {act === 'today-intro' && (
          <Banner key="ti" tag="Landing 1 of 2 · the fixed stand plan" title={s.disruption.title} lines={s.disruption.lines}
            foot={'You are on ' + s.flight.number + ' from ' + s.flight.from + ', due at ' + hhmm(s.flight.due) + '.'} />
        )}
        {act === 'ours-intro' && (
          <Banner key="oi" tag="Landing 2 of 2 · our Java planner" title="Same storm, same closures"
            lines={['The planner re-plans every flight from ' + hhmm(s.disruption.stormFrom) + ' together, in ' + s.ours.ms + ' ms',
              'Maximum matching finds a stand for every flight; min-cost flow picks the nearest free one',
              s.ours.reassigned + ' arrivals get another stand before they land, ' + s.ours.towed + ' aircraft need a tow']}
            foot={s.flight.number + ' is cleared to land on stand ' + s.ours.stand + '.'} />
        )}
        {(act === 'today-run' || act === 'ours-run') && <Ticker key={'tk' + kind} story={s} kind={kind} />}
        {act === 'today-done' && (
          <Card key="td" tag="Landing 1 of 2 · the fixed stand plan"
            title={'Landed after ' + s.today.hold + ' minutes in the air'}
            text={'With every stand fixed the night before, ' + s.flight.number + ' had to wait for stand ' + s.today.stand
              + ' to clear. The storm knocked on down the line: ' + s.today.heldFlights + ' flights delayed, '
              + s.today.heldMinutes.toLocaleString('en-IN') + ' minutes in total.'}
            action="Fly it again with our planner" onAction={() => play('ours')} />
        )}
        {act === 'ours-done' && <Compare key="cmp" story={s} onReplay={() => play('today')} onDone={finish} />}
      </AnimatePresence>
    </>
  )
}

function Banner({ tag, title, lines, foot }) {
  return (
    <motion.div className="arr-banner" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }}>
      <span className="arr-tag"><Ico n="storm" size={13} />{tag}</span>
      <h2>{title}</h2>
      <ul>{lines.map((l, i) => <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.45 }}>{l}</motion.li>)}</ul>
      <p>{foot}</p>
    </motion.div>
  )
}

function Ticker({ story, kind }) {
  const m = useClockMinute()
  const due = story.flight.due
  const side = story[kind]
  const holding = Math.max(0, Math.min(m, side.landAt) - due)
  const landed = m >= side.landAt
  return (
    <motion.div className="arr-ticker glass" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <span className="arr-flight"><Ico n="plane" size={13} fill />{story.flight.number}</span>
      {kind === 'today'
        ? <span>{landed ? 'Landed on stand ' + side.stand : m < due ? 'Due at ' + hhmm(due) : 'Holding over Mumbai'}</span>
        : <span>{landed ? 'Landed on stand ' + side.stand + ', on time' : 'Cleared to land on stand ' + side.stand}</span>}
      <b className={'num' + (holding > 0 ? ' bad' : ' ok')}>{holding} min</b>
      <em>{hhmm(m)}</em>
    </motion.div>
  )
}

function Card({ tag, title, text, action, onAction }) {
  return (
    <motion.div className="arr-card glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
      <span className="arr-tag">{tag}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="btn primary" onClick={onAction}>{action}<Ico n="arrowRight" size={14} /></button>
    </motion.div>
  )
}

function Compare({ story, onReplay, onDone }) {
  const t = story.today
  const o = story.ours
  const rows = [
    [story.flight.number + ' circling', t.hold + ' min', o.hold + ' min'],
    ['Flights delayed by the storm', t.heldFlights, o.heldFlights],
    ['Minutes lost in total', t.heldMinutes.toLocaleString('en-IN'), o.heldMinutes.toLocaleString('en-IN')],
    ['Arrivals sent to another stand', t.reassigned, o.reassigned + ' (nearest free, ' + o.shiftKm + ' km in all)'],
    ['Parked aircraft towed', t.towed, o.towed]
  ]
  return (
    <motion.div className="arr-card wide glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
      <span className="arr-tag">Two landings, one storm</span>
      <h3>{story.flight.number} lands on time with the planner</h3>
      <table className="arr-table">
        <thead><tr><th /><th>Fixed stand plan</th><th>Our Java planner</th></tr></thead>
        <tbody>{rows.map(([k, a, b]) => <tr key={k}><td>{k}</td><td>{a}</td><td className="ok">{b}</td></tr>)}</tbody>
      </table>
      <p>The planner does not wait for a blocked stand to clear. It re-plans every flight still to come, finds a stand for
        each one with maximum matching, and among all the ways to do that, min-cost flow picks the one that moves the
        fewest aircraft over the shortest distance. Same data, same storm: only the algorithm changed.</p>
      <div className="arr-nav">
        <button className="btn ghost sm" onClick={onReplay}><Ico n="play" size={12} fill />Watch both again</button>
        <span />
        <button className="btn primary" onClick={onDone}>Enter the control room<Ico n="arrowRight" size={14} /></button>
      </div>
    </motion.div>
  )
}
