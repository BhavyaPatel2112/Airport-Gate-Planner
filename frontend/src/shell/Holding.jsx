import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { clock, useClockMinute, hhmm } from '../state/clock'
import { tailColour } from '../scene/lighting'
import Ico from './icons'

/** The holding stack: flights circling because no stand is free, and the way to fix it. */
export default function Holding() {
  const app = useApp()
  const minute = useClockMinute()
  const [open, setOpen] = useState(true)
  const plan = app.plan
  if (!plan || !plan.stats.unplaced || app.selected) return null
  const isUp = (v) => v.arrival && minute >= v.start - 13 && minute <= Math.max(v.end, v.start + 60)
  const stranded = plan.visits.filter((v) => !v.stand && !v.cancelled).sort((a, b) => a.start - b.start)
  const circling = stranded.filter(isUp)
  // circling now first, then the next ones still to come, then the rest
  const shown = [...circling, ...stranded.filter((v) => !isUp(v) && v.start > minute), ...stranded.filter((v) => !isUp(v) && v.start <= minute)]
  const go = (v) => {
    if (!isUp(v)) clock.set({ minute: Math.max(0, v.start - 6), playing: false })
    app.select(v.id)
    app.flyTo({ target: [-660, 0, 680], offset: [-260, 520, 760] })
  }
  return (
    <AnimatePresence>
      <motion.div className={'holding glass' + (app.rightOpen ? ' with-panel' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}>
        <button className="hold-h" onClick={() => setOpen(!open)}>
          <span className="hold-ico"><Ico n="rush" size={14} /></span>
          <div>
            <b>Holding stack</b>
            <span>{circling.length ? circling.length + ' circling now · ' : ''}{plan.stats.unplaced} without a stand today</span>
          </div>
          <Ico n="chevronDown" size={14} className={'chev' + (open ? ' up' : '')} />
        </button>
        {open && (
          <>
            <div className="hold-list">
              {shown.slice(0, 6).map((v) => {
                const up = isUp(v)
                return (
                  <button key={v.id} className={'hold-row' + (app.selected === v.id ? ' on' : '') + (up ? ' up' : '')} onClick={() => go(v)}
                    title={up ? 'Circling now: open its boarding pass' : 'Jump to ' + hhmm(v.start) + ' to see it circle'}>
                    <span className="hold-lvl num">{up ? 'L' + (circling.indexOf(v) % 6 + 1) : hhmm(v.start)}</span>
                    <i style={{ background: tailColour(v.airlineCode) }} />
                    <b>{v.label.split(' / ')[0]}</b>
                    <em>{up ? 'circling now' : v.start > minute ? 'arrives later' : 'earlier today'}{v.arrival ? ' · from ' + v.arrival.city : ''}</em>
                  </button>
                )
              })}
              {shown.length > 6 && <div className="hold-more">and {shown.length - 6} more</div>}
            </div>
            <div className="hold-actions">
              {app.fixedVersion === plan.version ? (
                <span className="hold-note">Already fixed: these {plan.stats.unplaced} cannot fit within 8 hours and would divert.</span>
              ) : (
                <button className="btn primary sm" disabled={app.busy} onClick={() => app.fixEverything()}
                  title={'Re-plan every flight from ' + hhmm(minute) + ' together'}>
                  <Ico n="sparkle" size={13} />Fix everything
                </button>
              )}
              <button className="btn sm" disabled={app.busy} onClick={() => app.resetScenario()} title="Remove all disruptions">
                <Ico n="reset" size={13} />Clear all
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
