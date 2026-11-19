import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from './api/client'
import { AppContext } from './state/app'
import { clock } from './state/clock'
import AirportScene from './scene/AirportScene'
import Airport3D from './scene3d/Airport3D'
import SignageBar from './hud/SignageBar'
import TimeControls from './hud/TimeControls'
import WelcomeScreen from './hud/WelcomeScreen'
import XRayStrip from './hud/XRayStrip'
import BoardingPassCard from './hud/BoardingPassCard'
import FlightFinder from './hud/FlightFinder'
import RaceView from './hud/RaceView'
import DataDrawer from './hud/DataDrawer'
import StoryMode from './hud/StoryMode'
import MachineView from './machine/MachineView'
import { DeparturesBoard, Announcements, RadarScope, ChaosDesk, NoticeTeletype, DelayLeaderboard, BenchmarkLab } from './panels'
import './App.css'

const DRAWERS = {
  lab: { title: 'Proof and Benchmark Lab', width: 980 },
  race: { title: 'The Race: greedy first-fit versus maximum matching', width: 920 },
  finder: { title: 'Flight finder', width: 520 },
  data: { title: 'Data and assumptions', width: 680 },
  stats: { title: 'Airline delay leaderboard', width: 760 }
}

let effectSeq = 0

// Optional URL settings for demos: ?start=1 skips the welcome screen, ?t=840 sets the clock (minutes), ?day=2
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const START_MINUTE = params.has('t') ? Math.max(0, Math.min(1440, Number(params.get('t')) || 330)) : 330

export default function App() {
  const [started, setStarted] = useState(params.get('start') === '1')
  useEffect(() => {
    if (params.get('start') === '1') clock.set({ minute: START_MINUTE })
  }, [])
  const [day, setDay] = useState(params.get('day') === '2' ? 2 : 1)
  const [buffer, setBuffer] = useState(75)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [traceLog, setTraceLog] = useState([])
  const [lastOp, setLastOp] = useState(null)
  const [selected, setSelected] = useState(null)
  const [follow, setFollowState] = useState(null)
  const [machineTab, setMachineTab] = useState('rbtree')
  const [effects, setEffects] = useState([])
  const [storm, setStorm] = useState(null)
  const [caption, setCaption] = useState(null)
  const [toasts, setToasts] = useState([])
  const [sound, setSound] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [drawer, setDrawer] = useState(null)
  const [tilt, setTilt] = useState(true)
  const [labels, setLabels] = useState(true)
  const [focus, setFocus] = useState({ stand: null, tick: 0 })
  const [story, setStory] = useState(false)
  const [boardTick, setBoardTick] = useState(0)
  const [searchResult, setSearchResult] = useState(null)
  const [view, setView] = useState(params.get('view') === '2d' ? '2d' : '3d')
  const [introPending, setIntroPending] = useState(!params.has('start'))
  const cameraRef = useRef(null)
  const opSeq = useRef(0)

  const visitsById = useMemo(() => {
    const m = {}
    if (plan) for (const v of plan.visits) m[v.id] = v
    return m
  }, [plan])

  const toast = useCallback((text, kind = 'info') => {
    const id = ++effectSeq
    setToasts((t) => [...t.slice(-3), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500)
  }, [])

  const absorb = useCallback((view, kind) => {
    setPlan(view)
    const seq = ++opSeq.current
    const at = Date.now()
    setLastOp({ seq, kind, summary: view.summary, events: view.events || [], at })
    if (view.trace && view.trace.length) {
      setTraceLog((log) => [...view.trace.map((t, i) => ({ ...t, key: seq + '-' + i, op: kind })), ...log].slice(0, 80))
    }
    const fx = []
    for (const e of view.events || []) {
      if (e.type === 'MOVE') fx.push({ kind: 'move', from: e.fromStand, to: e.toStand, t0: at })
      else if (e.type === 'UNPLACED' && e.fromStand) fx.push({ kind: 'unplaced', from: e.fromStand, t0: at })
    }
    if (fx.length) setEffects(fx.slice(0, 40))
    setBoardTick((t) => t + 1)
    const moves = (view.events || []).filter((e) => e.type === 'MOVE').length
    const unplaced = (view.events || []).filter((e) => e.type === 'UNPLACED').length
    if (kind !== 'plan') {
      if (unplaced > 0) setMachineTab('matching')
      else if (moves > 0) setMachineTab('matching')
      else if (view.snapshots && view.snapshots.rbtree) setMachineTab('rbtree')
    }
  }, [])

  const run = useCallback(async (kind, fn) => {
    setBusy(true)
    try {
      const res = await fn()
      const view = res && res.plan ? res.plan : res
      if (view && view.visits) {
        absorb(view, kind)
        toast(view.summary, (view.stats && view.stats.unplaced > 0) ? 'warn' : 'ok')
      }
      return res
    } catch (e) {
      toast(e.message, 'error')
      throw e
    } finally {
      setBusy(false)
    }
  }, [absorb, toast])

  const loadPlan = useCallback(async (d = day, b = buffer) => {
    setStorm(null)
    setSelected(null)
    setFollowState(null)
    setEffects([])
    await run('plan', () => api.createPlan(d, b))
  }, [day, buffer, run])

  const firstLoad = useRef(false)
  useEffect(() => {
    if (started && !plan && !firstLoad.current) {
      firstLoad.current = true
      loadPlan(day, buffer).catch(() => { firstLoad.current = false })
    }
  }, [started]) // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = {
    day, setDay: (d) => { setDay(d); loadPlan(d, buffer).catch(() => {}) },
    buffer, setBuffer: (b) => { setBuffer(b); loadPlan(day, b).catch(() => {}) },
    plan, visitsById, busy, run, loadPlan, absorb, toast, traceLog, lastOp,
    selected, select: (id) => setSelected(id),
    follow, setFollow: (id) => setFollowState(id),
    followLabel: follow && visitsById[follow] ? visitsById[follow].label : '',
    machineTab, setMachineTab,
    effects, storm, setStorm, caption, setCaption, sound, setSound, reducedMotion, setReducedMotion,
    drawer, setDrawer, tilt, setTilt, labels, setLabels,
    focusStand: focus.stand, focusTick: focus.tick, focusOn: (stand) => setFocus((f) => ({ stand, tick: f.tick + 1 })),
    story, setStory, boardTick, searchResult, setSearchResult,
    view, setView,
    registerCamera: (fn) => { cameraRef.current = fn },
    flyTo: (spec) => { if (cameraRef.current) cameraRef.current(spec) },
    introPending, consumeIntro: () => setIntroPending(false)
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className={'app' + (reducedMotion ? ' reduced-motion' : '')}>
        <SignageBar />
        <div className="main">
          <div className="stage">
            <div className="stage-scene">
              {view === '3d' ? <Airport3D /> : <AirportScene />}
              <AnimatePresence>{selected && visitsById[selected] && <BoardingPassCard key={selected} />}</AnimatePresence>
              <Announcements />
              <div className="toasts">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div key={t.id} className={'toast ' + t.kind} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}>{t.text}</motion.div>
            ))}
          </AnimatePresence>
        </div>
            </div>
            <TimeControls />
          </div>
          <div className="side">
            <MachineView />
            <RadarScope />
          </div>
        </div>
        <div className="bottom">
          <DeparturesBoard />
          <ChaosDesk />
          <NoticeTeletype />
        </div>
        <XRayStrip />
        <StoryMode />
        <AnimatePresence>
          {drawer && (
            <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawer(null)}>
              <motion.aside className="drawer" style={{ width: DRAWERS[drawer].width }} initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                onClick={(e) => e.stopPropagation()}>
                <div className="drawer-head">
                  <h2>{DRAWERS[drawer].title}</h2>
                  <button className="btn ghost" onClick={() => setDrawer(null)}>Close</button>
                </div>
                <div className="drawer-body">
                  {drawer === 'lab' && <BenchmarkLab />}
                  {drawer === 'race' && <RaceView />}
                  {drawer === 'finder' && <FlightFinder />}
                  {drawer === 'data' && <DataDrawer />}
                  {drawer === 'stats' && <DelayLeaderboard />}
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
        {busy && <div className="busy-bar" />}
        <AnimatePresence>{!started && <WelcomeScreen onStart={() => { setStarted(true); clock.set({ minute: START_MINUTE }) }} />}</AnimatePresence>
      </div>
    </AppContext.Provider>
  )
}
