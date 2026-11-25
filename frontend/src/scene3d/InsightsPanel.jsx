import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { useClockMinute, hhmm } from '../state/clock'

// "Overall analytics": planner insights written by the Java backend (certificate, last change,
// min-cut reasons, busiest window) plus live tiles. The panel only displays them.

function ago(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  return s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'
}

function Spark({ data, minute }) {
  if (!data) return null
  let peak = 1
  for (const v of data) peak = Math.max(peak, v)
  const pts = []
  for (let m = 0; m < 1440; m += 8) pts.push((m / 1440) * 300 + ',' + (58 - (data[m] / peak) * 52).toFixed(1))
  const x = (Math.min(1439, minute) / 1440) * 300
  return (
    <svg viewBox="0 0 300 62" className="spark">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a7a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff5a7a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={'M0,60 L' + pts.join(' L') + ' L300,60 Z'} fill="url(#sparkFill)" />
      <path d={'M' + pts.join(' L')} fill="none" stroke="#ff5a7a" strokeWidth="1.4" />
      <line x1={x} x2={x} y1="0" y2="62" stroke="#fdfaf7" strokeOpacity="0.6" strokeDasharray="2 2" />
      <circle cx={x} cy={58 - (data[Math.min(1439, minute)] / peak) * 52} r="3" fill="#fdfaf7" />
    </svg>
  )
}

export default function InsightsPanel({ onClose }) {
  const app = useApp()
  const minute = useClockMinute()
  const [tab, setTab] = useState('overview')
  const [open, setOpen] = useState(true)
  const [occ, setOcc] = useState(null)
  const [busiest, setBusiest] = useState(null)
  const [, tick] = useState(0)
  const plan = app.plan
  const planId = plan && plan.planId
  const version = plan && plan.version

  useEffect(() => {
    if (!planId) return undefined
    let live = true
    Promise.all([api.occupancy(planId), api.busiest(planId, 60)]).then(([o, b]) => {
      if (live) {
        setOcc(o.minutes)
        setBusiest(b)
      }
    }).catch(() => {})
    return () => { live = false }
  }, [planId, version])

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10000)
    return () => clearInterval(t)
  }, [])

  if (!plan) return null
  const cert = plan.certificate
  const unplaced = plan.visits.filter((v) => v.status === 'UNPLACED')
  const closuresNow = plan.closures.filter((c) => c.from <= minute && minute < c.to).length
  const op = app.lastOp
  const insights = [
    {
      icon: cert && cert.optimal ? 'ok' : 'warn', title: cert && cert.optimal ? 'Fewest stands, proven' : 'Plan changed by recovery',
      text: cert ? cert.statement : '', when: op ? ago(op.at) : ''
    },
    op && op.kind !== 'plan' && op.kind !== 'view' && {
      icon: 'info', title: 'Last change', text: op.summary, when: ago(op.at)
    },
    {
      icon: unplaced.length ? 'bad' : 'ok', title: unplaced.length ? 'Shortage explained (minimum cut)' : 'Every arrival has a stand',
      text: unplaced.length ? unplaced[0].reason : 'No flight is waiting. If stands close or traffic grows, the minimum cut will say exactly which flights cannot fit and why.',
      more: unplaced.length > 1 ? '+' + (unplaced.length - 1) + ' more without a stand' : ''
    },
    busiest && {
      icon: 'info', title: 'Busiest hour', text: busiest.from + ' to ' + busiest.to + ': on average ' + busiest.averageBusy
        + ' stands busy, peak ' + busiest.peakBusy + '. Found with segment tree range sums.'
    },
    {
      icon: 'info', title: 'Delay buffers', text: 'Each stand visit keeps a buffer equal to its airline\'s real departure delay at the '
        + plan.bufferPercentile + 'th percentile (randomized Quickselect, seed 42), up to 60 minutes.'
    }
  ].filter(Boolean)

  return (
    <motion.aside className="g-panel" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}>
      <div className="gp-head">
        <span>Overall analytics</span>
        <span className="gp-chip">Today ▾</span>
        <button className="gp-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="gp-sub">
        <button className="gp-subhead" onClick={() => setOpen(!open)}>
          <span>Stand planning · {app.day === 1 ? '16 Nov' : '17 Nov'}</span>
          <span className="gp-chip">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <>
            <div className="gp-tabs">
              <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
              <button className={tab === 'classes' ? 'on' : ''} onClick={() => setTab('classes')}>Stand classes</button>
            </div>
            {tab === 'overview' ? (
              <div className="gp-body">
                <div className="gp-title"><span className="gp-icon">✦</span>Planner insights <span className="gp-time">updated {hhmm(minute)}</span></div>
                <div className="gp-insights">
                  {insights.map((i, k) => (
                    <div key={k} className="gp-insight">
                      <div className="gi-head"><i className={'gi-dot ' + i.icon} />{i.title}{i.when && <span className="gp-time">{i.when}</span>}</div>
                      <div className="gi-text">{i.text}</div>
                      {i.more && <div className="gi-more">{i.more}</div>}
                    </div>
                  ))}
                </div>
                <div className="gp-label">General</div>
                <div className="gp-tiles">
                  <div><span><i className="gi-dot info" />Stands busy now</span><b>{occ ? occ[Math.min(1439, minute)] : '-'}</b></div>
                  <div><span><i className="gi-dot warn" />Peak busy</span><b>{cert ? cert.busiestMoment : '-'}</b></div>
                  <div><span><i className="gi-dot ok" />On a stand</span><b>{plan.stats.placed}</b></div>
                  <div><span><i className="gi-dot bad" />Without a stand</span><b>{plan.stats.unplaced}</b></div>
                  <div><span><i className="gi-dot info" />Jet bridge share</span><b>{Math.round((100 * plan.stats.contactPlaced) / Math.max(1, plan.stats.placed))}%</b></div>
                  <div><span><i className="gi-dot warn" />Closures now</span><b>{closuresNow}</b></div>
                </div>
                <div className="gp-label">Stands busy over the day <span className="gp-time">segment tree</span></div>
                <Spark data={occ} minute={minute} />
              </div>
            ) : (
              <div className="gp-body">
                <table className="gp-table">
                  <thead><tr><th>Class</th><th>Peak</th><th>Used</th><th>Of</th><th /></tr></thead>
                  <tbody>
                    {cert && cert.classes.filter((c) => c.visits > 0).map((c) => (
                      <tr key={c.key}>
                        <td>{c.label.replace('international', 'intl').replace('domestic', 'dom')}</td>
                        <td>{c.peak}</td><td>{c.standsUsed}</td><td>{c.standsAvailable}</td>
                        <td><i className={'gi-dot ' + (c.tight ? 'ok' : 'warn')} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="gi-text" style={{ marginTop: 10 }}>
                  Green: stands used equal the busiest moment of that class, so no plan can use fewer. Computed in Java with a
                  segment tree per class.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.aside>
  )
}
