// Terminal 2 (X-shaped piers around a domed core), Terminal 1, the control tower and jet bridges.
// Smooth roofs and glazed facades; the glass glows at night through its emissive colour.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import layout from '../scene/layout/stands-layout.json'

export const OX = 1300
export const OZ = 650

/** Layout coordinates to scene coordinates. */
export function toScene(x, y) {
  return [x - OX, y - OZ]
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w / 2, h / 2 - r)
  s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w / 2 + r, h / 2)
  s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w / 2, -h / 2 + r)
  s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** A pier: long body with a barrel roof, extruded along its length (local +X). */
function pierGeometry(len, width, wallH, roofRise) {
  const half = width / 2
  const prof = new THREE.Shape()
  prof.moveTo(-half, 0)
  prof.lineTo(-half, wallH)
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI
    prof.lineTo(Math.cos(a) * (half + 1.5), wallH + Math.sin(a) * roofRise)
  }
  prof.lineTo(half, wallH)
  prof.lineTo(half, 0)
  prof.lineTo(-half, 0)
  const g = new THREE.ExtrudeGeometry(prof, { depth: len, bevelEnabled: true, bevelThickness: 4, bevelSize: 1.2,
    bevelSegments: 3, curveSegments: 6 })
  // profile is in X (across) / Y (up); extrusion along Z. Turn so length runs along X.
  g.translate(0, 0, -len / 2)
  g.rotateY(Math.PI / 2)
  return g
}

function glassBand(len, width, y0, y1) {
  const g = new THREE.BoxGeometry(len + 2, y1 - y0, width + 0.6)
  g.translate(0, (y0 + y1) / 2, 0)
  return g
}

export function armRects() {
  const c = layout.core
  const a = (layout.armAngle * Math.PI) / 180
  const dirs = [[-Math.cos(a), Math.sin(a)], [Math.cos(a), Math.sin(a)], [-Math.cos(a), -Math.sin(a)], [Math.cos(a), -Math.sin(a)]]
  return dirs.map((d) => {
    const mid = (layout.armStart + layout.armEnd) / 2
    return {
      cx: c[0] + d[0] * mid, cy: c[1] + d[1] * mid, len: layout.armEnd - layout.armStart + 20,
      width: layout.armHalf * 2, angle: Math.atan2(d[1], d[0])
    }
  })
}

/**
 * The T2 core roof seen from above: white coffers that radiate from the centre like a peacock's feathers,
 * each with a small round skylight. Returns the colour map and a matching glow map for the skylights at night.
 */
function roofTextures() {
  const S = 2048
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    return c
  }
  const col = make()
  const glow = make()
  const g = col.getContext('2d')
  const e = glow.getContext('2d')
  g.fillStyle = '#f1f2f0'
  g.fillRect(0, 0, S, S)
  e.fillStyle = '#000'
  e.fillRect(0, 0, S, S)
  for (const ctx of [g, e]) ctx.translate(S / 2, S / 2)
  const rings = 15
  for (let ring = 0; ring < rings; ring++) {
    const r0 = 70 + ring * 62
    const r1 = r0 + 62
    const n = 12 + ring * 6
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + (ring % 2) * (Math.PI / n)
      const a1 = a0 + (Math.PI * 2) / n
      // coffer: a slightly shaded cell with a pale rim
      g.beginPath()
      g.arc(0, 0, r1 - 3, a0 + 0.004, a1 - 0.004)
      g.arc(0, 0, r0 + 3, a1 - 0.004, a0 + 0.004, true)
      g.closePath()
      const k = 0.9 + 0.06 * Math.sin(i * 1.7 + ring)
      g.fillStyle = 'rgb(' + Math.round(228 * k) + ',' + Math.round(230 * k) + ',' + Math.round(229 * k) + ')'
      g.fill()
      // round skylight in the middle of the coffer
      const am = (a0 + a1) / 2
      const rm = (r0 + r1) / 2
      const rr = 7 + ring * 0.45
      const x = Math.cos(am) * rm
      const y = Math.sin(am) * rm
      g.beginPath()
      g.arc(x, y, rr, 0, Math.PI * 2)
      g.fillStyle = '#44535f'
      g.fill()
      g.beginPath()
      g.arc(x - rr * 0.25, y - rr * 0.25, rr * 0.45, 0, Math.PI * 2)
      g.fillStyle = 'rgba(190,215,235,0.35)'
      g.fill()
      e.beginPath()
      e.arc(x, y, rr, 0, Math.PI * 2)
      e.fillStyle = '#ffffff'
      e.fill()
    }
  }
  // central oculus
  g.beginPath()
  g.arc(0, 0, 58, 0, Math.PI * 2)
  g.fillStyle = '#263440'
  g.fill()
  e.beginPath()
  e.arc(0, 0, 58, 0, Math.PI * 2)
  e.fillStyle = '#ffffff'
  e.fill()
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }
  return { map: tex(col, true), glow: tex(glow, false) }
}

export function buildingMaterials() {
  return {
    shell: new THREE.MeshStandardMaterial({ color: '#4a525d', roughness: 0.62, metalness: 0.12 }),
    roof: (() => {
      const t = roofTextures()
      return new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.55, metalness: 0.08, map: t.map, envMapIntensity: 0.55,
        emissive: new THREE.Color('#ffd9a1'), emissiveMap: t.glow, emissiveIntensity: 0 })
    })(),
    pierRoof: new THREE.MeshStandardMaterial({ color: '#9aa3ae', roughness: 0.6, metalness: 0.1, envMapIntensity: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1d2a36', roughness: 0.12, metalness: 0.6,
      emissive: new THREE.Color('#ffd9a1'), emissiveIntensity: 0.0 }),
    bridge: new THREE.MeshStandardMaterial({ color: '#b8bfc8', roughness: 0.4, metalness: 0.35 }),
    tower: new THREE.MeshStandardMaterial({ color: '#a9b0b9', roughness: 0.55, metalness: 0.15 }),
    edge: new THREE.LineBasicMaterial({ color: '#9fb0c3', transparent: true, opacity: 0.18 })
  }
}

/** Terminal buildings as one group. */
export function buildTerminals(m) {
  const group = new THREE.Group()
  const add = (geo, mat, shadow = true) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }
  const shells = []
  const roofs = []
  const glass = []
  for (const r of armRects()) {
    const [x, z] = toScene(r.cx, r.cy)
    const body = pierGeometry(r.len, r.width, 9, 5.5)
    body.rotateY(-r.angle)
    body.translate(x, 0, z)
    roofs.push(body)
    // a strip of skylights along the ridge of each pier roof
    const sky = new THREE.BoxGeometry(r.len - 30, 0.5, 3.2)
    sky.translate(0, 9 + 5.5 + 0.9, 0)
    sky.rotateY(-r.angle)
    sky.translate(x, 0, z)
    glass.push(sky)
    const band = glassBand(r.len, r.width, 1.2, 8.2)
    band.rotateY(-r.angle)
    band.translate(x, 0, z)
    glass.push(band)
  }
  // core: glazed hall under a domed, overhanging roof
  const [cx, cz] = toScene(layout.core[0], layout.core[1])
  const hall = new THREE.ExtrudeGeometry(roundedRect(286, 154, 40), { depth: 16, bevelEnabled: false, curveSegments: 16 })
  hall.rotateX(-Math.PI / 2)
  hall.translate(cx, 0, cz)
  glass.push(hall)
  const podium = new THREE.ExtrudeGeometry(roundedRect(296, 164, 44), { depth: 2.2, bevelEnabled: false, curveSegments: 16 })
  podium.rotateX(-Math.PI / 2)
  podium.translate(cx, 0, cz)
  shells.push(podium)
  const roof = new THREE.ExtrudeGeometry(roundedRect(330, 196, 70), { depth: 2.5, bevelEnabled: true, bevelThickness: 2.2,
    bevelSize: 5, bevelSegments: 5, curveSegments: 28 })
  roof.rotateX(-Math.PI / 2)
  // dome the roof and map its texture over the footprint
  const p = roof.attributes.position
  const uv = roof.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const k = Math.max(0, 1 - (x / 172) ** 2 - (z / 104) ** 2)
    p.setY(i, p.getY(i) + 17 + 11 * Math.pow(k, 0.7))
    uv.setXY(i, 0.5 + x / 340, 0.5 + z / 340)
  }
  roof.computeVertexNormals()
  roof.translate(cx, 0, cz)
  add(roof, m.roof)
  // slender columns under the overhang
  const cols = []
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2
    const col = new THREE.CylinderGeometry(0.9, 1.3, 18, 8)
    col.translate(cx + Math.cos(a) * 154, 9, cz + Math.sin(a) * 88)
    cols.push(col)
  }
  shells.push(mergeGeometries(cols))
  // Terminal 1: a long pier with a barrel roof and a glazed concourse
  const [t1x, t1z] = toScene(865, 1175)
  const t1 = pierGeometry(830, 62, 10, 6)
  t1.translate(t1x, 0, t1z)
  roofs.push(t1)
  const t1sky = new THREE.BoxGeometry(800, 0.5, 4)
  t1sky.translate(t1x, 10 + 6 + 1.1, t1z)
  glass.push(t1sky)
  const t1g = glassBand(830, 62, 1.2, 9.2)
  t1g.translate(t1x, 0, t1z)
  glass.push(t1g)
  add(mergeGeometries(roofs.map((g) => (g.index ? g.toNonIndexed() : g)).map(stripUv)), m.pierRoof)
  add(mergeGeometries(glass.map((g) => (g.index ? g.toNonIndexed() : g)).map(stripUv)), m.glass, false)
  add(mergeGeometries(shells.map((g) => (g.index ? g.toNonIndexed() : g)).map(stripUv)), m.shell)
  group.add(buildTower(m))
  return group
}

function stripUv(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
  return g
}

function buildTower(m) {
  const [tx, tz] = toScene(1180, 1256)
  const prof = [[9, 0], [7.5, 6], [5.2, 14], [4.6, 58], [6.5, 62], [12, 66], [12.5, 67], [12.5, 68]].map(([r, y]) => new THREE.Vector2(r, y))
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), m.tower)
  shaft.castShadow = true
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 11.5, 8, 32, 1, true), m.glass)
  cab.position.y = 72
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(9, 14.2, 3, 32), m.tower)
  cap.position.y = 77.5
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 14, 8), m.tower)
  mast.position.y = 86
  const g = new THREE.Group()
  g.add(shaft, cab, cap, mast)
  g.position.set(tx, 0, tz)
  return g
}

/** Jet bridges for contact stands: a rotunda at the terminal and a tunnel that stretches to the door. */
export function buildBridges(m) {
  const out = []
  const tunnel = new THREE.BoxGeometry(1, 3.6, 3.8)
  tunnel.translate(0.5, 0, 0)
  const rot = new THREE.CylinderGeometry(2.6, 2.6, 5, 16)
  const leg = new THREE.CylinderGeometry(0.35, 0.35, 5, 6)
  leg.translate(0, -2.5, 0)
  for (const s of layout.stands) {
    if (!s.contact || !s.bridge) continue
    const r = (s.heading * Math.PI) / 180
    const side = [Math.sin(r), -Math.cos(r)]
    const [x, z] = toScene(s.bridge[0] + side[0] * 9, s.bridge[1] + side[1] * 9)
    const pivot = new THREE.Group()
    pivot.position.set(x, 5.6, z)
    pivot.rotation.y = -((s.heading + 180 + 18) * Math.PI) / 180
    const box = new THREE.Mesh(tunnel, m.bridge)
    box.castShadow = true
    pivot.add(box)
    pivot.add(new THREE.Mesh(rot, m.bridge))
    const footing = new THREE.Mesh(leg, m.bridge)
    pivot.add(footing)
    out.push({ id: s.id, pivot, box, footing, full: s.size === 'WIDE' ? 20 : 15 })
  }
  return out
}
