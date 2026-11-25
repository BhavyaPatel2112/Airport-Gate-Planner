// Crisp stand markings drawn as decals over the airfield texture: lead-in line, stop bars, the red
// equipment restraint line, wingtip clearance lines, and the stand number painted at the entry.
// One shared marking texture for every stand and one small atlas for the numbers, so this is two draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import layout from '../scene/layout/stands-layout.json'
import { toScene } from './buildings'

/** Stand box in stand-local metres: x runs along the parking heading (nose at +x), y across. */
export function standBox(s) {
  const wide = s.size === 'WIDE'
  const L = wide ? 64 : 42
  const W = wide ? 62 : 38
  return { L, W, x0: -L * 0.62, x1: L * 0.38 }
}

function markingTexture() {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  // the canvas is the stand box: left edge = entry (tail side), right edge = nose side, centre row = lead-in line
  const yellow = 'rgba(244,196,48,0.95)'
  const red = 'rgba(200,48,48,0.75)'
  const white = 'rgba(245,246,248,0.85)'
  const px = (k) => k * S
  // equipment restraint line: red, around the box
  g.strokeStyle = red
  g.lineWidth = px(0.007)
  g.strokeRect(px(0.03), px(0.04), px(0.94), px(0.92))
  // "no parking" hatching where the bridge and the front service vehicles work
  g.save()
  g.beginPath()
  g.rect(px(0.62), px(0.06), px(0.33), px(0.16))
  g.clip()
  g.lineWidth = px(0.004)
  g.strokeStyle = 'rgba(200,48,48,0.45)'
  for (let k = -0.3; k < 1.4; k += 0.05) {
    g.beginPath()
    g.moveTo(px(0.6 + k * 0.4), px(0.06))
    g.lineTo(px(0.6 + k * 0.4 - 0.16), px(0.22))
    g.stroke()
  }
  g.restore()
  // wingtip clearance lines: white, dashed, along both long sides
  g.strokeStyle = white
  g.lineWidth = px(0.006)
  g.setLineDash([px(0.03), px(0.02)])
  for (const y of [0.1, 0.9]) {
    g.beginPath()
    g.moveTo(px(0.08), px(y))
    g.lineTo(px(0.92), px(y))
    g.stroke()
  }
  g.setLineDash([])
  // lead-in centre line, with a black border so it reads on light concrete
  g.strokeStyle = 'rgba(20,20,20,0.55)'
  g.lineWidth = px(0.018)
  g.beginPath()
  g.moveTo(0, px(0.5))
  g.lineTo(px(0.9), px(0.5))
  g.stroke()
  g.strokeStyle = yellow
  g.lineWidth = px(0.009)
  g.stroke()
  // stop bars for the nose wheel: one long bar and short type bars before it
  g.fillStyle = 'rgba(20,20,20,0.55)'
  g.fillRect(px(0.895), px(0.43), px(0.022), px(0.14))
  g.fillStyle = yellow
  g.fillRect(px(0.9), px(0.44), px(0.012), px(0.12))
  for (const x of [0.82, 0.86]) g.fillRect(px(x), px(0.465), px(0.008), px(0.07))
  // lead-in arrow chevrons at the entry
  g.strokeStyle = yellow
  g.lineWidth = px(0.007)
  for (const x of [0.1, 0.16]) {
    g.beginPath()
    g.moveTo(px(x), px(0.46))
    g.lineTo(px(x + 0.03), px(0.5))
    g.lineTo(px(x), px(0.54))
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function numberAtlas(ids) {
  const cols = 8
  const cw = 128
  const ch = 64
  const rows = Math.ceil(ids.length / cols)
  const c = document.createElement('canvas')
  c.width = cols * cw
  c.height = rows * ch
  const g = c.getContext('2d')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 40px Inter, Arial, sans-serif'
  const cells = {}
  ids.forEach((id, i) => {
    const x = (i % cols) * cw
    const y = Math.floor(i / cols) * ch
    // painted the way stands are marked: yellow figures on a black panel
    g.fillStyle = '#16181b'
    g.fillRect(x + 4, y + 6, cw - 8, ch - 12)
    g.fillStyle = '#f4c430'
    g.fillText(id, x + cw / 2, y + ch / 2 + 1)
    cells[id] = [x / c.width, 1 - (y + ch) / c.height, cw / c.width, ch / c.height]
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { tex: t, cells }
}

/** A flat quad in stand-local metres (x along the heading, z across), laid on the ground at the stand. */
function quad(s, cx, cz, len, wid, uv) {
  const g = new THREE.PlaneGeometry(len, wid)
  g.rotateX(-Math.PI / 2)
  if (uv) {
    const a = g.attributes.uv
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * uv[2], uv[1] + a.getY(i) * uv[3])
  }
  g.translate(cx, 0, cz)
  const r = (s.heading * Math.PI) / 180
  g.rotateY(-r)
  const [x, z] = toScene(s.x, s.y)
  g.translate(x, 0, z)
  return g
}

export function buildStandMarks() {
  const group = new THREE.Group()
  const marks = []
  const nums = []
  const atlas = numberAtlas(layout.stands.map((s) => s.id))
  for (const s of layout.stands) {
    const b = standBox(s)
    marks.push(quad(s, (b.x0 + b.x1) / 2, 0, b.L, b.W))
    const wide = s.size === 'WIDE'
    // the number sits on the lead-in line at the entry, readable from the taxi lane
    const nl = wide ? 11 : 9
    const g = quad(s, b.x0 + nl * 0.75, 0, nl, nl / 2, atlas.cells[s.id])
    // turn it so it reads from the lane: text runs across the line
    nums.push(g)
  }
  const mat = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.85, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false })
  const markMesh = new THREE.Mesh(mergeGeometries(marks), mat(markingTexture()))
  markMesh.position.y = 0.05
  markMesh.receiveShadow = true
  markMesh.renderOrder = 1
  const numMesh = new THREE.Mesh(mergeGeometries(nums), mat(atlas.tex))
  numMesh.position.y = 0.07
  numMesh.receiveShadow = true
  numMesh.renderOrder = 2
  group.add(markMesh, numMesh)
  group.userData.materials = [markMesh.material, numMesh.material]
  return group
}
