import { useApp } from '../state/app'
import { useClockMinute, hhmm } from '../state/clock'
import Ico from './icons'

const DAYS = { 1: 'Mon 16 Nov 2026', 2: 'Tue 17 Nov 2026' }

export default function TopBar() {
  const app = useApp()
  const m = useClockMinute()
  const plan = app.plan
  const proven = plan && plan.certificate && plan.certificate.optimal
  return (
    <header className="topbar glass">
      <div className="tb-left">
        <button className="brand" onClick={() => app.goHome()} title="Back to the start page">
          <span className="brand-mark"><Ico n="plane" size={15} fill /></span>
          <span className="brand-name">Gate Planner</span>
        </button>
        <div className="sg">
          {[1, 2].map((d) => (
            <button key={d} className={app.day === d ? 'on' : ''} onClick={() => app.day !== d && app.setDay(d)} disabled={app.busy}>
              {d === 1 ? '16 Nov' : '17 Nov'}
            </button>
          ))}
        </div>
      </div>

      <div className="loc">
        <span className="loc-badge">BOM</span>
        <div className="loc-text">
          <div className="loc-name">Mumbai · Chhatrapati Shivaji Maharaj Intl</div>
          <div className="loc-sub"><span className="live" />{DAYS[app.day]} · <b className="num">{hhmm(m)}</b> IST</div>
        </div>
      </div>

      <div className="tb-right">
        {plan && (
          <div className={'status-pill ' + (plan.stats.unplaced ? 'bad' : proven ? 'ok' : 'neutral')}
            title="Stands used compared with the busiest moment of the day">
            <i />
            {plan.stats.unplaced
              ? plan.stats.unplaced + ' flights without a stand'
              : plan.stats.standsUsed + ' stands used' + (proven ? ' · proven minimum' : '')}
          </div>
        )}
        <button className={'btn ghost icon' + (app.sound ? ' on' : '')} onClick={() => app.setSound(!app.sound)}
          title={app.sound ? 'Mute gate change announcements' : 'Turn on gate change announcements'}>
          <Ico n={app.sound ? 'sound' : 'mute'} />
        </button>
        <button className="btn ghost tb-guide" onClick={() => app.setTour(true)} title="How to use this simulation"><Ico n="help" />Guide</button>
        <button className="btn ghost" onClick={() => app.openStory()}><Ico n="story" />Story</button>
        <button className={'btn ghost icon' + (app.panel ? ' on' : '')} onClick={() => app.setPanel(!app.panel)} title="Show or hide the side panel">
          <Ico n="layers" />
        </button>
      </div>
    </header>
  )
}
