// Night globe for the welcome screen and the story flight: dotted land, city lights, a soft
// atmosphere, great-circle routes and a small airliner flying them.
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { AIRCRAFT } from '../world/aircraft'

export const R = 100

export function ll(lat, lon, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(16, 16, 13, 0, Math.PI * 2)
  g.fill()
  return new THREE.CanvasTexture(c)
}

const earthVert = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
// Real earth: daylight colour, night city lights, ocean glint, terrain relief and clouds from one
// packed map (red = height, green = roughness, blue = clouds), lit by a sun that stays to the
// left of the camera so every stop shows day, dusk and the lit cities beyond.
const earthFrag = `
uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D brc; uniform vec3 sunDir; uniform float cloudShift;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
vec3 bumpNormal(vec3 n, float h) {
  vec3 dpx = dFdx(vP); vec3 dpy = dFdy(vP);
  float dhx = dFdx(h); float dhy = dFdy(h);
  vec3 r1 = cross(dpy, n); vec3 r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vP);
  vec4 pack = texture2D(brc, vUv);
  vec3 nb = bumpNormal(n, pack.r * 0.7);
  float ndl = dot(nb, sunDir);
  float ndlS = dot(n, sunDir);
  float day = smoothstep(-0.04, 0.24, ndlS);
  vec3 albedo = texture2D(dayMap, vUv).rgb;
  float clouds = texture2D(brc, vUv + vec2(cloudShift, 0.0)).b;
  clouds = smoothstep(0.15, 0.9, clouds);
  vec3 lit = albedo * (max(ndl, 0.0) * smoothstep(-0.08, 0.12, ndlS) * 1.9 + 0.01);
  float rough = pack.g;
  vec3 h = normalize(sunDir + v);
  float spec = pow(max(dot(n, h), 0.0), 60.0) * (1.0 - rough) * 0.9 * day;
  lit += vec3(1.0, 0.86, 0.66) * spec;
  vec3 cloudCol = vec3(1.0) * (max(ndlS, 0.0) * 1.5 + 0.02);
  lit = mix(lit, cloudCol, clouds * 0.85);
  vec3 night = texture2D(nightMap, vUv).rgb;
  night = pow(night, vec3(1.6)) * vec3(1.6, 1.15, 0.75) * 2.2 * (1.0 - clouds * 0.75);
  vec3 col = mix(night, lit, day);
  // dusk band along the terminator
  float dusk = exp(-pow(ndlS / 0.12, 2.0));
  col += vec3(1.0, 0.42, 0.15) * dusk * 0.025;
  // atmosphere seen through at the limb
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 atmo = mix(vec3(0.9, 0.45, 0.2), vec3(0.32, 0.55, 1.0), smoothstep(-0.1, 0.4, ndlS));
  col += atmo * fres * (0.01 + 0.85 * smoothstep(-0.2, 0.35, ndlS));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
const atmoVert = `
varying vec3 vN; varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const atmoFrag = `
uniform vec3 sunDir;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 v = normalize(cameraPosition - vP);
  float rim = dot(vN, v);
  float k = pow(max(0.0, 0.62 + rim), 4.0) * smoothstep(-0.05, 0.25, -rim + 0.25);
  float sun = smoothstep(-0.45, 0.5, dot(normalize(vN), sunDir));
  vec3 c = mix(vec3(0.95, 0.5, 0.25), vec3(0.35, 0.6, 1.0), sun);
  float a = k * (0.02 + 0.98 * sun * sun);
  gl_FragColor = vec4(c * a * 1.4, a);
}`

export class Globe {
  constructor(container, { labels = true } = {}) {
    this.container = container
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)
    if (labels) {
      this.labelRenderer = new CSS2DRenderer()
      this.labelRenderer.setSize(w, h)
      this.labelRenderer.domElement.className = 'globe-labels'
      container.appendChild(this.labelRenderer.domElement)
    }
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(36, w / h, 1, 4000)
    this.camera.position.set(0, 60, 340)
    this.camTarget = this.camera.position.clone()
    this.lookTarget = new THREE.Vector3()
    this.look = new THREE.Vector3()
    this.root = new THREE.Group()
    this.scene.add(this.root)
    this.spin = 0
    this.autoSpin = 0.03
    this.routes = []
    this.cities = new Map()
    this.flight = null

    const loader = new THREE.TextureLoader()
    const aniso = this.renderer.capabilities.getMaxAnisotropy()
    // the globe fades in once its three maps are loaded, so it never shows as a black ball
    let pending = 3
    container.style.opacity = '0'
    container.style.transition = 'opacity 0.9s ease'
    // wait a few frames after the last map arrives, so the maps are on the GPU before the globe shows
    const loaded = () => {
      if (--pending === 0) setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => { container.style.opacity = '1' })), 120)
    }
    const tex = (url, srgb) => {
      const t = loader.load(url, loaded, undefined, loaded)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      // clouds drift east, so the map must wrap around instead of stretching its last column
      t.wrapS = THREE.RepeatWrapping
      t.anisotropy = aniso
      return t
    }
    this.sunDir = new THREE.Vector3(-1, 0.3, 0.4).normalize()
    this.earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: tex('/assets/earth_day_4096.jpg', true) }, nightMap: { value: tex('/assets/earth_night_4096.jpg', true) },
        brc: { value: tex('/assets/earth_bump_roughness_clouds_4096.jpg', false) }, sunDir: { value: this.sunDir }, cloudShift: { value: 0 }
      },
      vertexShader: earthVert, fragmentShader: earthFrag
    })
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), this.earthMat)
    this.root.add(this.earth)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: this.sunDir } },
      vertexShader: atmoVert, fragmentShader: atmoFrag, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.scene.add(atmo)
    this.buildStars()

    this.planeMesh = new THREE.Group()
    const body = new THREE.Mesh(AIRCRAFT.narrow.body, new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffffff', roughness: 0.4, metalness: 0.2 }))
    const tail = new THREE.Mesh(AIRCRAFT.narrow.tail, new THREE.MeshStandardMaterial({ color: '#8b7dff', roughness: 0.4 }))
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#d9d4ff', transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false }))
    beacon.scale.setScalar(70)
    this.planeMesh.add(body, tail, beacon)
    this.planeMesh.scale.setScalar(0.17)
    this.planeMesh.visible = false
    this.root.add(this.planeMesh)
    this.scene.add(new THREE.AmbientLight('#8fa0c8', 1.2))
    const key = new THREE.DirectionalLight('#ffffff', 2.4)
    key.position.set(200, 300, 400)
    this.scene.add(key)

    if (import.meta.env.DEV) window.__globe = this
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.t0 = performance.now()
    this.last = this.t0
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  buildStars() {
    const pos = []
    let s = 11
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 1600; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(1400 + rnd() * 600)
      pos.push(v.x, v.y, v.z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, color: '#9aa6c8', transparent: true, opacity: 0.6, sizeAttenuation: false })))
  }

  addCity(id, lat, lon, label, cls = '') {
    const p = ll(lat, lon, R * 1.006)
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.6, 32), new THREE.MeshBasicMaterial({ color: '#b2a8ff', transparent: true, side: THREE.DoubleSide, depthWrite: false }))
    ring.position.copy(p)
    ring.lookAt(p.clone().multiplyScalar(2))
    this.root.add(ring)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    dot.position.copy(p)
    this.root.add(dot)
    let lab = null
    if (this.labelRenderer && label) {
      const div = document.createElement('div')
      div.className = 'city-label ' + cls
      div.textContent = label
      lab = new CSS2DObject(div)
      lab.position.copy(ll(lat, lon, R * 1.02))
      lab.center.set(-0.12, 0.5)
      this.root.add(lab)
    }
    this.cities.set(id, { p, ring, dot, lab, lat, lon })
  }

  setCityState(id, state) {
    const c = this.cities.get(id)
    if (!c) return
    c.state = state
    if (c.lab) c.lab.element.className = 'city-label ' + state
  }

  /** Great-circle route between two cities, drawn progressively. */
  addRoute(a, b) {
    const A = this.cities.get(a).p.clone().normalize()
    const B = this.cities.get(b).p.clone().normalize()
    const ang = A.angleTo(B)
    const pts = []
    const N = 80
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const v = new THREE.Vector3().copy(A).multiplyScalar(Math.sin((1 - t) * ang)).add(B.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang))
      v.multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * (0.06 + ang * 0.12)))
      pts.push(v)
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const geo = new THREE.TubeGeometry(curve, 160, 0.32, 6)
    const mat = new THREE.MeshBasicMaterial({ color: '#b2a8ff', transparent: true, opacity: 0.95, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    geo.setDrawRange(0, 0)
    this.root.add(mesh)
    const r = { a, b, curve, mesh, total: geo.index.count, progress: 0 }
    this.routes.push(r)
    return r
  }

  /** Fly the plane along a route (or the part of it from a to b) over `ms` milliseconds; resolves on arrival. */
  fly(route, ms, a = 0, b = 1) {
    return new Promise((resolve) => {
      this.planeMesh.visible = true
      this.flight = { route, t0: performance.now(), ms, a, b, resolve }
    })
  }

  /** Puts the plane at a fraction of a route and draws the route that far. */
  placeOn(route, at) {
    route.mesh.geometry.setDrawRange(0, Math.floor((route.total * at) / 6) * 6)
    this.planeMesh.visible = true
    this.planeMesh.position.copy(route.curve.getPoint(at))
  }

  /** Points the camera at a point on a route. */
  aimOnRoute(route, at, dist = 250, tilt = 8) {
    const v = route.curve.getPoint(at).clone().normalize()
    const lat = 90 - (Math.acos(v.y) * 180) / Math.PI
    const lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180
    this.aim(lat, lon, dist, tilt)
  }

  showRouteDone(route) {
    route.progress = 1
    route.mesh.geometry.setDrawRange(0, route.total)
  }

  /** Point the camera at a lat/lon from a given distance (smoothly). */
  aim(lat, lon, dist = 300, tilt = 12) {
    this.stopSpin()
    const dir = ll(lat + tilt, lon, 1).normalize()
    this.camTarget.copy(dir.multiplyScalar(dist))
    this.lookTarget.copy(ll(lat, lon, R * 0.15))
  }

  frameRoute(route, dist) {
    const p = route.curve.getPoint(0.5).clone().normalize()
    const len = route.curve.getLength()
    this.stopSpin()
    const d = dist || Math.max(250, 170 + len * 1.15)
    this.camTarget.copy(p.clone().add(new THREE.Vector3(0, 0.22, 0)).normalize().multiplyScalar(d))
    this.lookTarget.copy(p.multiplyScalar(R * 0.25))
  }

  stopSpin() {
    this.autoSpin = 0
    this.spin = 0
    this.root.rotation.y = 0
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    if (this.labelRenderer) this.labelRenderer.setSize(w, h)
    if (this.offsetX) this.setOffset(this.offsetX)
  }

  /** Shift the globe sideways on screen (fraction of width) to leave room for a card. */
  setOffset(fx) {
    this.offsetX = fx
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!fx) { this.camera.clearViewOffset(); return }
    this.camera.setViewOffset(w, h, fx * w, 0, w, h)
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (this.autoSpin) {
      this.spin += this.autoSpin * dt
      this.root.rotation.y = this.spin
    }
    if (this.flight) {
      const f = this.flight
      const k = Math.min(1, (now - f.t0) / f.ms)
      const ek = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      const e = (f.a || 0) + ((f.b ?? 1) - (f.a || 0)) * ek
      const r = f.route
      r.mesh.geometry.setDrawRange(0, Math.floor((r.total * e) / 6) * 6)
      const p = r.curve.getPoint(e)
      const q = r.curve.getPoint(Math.min(1, e + 0.01))
      if (e >= 0.99) q.copy(p).add(r.curve.getTangent(1))
      const fwd = q.clone().sub(p).normalize()
      const up = p.clone().normalize()
      const side = fwd.clone().cross(up).normalize()
      up.copy(side.clone().cross(fwd)).normalize()
      const m = new THREE.Matrix4().makeBasis(fwd, up, side)
      this.planeMesh.quaternion.setFromRotationMatrix(m)
      this.planeMesh.position.copy(p)
      if (f.follow !== false) {
        const camDir = p.clone().normalize().add(up.clone().multiplyScalar(0.0)).add(fwd.clone().multiplyScalar(-0.35)).normalize()
        this.camTarget.copy(camDir.multiplyScalar(f.dist || 235)).add(new THREE.Vector3(0, 18, 0))
        this.lookTarget.copy(p.clone().multiplyScalar(0.55))
      }
      if (k >= 1) {
        this.flight = null
        f.resolve()
      }
    }
    const t = (now - this.t0) / 1000
    const camDir = this.camera.position.clone()
    const wp = new THREE.Vector3()
    for (const c of this.cities.values()) {
      if (c.lab) {
        c.lab.getWorldPosition(wp)
        // hide labels on the far side of the globe
        const facing = wp.clone().normalize().dot(camDir.clone().sub(wp).normalize())
        c.lab.visible = facing > 0.08
      }
      const s = 1 + ((t * 0.8 + c.lat * 0.01) % 1) * 1.6
      c.ring.scale.setScalar(c.state === 'active' ? s * 1.4 : s)
      c.ring.material.opacity = Math.max(0, 1 - (s - 1) / 1.6) * (c.state === 'active' ? 1 : 0.6)
    }
    const kk = 1 - Math.pow(0.0015, dt)
    this.camera.position.lerp(this.camTarget, kk)
    this.look.lerp(this.lookTarget, kk)
    this.camera.lookAt(this.look)
    // the sun sits to the upper left of the view, slightly behind the globe
    const fwd = this._f || (this._f = new THREE.Vector3())
    const right = this._r || (this._r = new THREE.Vector3())
    this.camera.getWorldDirection(fwd)
    right.crossVectors(fwd, this.camera.up).normalize()
    const up = this._u || (this._u = new THREE.Vector3())
    up.crossVectors(right, fwd).normalize()
    this.sunDir.copy(fwd).multiplyScalar(-0.35).addScaledVector(right, -0.9).addScaledVector(up, 0.3).normalize()
    this.earthMat.uniforms.cloudShift.value = t * 0.0008
    this.renderer.render(this.scene, this.camera)
    if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }
}
