// Draws the airport ground (sea, city, aprons, runways, taxiways, stand markings) onto a canvas that
// becomes the 3D ground texture. Two palettes: the dark operations look and the pale clay model.
import layout from '../scene/layout/stands-layout.json'
import { WORLD } from '../scene/geometry'
import { cityBlocks } from '../scene/Ground'

export const TEX_W = 4096
export const TEX_H = Math.round((TEX_W * WORLD.h) / WORLD.w)
const K = TEX_W / WORLD.w

const PALETTES = {
  dark: {
    base: '#1a1c1f', city: ['#24272b', '#202326', '#2a2d31'], sea: ['#0d1c2a', '#13283a'], beach: '#2c2a25',
    grass: '#1d211e', fence: '#3a3e44', apron: '#2c2f34', joint: '#33373c', taxi: '#373b41', taxiLine: '#b39a3a',
    lane: '#33363b', runway: '#3c4047', mark: '#e4e6e8', standLine: '#a08a38', standText: '#b4b7bc', grid: '#25282c'
  },
  clay: {
    base: '#d6d2cb', city: ['#cbc6be', '#d1ccc5', '#c4bfb7'], sea: ['#bfc9d0', '#cad2d8'], beach: '#e4ddcf',
    grass: '#dad6cf', fence: '#b3aea6', apron: '#f2f0ec', joint: '#e2dfda', taxi: '#c9c5be', taxiLine: '#b8ae98',
    lane: '#d3cfc8', runway: '#b9b4ac', mark: '#ffffff', standLine: '#b5ab95', standText: '#8b867e', grid: '#cfcbc4'
  }
}

function tx(x) {
  return (x - WORLD.x) * K
}
function ty(y) {
  return (y - WORLD.y) * K
}

function poly(ctx, pts) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))))
}

export function drawGround(theme) {
  const P = PALETTES[theme]
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const ctx = c.getContext('2d')
  ctx.fillStyle = P.base
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  for (const b of cityBlocks()) {
    ctx.fillStyle = P.city[Math.floor(b.tone * 3) % 3]
    ctx.fillRect(tx(b.x), ty(b.y), b.w * K, b.h * K)
  }
  // sea and beach
  const sea = ctx.createLinearGradient(0, 0, tx(120), 0)
  sea.addColorStop(0, P.sea[0])
  sea.addColorStop(1, P.sea[1])
  ctx.fillStyle = sea
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(tx(120), 0)
  ctx.bezierCurveTo(tx(80), ty(200), tx(150), ty(420), tx(100), ty(700))
  ctx.bezierCurveTo(tx(60), ty(980), tx(130), ty(1200), tx(90), TEX_H)
  ctx.lineTo(0, TEX_H)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = P.beach
  ctx.lineWidth = 18 * K
  ctx.beginPath()
  ctx.moveTo(tx(120), 0)
  ctx.bezierCurveTo(tx(80), ty(200), tx(150), ty(420), tx(100), ty(700))
  ctx.bezierCurveTo(tx(60), ty(980), tx(130), ty(1200), tx(90), TEX_H)
  ctx.stroke()
  // airfield
  ctx.fillStyle = P.grass
  ctx.fillRect(tx(300), ty(-20), 2110 * K, 1330 * K)
  ctx.strokeStyle = P.fence
  ctx.lineWidth = 2 * K
  ctx.setLineDash([10 * K, 6 * K])
  ctx.strokeRect(tx(300), ty(-20), 2110 * K, 1330 * K)
  ctx.setLineDash([])
  // floor grid, as in a digital twin
  ctx.strokeStyle = P.grid
  ctx.lineWidth = 1
  for (let x = Math.ceil(WORLD.x / 100) * 100; x < WORLD.x + WORLD.w; x += 100) {
    ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), TEX_H); ctx.stroke()
  }
  for (let y = Math.ceil(WORLD.y / 100) * 100; y < WORLD.y + WORLD.h; y += 100) {
    ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(TEX_W, ty(y)); ctx.stroke()
  }
  // aprons with concrete joints
  for (const [x, y, w, h] of [[1300, 22, 1076, 866], [440, 1010, 1000, 134], [1560, 1108, 800, 176]]) {
    ctx.fillStyle = P.apron
    ctx.fillRect(tx(x), ty(y), w * K, h * K)
    ctx.strokeStyle = P.joint
    ctx.lineWidth = 1
    for (let gx = x; gx < x + w; gx += 30) { ctx.beginPath(); ctx.moveTo(tx(gx), ty(y)); ctx.lineTo(tx(gx), ty(y + h)); ctx.stroke() }
    for (let gy = y; gy < y + h; gy += 30) { ctx.beginPath(); ctx.moveTo(tx(x), ty(gy)); ctx.lineTo(tx(x + w), ty(gy)); ctx.stroke() }
  }
  // taxiways and apron lanes
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const exits = [[[1790, 930], [1748, 868]], [[1725, 930], [1690, 1000]]]
  const ways = [...layout.taxiways.map((t) => t.pts), ...exits]
  ctx.strokeStyle = P.taxi
  ctx.lineWidth = 18 * K
  for (const pts of ways) { poly(ctx, pts); ctx.stroke() }
  ctx.strokeStyle = P.lane
  ctx.lineWidth = 12 * K
  for (const g of Object.values(layout.groups)) { poly(ctx, g.lane); ctx.stroke() }
  ctx.strokeStyle = P.taxiLine
  ctx.lineWidth = 1.6 * K
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
    ctx.fillStyle = P.runway
    ctx.fillRect(0, -rw.width / 2, len, rw.width)
    ctx.fillStyle = P.mark
    for (let d = 60; d < len - 80; d += 38) ctx.fillRect(d, -0.9, 22, 1.8)
    for (let i = 0; i < 6; i++) {
      const off = -rw.width / 2 + 4 + i * ((rw.width - 8) / 6)
      ctx.fillRect(10, off, 34, 2.6)
      ctx.fillRect(len - 44, off, 34, 2.6)
    }
    ctx.strokeStyle = P.mark
    ctx.lineWidth = 0.8
    ctx.strokeRect(0, -rw.width / 2, len, rw.width)
    ctx.font = '700 15px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.save(); ctx.translate(56, 0); ctx.rotate(Math.PI / 2); ctx.fillText(rw.ends[0], 0, 0); ctx.restore()
    ctx.save(); ctx.translate(len - 56, 0); ctx.rotate(-Math.PI / 2); ctx.fillText(rw.ends[1], 0, 0); ctx.restore()
    ctx.restore()
  }
  // stand lead-in lines and numbers
  ctx.font = '700 ' + Math.round(9 * K) + 'px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const s of layout.stands) {
    const r = (s.heading * Math.PI) / 180
    const nose = [s.x + Math.cos(r) * (s.size === 'WIDE' ? 32 : 22), s.y + Math.sin(r) * (s.size === 'WIDE' ? 32 : 22)]
    ctx.strokeStyle = P.standLine
    ctx.lineWidth = 1.1 * K
    poly(ctx, [s.lane, nose])
    ctx.stroke()
    ctx.fillStyle = P.standText
    const lx = s.x - Math.cos(r) * (s.size === 'WIDE' ? 46 : 34)
    const ly = s.y - Math.sin(r) * (s.size === 'WIDE' ? 46 : 34)
    ctx.fillText(s.id, tx(lx), ty(ly))
  }
  return c
}
