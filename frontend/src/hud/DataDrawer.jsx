import { useApp } from '../state/app'

export default function DataDrawer() {
  const app = useApp()
  const p = app.plan
  return (
    <div className="data-drawer">
      <section>
        <h3>Where the data comes from</h3>
        <table className="kv">
          <tbody>
            <tr><td>Flights</td><td>Real. AeroDataBox airport arrivals and departures for VABB, 16 and 17 November 2026
              (837 and 871 rows; 835 and 847 flights once duplicate rows are merged): flight number, airline, aircraft model, registration, terminal, scheduled and actual
              times. Saved as CSV; the demo needs no internet.</td><td><span className="chip ok">real</span></td></tr>
            <tr><td>Delays</td><td>Real. Actual time minus scheduled time from the same data.</td><td><span className="chip ok">real</span></td></tr>
            <tr><td>Stands</td><td>71 of the 136 stand ids were observed as gates in the flight data; the rest complete the layout (remote
              aprons). Positions are drawn to match the X-shaped Terminal 2 and Terminal 1. Each stand is labelled observed or assumed.</td>
              <td><span className="chip warn">partly assumed</span></td></tr>
            <tr><td>Notices</td><td>24 sample notices in the official format (for example VABB STAND 45A2 CLSD 0100-0500). You can add,
              preview and withdraw notices live.</td><td><span className="chip">sample</span></td></tr>
            <tr><td>Rush hour</td><td>Extra arrivals are simulated (copied from real airline and size mix, seeded) and labelled RUSH.</td>
              <td><span className="chip warn">simulated</span></td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h3>Assumptions</h3>
        <ul>
          <li>An arrival and a departure with the same registration 25 minutes to 10 hours apart, at the same terminal, are one stand visit.</li>
          <li>Otherwise a standard turnaround: 45 minutes narrow-body, 90 minutes wide-body.</li>
          <li>Wide-body aircraft (A330, A340, A350, A380, B777, B787, B747) need wide stands. International flights need international stands; domestic flights use domestic stands. Each flight stays at its own terminal.</li>
          <li>Each visit is followed by a buffer: the airline's real departure delay at the chosen percentile, 0 to 60 minutes. The default is the 75th percentile: departure times in the data are close to take-off, so they include taxi-out, and at the 90th percentile every airline already exceeds the 60 minute cap.</li>
          <li>Runway closures, towing, walking distance and airline preferences are outside the model. Full gate assignment with preferences is NP-hard (see the Lab).</li>
          <li>Airline names: QP is shown as Akasa Air and S5 as Star Air (the data source lists older legal names).</li>
        </ul>
      </section>
      {p && (
        <section>
          <h3>This plan</h3>
          <div className="stat-grid">
            <div><b>{p.stats.visits}</b><span>stand visits</span></div>
            <div><b>{p.stats.placed}</b><span>on a stand</span></div>
            <div><b>{p.stats.unplaced}</b><span>without a stand</span></div>
            <div><b>{p.stats.cancelled}</b><span>cancelled</span></div>
            <div><b>{p.bufferPercentile}th</b><span>buffer percentile</span></div>
            <div><b>{p.closures.length}</b><span>active closures</span></div>
          </div>
          {p.certificate && (
            <table className="race-table">
              <thead><tr><th>Stand class</th><th>Visits</th><th>Busiest moment</th><th>Stands used</th><th>Available</th><th>Tight</th></tr></thead>
              <tbody>
                {p.certificate.classes.map((c) => (
                  <tr key={c.key}><td>{c.label}</td><td>{c.visits}</td><td>{c.peak}</td><td>{c.standsUsed}</td><td>{c.standsAvailable}</td>
                    <td className={c.tight ? 'ok' : 'bad'}>{c.tight ? 'yes' : 'no'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {p.warnings.length > 0 && (
            <details><summary>{p.warnings.length} data warnings</summary><ul>{p.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
          )}
        </section>
      )}
    </div>
  )
}
