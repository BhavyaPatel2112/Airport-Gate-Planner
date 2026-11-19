// The 3D airport. Display only: every position comes from planeState(), which follows the stand
// and times chosen by the Java backend.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import layout from '../scene/layout/stands-layout.json'
import { WORLD, planeState, standIndex } from '../scene/geometry'
import { lightAt, tailColour } from '../scene/lighting'
import { clock } from '../state/clock'
import { drawGround } from './groundTexture'
import { AIRCRAFT, buildTerminals, buildBridges, toScene } from './models'

const CLAY = { bg: new THREE.Color('#d9d6d1'), building: new THREE.Color('#f7f6f3'), roof: new THREE.Color('#ffffff'),
  edge: new THREE.Color('#8f8a82'), bridge: new THREE.Color('#d9d6d0') }
const DARK = { bg: new THREE.Color('#0d0e10'), building: new THREE.Color('#565c64'), roof: new THREE.Color('#7a818a'),
  edge: new THREE.Color('#a9b1bb'), bridge: new THREE.Color('#6a7079') }
const ALT = 300

export const PRESETS = {
  overview: { target: [360, 0, 60], offset: [-60, 1500, 1560] },
  t2: { target: [700, 0, -230], offset: [-320, 330, 580] },
  t1: { target: [-430, 0, 470], offset: [60, 240, 420] },
  runway: { target: [-20, 0, 280], offset: [760, 260, 560] },
  west: { target: [20, 0, -170], offset: [-460, 280, 420] },
  intro: { target: [360, 0, 60], offset: [-1100, 3000, 3100] }
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

function radialTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function hatchTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = '#e3262f'
  g.lineWidth = 10
  for (let i = -64; i < 128; i += 22) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 2)
  return t
}

export class World3D {
  constructor(container, { onSelect, onCamera }) {
    this.container = container
    this.onSelect = onSelect
    this.onCamera = onCamera
    this.data = { visits: [], closures: [], selected: null, follow: null, effects: [], storm: null, layers: {} }
    this.theme = 0
    this.themeTarget = 1
    this.planes = new Map()
    this.labels = new Map()
    this.tween = null
    this.lastHeat = 0
    this.lastClosureKey = ''
    this.lastEffectsKey = ''
    this.effectObjs = []
    this.lastCamEmit = 0

    const w = container.clientWidth || 800
    const h = container.clientHeight || 500
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    container.appendChild(this.renderer.domElement)
    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(w, h)
    this.labelRenderer.domElement.className = 'labels3d'
    container.appendChild(this.labelRenderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = DARK.bg.clone()
    this.scene.fog = new THREE.Fog(DARK.bg.clone(), 2600, 7000)
    this.camera = new THREE.PerspectiveCamera(32, w / h, 5, 12000)
    const p = PRESETS.intro
    this.camera.position.set(p.target[0] + p.offset[0], p.offset[1], p.target[2] + p.offset[2])
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(...p.target)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = 1.36
    this.controls.minDistance = 70
    this.controls.maxDistance = 5200
    this.controls.screenSpacePanning = false
    this.controls.addEventListener('start', () => {
      this.tween = null
    })

    this.hemi = new THREE.HemisphereLight('#dfe8ff', '#20242a', 0.9)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(4096, 4096)
    const sc = this.sun.shadow.camera
    sc.left = -1700; sc.right = 1700; sc.top = 1100; sc.bottom = -1100; sc.near = 10; sc.far = 6000
    this.sun.shadow.bias = -0.0004
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.buildGround()
    this.materials = {
      building: new THREE.MeshStandardMaterial({ color: DARK.building, roughness: 0.75, metalness: 0.05 }),
      roof: new THREE.MeshStandardMaterial({ color: DARK.roof, roughness: 0.6, metalness: 0.1 }),
      edge: new THREE.LineBasicMaterial({ color: DARK.edge, transparent: true, opacity: 0.7 }),
      bridge: new THREE.MeshStandardMaterial({ color: DARK.bridge, roughness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: '#2f4150', emissive: '#9fd6ff', emissiveIntensity: 0.1, roughness: 0.3 })
    }
    this.scene.add(buildTerminals(this.materials))
    this.bridges = buildBridges(this.materials)
    for (const b of this.bridges) this.scene.add(b.pivot)
    this.planeBody = new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 0.42, metalness: 0.15 })
    this.outlineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.BackSide, transparent: true, opacity: 0.9 })
    this.hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    this.hitGeo = { narrow: new THREE.SphereGeometry(26, 10, 8), wide: new THREE.SphereGeometry(36, 10, 8) }
    this.tailMats = new Map()
    this.glowTex = radialTexture()
    this.buildLights()
    this.heatGroup = new THREE.Group()
    this.scene.add(this.heatGroup)
    this.closureGroup = new THREE.Group()
    this.scene.add(this.closureGroup)
    this.hatch = hatchTexture()
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(30, 34, 48),
      new THREE.MeshBasicMaterial({ color: '#38d7ff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }))
    this.selRing.rotation.x = -Math.PI / 2
    this.selRing.visible = false
    this.scene.add(this.selRing)

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.down = null
    const el = this.renderer.domElement
    this.onDown = (e) => { this.down = { x: e.clientX, y: e.clientY } }
    this.onUp = (e) => {
      if (!this.down) return
      const moved = Math.abs(e.clientX - this.down.x) + Math.abs(e.clientY - this.down.y)
      this.down = null
      if (moved < 5) this.pick(e)
    }
    this.onMove = (e) => this.hover(e)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointermove', this.onMove)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.clock = new THREE.Clock()
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(WORLD.w, WORLD.h)
    geo.rotateX(-Math.PI / 2)
    const cx = WORLD.x + WORLD.w / 2 - 1300
    const cz = WORLD.y + WORLD.h / 2 - 650
    const make = (theme) => {
      const tex = new THREE.CanvasTexture(drawGround(theme))
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0,
        transparent: theme === 'dark', depthWrite: theme !== 'dark' }))
      m.position.set(cx, theme === 'dark' ? 0.05 : 0, cz)
      m.receiveShadow = true
      this.scene.add(m)
      return m
    }
    this.groundClay = make('clay')
    this.groundDark = make('dark')
    // dark floor beyond the map edge, so the camera never sees the void
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 1 }))
    floor.position.y = -1
    floor.receiveShadow = true
    this.floor = floor
    this.scene.add(floor)
  }

  buildLights() {
    const pts = []
    const cols = []
    const push = (x, y, c) => {
      const [sx, sz] = toScene(x, y)
      pts.push(sx, 1.5, sz)
      cols.push(c.r, c.g, c.b)
    }
    const warm = new THREE.Color('#fff1c9')
    const blue = new THREE.Color('#4d8bff')
    for (const rw of layout.runways) {
      const [ax, ay] = rw.a
      const [bx, by] = rw.b
      const len = Math.hypot(bx - ax, by - ay)
      const ux = (bx - ax) / len
      const uy = (by - ay) / len
      for (let d = 0; d <= len; d += 36) {
        push(ax + ux * d - uy * (rw.width / 2 + 2), ay + uy * d + ux * (rw.width / 2 + 2), warm)
        push(ax + ux * d + uy * (rw.width / 2 + 2), ay + uy * d - ux * (rw.width / 2 + 2), warm)
      }
    }
    for (const t of layout.taxiways) {
      for (let i = 1; i < t.pts.length; i++) {
        const [ax, ay] = t.pts[i - 1]
        const [bx, by] = t.pts[i]
        const len = Math.hypot(bx - ax, by - ay)
        for (let d = 0; d < len; d += 34) push(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, blue)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    this.nightLights = new THREE.Points(geo, new THREE.PointsMaterial({ size: 12, map: this.glowTex, vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    this.scene.add(this.nightLights)
    this.masts = new THREE.Group()
    for (const [x, y] of [[1340, 60], [1340, 460], [1340, 860], [2330, 60], [2330, 460], [2330, 860], [1830, 860],
      [500, 1030], [900, 1030], [1300, 1030], [1640, 1130], [2000, 1130], [2330, 1130]]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffdfa0', transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }))
      const [sx, sz] = toScene(x, y)
      s.position.set(sx, 2, sz)
      s.scale.set(260, 260, 1)
      this.masts.add(s)
    }
    this.scene.add(this.masts)
  }

  setData(d) {
    Object.assign(this.data, d)
  }

  setClay(on) {
    this.themeTarget = on ? 0 : 1
  }

  playIntro() {
    this.theme = 0
    this.themeTarget = 0
    this.flyTo('overview', 3400)
    setTimeout(() => { this.themeTarget = 1 }, 1600)
  }

  /** Fly the camera to a preset name or to a stand id. */
  flyTo(spec, duration = 1600) {
    let target
    let offset
    if (PRESETS[spec]) {
      target = PRESETS[spec].target
      offset = PRESETS[spec].offset
    } else if (standIndex[spec]) {
      const s = standIndex[spec]
      const [x, z] = toScene(s.x, s.y)
      target = [x, 0, z]
      offset = [-160, 190, 260]
    } else {
      return
    }
    this.tween = {
      t0: performance.now(), dur: duration,
      fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(),
      toPos: new THREE.Vector3(target[0] + offset[0], offset[1], target[2] + offset[2]),
      toTarget: new THREE.Vector3(...target)
    }
  }

  zoom(f) {
    const dir = this.camera.position.clone().sub(this.controls.target)
    dir.multiplyScalar(f)
    this.camera.position.copy(this.controls.target).add(dir)
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  tailMat(code) {
    if (!this.tailMats.has(code)) {
      this.tailMats.set(code, new THREE.MeshStandardMaterial({ color: tailColour(code), roughness: 0.5 }))
    }
    return this.tailMats.get(code)
  }

  planeFor(v) {
    let p = this.planes.get(v.id)
    if (!p) {
      const g = AIRCRAFT[v.size === 'WIDE' ? 'wide' : 'narrow']
      const group = new THREE.Group()
      const body = new THREE.Mesh(g.body, this.planeBody)
      body.castShadow = true
      body.userData.visitId = v.id
      const tail = new THREE.Mesh(g.tail, this.tailMat(v.airlineCode))
      tail.castShadow = true
      tail.userData.visitId = v.id
      group.add(body, tail)
      const outline = new THREE.Mesh(g.body, this.outlineMat)
      outline.scale.setScalar(1.12)
      outline.visible = false
      group.add(outline)
      const halo = new THREE.Mesh(new THREE.TorusGeometry(36, 1.4, 8, 40),
        new THREE.MeshBasicMaterial({ color: '#ff4d4d', transparent: true, opacity: 0.85 }))
      halo.rotation.x = Math.PI / 2
      halo.visible = false
      group.add(halo)
      const hit = new THREE.Mesh(this.hitGeo[v.size === 'WIDE' ? 'wide' : 'narrow'], this.hitMat)
      hit.position.y = 5
      hit.userData.visitId = v.id
      group.add(hit)
      this.scene.add(group)
      p = { group, body, tail, outline, halo, hit }
      this.planes.set(v.id, p)
    }
    return p
  }

  labelFor(id, text, cls) {
    let l = this.labels.get(id)
    if (!l) {
      const div = document.createElement('div')
      div.className = 'label3d'
      l = new CSS2DObject(div)
      l.center.set(-0.15, 1.6)
      this.scene.add(l)
      this.labels.set(id, l)
    }
    if (l.element.textContent !== text) l.element.textContent = text
    l.element.className = 'label3d ' + (cls || '')
    return l
  }

  updatePlanes(minute) {
    const { visits, selected, layers } = this.data
    const seen = new Set()
    const docked = new Set()
    this.pickables = []
    for (const v of visits) {
      const st = planeState(v, minute)
      if (!st) continue
      seen.add(v.id)
      const p = this.planeFor(v)
      const [x, z] = toScene(st.x, st.y)
      const alt = (st.alt || 0) * ALT
      p.group.visible = true
      p.group.position.set(x, alt, z)
      p.group.rotation.set(0, -(st.heading * Math.PI) / 180, 0)
      if (st.phase === 'approach') p.group.rotation.z = -0.06
      if (st.phase === 'climb') p.group.rotation.z = 0.14
      const op = st.opacity ?? 1
      p.body.material = this.planeBody
      p.group.scale.setScalar(op < 1 ? 0.6 + 0.4 * op : 1)
      p.outline.visible = v.id === selected
      p.halo.visible = !!st.unplaced
      if (st.phase === 'parked' && v.stand) docked.add(v.stand)
      this.pickables.push(p.hit)
      const moving = st.phase !== 'parked'
      if (v.id === selected || (layers.labels && moving)) {
        const text = v.arrival && ['approach', 'rollout', 'taxi-in', 'holding'].includes(st.phase) ? v.arrival.number
          : v.departure ? v.departure.number : v.label
        const l = this.labelFor(v.id, text, (st.unplaced ? 'bad' : '') + (v.id === selected ? ' sel' : ''))
        l.position.set(x, alt + 14, z)
        l.visible = true
      } else if (this.labels.has(v.id)) {
        this.labels.get(v.id).visible = false
      }
      if (v.id === selected) {
        this.selRing.visible = true
        this.selRing.position.set(x, 0.6, z)
        this.selectedPos = new THREE.Vector3(x, alt, z)
      }
    }
    if (!selected || !seen.has(selected)) {
      this.selRing.visible = false
      this.selectedPos = null
    }
    for (const [id, p] of this.planes) {
      if (!seen.has(id)) p.group.visible = false
    }
    for (const [id, l] of this.labels) {
      if (!seen.has(id)) l.visible = false
    }
    for (const b of this.bridges) {
      const want = docked.has(b.id) ? b.full : 7
      b.box.scale.x += (want - b.box.scale.x) * 0.12
    }
  }

  updateClosures(minute) {
    const active = this.data.layers.closures === false ? [] : this.data.closures.filter((c) => c.from <= minute && minute < c.to)
    const key = active.map((c) => c.standId).sort().join(',')
    if (key === this.lastClosureKey) return
    this.lastClosureKey = key
    this.closureGroup.clear()
    const seen = new Set()
    for (const c of active) {
      const s = standIndex[c.standId]
      if (!s || seen.has(c.standId)) continue
      seen.add(c.standId)
      const size = s.size === 'WIDE' ? 58 : 44
      const geo = new THREE.PlaneGeometry(size, size)
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.hatch, transparent: true, opacity: 0.8 }))
      m.rotation.x = -Math.PI / 2
      m.rotation.z = -(s.heading * Math.PI) / 180
      const [x, z] = toScene(s.x, s.y)
      m.position.set(x, 0.8, z)
      this.closureGroup.add(m)
      const post = new THREE.Mesh(new THREE.BoxGeometry(size, 5, 1.5), new THREE.MeshStandardMaterial({ color: '#e3262f', emissive: '#e3262f', emissiveIntensity: 0.4 }))
      post.position.set(x, 2.5, z)
      post.rotation.y = -(s.heading * Math.PI) / 180 + Math.PI / 2
      this.closureGroup.add(post)
    }
  }

  updateHeat(minute) {
    const on = !!this.data.layers.heat
    this.heatGroup.visible = on
    if (!on || performance.now() - this.lastHeat < 800) return
    this.lastHeat = performance.now()
    const busy = {}
    const from = minute - 30
    const to = minute + 90
    for (const v of this.data.visits) {
      if (!v.stand || v.cancelled) continue
      const s = Math.max(from, v.start)
      const e = Math.min(to, v.end + v.buffer)
      if (e > s) busy[v.stand] = (busy[v.stand] || 0) + (e - s)
    }
    this.heatGroup.clear()
    const col = new THREE.Color()
    for (const s of layout.stands) {
      const k = Math.min(1, (busy[s.id] || 0) / (to - from))
      if (k <= 0.02) continue
      col.setHSL(0.33 - 0.33 * k, 0.9, 0.5)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col.clone(), transparent: true,
        opacity: 0.25 + 0.5 * k, depthWrite: false, blending: THREE.AdditiveBlending }))
      const [x, z] = toScene(s.x, s.y)
      sp.position.set(x, 3, z)
      sp.scale.set(70 + 50 * k, 70 + 50 * k, 1)
      this.heatGroup.add(sp)
    }
  }

  updateEffects(now) {
    const effects = this.data.effects || []
    const key = effects.length ? effects[0].t0 + ':' + effects.length : ''
    if (key !== this.lastEffectsKey) {
      this.lastEffectsKey = key
      for (const o of this.effectObjs) this.scene.remove(o.obj)
      this.effectObjs = []
      for (const e of effects.slice(0, 30)) {
        const a = e.from && standIndex[e.from]
        const b = e.to && standIndex[e.to]
        if (a && b) {
          const [ax, az] = toScene(a.x, a.y)
          const [bx, bz] = toScene(b.x, b.y)
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, 4, az),
            new THREE.Vector3((ax + bx) / 2, 90 + Math.hypot(bx - ax, bz - az) * 0.25, (az + bz) / 2), new THREE.Vector3(bx, 4, bz))
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 1.3, 6),
            new THREE.MeshBasicMaterial({ color: '#38d7ff', transparent: true, opacity: 0.95 }))
          this.scene.add(tube)
          this.effectObjs.push({ obj: tube, t0: e.t0, kind: 'arc' })
        }
        for (const [s, colr] of [[a, e.kind === 'unplaced' ? '#ff4d4d' : '#ffb020'], [b, '#3ddc84']]) {
          if (!s) continue
          const ring = new THREE.Mesh(new THREE.RingGeometry(22, 27, 40),
            new THREE.MeshBasicMaterial({ color: colr, transparent: true, side: THREE.DoubleSide }))
          ring.rotation.x = -Math.PI / 2
          const [x, z] = toScene(s.x, s.y)
          ring.position.set(x, 1.2, z)
          this.scene.add(ring)
          this.effectObjs.push({ obj: ring, t0: e.t0, kind: 'ring' })
        }
      }
    }
    for (const o of this.effectObjs) {
      const age = (now - o.t0) / 1000
      const fade = Math.max(0, 1 - age / 6)
      o.obj.material.opacity = fade * (o.kind === 'arc' ? 0.95 : 0.9)
      o.obj.visible = fade > 0
      if (o.kind === 'ring') o.obj.scale.setScalar(1 + (age % 1) * 0.8)
    }
  }

  updateLighting(minute, dt) {
    this.theme += (this.themeTarget - this.theme) * Math.min(1, dt * 1.4)
    const t = this.theme
    const L = lightAt(minute)
    const storm = this.data.storm && minute >= this.data.storm.from - 20 && minute <= this.data.storm.to + 20
    const darkBg = DARK.bg.clone().lerp(new THREE.Color(L.horizon), storm ? 0.06 : 0.16)
    const bg = CLAY.bg.clone().lerp(darkBg, t)
    this.scene.background.copy(bg)
    this.scene.fog.color.copy(bg)
    this.scene.fog.near = storm ? 900 : 2600
    this.scene.fog.far = storm ? 3600 : 7000
    this.floor.material.color.copy(new THREE.Color('#cfcbc4').lerp(new THREE.Color('#16181b'), t))
    this.planeBody.color.copy(new THREE.Color('#d9dce0').lerp(new THREE.Color('#eef1f4'), t))
    this.groundDark.material.opacity = t
    this.groundClay.visible = t < 0.999
    this.materials.building.color.copy(CLAY.building.clone().lerp(DARK.building, t))
    this.materials.roof.color.copy(CLAY.roof.clone().lerp(DARK.roof, t))
    this.materials.edge.color.copy(CLAY.edge.clone().lerp(DARK.edge, t))
    this.materials.bridge.color.copy(CLAY.bridge.clone().lerp(DARK.bridge, t))
    const night = storm ? Math.max(0.5, L.night) : L.night
    const dayK = (1 - L.darkness) * (storm ? 0.55 : 1)
    // sun direction follows the clock; at night a cool moonlight from the west
    const sh = L.shadow
    const len = Math.hypot(sh.dx, sh.dy) || 1
    const dir = sh.opacity > 0 ? [-sh.dx / len, -sh.dy / len] : [-0.6, -0.4]
    const elev = sh.opacity > 0 ? Math.max(0.35, 1.6 - len / 10) : 0.9
    this.sun.position.set(dir[0] * 1800, 1800 * elev, dir[1] * 1800)
    this.sun.intensity = (0.5 + 2.6 * dayK) * t + (1 - t) * 2.6
    this.sun.color.set(sh.opacity > 0 && len > 9 ? '#ffd9b0' : '#ffffff')
    this.hemi.intensity = (0.7 + 0.9 * dayK) * (0.45 + 0.55 * t) + (1 - t) * 0.35
    this.renderer.toneMappingExposure = 0.95 + 0.3 * t
    this.nightLights.material.opacity = night * t
    this.nightLights.visible = night * t > 0.02
    for (const m of this.masts.children) m.material.opacity = 0.45 * night * t
    this.materials.glass.emissiveIntensity = 0.1 + 0.8 * night
  }

  updateCamera(now) {
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur)
      const e = ease(k)
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e)
      if (k >= 1) this.tween = null
    } else if (this.data.follow && this.selectedPos) {
      const delta = this.selectedPos.clone().sub(this.controls.target).multiplyScalar(0.12)
      this.controls.target.add(delta)
      this.camera.position.add(delta)
    }
    this.controls.update()
    if (now - this.lastCamEmit > 120 && this.onCamera) {
      this.lastCamEmit = now
      this.onCamera({
        azimuth: this.controls.getAzimuthalAngle(),
        distance: this.camera.position.distanceTo(this.controls.target)
      })
    }
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.1, this.clock.getDelta())
    const now = performance.now()
    const minute = clock.get().minute
    this.updateLighting(minute, dt)
    this.updatePlanes(minute)
    this.updateClosures(minute)
    this.updateHeat(minute)
    this.updateEffects(now)
    this.updateCamera(now)
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  ray(e) {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables || [], false)
    if (!hits.length) return null
    // prefer the aircraft whose centre is closest to the ray, not just the first sphere hit
    let best = hits[0]
    let bestD = Infinity
    for (const h of hits.slice(0, 6)) {
      const c = h.object.getWorldPosition(new THREE.Vector3())
      const d = this.raycaster.ray.distanceSqToPoint(c)
      if (d < bestD) { bestD = d; best = h }
    }
    return best.object.userData.visitId
  }

  pick(e) {
    this.onSelect(this.ray(e))
  }

  hover(e) {
    if (this.down) return
    this.renderer.domElement.style.cursor = this.ray(e) ? 'pointer' : 'grab'
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointermove', this.onMove)
    this.controls.dispose()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }
}
