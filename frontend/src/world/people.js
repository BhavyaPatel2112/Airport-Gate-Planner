// People on the apron, for display only: a ground crew at every parked aircraft (marshaller, baggage
// handlers, fueller, engineer) in hi-vis, and at remote stands a line of passengers walking between the bus
// and the stairs while the aircraft boards or unloads. Two instanced meshes (clothes, heads), so the whole
// crowd is two draw calls; they are only drawn when the camera is close enough to see them.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import layout from '../scene/layout/stands-layout.json'

const MAX = 1600
const SIZE = 1.3 // a little larger than life, so a figure still reads from the tower view
const contact = {}
for (const s of layout.stands) contact[s.id] = s.contact

// crew spots in aircraft-local metres (+x towards the nose, +z the right-hand side), for a narrow-body
const CREW = [
  { x: 23, z: 2.5, walk: 0, vest: 0 }, // marshaller / headset at the nose
  { x: 9, z: 8.5, walk: 2.5, vest: 1 }, // baggage, forward hold
  { x: -9, z: 8.5, walk: 2.5, vest: 1 },
  { x: -10.5, z: 9.5, walk: 0, vest: 0 },
  { x: -1, z: 14.5, walk: 1.5, vest: 0 }, // fueller at the truck
  { x: 3, z: -10, walk: 4, vest: 1 }, // engineer walking round the engine
  { x: -18, z: 3, walk: 3, vest: 1, wideOnly: true }
]
const VESTS = ['#ff7a1a', '#d7f23a']
const CLOTHES = ['#2e3a5c', '#7a2d2d', '#e9e4d8', '#3d6b4f', '#c9a27a', '#4d4d52', '#8a5aa8', '#1f6f8b', '#d06a3a', '#f0c94a']
const SKIN = ['#6b4632', '#8a5a3c', '#a9764f', '#5a3a29', '#c08f6a']

function hash(s) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h
}

function bodyGeometry() {
  // legs darker than the torso: the vertex colour shades the instance colour
  const shade = (g, v) => {
    const n = g.attributes.position.count
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(v), 3))
    return g
  }
  const legL = shade(new THREE.CylinderGeometry(0.1, 0.09, 0.82, 5).translate(-0.11, 0.41, 0), 0.35)
  const legR = shade(new THREE.CylinderGeometry(0.1, 0.09, 0.82, 5).translate(0.11, 0.41, 0), 0.35)
  const torso = shade(new THREE.CylinderGeometry(0.19, 0.17, 0.72, 6).translate(0, 1.18, 0), 1)
  const arms = shade(new THREE.BoxGeometry(0.62, 0.12, 0.12).translate(0, 1.38, 0), 0.9)
  const g = mergeGeometries([legL, legR, torso, arms])
  g.scale(SIZE, SIZE, SIZE)
  return g
}

export class People {
  constructor(scene) {
    this.body = new THREE.InstancedMesh(bodyGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), MAX)
    this.head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14 * SIZE, 8, 6).translate(0, 1.7 * SIZE, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX)
    for (const m of [this.body, this.head]) {
      m.count = 0
      m.frustumCulled = false
      m.castShadow = true
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.add(m)
    }
    // the apron bus the passengers walk to or from, and the mobile stairs at the front door
    const bus = new THREE.BoxGeometry(12, 3, 2.7).translate(0, 1.75, 0)
    const stairs = new THREE.BoxGeometry(5.5, 0.9, 1.8).translate(-2.6, 0, 0).rotateZ(-0.62).translate(0, 2.2, 0)
    this.bus = new THREE.InstancedMesh(bus, new THREE.MeshStandardMaterial({ color: '#2d6fae', roughness: 0.5 }), 60)
    this.stairs = new THREE.InstancedMesh(stairs, new THREE.MeshStandardMaterial({ color: '#d8d8d4', roughness: 0.6 }), 60)
    for (const m of [this.bus, this.stairs]) {
      m.count = 0
      m.frustumCulled = false
      m.castShadow = true
      scene.add(m)
    }
    this.list = []
    this.key = ''
    this.dummy = new THREE.Object3D()
    this.col = new THREE.Color()
  }

  /** Rebuilds who stands where, when the parked aircraft or the clock minute change. */
  place(parked, minute) {
    const key = Math.floor(minute) + '|' + parked.length + '|' + (parked[0] ? parked[0].id : '')
    if (key === this.key) return
    this.key = key
    const list = []
    const kit = []
    for (const p of parked) {
      if (list.length > MAX - 20) break
      const h = hash(p.id)
      const k = p.wide ? 1.55 : 1
      const settled = p.since > 2 && p.left > 2
      if (settled) {
        CREW.forEach((c, i) => {
          if (c.wideOnly && !p.wide) return
          if (((h >> i) & 7) === 0) return
          list.push({ ...this.at(p, c.x * k, c.z * (1 + (k - 1) * 0.6)), walk: c.walk, axis: i % 2, seed: (h >> (i * 2)) & 255,
            clothes: VESTS[c.vest], skin: SKIN[(h >> i) % SKIN.length] })
        })
      }
      // remote stands: passengers between the bus and the front stairs while boarding or after arrival
      if (!contact[p.stand]) {
        const boarding = p.dep && p.left > 6 && p.left < 32
        const leaving = p.arr && p.since > 1 && p.since < 16
        if (boarding || leaving) {
          const door = this.at(p, 11 * k, -4.5 * (1 + (k - 1) * 0.5))
          const bus = this.at(p, 6 * k, -30)
          if (kit.length < 60) kit.push({ bus, door, yaw: -p.h })
          const n = p.wide ? 16 : 10
          for (let i = 0; i < n; i++) {
            list.push({ x: bus.x, z: bus.z, yaw: 0, from: boarding ? bus : door, to: boarding ? door : bus, lane: i / n,
              seed: (h >> (i % 24)) & 255, clothes: CLOTHES[(h + i * 7) % CLOTHES.length], skin: SKIN[(h + i * 3) % SKIN.length] })
          }
        }
      }
    }
    this.list = list
    const d = this.dummy
    kit.forEach((k, i) => {
      d.position.set(k.bus.x, 0, k.bus.z)
      d.rotation.set(0, k.yaw, 0)
      d.updateMatrix()
      this.bus.setMatrixAt(i, d.matrix)
      d.position.set(k.door.x, 0, k.door.z)
      d.rotation.set(0, k.yaw + Math.PI / 2, 0)
      d.updateMatrix()
      this.stairs.setMatrixAt(i, d.matrix)
    })
    this.bus.count = this.stairs.count = kit.length
    this.bus.instanceMatrix.needsUpdate = true
    this.stairs.instanceMatrix.needsUpdate = true
    this.body.count = list.length
    this.head.count = list.length
    list.forEach((q, i) => {
      this.body.setColorAt(i, this.col.set(q.clothes))
      this.head.setColorAt(i, this.col.set(q.skin))
    })
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true
    if (this.head.instanceColor) this.head.instanceColor.needsUpdate = true
  }

  at(p, lx, lz) {
    const fx = Math.cos(p.h)
    const fz = Math.sin(p.h)
    return { x: p.x + fx * lx - fz * lz, z: p.z + fz * lx + fx * lz, yaw: -p.h, fx, fz }
  }

  /** Moves everyone a little each frame: crew pace, passengers walk the line. */
  update(now, show) {
    this.body.visible = this.head.visible = show && this.list.length > 0
    this.bus.visible = this.stairs.visible = show
    if (!this.body.visible) return
    const t = now / 1000
    const d = this.dummy
    this.list.forEach((q, i) => {
      let x = q.x
      let z = q.z
      let yaw = q.yaw
      let bob = 0
      if (q.from) {
        // a steady walk along the line, everyone spaced out, looping
        const k = (t / 40 + q.lane + q.seed * 0.0007) % 1
        x = q.from.x + (q.to.x - q.from.x) * k + Math.sin(q.seed) * 0.6
        z = q.from.z + (q.to.z - q.from.z) * k + Math.cos(q.seed) * 0.6
        yaw = Math.atan2(q.to.x - q.from.x, q.to.z - q.from.z)
        bob = Math.abs(Math.sin(t * 6 + q.seed)) * 0.05
      } else if (q.walk) {
        // pacing back and forth beside the aircraft
        const s = Math.sin(t * 0.5 + q.seed)
        const dx = q.axis ? q.fx : -q.fz
        const dz = q.axis ? q.fz : q.fx
        x += dx * s * q.walk
        z += dz * s * q.walk
        yaw = Math.atan2(dx * Math.cos(t * 0.5 + q.seed), dz * Math.cos(t * 0.5 + q.seed))
        bob = Math.abs(Math.sin(t * 5 + q.seed)) * 0.04 * Math.abs(Math.cos(t * 0.5 + q.seed))
      } else {
        yaw += Math.sin(t * 0.3 + q.seed) * 0.6
      }
      d.position.set(x, bob, z)
      d.rotation.set(0, yaw, 0)
      d.updateMatrix()
      this.body.setMatrixAt(i, d.matrix)
      this.head.setMatrixAt(i, d.matrix)
    })
    this.body.instanceMatrix.needsUpdate = true
    this.head.instanceMatrix.needsUpdate = true
  }
}
