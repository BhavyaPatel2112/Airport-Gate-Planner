// Tiny Web Audio helpers: airport chime and split-flap clack. Only used when sound is switched on.
let ctx = null

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = AC ? new AC() : null
  }
  return ctx
}

export function chime() {
  const a = audio()
  if (!a) return
  const notes = [[659.25, 0], [523.25, 0.42], [392, 0.84]]
  for (const [f, t] of notes) {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, a.currentTime + t)
    g.gain.linearRampToValueAtTime(0.18, a.currentTime + t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + t + 1.1)
    o.connect(g).connect(a.destination)
    o.start(a.currentTime + t)
    o.stop(a.currentTime + t + 1.2)
  }
}

let lastClack = 0
export function clack() {
  const a = audio()
  if (!a || performance.now() - lastClack < 60) return
  lastClack = performance.now()
  const len = Math.floor(a.sampleRate * 0.025)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const src = a.createBufferSource()
  const g = a.createGain()
  g.gain.value = 0.08
  src.buffer = buf
  src.connect(g).connect(a.destination)
  src.start()
}
