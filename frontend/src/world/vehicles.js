// Ground service vehicles: baggage tugs with a cart that shuttle between each parked aircraft and
// the terminal side, with headlights at night. Pure decoration; one instanced mesh for all of them.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const MAX = 90

function tugGeometry() {
  const parts = []
  const body = new THREE.BoxGeometry(3.2, 1.6, 2)
  body.translate(0, 1.1, 0)
  parts.push(body)
  const cab = new THREE.BoxGeometry(1.4, 1.2, 1.8)
  cab.translate(-0.6, 2.4, 0)
  parts.push(cab)
  const cart = new THREE.BoxGeometry(3.4, 1.9, 2.1)
  cart.translate(-4.4, 1.3, 0)
  parts.push(cart)
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [-3.4, 1], [-3.4, -1], [-5.4, 1], [-5.4, -1]]) {
    const w = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 8)
    w.rotateX(Math.PI / 2)
    w.translate(x, 0.42, z * 1.02)
    parts.push(w)
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))
}

/** Box with a flat vertex colour, positioned in the vehicle's own frame (x forward, y up). */
function part(geo, x, y, z, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo
  g.translate(x, y, z)
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
  return g
}
const box = (w, h, d, x, y, z, hex) => part(new THREE.BoxGeometry(w, h, d), x, y, z, hex)
function wheels(xs, half, r, hex = '#1c1e22') {
  const out = []
  for (const x of xs) {
    for (const z of [half, -half]) {
      const w = new THREE.CylinderGeometry(r, r, 0.35, 10)
      w.rotateX(Math.PI / 2)
      out.push(part(w, x, r, z, hex))
    }
  }
  return out
}

// Ground support equipment that waits beside a parked aircraft. Sizes in metres.
const GSE = {
  // belt loader: a low chassis with a conveyor ramp rising towards the cargo door (+x)
  belt: () => {
    const ramp = new THREE.BoxGeometry(8, 0.35, 1.3)
    ramp.rotateZ(0.32)
    return [box(5.5, 0.9, 1.9, 0, 0.9, 0, '#e3b23c'), box(1.4, 1.3, 1.6, -2.2, 1.9, 0, '#2b3036'),
      part(ramp, 0.6, 2.4, 0, '#3a3f46'), ...wheels([1.8, -1.8], 0.95, 0.42)]
  },
  // fuel truck: cab and a long rounded tank
  fuel: () => {
    const tank = new THREE.CylinderGeometry(1.25, 1.25, 7.5, 16)
    tank.rotateZ(Math.PI / 2)
    return [box(2.2, 2.4, 2.4, 4.4, 1.6, 0, '#c8102e'), box(9.5, 0.6, 2.3, -0.4, 0.75, 0, '#30353c'),
      part(tank, -1.3, 2.4, 0, '#eef0f2'), ...wheels([4.2, -2.4, -4], 1.15, 0.55)]
  },
  // ground power unit on a small trailer
  gpu: () => [box(2.4, 1.4, 1.5, 0, 1.0, 0, '#f2f3f5'), box(2.6, 0.2, 1.6, 0, 0.3, 0, '#2b3036'), ...wheels([0.8, -0.8], 0.8, 0.3)],
  // high-lift catering truck with the box raised to the galley door
  cater: () => [box(2.2, 2.2, 2.4, 3.6, 1.5, 0, '#f2f3f5'), box(7.5, 0.6, 2.4, 0, 0.75, 0, '#30353c'),
    box(5.2, 2.6, 2.4, -0.9, 4.6, 0, '#eef0f2'), box(0.3, 3.0, 0.3, -0.9, 2.3, 0.9, '#8a9099'), box(0.3, 3.0, 0.3, -0.9, 2.3, -0.9, '#8a9099'),
    ...wheels([3.4, -2.6], 1.15, 0.5)],
  // pushback tug: low and wide, waiting at the nose
  tug: () => [box(6.2, 1.1, 2.7, 0, 0.95, 0, '#e3b23c'), box(1.6, 0.9, 2.2, -1.6, 1.95, 0, '#2b3036'), ...wheels([2.1, -2.1], 1.3, 0.55)],
  // traffic cone
  cone: () => {
    const c = new THREE.ConeGeometry(0.28, 0.75, 10)
    return [part(c, 0, 0.38, 0, '#ff6a1a'), box(0.55, 0.05, 0.55, 0, 0.03, 0, '#ff6a1a')]
  }
}

// where each piece stands for a narrow-body, in aircraft-local metres (nose +x, starboard +z), and which way it faces
const PLACES = [
  { type: 'belt', x: 9, z: 5.2, yaw: Math.PI / 2, p: 0.95 },
  { type: 'belt', x: -9, z: 5.2, yaw: Math.PI / 2, p: 0.8 },
  { type: 'fuel', x: -1, z: 11, yaw: 0, p: 0.55 },
  { type: 'gpu', x: 15.5, z: 4.5, yaw: 0, p: 0.9 },
  { type: 'cater', x: -15, z: 6.5, yaw: Math.PI / 2, p: 0.7, wideOnly: true },
  { type: 'tug', x: 25, z: 0, yaw: Math.PI, p: 0.85 },
  { type: 'cone', x: 21.5, z: 0, yaw: 0, p: 1 },
  { type: 'cone', x: -3, z: 18.5, yaw: 0, p: 1 },
  { type: 'cone', x: -3, z: -18.5, yaw: 0, p: 1 },
  { type: 'cone', x: -21, z: 0, yaw: 0, p: 1 }
]
const GSE_MAX = 180

function hash(s) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export class Vehicles {
  constructor(scene, glowTex) {
    this.mesh = new THREE.InstancedMesh(tugGeometry(), new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: 0.5,
      metalness: 0.1 }), MAX)
    this.mesh.castShadow = true
    this.mesh.count = 0
    scene.add(this.mesh)
    const g = new THREE.BufferGeometry()
    this.lightPos = new Float32Array(MAX * 2 * 3)
    g.setAttribute('position', new THREE.BufferAttribute(this.lightPos, 3))
    this.lights = new THREE.Points(g, new THREE.PointsMaterial({ size: 5, map: glowTex, color: '#fff2d6', transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    this.lights.frustumCulled = false
    scene.add(this.lights)
    this.dummy = new THREE.Object3D()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 })
    this.gse = {}
    for (const [k, make] of Object.entries(GSE)) {
      const m = new THREE.InstancedMesh(mergeGeometries(make()), mat, k === 'cone' ? GSE_MAX * 4 : GSE_MAX)
      m.castShadow = k !== 'cone'
      m.receiveShadow = true
      m.count = 0
      m.frustumCulled = false
      scene.add(m)
      this.gse[k] = m
    }
  }

  /** Park service vehicles around every aircraft on a stand; which ones depends on the flight, so it stays stable. */
  placeGse(parked) {
    const d = this.dummy
    const counts = {}
    for (const k of Object.keys(this.gse)) counts[k] = 0
    for (const p of parked) {
      const h = hash(p.id)
      const k = p.wide ? 1.55 : 1
      const fx = Math.cos(p.h)
      const fz = Math.sin(p.h)
      PLACES.forEach((pl, i) => {
        if (pl.wideOnly && !p.wide) return
        if (((h >> (i * 3)) % 100) / 100 > pl.p) return
        const m = this.gse[pl.type]
        if (counts[pl.type] >= m.instanceMatrix.count) return
        const lx = pl.x * k
        const lz = pl.z * (pl.type === 'cone' ? k : 1 + (k - 1) * 0.7)
        d.position.set(p.x + fx * lx - fz * lz, 0, p.z + fz * lx + fx * lz)
        d.rotation.set(0, -(p.h + pl.yaw), 0)
        d.scale.setScalar(1)
        d.updateMatrix()
        m.setMatrixAt(counts[pl.type]++, d.matrix)
      })
    }
    for (const [k, m] of Object.entries(this.gse)) {
      m.count = counts[k]
      m.instanceMatrix.needsUpdate = true
    }
  }

  setVisible(on) {
    for (const m of Object.values(this.gse)) m.visible = on
  }

  /** parked: list of { id, x, z, h (heading in radians), wide } for aircraft sitting on stands. */
  update(parked, seconds, night) {
    const d = this.dummy
    let n = 0
    for (const p of parked) {
      if (n >= MAX) break
      const h = hash(p.id)
      const speed = 0.05 + (h % 7) * 0.006
      const phase = ((seconds * speed + (h % 100) / 100) % 1)
      // there and back with short pauses at each end
      const k = phase < 0.4 ? phase / 0.4 : phase < 0.5 ? 1 : phase < 0.9 ? 1 - (phase - 0.5) / 0.4 : 0
      const e = k * k * (3 - 2 * k)
      const back = phase >= 0.5 && phase < 0.9
      const fx0 = Math.cos(p.h)
      const fz0 = Math.sin(p.h)
      const sgn = h % 2 ? 1 : -1
      // start beside the rear cargo door, run out sideways from the aircraft
      const along = -(p.wide ? 14 : 9)
      const side = sgn * ((p.wide ? 9 : 6) + e * 34)
      const x = p.x + fx0 * along - fz0 * side
      const z = p.z + fz0 * along + fx0 * side
      d.position.set(x, 0, z)
      const drive = p.h + sgn * (back ? -Math.PI / 2 : Math.PI / 2)
      d.rotation.set(0, -drive, 0)
      d.updateMatrix()
      this.mesh.setMatrixAt(n, d.matrix)
      const fx = Math.cos(drive)
      const fz = Math.sin(drive)
      for (let i = 0; i < 2; i++) {
        const o = (n * 2 + i) * 3
        this.lightPos[o] = x + fx * 1.7 + (i ? 0.7 : -0.7) * -fz
        this.lightPos[o + 1] = 1.2
        this.lightPos[o + 2] = z + fz * 1.7 + (i ? 0.7 : -0.7) * fx
      }
      n++
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    this.lights.geometry.setDrawRange(0, n * 2)
    this.lights.geometry.attributes.position.needsUpdate = true
    this.lights.material.opacity = night
    this.lights.visible = night > 0.05
  }
}
