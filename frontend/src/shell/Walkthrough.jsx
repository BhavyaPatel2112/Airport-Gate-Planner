import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import Ico from './icons'

/**
 * After "Fix everything": a guided replay of the Java re-plan, one algorithm per step (counting sort, an
 * augmenting path, interval tree queries, a whole window as max flow, a minimum cut, holding). The text and
 * numbers come from the backend; this card only draws them, and each step tows, lands or holds exactly the
 * flights that step fixes, so the airport goes from broken to fixed one step at a time.
 */
export default function Walkthrough() {
  const app = useApp()
  const w = app.walk
  const [auto, setAuto] = useState(false)
  const [more, setMore] = useState(false)
  const timer = useRef(0)
  const total = w ? w.steps.length : 0
  const i = w ? Math.min(w.i, total - 1) : 0
  const step = w && total ? w.steps[i] : null

  useEffect(() => {
    if (w && step) app.showStep(w, i)
  }, [w && w.id, i]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Play by itself": long enough on each step to read it
  useEffect(() => {
    clearTimeout(timer.current)
    if (!w || !auto || !step || i >= total - 1) return undefined
    const words = [step.lead || '', ...(step.points || []), ...(more ? step.text : [])].join(' ').split(/\s+/).length
    timer.current = setTimeout(() => app.setWalk({ ...w, i: i + 1 }), Math.max(9000, words * 260 + 3000))
    return () => clearTimeout(timer.current)
  }, [w && w.id, i, auto]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!w || !step) return null
  const go = (k) => app.setWalk({ ...w, i: Math.max(0, Math.min(total - 1, k)) })
  const done = () => app.endWalk()
  const last = i === total - 1
  const summary = step.kind === 'summary'
  return (
    <AnimatePresence>
      <motion.div className="walk glass" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
        <div className="walk-top">
          <span className="walk-k"><Ico n="sparkle" size={12} />Fixing the plan · {i + 1} of {total}</span>
          <label className="walk-auto"><input type="checkbox" checked={auto} onChange={() => setAuto(!auto)} />Play by itself</label>
        </div>
        <div className="walk-bar"><i style={{ width: ((i + 1) / total) * 100 + '%' }} /></div>
        <AnimatePresence mode="wait">
          <motion.div key={i} className="walk-body" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
            <span className={'walk-tag k-' + step.kind}>{step.tag}</span>
            <h3>{step.title}</h3>
            {step.path && (
              <div className="walk-path">
                {step.path.map((n, k) => (
                  <span key={k} className="wp-node">
                    {k > 0 && <Ico n="arrowRight" size={12} />}
                    <b className={n.kind === 'stand' ? 'wp-stand' : 'wp-flight' + (k === 0 ? ' first' : '')}>{n.label}</b>
                  </span>
                ))}
              </div>
            )}
            {step.ba && (
              <div className="walk-ba">
                <div><span>Before</span><b className="bad">{step.ba.before}</b><em>{step.ba.beforeSub}</em></div>
                <Ico n="arrowRight" size={16} />
                <div><span>Now</span><b className="ok">{step.ba.after}</b><em>{step.ba.afterSub}</em></div>
              </div>
            )}
            {step.lead && <div className={'walk-lead' + (summary ? ' big' : '')}>{step.lead}</div>}
            {step.facts.length > 0 && <Facts facts={step.facts} big={summary} />}
            {step.points && step.points.length > 0 && (
              <ul className="walk-points">{step.points.map((p, k) => <li key={k}>{p}</li>)}</ul>
            )}
            {step.marks && step.marks.length > 0 && <Legend marks={step.marks} />}
            <button className="walk-more" onClick={() => setMore(!more)}>
              {more ? 'Hide the full reasoning' : 'Full reasoning'}<Ico n={more ? 'chevronUp' : 'chevronDown'} size={12} />
            </button>
            {more && <div className="walk-full">{step.text.map((p, k) => <p key={k}>{p}</p>)}</div>}
          </motion.div>
        </AnimatePresence>
        <div className="walk-nav">
          <button className="btn ghost sm" onClick={done}>{last ? 'Close' : 'Skip'}</button>
          <span />
          {i > 0 && <button className="btn sm" onClick={() => go(i - 1)}><Ico n="arrowLeft" size={13} />Back</button>}
          {!last && <button className="btn primary sm" onClick={() => go(i + 1)}>Next<Ico n="arrowRight" size={13} /></button>}
          {last && <button className="btn primary sm" onClick={done}>Done</button>}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function Facts({ facts, big }) {
  return (
    <div className={'walk-sum' + (big ? ' big' : '')}>
      {facts.map(([v, l], k) => <div key={k}><b className="num">{v}</b><span>{l}</span></div>)}
    </div>
  )
}

const TONE_LABELS = { chosen: 'chosen stand', free: 'free (an edge)', busy: 'busy', closed: 'closed', cut: 'N(S), the only stands S can use' }

function Legend({ marks }) {
  const tones = [...new Set(marks.map((m) => m.tone))]
  return (
    <div className="walk-legend">
      {tones.map((t) => <span key={t}><i className={'t-' + t} />{TONE_LABELS[t] || t}</span>)}
    </div>
  )
}
