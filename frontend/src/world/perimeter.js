// The airfield fence: posts every few metres and a see-through chain-link panel between them,
// with the bare strip and service road painted on the ground (ground.js). Display only.
import * as THREE from 'three'
import { toScene } from './buildings'

const RECT = { x0: 300, x1: 2410, y0: -20, y1: 1310 } // layout units, same as the painted airfield
const H = 3.2

function meshTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.strokeStyle = 'rgba(200,205,210,0.9)'
  g.lineWidth = 1.4
  for (let k = -64; k < 128; k += 8) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke()
    g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke()
  }
  // top and bottom rails
  g.fillStyle = 'rgba(190,195,200,1)'
  g.fillRect(0, 0, 64, 3)
  g.fillRect(0, 61, 64, 3)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildFence() {
  const group = new THREE.Group()
  const corners = [[RECT.x0, RECT.y0], [RECT.x1, RECT.y0], [RECT.x1, RECT.y1], [RECT.x0, RECT.y1]].map(([x, y]) => toScene(x, y))
  const tex = meshTexture()
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide,
    roughness: 0.6, metalness: 0.4, depthWrite: true })
  const posts = []
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i]
    const [bx, bz] = corners[(i + 1) % 4]
    const len = Math.hypot(bx - ax, bz - az)
    const panel = new THREE.PlaneGeometry(len, H)
    const uv = panel.attributes.uv
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (len / 3))
    const m = new THREE.Mesh(panel, panelMat)
    m.position.set((ax + bx) / 2, H / 2, (az + bz) / 2)
    m.rotation.y = -Math.atan2(bz - az, bx - ax)
    group.add(m)
    for (let d = 0; d < len; d += 6) posts.push([ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len])
  }
  const post = new THREE.CylinderGeometry(0.07, 0.07, H + 0.4, 5)
  post.translate(0, (H + 0.4) / 2, 0)
  const inst = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.5, metalness: 0.5 }), posts.length)
  const o = new THREE.Object3D()
  posts.forEach(([x, z], i) => {
    o.position.set(x, 0, z)
    o.updateMatrix()
    inst.setMatrixAt(i, o.matrix)
  })
  inst.frustumCulled = false
  group.add(inst)
  return group
}
