import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import OverviewTab from './OverviewTab'
import ScenarioLab from './ScenarioLab'
import AlgorithmsTab from './AlgorithmsTab'
import FlightsTab from './FlightsTab'
import Ico from './icons'

const TABS = [
  ['overview', 'Overview', 'chart'],
  ['lab', 'Scenario lab', 'lab'],
  ['algos', 'Algorithms', 'algo'],
  ['flights', 'Flights', 'flights']
]

const HINTS = {
  overview: 'The result of the plan: how many stands it needs, and the proof that no plan can use fewer.',
  lab: 'Pick a scenario card to break the plan and watch it repaired, or switch to Right now to act at the current time.',
  algos: 'Open any algorithm to see its live data structure and how long it took on this plan.',
  flights: 'Search any flight, airline or city. The departures board follows the clock.'
}

/** A one-line hint the first time each tab is opened. */
function TabHint({ tab }) {
  const app = useApp()
  const key = 'gp-hint-' + tab
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(key) === '1' } catch { return true }
  })
  if (seen || app.tour || !HINTS[tab]) return null
  const done = () => {
    try { localStorage.setItem(key, '1') } catch { /* private mode */ }
    setSeen(true)
  }
  return (
    <div className="tab-hint"><p>{HINTS[tab]}</p><button onClick={done}>Got it</button></div>
  )
}

export default function OpsPanel() {
  const app = useApp()
  return (
    <AnimatePresence>
      {app.panel && (
        <motion.aside className="ops glass" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
          <nav className="tabs">
            {TABS.map(([k, label, icon]) => (
              <button key={k} className={app.tab === k ? 'on' : ''} onClick={() => app.setTab(k)}>
                <Ico n={icon} size={14} /><span>{label}</span>
                {k === 'lab' && app.scenario.steps.length > 0 && <em className="num">{app.scenario.steps.length}</em>}
              </button>
            ))}
          </nav>
          <div className="ops-body">
            <TabHint key={app.tab} tab={app.tab} />
            {app.tab === 'overview' && <OverviewTab />}
            {app.tab === 'lab' && <ScenarioLab />}
            {app.tab === 'algos' && <AlgorithmsTab />}
            {app.tab === 'flights' && <FlightsTab />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
