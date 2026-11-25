// Paints the airfield onto one large canvas: a quiet dark base, aprons, taxiways with lit centre
// lines, runways with full markings and stand lead-in lines. Brightness for day and night is set
// later by the material colour, so one texture serves the whole day.
import layout from '../scene/layout/stands-layout.json'
import { WORLD } from '../scene/geometry'

export const TEX_W = 6144
export const TEX_H = Math.round((TEX_W * WORLD.h) / WORLD.w)
const K = TEX_W / WORLD.w

const P = {
  base: '#56613f', field: '#5b6a3c', sea: '#1f3b4f', shore: '#8a8170', grid: 'rgba(0,0,0,0)',
  apron: '#7a7b77', joint: 'rgba(0,0,0,0.10)', taxi: '#4d5054', taxiEdge: 'rgba(236,190,60,0.75)',
  centre: 'rgba(240,196,70,0.95)', lane: '#6c6e6c', runway: '#3d4045', mark: 'rgba(245,246,248,0.95)',
  standLine: 'rgba(240,196,70,0.95)', standBox: 'rgba(255,255,255,0.45)', standText: 'rgba(255,255,255,0.85)'
}

/** Soft patches and speckle so grass, concrete and asphalt do not look flat. */
function texture(ctx, x, y, w, h, colours, n, size, seed) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colours[Math.floor(rnd() * colours.length)]
    const r = size * (0.3 + rnd())
    ctx.beginPath()
    ctx.ellipse(x + rnd() * w, y + rnd() * h, r, r * (0.4 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

const tx = (x) => (x - WORLD.x) * K
const ty = (y) => (y - WORLD.y) * K

function poly(ctx, pts) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))))
}

export function paintGround() {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const ctx = c.getContext('2d')
  ctx.fillStyle = P.base
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  // Arabian Sea along the west edge
  ctx.fillStyle = P.sea
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(tx(120), 0)
  ctx.bezierCurveTo(tx(80), ty(200), tx(150), ty(420), tx(100), ty(700))
  ctx.bezierCurveTo(tx(60), ty(980), tx(130), ty(1200), tx(90), TEX_H)
  ctx.lineTo(0, TEX_H)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = P.shore
  ctx.lineWidth = 4 * K
  ctx.stroke()
  // airfield
  ctx.fillStyle = P.field
  ctx.fillRect(tx(300), ty(-20), 2110 * K, 1330 * K)
  texture(ctx, tx(300), ty(-20), 2110 * K, 1330 * K, ['rgba(70,86,44,0.35)', 'rgba(120,120,70,0.22)', 'rgba(60,72,40,0.3)',
    'rgba(140,130,90,0.15)'], 9000, 60, 5)
  texture(ctx, 0, 0, TEX_W, TEX_H, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.03)'], 26000, 6, 9)
  texture(ctx, tx(160), 0, TEX_W - tx(160), TEX_H, ['rgba(60,74,40,0.25)', 'rgba(110,104,70,0.18)'], 2500, 90, 13)
  // mowing stripes and sun-dried patches, so the grass between runways does not read as one flat carpet
  ctx.save()
  ctx.beginPath()
  ctx.rect(tx(300), ty(-20), 2110 * K, 1330 * K)
  ctx.clip()
  for (let i = 0, x = 300; x < 2410; x += 34, i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,230,0.045)' : 'rgba(0,20,0,0.05)'
    ctx.fillRect(tx(x), ty(-20), 34 * K, 1330 * K)
  }
  let seed = 41
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < 70; i++) {
    const x = 320 + rnd() * 2070
    const y = 0 + rnd() * 1290
    const r = 20 + rnd() * 70
    const gr = ctx.createRadialGradient(tx(x), ty(y), 0, tx(x), ty(y), r * K)
    gr.addColorStop(0, 'rgba(170,150,95,0.28)')
    gr.addColorStop(1, 'rgba(170,150,95,0)')
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.ellipse(tx(x), ty(y), r * K * 1.6, r * K, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // perimeter service road just inside the fence, with a dashed centre line
  ctx.strokeStyle = '#46484b'
  ctx.lineWidth = 7 * K
  ctx.strokeRect(tx(312), ty(-8), 2086 * K, 1306 * K)
  ctx.strokeStyle = 'rgba(235,235,225,0.6)'
  ctx.lineWidth = 0.35 * K
  ctx.setLineDash([3 * K, 4 * K])
  ctx.strokeRect(tx(312), ty(-8), 2086 * K, 1306 * K)
  ctx.setLineDash([])
  // the strip of bare earth outside the fence
  ctx.strokeStyle = 'rgba(120,104,78,0.55)'
  ctx.lineWidth = 9 * K
  ctx.strokeRect(tx(294), ty(-26), 2122 * K, 1342 * K)
  // digital-twin grid
  ctx.strokeStyle = P.grid
  ctx.lineWidth = 1.2
  for (let x = Math.ceil(WORLD.x / 50) * 50; x < WORLD.x + WORLD.w; x += 50) {
    ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), TEX_H); ctx.stroke()
  }
  for (let y = Math.ceil(WORLD.y / 50) * 50; y < WORLD.y + WORLD.h; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(TEX_W, ty(y)); ctx.stroke()
  }
  // aprons with concrete slab joints
  for (const [x, y, w, h] of [[1300, 22, 1076, 866], [440, 1010, 1000, 134], [1560, 1108, 800, 176]]) {
    ctx.fillStyle = P.apron
    ctx.fillRect(tx(x), ty(y), w * K, h * K)
    texture(ctx, tx(x), ty(y), w * K, h * K, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.025)', 'rgba(60,50,40,0.03)'], 9000, 9, 3)
    ctx.strokeStyle = P.joint
    ctx.lineWidth = 1.5
    for (let gx = x; gx < x + w; gx += 12) { ctx.beginPath(); ctx.moveTo(tx(gx), ty(y)); ctx.lineTo(tx(gx), ty(y + h)); ctx.stroke() }
    for (let gy = y; gy < y + h; gy += 12) { ctx.beginPath(); ctx.moveTo(tx(x), ty(gy)); ctx.lineTo(tx(x + w), ty(gy)); ctx.stroke() }
  }
  // taxiways
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const exits = [[[1790, 930], [1748, 868]], [[1725, 930], [1690, 1000]]]
  const ways = [...layout.taxiways.map((t) => t.pts), ...exits]
  ctx.strokeStyle = P.taxiEdge
  ctx.lineWidth = 21 * K
  for (const pts of ways) { poly(ctx, pts); ctx.stroke() }
  ctx.strokeStyle = P.taxi
  ctx.lineWidth = 19 * K
  for (const pts of ways) { poly(ctx, pts); ctx.stroke() }
  ctx.strokeStyle = P.lane
  ctx.lineWidth = 12 * K
  for (const g of Object.values(layout.groups)) { poly(ctx, g.lane); ctx.stroke() }
  ctx.strokeStyle = P.centre
  ctx.lineWidth = 0.7 * K
  for (const pts of ways) { poly(ctx, pts); ctx.stroke() }
  for (const g of Object.values(layout.groups)) { poly(ctx, g.lane); ctx.stroke() }
  // runways
  for (const rw of layout.runways) {
    const [ax, ay] = rw.a
    const [bx, by] = rw.b
    const len = Math.hypot(bx - ax, by - ay)
    const ang = Math.atan2(by - ay, bx - ax)
    ctx.save()
    ctx.translate(tx(ax), ty(ay))
    ctx.rotate(ang)
    ctx.scale(K, K)
    const W = rw.width
    // paved shoulders and blast pads with yellow chevrons beyond each end
    ctx.fillStyle = '#5a5c5f'
    ctx.fillRect(-20, -W / 2 - 9, len + 40, W + 18)
    ctx.fillStyle = '#4a4c50'
    ctx.fillRect(-70, -W / 2, 50, W)
    ctx.fillRect(len + 20, -W / 2, 50, W)
    ctx.strokeStyle = 'rgba(236,190,60,0.85)'
    ctx.lineWidth = 1.4
    for (const [x0, dir] of [[-20, -1], [len + 20, 1]]) {
      for (let k = 8; k < 50; k += 10) {
        ctx.beginPath()
        ctx.moveTo(x0 + dir * k, -W / 2 + 2)
        ctx.lineTo(x0 + dir * (k + 10), 0)
        ctx.lineTo(x0 + dir * k, W / 2 - 2)
        ctx.stroke()
      }
    }
    ctx.fillStyle = P.runway
    ctx.fillRect(-20, -W / 2, len + 40, W)
    // grooving and wear: faint cross lines and a darker band down the middle
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    for (let d = 0; d < len; d += 1.6) ctx.fillRect(d, -W / 2, 0.35, W)
    const wear = ctx.createLinearGradient(0, -W / 2, 0, W / 2)
    wear.addColorStop(0, 'rgba(0,0,0,0)')
    wear.addColorStop(0.5, 'rgba(0,0,0,0.12)')
    wear.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = wear
    ctx.fillRect(0, -W / 2, len, W)
    // rubber from touchdowns at both ends
    let seed = 17
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const [a0, a1] of [[90, 520], [len - 520, len - 90]]) {
      for (let i = 0; i < 260; i++) {
        const x = a0 + r() * (a1 - a0)
        const y = (r() - 0.5) * 14
        ctx.fillStyle = 'rgba(12,12,14,' + (0.08 + r() * 0.14) + ')'
        ctx.fillRect(x, y, 6 + r() * 26, 0.7 + r() * 0.8)
      }
    }
    ctx.fillStyle = P.mark
    // aiming points and touchdown zone bars
    for (const at of [300, len - 345]) {
      ctx.fillRect(at, -W / 2 + 6, 45, 4.5)
      ctx.fillRect(at, W / 2 - 10.5, 45, 4.5)
    }
    for (const at of [450, 600, len - 472, len - 622]) {
      for (const y of [-W / 2 + 6, -W / 2 + 9.5, W / 2 - 8, W / 2 - 11.5]) ctx.fillRect(at, y, 22, 1.8)
    }
    for (let d = 70; d < len - 90; d += 40) ctx.fillRect(d, -0.5, 24, 1)
    for (let i = 0; i < 8; i++) {
      const off = -rw.width / 2 + 3 + i * ((rw.width - 6) / 8)
      ctx.fillRect(6, off, 30, 1.8)
      ctx.fillRect(len - 36, off, 30, 1.8)
    }
    for (const at of [140, len - 170]) {
      ctx.fillRect(at, -rw.width / 2 + 5, 30, 3.2)
      ctx.fillRect(at, rw.width / 2 - 8.2, 30, 3.2)
    }
    ctx.fillRect(-20, -rw.width / 2, len + 40, 0.5)
    ctx.fillRect(-20, rw.width / 2 - 0.5, len + 40, 0.5)
    ctx.font = '600 13px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.save(); ctx.translate(56, 0); ctx.rotate(Math.PI / 2); ctx.fillText(rw.ends[0], 0, 0); ctx.restore()
    ctx.save(); ctx.translate(len - 56, 0); ctx.rotate(-Math.PI / 2); ctx.fillText(rw.ends[1], 0, 0); ctx.restore()
    ctx.restore()
  }
  // stands: the lead-in line from the taxi lane to the stand entry (the stand box, stop bars and number are crisp decals, see stands.js)
  for (const s of layout.stands) {
    const r = (s.heading * Math.PI) / 180
    const entry = s.size === 'WIDE' ? 64 * 0.62 : 42 * 0.62
    const at = [s.x - Math.cos(r) * entry, s.y - Math.sin(r) * entry]
    ctx.strokeStyle = P.standLine
    ctx.lineWidth = 0.7 * K
    poly(ctx, [s.lane, at])
    ctx.stroke()
  }
  return c
}
