// Everything around the airfield, for display only: a physical sky with the real sun path over
// Mumbai in November, the city that surrounds the airport (lit windows and street lights at night),
// the sea to the west, the hills to the north, stars, and the light that all of this casts.
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

const D2R = Math.PI / 180
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const C = (h) => new THREE.Color(h)

// Mumbai, mid November: sunrise about 06:45, sunset about 18:03 (IST), noon sun about 52 degrees up.
const RISE = 405
const SET = 1083

/** Sun elevation and azimuth (degrees) at a clock minute. */
export function sunAt(minute) {
  const m = ((minute % 1440) + 1440) % 1440
  const f = (m - RISE) / (SET - RISE)
  let el
  if (f >= 0 && f <= 1) el = 52 * Math.sin(Math.PI * f)
  else {
    const hrs = f > 1 ? (m - SET) / 60 : m < RISE ? (RISE - m) / 60 : 0
    el = -Math.min(48, hrs * 13)
  }
  const az = 112 + 136 * Math.max(-0.4, Math.min(1.4, f))
  return { el, az }
}

/** Unit vector towards the sun in scene space (+x east, +z south, +y up). */
export function sunVector(el, az, out = new THREE.Vector3()) {
  const e = el * D2R
  const a = az * D2R
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e))
}

/** What time of day it looks like: 'night', 'sunrise', 'morning', 'afternoon', 'evening', 'sunset'. */
export function dayPart(minute) {
  const m = ((minute % 1440) + 1440) % 1440
  if (m < RISE - 35 || m > SET + 45) return 'Night'
  if (m < RISE + 45) return 'Sunrise'
  if (m < 690) return 'Morning'
  if (m < 930) return 'Afternoon'
  if (m < SET - 40) return 'Evening'
  return 'Sunset'
}

// ---------- the city ----------

const b2 = (r) => Math.min(0.999, r() * 0.5 + 0.5)

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const FIELD = { x0: -1080, x1: 1150, z0: -705, z1: 695 } // airfield and its fence, scene units
const SEA_X = -1150 // the Arabian Sea lies west of this line
const HUBS = [
  { x: -300, z: 2900, r: 1300, h: 170 }, // Bandra Kurla Complex to the south
  { x: 2700, z: -2600, r: 1200, h: 150 }, // Powai to the north-east
  { x: -650, z: -2300, r: 1100, h: 110 }, // Andheri to the north
  { x: 3900, z: 1200, r: 1300, h: 120 }, // Ghatkopar to the east
  { x: 1200, z: 3600, r: 1100, h: 130 }
]

function cityMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.05 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uniforms.uNight
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN; varying float vSeed;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 cm = modelMatrix;
        #ifdef USE_INSTANCING
          cm = modelMatrix * instanceMatrix;
        #endif
        vCW = (cm * vec4(position, 1.0)).xyz;
        vCN = normalize(mat3(cm) * normal);
        vec3 o = (cm * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vSeed = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight;
        varying vec3 vCW; varying vec3 vCN; varying float vSeed;
        float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vCN.y) < 0.5) {
          float u0 = abs(vCN.x) > 0.5 ? vCW.z : vCW.x;
          float nearF = clamp(1.4 - max(fwidth(u0), fwidth(vCW.y)) * 0.9, 0.0, 1.0);
          // monsoon staining: dark vertical streaks running down from the roof line
          float sk = cHash(vec2(floor(u0 / 1.7), vSeed * 37.0));
          float streak = smoothstep(0.55, 1.0, sk) * (0.5 + 0.5 * fract(vCW.y * 0.013 + sk * 3.0));
          diffuseColor.rgb *= 1.0 - streak * 0.22 * nearF;
          // floor slabs: a pale band at every storey
          float slab = smoothstep(0.92, 0.98, fract(vCW.y / 3.4)) * nearF;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 + 0.04, slab * 0.5);
          // shopfronts on the ground floor: dark openings and painted shutters or signs
          if (vCW.y < 4.0) {
            float bay = floor(u0 / 3.2);
            float hs = cHash(vec2(bay, vSeed * 53.0));
            vec3 shopCol = mix(vec3(0.62, 0.16, 0.12), vec3(0.14, 0.32, 0.6), step(0.5, hs));
            shopCol = mix(shopCol, vec3(0.86, 0.7, 0.2), step(0.8, hs));
            float open = step(0.12, fract(u0 / 3.2)) * step(fract(u0 / 3.2), 0.88) * step(vCW.y, 2.9);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.1), shopCol * 0.8, step(2.4, vCW.y)), open * 0.85 * nearF);
            totalEmissiveRadiance += open * step(vCW.y, 2.4) * vec3(1.0, 0.75, 0.45) * uNight * 0.9 * step(0.35, hs);
          }
          // contact shadow where the wall meets the street
          diffuseColor.rgb *= 0.72 + 0.28 * smoothstep(0.0, 3.0, vCW.y);
        } else if (vCN.y > 0.5) {
          // roofs: patchy concrete, waterproofing and grime
          float rp = cHash(floor(vCW.xz / 2.5) + vSeed * 17.0);
          diffuseColor.rgb *= 0.8 + 0.25 * rp;
        }
        if (abs(vCN.y) < 0.5 && vCW.y > 4.0) {
          float u = abs(vCN.x) > 0.5 ? vCW.z : vCW.x;
          vec2 cell = vec2(u / 4.6, vCW.y / 3.4);
          vec2 f = fract(cell);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82);
          float h = cHash(floor(cell) + vSeed * 91.0);
          float lit = 0.72 + 0.22 * (1.0 - uNight);
          float on = step(lit, h);
          // far away the windows are smaller than a pixel: use their average instead of flickering
          float aa = clamp(1.6 - max(fwidth(cell.x), fwidth(cell.y)) * 2.2, 0.0, 1.0);
          win = mix(0.45, win, aa);
          on = mix(1.0 - lit, on, aa);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.19, 0.24), win * 0.6);
          vec3 warm = mix(vec3(1.0, 0.72, 0.4), vec3(0.78, 0.86, 1.0), step(0.86, fract(h * 13.0)));
          totalEmissiveRadiance += win * on * warm * uNight * 1.5;
        }`)
  }
  return mat
}

// The Mithi river: rises near the airport and winds south-west to the sea at Mahim creek.
export const RIVER = [[1500, 1500], [1100, 1350], [700, 1500], [380, 1900], [120, 2300], [-260, 2650], [-640, 2950],
  [-1000, 3250], [-1400, 3500]]

function riverDist(x, z) {
  let best = Infinity
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, az] = RIVER[i - 1]
    const [bx, bz] = RIVER[i]
    const vx = bx - ax
    const vz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t))
  }
  return best
}

function valueNoise(seed) {
  const h = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453
    return n - Math.floor(n)
  }
  return (x, y) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * ux
    const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * ux
    return a + (b - a) * uy
  }
}

export function buildCity(scene, uniforms) {
  const rnd = rng(20261116)
  const park = valueNoise(3.7)
  const boxes = []
  const lamps = []
  const roads = []
  const trees = []
  const tanks = []
  const CELL = 46
  const R = 6200
  for (let x = SEA_X + 40; x < R; x += CELL) {
    for (let z = -R; z < R; z += CELL) {
      const gx = Math.round(x / CELL)
      const gz = Math.round(z / CELL)
      const inField = x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1
      if (inField) continue
      const river = riverDist(x, z)
      if (river < 70) continue
      const dist = Math.hypot(x - 200, z)
      // main roads every few blocks, with street lights along them
      const roadX = gx % 5 === 0
      const roadZ = gz % 6 === 0
      if (roadX || roadZ) {
        if (dist < 5200) roads.push([x, z, roadX && roadZ ? 2 : roadX ? 0 : 1])
        if ((gx + gz) % 2 === 0 && rnd() < 0.75) lamps.push(x + (rnd() - 0.5) * 10, 7, z + (rnd() - 0.5) * 10)
        continue
      }
      // green: mangroves along the coast and the river, parks where the noise says so
      const coast = x - SEA_X < 160
      const greenery = coast || river < 150 || park(x / 900, z / 900) > 0.74
      if (greenery) {
        const n = coast || river < 150 ? 7 : 4
        for (let k = 0; k < n; k++) trees.push([x + (rnd() - 0.5) * CELL, z + (rnd() - 0.5) * CELL, 5 + rnd() * 6, coast ? 1 : 0])
        continue
      }
      const dx = Math.max(FIELD.x0 - x, 0, x - FIELD.x1)
      const dz = Math.max(FIELD.z0 - z, 0, z - FIELD.z1)
      const edge = Math.hypot(dx, dz)
      // thinner towards the horizon so the count stays sensible
      if (rnd() < smooth(2500, 6200, dist) * 0.7) continue
      let hub = 0
      for (const hb of HUBS) hub = Math.max(hub, hb.h * Math.exp(-Math.pow(Math.hypot(x - hb.x, z - hb.z) / hb.r, 2)))
      const near = edge < 380
      if (near) {
        // dense low-rise housing right up to the fence: several small roofs per block, at odd angles
        const n = 3 + Math.floor(rnd() * 3)
        for (let k = 0; k < n; k++) {
          boxes.push({ x: x + (rnd() - 0.5) * CELL * 0.9, z: z + (rnd() - 0.5) * CELL * 0.9, w: 7 + rnd() * 11, d: 7 + rnd() * 11,
            h: 4 + rnd() * 9, r: (rnd() - 0.5) * 0.5, c: rnd(), low: true, glass: false })
        }
        if (rnd() < 0.3) trees.push([x + (rnd() - 0.5) * CELL, z + (rnd() - 0.5) * CELL, 4 + rnd() * 4, 0])
        continue
      }
      const base = near ? 6 + rnd() * 10 : 10 + Math.pow(rnd(), 2.2) * 55
      const tall = rnd() < 0.18 ? hub * (0.4 + rnd() * 0.8) : hub * 0.15 * rnd()
      const h = Math.max(5, base + tall)
      const w = (near ? 16 : 20) + rnd() * 18
      const d = (near ? 16 : 20) + rnd() * 18
      const bx = x + (rnd() - 0.5) * 16
      const bz = z + (rnd() - 0.5) * 16
      const r = rnd() < 0.4 ? (rnd() - 0.5) * 0.6 : 0
      const glass = h > 70 && rnd() < 0.6
      boxes.push({ x: bx, z: bz, w, d, h, r, c: rnd(), low: near && h < 14, glass })
      // towers stand on a wider podium, step back near the top and carry a plant room or crown
      if (h > 60) {
        boxes.push({ x: bx, z: bz, w: w * 1.45, d: d * 1.45, h: 9 + rnd() * 6, r, c: rnd(), low: false, glass: false })
        const ch = 6 + rnd() * 14
        boxes.push({ x: bx, z: bz, w: w * (0.55 + rnd() * 0.25), d: d * (0.55 + rnd() * 0.25), h: h + ch, r, c: b2(rnd), low: false,
          glass, crown: true })
      } else if (h > 22 && rnd() < 0.55) {
        boxes.push({ x: bx + (rnd() - 0.5) * w * 0.4, z: bz + (rnd() - 0.5) * d * 0.4, w: 5 + rnd() * 4, d: 5 + rnd() * 4,
          h: h + 3.5, r, c: rnd(), low: false, glass: false, crown: true })
      }
      // water tanks and stair huts on the roofs
      if (!glass && rnd() < 0.45) tanks.push([bx + (rnd() - 0.5) * w * 0.5, h, bz + (rnd() - 0.5) * d * 0.5, rnd() < 0.5 ? 0 : 1])
      // a few street trees between blocks
      if (rnd() < 0.35) trees.push([x + CELL * 0.45, z + (rnd() - 0.5) * CELL, 4 + rnd() * 4, 0])
    }
  }
  // a handful of landmark glass towers in the business districts (Bandra Kurla, Powai, Andheri)
  for (const [x, z, h, w] of [[-260, 2750, 240, 34], [-120, 2960, 205, 30], [-420, 3050, 180, 40], [60, 2700, 160, 28],
    [2620, -2480, 190, 30], [2820, -2700, 150, 36], [-700, -2200, 140, 30], [-560, -2380, 120, 26], [3880, 1260, 150, 32]]) {
    boxes.push({ x, z, w, d: w * 0.8, h: h * 0.72, r: 0.2, c: 0.3, low: false, glass: true })
    boxes.push({ x, z, w: w * 0.72, d: w * 0.6, h, r: 0.2, c: 0.7, low: false, glass: true, crown: true })
    boxes.push({ x, z, w: w * 1.6, d: w * 1.3, h: 14, r: 0.2, c: 0.5, low: false, glass: false })
  }
  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(0, 0.5, 0)
  const mesh = new THREE.InstancedMesh(geo, cityMaterial(uniforms), boxes.length)
  const m = new THREE.Object3D()
  const col = new THREE.Color()
  // weathered whites and creams, pale yellows and salmons, sea-air blues and bare grey concrete
  const tones = ['#a39b8c', '#8f887b', '#b9b1a1', '#7f8387', '#9a9282', '#c2b9a6', '#6f6c66', '#aaa497', '#8d8172', '#b4ab9b',
    '#c9b79a', '#a58f7a', '#d8d2c4', '#8e9aa0', '#d9c58f', '#d4a48c', '#a9bdc6', '#e2dccd', '#bfae8a', '#c98f74', '#9fb3a2']
  boxes.forEach((b, i) => {
    m.position.set(b.x, 0, b.z)
    m.rotation.set(0, b.r, 0)
    m.scale.set(b.w, b.h, b.d)
    m.updateMatrix()
    mesh.setMatrixAt(i, m.matrix)
    // the blue tarpaulin roofs of the low-rise neighbourhoods right next to the fence
    if (b.low && b.c > 0.58) col.set(b.c > 0.88 ? '#3f6f9f' : b.c > 0.74 ? '#5d5248' : '#86705c')
    else if (b.glass) col.set(b.c > 0.5 ? '#5f7d96' : '#6f8a8f')
    else col.set(tones[Math.floor(b.c * tones.length)]).multiplyScalar(b.crown ? 0.7 : 0.66 + 0.18 * ((b.c * 7.3) % 1))
    mesh.setColorAt(i, col)
  })
  mesh.instanceColor.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  scene.add(mesh)

  // roads: dark asphalt strips with a pale centre line
  const roadTex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#3b3c3e'
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = 'rgba(230,230,220,0.55)'
    g.fillRect(31, 0, 2, 26)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(0, 0, 4, 64)
    g.fillRect(60, 0, 4, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const roadMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }), roads.length)
  roads.forEach(([x, z, k], i) => {
    m.position.set(x, 0.15, z)
    m.rotation.set(0, k === 1 ? Math.PI / 2 : 0, 0)
    m.scale.set(k === 2 ? 18 : 16, 1, CELL + 0.5)
    m.updateMatrix()
    roadMesh.setMatrixAt(i, m.matrix)
  })
  roadMesh.frustumCulled = false
  scene.add(roadMesh)

  // trees: low-poly crowns on short trunks, mangroves darker
  const crown = new THREE.IcosahedronGeometry(1, 1)
  crown.scale(1, 0.85, 1)
  crown.translate(0, 1.5, 0)
  const treeMesh = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), trees.length)
  trees.forEach(([x, z, sz, kind], i) => {
    m.position.set(x, 0, z)
    m.rotation.set(0, sz * 3, 0)
    m.scale.setScalar(sz)
    m.updateMatrix()
    treeMesh.setMatrixAt(i, m.matrix)
    col.set(kind ? '#2f4a2a' : ['#4f6b34', '#5d7a3a', '#46622f', '#6a8540'][Math.floor((sz * 7) % 4)])
    treeMesh.setColorAt(i, col)
  })
  treeMesh.instanceColor.needsUpdate = true
  treeMesh.frustumCulled = false
  scene.add(treeMesh)

  // rooftop water tanks (black, as on many Mumbai roofs) and stair huts
  const tankGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10)
  tankGeo.translate(0, 1.3, 0)
  const tankMesh = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), tanks.length)
  tanks.forEach(([x, y, z, kind], i) => {
    m.position.set(x, y, z)
    m.rotation.set(0, 0, 0)
    m.scale.set(kind ? 2.2 : 1, kind ? 1.2 : 1, kind ? 1.6 : 1)
    m.updateMatrix()
    tankMesh.setMatrixAt(i, m.matrix)
    tankMesh.setColorAt(i, col.set(kind ? '#8b8478' : '#26282b'))
  })
  tankMesh.instanceColor.needsUpdate = true
  tankMesh.frustumCulled = false
  scene.add(tankMesh)

  const lg = new THREE.BufferGeometry()
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3))
  return { mesh, lampGeo: lg, count: boxes.length }
}

/** Soft cloud shadows drifting over the ground in daylight. */
export function addCloudShadows(mat, uniforms) {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r)
    sh.uniforms.uTime = uniforms.uTime
    sh.uniforms.uCloud = uniforms.uCloud
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCS;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCS = (modelMatrix * vec4(position, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uCloud; varying vec3 vCS;
        float csH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float csN(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(csH(i), csH(i + vec2(1, 0)), u.x), mix(csH(i + vec2(0, 1)), csH(i + vec2(1, 1)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 cp = vCS.xz * 0.0009 + vec2(uTime * 0.006, uTime * 0.003);
        float cn = csN(cp) * 0.6 + csN(cp * 2.3) * 0.3 + csN(cp * 5.1) * 0.1;
        diffuseColor.rgb *= 1.0 - uCloud * 0.32 * smoothstep(0.52, 0.72, cn);`)
  }
  mat.needsUpdate = true
}

/** Cuts a ground material off at the shoreline, so ground that runs past the coast never lies on the sea. */
export function clipAtShore(mat) {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vShoreX;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvShoreX = (modelMatrix * vec4(position, 1.0)).x;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShoreX;')
      .replace('void main() {', 'void main() {\n  if (vShoreX < ' + (SEA_X + 30).toFixed(1) + ') discard;')
  }
  mat.needsUpdate = true
}

/** Sea and river: a standard material whose normals ripple with time, so it reflects the sky and glints in the sun. */
function waterMaterial(uniforms, colour, shoreX = null) {
  const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.07, metalness: 0.0, envMapIntensity: 1.0 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime
    sh.uniforms.uShore = { value: shoreX === null ? -1e9 : shoreX }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWW = (modelMatrix * vec4(position, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uShore; varying vec3 vWW;
        float wH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wN(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(wH(i), wH(i + vec2(1, 0)), u.x), mix(wH(i + vec2(0, 1)), wH(i + vec2(1, 1)), u.x), u.y); }
        vec2 wG(vec2 p) { return vec2(wN(p + vec2(0.35, 0.0)) - wN(p - vec2(0.35, 0.0)), wN(p + vec2(0.0, 0.35)) - wN(p - vec2(0.0, 0.35))); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uShore > -1e8) {
          // shallow, silty green-brown water by the shore, deep blue further out, and a line of surf
          float off = uShore - vWW.x;
          vec3 shallow = vec3(0.13, 0.21, 0.19);
          diffuseColor.rgb = mix(shallow, diffuseColor.rgb, smoothstep(20.0, 700.0, off));
          // a thin, broken line of surf that washes in and out
          float wash = 6.0 + 4.0 * sin(uTime * 0.7 + vWW.z * 0.004);
          float surf = (1.0 - smoothstep(0.0, wash, off)) * smoothstep(0.35, 0.75, wN(vec2(vWW.z * 0.04, uTime * 0.3)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.88), surf * 0.55);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // irregular swell from animated noise; the small ripples fade out with distance so they never alias
        vec2 wp = vWW.xz;
        vec2 wg = wG(wp * 0.008 + vec2(uTime * 0.02, uTime * 0.012)) * 1.0
          + wG(wp * 0.03 + vec2(-uTime * 0.05, uTime * 0.035)) * 0.6;
        float wAA = clamp(1.0 - length(fwidth(wp * 0.12)) * 1.5, 0.0, 1.0);
        wg += wG(wp * 0.12 + vec2(uTime * 0.11, -uTime * 0.08)) * 0.35 * wAA;
        // gentle tilt: steep ripples reflect the pale horizon everywhere and the sea turns white from above
        vec3 wn = normalize(vec3(wg.x * 0.2, 1.0, wg.y * 0.2));
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`)
  }
  return mat
}

// ---------- the whole surrounding environment ----------

export class Environment {
  constructor(scene, renderer, glowTex) {
    this.scene = scene
    this.renderer = renderer
    this.uniforms = { uNight: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0 } }
    this.sunDir = new THREE.Vector3()

    this.sky = new Sky()
    this.sky.scale.setScalar(40000)
    this.sky.userData.noAO = true
    scene.add(this.sky)
    // a second sky only for building the reflection map
    this.envScene = new THREE.Scene()
    this.envSky = new Sky()
    this.envSky.scale.setScalar(1000)
    this.envScene.add(this.envSky)
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.lastEnvKey = ''
    this.lastEnvAt = 0

    // ground beyond the airfield and the sea to the west
    // the land stops at the shore: under the sea it would fight the water for the same depth far away
    this.land = new THREE.Mesh(new THREE.PlaneGeometry(40000, 60000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#5a5c47', roughness: 1 }))
    this.land.position.set(SEA_X - 25 + 20000, -0.6, 0)
    this.land.receiveShadow = true
    addCloudShadows(this.land.material, this.uniforms)
    scene.add(this.land)
    const seaGeo = new THREE.PlaneGeometry(30000, 60000).rotateX(-Math.PI / 2)
    this.sea = new THREE.Mesh(seaGeo, waterMaterial(this.uniforms, '#163548', SEA_X - 30))
    this.sea.position.set(SEA_X - 15000 - 30, -0.3, 0)
    scene.add(this.sea)
    this.buildShips()
    this.buildSeaLink()
    // a sandy shore between the sea and the mangroves
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(70, 60000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#9c8f72', roughness: 1 }))
    shore.position.set(SEA_X + 10, -0.25, 0)
    scene.add(shore)
    // the Mithi river, widening towards Mahim creek
    const pts = RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z))
    const curve = new THREE.CatmullRomCurve3(pts)
    const N = 160
    const pos = []
    const idx = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = curve.getPoint(t)
      const tg = curve.getTangent(t)
      const w = 40 + t * t * 150
      pos.push(p.x - tg.z * w, 0.25, p.z + tg.x * w, p.x + tg.z * w, 0.25, p.z - tg.x * w)
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    rg.setIndex(idx)
    rg.computeVertexNormals()
    const riverMesh = new THREE.Mesh(rg, waterMaterial(this.uniforms, '#2a4248'))
    riverMesh.material.side = THREE.DoubleSide
    scene.add(riverMesh)

    // low green hills to the north (Sanjay Gandhi National Park) and the east
    const hillMat = new THREE.MeshStandardMaterial({ color: '#3e4a2c', roughness: 1, flatShading: false })
    for (const [x, z, sx, sy, sz] of [[2600, -7600, 4200, 420, 1500], [1400, -8400, 3000, 300, 1200], [6400, -5200, 2600, 360, 1600],
      [8200, 1500, 1800, 260, 2600]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), hillMat)
      hill.scale.set(sx, sy, sz)
      hill.position.set(x, -1, z)
      scene.add(hill)
    }

    const city = buildCity(scene, this.uniforms)
    this.city = city.mesh
    this.lamps = new THREE.Points(city.lampGeo, new THREE.PointsMaterial({ size: 11, map: glowTex, color: C('#ffb36b').multiplyScalar(1.6),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    this.lamps.frustumCulled = false
    scene.add(this.lamps)

    // stars and a warm glow of city light low on the horizon at night
    const starPos = []
    const r = rng(7)
    for (let i = 0; i < 2600; i++) {
      const v = new THREE.Vector3(r() - 0.5, r() * 0.9 + 0.04, r() - 0.5).normalize().multiplyScalar(17000)
      starPos.push(v.x, v.y, v.z)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, color: '#dfe6ff', transparent: true, sizeAttenuation: false,
      depthWrite: false, fog: false }))
    scene.add(this.stars)
    const glowC = document.createElement('canvas')
    glowC.width = 4
    glowC.height = 256
    const gg = glowC.getContext('2d')
    const grad = gg.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(255,150,80,0)')
    grad.addColorStop(0.75, 'rgba(255,150,90,0.35)')
    grad.addColorStop(1, 'rgba(255,170,110,0.6)')
    gg.fillStyle = grad
    gg.fillRect(0, 0, 4, 256)
    const glowTexH = new THREE.CanvasTexture(glowC)
    this.horizonGlow = new THREE.Mesh(new THREE.CylinderGeometry(16000, 16000, 2600, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: glowTexH, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, opacity: 0 }))
    this.horizonGlow.position.y = 1100
    scene.add(this.horizonGlow)

    this.buildClouds()
    this.overcast = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 16),
      new THREE.MeshBasicMaterial({ color: '#4c5560', side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }))
    this.overcast.userData.noAO = true
    this.overcast.visible = false
    scene.add(this.overcast)

    // lights
    this.hemi = new THREE.HemisphereLight('#bcd3ee', '#4d4436', 0.6)
    scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight('#fff4e5', 3)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(4096, 4096)
    const sc = this.sun.shadow.camera
    sc.left = -1500; sc.right = 1500; sc.top = 1100; sc.bottom = -1100; sc.near = 10; sc.far = 9000
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.6
    this.sun.shadow.radius = 3
    scene.add(this.sun, this.sun.target)
    // floodlights and moonlight together: a soft cool light from above at night
    this.flood = new THREE.DirectionalLight('#dfe6ff', 0)
    this.flood.position.set(-300, 2000, 600)
    scene.add(this.flood, this.flood.target)
    scene.fog = new THREE.Fog('#a9bccd', 2500, 15000)
  }

  /** Ships at anchor off the coast and fishing boats close in, bobbing gently. */
  buildShips() {
    const r = rng(1311)
    const hull = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const house = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const ships = []
    for (let i = 0; i < 26; i++) {
      const big = i < 12
      const x = SEA_X - (big ? 1800 + r() * 6500 : 150 + r() * 900)
      const z = (r() - 0.5) * (big ? 16000 : 9000)
      const L = big ? 110 + r() * 160 : 12 + r() * 10
      ships.push({ x, z, L, W: big ? L * 0.15 : L * 0.3, yaw: r() * Math.PI, big, c: r() })
    }
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, ships.length)
      m.frustumCulled = false
      m.castShadow = true
      this.scene.add(m)
      return m
    }
    this.hulls = mk(hull, new THREE.MeshStandardMaterial({ roughness: 0.6 }))
    this.decks = mk(house, new THREE.MeshStandardMaterial({ roughness: 0.6, color: '#e8e6e0' }))
    this.ships = ships
    const col = new THREE.Color()
    ships.forEach((sp, i) => {
      this.hulls.setColorAt(i, col.set(sp.big ? ['#6b2b25', '#1f3b57', '#2d2f33', '#7a5a2a'][Math.floor(sp.c * 4)] : ['#2f7fb0', '#c94f3a', '#e0c04a', '#3f8f5f'][Math.floor(sp.c * 4)]))
      this.decks.setColorAt(i, col.set(sp.big ? '#e8e6e0' : '#d9d2c2'))
    })
    this.placeShips(0)
  }

  placeShips(t) {
    const d = new THREE.Object3D()
    this.ships.forEach((sp, i) => {
      const bob = Math.sin(t * 0.8 + i) * (sp.big ? 0.15 : 0.35)
      d.position.set(sp.x, -1.5 + bob, sp.z)
      d.rotation.set(Math.sin(t * 0.6 + i * 2) * (sp.big ? 0.004 : 0.03), sp.yaw, 0)
      d.scale.set(sp.L, sp.big ? 9 : 2.2, sp.W)
      d.updateMatrix()
      this.hulls.setMatrixAt(i, d.matrix)
      // bridge and accommodation at the stern of a ship, a small cabin on a fishing boat
      d.position.set(sp.x - Math.cos(sp.yaw) * sp.L * 0.36, (sp.big ? 7.5 : 0.7) + bob, sp.z + Math.sin(sp.yaw) * sp.L * 0.36)
      d.scale.set(sp.L * (sp.big ? 0.12 : 0.3), sp.big ? 14 : 2.2, sp.W * 0.8)
      d.updateMatrix()
      this.decks.setMatrixAt(i, d.matrix)
    })
    this.hulls.instanceMatrix.needsUpdate = true
    this.decks.instanceMatrix.needsUpdate = true
  }

  /** The Bandra-Worli Sea Link: a long deck on piers just offshore, with two cable-stayed towers. */
  buildSeaLink() {
    const g = new THREE.Group()
    const x0 = SEA_X - 420
    const z0 = 3900
    const len = 4700
    const mat = new THREE.MeshStandardMaterial({ color: '#c9c4b8', roughness: 0.75 })
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 3, len), mat)
    deck.position.set(x0, 22, z0 + len / 2)
    g.add(deck)
    const piers = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 24, 8).translate(0, 10, 0), mat, Math.floor(len / 60))
    const d = new THREE.Object3D()
    for (let i = 0; i < piers.count; i++) {
      d.position.set(x0, -2, z0 + i * 60 + 30)
      d.updateMatrix()
      piers.setMatrixAt(i, d.matrix)
    }
    g.add(piers)
    const cables = []
    for (const k of [0.3, 0.62]) {
      const zt = z0 + len * k
      const leg = new THREE.BoxGeometry(5, 128, 7)
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(leg, mat)
        l.position.set(x0 + sx * 9, 64, zt)
        l.rotation.z = sx * 0.09
        g.add(l)
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(6, 40, 7), mat)
      top.position.set(x0, 140, zt)
      g.add(top)
      for (let j = 1; j <= 9; j++) {
        for (const dir of [-1, 1]) {
          cables.push(x0, 150 - j * 8, zt, x0, 24, zt + dir * j * 26)
        }
      }
    }
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3))
    g.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: '#e4e1d8' })))
    g.traverse((o) => { if (o.isMesh) o.castShadow = false })
    this.scene.add(g)
  }

  /** Scattered fair-weather cumulus: soft billboards high over the city, lit by the sun's colour. */
  buildClouds() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    const r = rng(41)
    // a flat-bottomed puff built from overlapping soft circles, brighter on top
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 176
      const y = 46 + r() * 40 - Math.abs(x - 128) * 0.12
      const rad = 18 + r() * 26
      const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad)
      gr.addColorStop(0, 'rgba(255,255,255,0.95)')
      gr.addColorStop(0.6, 'rgba(236,240,246,0.55)')
      gr.addColorStop(1, 'rgba(220,226,236,0)')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, rad, 0, Math.PI * 2)
      g.fill()
    }
    g.globalCompositeOperation = 'destination-out'
    const cut = g.createLinearGradient(0, 86, 0, 128)
    cut.addColorStop(0, 'rgba(0,0,0,0)')
    cut.addColorStop(1, 'rgba(0,0,0,1)')
    g.fillStyle = cut
    g.fillRect(0, 86, 256, 42)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: '#ffffff' })
    this.clouds = new THREE.Group()
    const rr = rng(99)
    for (let i = 0; i < 70; i++) {
      const a = rr() * Math.PI * 2
      const d = 3500 + rr() * 11000
      const sp = new THREE.Sprite(this.cloudMat)
      const w = 900 + rr() * 1900
      sp.scale.set(w, w * 0.42, 1)
      sp.position.set(Math.cos(a) * d, 1300 + rr() * 1400, Math.sin(a) * d)
      sp.userData.drift = 0.6 + rr() * 0.8
      sp.userData.noAO = true
      this.clouds.add(sp)
    }
    this.clouds.userData.noAO = true
    this.scene.add(this.clouds)
  }

  updateClouds(el, day, golden, night, st) {
    this.clouds.visible = st < 0.99 && night < 0.95
    const col = this.cloudMat.color
    col.copy(C('#3a4258')).lerp(C('#ffb48a'), golden).lerp(C('#ffffff'), day * (1 - golden))
    // seen from up among them, sprite clouds turn into a white smear over everything: fade them out first
    const camY = this.camY || 0
    this.cloudMat.opacity = (0.35 + 0.5 * Math.max(day, golden)) * (1 - night * 0.8) * (1 - smooth(500, 1000, camY)) * (1 - st)
    const t = performance.now() / 1000
    for (const sp of this.clouds.children) {
      sp.position.x += 0.02 * sp.userData.drift
      if (sp.position.x > 15000) sp.position.x -= 30000
    }
    this.clouds.rotation.y = t * 0.0002
  }

  updateEnvMap(el, storm) {
    const key = Math.round(el * 1.5) + (storm ? 's' : '')
    const now = performance.now()
    if (key === this.lastEnvKey || now - this.lastEnvAt < 350) return
    this.lastEnvKey = key
    this.lastEnvAt = now
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 2000)
    if (this.envRT) this.envRT.dispose()
    this.envRT = rt
    this.scene.environment = rt.texture
  }

  /**
   * Sets sky, sun, fog and the city lights for a clock minute. `st` is how stormy it is, from 0 (clear) to 1
   * (monsoon); it eases in between, so the weather clears or closes in smoothly. Returns how dark it is.
   */
  update(minute, st) {
    st = typeof st === 'number' ? st : st ? 1 : 0
    const storm = st > 0.5
    const { el, az } = sunAt(minute)
    sunVector(el, az, this.sunDir)
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms
      // in a storm the sky is overcast: the reflection map uses a calm sky and the background turns grey
      // hazier and redder near the horizon at sunrise and sunset, clear blue at midday
      const low = 1 - smooth(4, 24, el)
      u.turbidity.value = 6 + 5 * low
      u.rayleigh.value = 1.5 + 1.6 * low
      u.mieCoefficient.value = 0.004 + 0.004 * low
      u.mieDirectionalG.value = 0.82 + 0.1 * low
      u.sunPosition.value.copy(this.sunDir)
    }
    // the sky used for reflections and fill light stays clear and blue near sunrise and sunset; otherwise its
    // orange horizon lights every surface orange and the whole scene turns brown
    const eu = this.envSky.material.uniforms
    const lowE = 1 - smooth(4, 24, el)
    eu.turbidity.value = 6 - 4 * lowE
    eu.mieCoefficient.value = 0.004 - 0.002 * lowE
    eu.rayleigh.value = 1.5 + 1.7 * lowE
    const day = smooth(-4, 8, el) // 0 at night, 1 in daylight
    const twilight = smooth(-9, 3, el)
    const night = 1 - smooth(-9, 1, el)
    const golden = smooth(-4, 2, el) * (1 - smooth(8, 24, el))
    this.updateEnvMap(el, storm)
    // the reflected sky is orange at dawn; keep it low then so the cool sky fill below sets the shade colour
    this.scene.environmentIntensity = (0.24 + 0.14 * day) * (1 - 0.75 * st)

    // sun light, warm and low at the ends of the day
    this.sun.position.copy(this.sunDir).multiplyScalar(4000).add(new THREE.Vector3(200, 0, 50))
    this.sun.target.position.set(200, 0, 50)
    // warm, strong, low sun against cool blue shade: the contrast that makes a sunrise read as one
    this.sun.intensity = smooth(-1.5, 4, el) * (2.3 + 1.5 * smooth(4, 30, el)) * (1 - 0.7 * st)
    this.sun.color.copy(C('#ff8a45')).lerp(C('#ffcf9c'), smooth(1, 10, el)).lerp(C('#fff7ec'), smooth(10, 32, el))
    this.sun.castShadow = el > 0
    this.hemi.color.copy(C('#1b2742')).lerp(C('#7d89b8'), twilight * (1 - day * 0.4)).lerp(C('#c7daf1'), day * (1 - golden))
    this.hemi.groundColor.copy(C('#2b2420')).lerp(C('#6b6250'), day)
    this.hemi.intensity = 0.22 + 0.3 * twilight - 0.12 * day + 1.5 * golden + 0.12 * st
    this.flood.intensity = 0.6 * night
    // fog takes the colour of the horizon
    const fogCol = C('#0d1220').lerp(C('#a99aa8'), golden).lerp(C('#b3c4d5'), day * (1 - golden))
    const stormFog = fogCol.clone().lerp(C('#4c5560'), 0.85).multiplyScalar(0.55 + 0.45 * day)
    fogCol.lerp(stormFog, st)
    this.scene.fog.color.copy(fogCol)
    // a light haze over the city softens the distance; the airfield itself stays clear
    // haze over the city in the distance; the airfield itself stays clear
    this.scene.fog.near = 2600 - 900 * st
    this.scene.fog.far = 12500 - 3000 * st
    // an overcast dome in front of the sky, faded in and out with the storm, so the sky never snaps to grey
    this.overcast.material.color.copy(fogCol)
    this.overcast.material.opacity = st
    this.overcast.visible = st > 0.002
    this.sky.visible = st < 0.998
    if (this.scene.background) this.scene.background = null
    this.stars.material.opacity = night * (0.9 - 0.8 * st)
    this.stars.visible = night > 0.02
    this.horizonGlow.material.opacity = night * 0.7
    this.uniforms.uNight.value = Math.max(night, smooth(4, -4, el) * 0.5, 0.3 * st)
    this.lamps.material.opacity = smooth(5, -3, el)
    this.lamps.visible = this.lamps.material.opacity > 0.02
    this.renderer.toneMappingExposure = 0.47 + 0.23 * st + 0.53 * (1 - day) + 0.2 * night + 0.22 * golden
    this.updateClouds(el, day, golden, night, st)
    this.uniforms.uTime.value = performance.now() / 1000
    this.placeShips(this.uniforms.uTime.value)
    this.uniforms.uCloud.value = day * (1 - st)
    return { night, day, golden, el }
  }
}
