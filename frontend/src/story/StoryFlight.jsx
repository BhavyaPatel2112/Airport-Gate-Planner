import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { UNITS } from '../shell/AlgorithmsTab'
import Ico from '../shell/icons'
import { Cabin } from './cabin'
import { Globe } from './globe'
import { START, STOPS, MUMBAI, DATA_FLIGHTS } from './chapters'
import Illus from './Illus'
import './story.css'

const UNIT_COLOURS = ['#6cc4ff', '#b48cff', '#3fd68f', '#ffb547', '#ff7a6b', '#f472b6']

function liveStat(app, match) {
  const all = [...(app.plan ? app.plan.trace || [] : []), ...app.traceLog]
  const t = all.find((x) => x.algorithm && x.algorithm.includes(match))
  if (!t) return null
  return t
}

/** A coloured light on the door of bin i; the cabin keeps it over the door as the camera moves. */
function BinDot({ i, cabin, open, onOpen }) {
  const ref = useRef(null)
  useEffect(() => cabin.current && cabin.current.track(ref.current, cabin.current.bins[i].dot), [i, cabin])
  return (
    <div ref={ref} className={'bin-dot-at' + (open ? ' open' : '')}>
      <button className="bin-dot" style={{ '--c': UNIT_COLOURS[i] }} onClick={() => onOpen(i)} aria-label={'Open the bin for unit ' + (i + 1)}>
        <i />
        <span className="bin-tip"><b>Unit {i + 1}</b>{UNITS[i].name}</span>
      </button>
    </div>
  )
}

/** The text box that comes out of open bin i and stays beside it on screen. */
function BinCard({ i, cabin, onClose }) {
  const ref = useRef(null)
  const side = cabin.current ? cabin.current.bins[i].side : -1
  useEffect(() => {
    const c = cabin.current
    if (!c) return
    return c.track(ref.current, c.bins[i].mouth, { clamp: true, side })
  }, [i, cabin, side])
  const s = STOPS[i]
  return (
    <div ref={ref} className="bin-anchor">
      <motion.div className="bin-card" style={{ '--c': UNIT_COLOURS[i], transformOrigin: side < 0 ? '0% 10%' : '100% 10%' }}
        initial={{ opacity: 0, scale: 0.25, x: side < 0 ? -40 : 40, y: -24 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.4, x: side < 0 ? -30 : 30, y: -20, transition: { duration: 0.22 } }}
        transition={{ type: 'spring', damping: 20, stiffness: 190, delay: 0.45 }}>
        <div className="bc-h">
          <span className="sc-unit">Unit {s.unit}</span>
          <button className="bc-x" onClick={onClose} aria-label="Close the bin"><Ico n="close" size={14} /></button>
        </div>
        <h3>{s.title}</h3>
        <p className="bc-q">{s.question}</p>
        <p className="bc-body">{s.body}</p>
        <div className="sc-algos">{s.algos.map((a) => <span key={a}>{a}</span>)}</div>
      </motion.div>
    </div>
  )
}

export default function StoryFlight({ onDone }) {
  const app = useApp()
  const cabinHost = useRef(null)
  const globeHost = useRef(null)
  const cabin = useRef(null)
  const globe = useRef(null)
  const routes = useRef([])
  const [stage, setStage] = useState('cabin')
  const [exploring, setExploring] = useState(false)
  const [bin, setBin] = useState(-1)
  const [idx, setIdx] = useState(-1)
  const [flying, setFlying] = useState(false)
  // how many of the unit points along the route the plane has passed (the flight does not stop at them)
  const [passed, setPassed] = useState(0)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    cabin.current = new Cabin(cabinHost.current, UNITS)
    return () => {
      if (cabin.current) cabin.current.dispose()
      if (globe.current) globe.current.dispose()
    }
  }, [])

  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((t) => { clearTimeout(t); clearInterval(t) }), [])

  // the intro card gives way to the cabin: six lights on the overhead bins, one per unit
  const explore = () => setExploring(true)
  const openBin = (i) => {
    const n = bin === i ? -1 : i
    setBin(n)
    if (!cabin.current) return
    cabin.current.openBin(n)
    cabin.current.focusBin(n)
  }
  const backToIntro = () => {
    openBin(-1)
    setExploring(false)
  }

  // take-off: a quick blink, then straight to the window seat for the whole roll and climb
  const takeOff = () => {
    if (!cabin.current || stage !== 'cabin') return
    setBin(-1)
    setExploring(false)
    setFade('quick')
    later(() => {
      cabin.current.toWindow(true)
      setStage('takeoff')
      setFade(false)
    }, 320)
    // the scene fades just as the climb enters the cloud
    later(() => setFade(true), 12000)
    later(() => {
      cabin.current.dispose()
      cabin.current = null
      const g = new Globe(globeHost.current, { labels: true })
      globe.current = g
      g.addCity(START.id, START.lat, START.lon, START.city, 'done')
      g.addCity(MUMBAI.id, MUMBAI.lat, MUMBAI.lon, 'Mumbai', 'home')
      // one nonstop great-circle route; the units come up along it
      routes.current = [g.addRoute(START.id, MUMBAI.id)]
      g.setOffset(0.17)
      g.aim(START.lat, START.lon, 330, 10)
      g.camera.position.copy(g.camTarget).multiplyScalar(1.4)
      setStage('globe')
      setFade(false)
      later(() => cross(), 1300)
    }, 12900)
  }

  // nonstop: one continuous flight from New York to Mumbai; the unit pills light up as the plane passes each point
  const CROSS_MS = 11000
  const cross = async () => {
    const g = globe.current
    if (!g) return
    const r = routes.current[0]
    setFlying(true)
    setIdx(0)
    setPassed(0)
    g.setCityState(MUMBAI.id, 'active')
    const t0 = performance.now()
    const tick = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / CROSS_MS)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setPassed(STOPS.filter((st) => st.at <= e).length)
    }, 150)
    timers.current.push(tick)
    g.flight = null
    const p = g.fly(r, CROSS_MS, 0, 1)
    g.flight.dist = 260
    await p
    clearInterval(tick)
    setPassed(STOPS.length)
    // arrived over Mumbai: go straight into the landing, no stop on the globe
    land()
  }

  const flyTo = async (i) => {
    const g = globe.current
    if (!g) return
    setFlying(true)
    setIdx(i)
    const r = routes.current[0]
    const from = i === 0 ? 0 : STOPS[i - 1].at
    const to = i < STOPS.length ? STOPS[i].at : 1
    if (i === STOPS.length) g.setCityState(MUMBAI.id, 'active')
    g.flight = null
    const p = g.fly(r, Math.max(2800, (to - from) * 16000), from, to)
    g.flight.dist = 250
    await p
    if (i < STOPS.length) g.aimOnRoute(r, to, 250, 8)
    else g.aim(MUMBAI.lat, MUMBAI.lon, 210, 8)
    setFlying(false)
  }

  const next = () => {
    if (flying) return
    if (idx < STOPS.length) flyTo(idx + 1)
  }

  const back = () => {
    if (flying || idx <= 0) return
    const g = globe.current
    const i = idx - 1
    const r = routes.current[0]
    g.setCityState(MUMBAI.id, 'home')
    g.placeOn(r, STOPS[i].at)
    g.aimOnRoute(r, STOPS[i].at, 250, 8)
    setIdx(i)
  }

  // landing: the globe dives towards Mumbai, then the airport takes over with the storm and the two landings
  const land = () => {
    const g = globe.current
    if (g) {
      g.setOffset(0)
      g.aim(MUMBAI.lat, MUMBAI.lon, 140, 2)
    }
    setStage('descent')
    later(() => setFade(true), 1300)
    later(() => onDone('arrival'), 2000)
  }

  if (import.meta.env.DEV) window.__storyLand = land
  const stop = idx >= 0 && idx < STOPS.length ? STOPS[idx] : null
  const atMumbai = idx === STOPS.length && !flying
  const stat = stop ? liveStat(app, stop.match) : null
  const plan = app.plan

  return (
    <motion.div className="story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
      <div className="story-gl" ref={cabinHost} style={{ display: ['cabin', 'takeoff'].includes(stage) ? 'block' : 'none' }} />
      <div className="story-gl" ref={globeHost} style={{ display: stage === 'globe' || stage === 'descent' ? 'block' : 'none' }} />
      <div className="story-shade" />

      {stage === 'cabin' && exploring && (
        <motion.div className="bin-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}>
          {UNITS.map((u, i) => <BinDot key={u.u} i={i} cabin={cabin} open={bin === i} onOpen={openBin} />)}
          <AnimatePresence>
            {bin >= 0 && <BinCard key={bin} i={bin} cabin={cabin} onClose={() => openBin(bin)} />}
          </AnimatePresence>
        </motion.div>
      )}

      <header className="story-top">
        <div className="brand">
          <span className="brand-mark"><Ico n="plane" size={15} fill /></span>
          <span className="brand-name">Flight BT 2026</span>
          <span className="story-sub">New York to Mumbai</span>
        </div>
        <div className="progress">
          {STOPS.map((s, i) => (
            <span key={s.id} className={'pg' + (i < passed ? ' done' : '') + (flying && i === passed ? ' now' : '')} style={{ '--c': UNIT_COLOURS[i] }}>
              <i />{s.city}
            </span>
          ))}
          <span className={'pg home' + (atMumbai ? ' done now' : '')}><i />Mumbai</span>
        </div>
        <button className="btn ghost" onClick={() => onDone()}>Skip to the airport<Ico n="skip" size={14} /></button>
      </header>

      <AnimatePresence mode="wait">
        {stage === 'cabin' && !exploring && (
          <motion.section key="intro" className="story-card left glass" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <div className="sc-eyebrow">Welcome aboard</div>
            <h1>Where should every aircraft park?</h1>
            <p className="lead">Mumbai airport has 136 parking stands. On the two days in our data it handled {DATA_FLIGHTS.day1} and {DATA_FLIGHTS.day2} flights. Each arriving aircraft needs a
              stand that fits its size and its terminal, for as long as it stays. This project plans all of them on real flights from
              16 and 17 November 2026, proves it uses the fewest stands, and repairs the plan when storms, closures or delays hit.</p>
            <div className="sc-actions">
              <button className="btn primary big" onClick={explore}>Get to know more<Ico n="arrowRight" size={15} /></button>
            </div>
          </motion.section>
        )}

        {stage === 'cabin' && exploring && (
          <motion.div key="bins-bar" className="bins-bar glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.25 } }} transition={{ duration: 0.4, delay: 0.5 }}>
            <button className="btn ghost" onClick={backToIntro}><Ico n="arrowLeft" size={14} />Back</button>
            <span>Each coloured light on the overhead bins is one unit of the syllabus. Click one to open its bin.</span>
            <button className="btn primary" onClick={takeOff}><Ico n="plane" size={14} fill />Take off</button>
          </motion.div>
        )}

        {stage === 'globe' && stop && !flying && (
          <motion.section key={stop.id} className="story-card right glass" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', damping: 26, stiffness: 220 }}>
            <div className="sc-stop">
              <span className="sc-city"><Ico n="plane" size={13} fill />{stop.when} · nonstop to Mumbai</span>
              <span className="sc-unit" style={{ '--c': UNIT_COLOURS[idx] }}>Unit {stop.unit}</span>
            </div>
            <h2>{stop.title}</h2>
            <p className="sc-q">{stop.question}</p>
            <div className="sc-illus"><Illus kind={stop.viz} /></div>
            <p className="sc-body">{stop.body}</p>
            <div className="sc-algos">{stop.algos.map((a) => <span key={a}>{a}</span>)}</div>
            <div className="sc-live">
              <span className="sc-live-k"><i />In this plan</span>
              {stat ? <span>{stat.operation} · <b className="num">{stat.timeMs < 1 ? stat.timeMs.toFixed(2) : stat.timeMs.toFixed(1)} ms</b></span>
                : <span>Runs as soon as you disrupt the plan in the Scenario lab.</span>}
            </div>
            <div className="sc-nav">
              <button className="btn ghost" disabled={idx === 0} onClick={back}><Ico n="arrowLeft" size={14} />Back</button>
              <button className="btn primary" onClick={next}>
                {idx === STOPS.length - 1 ? 'Fly on to Mumbai' : 'Fly on: unit ' + STOPS[idx + 1].unit}<Ico n="arrowRight" size={14} />
              </button>
            </div>
          </motion.section>
        )}

        {stage === 'globe' && atMumbai && (
          <motion.section key="bom" className="story-card right glass" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', damping: 26, stiffness: 220 }}>
            <div className="sc-stop"><span className="sc-city"><Ico n="pin" size={13} />Destination · Mumbai</span></div>
            <h2>Approaching Mumbai</h2>
            <p className="sc-body">You are on Air India AI 116 from New York, a real flight in our data. A monsoon storm has just
              reached the airport. You will land twice: once the way stand plans usually work, and once with our Java planner.</p>
            <div className="facts">
              <div><b className="num">{DATA_FLIGHTS.total.toLocaleString('en-IN')}</b><span>real flights, 16 and 17 Nov 2026</span></div>
              <div><b className="num">{plan ? plan.stats.standsAvailable : 136}</b><span>stands across T1, T2 and remote aprons</span></div>
              <div><b className="num">{plan ? plan.stats.standsUsed : 104}</b><span>stands used on day 1, proven minimum</span></div>
            </div>
            <ul className="howto">
              <li><Ico n="plane" size={13} fill /><span><b>Click any aircraft</b> to see its stand and why the planner chose it.</span></li>
              <li><Ico n="lab" size={13} /><span><b>Scenario lab:</b> pick a storm, fog or a closed pier and watch every affected aircraft tow to a new stand.</span></li>
              <li><Ico n="algo" size={13} /><span><b>Algorithms:</b> every unit's data structure, live, with its last real run.</span></li>
              <li><Ico n="help" size={13} /><span><b>Guide:</b> a one-minute tour opens after the landing, and stays under the Guide button.</span></li>
            </ul>
            <div className="sc-nav">
              <button className="btn ghost" onClick={() => {
                const g = globe.current
                if (!g) return
                g.placeOn(routes.current[0], 0)
                g.aim(START.lat, START.lon, 330, 10)
                later(() => cross(), 900)
              }}>
                <Ico n="arrowLeft" size={14} />Fly it again
              </button>
              <button className="btn primary big" onClick={land}>Land in Mumbai<Ico n="arrowRight" size={14} /></button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === 'takeoff' && (
          <motion.div key="to" className="enroute glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <Ico n="plane" size={14} fill />Flight BT 2026 cleared for take-off from <b>New York JFK</b>
          </motion.div>
        )}
        {stage === 'globe' && flying && idx >= 0 && (
          <motion.div key="fly" className="enroute glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <Ico n="plane" size={14} fill />
            {passed === 0 ? <>Nonstop from <b>New York</b> to <b>Mumbai</b></>
              : passed < STOPS.length ? <>Nonstop to <b>Mumbai</b> · {STOPS[passed - 1].when} · passing Unit {STOPS[passed - 1].unit}: {STOPS[passed - 1].title}</>
                : <>Final approach into <b>Mumbai</b></>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={'story-fade' + (fade ? ' on' : '') + (fade === 'quick' ? ' quick' : '')} />
    </motion.div>
  )
}
