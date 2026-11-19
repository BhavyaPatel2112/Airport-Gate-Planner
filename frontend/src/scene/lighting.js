// Sky colours, darkness and sun direction from the replay clock (display only).

const KEYS = [
  // minute, sky top, sky horizon, darkness 0..1
  [0, '#050914', '#0d1830', 0.62],
  [300, '#060b18', '#14203d', 0.6],
  [345, '#1a1f45', '#6b4a6e', 0.45],
  [375, '#3c3f78', '#f08a5d', 0.28],
  [405, '#4d7cc0', '#f7b98a', 0.12],
  [480, '#3f86d8', '#a9d1f0', 0.02],
  [720, '#2f7fe0', '#bfe0fb', 0],
  [960, '#3a86d6', '#cde3f5', 0.02],
  [1065, '#4a6fb8', '#f5c27c', 0.1],
  [1110, '#3a3f7a', '#f07a4a', 0.25],
  [1150, '#20244f', '#a24d62', 0.42],
  [1200, '#0b1028', '#2a2b55', 0.56],
  [1260, '#060a18', '#111b36', 0.62],
  [1440, '#050914', '#0d1830', 0.62]
]

function hex(c) {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(a, b, k) {
  const x = hex(a)
  const y = hex(b)
  const r = x.map((v, i) => Math.round(v + (y[i] - v) * k))
  return 'rgb(' + r.join(',') + ')'
}

export function lightAt(minute) {
  const m = ((minute % 1440) + 1440) % 1440
  let i = 1
  while (i < KEYS.length - 1 && KEYS[i][0] < m) i++
  const a = KEYS[i - 1]
  const b = KEYS[i]
  const k = (m - a[0]) / (b[0] - a[0] || 1)
  const darkness = a[3] + (b[3] - a[3]) * k
  // sun: rises 06:30 in the east, sets 18:15 in the west
  const dayFrac = (m - 390) / (1095 - 390)
  const up = dayFrac > 0 && dayFrac < 1
  const az = 90 + 180 * Math.max(0, Math.min(1, dayFrac))
  const elev = up ? Math.sin(Math.PI * dayFrac) : 0
  const rad = (az * Math.PI) / 180
  const len = up ? 3 + 12 * (1 - elev) : 0
  return {
    top: mix(a[1], b[1], k),
    horizon: mix(a[2], b[2], k),
    darkness,
    night: Math.max(0, Math.min(1, (darkness - 0.15) / 0.4)),
    shadow: { dx: -Math.sin(rad) * len, dy: Math.cos(rad) * len, opacity: up ? 0.18 + 0.2 * elev : 0 }
  }
}

// Plain tail colours per airline (no logos).
const TAILS = {
  '6E': '#1d3f8f', AI: '#c8102e', QP: '#ff6b35', IX: '#e05a2b', SG: '#d7262e', EK: '#b5121b', EY: '#bd8b13',
  BA: '#1f3a6e', SQ: '#f0b323', QR: '#5c0632', LH: '#05164d', TK: '#c8102e', VS: '#da0530', CX: '#00645a',
  UL: '#004b87', WY: '#7b5c2e', GF: '#b38f4f', ET: '#2f8f3a', SV: '#0b6e4f', KU: '#1b4f9c', MH: '#0a3a7d',
  AF: '#002157', KL: '#00a1de', LX: '#d52b1e', NH: '#13448f', '9I': '#c62026', S5: '#0f3a7a', G9: '#d71920',
  FZ: '#ef7f1a', TG: '#5c2d91', VN: '#0d6e8c', KQ: '#cc1f3a', OD: '#9b1c31', J9: '#174a92', XY: '#87b53e'
}

export function tailColour(code) {
  if (TAILS[code]) return TAILS[code]
  let h = 0
  for (const c of code || 'X') h = (h * 37 + c.charCodeAt(0)) % 360
  return 'hsl(' + h + ', 62%, 42%)'
}
