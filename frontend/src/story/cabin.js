// The aircraft cabin at the start of the story, seen from the aisle at the back of economy.
// Rows 1 to 6 carry the six syllabus units on their seat-back screens and headrest covers.
// The windows are not pictures: each pane traces a ray into a small outside world (sky, sun, clouds,
// ground and the wing), so the view shifts correctly as the camera moves and climbs on take-off.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export const UNIT_COLOURS = ['#6cc4ff', '#b48cff', '#3fd68f', '#ffb547', '#ff7a6b', '#f472b6']
const PITCH = 0.86 // seat pitch (metres between rows)
const ROWS = 14
const ROW0 = 1.0 // z of the first row
const FLOOR = -0.62
const SHELL_R = 2.08
const SEAT_X = [-1.5, -1.03, -0.56, 0.56, 1.03, 1.5]
const START_CAM = [0.0, 0.78, 3.4]
const START_LOOK = [0, 0.32, -9]

const rowZ = (r) => ROW0 - r * PITCH

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  return t
}

function noise(g, w, h, alpha, n = 9000, seed = 3) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rnd() * 255)
    g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + alpha + ')'
    g.fillRect(rnd() * w, rnd() * h, 1.4, 1.4)
  }
}

// ---------- textures ----------

const fabricTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2b3550'
  g.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)'
    g.fillRect(0, y, w, 1)
  }
  for (let x = 0; x < w; x += 4) {
    g.fillStyle = 'rgba(0,0,0,0.05)'
    g.fillRect(x, 0, 1, h)
  }
  noise(g, w, h, 0.05, 6000)
}, [3, 3])

const carpetTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2a2d3f'
  g.fillRect(0, 0, w, h)
  noise(g, w, h, 0.09, 26000, 7)
  g.strokeStyle = 'rgba(150,140,220,0.10)'
  g.lineWidth = 2
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      g.beginPath()
      g.arc(i * 64 + (j % 2) * 32, j * 64, 9, 0, Math.PI * 2)
      g.stroke()
    }
  }
}, [4, 30])

const wallTex = () => canvasTex(512, 256, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#ece7df')
  grad.addColorStop(1, '#e2dcd2')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  noise(g, w, h, 0.03, 5000, 11)
  g.fillStyle = 'rgba(0,0,0,0.10)'
  g.fillRect(0, 0, w, 2)
}, [1, ROWS + 6])

function screenTex(unit, colour) {
  return canvasTex(512, 300, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#0b1222')
    grad.addColorStop(1, '#151b33')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    if (!unit) {
      // the moving map on the other screens
      g.strokeStyle = 'rgba(120,140,200,0.25)'
      g.lineWidth = 1
      for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
      for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
      g.strokeStyle = '#b2a8ff'
      g.lineWidth = 4
      g.setLineDash([10, 8])
      g.beginPath()
      g.moveTo(60, 220)
      g.bezierCurveTo(180, 90, 330, 90, 450, 170)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#ffd27a'
      g.beginPath(); g.arc(450, 170, 9, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#ffffff'
      g.font = '600 26px Inter, sans-serif'
      g.fillText('BOM', 420, 215)
      return
    }
    g.fillStyle = colour
    g.fillRect(0, 0, 12, h)
    g.fillStyle = colour
    g.font = '700 30px Inter, sans-serif'
    g.fillText('UNIT ' + unit.u, 46, 78)
    g.fillStyle = '#ffffff'
    g.font = '700 40px Inter, sans-serif'
    const words = unit.name.split(' ')
    let line = ''
    let y = 140
    for (const wd of words) {
      if (g.measureText(line + wd).width > 420) {
        g.fillText(line.trim(), 46, y)
        line = ''
        y += 50
      }
      line += wd + ' '
    }
    g.fillText(line.trim(), 46, y)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.font = '500 22px Inter, sans-serif'
    g.fillText('Row ' + unit.u + ' · stop ' + unit.u + ' of 6', 46, h - 34)
  })
}

/** A linen headrest cover; unit rows carry a thin band in the unit colour and the unit number. */
function coverTex(unit, colour) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#f1ede4'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 0.05, 2500, 21)
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = 'rgba(0,0,0,0.025)'
      g.fillRect(0, y, w, 1)
    }
    if (unit) {
      g.fillStyle = colour
      g.fillRect(0, h - 34, w, 14)
      g.fillStyle = 'rgba(40,40,50,0.75)'
      g.font = '600 26px Inter, sans-serif'
      g.textAlign = 'center'
      g.fillText('UNIT ' + unit.u, w / 2, 52)
    }
  })
}

function bulkheadTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#0b1020')
    grad.addColorStop(1, '#141b33')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#b2a8ff'
    g.font = '600 32px Inter, sans-serif'
    g.fillText('FLIGHT BT 2026 · WORLD TOUR', 64, 92)
    g.fillStyle = '#ffffff'
    g.font = '700 84px Inter, sans-serif'
    g.fillText('New York to Mumbai', 64, 196)
    g.fillStyle = '#8b93ab'
    g.font = '500 30px Inter, sans-serif'
    g.fillText('New York to Mumbai · nonstop · about 16 h', 64, 256)
    g.strokeStyle = '#b2a8ff'
    g.lineWidth = 5
    g.setLineDash([14, 12])
    g.beginPath()
    g.moveTo(80, 410)
    g.bezierCurveTo(330, 320, 650, 320, 940, 410)
    g.stroke()
    g.setLineDash([])
    for (let i = 0; i <= 7; i++) {
      const t = i / 7
      const x = (1 - t) ** 3 * 80 + 3 * (1 - t) ** 2 * t * 330 + 3 * (1 - t) * t * t * 650 + t ** 3 * 940
      const y = (1 - t) ** 3 * 410 + 3 * (1 - t) ** 2 * t * 320 + 3 * (1 - t) * t * t * 320 + t ** 3 * 410
      g.fillStyle = i === 7 ? '#ffd27a' : '#ffffff'
      g.beginPath()
      g.arc(x, y, i === 7 ? 13 : 8, 0, Math.PI * 2)
      g.fill()
    }
  })
}

// ---------- geometry ----------

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

/** One-piece cushion: seat pan and reclined backrest from a side profile, extruded across the seat. */
function cushionGeometry() {
  const s = new THREE.Shape()
  // u = backwards (+z), v = up; origin at the front of the seat pan, floor level of the cushion
  s.moveTo(-0.24, 0.0)
  s.lineTo(-0.24, 0.07)
  s.quadraticCurveTo(-0.245, 0.125, -0.19, 0.13)
  s.lineTo(0.12, 0.115)
  s.quadraticCurveTo(0.17, 0.12, 0.18, 0.17)
  s.lineTo(0.25, 0.66)
  s.quadraticCurveTo(0.262, 0.77, 0.32, 0.78)
  s.lineTo(0.35, 0.78)
  s.quadraticCurveTo(0.37, 0.77, 0.365, 0.72)
  s.lineTo(0.30, 0.14)
  s.lineTo(0.27, 0.0)
  s.lineTo(-0.24, 0.0)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03,
    bevelSegments: 4, curveSegments: 10 })
  g.rotateY(-Math.PI / 2)
  g.translate(0.19, 0, 0)
  g.computeVertexNormals()
  return g
}

/** Plastic shell behind the backrest, with the screen recess. */
function shellGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0.27, -0.02)
  s.lineTo(0.37, 0.70)
  s.quadraticCurveTo(0.375, 0.8, 0.33, 0.805)
  s.lineTo(0.36, 0.805)
  s.quadraticCurveTo(0.405, 0.8, 0.40, 0.70)
  s.lineTo(0.31, -0.02)
  s.lineTo(0.27, -0.02)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.44, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012,
    bevelSegments: 2, curveSegments: 6 })
  g.rotateY(-Math.PI / 2)
  g.translate(0.22, 0, 0)
  g.computeVertexNormals()
  return g
}

// ---------- the view through the windows ----------

const windowVert = `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const windowFrag = `
uniform float uTime; uniform float uAlt; uniform float uPitch; uniform float uRoll; uniform float uDist; uniform float uCity; uniform float uCloudBase; uniform float uDryTrack;
uniform float uDusk; uniform float uRwyA; uniform float uRwyB;
varying vec3 vWorld;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
const vec3 SUN = vec3(0.62, 0.10, -0.78);
vec3 sky(vec3 d) {
  vec3 sunDir = normalize(SUN);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 top = mix(vec3(0.07, 0.19, 0.50), vec3(0.05, 0.07, 0.22), uDusk);
  vec3 hor = mix(vec3(1.0, 0.62, 0.36), vec3(0.98, 0.46, 0.26), uDusk);
  vec3 col = mix(hor, top, pow(max(h, 0.0), 0.45));
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.35;
  col += vec3(1.0, 0.88, 0.65) * pow(s, 700.0) * 5.0;
  return col;
}
vec3 ground(vec2 p, vec3 d, float t) {
  vec3 sunDir = normalize(SUN);
  float n = fbm(p * 0.0016);
  vec3 g = mix(vec3(0.17, 0.19, 0.12), vec3(0.30, 0.27, 0.19), n);
  g = mix(g, vec3(0.12, 0.19, 0.10), smoothstep(0.55, 0.7, fbm(p * 0.01)) * 0.5);
  // city blocks, streets and their lights
  float urban = smoothstep(0.32, 0.55, fbm(p * 0.0007 + 7.0)) * uCity;
  vec2 blk = fract(p / 38.0);
  float street = step(0.84, max(blk.x, blk.y));
  vec3 roofs = mix(vec3(0.34, 0.32, 0.30), vec3(0.24, 0.25, 0.27), hash(floor(p / 38.0)));
  g = mix(g, mix(roofs, vec3(0.16, 0.16, 0.17), street), urban * 0.85);
  float glow = urban * (street * 0.8 + step(0.92, hash(floor(p / 7.0))) * 0.9);
  g += vec3(1.0, 0.72, 0.42) * glow * (0.25 + 1.1 * uDusk) * smoothstep(9000.0, 2000.0, t);
  // bays and rivers mirror the sky and the sun
  float wat = smoothstep(0.41, 0.37, fbm(p * 0.00045 + 3.0));
  // on the take-off the ground under and beside the track stays dry land: the scene ends before any water
  wat *= 1.0 - uDryTrack * (1.0 - smoothstep(2000.0, 3500.0, abs(p.x)));
  vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
  vec3 refl = sky(r) * vec3(0.55, 0.66, 0.78);
  refl += vec3(1.0, 0.8, 0.5) * pow(max(dot(r, sunDir), 0.0), 180.0) * 2.5 * (0.4 + 0.6 * vnoise(p * 0.2 + uTime * 0.7));
  g = mix(g, refl, wat);
  // the runway, while it is near
  float rwy = step(abs(p.x - 6.0), 30.0) * step(uRwyB, p.y) * step(p.y, uRwyA) * (1.0 - smoothstep(500.0, 1200.0, uAlt));
  vec3 rc = vec3(0.21, 0.21, 0.23);
  float lines = step(abs(abs(p.x - 6.0) - 28.0), 0.6) + step(abs(p.x - 6.0), 0.5) * step(0.5, fract(p.y / 24.0));
  rc = mix(rc, vec3(0.92), clamp(lines, 0.0, 1.0));
  rc += vec3(1.0, 0.9, 0.7) * step(abs(abs(p.x - 6.0) - 31.0), 0.5) * step(0.8, fract(p.y / 30.0)) * (0.6 + uDusk);
  g = mix(g, rc, rwy);
  return g;
}
void main() {
  vec3 cam = cameraPosition;
  vec3 d0 = normalize(vWorld - cam);
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 d = vec3(d0.x, d0.y * cp - d0.z * sp, d0.y * sp + d0.z * cp);
  float cr = cos(uRoll), sr = sin(uRoll);
  d = vec3(d.x * cr - d.y * sr, d.x * sr + d.y * cr, d.z);
  vec3 col = sky(d);
  float eyeH = uAlt + 4.0;
  vec3 hazeCol = sky(vec3(d.x, 0.02, d.z));
  if (d.y < 0.0) {
    float t = eyeH / -d.y;
    vec2 p = d.xz * t + vec2(0.0, -uDist);
    vec3 g = ground(p, d, t);
    float haze = 1.0 - exp(-t * 0.00013);
    col = mix(g, hazeCol, clamp(haze, 0.0, 1.0));
  }
  // a distant skyline along the horizon, with lit windows
  float az = atan(d.x, -d.z);
  float D = 5200.0;
  float cell = floor(az * 170.0);
  float bh = (pow(hash(vec2(cell, 3.1)), 3.0) * 420.0 + 25.0) * smoothstep(0.35, 0.65, vnoise(vec2(az * 2.5, 1.7))) * uCity;
  float topEl = (bh - eyeH) / D;
  float baseEl = (-eyeH) / D;
  if (bh > 1.0 && d.y < topEl && d.y > baseEl) {
    vec3 b = mix(vec3(0.17, 0.19, 0.25), hazeCol, 0.55);
    vec2 w = vec2(fract(az * 170.0 * 7.0), fract((d.y * D + eyeH) / 4.5));
    float win = step(0.3, w.x) * step(w.y, 0.55) * step(0.72, hash(vec2(floor(az * 170.0 * 7.0), floor((d.y * D + eyeH) / 4.5))));
    b += vec3(1.0, 0.78, 0.5) * win * (0.15 + 0.8 * uDusk);
    col = b;
  }
  // the cloud deck: from below a ceiling, from above a sea of cloud lit by the low sun
  float cy = uCloudBase - uAlt;
  float tc = cy / d.y;
  if (tc > 0.0) {
    vec2 q = d.xz * tc + vec2(uTime * 6.0, -uDist * 0.9);
    float c = smoothstep(0.42, 0.78, fbm(q * 0.0011));
    float fade = exp(-tc * 0.00011);
    float above = step(cy, 0.0);
    vec3 lit = mix(vec3(1.0, 0.86, 0.72), vec3(1.0, 0.95, 0.9), above);
    vec3 cc = mix(lit, vec3(0.62, 0.55, 0.64), smoothstep(0.6, 1.0, c) * (1.0 - above));
    cc += vec3(1.0, 0.6, 0.3) * pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(SUN.x, 0.0, SUN.z))), 0.0), 6.0) * 0.25 * above;
    col = mix(col, cc, c * fade * (0.9 + 0.1 * above));
  }
  // the wing: upper surface with a little dihedral and sweep, seen from either side
  float sx = sign(vWorld.x);
  vec3 dc = d0; vec3 cc0 = cam;
  dc.x *= sx; cc0.x *= sx;
  float a = -0.42; float bb = 0.07;
  float den = dc.y - bb * dc.x;
  float tw = (a + bb * (cc0.x - 2.1) - cc0.y) / den;
  if (tw > 0.0 && den < 0.0) {
    vec3 hp = cc0 + dc * tw;
    float x = hp.x - 2.1;
    float le = -7.2 + x * 0.62;
    float chord = mix(5.8, 1.3, clamp(x / 15.0, 0.0, 1.0));
    if (x > 0.0 && x < 15.0 && hp.z > le && hp.z < le + chord) {
      float u = (hp.z - le) / chord;
      vec3 wcol = vec3(0.42, 0.45, 0.50);
      wcol *= 0.8 + 0.3 * smoothstep(0.0, 0.25, u) - 0.15 * x / 15.0;
      wcol = mix(wcol, vec3(0.34, 0.36, 0.41), step(0.78, u));
      wcol *= 1.0 - 0.25 * step(abs(fract(x / 2.6) - 0.5), 0.012) * step(0.78, u);
      wcol += sky(reflect(d, vec3(0.0, 1.0, 0.0))) * 0.08;
      if (x > 14.2) wcol = vec3(0.85, 0.12, 0.12) * (1.0 + 2.0 * step(0.92, fract(uTime * 0.9)));
      col = wcol;
    }
  }
  vec2 e = abs(vUv - 0.5) * 2.0;
  col *= 1.0 - 0.18 * pow(max(e.x, e.y), 4.0);
  gl_FragColor = vec4(col * 0.9, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// ---------- the take-off profile ----------
const smoothE = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const LIFT = 4.6
/** Ground speed (scene units a second): the roll, then a little faster than life once airborne. */
function takeoffSpeed(k) {
  return k < LIFT ? 86 * Math.pow(Math.min(1, Math.max(0, k) / LIFT), 0.8) : Math.min(300, 86 + 36 * (k - LIFT))
}
/** Climb angle in radians: about 8.5 degrees after lift-off, easing off as it levels above the cloud. */
function takeoffGamma(k) {
  return k < LIFT ? 0 : 0.148 * smoothE((k - LIFT) / 1.5) * (1 - 0.75 * smoothE((k - 11.8) / 1.6))
}
const ALT_STEP = 1 / 120
const ALT_TABLE = (() => {
  const out = [0]
  let a = 0
  for (let k = 0; k < 20; k += ALT_STEP) {
    a += takeoffSpeed(k) * Math.sin(takeoffGamma(k)) * ALT_STEP
    out.push(a)
  }
  return out
})()
/** Height above the runway k seconds into the take-off: speed times the sine of the climb angle, integrated. */
function takeoffAlt(k) {
  const i = Math.max(0, Math.min(ALT_TABLE.length - 1, k / ALT_STEP))
  const lo = Math.floor(i)
  const hi = Math.min(ALT_TABLE.length - 1, lo + 1)
  return ALT_TABLE[lo] + (ALT_TABLE[hi] - ALT_TABLE[lo]) * (i - lo)
}

export class Cabin {
  constructor(container, units, { landing = false } = {}) {
    this.container = container
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.82
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#1a1a20')
    const pm = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.3
    pm.dispose()
    this.camera = new THREE.PerspectiveCamera(56, w / h, 0.03, 60)
    // walk in: the camera starts a step behind the aisle position and glides forward
    this.camera.position.set(START_CAM[0], START_CAM[1] + 0.08, START_CAM[2] + 1.4)
    this.look = new THREE.Vector3(...START_LOOK)
    this.camTarget = new THREE.Vector3(...START_CAM)
    this.lookTarget = this.look.clone()

    this.windowUniforms = { uTime: { value: 0 }, uAlt: { value: 0 }, uPitch: { value: 0 }, uRoll: { value: 0 }, uDist: { value: 0 },
      uCloudBase: { value: 1800 }, uDryTrack: { value: 0 },
      uCity: { value: 0.9 }, uDusk: { value: landing ? 0.7 : 0.15 }, uRwyA: { value: 300 }, uRwyB: { value: -3600 } }
    this.speed = 0
    this.buildShell()
    this.buildWindows()
    this.buildBins()
    this.buildSeats(units)
    this.buildLights()

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.5, 0.96)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.composer.setSize(w, h)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.t0 = performance.now()
    this.last = this.t0
    this.takeoff = null
    this.landing = null
    this.shake = 0
    if (landing) {
      this.toWindow(true, false)
      this.windowUniforms.uAlt.value = 720
      this.windowUniforms.uCity.value = 1
      // the runway starts a little before the touchdown point (80 units/s for 4.8 s)
      this.windowUniforms.uRwyA.value = -250
      this.windowUniforms.uRwyB.value = -4200
      this.speed = 80
    }
    this.loop = this.loop.bind(this)
    if (import.meta.env.DEV) window.__cabin = this
    this.raf = requestAnimationFrame(this.loop)
  }

  buildShell() {
    const len = ROWS * PITCH + 8
    const midZ = ROW0 - (ROWS * PITCH) / 2
    const wall = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.75, side: THREE.BackSide })
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(SHELL_R, SHELL_R, len, 96, 1, true), wall)
    shell.rotation.x = Math.PI / 2
    shell.position.set(0, 0.0, midZ)
    shell.receiveShadow = true
    this.scene.add(shell)
    const floorW = 2 * Math.sqrt(SHELL_R * SHELL_R - FLOOR * FLOOR)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, len), new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, FLOOR, midZ)
    floor.receiveShadow = true
    this.scene.add(floor)
    // aisle runner, slightly richer colour, and the floor path lights along both edges
    const aisleTex = carpetTex()
    aisleTex.repeat.set(1, 30)
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(0.62, len), new THREE.MeshStandardMaterial({ map: aisleTex, color: '#9b8fd6', roughness: 1 }))
    aisle.rotation.x = -Math.PI / 2
    aisle.position.set(0, FLOOR + 0.002, midZ)
    aisle.receiveShadow = true
    this.scene.add(aisle)
    const path = new THREE.MeshBasicMaterial({ color: '#ffdcb0' })
    for (const x of [-0.33, 0.33]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, len - 2), path)
      strip.position.set(x, FLOOR + 0.004, midZ)
      this.scene.add(strip)
    }
    // ceiling: a lowered centre panel with indirect light coves on both sides
    const ceil = new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.7 })
    const panel = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.06, len, 2, 0.02), ceil)
    panel.position.set(0, 1.86, midZ)
    this.scene.add(panel)
    const cove = new THREE.MeshBasicMaterial({ color: '#fff1dc' })
    for (const x of [-0.6, 0.6]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, len), cove)
      c.position.set(x, 1.84, midZ)
      this.scene.add(c)
    }
    // ceiling panel joints, one per row
    const seam = new THREE.MeshStandardMaterial({ color: '#cfc9bf', roughness: 0.8 })
    for (let r = -3; r < ROWS + 2; r++) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.008, 0.012), seam)
      j.position.set(0, 1.826, rowZ(r) + PITCH / 2)
      this.scene.add(j)
    }
    // the forward bulkhead with the route screen and the curtain to business class
    const bulkZ = rowZ(ROWS - 1) - 0.9
    const bulk = new THREE.Mesh(new THREE.CircleGeometry(SHELL_R, 64), new THREE.MeshStandardMaterial({ color: '#dcd5ca', roughness: 0.8 }))
    bulk.position.set(0, 0, bulkZ)
    this.scene.add(bulk)
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), new THREE.MeshStandardMaterial({ color: '#4b4166', roughness: 0.95 }))
    door.position.set(0, FLOOR + 0.95, bulkZ + 0.01)
    this.scene.add(door)
    const exitTex = canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = '#0e7a3e'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#ffffff'
      g.font = '700 58px Inter, sans-serif'
      g.textAlign = 'center'
      g.fillText('EXIT', w / 2, 68)
    })
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshBasicMaterial({ map: exitTex, toneMapped: false }))
    exit.position.set(0, FLOOR + 2.02, bulkZ + 0.02)
    this.scene.add(exit)
    const tex = bulkheadTex()
    for (const x of [-1.15, 1.15]) {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.6, 0.04, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#202330', roughness: 0.4 }))
      frame.position.set(x, 0.95, bulkZ + 0.03)
      this.scene.add(frame)
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.52), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
      scr.position.set(x, 0.95, bulkZ + 0.055)
      this.scene.add(scr)
    }
  }

  buildWindows() {
    const winMat = new THREE.ShaderMaterial({ uniforms: this.windowUniforms, vertexShader: windowVert, fragmentShader: windowFrag })
    const paneGeo = new THREE.ShapeGeometry(roundedRect(0.25, 0.36, 0.1), 10)
    // planar UVs from -w/2..w/2 to 0..1
    const pos = paneGeo.attributes.position
    const uv = paneGeo.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.25 + 0.5, pos.getY(i) / 0.36 + 0.5)
    const bezelShape = roundedRect(0.36, 0.48, 0.15)
    bezelShape.holes.push(roundedRect(0.27, 0.38, 0.11))
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 })
    const bezelMat = new THREE.MeshStandardMaterial({ color: '#f3efe8', roughness: 0.55 })
    const shadeMat = new THREE.MeshStandardMaterial({ color: '#e6e0d6', roughness: 0.8 })
    const shadeGeo = new THREE.PlaneGeometry(0.27, 0.38)
    const y = 0.5
    const ang = Math.asin(y / SHELL_R)
    const rx = Math.cos(ang) * SHELL_R
    let k = 0
    for (let r = -2; r < ROWS + 1; r++) {
      for (const s of [-1, 1]) {
        k++
        const z = rowZ(r) - 0.04
        const g = new THREE.Group()
        g.position.set(s * (rx - 0.06), y, z)
        // face the aisle, tilted with the curve of the wall
        g.rotation.order = 'YXZ'
        g.rotation.y = -s * Math.PI / 2
        g.rotation.x = ang * 0.9
        const pane = new THREE.Mesh(paneGeo, winMat)
        pane.position.z = -0.02
        g.add(pane)
        const bezel = new THREE.Mesh(bezelGeo, bezelMat)
        bezel.position.z = -0.03
        bezel.receiveShadow = true
        g.add(bezel)
        // some passengers have pulled their shade partly down
        const pull = r >= 1 && r <= 5 ? 0 : [0, 0.35, 0, 0, 0.7, 0, 0.15, 0][k % 8]
        if (pull > 0) {
          const shade = new THREE.Mesh(shadeGeo, shadeMat)
          shade.scale.y = pull
          shade.position.set(0, 0.19 - (0.38 * pull) / 2, 0.0)
          g.add(shade)
        }
        this.scene.add(g)
      }
    }
  }

  buildBins() {
    // overhead bins: a curved door profile extruded per row, with a seam between doors
    const prof = new THREE.Shape()
    prof.moveTo(0, 0)
    prof.lineTo(0.62, 0.0)
    prof.quadraticCurveTo(0.72, 0.02, 0.74, 0.12)
    prof.lineTo(0.74, 0.32)
    prof.quadraticCurveTo(0.7, 0.5, 0.42, 0.56)
    prof.lineTo(0.0, 0.62)
    prof.lineTo(0, 0)
    const binLen = PITCH * 2 - 0.02
    const geo = new THREE.ExtrudeGeometry(prof, { depth: binLen, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 })
    const mat = new THREE.MeshStandardMaterial({ color: '#ebe6de', roughness: 0.5 })
    const psuMat = new THREE.MeshStandardMaterial({ color: '#d9d3c9', roughness: 0.6 })
    const handleMat = new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.3, metalness: 0.7 })
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4e0' })
    const signMat = new THREE.MeshBasicMaterial({ color: '#7ad1ff' })
    for (let r = -2; r < ROWS; r += 2) {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(geo, mat)
        // profile x runs towards the aisle; place so the doors face the aisle
        m.scale.x = -s
        m.position.set(s * 1.92, 1.06, rowZ(r) + 0.43 - binLen)
        m.castShadow = true
        this.scene.add(m)
        // a recessed handle on each door
        const handle = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.035, 0.32, 2, 0.01), handleMat)
        handle.position.set(s * (1.92 - 0.745), 1.06 + 0.3, rowZ(r) + 0.43 - binLen / 2)
        this.scene.add(handle)
      }
    }
    // passenger service units under the bins: reading lights and the seat belt sign
    for (let r = 0; r < ROWS; r++) {
      for (const s of [-1, 1]) {
        const psu = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.5), psuMat)
        psu.position.set(s * 1.5, 1.04, rowZ(r) - 0.05)
        this.scene.add(psu)
        for (const dx of [-0.18, 0, 0.18]) {
          const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), lampMat)
          lamp.rotation.x = Math.PI / 2
          lamp.position.set(s * 1.5 + dx, 1.026, rowZ(r) + 0.1)
          this.scene.add(lamp)
        }
        if (r % 3 === 0) {
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), signMat)
          sign.rotation.x = Math.PI / 2
          sign.position.set(s * 1.5, 1.025, rowZ(r) - 0.14)
          this.scene.add(sign)
        }
      }
    }
  }

  buildSeats(units) {
    const count = ROWS * SEAT_X.length
    const cushionGeo = cushionGeometry()
    const shellGeo = shellGeometry()
    const fabric = new THREE.MeshStandardMaterial({ map: fabricTex(), roughness: 0.95, color: '#ffffff' })
    const plastic = new THREE.MeshStandardMaterial({ color: '#3b3f48', roughness: 0.38, metalness: 0.05 })
    const metal = new THREE.MeshStandardMaterial({ color: '#8d939c', roughness: 0.3, metalness: 0.85 })
    const cushion = new THREE.InstancedMesh(cushionGeo, fabric, count)
    const shell = new THREE.InstancedMesh(shellGeo, plastic, count)
    const coverGeo = new RoundedBoxGeometry(0.3, 0.13, 0.016, 2, 0.007)
    const plainCover = new THREE.MeshStandardMaterial({ map: coverTex(null), roughness: 0.95 })
    const cover = new THREE.InstancedMesh(coverGeo, plainCover, count)
    const pocket = new THREE.InstancedMesh(new RoundedBoxGeometry(0.3, 0.12, 0.03, 2, 0.012),
      new THREE.MeshStandardMaterial({ color: '#262a33', roughness: 0.9 }), count)
    const armGeo = new RoundedBoxGeometry(0.055, 0.06, 0.44, 2, 0.02)
    const arm = new THREE.InstancedMesh(armGeo, plastic, ROWS * 8)
    const legGeo = new THREE.BoxGeometry(0.04, 0.36, 0.5)
    const leg = new THREE.InstancedMesh(legGeo, metal, ROWS * 4)
    const tray = new THREE.InstancedMesh(new RoundedBoxGeometry(0.32, 0.2, 0.012, 2, 0.005),
      new THREE.MeshStandardMaterial({ color: '#2c3038', roughness: 0.45 }), count)
    for (const m of [cushion, shell, cover, arm, leg, tray, pocket]) {
      m.castShadow = true
      m.receiveShadow = true
      this.scene.add(m)
    }
    const d = new THREE.Object3D()
    const col = new THREE.Color()
    const seatY = FLOOR + 0.3
    let i = 0
    let ai = 0
    let li = 0
    this.screens = []
    const mapTex = screenTex(null)
    const coverMats = units.slice(0, 6).map((u, k) => new THREE.MeshStandardMaterial({ map: coverTex(u, UNIT_COLOURS[k]), roughness: 0.95 }))
    for (let r = 0; r < ROWS; r++) {
      const z = rowZ(r)
      const unitRow = r < Math.min(6, units.length)
      const scrTex = unitRow ? screenTex(units[r], UNIT_COLOURS[r]) : mapTex
      const scrMat = new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })
      for (const x of SEAT_X) {
        d.position.set(x, seatY, z)
        d.rotation.set(0, 0, 0)
        d.scale.set(1, 1, 1)
        d.updateMatrix()
        cushion.setMatrixAt(i, d.matrix)
        shell.setMatrixAt(i, d.matrix)
        // headrest cover in the unit colour, draped over the top of the backrest
        d.position.set(x, seatY + 0.715, z + 0.405)
        d.rotation.set(0.124, 0, 0)
        d.updateMatrix()
        if (unitRow) {
          // unit rows get their own cover with the unit band
          const own = new THREE.Mesh(coverGeo, coverMats[r])
          own.applyMatrix4(d.matrix)
          own.castShadow = true
          this.scene.add(own)
          d.scale.set(0, 0, 0)
          d.updateMatrix()
        }
        cover.setMatrixAt(i, d.matrix)
        col.set('#ffffff')
        cover.setColorAt(i, col)
        d.scale.set(1, 1, 1)
        // seat-back pocket under the tray table
        d.position.set(x, seatY + 0.13, z + 0.35)
        d.rotation.set(0.124, 0, 0)
        d.updateMatrix()
        pocket.setMatrixAt(i, d.matrix)
        // folded tray table below the screen
        d.position.set(x, seatY + 0.3, z + 0.372)
        d.rotation.set(0.124, 0, 0)
        d.updateMatrix()
        tray.setMatrixAt(i, d.matrix)
        // seat-back screen
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), scrMat)
        scr.position.set(x, seatY + 0.53, z + 0.392)
        scr.rotation.x = 0.124
        this.scene.add(scr)
        this.screens.push({ mesh: scr, row: r })
        i++
      }
      for (const side of [-1, 1]) {
        const xs = side < 0 ? [-1.75, -1.265, -0.795, -0.325] : [0.325, 0.795, 1.265, 1.75]
        for (const ax of xs) {
          d.position.set(ax, seatY + 0.24, z + 0.02)
          d.rotation.set(0, 0, 0)
          d.updateMatrix()
          arm.setMatrixAt(ai++, d.matrix)
        }
        for (const lx of [side * 0.8, side * 1.45]) {
          d.position.set(lx, FLOOR + 0.18, z + 0.02)
          d.updateMatrix()
          leg.setMatrixAt(li++, d.matrix)
        }
      }
    }
    cover.instanceColor.needsUpdate = true
    this.seatRows = { cushion, shell, cover }
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight('#fff1dc', '#40364a', 0.7))
    // warm downlights along the ceiling, three of them casting soft seat shadows
    for (let k = 0; k < 6; k++) {
      const z = 2.6 - k * 2.4
      const sp = new THREE.SpotLight('#ffe6c8', 3.6, 7, 1.05, 1.0, 1.4)
      sp.position.set(0, 1.8, z)
      sp.target.position.set(0, FLOOR, z - 0.4)
      if (k < 4) {
        sp.castShadow = true
        sp.shadow.mapSize.set(1024, 1024)
        sp.shadow.bias = -0.0004
        sp.shadow.radius = 6
      }
      this.scene.add(sp, sp.target)
    }
    // indirect wash on the sidewalls and bins from the coves (a soft violet mood light)
    for (const x of [-1.2, 1.2]) {
      for (let k = 0; k < 4; k++) {
        const p = new THREE.PointLight('#d8ccff', 0.7, 4.5, 1.4)
        p.position.set(x, 1.55, 2 - k * 3.4)
        this.scene.add(p)
      }
    }
    // daylight through the windows
    const sun = new THREE.DirectionalLight('#ffd2a1', 0.7)
    sun.position.set(6, 2, -3)
    this.scene.add(sun)
  }

  /** Camera moves to look at a row (0 to 5), or back to the start with -1. */
  focusRow(r) {
    if (r < 0) {
      this.camTarget.set(...START_CAM)
      this.lookTarget.set(...START_LOOK)
      return
    }
    const z = rowZ(r)
    const x = r % 2 ? 1.03 : -1.03
    this.camTarget.set(x * 0.25, 0.95, z + 1.25)
    this.lookTarget.set(x, 0.0, z + 0.2)
  }

  /** Turn to a window seat and roll down the runway into the climb. */
  toWindow(snap = false, start = true) {
    const z = rowZ(1)
    this.camTarget.set(1.6, 0.56, z + 0.06)
    this.lookTarget.set(3.4, 0.32, z - 0.35)
    if (snap) {
      this.camera.position.copy(this.camTarget)
      this.look.copy(this.lookTarget)
    }
    if (start) {
      this.takeoff = { t0: performance.now() }
      // a low deck of monsoon cloud, so the climb passes through it within the scene
      this.windowUniforms.uCloudBase.value = 210
      this.windowUniforms.uDryTrack.value = 1
    }
  }

  /** Final approach, flare, touchdown and roll-out on the runway, seen from the window seat. */
  startLanding() {
    this.landing = { t0: performance.now(), touched: false }
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const u = this.windowUniforms
    u.uTime.value = (now - this.t0) / 1000
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
    if (this.takeoff) {
      // a real take-off: accelerate down the runway, rotate to about 10 degrees nose up, lift off, then climb at
      // about 8.5 degrees. Height comes from speed times the climb angle, so the climb never looks vertical; after
      // lift-off the speed is a little faster than life so the cloud deck is reached within the scene.
      const k = (now - this.takeoff.t0) / 1000
      this.speed = takeoffSpeed(k)
      u.uPitch.value = 0.17 * ease((k - 4.0) / 1.2) - 0.11 * ease((k - 11.8) / 1.6)
      // height looked up from a table built once, so the climb is the same at any frame rate
      u.uAlt.value = takeoffAlt(k)
      // a gentle bank onto course, and level again
      u.uRoll.value = 0.09 * ease((k - 7.2) / 1.6) - 0.09 * ease((k - 10.2) / 1.6)
      this.rumble = u.uAlt.value < 1 ? this.speed / 110 : 0
    }
    if (this.landing) {
      // final approach, a gentle flare, touchdown with a jolt, then braking on the runway
      const k = (now - this.landing.t0) / 1000
      const T = 4.8
      u.uAlt.value = 720 * Math.pow(1 - ease(k / T) * 0.35 - Math.min(1, k / T) * 0.65, 1.15)
      if (k >= T) u.uAlt.value = 0
      u.uRoll.value = 0.06 * (1 - ease(k / 2.4))
      u.uPitch.value = 0.03 + 0.06 * ease((k - 3.6) / 1.1) - 0.09 * ease((k - T) / 1.2)
      this.speed = k < T ? 80 : 80 - 70 * ease((k - T) / 3.2)
      if (k >= T && !this.landing.touched) {
        this.landing.touched = true
        this.shake = 1
      }
      this.rumble = k >= T ? this.speed / 110 : 0
    }
    // distance travelled is integrated, so the ground never jumps or runs backwards when the speed changes
    u.uDist.value += this.speed * dt
    const kk = 1 - Math.pow(0.03, dt)
    this.camera.position.lerp(this.camTarget, kk)
    this.look.lerp(this.lookTarget, kk)
    // a gentle sway, and a jolt at touchdown
    this.shake = Math.max(0, this.shake - dt * 2.2)
    const sway = Math.sin(now / 1400) * 0.004
    // one soft bounce at touchdown and a slow, small roll on the runway: fast oscillation reads as a shiver
    const jolt = this.shake * 0.008 * Math.sin((1 - this.shake) * Math.PI * 2.2)
      + (this.rumble || 0) * 0.0007 * Math.sin(now / 160) * Math.sin(now / 410)
    this.camera.lookAt(this.look.x + sway, this.look.y + jolt, this.look.z)
    this.composer.render()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.composer.dispose()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }
}
