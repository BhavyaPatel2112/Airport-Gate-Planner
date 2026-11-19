// Procedural 3D models: aircraft, terminals, jet bridges and the control tower. Nose points to +X.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import layout from '../scene/layout/stands-layout.json'

export const OX = 1300
export const OZ = 650

/** World (layout) coordinates to scene coordinates. */
export function toScene(x, y) {
  return [x - OX, y - OZ]
}

function flat(points, depth, y) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.rotateX(Math.PI / 2)
  g.translate(0, y + depth, 0)
  return g
}

function buildAircraft(wide) {
  const body = []
  const tail = []
  const fus = new THREE.CapsuleGeometry(3, 38, 6, 12)
  fus.rotateZ(Math.PI / 2)
  fus.translate(-1, 4.2, 0)
  body.push(fus)
  body.push(flat([[5, 2.6], [-5, 19.5], [-9.5, 19.5], [-5.5, 2.6], [-5.5, -2.6], [-9.5, -19.5], [-5, -19.5], [5, -2.6]], 0.7, 3.2))
  for (const s of [1, -1]) {
    const eng = new THREE.CylinderGeometry(1.7, 1.5, 7, 12)
    eng.rotateZ(Math.PI / 2)
    eng.translate(1, 2.4, s * (wide ? 10.5 : 9))
    body.push(eng)
  }
  tail.push(flat([[-15.5, 2], [-21, 8.5], [-23.2, 8.5], [-20.5, 2], [-20.5, -2], [-23.2, -8.5], [-21, -8.5], [-15.5, -2]], 0.6, 5.2))
  const fin = new THREE.Shape([new THREE.Vector2(-15, 0), new THREE.Vector2(-23.5, 11), new THREE.Vector2(-26, 11),
    new THREE.Vector2(-24.5, 0)])
  const finG = new THREE.ExtrudeGeometry(fin, { depth: 0.8, bevelEnabled: false })
  finG.translate(0, 6, -0.4)
  tail.push(finG)
  const plain = (list) => list.map((g) => (g.index ? g.toNonIndexed() : g))
  const b = mergeGeometries(plain(body))
  const t = mergeGeometries(plain(tail))
  b.computeVertexNormals()
  t.computeVertexNormals()
  const s = wide ? 1.45 : 1
  b.scale(s, s, s)
  t.scale(s, s, s)
  return { body: b, tail: t }
}

export const AIRCRAFT = { narrow: buildAircraft(false), wide: buildAircraft(true) }

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

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

/** Terminal buildings as one group, with crisp edge lines. */
export function buildTerminals(materials) {
  const group = new THREE.Group()
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), materials.edge)
    group.add(edges)
    return m
  }
  for (const r of armRects()) {
    const g = new THREE.BoxGeometry(r.len, 13, r.width)
    g.rotateY(-r.angle)
    const [x, z] = toScene(r.cx, r.cy)
    g.translate(x, 6.5, z)
    add(g, materials.building)
  }
  const [cx, cz] = toScene(layout.core[0], layout.core[1])
  const core = new THREE.ExtrudeGeometry(roundedRect(300, 168, 34), { depth: 22, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 2 })
  core.rotateX(-Math.PI / 2)
  core.translate(cx, 0, cz)
  add(core, materials.building)
  const roof = new THREE.ExtrudeGeometry(roundedRect(250, 120, 26), { depth: 6, bevelEnabled: false })
  roof.rotateX(-Math.PI / 2)
  roof.translate(cx, 25, cz)
  add(roof, materials.roof)
  // Terminal 1
  const [t1x, t1z] = toScene(865, 1175)
  const t1 = new THREE.BoxGeometry(830, 14, 70)
  t1.translate(t1x, 7, t1z)
  add(t1, materials.building)
  // control tower
  const [tx, tz] = toScene(1180, 1256)
  const shaft = new THREE.CylinderGeometry(6, 8, 70, 16)
  shaft.translate(tx, 35, tz)
  add(shaft, materials.building)
  const cab = new THREE.CylinderGeometry(15, 11, 12, 16)
  cab.translate(tx, 76, tz)
  add(cab, materials.glass)
  return group
}

/** Jet bridges for contact stands: a pivot at the terminal and a box that stretches to the door. */
export function buildBridges(materials) {
  const out = []
  for (const s of layout.stands) {
    if (!s.contact || !s.bridge) continue
    const r = (s.heading * Math.PI) / 180
    const side = [Math.sin(r), -Math.cos(r)]
    const [x, z] = toScene(s.bridge[0] + side[0] * 9, s.bridge[1] + side[1] * 9)
    const pivot = new THREE.Group()
    pivot.position.set(x, 6.5, z)
    pivot.rotation.y = -((s.heading + 180 + 18) * Math.PI) / 180
    const geo = new THREE.BoxGeometry(1, 4.2, 4.6)
    geo.translate(0.5, 0, 0)
    const box = new THREE.Mesh(geo, materials.bridge)
    box.castShadow = true
    pivot.add(box)
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 12), materials.bridge)
    pivot.add(rot)
    out.push({ id: s.id, pivot, box, full: s.size === 'WIDE' ? 20 : 15 })
  }
  return out
}
