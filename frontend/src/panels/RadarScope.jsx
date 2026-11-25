import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { useClockMinute, hhmm } from '../state/clock'

export default function RadarScope() {
  const app = useApp()
  const minute = useClockMinute(3)
  const [data, setData] = useState(null)
  const last = useRef(0)
  const planId = app.plan && app.plan.planId
  const seq = app.lastOp && app.lastOp.seq

  useEffect(() => {
    if (!planId) return undefined
    const wait = Math.max(0, 1200 - (performance.now() - last.current))
    const t = setTimeout(() => {
      last.current = performance.now()
      api.radar(planId, minute).then(setData).catch(() => {})
    }, wait)
    return () => clearTimeout(t)
  }, [planId, minute, seq])

  const R = 92
  const holding = data ? data.holding : []
  const overflow = holding.length > 5
  return (
    <div className="panel radar">
      <div className="panel-head">
        <div className="panel-title"><span className="pict">R</span>Stand availability radar</div>
        <div className="spacer" />
        {data && <span className={'chip' + (holding.length ? ' bad' : ' ok')}>holding stack {holding.length}</span>}
      </div>
      <div className="radar-body">
        <div className="scope">
          <svg viewBox="-100 -100 200 200">
            <defs>
              <radialGradient id="scopeBg">
                <stop offset="0" stopColor="#06301f" />
                <stop offset="1" stopColor="#021208" />
              </radialGradient>
            </defs>
            <circle r={R + 4} fill="url(#scopeBg)" stroke="#1d6b45" strokeWidth="1.5" />
            {[0.25, 0.5, 0.75, 1].map((k) => <circle key={k} r={R * k} fill="none" stroke="#1f7a4f" strokeOpacity="0.6" strokeWidth="0.6" />)}
            <line x1={-R} x2={R} y1="0" y2="0" stroke="#1f7a4f" strokeOpacity="0.5" strokeWidth="0.5" />
            <line y1={-R} y2={R} x1="0" x2="0" stroke="#1f7a4f" strokeOpacity="0.5" strokeWidth="0.5" />
            {['15', '30', '45', '60'].map((t, i) => (
              <text key={t} x="2" y={-R * (i + 1) / 4 + 6} fontSize="5" fill="#3ddc84" opacity="0.7">{t}m</text>
            ))}
            <g className="sweep">
              <path d={'M0 0 L' + R + ' 0 A' + R + ' ' + R + ' 0 0 0 ' + (R * Math.cos(-0.6)) + ' ' + (R * Math.sin(-0.6)) + ' Z'}
                fill="url(#sweepGrad)" />
              <defs>
                <linearGradient id="sweepGrad" x1="1" y1="0.5" x2="0.5" y2="0">
                  <stop offset="0" stopColor="#3ddc84" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#3ddc84" stopOpacity="0" />
                </linearGradient>
              </defs>
            </g>
            {data && data.blips.map((b) => {
              const r = (b.eta / 60) * R
              const a = ((b.bearing - 90) * Math.PI) / 180
              const x = r * Math.cos(a)
              const y = r * Math.sin(a)
              return (
                <g key={b.visit} className="blip" onClick={() => app.select(b.visit)}>
                  <circle cx={x} cy={y} r={b.size === 'WIDE' ? 2.8 : 2} fill={b.stand ? '#7dffb6' : '#ff4d4d'} />
                  <text x={x + 3.5} y={y - 2} fontSize="4.6" fill={b.stand ? '#9dffc8' : '#ff9d9d'}>{b.label}</text>
                </g>
              )
            })}
            {data && data.pulses.slice(-3).map((p, i) => (
              <g key={p.stand + i}>
                <circle r="10" fill="none" stroke="#ffcc00" strokeWidth="1.2" className="pulse-ring" />
                <text y="22" textAnchor="middle" fontSize="5.5" fill="#ffcc00">decrease-key {p.stand}</text>
              </g>
            ))}
            <circle r="2.5" fill="#3ddc84" />
          </svg>
          <div className="scope-label mono">BOM {hhmm(minute)} · 60 min ring</div>
        </div>
        <div className="radar-lists">
          <div className="rl-title">Next free stands</div>
          <div className="rl-list">
            {data && data.nextFree.slice(0, 6).map((s) => (
              <div key={s.stand} className="rl-row">
                <span className="mono st">{s.stand}</span>
                <span className="cls">{s.class.replace('narrow-body', 'NB').replace('wide-body', 'WB').replace('international', 'intl').replace('domestic', 'dom')}</span>
                <span className="mono t">{s.freeAt <= minute ? 'now' : hhmm(s.freeAt)}</span>
              </div>
            ))}
          </div>
          <div className={'rl-title' + (overflow ? ' alert' : '')}>
            Holding stack {overflow ? '· OVERFLOW' : ''}
          </div>
          <div className="rl-list hold">
            {holding.length === 0 && <div className="rl-empty">Every arrival has a stand.</div>}
            {holding.slice(0, 12).map((h, i) => (
              <div key={h.visit} className="rl-row hold" title={h.reason} onClick={() => app.select(h.visit)}>
                <span className="mono idx">{i + 1}</span>
                <span className="mono st">{h.label}</span>
                <span className="mono t">{hhmm(h.start)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
