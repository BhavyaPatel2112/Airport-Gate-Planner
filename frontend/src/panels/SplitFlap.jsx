import { memo, useEffect, useRef, useState } from 'react'
import { clack } from './sound'

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:+->.'

function FlapChar({ ch, sound }) {
  const [shown, setShown] = useState(ch)
  const [flipping, setFlipping] = useState(false)
  const target = useRef(ch)
  useEffect(() => {
    if (ch === target.current) return undefined
    target.current = ch
    let steps = 3 + Math.floor(Math.random() * 3)
    setFlipping(true)
    const id = setInterval(() => {
      steps--
      if (steps <= 0) {
        clearInterval(id)
        setShown(target.current)
        setFlipping(false)
        if (sound) clack()
      } else {
        setShown(CHARS[Math.floor(Math.random() * CHARS.length)])
      }
    }, 55)
    return () => clearInterval(id)
  }, [ch, sound])
  return <span className={'flap' + (flipping ? ' flip' : '')}>{shown === ' ' ? ' ' : shown}</span>
}

function SplitFlap({ text, width, className, sound }) {
  const s = (text || '').toUpperCase().padEnd(width, ' ').slice(0, width)
  return (
    <span className={'flaps ' + (className || '')}>
      {s.split('').map((c, i) => <FlapChar key={i} ch={c} sound={sound} />)}
    </span>
  )
}

export default memo(SplitFlap)
