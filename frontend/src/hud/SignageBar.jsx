import { useApp } from '../state/app'
import { useClockMinute, hhmm } from '../state/clock'
import { Icon } from './icons'
import './hud.css'

function BigClock() {
  const m = useClockMinute()
  return (
    <div className="big-clock">
      <span className="digits">{hhmm(m)}</span>
      <span className="tz">IST</span>
    </div>
  )
}

export default function SignageBar() {
  const app = useApp()
  const plan = app.plan
  const cert = plan && plan.certificate
  const unplaced = plan ? plan.stats.unplaced : 0
  return (
    <header className="signage">
      <div className="brand">
        <div className="brand-pict"><Icon.plane width={22} height={22} /></div>
        <div>
          <div className="brand-name">MUMBAI AIRPORT, LIVE</div>
          <div className="brand-sub">CSMIA · VABB / BOM · stand planning control</div>
        </div>
      </div>
      <div className="day-toggle" role="tablist" aria-label="Day">
        {[[1, 'MON 16 NOV'], [2, 'TUE 17 NOV']].map(([d, label]) => (
          <button key={d} className={app.day === d ? 'on' : ''} onClick={() => app.setDay(d)} disabled={app.busy}>{label}</button>
        ))}
      </div>
      <BigClock />
      {cert && (
        <div className={'opt-badge ' + (cert.optimal ? 'ok' : unplaced > 0 ? 'warn' : 'info')} title={cert.statement}>
          {cert.optimal ? <Icon.check /> : <Icon.alert />}
          <div>
            <div className="opt-main">
              PEAK {cert.sumOfPeaks} {cert.optimal ? '=' : '·'} STANDS USED {cert.standsUsed}
            </div>
            <div className="opt-sub">
              {cert.optimal ? 'Fewest stands, proven per stand class'
                : unplaced > 0 ? unplaced + ' without a stand: shortage proven by min-cut'
                  : 'Every flight placed; recovery used extra stands'}
            </div>
          </div>
        </div>
      )}
      {plan && (
        <div className="sig-stats">
          <div><b>{plan.stats.placed}</b><span>on stand</span></div>
          <div><b>{plan.stats.standsUsed}/{plan.stats.standsAvailable}</b><span>stands</span></div>
          <div><b>{Math.round((100 * plan.stats.contactPlaced) / Math.max(1, plan.stats.placed))}%</b><span>jet bridge</span></div>
        </div>
      )}
      <div className="spacer" />
      <div className="sig-actions">
        <button className={'sig-btn story' + (app.story ? ' on' : '')} onClick={() => app.setStory(!app.story)} disabled={!plan}>
          <Icon.story /> <span>{app.story ? 'STOP STORY' : 'PLAY THE DAY'}</span>
        </button>
        <button className="sig-btn" title="Greedy versus matching" onClick={() => app.setDrawer('race')} disabled={!plan}><Icon.race /> <span className="lbl">RACE</span></button>
        <button className="sig-btn" onClick={() => app.setDrawer('lab')}><Icon.lab /> <span className="lbl">LAB</span></button>
        <button className="sig-btn" onClick={() => app.setDrawer('finder')} disabled={!plan}><Icon.search /> <span className="lbl">FIND</span></button>
        <button className="sig-btn" onClick={() => app.setDrawer('data')}><Icon.data /> <span className="lbl">DATA</span></button>
        <button className={'sig-icon' + (app.sound ? ' on' : '')} title={app.sound ? 'Sound on' : 'Sound off'}
          onClick={() => app.setSound(!app.sound)}>{app.sound ? <Icon.sound /> : <Icon.mute />}</button>
        <button className={'sig-icon' + (app.reducedMotion ? ' on' : '')} title="Reduced motion"
          onClick={() => app.setReducedMotion(!app.reducedMotion)}><Icon.motion /></button>
      </div>
    </header>
  )
}
