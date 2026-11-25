// Display geometry only: turns the stand and times chosen by the Java backend into a position on
// hand-laid taxi routes. Nothing here decides a stand, a time or an order.
import layout from './layout/stands-layout.json'

export const WORLD = { x: -300, y: -170, w: 3000, h: 1720 }
export const RWY_Y = 930
const TAXI_N = 868
const TAXI_S = 1000
const TOUCHDOWN_X = 2085
const LIFTOFF_X = 1460
const LINEUP = [2214, RWY_Y]

export const standIndex = {}
for (const s of layout.stands) standIndex[s.id] = s

const NORTH_GROUPS = new Set(['SW-S', 'SE-S', 'SW-N', 'NW-S', 'NW-N', 'NE-N', 'NE-S', 'SE-N', 'REM-W', 'REM-E'])

function entryFor(group) {
  const g = layout.groups[group]
  const tip = g ? g.lane[0] : null
  switch (group) {
    case 'SW-S': return [[1498, TAXI_N], [1498, 762], tip]
    case 'SE-S': return [[2162, TAXI_N], [2162, 762], tip]
    case 'SW-N':
    case 'NW-S': return [[1392, TAXI_N], [1392, tip[1]], tip]
    case 'NW-N': return [[1392, TAXI_N], [1392, 60], [tip[0], 60], tip]
    case 'NE-N': return [[2268, TAXI_N], [2268, 60], [tip[0], 60], tip]
    case 'NE-S':
    case 'SE-N': return [[2268, TAXI_N], [2268, tip[1]], tip]
    case 'REM-W': return [[1392, TAXI_N]]
    case 'REM-E': return [[2268, TAXI_N]]
    case 'T1': return [[1250, TAXI_S], [1250, 1058]]
    default: return [[1580, TAXI_S], [1580, 1196]]
  }
}

// ---------- polyline helpers ----------

export function makePath(points) {
  const pts = []
  for (const p of points) {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) pts.push(p)
  }
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  return { pts, cum, total: cum[cum.length - 1] || 0.0001 }
}

export function pointAt(path, frac) {
  const d = Math.max(0, Math.min(1, frac)) * path.total
  const { pts, cum } = path
  let i = 1
  while (i < pts.length - 1 && cum[i] < d) i++
  const a = pts[i - 1]
  const b = pts[i] || a
  const seg = cum[i] - cum[i - 1] || 1
  const k = (d - cum[i - 1]) / seg
  const x = a[0] + (b[0] - a[0]) * k
  const y = a[1] + (b[1] - a[1]) * k
  // smooth the heading through corners by looking a little ahead and behind
  const ahead = sample(path, Math.min(path.total, d + 10))
  const behind = sample(path, Math.max(0, d - 10))
  const heading = (Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]) * 180) / Math.PI
  return { x, y, heading }
}

function sample(path, d) {
  const { pts, cum } = path
  let i = 1
  while (i < pts.length - 1 && cum[i] < d) i++
  const a = pts[i - 1]
  const b = pts[i] || a
  const seg = cum[i] - cum[i - 1] || 1
  const k = (d - cum[i - 1]) / seg
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
}

export function pathD(points) {
  return points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
}

// ---------- routes per stand ----------

const routeCache = new Map()

export function routesFor(standId) {
  if (routeCache.has(standId)) return routeCache.get(standId)
  const s = standIndex[standId]
  if (!s) return null
  const north = NORTH_GROUPS.has(s.group)
  const entry = entryFor(s.group)
  const lanePt = s.lane
  const standPt = [s.x, s.y]
  const exitPts = north ? [[1790, RWY_Y], [1748, TAXI_N]] : [[1725, RWY_Y], [1690, TAXI_S]]
  const ty = north ? TAXI_N : TAXI_S
  const arr = makePath([...exitPts, [entry[0][0], ty], ...entry, lanePt, standPt])
  const outPts = [lanePt, ...entry.slice().reverse(), [2240, ty], [2240, ty + (north ? 30 : -30)], LINEUP]
  const dep = makePath(outPts)
  const push = makePath([standPt, lanePt])
  const r = { arr, dep, push, rolloutEnd: exitPts[0][0], lanePt, standPt, north }
  routeCache.set(standId, r)
  return r
}

// ---------- plane state at a clock minute ----------

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const easeOut = (k) => 1 - (1 - k) * (1 - k)
const easeIn = (k) => k * k

/**
 * Where a stand visit's aircraft is at minute t, following the stand and times from the plan.
 * Returns null when the aircraft is not on screen.
 */
export function planeState(v, t) {
  if (v.cancelled) return null
  const S = v.start
  const E = v.end
  if (!v.stand) {
    if (!v.arrival) return null
    if (t < S - 13 || t > Math.max(E, S + 60)) return null
    return holding(v, t)
  }
  const s = standIndex[v.stand]
  if (!s) return null
  const r = routesFor(v.stand)
  if (v.arrival) {
    if (t < S - 13) return null
    if (t < S - 7) {
      const k = (t - (S - 13)) / 6
      const x = 2780 + (TOUCHDOWN_X - 2780) * k
      return { x, y: RWY_Y, heading: 180, alt: 1 - easeOut(k), phase: 'approach' }
    }
    if (t < S - 6) {
      const k = easeOut(t - (S - 7))
      const x = TOUCHDOWN_X + (r.rolloutEnd - TOUCHDOWN_X) * k
      return { x, y: RWY_Y, heading: 180, alt: 0, phase: 'rollout', smoke: k < 0.25 ? 1 - k * 4 : 0 }
    }
    if (t < S) {
      const p = pointAt(r.arr, ease((t - (S - 6)) / 6))
      return { ...p, alt: 0, phase: 'taxi-in' }
    }
  } else if (t < S - 1) {
    return null
  } else if (t < S) {
    return { x: s.x, y: s.y, heading: s.heading, alt: 0, phase: 'parked', opacity: t - (S - 1) }
  }
  if (t < E) return { x: s.x, y: s.y, heading: s.heading, alt: 0, phase: 'parked' }
  if (v.departure) {
    if (t < E + 1.5) {
      const p = pointAt(r.push, ease((t - E) / 1.5))
      return { x: p.x, y: p.y, heading: s.heading, alt: 0, phase: 'pushback' }
    }
    if (t < E + 8) {
      const p = pointAt(r.dep, ease((t - E - 1.5) / 6.5))
      return { ...p, alt: 0, phase: 'taxi-out' }
    }
    if (t < E + 9.2) {
      const k = easeIn((t - E - 8) / 1.2)
      const x = LINEUP[0] + (LIFTOFF_X - LINEUP[0]) * k
      return { x, y: RWY_Y, heading: 180, alt: 0, phase: 'takeoff' }
    }
    if (t < E + 12) {
      const k = (t - E - 9.2) / 2.8
      const x = LIFTOFF_X + (-420 - LIFTOFF_X) * k
      return { x, y: RWY_Y - k * 40, heading: 182, alt: easeIn(Math.min(1, k * 1.2)), phase: 'climb' }
    }
    return null
  }
  if (t < E + 2) {
    const p = pointAt(r.push, ease((t - E) / 2))
    return { x: p.x, y: p.y, heading: s.heading, alt: 0, phase: 'tow', opacity: 1 - (t - E) / 2 }
  }
  return null
}

const HOLD = { cx: 640, cy: 1330, rx: 190, ry: 52 }

function holding(v, t) {
  let h = 0
  for (const c of v.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const phase = (h % 360) / 360
  const a = ((t / 4 + phase) % 1) * Math.PI * 2
  const x = HOLD.cx + HOLD.rx * Math.cos(a)
  const y = HOLD.cy + HOLD.ry * Math.sin(a)
  const heading = (Math.atan2(HOLD.ry * Math.cos(a), -HOLD.rx * Math.sin(a)) * 180) / Math.PI
  return { x, y, heading, alt: 0.85, phase: 'holding', unplaced: true }
}

export const HOLDING_PATTERN = HOLD
