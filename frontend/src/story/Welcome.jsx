import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Ico from '../shell/icons'
import { Globe } from './globe'
import './story.css'

export default function Welcome({ onStory, onSkip }) {
  const host = useRef(null)
  useEffect(() => {
    const g = new Globe(host.current, { labels: false })
    g.addCity('BOM', 19.09, 72.87, null)
    g.camera.position.set(0, 120, 420)
    g.camTarget.set(0, 60, 330)
    g.lookTarget.set(0, 10, 0)
    // start with India facing the camera, then drift slowly
    g.spin = 3.25
    g.root.rotation.y = g.spin
    g.autoSpin = 0.025
    g.setOffset(-0.24)
    return () => g.dispose()
  }, [])

  return (
    <motion.div className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="story-gl" ref={host} />
      <div className="welcome-shade" />
      <header className="story-top">
        <div className="brand">
          <span className="brand-mark"><Ico n="plane" size={15} fill /></span>
          <span className="brand-name">Gate Planner</span>
        </div>
      </header>
      <motion.main className="welcome-main" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
        <div className="w-eyebrow"><span className="w-code">BOM</span>Chhatrapati Shivaji Maharaj International Airport, Mumbai</div>
        <h1>Where should every<br />aircraft park?</h1>
        <p>A stand planner for Mumbai airport, run on real flights from 16 and 17 November 2026. It finds the fewest stands
          the day needs, proves it, and repairs the plan when storms, closures and delays hit.</p>
        <div className="w-actions">
          <button className="btn primary big" onClick={onStory}><Ico n="plane" size={16} fill />Board the story flight</button>
          <button className="btn big" onClick={onSkip}>Go straight to the airport<Ico n="arrowRight" size={15} /></button>
        </div>
        <div className="w-hint">About three minutes. You can skip it at any time.</div>
      </motion.main>
    </motion.div>
  )
}
