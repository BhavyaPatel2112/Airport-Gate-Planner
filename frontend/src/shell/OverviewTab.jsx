import { useApp } from '../state/app'
import { useClockMinute, hhmm } from '../state/clock'
import Ico from './icons'

function Bars({ cert }) {
  if (!cert) return null
  const rows = cert.classes.filter((c) => c.visits > 0)
  const max = Math.max(...rows.map((c) => c.standsAvailable), 1)
  return (
    <div className="class-bars">
      {rows.map((c) => (
        <div key={c.key} className="cb-row">
          <div className="cb-label">{c.label.replace('international', 'Intl').replace('domestic', 'Dom').replace('-body', '')}</div>
          <div className="cb-track">
            <div className="cb-avail" style={{ width: (c.standsAvailable / max) * 100 + '%' }} />
            <div className={'cb-used' + (c.tight ? ' tight' : '')} style={{ width: (c.standsUsed / max) * 100 + '%' }} />
            <div className="cb-peak" style={{ left: (c.peak / max) * 100 + '%' }} title={'Busiest moment: ' + c.peak} />
          </div>
          <div className="cb-num num">{c.standsUsed}<span>/{c.standsAvailable}</span></div>
        </div>
      ))}
      <div className="cb-key"><span><i className="k-used" />stands used</span><span><i className="k-peak" />busiest moment</span><span><i className="k-avail" />available</span></div>
    </div>
  )
}

export default function OverviewTab() {
  const app = useApp()
  const minute = useClockMinute()
  const plan = app.plan
  if (!plan) return <div className="empty">Building the plan…</div>
  const s = plan.stats
  const c = app.counts
  const cert = plan.certificate
  const busyNow = app.occupancy ? app.occupancy[Math.min(1439, minute)] : null
  const unplaced = plan.visits.filter((v) => v.status === 'UNPLACED')
  const closuresNow = plan.closures.filter((c) => c.from <= minute && minute < c.to)
  const closedStands = new Set(closuresNow.map((c) => c.standId)).size
  const last = app.lastOp && app.lastOp.kind !== 'plan' && app.lastOp.kind !== 'view' ? app.lastOp : null
  return (
    <div className="tab-body">
      <section className="hero-stat">
        <div className="hs-main">
          <div className="hs-num num">{s.standsUsed}</div>
          <div className="hs-label">stands used<br /><span>of {s.standsAvailable} at the airport</span></div>
        </div>
        <div className={'proof ' + (cert && cert.optimal ? 'ok' : 'warn')}>
          <Ico n={cert && cert.optimal ? 'check' : 'info'} size={14} />
          <div>
            <b>{cert && cert.optimal ? 'Fewest possible, proven.' : 'Changed by recovery.'}</b>{' '}
            {cert && cert.optimal
              ? 'In every stand class the stands used equal the busiest moment, so no plan can use fewer.'
              : 'After a disruption the plan is repaired, not rebuilt, so the minimum proof no longer applies.'}
          </div>
        </div>
      </section>

      <section className="kpis">
        <div><span>Flights today<em>{c ? c.arrivals + ' in, ' + c.departures + ' out, ' + s.visits + ' aircraft stays' : ''}</em></span><b className="num">{c ? c.flights : '-'}</b></div>
        <div className={s.unplaced ? 'bad' : ''}><span>Without a stand<em>aircraft waiting</em></span><b className="num">{s.unplaced}</b></div>
        <div><span>Busy right now</span><b className="num">{busyNow ?? '-'}</b></div>
        <div><span>Jet bridge share</span><b className="num">{Math.round((100 * s.contactPlaced) / Math.max(1, s.placed))}%</b></div>
      </section>

      {last && (
        <section className="card note">
          <div className="card-k"><Ico n="sparkle" size={13} />Last change</div>
          <p>{last.summary}</p>
        </section>
      )}

      {unplaced.length > 0 && (
        <section className="card danger">
          <div className="card-k"><Ico n="alert" size={13} />Why {unplaced.length === 1 ? 'one flight has' : unplaced.length + ' flights have'} no stand</div>
          <p>{unplaced[0].reason}</p>
          <div className="chips">
            {unplaced.slice(0, 8).map((v) => (
              <button key={v.id} className="chip" onClick={() => app.select(v.id)}>{v.label}</button>
            ))}
            {unplaced.length > 8 && <span className="chip muted">+{unplaced.length - 8}</span>}
          </div>
        </section>
      )}

      {closedStands > 0 && (
        <section className="card warn">
          <div className="card-k"><Ico n="closed" size={13} />{closedStands} stands closed at {hhmm(minute)}</div>
        </section>
      )}

      <section className="block">
        <div className="block-h">Stands per class <span>proof of the minimum</span></div>
        <Bars cert={cert} />
      </section>

      <section className="block">
        <div className="block-h">How the plan was made</div>
        <ol className="steps">
          <li><b>Sort</b> every stand visit by its start minute (counting sort).</li>
          <li><b>Assign</b> each one to the compatible stand that frees up first (Fibonacci heap).</li>
          <li><b>Record</b> it in that stand's interval tree and the busy-stand segment tree.</li>
          <li><b>Prove</b> the stand count is minimal: it equals the busiest moment.</li>
          <li><b>Repair</b> disruptions with maximum matching; the minimum cut explains any shortage.</li>
        </ol>
      </section>

      <section className="block">
        <div className="block-h">Delay buffer</div>
        <p className="muted-p">Every visit keeps a safety gap after it equal to its airline's real departure delay at the
          <b> {plan.bufferPercentile}th percentile</b> (randomized Quickselect), capped at 60 minutes. Change it in the Scenario lab.</p>
      </section>
    </div>
  )
}
