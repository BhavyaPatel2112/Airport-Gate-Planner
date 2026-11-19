import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useApp } from '../state/app'

export default function XRayStrip() {
  const app = useApp()
  const [open, setOpen] = useState(null)
  const items = app.traceLog
  return (
    <div className="xray panel">
      <div className="xray-label">
        <div className="panel-title"><span className="pict">X</span>Algorithm X-ray</div>
        <div className="xray-hint">Every step the backend ran, newest first. Click a card for the proof.</div>
      </div>
      <div className="xray-cards">
        {items.length === 0 && <div className="empty-note">Build a plan to see the algorithms at work.</div>}
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.button layout key={t.key} className={'xcard' + (open === t.key ? ' open' : '')}
              initial={{ opacity: 0, x: -30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }} onClick={() => setOpen(open === t.key ? null : t.key)} title={t.proof}>
              <div className="xc-top">
                <span className={'unit-badge u' + t.unit}>U{t.unit}</span>
                <span className="xc-algo">{t.algorithm}</span>
              </div>
              <div className="xc-op">{t.operation}</div>
              <div className="xc-meta mono">
                <span>n = {t.inputSize.toLocaleString()}</span>
                <span>{t.timeMs < 1 ? t.timeMs.toFixed(3) : t.timeMs.toFixed(1)} ms</span>
                <span className="cx">{t.complexity}</span>
              </div>
              {open === t.key && <div className="xc-proof">{t.proof}</div>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
