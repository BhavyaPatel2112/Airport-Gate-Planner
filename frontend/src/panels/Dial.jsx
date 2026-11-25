import { useRef } from 'react'

// Rotary dial: drag up or down, or use the mouse wheel.
export default function Dial({ value, min, max, onChange, label, unit }) {
  const start = useRef(null)
  const k = (value - min) / (max - min)
  const angle = -135 + k * 270
  function down(e) {
    start.current = { y: e.clientY, v: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function move(e) {
    if (!start.current) return
    const dv = Math.round((start.current.y - e.clientY) / 3)
    onChange(Math.max(min, Math.min(max, start.current.v + dv)))
  }
  function up() {
    start.current = null
  }
  return (
    <div className="dial" onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onWheel={(e) => onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? 1 : -1))))}>
      <svg viewBox="-50 -50 100 100">
        {Array.from({ length: 28 }).map((_, i) => {
          const a = ((-135 + (i * 270) / 27 - 90) * Math.PI) / 180
          const on = i / 27 <= k
          return <line key={i} x1={Math.cos(a) * 38} y1={Math.sin(a) * 38} x2={Math.cos(a) * 45} y2={Math.sin(a) * 45}
            stroke={on ? '#ffb020' : '#3a4250'} strokeWidth="2.2" />
        })}
        <circle r="31" fill="url(#knob)" stroke="#0b0e13" strokeWidth="2" />
        <defs>
          <radialGradient id="knob" cx="35%" cy="30%">
            <stop offset="0" stopColor="#5d6573" />
            <stop offset="1" stopColor="#1c2028" />
          </radialGradient>
        </defs>
        <g transform={'rotate(' + angle + ')'}>
          <rect x="-2" y="-29" width="4" height="13" rx="2" fill="#ffcc00" />
        </g>
      </svg>
      <div className="dial-val mono">{unit === 'p' ? 'p' + value : value}</div>
      <div className="dial-label">{label}</div>
    </div>
  )
}
