// Procedural airliners: a lathe fuselage with an upswept tail cone, swept wings with dihedral and
// winglets, podded engines, tailplane and an airline-coloured fin. Nose points to +X, up is +Y.
// Body parts are merged into one geometry with vertex colours, so each aircraft is two draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const WHITE_UV = [0.5, 0.985]
// engines sample their own patch of the livery texture, so each airline can colour them
const ENGINE_UV = [0.5, 0.93]
// the fuselage uses the top 86 % of the texture (nose at row 0); the rest holds the flat colour patches
export const BODY_V = 0.86

function paint(geo, hex, keepUv = false, uvAt = WHITE_UV) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const n = g.attributes.position.count
  const c = new THREE.Color(hex)
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  if (!keepUv) {
    const uv = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      uv[i * 2] = uvAt[0]
      uv[i * 2 + 1] = uvAt[1]
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  if (g.attributes.uv1) g.deleteAttribute('uv1')
  return g
}

/** Fuselage radius along the body, t = 0 at the nose and 1 at the tail. */
function radiusAt(t) {
  if (t < 0.13) {
    const k = t / 0.13
    return Math.pow(Math.sin((k * Math.PI) / 2), 0.62)
  }
  if (t < 0.66) return 1
  const k = (t - 0.66) / 0.34
  return 1 - 0.8 * Math.pow(k, 1.35)
}

function fuselage(len, R) {
  const pts = []
  const N = 46
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push(new THREE.Vector2(Math.max(0.001, R * radiusAt(t)), len / 2 - t * len))
  }
  const g = new THREE.LatheGeometry(pts, 40)
  // lathe runs along +Y; turn it so the nose points to +X
  g.rotateZ(-Math.PI / 2)
  // upswept tail cone and a slightly drooped nose
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const t = (len / 2 - x) / len
    if (t > 0.66) p.setY(i, p.getY(i) + Math.pow((t - 0.66) / 0.34, 1.6) * R * 0.85)
    if (t < 0.1) p.setY(i, p.getY(i) - (0.1 - t) * R * 0.9)
  }
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * BODY_V)
  g.computeVertexNormals()
  return g
}

function planform(points, thickness, bevel) {
  const s = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4
  })
  // shape is drawn in X/Z; extrude along +Y
  g.rotateX(Math.PI / 2)
  g.translate(0, thickness, 0)
  return g
}

function halfWing({ rootX, rootChord, tipChord, semi, sweep, thick, y, dihedral, side, winglet }) {
  const tipLe = rootX - semi * Math.tan(sweep)
  const pts = [[rootX, 0], [tipLe, semi], [tipLe - tipChord, semi], [rootX - rootChord, 0]]
  const g = planform(side > 0 ? pts : pts.map(([x, z]) => [x, -z]).reverse(), thick, thick * 0.45)
  // tips up (dihedral): rotating about the length axis lifts the far end of each half wing
  g.rotateX(-side * dihedral)
  g.translate(0, y, 0)
  const parts = [g]
  if (winglet) {
    const h = winglet
    const w = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-tipChord * 0.4, h),
      new THREE.Vector2(-tipChord * 0.85, h), new THREE.Vector2(-tipChord, 0)])
    const wg = new THREE.ExtrudeGeometry(w, { depth: 0.18, bevelEnabled: false })
    wg.translate(tipLe, y + Math.sin(dihedral) * semi + thick, side * (semi - 0.1))
    parts.push(wg)
  }
  return parts
}

function nacelle(len, r) {
  const pts = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const rr = t < 0.15 ? r * (0.86 + t) : t > 0.7 ? r * (1 - (t - 0.7) * 1.5) : r
    pts.push(new THREE.Vector2(rr, len / 2 - t * len))
  }
  const g = new THREE.LatheGeometry(pts, 18)
  g.rotateZ(-Math.PI / 2)
  return g
}

function build(spec) {
  const { len, R, semi, rootChord, tipChord, sweep, wingX, engines, engR, engLen, tailSemi, finH, finChord } = spec
  const body = []
  body.push(paint(fuselage(len, R), '#ffffff', true))
  const wingY = -R * 0.5
  for (const side of [1, -1]) {
    for (const part of halfWing({ rootX: wingX, rootChord, tipChord, semi, sweep, thick: R * 0.16, y: wingY,
      dihedral: 0.085, side, winglet: R * 1.2 })) {
      body.push(paint(part, '#e9ecef'))
    }
    for (const at of engines) {
      const z = side * semi * at
      const leX = wingX - semi * at * Math.tan(sweep)
      const e = nacelle(engLen, engR)
      e.translate(leX + engLen * 0.42, wingY + Math.sin(0.085) * semi * at - engR * 0.95, z)
      body.push(paint(e, '#ffffff', false, ENGINE_UV))
      const inlet = new THREE.CircleGeometry(engR * 0.8, 16)
      inlet.rotateY(Math.PI / 2)
      inlet.translate(leX + engLen * 0.92, wingY + Math.sin(0.085) * semi * at - engR * 0.95, z)
      body.push(paint(inlet, '#2a2f36'))
      const py = new THREE.BoxGeometry(engLen * 0.55, engR * 0.9, 0.35)
      py.translate(leX + engLen * 0.1, wingY + Math.sin(0.085) * semi * at - engR * 0.25, z)
      body.push(paint(py, '#dfe3e8'))
    }
    const tp = halfWing({ rootX: -len * 0.36, rootChord: R * 2.3, tipChord: R * 0.8, semi: tailSemi, sweep: 0.6,
      thick: R * 0.1, y: R * 0.35, dihedral: 0.12, side })
    for (const part of tp) body.push(paint(part, '#e9ecef'))
  }
  // belly fairing
  const fair = new THREE.SphereGeometry(1, 16, 8)
  fair.scale(rootChord * 0.75, R * 0.5, R * 0.82)
  fair.translate(wingX - rootChord * 0.45, -R * 0.55, 0)
  body.push(paint(fair, '#f3f5f7'))

  const fin = new THREE.Shape([
    new THREE.Vector2(-len * 0.30, 0), new THREE.Vector2(-len * 0.30 - finChord * 0.95, finH),
    new THREE.Vector2(-len * 0.30 - finChord * 1.38, finH), new THREE.Vector2(-len * 0.30 - finChord * 1.2, 0)
  ])
  const finG = new THREE.ExtrudeGeometry(fin, { depth: R * 0.14, bevelEnabled: true, bevelThickness: R * 0.05,
    bevelSize: R * 0.05, bevelSegments: 1 })
  finG.translate(0, R * 0.55, -R * 0.07)
  const merged = mergeGeometries(body)
  merged.computeBoundingBox()
  // stand the aircraft on its landing gear: lowest point (engine or belly) just above the ground
  const lift = -merged.boundingBox.min.y + R * 0.35
  merged.translate(0, lift, 0)
  merged.computeBoundingSphere()
  const tail = finG.index ? finG.toNonIndexed() : finG
  tail.translate(0, lift, 0)
  tail.computeVertexNormals()
  return { body: merged, tail, len, span: semi * 2 }
}

export const AIRCRAFT = {
  narrow: build({ len: 38, R: 2.05, semi: 17.2, rootChord: 7.2, tipChord: 1.7, sweep: 0.44, wingX: 4.5,
    engines: [0.34], engR: 1.05, engLen: 4.6, tailSemi: 6.4, finH: 6.6, finChord: 4.6 }),
  wide: build({ len: 60, R: 3.05, semi: 28, rootChord: 11, tipChord: 2.4, sweep: 0.5, wingX: 7,
    engines: [0.32], engR: 1.75, engLen: 7.2, tailSemi: 10.5, finH: 9.6, finChord: 7 })
}

// Airline liveries, simplified: titles, cheatline, belly and engine colours. Plain shapes and type only, no logos.
export const LIVERIES = {
  '6E': { title: 'IndiGo', ink: '#1d3f8f', engine: '#1d3f8f' },
  AI: { title: 'AIR INDIA', ink: '#c8102e', engine: '#7d1f3b', cheat: '#c8102e' },
  QP: { title: 'Akasa Air', ink: '#ff6b35', engine: '#ff6b35' },
  IX: { title: 'Air India Express', ink: '#e05a2b', engine: '#e05a2b', belly: '#f2d9cc' },
  SG: { title: 'SpiceJet', ink: '#d7262e', engine: '#d7262e', belly: '#d7262e' },
  EK: { title: 'Emirates', ink: '#a8814a', engine: '#f2f3f5', cheat: '#b5121b' },
  EY: { title: 'ETIHAD', ink: '#8c6b3a', engine: '#bd8b13', body: '#efe6d6', belly: '#e2d3b8' },
  '9I': { title: 'Alliance Air', ink: '#c62026', engine: '#f2f3f5', cheat: '#c62026' },
  S5: { title: 'Star Air', ink: '#0f3a7a', engine: '#0f3a7a' },
  BA: { title: 'BRITISH AIRWAYS', ink: '#1f3a6e', engine: '#1f3a6e', belly: '#1f3a6e', cheat: '#c8102e' },
  SQ: { title: 'SINGAPORE AIRLINES', ink: '#1d3f8f', engine: '#f0b323' },
  QR: { title: 'QATAR AIRWAYS', ink: '#5c0632', engine: '#f2f3f5' },
  LH: { title: 'Lufthansa', ink: '#05164d', engine: '#05164d', belly: '#05164d' },
  TK: { title: 'TURKISH AIRLINES', ink: '#1f2a44', engine: '#c8102e' },
  VS: { title: 'virgin atlantic', ink: '#da0530', engine: '#f2f3f5', belly: '#d9d2d8' },
  ET: { title: 'Ethiopian', ink: '#2f8f3a', engine: '#f2f3f5', cheat: '#f2c418' },
  KL: { title: 'KLM', ink: '#00a1de', engine: '#00a1de', belly: '#00a1de', body: '#eaf6fc' },
  AF: { title: 'AIRFRANCE', ink: '#002157', engine: '#f2f3f5' },
  CX: { title: 'CATHAY PACIFIC', ink: '#00645a', engine: '#00645a', cheat: '#00645a' },
  G9: { title: 'airarabia', ink: '#d71920', engine: '#d71920' },
  FZ: { title: 'flydubai', ink: '#0d3a6e', engine: '#ef7f1a', belly: '#0d3a6e' },
  UL: { title: 'SriLankan', ink: '#004b87', engine: '#f2f3f5', cheat: '#e06f1f' },
  TG: { title: 'THAI', ink: '#5c2d91', engine: '#5c2d91' },
  MH: { title: 'Malaysia', ink: '#0a3a7d', engine: '#f2f3f5', cheat: '#cc1f3a' },
  SV: { title: 'SAUDIA', ink: '#0b6e4f', engine: '#f2f3f5', belly: '#d8cfb8' },
  GF: { title: 'GULF AIR', ink: '#8a6d3b', engine: '#f2f3f5' },
  WY: { title: 'OMAN AIR', ink: '#7b5c2e', engine: '#f2f3f5', cheat: '#0f6b6b' }
}

/**
 * Fuselage livery for one airline: white with window lines, cockpit glazing and a soft belly shade,
 * plus the airline's titles, cheatline, belly and engine colour.
 * Lathe UVs after the turn: u = 0.25 is the belly, 0.75 the crown, and the two window lines sit at
 * u = 0.545 and 0.955. Rows 0 to BODY_V of the texture run nose to tail (flipY is off).
 */
export function liveryTexture(code, name, ink) {
  const L = (code && LIVERIES[code]) || (code ? { title: name || '', ink: ink || '#1b2a44', engine: '#f2f3f5', cheat: ink } : {})
  const W = 1024
  const H = 512
  const F = H * BODY_V
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const base = L.body || '#ffffff'
  const shade = g.createLinearGradient(0, 0, W, 0)
  shade.addColorStop(0, base)
  shade.addColorStop(0.25, L.belly ? L.belly : '#c9ced5')
  shade.addColorStop(0.5, base)
  shade.addColorStop(0.75, '#ffffff')
  shade.addColorStop(1, base)
  g.fillStyle = shade
  g.fillRect(0, 0, W, F)
  if (L.belly) {
    // belly colour that wraps up to just under the windows
    g.fillStyle = L.belly
    g.fillRect(0.08 * W, F * 0.06, 0.34 * W, F * 0.86)
  }
  if (L.cheat) {
    g.fillStyle = L.cheat
    g.fillRect(0.505 * W, F * 0.1, 0.012 * W, F * 0.78)
    g.fillRect(0.983 * W, F * 0.1, 0.012 * W, F * 0.78)
  }
  // windows, doors and cockpit glazing
  g.fillStyle = '#1d232b'
  for (const u of [0.545, 0.955]) {
    for (let v = F * 0.15; v < F * 0.72; v += F * 0.0155) g.fillRect(u * W - 4, v, 8, F * 0.0072)
    g.fillRect(u * W - 9, F * 0.055, 18, F * 0.027)
    for (const dv of [0.115, 0.74]) {
      g.strokeStyle = 'rgba(40,46,56,0.55)'
      g.lineWidth = 2
      g.strokeRect(u * W - 13, F * dv, 26, F * 0.03)
    }
  }
  g.fillRect(0.6 * W, F * 0.03, 0.3 * W, F * 0.02)
  // airline titles above the windows, reading nose to tail on both sides
  if (L.title) {
    g.fillStyle = L.ink
    // one texture pixel is about 7 times longer along the body than around it, so squeeze the type to match
    const squeeze = 1 / 7
    const size = 118
    g.font = '700 ' + size + 'px Inter, Arial, sans-serif'
    const fit = Math.min(1, (F * 0.4) / (g.measureText(L.title).width * squeeze))
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    for (const [u, rot] of [[0.632, Math.PI / 2], [0.868, Math.PI / 2]]) {
      g.save()
      const run = g.measureText(L.title).width * squeeze * fit
      g.translate(u * W, rot > 0 ? F * 0.17 : F * 0.17 + run)
      g.rotate(rot)
      g.scale(squeeze * fit, fit)
      g.fillText(L.title, 0, 0)
      g.restore()
    }
  }
  // flat patches: engines and wings
  g.fillStyle = L.engine || '#c9ced5'
  g.fillRect(0.4 * W, H * 0.9, 0.2 * W, H * 0.06)
  g.fillStyle = '#ffffff'
  g.fillRect(0.4 * W, H * 0.97, 0.2 * W, H * 0.03)
  const t = new THREE.CanvasTexture(c)
  t.flipY = false
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
