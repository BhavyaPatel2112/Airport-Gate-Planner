import { useEffect, useRef, useState } from 'react'

// Monsoon effects: rain streaks on a canvas, lightning flashes and the alert banner.

export default function Weather({ active, severity, reducedMotion }) {
  const canvas = useRef(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!active || reducedMotion) return undefined
    const c = canvas.current
    const ctx = c.getContext('2d')
    let raf = 0
    const drops = []
    const count = 260 + Math.round((severity - 50) * 6)
    function resize() {
      c.width = c.clientWidth
      c.height = c.clientHeight
    }
    resize()
    for (let i = 0; i < count; i++) {
      drops.push({ x: Math.random() * c.width, y: Math.random() * c.height, l: 10 + Math.random() * 18, v: 9 + Math.random() * 9 })
    }
    function draw() {
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.strokeStyle = 'rgba(190, 210, 235, 0.42)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const d of drops) {
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.l * 0.25, d.y + d.l)
        d.y += d.v
        d.x -= d.v * 0.25
        if (d.y > c.height) {
          d.y = -20
          d.x = Math.random() * (c.width + 100)
        }
      }
      ctx.stroke()
      raf = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [active, severity, reducedMotion])

  useEffect(() => {
    if (!active || reducedMotion) return undefined
    let alive = true
    let timer = 0
    function next() {
      timer = setTimeout(() => {
        if (!alive) return
        setFlash(true)
        setTimeout(() => setFlash(false), 120)
        setTimeout(() => alive && setFlash(true), 220)
        setTimeout(() => alive && setFlash(false), 300)
        next()
      }, 2500 + Math.random() * 5000)
    }
    next()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [active, reducedMotion])

  if (!active) return null
  return (
    <>
      <canvas ref={canvas} className="rain" />
      <div className={'lightning' + (flash ? ' on' : '')} />
      <div className="monsoon-banner">
        <span className="pulse-dot" /> MONSOON ALERT · heavy rain over Mumbai · severity p{severity}
      </div>
    </>
  )
}
