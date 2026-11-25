// The 3D airport. Display only: every aircraft position comes from planeState(), which follows the
// stand and times chosen by the Java backend.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import layout from '../scene/layout/stands-layout.json'
import { WORLD, planeState, standIndex, HOLDING_PATTERN } from '../scene/geometry'
import { tailColour } from '../scene/lighting'
import { clock } from '../state/clock'
import { paintGround } from './ground'
import { AIRCRAFT, liveryTexture } from './aircraft'
import { buildStandMarks } from './stands'
import { buildFence } from './perimeter'
import { buildTerminals, buildBridges, buildingMaterials, toScene } from './buildings'
import { Vehicles } from './vehicles'
import { People } from './people'
import { Environment, addCloudShadows, clipAtShore } from './environment'

const ALT = 320

export const PRESETS = {
  overview: { target: [380, 0, 40], offset: [-220, 1180, 1500] },
  // a control tower eye view across Terminal 2, lower and closer: the opening view
  tower: { target: [520, 0, -170], offset: [-600, 290, 800] },
  t2: { target: [600, 0, -260], offset: [-380, 300, 520] },
  t1: { target: [-430, 0, 520], offset: [120, 230, 400] },
  runway: { target: [180, 0, 280], offset: [700, 190, 470] },
  west: { target: [40, 0, -170], offset: [-440, 260, 400] },
  intro: { target: [380, 0, 40], offset: [-900, 5200, 5600] }
}

const MARK_TONES = { free: '#46e39a', chosen: '#7ff0b9', busy: '#ff8a7e', closed: '#8a93a3', cut: '#ffb547' }

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const lerp = (a, b, k) => a + (b - a) * k
const C = (h) => new THREE.Color(h)

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function hatchTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(255,77,77,0.18)'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = 'rgba(255,90,90,0.9)'
  g.lineWidth = 5
  for (let i = -64; i < 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}

export class AirportWorld {
  constructor(container, { onSelect, onCamera, quality = 'high' } = {}) {
    this.container = container
    this.onSelect = onSelect
    this.onCamera = onCamera
    this.data = { visits: [], closures: [], selected: null, follow: null, effects: [], storm: null, layers: { labels: true, closures: true, vehicles: true } }
    this.planes = new Map()
    this.labels = new Map()
    this.moves = new Map() // visit id -> { from, to, t0 } while an aircraft is towed to its new stand
    // during the guided replay of a fix: visit id -> { prev, until } for flights still shown as they were before it
    this.pending = new Map()
    this.tween = null
    this.lastHeat = 0
    this.lastClosureKey = ''
    this.lastEffectsKey = ''
    this.effectObjs = []
    this.lastCamEmit = 0
    this.hovered = null
    this.fps = { frames: 0, t0: performance.now(), low: 0 }

    const w = container.clientWidth || 800
    const h = container.clientHeight || 500
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false })
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    container.appendChild(this.renderer.domElement)
    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(w, h)
    this.labelRenderer.domElement.className = 'world-labels'
    container.appendChild(this.labelRenderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(30, w / h, 5, 50000)
    const p = PRESETS.intro
    this.camera.position.set(p.target[0] + p.offset[0], p.offset[1], p.target[2] + p.offset[2])
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(...p.target)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.maxPolarAngle = 1.32
    this.controls.minDistance = 60
    this.controls.maxDistance = 5200
    this.controls.screenSpacePanning = false
    this.controls.zoomSpeed = 0.8
    this.controls.addEventListener('start', () => { this.tween = null })

    this.glowTex = glowTexture()
    this.env = new Environment(this.scene, this.renderer, this.glowTex)
    this.sun = this.env.sun
    this.hemi = this.env.hemi
    this.buildGround()
    this.scene.add(buildStandMarks())
    this.scene.add(buildFence())
    addCloudShadows(this.groundMat, this.env.uniforms)
    // the airfield ground plane is wider than the land on its west side; cut it at the coast
    clipAtShore(this.groundMat)
    this.materials = buildingMaterials()
    this.scene.add(buildTerminals(this.materials))
    this.bridges = buildBridges(this.materials)
    for (const b of this.bridges) this.scene.add(b.pivot)
    this.livery = liveryTexture()
    this.planeMat = new THREE.MeshStandardMaterial({ map: this.livery, vertexColors: true, roughness: 0.36, metalness: 0.12,
      envMapIntensity: 0.9, color: '#e9ecef' })
    // aircraft with no stand: a normal airliner with a soft red tint, circling in the holding stack
    this.ghostMat = new THREE.MeshStandardMaterial({ map: this.livery, vertexColors: true, color: '#ffd9d4', emissive: '#ff3b30',
      emissiveIntensity: 0.12, roughness: 0.4, metalness: 0.1 })
    this.outlineMat = new THREE.MeshBasicMaterial({ color: '#7cc4ff', side: THREE.BackSide, transparent: true, opacity: 0.95 })
    this.hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    this.hitGeo = { narrow: new THREE.SphereGeometry(24, 10, 8), wide: new THREE.SphereGeometry(34, 10, 8) }
    this.tailMats = new Map()
    this.bodyMats = new Map()
    this.buildLights()
    this.buildNavLights()
    this.vehicles = new Vehicles(this.scene, this.glowTex)
    this.people = new People(this.scene)
    this.heatGroup = new THREE.Group()
    this.scene.add(this.heatGroup)
    this.closureGroup = new THREE.Group()
    this.scene.add(this.closureGroup)
    this.hatch = hatchTexture()
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(30, 32.5, 64),
      new THREE.MeshBasicMaterial({ color: '#7cc4ff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
    this.selRing.rotation.x = -Math.PI / 2
    this.selRing.visible = false
    this.scene.add(this.selRing)
    this.buildHoldingRing()
    // rings under every aircraft the latest repair moved (green) or could not place (red)
    this.chgRings = new THREE.InstancedMesh(new THREE.RingGeometry(17, 20.5, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), 400)
    this.chgRings.count = 0
    this.chgRings.frustumCulled = false
    this.chgRings.setColorAt(0, new THREE.Color('#fff'))
    this.scene.add(this.chgRings)

    this.setupPost(w, h, quality)
    // compile every shader before the first frame, so the opening flight does not stutter
    this.env.update(clock.get().minute, false)
    this.renderer.compile(this.scene, this.camera)
    this.bornAt = performance.now()

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.down = null
    const el = this.renderer.domElement
    this.onDown = (e) => { this.down = { x: e.clientX, y: e.clientY } }
    this.onUp = (e) => {
      if (!this.down) return
      const moved = Math.abs(e.clientX - this.down.x) + Math.abs(e.clientY - this.down.y)
      this.down = null
      if (moved < 5) this.onSelect && this.onSelect(this.ray(e))
    }
    this.onMove = (e) => this.hover(e)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointermove', this.onMove)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.loop = this.loop.bind(this)
    if (import.meta.env.DEV) window.__world = this
    this.raf = requestAnimationFrame(this.loop)
  }

  setupPost(w, h, quality) {
    const rt = new THREE.WebGLRenderTarget(w * this.pixelRatio, h * this.pixelRatio, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.setPixelRatio(this.pixelRatio)
    this.composer.setSize(w, h)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.gtao = new GTAOPass(this.scene, this.camera, w, h)
    this.gtao.output = GTAOPass.OUTPUT.Default
    this.gtao.blendIntensity = 0.85
    this.gtao.updateGtaoMaterial({ radius: 9, distanceExponent: 1.4, thickness: 3, scale: 1.2, samples: 12 })
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
    this.gtao.enabled = quality === 'high'
    // keep glows, labels, sprites and see-through overlays out of the ambient occlusion pass
    this.gtao._overrideVisibility = function () {
      const cache = this._visibilityCache
      this.scene.traverse((o) => {
        if (!o.visible) return
        if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (o.isMesh && o.material && o.material.transparent)) {
          o.visible = false
          cache.push(o)
        }
      })
    }
    this.composer.addPass(this.gtao)
    // move arcs and rings: drawn after the ambient occlusion pass, on top of the scene
    this.fxScene = new THREE.Scene()
    const fxPass = new RenderPass(this.fxScene, this.camera)
    fxPass.clear = false
    fxPass.clearDepth = true
    this.composer.addPass(fxPass)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.4, 1.05)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    // a light grade on the final image: a little more contrast and colour, so daylight does not look washed out
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, contrast: { value: 1.1 }, saturation: { value: 1.12 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          vec3 x = (c.rgb - 0.5) * contrast + 0.5;
          float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(clamp(mix(vec3(l), x, saturation), 0.0, 1.0), c.a);
        }`
    })
    this.composer.addPass(this.grade)
    this.quality = quality
  }

  setQuality(q) {
    this.quality = q
    this.gtao.enabled = q === 'high'
    const pr = q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    if (pr !== this.pixelRatio) {
      this.pixelRatio = pr
      this.renderer.setPixelRatio(pr)
      this.composer.setPixelRatio(pr)
      this.resize()
    }
    const size = q === 'high' ? 4096 : 2048
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size)
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null }
    }
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(WORLD.w, WORLD.h)
    geo.rotateX(-Math.PI / 2)
    const tex = new THREE.CanvasTexture(paintGround())
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    tex.generateMipmaps = true
    this.groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.4 })
    const m = new THREE.Mesh(geo, this.groundMat)
    m.position.set(WORLD.x + WORLD.w / 2 - 1300, 0, WORLD.y + WORLD.h / 2 - 650)
    m.receiveShadow = true
    this.scene.add(m)
  }

  buildLights() {
    const pts = []
    const cols = []
    const push = (x, y, c, h = 0.8) => {
      const [sx, sz] = toScene(x, y)
      pts.push(sx, h, sz)
      cols.push(c.r, c.g, c.b)
    }
    const edge = C('#ffe7b8')
    const blue = C('#3d7bff')
    const green = C('#4dff9a')
    const red = C('#ff4040')
    for (const rw of layout.runways) {
      const [ax, ay] = rw.a
      const [bx, by] = rw.b
      const len = Math.hypot(bx - ax, by - ay)
      const ux = (bx - ax) / len
      const uy = (by - ay) / len
      for (let d = 0; d <= len; d += 22) {
        push(ax + ux * d - uy * (rw.width / 2 + 1.5), ay + uy * d + ux * (rw.width / 2 + 1.5), edge)
        push(ax + ux * d + uy * (rw.width / 2 + 1.5), ay + uy * d - ux * (rw.width / 2 + 1.5), edge)
      }
      for (let i = -6; i <= 6; i++) {
        push(ax - ux * 2 - uy * i * 2.6, ay - uy * 2 + ux * i * 2.6, green)
        push(bx + ux * 2 - uy * i * 2.6, by + uy * 2 + ux * i * 2.6, red)
      }
      // approach lights out over the sea and the city
      for (let d = 30; d < 300; d += 30) {
        for (const off of [-6, 0, 6]) push(bx + ux * d - uy * off, by + uy * d + ux * off, edge, 1.2)
      }
    }
    for (const t of layout.taxiways) {
      for (let i = 1; i < t.pts.length; i++) {
        const [ax, ay] = t.pts[i - 1]
        const [bx, by] = t.pts[i]
        const len = Math.hypot(bx - ax, by - ay)
        for (let d = 0; d < len; d += 14) {
          const x = ax + ((bx - ax) * d) / len
          const y = ay + ((by - ay) * d) / len
          const nx = -(by - ay) / len
          const ny = (bx - ax) / len
          push(x + nx * 10, y + ny * 10, blue, 0.6)
          push(x - nx * 10, y - ny * 10, blue, 0.6)
        }
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    this.fieldLights = new THREE.Points(geo, new THREE.PointsMaterial({ size: 6, map: this.glowTex, vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    this.scene.add(this.fieldLights)
    // apron flood light pools on the ground and the lamps on their masts
    this.pools = new THREE.Group()
    const poolMat = new THREE.MeshBasicMaterial({ map: this.glowTex, color: '#fff0d8', transparent: true, opacity: 0.0,
      depthWrite: false, blending: THREE.AdditiveBlending })
    const lampMat = new THREE.SpriteMaterial({ map: this.glowTex, color: '#fff0d0', transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending })
    this.poolMat = poolMat
    this.lampMat = lampMat
    const masts = []
    for (let x = 1360; x <= 2330; x += 120) for (const y of [70, 860]) masts.push([x, y])
    for (const y of [180, 330, 480, 630, 760]) { masts.push([1350, y]); masts.push([2330, y]) }
    for (let x = 480; x <= 1400; x += 130) masts.push([x, 1030])
    for (let x = 1600; x <= 2330; x += 120) masts.push([x, 1124])
    const mastGeo = new THREE.CylinderGeometry(0.5, 0.8, 30, 6)
    mastGeo.translate(0, 15, 0)
    const mastMat = new THREE.MeshStandardMaterial({ color: '#5b6470', roughness: 0.6 })
    const poolGeo = new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2)
    for (const [x, y] of masts) {
      const [sx, sz] = toScene(x, y)
      const pool = new THREE.Mesh(poolGeo, poolMat)
      pool.position.set(sx, 0.3, sz)
      this.pools.add(pool)
      const mast = new THREE.Mesh(mastGeo, mastMat)
      mast.position.set(sx, 0, sz)
      this.pools.add(mast)
      const lamp = new THREE.Sprite(lampMat)
      lamp.position.set(sx, 30, sz)
      lamp.scale.set(7, 7, 1)
      this.pools.add(lamp)
    }
    this.scene.add(this.pools)
  }

  buildNavLights() {
    const MAX = 400
    const mk = (size, count) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: this.glowTex, vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
      p.frustumCulled = false
      this.scene.add(p)
      return p
    }
    this.nav = mk(5, MAX * 3)
    this.landing = mk(26, MAX)
  }

  buildHoldingRing() {
    const H = HOLDING_PATTERN
    const pts = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const [x, z] = toScene(H.cx + H.rx * Math.cos(a), H.cy + H.ry * Math.sin(a))
      pts.push(new THREE.Vector3(x, 0.5 * ALT, z))
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    this.holdRing = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#ff8a7e', dashSize: 10, gapSize: 14,
      transparent: true, opacity: 0.35 }))
    this.holdRing.computeLineDistances()
    this.holdRing.visible = false
    this.scene.add(this.holdRing)
  }

  setData(d) {
    if (this.skipNextDiff && d.visits && d.visits !== this.data.visits) {
      // the guided replay shows the changes one at a time instead
      this.skipNextDiff = false
      Object.assign(this.data, d)
      return
    }
    if (d.visits && d.visits !== this.data.visits && this.data.visits.length) {
      // a new plan: tow every parked aircraft whose stand changed, so the change can be seen
      const prev = new Map()
      for (const v of this.data.visits) prev.set(v.id, v)
      const t0 = performance.now()
      let n = 0
      for (const v of d.visits) {
        const p = prev.get(v.id)
        if (p && p.stand !== v.stand && n < 120) {
          this.moves.set(v.id, { from: p.stand, prev: p, t0: t0 + Math.min(1800, n * 70), dur: 2600 })
          n++
        }
      }
    }
    Object.assign(this.data, d)
  }

  /** Tow (or land) one aircraft from where it was in an earlier plan to where it is now. */
  replayMove(visitId, prevVisit, dur = 3200, delay = 0) {
    this.moves.set(visitId, { from: prevVisit.stand, prev: prevVisit, t0: performance.now() + 600 + delay, dur })
  }

  /** Show these flights as they were in the earlier plan (until the given minute, when one is set). */
  setPending(map) {
    this.pending = map || new Map()
    for (const id of this.pending.keys()) this.moves.delete(id)
  }

  /** Fly the camera so every listed stand is in view, from wherever it is now. */
  frameStands(ids, duration = 1800, withHolding = false) {
    const pts = ids.map((id) => standIndex[id]).filter(Boolean).map((st) => toScene(st.x, st.y))
    if (withHolding) {
      const H = HOLDING_PATTERN
      pts.push(toScene(H.cx - H.rx * 0.7, H.cy), toScene(H.cx + H.rx * 0.7, H.cy))
    }
    if (!pts.length) return
    let cx = 0
    let cz = 0
    for (const [x, z] of pts) { cx += x; cz += z }
    cx /= pts.length
    cz /= pts.length
    let ext = 0
    for (const [x, z] of pts) ext = Math.max(ext, Math.hypot(x - cx, z - cz))
    const D = Math.max(330, Math.min(2300, ext * 2.1 + 260))
    // keep the current compass direction, so the view does not spin around
    const dir = this.camera.position.clone().sub(this.controls.target).setY(0)
    if (dir.lengthSq() < 1) dir.set(-0.4, 0, 1)
    dir.normalize()
    if (withHolding && !ids.length) {
      // only the holding stack: look across at the circling aircraft, not down at the ground below them
      const ty = 0.65 * ALT
      const d = 1000
      this.flyTo({ target: [cx, ty, cz], offset: [dir.x * d, ty + 260, dir.z * d] }, duration)
      return
    }
    this.flyTo({ target: [cx, 0, cz], offset: [dir.x * D * 0.85, D * 0.72, dir.z * D * 0.85] }, duration)
  }

  playIntro(duration = 4200) {
    this.flyTo('tower', duration)
  }

  /** Fly the camera to a preset, a stand id, or { target, offset }. */
  flyTo(spec, duration = 1800) {
    let target
    let offset
    if (spec && typeof spec === 'object') {
      target = spec.target
      offset = spec.offset
    } else if (PRESETS[spec]) {
      target = PRESETS[spec].target
      offset = PRESETS[spec].offset
    } else if (standIndex[spec]) {
      const s = standIndex[spec]
      const [x, z] = toScene(s.x, s.y)
      target = [x, 0, z]
      offset = [-150, 150, 220]
    } else {
      return
    }
    if (this.roam) this.setRoam(false)
    const toPos = new THREE.Vector3(target[0] + offset[0], offset[1], target[2] + offset[2])
    const fromPos = this.camera.position.clone()
    this.tween = {
      t0: performance.now(), dur: duration, fromPos, fromTarget: this.controls.target.clone(), toPos,
      toTarget: new THREE.Vector3(...target), lift: Math.min(900, fromPos.distanceTo(toPos) * 0.18)
    }
  }

  zoom(f) {
    const dir = this.camera.position.clone().sub(this.controls.target)
    this.tween = {
      t0: performance.now(), dur: 500, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(),
      toPos: this.controls.target.clone().add(dir.multiplyScalar(f)), toTarget: this.controls.target.clone(), lift: 0
    }
  }

  /** Space covered by side panels (px), so the view centres on the part of the screen that is free. */
  setInsets(right) {
    this.insetRight = right
    this.resize()
  }

  applyViewOffset() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const r = this.insetRight || 0
    if (r > 0) {
      this.camera.aspect = (w + r) / h
      this.camera.setViewOffset(w + r, h, r, 0, w, h)
    } else {
      this.camera.aspect = w / h
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.applyViewOffset()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  /** Fuselage material in the airline's livery, made once per airline. */
  bodyMat(v) {
    const code = v.airlineCode || 'XX'
    if (!this.bodyMats.has(code)) {
      this.bodyMats.set(code, new THREE.MeshStandardMaterial({ map: liveryTexture(code, v.airline, tailColour(code)), vertexColors: true,
        roughness: 0.34, metalness: 0.12, envMapIntensity: 0.9, color: '#eef0f2' }))
    }
    return this.bodyMats.get(code)
  }

  tailMat(code) {
    if (!this.tailMats.has(code)) {
      this.tailMats.set(code, new THREE.MeshStandardMaterial({ color: tailColour(code), roughness: 0.35, metalness: 0.1 }))
    }
    return this.tailMats.get(code)
  }

  planeFor(v) {
    let p = this.planes.get(v.id)
    if (p && p.size !== v.size) {
      this.scene.remove(p.group)
      this.planes.delete(v.id)
      p = null
    }
    if (!p) {
      const g = AIRCRAFT[v.size === 'WIDE' ? 'wide' : 'narrow']
      const group = new THREE.Group()
      const body = new THREE.Mesh(g.body, this.bodyMat(v))
      body.castShadow = true
      body.receiveShadow = true
      const tail = new THREE.Mesh(g.tail, this.tailMat(v.airlineCode))
      tail.castShadow = true
      group.add(body, tail)
      const outline = new THREE.Mesh(g.body, this.outlineMat)
      outline.scale.setScalar(1.08)
      outline.visible = false
      group.add(outline)
      const hit = new THREE.Mesh(this.hitGeo[v.size === 'WIDE' ? 'wide' : 'narrow'], this.hitMat)
      hit.position.y = 4
      hit.visible = false
      hit.userData.visitId = v.id
      group.add(hit)
      this.scene.add(group)
      p = { group, body, tail, outline, hit, size: v.size, span: g.span, len: g.len }
      this.planes.set(v.id, p)
    }
    return p
  }

  labelFor(id) {
    let l = this.labels.get(id)
    if (!l) {
      const div = document.createElement('div')
      div.className = 'wl'
      div.innerHTML = '<i></i><b></b><span></span>'
      l = new CSS2DObject(div)
      l.center.set(0.5, 1.35)
      this.scene.add(l)
      this.labels.set(id, l)
    }
    return l
  }

  setLabel(l, title, sub, cls) {
    const el = l.element
    if (el.dataset.t !== title) { el.children[1].textContent = title; el.dataset.t = title }
    if (el.dataset.s !== sub) { el.children[2].textContent = sub; el.dataset.s = sub }
    const c = 'wl ' + cls
    if (el.className !== c) el.className = c
  }

  updatePlanes(minute, night) {
    const now = performance.now()
    const { selected, layers } = this.data
    const pend = this.pending
    // flights the guided replay has not fixed yet are drawn as they were before the fix
    const visits = pend.size ? this.data.visits.map((v) => {
      const p = pend.get(v.id)
      if (p && p.until != null && minute >= p.until && !p.blended) {
        // its wait is over: glide from wherever it is drawn now onto its new path, instead of jumping there
        p.blended = true
        const pl = this.planes.get(v.id)
        if (pl && pl.group.visible) {
          this.moves.set(v.id, { fixed: { x: pl.group.position.x, z: pl.group.position.z, alt: pl.group.position.y, h: -pl.group.rotation.y },
            t0: now, dur: 2200 })
        }
      }
      return p && (p.until == null || minute < p.until) ? p.prev : v
    }) : this.data.visits
    let ri = 0
    const ringM = this._ringM || (this._ringM = new THREE.Matrix4())
    const green = this._green || (this._green = new THREE.Color('#46e39a'))
    const red = this._red || (this._red = new THREE.Color('#ff5a4e'))
    const seen = new Set()
    const docked = new Set()
    const parked = []
    const navPos = this.nav.geometry.attributes.position.array
    const navCol = this.nav.geometry.attributes.color.array
    const lanPos = this.landing.geometry.attributes.position.array
    const lanCol = this.landing.geometry.attributes.color.array
    let ni = 0
    let li = 0
    let holding = 0
    this.pickables = []
    const blink = (performance.now() % 1200) < 110 ? 1 : 0.25
    // the holding stack: every aircraft without a stand gets its own level and slot on the racetrack
    const holders = visits.filter((v) => !v.stand && !v.cancelled && v.arrival && minute >= v.start - 13
      && minute <= Math.max(v.end, v.start + 60)).sort((a, b) => a.start - b.start)
    const slot = new Map(holders.map((v, i) => [v.id, i]))
    const H = HOLDING_PATTERN
    for (const v of visits) {
      const st = planeState(v, minute)
      if (!st) continue
      seen.add(v.id)
      const p = this.planeFor(v)
      let [x, z] = toScene(st.x, st.y)
      let alt = (st.alt || 0) * ALT
      let hr = (st.heading * Math.PI) / 180
      if (st.phase === 'holding' && slot.has(v.id)) {
        const i = slot.get(v.id)
        const n = holders.length
        const ring = 1 + Math.floor(i / 6) * 0.22
        const a = (minute / 6 + i / Math.max(1, n)) * Math.PI * 2
        const hx = H.cx + H.rx * ring * Math.cos(a)
        const hy = H.cy + H.ry * ring * Math.sin(a)
        ;[x, z] = toScene(hx, hy)
        alt = (0.55 + (i % 6) * 0.08) * ALT
        hr = Math.atan2(H.ry * Math.cos(a), -H.rx * Math.sin(a))
      }
      const mv = this.moves.get(v.id)
      if (mv) {
        const k = (now - mv.t0) / mv.dur
        const old = k < 1 ? (mv.fixed ? mv.fixed : planeState(mv.prev, minute)) : null
        if (k >= 1) this.moves.delete(v.id)
        else if (old) {
          const e = Math.max(0, k) < 0.5 ? 2 * Math.max(0, k) ** 2 : 1 - Math.pow(-2 * k + 2, 2) / 2
          const [ox, oz] = mv.fixed ? [old.x, old.z] : toScene(old.x, old.y)
          const oa = mv.fixed ? old.alt : (old.alt || 0) * ALT
          if (mv.fixed) old.heading = (old.h * 180) / Math.PI
          // a curved tow path, nose along the direction of travel
          const mx = (ox + x) / 2 + (oz - z) * 0.18
          const mz = (oz + z) / 2 - (ox - x) * 0.18
          const px = (1 - e) * (1 - e) * ox + 2 * (1 - e) * e * mx + e * e * x
          const pz = (1 - e) * (1 - e) * oz + 2 * (1 - e) * e * mz + e * e * z
          const tx = 2 * (1 - e) * (mx - ox) + 2 * e * (x - mx)
          const tz = 2 * (1 - e) * (mz - oz) + 2 * e * (z - mz)
          const travel = Math.atan2(tz, tx)
          const turn = Math.min(1, Math.min(e, 1 - e) * 6)
          const base = e < 0.5 ? (old.heading * Math.PI) / 180 : hr
          const diff = ((((travel - base + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
          hr = base + diff * turn
          x = px
          z = pz
          alt = oa + (alt - oa) * e
          if (k < 0) { x = ox; z = oz; alt = oa; hr = (old.heading * Math.PI) / 180 }
        }
      }
      p.group.visible = true
      p.group.position.set(x, alt, z)
      p.group.rotation.set(0, -hr, 0)
      if (st.phase === 'approach') p.group.rotation.z = -0.05
      if (st.phase === 'climb') p.group.rotation.z = 0.16
      if (st.phase === 'holding') p.group.rotation.x = 0.35
      const op = st.opacity ?? 1
      p.group.scale.setScalar(op < 1 ? 0.6 + 0.4 * op : 1)
      p.body.material = st.unplaced ? this.ghostMat : this.bodyMat(v)
      p.outline.visible = v.id === selected
      if (st.unplaced) holding++
      if (st.phase === 'parked' && v.stand) {
        docked.add(v.stand)
        parked.push({ id: v.id, x, z, h: hr, wide: v.size === 'WIDE', stand: v.stand, since: minute - v.start, left: v.end - minute,
          arr: !!v.arrival, dep: !!v.departure })
      }
      this.pickables.push(p.hit)
      // navigation lights: red left wingtip, green right, white tail; landing lights when moving
      if (night > 0.05 && ni < navPos.length / 3 - 3) {
        const half = p.span / 2
        const c = Math.cos(hr)
        const s = Math.sin(hr)
        const wx = -s * half
        const wz = c * half
        const y = alt + (v.size === 'WIDE' ? 0.4 : 0.2)
        const put = (px, py, pz, r, g, b) => {
          navPos[ni * 3] = px; navPos[ni * 3 + 1] = py; navPos[ni * 3 + 2] = pz
          navCol[ni * 3] = r; navCol[ni * 3 + 1] = g; navCol[ni * 3 + 2] = b
          ni++
        }
        put(x - wx, y, z - wz, 1, 0.15, 0.12)
        put(x + wx, y, z + wz, 0.2, 1, 0.45)
        put(x - c * p.len * 0.48, y + 3, z - s * p.len * 0.48, blink, blink, blink)
        if (st.phase !== 'parked' && li < lanPos.length / 3) {
          lanPos[li * 3] = x + c * p.len * 0.55; lanPos[li * 3 + 1] = alt + 1; lanPos[li * 3 + 2] = z + s * p.len * 0.55
          lanCol[li * 3] = 1; lanCol[li * 3 + 1] = 0.95; lanCol[li * 3 + 2] = 0.85
          li++
        }
      }
      const moving = st.phase !== 'parked'
      const isSel = v.id === selected
      const isHover = v.id === this.hovered
      const changed = v.originalStand && v.originalStand !== v.stand
      if (changed && alt < 5 && ri < 400) {
        ringM.makeTranslation(x, 0.8, z)
        this.chgRings.setMatrixAt(ri, ringM)
        this.chgRings.setColorAt(ri, v.stand ? green : red)
        ri++
      }
      if (isSel || isHover || (layers.labels && !st.unplaced && (moving || changed))) {
        const num = v.arrival && ['approach', 'rollout', 'taxi-in', 'holding'].includes(st.phase) ? v.arrival.number
          : v.departure ? v.departure.number : v.label
        const sub = st.unplaced ? (changed ? 'was ' + v.originalStand + ', no stand' : 'no stand')
          : changed ? v.originalStand + ' → ' + v.stand : v.stand ? 'Stand ' + v.stand : ''
        const l = this.labelFor(v.id)
        this.setLabel(l, num, sub, (st.unplaced ? 'bad' : changed ? 'chg' : moving ? 'move' : 'park') + (isSel ? ' sel' : '') + (isHover ? ' hov' : ''))
        l.position.set(x, alt + (v.size === 'WIDE' ? 16 : 12), z)
        l.visible = true
      } else if (this.labels.has(v.id)) {
        this.labels.get(v.id).visible = false
      }
      if (isSel) {
        this.selRing.visible = alt < 5
        this.selRing.position.set(x, 0.5, z)
        const sc = v.size === 'WIDE' ? 1.15 : 0.8
        this.selRing.scale.setScalar(sc * (1 + 0.04 * Math.sin(performance.now() / 300)))
        this.selectedPos = new THREE.Vector3(x, alt, z)
      }
    }
    this.chgRings.count = ri
    this.chgRings.instanceMatrix.needsUpdate = true
    if (this.chgRings.instanceColor) this.chgRings.instanceColor.needsUpdate = true
    this.chgRings.material.opacity = 0.6 + 0.35 * Math.sin(now / 260)
    this.nav.geometry.setDrawRange(0, ni)
    this.nav.geometry.attributes.position.needsUpdate = true
    this.nav.geometry.attributes.color.needsUpdate = true
    this.landing.geometry.setDrawRange(0, li)
    this.landing.geometry.attributes.position.needsUpdate = true
    this.landing.geometry.attributes.color.needsUpdate = true
    this.nav.visible = this.landing.visible = night > 0.05
    this.holdRing.visible = holding > 0
    if (!selected || !seen.has(selected)) {
      this.selRing.visible = false
      this.selectedPos = null
    }
    for (const [id, p] of this.planes) if (!seen.has(id)) p.group.visible = false
    for (const [id, l] of this.labels) if (!seen.has(id)) l.visible = false
    for (const b of this.bridges) {
      const want = docked.has(b.id) ? b.full : 7
      b.box.scale.x += (want - b.box.scale.x) * 0.1
      b.footing.position.x = b.box.scale.x * 0.82
    }
    return parked
  }

  updateClosures(minute) {
    const active = this.data.layers.closures === false ? [] : this.data.closures.filter((c) => c.from <= minute && minute < c.to)
    const key = active.map((c) => c.standId).sort().join(',')
    if (key === this.lastClosureKey) return
    this.lastClosureKey = key
    this.closureGroup.clear()
    const seen = new Set()
    const barrier = new THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff2a2a', emissiveIntensity: 1.2 })
    for (const c of active) {
      const s = standIndex[c.standId]
      if (!s || seen.has(c.standId)) continue
      seen.add(c.standId)
      const L = s.size === 'WIDE' ? 64 : 42
      const W = s.size === 'WIDE' ? 62 : 38
      const r = (s.heading * Math.PI) / 180
      const [x, z] = toScene(s.x, s.y)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshBasicMaterial({ map: this.hatch, transparent: true,
        depthWrite: false }))
      m.rotation.x = -Math.PI / 2
      m.rotation.z = -r
      m.position.set(x - Math.cos(r) * L * 0.12, 0.7, z - Math.sin(r) * L * 0.12)
      this.closureGroup.add(m)
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, W * 0.9), barrier)
      const [lx, lz] = toScene(s.lane[0], s.lane[1])
      post.position.set(lx, 1.5, lz)
      post.rotation.y = -r
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
      col.setHSL(0.36 - 0.36 * k, 0.95, 0.55)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map: this.glowTex, color: col.clone(), transparent: true, opacity: 0.35 + 0.55 * k, depthWrite: false,
        blending: THREE.AdditiveBlending }))
      const [x, z] = toScene(s.x, s.y)
      m.position.set(x, 1, z)
      m.scale.setScalar(60 + 50 * k)
      this.heatGroup.add(m)
    }
  }

  updateEffects(now) {
    const effects = this.data.effects || []
    const key = effects.length ? effects[0].t0 + ':' + effects.length : ''
    if (key !== this.lastEffectsKey) {
      this.lastEffectsKey = key
      for (const o of this.effectObjs) this.fxScene.remove(o.obj)
      this.effectObjs = []
      for (const e of effects.slice(0, 100)) {
        const a = e.from && standIndex[e.from]
        const b = e.to && standIndex[e.to]
        if (a && b) {
          const [ax, az] = toScene(a.x, a.y)
          const [bx, bz] = toScene(b.x, b.y)
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, 3, az),
            new THREE.Vector3((ax + bx) / 2, 30 + Math.hypot(bx - ax, bz - az) * 0.22, (az + bz) / 2), new THREE.Vector3(bx, 3, bz))
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.7, 6),
            new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.95 }))
          this.fxScene.add(tube)
          this.effectObjs.push({ obj: tube, t0: e.t0, kind: 'arc' })
        }
        // stand marks for the guided replay: free, busy, closed, chosen, or in a Hall violator
        const tone = e.kind === 'mark' ? MARK_TONES[e.tone] || MARK_TONES.free : null
        for (const [s, colr] of tone ? [[b, tone]] : []) {
          if (!s) continue
          const ring = new THREE.Mesh(new THREE.RingGeometry(e.tone === 'chosen' || e.tone === 'cut' ? 15 : 12, e.tone === 'chosen' || e.tone === 'cut' ? 19 : 14.5, 48),
            new THREE.MeshBasicMaterial({ color: colr, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
          ring.rotation.x = -Math.PI / 2
          const [x, z] = toScene(s.x, s.y)
          ring.position.set(x, 1.2, z)
          this.fxScene.add(ring)
          this.effectObjs.push({ obj: ring, t0: e.t0, kind: 'ring', still: e.tone !== 'chosen' && e.tone !== 'cut' })
        }
      }
    }
    // effect start times come from Date.now() in the app, so age is measured on the same clock
    const wall = Date.now()
    for (const o of this.effectObjs) {
      const age = Math.max(0, (wall - o.t0) / 1000)
      // marks stay while their step is shown; arcs fade after a few seconds
      const fade = o.kind === 'ring' ? 1 : Math.min(1, Math.max(0, 1 - age / 9))
      o.obj.material.opacity = fade * (o.kind === 'arc' ? 0.85 : o.still ? 0.75 : 0.95)
      o.obj.visible = fade > 0
      if (o.kind === 'ring' && !o.still) o.obj.scale.setScalar(1 + (age % 1.4) * 0.35)
    }
  }

  updateLighting(minute) {
    const storm = !!(this.data.storm && minute >= this.data.storm.from - 20 && minute <= this.data.storm.to + 20)
    // the weather eases in and out over a few seconds; when the airport first appears it starts as it is
    const now = performance.now()
    const target = storm ? 1 : 0
    if (this.stormLevel === undefined) this.stormLevel = target
    const dt = Math.min(0.1, (now - (this.lastLightT || now)) / 1000)
    this.lastLightT = now
    this.stormLevel += (target - this.stormLevel) * (1 - Math.exp(-dt / 1.1))
    if (Math.abs(target - this.stormLevel) < 0.002) this.stormLevel = target
    const st = this.stormLevel
    const L = this.env.update(minute, st)
    const night = L.night
    this.materials.glass.emissiveIntensity = 0.7 * Math.max(night, 0.3 * st)
    this.materials.roof.emissiveIntensity = 1.1 * night
    // field lights come on at dusk, and in a storm
    const lights = Math.max(Math.min(1, Math.max(0, (6 - L.el) / 9)), 0.6 * st)
    this.fieldLights.material.opacity = Math.min(1, lights)
    this.fieldLights.visible = lights > 0.03
    this.bloom.enabled = lights > 0.05
    this.bloom.strength = 0.42 * lights
    this.poolMat.opacity = 0.13 * lights
    this.lampMat.opacity = lights
    return lights
  }

  /** Free roam: a low camera you drive with the keyboard and turn with the mouse. */
  setRoam(on) {
    if (on === !!this.roam) return
    this.roam = on
    this.keys = {}
    if (on) {
      const t = this.controls.target.clone()
      const dir = t.clone().sub(this.camera.position).setY(0).normalize()
      const eye = t.clone().addScaledVector(dir, -160).setY(55)
      this.tween = { t0: performance.now(), dur: 1400, fromPos: this.camera.position.clone(), fromTarget: t.clone(), toPos: eye,
        toTarget: eye.clone().addScaledVector(dir, 40).setY(40), lift: 0 }
      this.controls.minDistance = 1
      this.controls.maxPolarAngle = 1.6
      this.onKey = (e) => {
        if (/input|textarea|select/i.test(e.target.tagName)) return
        const k = e.key.toLowerCase()
        if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
          this.keys[k] = e.type === 'keydown'
          e.preventDefault()
        }
      }
      window.addEventListener('keydown', this.onKey)
      window.addEventListener('keyup', this.onKey)
    } else {
      window.removeEventListener('keydown', this.onKey)
      window.removeEventListener('keyup', this.onKey)
      this.controls.minDistance = 60
      this.controls.maxPolarAngle = 1.32
    }
  }

  driveRoam(dt) {
    const k = this.keys || {}
    const fwd = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0)
    const side = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0)
    const up = (k.e ? 1 : 0) - (k.q ? 1 : 0)
    if (!fwd && !side && !up) return
    const speed = (k.shift ? 420 : 140) * dt
    const dir = this.controls.target.clone().sub(this.camera.position).setY(0)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    dir.normalize()
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const move = dir.multiplyScalar(fwd * speed).addScaledVector(right, side * speed)
    move.y = up * speed * 0.6
    if (this.camera.position.y + move.y < 6) move.y = 6 - this.camera.position.y
    this.camera.position.add(move)
    this.controls.target.add(move)
  }

  updateCamera(now) {
    const dt = Math.min(0.05, (now - (this.lastCamT || now)) / 1000)
    this.lastCamT = now
    if (this.roam && !this.tween) this.driveRoam(dt)
    // the zoom limit would snap the opening flight inwards and freeze it for a moment, so it is lifted while
    // the camera flies itself and put back once it has arrived
    this.controls.maxDistance = this.tween ? Infinity : 5200
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur)
      const e = easeInOut(k)
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e)
      this.camera.position.y += Math.sin(Math.PI * e) * this.tween.lift
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e)
      if (k >= 1) this.tween = null
    } else if (this.data.follow && this.selectedPos) {
      // the same easing whatever the frame rate, so following an aircraft never stutters
      const delta = this.selectedPos.clone().sub(this.controls.target).multiplyScalar(1 - Math.pow(0.0015, dt))
      this.controls.target.add(delta)
      this.camera.position.add(delta)
    }
    this.controls.update()
    // never below the ground, whatever moved the camera (orbit, scroll, keys, free roam or a fly-in):
    // a floor of a few metres in free roam, higher for the normal views, and the look-at point stays above ground
    const floor = this.roam ? 4 : 14
    if (this.controls.target.y < 0) this.controls.target.y = 0
    if (this.camera.position.y < floor) {
      this.camera.position.y = floor
      if (this.controls.target.y > this.camera.position.y + 400) this.controls.target.y = this.camera.position.y + 400
      this.camera.lookAt(this.controls.target)
    }
    if (now - this.lastCamEmit > 120 && this.onCamera) {
      this.lastCamEmit = now
      this.onCamera({ azimuth: this.controls.getAzimuthalAngle(), distance: this.camera.position.distanceTo(this.controls.target) })
    }
  }

  watchFps(now) {
    const f = this.fps
    f.frames++
    if (now - f.t0 > 2000) {
      const fps = (f.frames * 1000) / (now - f.t0)
      f.frames = 0
      f.t0 = now
      this.lastFps = fps
      // only one automatic step, from high to medium (ambient occlusion off, same resolution), and only
      // when the frame rate stays low for a while: a resolution change mid-session looks like a glitch
      if (this.autoQuality !== false && document.visibilityState === 'visible' && now - this.bornAt > 12000
        && this.quality === 'high') {
        if (fps < 26) f.low++
        else f.low = 0
        if (f.low >= 3) {
          f.low = 0
          this.setQuality('medium')
          if (this.onQuality) this.onQuality(this.quality)
        }
      }
    }
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const minute = clock.get().minute
    this.env.camY = this.camera.position.y
    const lights = this.updateLighting(minute)
    const parked = this.updatePlanes(minute, lights)
    this.vehicles.mesh.visible = this.data.layers.vehicles !== false
    if (this.vehicles.mesh.visible) this.vehicles.update(parked, now / 1000, lights)
    else this.vehicles.lights.visible = false
    // service vehicles wait beside parked aircraft; re-placed only when the set of parked aircraft changes
    this.vehicles.setVisible(this.vehicles.mesh.visible)
    const gseKey = parked.map((p) => p.id).join(',')
    if (gseKey !== this.gseKey) {
      this.gseKey = gseKey
      this.vehicles.placeGse(parked)
    }
    // people only when the camera is close enough to make them out
    const near = this.camera.position.distanceTo(this.controls.target) < 1300 && this.data.layers.vehicles !== false
    if (near) this.people.place(parked, minute)
    this.people.update(now, near)
    this.updateClosures(minute)
    this.updateHeat(minute)
    this.updateEffects(now)
    this.updateCamera(now)
    this.composer.render()
    // labels stay hidden during the long opening flight, so they do not jump around while the view settles
    const calm = !(this.tween && this.tween.dur > 3000)
    if (calm !== this.labelsCalm) {
      this.labelsCalm = calm
      this.labelRenderer.domElement.style.opacity = calm ? '1' : '0'
    }
    this.labelRenderer.render(this.scene, this.camera)
    this.watchFps(now)
    this.frames = (this.frames || 0) + 1
    if (this.frames === 4 && this.onReady) this.onReady()
  }

  ray(e) {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables || [], false)
    if (!hits.length) return null
    let best = hits[0]
    let bestD = Infinity
    for (const h of hits.slice(0, 6)) {
      const c = h.object.getWorldPosition(new THREE.Vector3())
      const d = this.raycaster.ray.distanceSqToPoint(c)
      if (d < bestD) { bestD = d; best = h }
    }
    return best.object.userData.visitId
  }

  hover(e) {
    if (this.down) return
    const id = this.ray(e)
    this.hovered = id
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointermove', this.onMove)
    this.controls.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }
}

