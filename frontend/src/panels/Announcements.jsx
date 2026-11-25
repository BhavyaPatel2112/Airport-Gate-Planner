import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../state/app'
import { clock } from '../state/clock'
import { chime } from './sound'

function spell(number) {
  // "AI 2927" is read as "A I 2927"; "41A" as "41 A"
  const [code, digits] = number.split(' ')
  return code.split('').join(' ') + ' ' + (digits || '')
}

function gate(id) {
  return id.replace(/([0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([0-9])/g, '$1 $2')
}

export default function Announcements() {
  const app = useApp()
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    const op = app.lastOp
    if (!op || !app.plan) return undefined
    const now = clock.get().minute
    const moves = op.events.filter((e) => e.type === 'MOVE' && app.visitsById[e.flight]
      && app.visitsById[e.flight].departure && app.visitsById[e.flight].end > now)
    if (!moves.length) return undefined
    const e = moves[0]
    const v = app.visitsById[e.flight]
    const dep = v.departure
    const text = 'Attention please. Flight ' + dep.number + ' to ' + (dep.city || dep.iata) + ' will now depart from gate '
      + e.toStand + '.'
    const spoken = 'Attention please. Flight ' + spell(dep.number) + ' to ' + (dep.city || dep.iata)
      + ' will now depart from gate ' + gate(e.toStand) + '.'
    setBanner({ text, more: moves.length - 1, id: op.seq })
    if (app.sound) {
      chime()
      if ('speechSynthesis' in window) {
        setTimeout(() => {
          const u = new SpeechSynthesisUtterance(spoken)
          const voices = window.speechSynthesis.getVoices()
          const indian = voices.find((x) => x.lang === 'en-IN') || voices.find((x) => x.lang.startsWith('en'))
          if (indian) u.voice = indian
          u.rate = 0.92
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(u)
        }, 1300)
      }
    }
    const t = setTimeout(() => setBanner(null), 7000)
    return () => clearTimeout(t)
  }, [app.lastOp]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="announce-wrap">
    <AnimatePresence>
      {banner && (
        <motion.div key={banner.id} className="announce" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}>
          <span className="announce-icon">🔊</span>
          <span>{banner.text}</span>
          {banner.more > 0 && <span className="announce-more">+{banner.more} more gate changes</span>}
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}
