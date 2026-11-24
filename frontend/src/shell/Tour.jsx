import { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { clock } from '../state/clock'
import Ico from './icons'

// The open part of the airport view: between the top bar, the dock and the side panel.
function worldArea() {
  const gap = 10
  const top = document.querySelector('.topbar')
  const dock = document.querySelector('.dock')
  const side = document.querySelector('.ops') || document.querySelector('.bpass')
  const y0 = top ? top.getBoundingClientRect().bottom + gap : gap
  const y1 = dock ? dock.getBoundingClientRect().top - gap : window.innerHeight - gap
  const x0 = gap
  const x1 = side ? side.getBoundingClientRect().left - gap : window.innerWidth - gap
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

// The guide: opens every time the airport loads; five steps, each points at one part of the screen and says what it is for.
const STEPS = [
  {
    title: 'Welcome to Mumbai airport',
    text: (app) => {
      const c = app.counts
      const date = app.day === 2 ? '17 November 2026' : '16 November 2026'
      return 'This is a replay of a real day, ' + date + (c ? ': ' + c.flights.toLocaleString('en-IN') + ' flights (' + c.arrivals + ' arrivals and '
        + c.departures + ' departures), which make ' + c.stays + ' aircraft stays on a stand' : '') + '. Every aircraft parks exactly where the Java planner put it.'
    }
  },
  {
    sel: '.dock', title: 'Move through the day',
    text: 'Press play, pick a speed, or drag the timeline to any time. The purple curve is how many stands are busy. View moves the camera: a terminal, the runway, or free roam.'
  },
  {
    area: worldArea, title: 'Click any aircraft',
    text: 'Its boarding pass opens on the right: where it parks, when, and in plain words why the planner chose that stand. Close it to get the side panel back. Drag to turn the view, scroll to zoom.'
  },
  {
    sel: '.tabs button:nth-child(2)', tab: 'lab', place: 'left', title: 'Scenario lab: break the plan on purpose',
    text: 'Replay a scenario: one click runs a storm, a closed pier or a rush, and you see every aircraft that moved and why. Right now: delay, cancel or close stands at the current time. A good first try: "Greedy trap".'
  },
  {
    sel: '.tabs button:nth-child(3)', tab: 'algos', place: 'left', title: 'The algorithms behind it',
    text: 'All six syllabus units, each with its live data structure and how long it took on this plan. The green pill at the top is the result: stands used, proven to be the fewest possible. Open this guide again from Guide.'
  }
]


export default function Tour() {
  const app = useApp()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = STEPS[i]

  useEffect(() => { if (app.tour) setI(0) }, [app.tour])

  useEffect(() => {
    if (!app.tour) return
    if (step.tab) { app.setPanel(true); app.setTab(step.tab) }
    if (i === 1) clock.set({ playing: false })
  }, [app.tour, i]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!app.tour) return undefined
    const measure = () => {
      if (step.area) { setRect(step.area()); return }
      const el = step.sel && document.querySelector(step.sel)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      const pad = step.pad || 6
      setRect({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 })
    }
    measure()
    const t = setTimeout(measure, 350)
    const t2 = setTimeout(measure, 750)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('resize', measure) }
  }, [app.tour, i]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => app.setTour(false)
  useEffect(() => {
    if (!app.tour) return undefined
    const key = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight' || e.key === 'Enter') setI((x) => Math.min(STEPS.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [app.tour]) // eslint-disable-line react-hooks/exhaustive-deps

  // where the card goes: below the target if there is room, otherwise above; centred when there is no target
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const W = 340
  let pos = { left: vw / 2 - W / 2, top: vh / 2 - 110 }
  if (rect) {
    const below = rect.y + rect.h + 14
    const top = below + 200 < vh ? below : Math.max(14, rect.y - 214)
    const left = Math.min(vw - W - 14, Math.max(14, rect.x + rect.w / 2 - W / 2))
    pos = { left, top: rect.h > vh * 0.6 ? vh / 2 - 100 : top }
    if (step.place === 'left') pos = { left: Math.max(14, rect.x - W - 18), top: rect.y + 8 }
  }
  const last = i === STEPS.length - 1
  return (
    <AnimatePresence>
      {app.tour && (
        <motion.div className="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {rect ? (
            <div className="tour-hole" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
          ) : <div className="tour-dim" />}
          <motion.div key={i} className="tour-card" style={{ left: pos.left, top: pos.top, width: W }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="tour-k">Guide · {i + 1} of {STEPS.length}</div>
            <h3>{step.title}</h3>
            <p>{typeof step.text === 'function' ? step.text(app) : step.text}</p>
            <div className="tour-dots">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
            <div className="tour-nav">
              <button className="btn ghost sm" onClick={close}>Skip guide</button>
              <span />
              {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}><Ico n="arrowLeft" size={13} />Back</button>}
              <button className="btn primary sm" onClick={() => (last ? close() : setI(i + 1))}>
                {last ? 'Start exploring' : 'Next'}{!last && <Ico n="arrowRight" size={13} />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
