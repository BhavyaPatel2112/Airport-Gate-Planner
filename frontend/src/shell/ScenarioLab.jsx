import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { hhmm, useClockMinute } from '../state/clock'
import { tailColour } from '../scene/lighting'
import { STEP_TYPES, PRESETS, STAND_GROUPS, TAXIWAYS, newStep, totals, noChangeWhy } from './scenario'
import Ico from './icons'
import { DeskInline } from './Overlays'

const toMin = (s) => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function TimeField({ value, onChange }) {
  return <input className="inp time" type="time" step="300" value={hhmm(value)} onChange={(e) => e.target.value && onChange(toMin(e.target.value))} />
}

function FlightField({ value, onChange }) {
  const app = useApp()
  const minute = useClockMinute()
  const v = app.visitsById[value] || (app.plan && app.plan.visits.find((x) => x.label.split(' / ').includes(value)))
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [open, setOpen] = useState(false)
  const timer = useRef(0)
  const search = (text) => {
    setQ(text)
    clearTimeout(timer.current)
    if (text.trim().length < 2) { setRes(null); return }
    timer.current = setTimeout(() => {
      api.search(app.day, text.trim()).then((r) => { setRes(r); setOpen(true) }).catch(() => setRes(null))
    }, 160)
  }
  // with nothing typed, suggest the aircraft on a stand at the current clock time
  const onStand = (app.plan ? app.plan.visits : []).filter((x) => x.stand && !x.cancelled && x.start <= minute && minute < x.end).slice(0, 8)
  const pick = (id) => { onChange(id); setQ(''); setOpen(false); setRes(null) }
  const picking = app.picking
  return (
    <div className="flight-field">
      <div className="ff-chosen">
        {v ? (
          <span className="ff-tag"><i style={{ background: tailColour(v.airlineCode) }} /><b>{v.label}</b><em>{v.airline}{v.stand ? ' · stand ' + v.stand : ''}</em></span>
        ) : <span className="ff-tag empty">No flight chosen yet</span>}
      </div>
      <div className="ff-row">
        <input className="inp" value={q} placeholder="Search a flight number or city" onChange={(e) => search(e.target.value)}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} />
        <button className={'btn sm' + (picking ? ' on' : '')} onClick={() => (picking ? app.cancelPick() : app.startPick((id) => onChange(id)))}
          title="Click an aircraft in the 3D view to choose it">
          <Ico n="pin" size={13} />{picking ? 'Click a plane…' : 'Pick on map'}
        </button>
      </div>
      {open && (
        <div className="ff-list glass">
          {res ? (
            <>
              <div className="ff-meta">Trie search: {res.trieMs} ms · scanning every flight: {res.linearScanMs} ms</div>
              {res.results.slice(0, 7).map((r) => (
                <button key={r.visit} onMouseDown={() => pick(r.visit)}>
                  <b>{r.label}</b><span>{r.airline} · {r.city}</span><em>{r.type === 'TURN' ? 'turnaround' : r.type === 'ARR' ? 'arrival' : 'departure'}</em>
                </button>
              ))}
              {res.results.length === 0 && <div className="ff-none">No flight matches</div>}
            </>
          ) : (
            <>
              <div className="ff-meta">On a stand at {hhmm(minute)}, or type to search</div>
              {onStand.map((x) => (
                <button key={x.id} onMouseDown={() => pick(x.id)}>
                  <b>{x.label}</b><span>{x.airline}</span><em>stand {x.stand}</em>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ f, params, set }) {
  const [key, kind, label, min, max] = f
  const v = params[key]
  let input = null
  if (kind === 'time') input = <TimeField value={v} onChange={(x) => set(key, x)} />
  else if (kind === 'range') {
    input = (
      <div className="range-row">
        <input type="range" min={min} max={max} value={v} onChange={(e) => set(key, Number(e.target.value))} />
        <span className="num range-val">{v}</span>
      </div>
    )
  } else if (kind === 'seed') {
    input = (
      <div className="seed-box">
        <div className="stepper">
          <button onClick={() => set(key, Math.max(1, v - 1))} aria-label="Previous pattern">−</button>
          <span className="num">{v}</span>
          <button onClick={() => set(key, Math.min(999, v + 1))} aria-label="Next pattern">+</button>
        </div>
        <button className="btn sm" onClick={() => set(key, 1 + Math.floor(Math.random() * 999))}>Shuffle</button>
        <span className="field-hint">The seed picks which flights the random disruption hits. The same number always gives the same result, so a run can be repeated; change it for a different pattern.</span>
      </div>
    )
  } else if (kind === 'number') {
    input = <input className="inp num" type="number" min={min} max={max} value={v} onChange={(e) => set(key, Number(e.target.value) || min)} />
  } else if (kind === 'flight') input = <FlightField value={v} onChange={(x) => set(key, x)} />
  else if (kind === 'taxiway') {
    input = (
      <div className="sg wrap">
        {TAXIWAYS.map((t) => <button key={t} className={v === t ? 'on' : ''} onClick={() => set(key, t)}>{t}</button>)}
      </div>
    )
  } else if (kind === 'size') {
    input = (
      <div className="sg">
        <button className={v === 'WIDE' ? 'on' : ''} onClick={() => set(key, 'WIDE')}>Wide-body</button>
        <button className={v === 'NARROW' ? 'on' : ''} onClick={() => set(key, 'NARROW')}>Narrow-body</button>
      </div>
    )
  } else if (kind === 'groups') {
    input = (
      <div className="group-list">
        {STAND_GROUPS.map((g) => {
          const on = v.includes(g.key)
          return (
            <button key={g.key} className={'group-item' + (on ? ' on' : '')}
              onClick={() => set(key, on ? v.filter((x) => x !== g.key) : [...v, g.key])}>
              <i className="tick">{on && <Ico n="check" size={11} />}</i>
              <span className="gi-name">{g.name}</span>
              <span className="gi-meta">{g.count} · {g.note}</span>
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <label className={'field' + (kind === 'groups' ? ' full' : '')}>
      <span className="field-l">{label}</span>
      {input}
    </label>
  )
}

function StepCard({ step, index, open, onToggle, onChange, onRemove, result }) {
  const T = STEP_TYPES[step.type]
  // keep time windows running forwards: moving the start past the end pushes the end along
  const set = (k, v) => {
    const p = { ...step.params, [k]: v }
    if (k === 'from' && p.to != null && p.to <= v) p.to = Math.min(1439, v + 120)
    if (k === 'to' && p.from != null && v <= p.from) p.from = Math.max(0, v - 60)
    onChange({ ...step, params: p })
  }
  return (
    <motion.div layout className={'step' + (open ? ' open' : '') + (result && result.error ? ' err' : '')}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="step-head" onClick={onToggle}>
        <span className="step-n num">{index + 1}</span>
        <span className={'step-ico t-' + step.type}><Ico n={T.icon} size={15} /></span>
        <div className="step-text">
          <b>{T.title}</b>
          <span>{T.summary(step.params)}</span>
        </div>
        <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); onRemove() }} title="Remove"><Ico n="trash" size={14} /></button>
        <Ico n="chevronDown" size={14} className={'chev' + (open ? ' up' : '')} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="step-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <p className="step-blurb">{T.blurb}</p>
            <div className="fields">
              {T.fields.map((f) => <Field key={f[0]} f={f} params={step.params} set={set} />)}
            </div>
            {T.notice && <div className="notice-preview mono">{T.notice(step.params).slice(0, 120)}{T.notice(step.params).length > 120 ? '…' : ''}</div>}
            <div className="algo-chips">{T.algorithms.map((a) => <span key={a} className="achip">{a}</span>)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Every flight the repair touched, in plain words, each one a link to the aircraft on the map. */
function Changes({ results, steps }) {
  const app = useApp()
  const [all, setAll] = useState(false)
  const [kind, setKind] = useState('moved')
  const rows = []
  results.forEach((r, i) => {
    if (i === 0) return
    const step = steps.find((x) => x.key === r.key)
    for (const e of r.events || []) {
      if (e.type === 'MOVE' || (e.type === 'UNPLACED' && e.flight)) rows.push({ ...e, step: step ? STEP_TYPES[step.type].title : '' })
    }
  })
  const moved = rows.filter((r) => r.type === 'MOVE').length
  const lost = rows.filter((r) => r.type === 'UNPLACED').length
  const list = rows.filter((r) => (kind === 'lost' ? r.type === 'UNPLACED' : r.type === 'MOVE'))
  const shown = all ? list : list.slice(0, 8)
  if (!rows.length) {
    const reasons = results.slice(1).map((r) => noChangeWhy(steps.find((x) => x.key === r.key), r, results[0] && results[0].stats)).filter(Boolean)
    return (
      <div className="chg-empty">
        <b>No aircraft had to change stand.</b>
        {reasons.map((t, i) => <p key={i}>{t}</p>)}
      </div>
    )
  }
  return (
    <div className="chg">
      <div className="chg-sum">
        <button className={'chg-pill ok' + (kind === 'moved' ? ' on' : '')} onClick={() => { setKind('moved'); setAll(false) }}>
          <b className="num">{moved}</b> moved to a new stand</button>
        <button className={'chg-pill ' + (lost ? 'bad' : 'ok') + (kind === 'lost' ? ' on' : '')} onClick={() => { setKind('lost'); setAll(false) }}>
          <b className="num">{lost}</b> left without a stand</button>
      </div>
      <p className="chg-hint">Pick a list above. On the map a moved aircraft sits on a <i className="dot g" /> green ring with its old and new
        stand; flights with no stand circle in the holding stack. Click a row to go to that aircraft.</p>
      <div className="chg-list">
        {shown.map((e, i) => {
          const v = app.visitsById[e.flight]
          return (
            <button key={i} className={'chg-row ' + (e.type === 'MOVE' ? 'mv' : 'lost')} title={e.reason}
              onClick={() => app.showChange(e.flight, e.toStand || e.fromStand)}>
              <span className="chg-f">{v ? v.label.split(' / ')[0] : e.flight}</span>
              <span className="chg-st num">
                {e.fromStand || '?'}<Ico n="arrowRight" size={11} />{e.type === 'MOVE' ? e.toStand : 'holding'}
              </span>
              <span className="chg-t num">{e.time != null ? hhmm(e.time) : ''}</span>
            </button>
          )
        })}
      </div>
      {list.length === 0 && <div className="chg-empty">{kind === 'lost' ? 'Every affected flight got a stand.' : 'No aircraft had to move.'}</div>}
      {list.length > 8 && <button className="link-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show all ' + list.length}</button>}
    </div>
  )
}

/** The two repair methods in two lines each. */
function MethodBrief({ method }) {
  return (
    <div className="brief">
      {method === 'greedy' ? (
        <div><b>Greedy first-fit</b><span>Takes flights one by one and gives each the first free stand. Fast, but it can use up the only
          stand a later flight could take.</span></div>
      ) : (
        <div><b>Maximum matching</b><span>Looks at every affected flight together and finds the largest set that can all get a stand at
          once (Edmonds-Karp max flow, unit 5).</span></div>
      )}
    </div>
  )
}

function Compare({ cmp, shown, onShow }) {
  const app = useApp()
  const a = totals(cmp.matching.results)
  const b = totals(cmp.greedy.results)
  const rows = [['On a stand', a.placed, b.placed, true], ['Without a stand', a.unplaced, b.unplaced, false],
    ['Flights moved', a.moved, b.moved, false], ['Stands in use', a.standsUsed, b.standsUsed, false]]
  const diff = b.unplaced - a.unplaced
  // flights that only greedy failed to place
  const mPlaced = new Set(cmp.matching.view.visits.filter((v) => v.stand).map((v) => v.id))
  const strandedByGreedy = cmp.greedy.view.visits.filter((v) => !v.stand && !v.cancelled && mPlaced.has(v.id))
  return (
    <div className="compare">
      <div className="cmp-verdict">
        {diff > 0 ? <><b>Matching placed {diff} more {diff === 1 ? 'flight' : 'flights'}</b> than greedy first-fit on the same scenario.</>
          : diff < 0 ? <><b>Greedy did better on this run</b>, which can happen across windows: matching is optimal inside each window, not across the whole day.</>
            : a.unplaced === 0 ? <><b>Both methods placed every flight.</b> Make it harder (close more stands, add flights) to see them differ.</>
              : <><b>Both left the same {a.unplaced} flights without a stand.</b> The shortage is real: the minimum cut shows there are not enough compatible stands at those times.</>}
      </div>
      <div className="cmp-show">
        <span>Show on the map</span>
        <div className="sg">
          <button className={shown !== 'greedy' ? 'on' : ''} onClick={() => onShow('matching')}>Maximum matching</button>
          <button className={shown === 'greedy' ? 'on' : ''} onClick={() => onShow('greedy')}>Greedy first-fit</button>
        </div>
      </div>
      <table className="cmp-table">
        <thead><tr><th /><th>Maximum matching</th><th>Greedy first-fit</th></tr></thead>
        <tbody>
          {rows.map(([label, x, y, high]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className={'num' + (x !== y && (high ? x > y : x < y) ? ' win' : '')}>{x}</td>
              <td className={'num' + (x !== y && (high ? y > x : y < x) ? ' win' : '')}>{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {strandedByGreedy.length > 0 && (
        <div className="cmp-stranded">
          <div className="cmp-st-h">Only greedy left these without a stand</div>
          {strandedByGreedy.slice(0, 6).map((v) => (
            <button key={v.id} className="chg-row lost" onClick={() => { onShow('greedy'); setTimeout(() => app.showChange(v.id, v.originalStand), 50) }}>
              <span className="chg-f">{v.label.split(' / ')[0]}</span>
              <span className="chg-st num">{v.originalStand}<Ico n="arrowRight" size={11} />holding</span>
              <span className="chg-t num">{hhmm(v.start)}</span>
            </button>
          ))}
        </div>
      )}
      <MethodBrief method={shown === 'greedy' ? 'greedy' : 'matching'} />
      <div className="cmp-note">Switch the map between the two: aircraft tow to the stands each method chose.</div>
    </div>
  )
}

export default function ScenarioLab() {
  const app = useApp()
  const sc = app.scenario
  const [openKey, setOpenKey] = useState(null)
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState(false)
  const [active, setActive] = useState(null)
  const minuteNow = useClockMinute(5)
  const steps = sc.steps
  const setSteps = (s) => { app.setScenario({ steps: s, dirty: true }); setActive(null) }
  const add = (type) => {
    const st = newStep(type)
    setSteps([...steps, st])
    setOpenKey(st.key)
    setAdding(false)
  }
  const runPreset = (p) => {
    const st = p.steps.map((x) => newStep(x.type, x.params))
    app.setScenario({ steps: st, dirty: false })
    setActive(p.name)
    setOpenKey(null)
    if (p.compare) app.compareScenario(st)
    else app.runScenario(st)
  }
  const resultsByKey = {}
  for (const r of sc.results || []) resultsByKey[r.key] = r
  const preset = PRESETS.find((p) => p.name === active)

  const mode = app.labMode
  const modeSwitch = (
    <div className="sg full lab-mode">
      <button className={mode === 'replay' ? 'on' : ''} onClick={() => app.setLabMode('replay')}><Ico n="play" size={12} fill />Replay a scenario</button>
      <button className={mode === 'now' ? 'on' : ''} onClick={() => app.setLabMode('now')}><Ico n="bolt" size={13} />Right now</button>
    </div>
  )
  if (mode === 'now') {
    return (
      <div className="tab-body lab">
        {modeSwitch}
        <p className="lab-intro">Act like the operations controller: each button changes the plan on screen straight away, at the
          current clock time ({hhmm(minuteNow)}). Choose a flight or stands in the first row
          instead of typing them.</p>
        <DeskInline />
      </div>
    )
  }

  return (
    <div className="tab-body lab">
      {modeSwitch}
      <p className="lab-intro">Break the plan on purpose and watch the Java planner repair it. Pick a scenario: it runs at once, the clock
        jumps to the moment it happens, and every aircraft that has to move tows to its new stand.</p>

      <section className="block">
        <div className="block-h">1 · Pick a scenario</div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.name} className={'preset' + (active === p.name ? ' on' : '')} disabled={sc.running} onClick={() => runPreset(p)}>
              <b>{p.name}{p.compare && <em className="tagc">compares</em>}</b><span>{p.text}</span>
            </button>
          ))}
        </div>
      </section>

      {sc.running && <div className="lab-running"><span className="spin" />Solving in Java… {sc.progress > 0 ? 'step ' + sc.progress + ' of ' + steps.length : 'building the plan'}</div>}

      {sc.results && !sc.running && (
        <section className="block result-block">
          <div className="block-h">2 · What changed {sc.dirty && <span className="stale">settings changed, run again</span>}</div>
          {preset && preset.explain && <p className="lab-explain">{preset.explain}</p>}
          <Changes results={sc.results} steps={steps} />
          {app.plan && app.fixedVersion === app.plan.version ? (
            <div className="fix-bar done">
              <div><b>Fixed{app.plan.stats.unplaced ? '' : ': every flight has a stand'}</b>
                <span>{app.plan.stats.unplaced ? app.plan.stats.unplaced + ' flights cannot fit within 8 hours and would divert. ' : ''}
                  Nothing new has gone wrong since, so there is nothing more to fix.</span></div>
              <div className="fix-btns">
                <button className="btn sm" onClick={() => app.replayFix()}><Ico n="play" size={12} fill />Replay the fix</button>
                <button className="btn sm" disabled={app.busy} onClick={() => { setActive(null); app.resetScenario() }}><Ico n="reset" size={13} />Clear disruptions</button>
              </div>
            </div>
          ) : app.plan && app.plan.stats.unplaced > 0 ? (
            <div className="fix-bar">
              <div><b>Make it right again</b><span>Fix everything re-plans every flight from the current clock time together. Any flight that still has no stand waits until the earliest stand frees up. You will be shown each change and why.</span></div>
              <div className="fix-btns">
                <button className="btn primary sm" disabled={app.busy} onClick={() => app.fixEverything()}><Ico n="sparkle" size={13} />Fix everything</button>
                <button className="btn sm" disabled={app.busy} onClick={() => { setActive(null); app.resetScenario() }}><Ico n="reset" size={13} />Clear disruptions</button>
              </div>
            </div>
          ) : (
            <div className="fix-bar done">
              <div><b>Nothing to fix</b><span>Every flight has a stand after this scenario. Clear the disruptions to go back to the clean plan.</span></div>
              <div className="fix-btns">
                <button className="btn sm" disabled={app.busy} onClick={() => { setActive(null); app.resetScenario() }}><Ico n="reset" size={13} />Clear disruptions</button>
              </div>
            </div>
          )}
          <div className="mini-results">
            {sc.results.slice(1).map((r) => {
              const step = steps.find((x) => x.key === r.key)
              const T = step && STEP_TYPES[step.type]
              return (
                <button key={r.key} className={'res' + (r.error ? ' err' : '')} onClick={() => app.jumpToResult(r)}>
                  <span className={'step-ico t-' + (step ? step.type : 'x')}>{T && <Ico n={T.icon} size={13} />}</span>
                  <div className="res-main">
                    <div className="res-t">{T ? T.title : 'Step'}{r.at != null && <em className="num">{hhmm(r.at)}</em>}</div>
                    <div className="res-s">{r.error ? r.error : r.summary}</div>
                    {noChangeWhy(step, r, sc.results[0] && sc.results[0].stats) && (
                      <div className="res-why"><b>Why nothing moved:</b> {noChangeWhy(step, r, sc.results[0] && sc.results[0].stats)}</div>
                    )}
                  </div>
                  <Ico n="arrowRight" size={13} />
                </button>
              )
            })}
          </div>
        </section>
      )}

      {sc.compare && !sc.running && (
        <section className="block">
          <div className="block-h">3 · Matching versus greedy</div>
          <Compare cmp={sc.compare} shown={sc.shown} onShow={(w) => app.showCompare(w)} />
        </section>
      )}

      <section className="block">
        <button className="block-h toggle" onClick={() => setCustom(!custom)}>
          Build your own scenario <span>{steps.length ? steps.length + ' disruptions' : ''}</span>
          <Ico n="chevronDown" size={14} className={'chev' + (custom ? ' up' : '')} />
        </button>
        {custom && (
          <div className="custom">
            <div className="field">
              <span className="field-l">Safety gap after each visit <em className="num">p{sc.buffer}</em></span>
              <div className="range-row">
                <input type="range" min="50" max="99" value={sc.buffer} onChange={(e) => app.setScenario({ buffer: Number(e.target.value), dirty: true })} />
              </div>
              <span className="field-hint">The gap is each airline's real delay at this percentile. Higher: fewer clashes after delays, but more stands needed.</span>
            </div>
            <div className="field">
              <span className="field-l">How disruptions are repaired</span>
              <div className="sg full">
                <button className={sc.recovery === 'matching' ? 'on' : ''} onClick={() => app.setScenario({ recovery: 'matching', dirty: true })}>Maximum matching</button>
                <button className={sc.recovery === 'greedy' ? 'on' : ''} onClick={() => app.setScenario({ recovery: 'greedy', dirty: true })}>Greedy first-fit</button>
              </div>
              <MethodBrief method={sc.recovery} />
            </div>
            <div className="step-list">
              <AnimatePresence initial={false}>
                {steps.map((s, i) => (
                  <StepCard key={s.key} step={s} index={i} open={openKey === s.key} result={resultsByKey[s.key]}
                    onToggle={() => setOpenKey(openKey === s.key ? null : s.key)}
                    onChange={(n) => setSteps(steps.map((x) => (x.key === s.key ? n : x)))}
                    onRemove={() => setSteps(steps.filter((x) => x.key !== s.key))} />
                ))}
              </AnimatePresence>
            </div>
            {!adding ? (
              <button className="add-btn" onClick={() => setAdding(true)}><Ico n="plus" size={14} />Add a disruption</button>
            ) : (
              <div className="type-grid">
                {Object.entries(STEP_TYPES).map(([k, T]) => (
                  <button key={k} className="type-tile" onClick={() => add(k)}>
                    <span className={'step-ico t-' + k}><Ico n={T.icon} size={15} /></span>
                    <b>{T.title}</b>
                  </button>
                ))}
                <button className="type-tile cancel" onClick={() => setAdding(false)}><Ico n="close" size={14} /><b>Close</b></button>
              </div>
            )}
            <div className="run-bar">
              <button className="btn primary grow" disabled={sc.running || !steps.length} onClick={() => app.runScenario()}>
                <Ico n="bolt" size={15} />{sc.running ? 'Solving…' : 'Run scenario'}
              </button>
              <button className="btn" disabled={sc.running || !steps.length} onClick={() => app.compareScenario()} title="Run the same scenario with both repair methods">
                <Ico n="compare" size={15} />Compare
              </button>
              <button className="btn ghost icon" disabled={sc.running} onClick={() => { setActive(null); app.resetScenario() }} title="Clear and rebuild the clean plan">
                <Ico n="reset" size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {(sc.results || steps.length > 0) && !custom && (
        <button className="btn ghost reset-line" disabled={sc.running} onClick={() => { setActive(null); app.resetScenario() }}>
          <Ico n="reset" size={14} />Back to the clean plan
        </button>
      )}
    </div>
  )
}
