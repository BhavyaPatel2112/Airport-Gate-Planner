import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from './api/client'
import { AppContext } from './state/app'
import { clock } from './state/clock'
import WorldView from './shell/WorldView'
import TopBar from './shell/TopBar'
import Dock from './shell/Dock'
import OpsPanel from './shell/OpsPanel'
import FlightCard from './shell/FlightCard'
import Tour from './shell/Tour'
import Holding from './shell/Holding'
import Walkthrough from './shell/Walkthrough'
import Arrival from './shell/Arrival'
import Ico from './shell/icons'
import { Sheet, Toasts, Compass, Caption } from './shell/Overlays'
import { Announcements } from './panels'
import { camStore } from './shell/camStore'
import { runScenario, totals, STEP_TYPES } from './shell/scenario'
import Welcome from './story/Welcome'
import StoryFlight from './story/StoryFlight'
import './shell/shell.css'

let seq = 0
if (import.meta.env.DEV && typeof window !== 'undefined') window.__clock = clock

/** Keeps one broken widget from blanking the whole screen during a demo. */
class Guard extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="guard glass">
        <b>This part of the screen hit an error.</b>
        <span>{String(this.state.error.message || this.state.error)}</span>
        <button className="btn sm" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
  }
}

// URL settings for demos: ?start=1 opens the airport directly, ?start=story the story flight, ?t=840 sets the clock (minutes), ?day=2
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const START_MINUTE = params.has('t') ? Math.max(0, Math.min(1440, Number(params.get('t')) || 480)) : 480

// a refresh opens the same page again (start page, story flight or airport), with the same day and tab
const PAGE_KEY = 'gp-page'
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem(PAGE_KEY)) || {} } catch { return {} }
})()
const START_PHASE = params.get('start') === '1' ? 'app' : params.get('start') === 'story' ? 'story'
  : ['welcome', 'story', 'app'].includes(saved.phase) ? saved.phase : 'welcome'

export default function App() {
  const [phase, setPhase] = useState(START_PHASE)
  const [day, setDayState] = useState(params.has('day') ? (params.get('day') === '2' ? 2 : 1) : saved.day === 2 ? 2 : 1)
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
  const [searchResult, setSearchResult] = useState(null)
  const [panel, setPanel] = useState(true)
  const [tab, setTab] = useState(['overview', 'lab', 'algos', 'flights'].includes(saved.tab) ? saved.tab : 'overview')
  const [sheet, setSheet] = useState(null)
  const [layers, setLayers] = useState({ labels: true, closures: true, heat: false, vehicles: true })
  const [quality, setQualityState] = useState(() => {
    try { return localStorage.getItem('gp-quality') || 'high' } catch { return 'high' }
  })
  const [occupancy, setOccupancy] = useState(null)
  const [camPreset, setCamPreset] = useState('tower')
  const [introPending, setIntroPending] = useState(true)
  const [scenario, setScenarioState] = useState({ buffer: 75, recovery: 'matching', steps: [], results: null, compare: null,
    running: false, progress: 0, dirty: false })
  const [marks, setMarks] = useState([])
  const [boardTick, setBoardTick] = useState(0)
  const [sound, setSound] = useState(false)
  const [labMode, setLabMode] = useState('replay')
  const [picking, setPicking] = useState(null)
  const [walk, setWalk] = useState(null)
  // the end of the story flight: AI 116 meets a storm and lands twice (fixed plan, then our planner)
  const [arrival, setArrival] = useState(null)
  const [lastWalk, setLastWalk] = useState(null)
  const [fixedVersion, setFixedVersion] = useState(null)
  // a dark curtain hides the moment the 3D airport is built, and lifts once it has drawn its first frames
  const [curtain, setCurtain] = useState(START_PHASE === 'app')
  const [worldReady, setWorldReady] = useState(false)
  const [tour, setTour] = useState(false)
  const pickRef = useRef(null)
  const opSeq = useRef(0)
  const worldRef = useRef(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const visitsById = useMemo(() => {
    const m = {}
    if (plan) for (const v of plan.visits) m[v.id] = v
    return m
  }, [plan])

  // flights in the day's data (an aircraft that arrives and leaves again is two flights but one stay on a stand)
  const counts = useMemo(() => {
    if (!plan) return null
    let arr = 0
    let dep = 0
    for (const v of plan.visits) {
      if (v.arrival) arr++
      if (v.departure) dep++
    }
    return { flights: arr + dep, arrivals: arr, departures: dep, stays: plan.visits.length }
  }, [plan && plan.planId]) // eslint-disable-line react-hooks/exhaustive-deps

  // one thing on the right at a time: the boarding pass takes the side panel's place while it is open
  const cardOpen = !!(selected && !walk && !arrival && visitsById[selected])

  const toast = useCallback((text, kind = 'info') => {
    const id = ++seq
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }, [])

  const absorb = useCallback((view, kind, extraTrace) => {
    setPlan(view)
    const at = Date.now()
    setLastOp({ seq: ++opSeq.current, kind, summary: view.summary, events: view.events || [], at })
    setBoardTick((t) => t + 1)
    const trace = extraTrace || view.trace || []
    if (trace.length) {
      setTraceLog((log) => [...trace.map((t, i) => ({ ...t, key: at + '-' + i, op: kind })), ...log].slice(0, 120))
    }
    const fx = []
    for (const e of view.events || []) {
      if (e.type === 'MOVE') fx.push({ kind: 'move', from: e.fromStand, to: e.toStand, t0: at })
      else if (e.type === 'UNPLACED' && e.fromStand) fx.push({ kind: 'unplaced', from: e.fromStand, t0: at })
    }
    if (fx.length) setEffects(fx.slice(0, 40))
    if (kind !== 'plan') {
      const moves = (view.events || []).filter((e) => e.type === 'MOVE' || e.type === 'UNPLACED').length
      if (moves) setMachineTab('matching')
    }
  }, [])

  const run = useCallback(async (kind, fn, quiet) => {
    setBusy(true)
    try {
      const res = await fn()
      const view = res && res.plan ? res.plan : res
      if (view && view.visits) {
        absorb(view, kind)
        if (!quiet) toast(view.summary, view.stats && view.stats.unplaced > 0 ? 'warn' : 'ok')
      }
      return res
    } catch (e) {
      toast(e.message, 'error')
      throw e
    } finally {
      setBusy(false)
    }
  }, [absorb, toast])

  const loadPlan = useCallback(async (d, b, r) => {
    setStorm(null)
    setSelected(null)
    setFollowState(null)
    setEffects([])
    setMarks([])
    setBusy(true)
    try {
      const view = await api.createPlan(d, b, r)
      absorb(view, 'plan')
      return view
    } catch (e) {
      toast('Cannot reach the planner: ' + e.message, 'error')
      return null
    } finally {
      setBusy(false)
    }
  }, [absorb, toast])

  // the plan is built as soon as the app opens, so the story can quote real numbers
  const first = useRef(false)
  useEffect(() => {
    if (first.current) return
    first.current = true
    loadPlan(day, 75, 'matching')
    clock.set({ minute: START_MINUTE, speed: 60, playing: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const planId = plan && plan.planId
  const version = plan && plan.version
  useEffect(() => {
    if (!planId) return undefined
    let live = true
    api.occupancy(planId).then((o) => live && setOccupancy(o.minutes)).catch(() => {})
    return () => { live = false }
  }, [planId, version])

  // the guide opens every time someone reaches the airport, once the opening flight has landed
  useEffect(() => {
    if (phase !== 'app' || !worldReady || arrival || params.get('guide') === '0') return undefined
    const t = setTimeout(() => setTour(true), 4600)
    return () => clearTimeout(t)
  }, [phase, worldReady])

  useEffect(() => {
    if (camPreset !== 'roam') return undefined
    const key = (e) => { if (e.key === 'Escape') { if (worldRef.current) worldRef.current.setRoam(false); setCamPreset(null) } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [camPreset])

  useEffect(() => {
    if (!picking) return undefined
    const key = (e) => { if (e.key === 'Escape') { pickRef.current = null; setPicking(null) } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [picking])

  const setScenario = (patch) => setScenarioState((s) => ({ ...s, ...patch }))

  const applyScenarioView = (view, results, steps) => {
    const at = Date.now()
    setPlan(view)
    setSelected(null)
    setFollowState(null)
    const all = []
    for (let i = results.length - 1; i >= 0; i--) for (const t of results[i].trace || []) all.push(t)
    setTraceLog(all.map((t, i) => ({ ...t, key: at + '-' + i, op: 'scenario' })).slice(0, 120))
    const fx = []
    for (const r of results) {
      for (const e of r.events || []) if (e.type === 'MOVE') fx.push({ kind: 'move', from: e.fromStand, to: e.toStand, t0: at })
    }
    setEffects(fx.slice(0, 40))
    const storms = steps.filter((s) => s.type === 'storm')
    const st = storms.length ? storms[storms.length - 1].params : null
    setStorm(st ? { severity: st.severity, from: st.from, to: st.to } : null)
    const mk = []
    for (const r of results) if (r.at != null && r.type !== 'base') mk.push({ at: r.at, type: r.type })
    setMarks(mk)
    const t = totals(results)
    setBoardTick((t) => t + 1)
    setLastOp({ seq: ++opSeq.current, kind: 'scenario', summary: 'Scenario: ' + (steps.length ? steps.length + ' disruptions, ' : '') + t.moved + ' flights moved, '
      + t.unplaced + ' without a stand.', events: [], at })
    if (view.stats.unplaced > 0) setMachineTab('matching')
  }

  /** Frame every stand an aircraft moved from or to in these events. */
  const frameEvents = (events) => {
    const ids = []
    for (const e of events || []) {
      if (e.type === 'MOVE') ids.push(e.fromStand, e.toStand)
      else if (e.type === 'UNPLACED' && e.fromStand) ids.push(e.fromStand)
    }
    if (ids.length && worldRef.current) { setCamPreset(null); worldRef.current.frameStands(ids) } else flyTo('overview')
  }

  const doRunScenario = async (stepsOverride) => {
    const sc = stepsOverride ? { ...scenario, steps: stepsOverride } : scenario
    setScenario({ running: true, progress: 0, compare: null, shown: sc.recovery })
    setBusy(true)
    try {
      const { view, results } = await runScenario({ day, buffer: sc.buffer, recovery: sc.recovery, steps: sc.steps },
        (p) => setScenario({ progress: p }))
      applyScenarioView(view, results, sc.steps)
      setScenario({ running: false, results, dirty: false })
      const t = totals(results)
      toast(sc.steps.length ? 'Scenario solved: ' + t.moved + ' moved, ' + t.unplaced + ' without a stand' : view.summary,
        t.unplaced ? 'warn' : 'ok')
      const firstStep = results.find((r) => r.at != null && r.type !== 'base')
      if (firstStep) {
        clock.set({ minute: Math.max(0, firstStep.at - 10), playing: false })
        frameEvents(firstStep.events)
      }
    } catch (e) {
      toast(e.message, 'error')
      setScenario({ running: false })
    } finally {
      setBusy(false)
    }
  }

  const doCompare = async (stepsOverride) => {
    const sc = stepsOverride ? { ...scenario, steps: stepsOverride } : scenario
    setScenario({ running: true, progress: 0 })
    setBusy(true)
    try {
      const base = { day, buffer: sc.buffer, steps: sc.steps }
      const [m, g] = await Promise.all([runScenario({ ...base, recovery: 'matching' }), runScenario({ ...base, recovery: 'greedy' })])
      const mine = sc.recovery === 'greedy' ? g : m
      applyScenarioView(mine.view, mine.results, sc.steps)
      setScenario({ running: false, results: mine.results, compare: { matching: m, greedy: g }, dirty: false, shown: sc.recovery })
      const firstStep = mine.results.find((r) => r.at != null && r.type !== 'base')
      if (firstStep) {
        clock.set({ minute: Math.max(0, firstStep.at + 2), playing: false })
        frameEvents(firstStep.events)
      }
      const gm = totals(g.results)
      const mm = totals(m.results)
      toast('Matching: ' + mm.unplaced + ' without a stand. Greedy: ' + gm.unplaced + '. Switch between them under Compare to see the difference.',
        gm.unplaced !== mm.unplaced ? 'warn' : 'ok')
    } catch (e) {
      toast(e.message, 'error')
      setScenario({ running: false })
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    setScenario({ steps: [], results: null, compare: null, dirty: false })
    await loadPlan(day, scenario.buffer, scenario.recovery)
    toast('Clean plan rebuilt', 'ok')
  }

  const jumpToResult = (r) => {
    if (r.at != null) clock.set({ minute: Math.max(0, r.at - 10), playing: false })
    const at = Date.now()
    const fx = []
    for (const e of r.events || []) {
      if (e.type === 'MOVE') fx.push({ kind: 'move', from: e.fromStand, to: e.toStand, t0: at })
      else if (e.type === 'UNPLACED' && e.fromStand) fx.push({ kind: 'unplaced', from: e.fromStand, t0: at })
    }
    setEffects(fx.slice(0, 40))
    frameEvents(r.events)
    if (r.type && STEP_TYPES[r.type]) setCaption(STEP_TYPES[r.type].title + ': ' + (r.error || r.summary))
    setTimeout(() => setCaption(null), 7000)
  }

  /** Show the matching or the greedy result of the last comparison on the map; aircraft tow between the two. */
  const showCompare = (which) => {
    const cmp = scenario.compare
    if (!cmp || !cmp[which]) return
    // frame the aircraft that sit on different stands in the two results
    const other = cmp[which === 'greedy' ? 'matching' : 'greedy'].view
    const was = {}
    for (const v of other.visits) was[v.id] = v.stand
    const ids = []
    for (const v of cmp[which].view.visits) if (was[v.id] !== v.stand) ids.push(was[v.id], v.stand)
    applyScenarioView(cmp[which].view, cmp[which].results, scenario.steps)
    setScenario({ shown: which, results: cmp[which].results })
    if (worldRef.current) worldRef.current.frameStands(ids.filter(Boolean))
  }

  /** Jump to one changed flight: clock to when it is on its new stand, camera on it, boarding pass open. */
  const showChange = (visitId, standId) => {
    const v = visitsById[visitId]
    if (v) clock.set({ minute: Math.min(1439, Math.max(v.start + 2, Math.min(v.end - 2, clock.get().minute))), playing: false })
    setSelected(visitId)
    if (standId) focusOn(standId)
  }

  /** Re-plan every flight from the current minute together (in Java), keeping delays and closures. */
  const fixEverything = async () => {
    if (!plan) return
    const at = Math.floor(clock.get().minute)
    const before = plan.stats.unplaced
    const prevById = { ...visitsById }
    // everything else steps aside so the changes can be watched
    setPanel(false)
    setSelected(null)
    setFollowState(null)
    setCaption(null)
    if (worldRef.current) worldRef.current.skipNextDiff = true
    try {
      const view = await run('replan', () => api.replan(plan.planId, at), true)
      if (!view || !view.stats) return
      setEffects([])
      setScenario({ dirty: true })
      setFixedVersion(view.version)
      // the guided replay comes from the Java re-plan: one step per algorithm, with what each one changed
      const replay = view.snapshots && view.snapshots.replan
      const steps = replay ? replay.steps : []
      const changed = []
      for (const v of view.visits) {
        const p = prevById[v.id]
        if (p && (p.stand !== v.stand || p.start !== v.start)) changed.push(v.id)
      }
      const prev = {}
      for (const id of changed) prev[id] = prevById[id]
      const w = { id: Date.now(), i: 0, at, before, after: view.stats.unplaced, steps, prev, changed }
      setWalk(w)
      setLastWalk(w)
    } catch {
      if (worldRef.current) worldRef.current.skipNextDiff = false
    }
  }

  /**
   * Shows step i of the guided replay. Flights fixed by a later step are still drawn as they were before the
   * fix; flights this step fixes are towed or landed onto their new stands, in order for an augmenting path.
   */
  const walkTimers = useRef([])
  const showStep = (w, i) => {
    const world = worldRef.current
    if (!world || !w) return
    for (const t of walkTimers.current) { clearTimeout(t); clearInterval(t) }
    walkTimers.current = []
    const st = w.steps[i]
    const done = new Set()
    for (let k = 0; k < i; k++) for (const id of w.steps[k].apply || []) done.add(id)
    const last = i === w.steps.length - 1
    const now = last ? w.changed : (st.apply || [])
    const pending = new Map()
    for (const id of w.changed) if (!done.has(id) && !now.includes(id)) pending.set(id, { prev: w.prev[id] })
    const fresh = now.filter((id) => !done.has(id) && w.prev[id])
    if (st.holdUntil != null) for (const id of fresh) pending.set(id, { prev: w.prev[id], until: st.holdUntil })
    world.setPending(pending)
    const animate = fresh.filter((id) => st.holdUntil == null).slice(0, 140)
    animate.forEach((id, k) => world.replayMove(id, w.prev[id], st.sequence ? 2600 : 3000,
      st.sequence ? k * 2800 : Math.min(2400, k * (last ? 25 : 90))))
    // the clock: paused at the step's moment, or run across a hold so the stand can be seen emptying
    if (st.run) {
      // about eight seconds of wall time, however fast the 3D view is drawing
      const [a, b] = st.run
      const t0 = performance.now() + 900
      clock.set({ minute: a, playing: false })
      const tick = setInterval(() => {
        const k = Math.min(1, Math.max(0, (performance.now() - t0) / 8000))
        clock.set({ minute: a + (b - a) * k })
        if (k >= 1) clearInterval(tick)
      }, 40)
      walkTimers.current.push(tick)
    } else if (st.minute != null) {
      clock.set({ minute: Math.min(1439, st.minute), playing: false })
    }
    const at2 = Date.now()
    const fx = []
    for (const [from, to] of st.arcs || []) fx.push({ kind: 'move', from, to, t0: at2 })
    for (const m of st.marks || []) fx.push({ kind: 'mark', to: m.stand, tone: m.tone, t0: at2 })
    setEffects(fx)
    const main = st.kind === 'path' ? (st.apply || [])[st.apply.length - 1] : ['edges', 'hold'].includes(st.kind) ? (st.apply || [])[0] : null
    setSelected(main || null)
    setFollowState(null)
    setCamPreset(null)
    if ((st.focus || []).length || st.holding) world.frameStands(st.focus || [], 1600, !!st.holding)
    else flyTo('overview')
  }

  const endWalk = () => {
    for (const t of walkTimers.current) { clearTimeout(t); clearInterval(t) }
    walkTimers.current = []
    if (worldRef.current) worldRef.current.setPending(null)
    if (clock.get().playing) clock.set({ playing: false })
    setWalk(null)
    setSelected(null)
    setEffects([])
    setPanel(true)
  }

  const startPick = (cb) => {
    pickRef.current = cb
    setPicking(true)
    setPanel(true)
  }
  const cancelPick = () => {
    pickRef.current = null
    setPicking(null)
  }
  const worldClick = (id) => {
    if (pickRef.current) {
      if (!id) return
      const cb = pickRef.current
      pickRef.current = null
      setPicking(null)
      cb(id)
      return
    }
    setSelected(id)
  }

  const setRoam = (on) => {
    if (worldRef.current) worldRef.current.setRoam(on)
    setCamPreset(on ? 'roam' : null)
    setFollowState(null)
  }

  const flyTo = (spec) => {
    if (typeof spec === 'string') setCamPreset(spec)
    setFollowState(null)
    if (worldRef.current) worldRef.current.flyTo(spec)
  }
  const focusOn = (stand) => {
    setCamPreset(null)
    if (worldRef.current) worldRef.current.flyTo(stand)
  }

  const setDay = (d) => {
    setDayState(d)
    setScenario({ results: null, compare: null })
    loadPlan(d, scenario.buffer, scenario.recovery)
  }

  useEffect(() => {
    try { sessionStorage.setItem(PAGE_KEY, JSON.stringify({ phase, day, tab })) } catch { /* private mode */ }
  }, [phase, day, tab])

  const ctx = {
    phase, day, setDay, buffer: scenario.buffer,
    plan, visitsById, busy, run, absorb, toast, toasts, traceLog, lastOp,
    loadPlan: (d = day, b = scenario.buffer) => loadPlan(d, b, scenario.recovery),
    selected, select: (id) => setSelected(id), worldClick, picking, startPick, cancelPick, showCompare, showChange,
    tour, setTour, fixEverything, setRoam, walk, setWalk, endWalk, showStep, fixedVersion, lastWalk,
    replayFix: () => lastWalk && setWalk({ ...lastWalk, id: Date.now(), i: 0 }),
    follow, setFollow: (id) => setFollowState(id),
    machineTab, setMachineTab, effects, setEffects, storm, setStorm, caption, setCaption, searchResult, setSearchResult,
    reducedMotion, panel: panel && !cardOpen, rightOpen: panel || cardOpen || !!walk, cardOpen, counts,
    setPanel: (on) => { if (on) setSelected(null); setPanel(on) },
    labMode, setLabMode: (m) => { setLabMode(m); setTab('lab'); setSelected(null); setPanel(true) },
    tab, setTab, sheet, setSheet, setDrawer: setSheet,
    layers, setLayers, quality, setQuality: (q, auto) => {
      setQualityState(q)
      if (!auto) { try { localStorage.setItem('gp-quality', q) } catch { /* private mode */ } }
    },
    occupancy, camPreset, flyTo, focusOn, focusStand: null,
    zoom: (f) => worldRef.current && worldRef.current.zoom(f),
    registerWorld: (w) => { worldRef.current = w },
    getWorld: () => worldRef.current,
    arrival, setArrival, showPlanView: (v) => setPlan(v),
    finishArrival: () => {
      if (worldRef.current) {
        worldRef.current.setPending(null)
        worldRef.current.skipNextDiff = true
        if (worldRef.current.quality !== quality) worldRef.current.setQuality(quality)
      }
      setArrival(null)
      setLayers((l) => ({ ...l, labels: true }))
      setEffects([])
      setSelected(null)
      setFollowState(null)
      // the storm clears over a few seconds at the same time of day, instead of jumping to a sunny morning
      loadPlan(day, scenario.buffer, scenario.recovery)
      clock.set({ playing: false })
      setPanel(true)
      flyTo('tower')
      if (params.get('guide') !== '0') setTimeout(() => setTour(true), 1800)
    },
    setCam: (c) => camStore.set(c),
    introPending, consumeIntro: () => setIntroPending(false),
    scenario, setScenario, runScenario: doRunScenario, compareScenario: doCompare, resetScenario: doReset, jumpToResult,
    scenarioMarks: marks,
    boardTick, sound, setSound,
    setBuffer: (b) => { setScenario({ buffer: b }); return loadPlan(day, b, scenario.recovery) },
    openStory: () => setPhase('story'),
    goHome: () => {
      for (const t of walkTimers.current) { clearTimeout(t); clearInterval(t) }
      walkTimers.current = []
      setWalk(null)
      setTour(false)
      setSelected(null)
      setFollowState(null)
      setPicking(null)
      pickRef.current = null
      clock.set({ playing: false })
      setWorldReady(false)
      setCurtain(false)
      setPhase('welcome')
    },
    enterAirport: (mode) => {
      setCurtain(true)
      setWorldReady(false)
      if (mode === 'arrival') {
        setArrival({ act: 'loading' })
        setPanel(false)
        // already the monsoon when the airport first appears, around the time AI 116 is due
        setStorm({ severity: 95, from: 0, to: 1440 })
        clock.set({ minute: 815, playing: false })
      }
      setTimeout(() => { setIntroPending(true); setPhase('app') }, 480)
    },
    worldReady: () => { setWorldReady(true); setTimeout(() => setCurtain(false), 60) }
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        {phase === 'app' && (
          <motion.div className="app-layer" initial={{ opacity: 1 }}>
            <WorldView />
            <TopBar />
            <Guard><OpsPanel /></Guard>
            <Guard><AnimatePresence>{cardOpen && <FlightCard key={selected} visit={visitsById[selected]} />}</AnimatePresence></Guard>
            <Compass />
            <Caption />
            <Guard><Announcements /></Guard>
            {!walk && !arrival && <Guard><Holding /></Guard>}
            {arrival && <Guard><Arrival /></Guard>}
            <Guard><Walkthrough /></Guard>
            <Dock />
            <Guard><Sheet /></Guard>
            <AnimatePresence>
              {picking && (
                <motion.div className="pick-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Ico n="pin" size={14} />Click any aircraft to choose it
                  <button className="btn sm" onClick={() => { pickRef.current = null; setPicking(null) }}>Cancel</button>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {camPreset === 'roam' && !picking && (
                <motion.div className="pick-banner roam" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Ico n="roam" size={14} /><span><b>Free roam</b> · W A S D or arrows to move · drag to look · Q / E down and up · hold Shift to go faster</span>
                  <button className="btn sm" onClick={() => setRoam(false)}>Done</button>
                </motion.div>
              )}
            </AnimatePresence>
            <Tour />
          </motion.div>
        )}
        <div className={'curtain' + (curtain ? ' on' : '')}>{curtain && phase === 'app' && !worldReady && <span className="curtain-k">Arriving at Mumbai</span>}</div>
        <Toasts />
        {busy && <div className="busy-line" />}
        <AnimatePresence mode="wait">
          {phase === 'welcome' && <Welcome key="welcome" onStory={() => setPhase('story')} onSkip={() => ctx.enterAirport()} />}
          {phase === 'story' && <StoryFlight key="story" onDone={(mode) => ctx.enterAirport(mode)} />}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  )
}
