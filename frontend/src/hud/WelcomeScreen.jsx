import { motion } from 'framer-motion'
import { Icon } from './icons'

export default function WelcomeScreen({ onStart }) {
  return (
    <motion.div className="welcome" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.6 }}>
      <div className="welcome-bg">
        <div className="runway-lines" />
        <div className="glow" />
      </div>
      <div className="welcome-inner">
        <div className="arrivals-sign">
          <span className="arrow">↓</span>
          <span>ARRIVALS</span>
          <span className="sep" />
          <Icon.plane width={20} height={20} />
          <span>BAGGAGE</span>
          <span className="sep" />
          <span>TRANSFERS</span>
          <span className="arrow">→</span>
        </div>
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          Welcome to Mumbai
        </motion.h1>
        <div className="airport-name">Chhatrapati Shivaji Maharaj International Airport</div>
        <div className="welcome-cards">
          <div><b>1,682</b><span>real flights on 16 and 17 November 2026</span></div>
          <div><b>136</b><span>stands across Terminal 1, Terminal 2 and remote aprons</span></div>
          <div><b>14</b><span>algorithms from all six syllabus units, all running in Java</span></div>
        </div>
        <motion.button className="start-btn" onClick={onStart} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          Start shift
        </motion.button>
        <div className="welcome-foot">
          Stand planning and disruption recovery for the operations control centre · Advanced Algorithm, CIA 3 ·
          Bhavya Patel and Tanushree · flight data: AeroDataBox
        </div>
      </div>
    </motion.div>
  )
}
