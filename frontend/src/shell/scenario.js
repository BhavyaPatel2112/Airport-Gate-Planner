// Scenario lab: disruption types the teacher can stack in any order. Running a scenario always
// starts from a fresh plan, so editing or removing a step simply runs everything again.
// Every step is one backend call; the browser never plans anything itself.
import { api } from '../api/client'
import layout from '../scene/layout/stands-layout.json'
import { hhmm } from '../state/clock'

const hm = (m) => hhmm(m).replace(':', '')

const GROUP_NAMES = {
  'SW-S': 'T2 south-west pier, outer', 'SW-N': 'T2 south-west pier, inner', 'NW-S': 'T2 north-west pier, inner',
  'NW-N': 'T2 north-west pier, outer', 'SE-S': 'T2 south-east pier, outer', 'SE-N': 'T2 south-east pier, inner',
  'NE-S': 'T2 north-east pier, inner', 'NE-N': 'T2 north-east pier, outer', 'REM-W': 'Remote apron west',
  'REM-E': 'Remote apron east', 'REM-SA': 'Remote apron south A', 'REM-SB': 'Remote apron south B', T1: 'Terminal 1'
}

export const STAND_GROUPS = Object.keys(GROUP_NAMES).map((key) => {
  const stands = layout.stands.filter((s) => s.group === key)
  const intl = stands.filter((s) => s.intl).length
  const wide = stands.filter((s) => s.size === 'WIDE').length
  return {
    key, name: GROUP_NAMES[key], stands: stands.map((s) => s.id), count: stands.length,
    note: (intl === stands.length ? 'international' : intl === 0 ? 'domestic' : 'mixed') + ', ' + wide + ' wide-body'
  }
})

export const TAXIWAYS = layout.taxiways.map((t) => t.id)

export const STEP_TYPES = {
  storm: {
    title: 'Monsoon storm', unit: 6, icon: 'storm',
    blurb: 'Each arrival in the window may be hit and is delayed by its airline\'s real delay at the chosen percentile.',
    algorithms: ['Randomized Quickselect', 'Red-black interval tree', 'Bipartite matching'],
    defaults: { from: 840, to: 1020, severity: 90, seed: 7 },
    fields: [['from', 'time', 'From'], ['to', 'time', 'To'], ['severity', 'range', 'Severity (percentile)', 50, 99], ['seed', 'seed', 'Random pattern']],
    summary: (p) => hhmm(p.from) + ' to ' + hhmm(p.to) + ', p' + p.severity + ', seed ' + p.seed,
    at: (p) => p.from,
    run: (id, p) => api.storm(id, p.severity, p.seed, p.from, p.to)
  },
  fog: {
    title: 'Fog ground delay', unit: 3, icon: 'fog',
    blurb: 'Air traffic control holds every arrival in the window for the same number of minutes.',
    algorithms: ['Red-black interval tree', 'Maximum matching'],
    defaults: { from: 360, to: 480, minutes: 40 },
    fields: [['from', 'time', 'From'], ['to', 'time', 'To'], ['minutes', 'range', 'Hold (minutes)', 5, 180]],
    summary: (p) => hhmm(p.from) + ' to ' + hhmm(p.to) + ', every arrival +' + p.minutes + ' min',
    at: (p) => p.from,
    run: (id, p) => api.groundDelay(id, p.from, p.to, p.minutes)
  },
  rush: {
    title: 'Extra arrivals', unit: 5, icon: 'rush',
    blurb: 'Diverted or extra flights land that were never in the plan. Matching looks for free compatible stands.',
    algorithms: ['Maximum matching', 'Fibonacci heap', 'Minimum cut'],
    defaults: { at: 570, count: 30, seed: 11 },
    fields: [['at', 'time', 'Starting'], ['count', 'range', 'How many flights', 1, 200], ['seed', 'seed', 'Random pattern']],
    summary: (p) => p.count + ' flights from ' + hhmm(p.at + 20),
    at: (p) => p.at + 20,
    run: (id, p) => api.rush(id, p.count, p.seed, p.at)
  },
  closeStands: {
    title: 'Close stands', unit: 4, icon: 'close',
    blurb: 'A notice closes whole piers or aprons. The suffix tree reads the notice; affected flights must move.',
    algorithms: ['Suffix tree', 'Red-black interval tree', 'Maximum matching', 'Minimum cut'],
    defaults: { groups: ['SE-S', 'SE-N'], from: 540, to: 720 },
    fields: [['from', 'time', 'From'], ['to', 'time', 'To'], ['groups', 'groups', 'Which stands']],
    summary: (p) => {
      const n = STAND_GROUPS.filter((g) => p.groups.includes(g.key)).reduce((a, g) => a + g.count, 0)
      return n + ' stands, ' + hhmm(p.from) + ' to ' + hhmm(p.to)
    },
    at: (p) => p.from,
    notice: (p) => {
      const ids = STAND_GROUPS.filter((g) => p.groups.includes(g.key)).flatMap((g) => g.stands)
      return 'VABB STANDS ' + ids.join(',') + ' CLSD ' + hm(p.from) + '-' + hm(p.to) + ' DUE WORK IN PROGRESS'
    },
    run: (id, p) => api.notice(id, STEP_TYPES.closeStands.notice(p), 'apply')
  },
  closeTaxiway: {
    title: 'Close a taxiway', unit: 4, icon: 'twy',
    blurb: 'A taxiway closure cuts off every stand that can only be reached through it.',
    algorithms: ['Suffix tree', 'Maximum matching', 'Minimum cut'],
    defaults: { twy: 'W', from: 1260, to: 1410 },
    fields: [['from', 'time', 'From'], ['to', 'time', 'To'], ['twy', 'taxiway', 'Taxiway']],
    summary: (p) => 'Taxiway ' + p.twy + ', ' + hhmm(p.from) + ' to ' + hhmm(p.to),
    at: (p) => p.from,
    notice: (p) => 'VABB TWY ' + p.twy + ' CLSD ' + hm(p.from) + '-' + hm(p.to) + ' DUE AIRCRAFT ON GROUND',
    run: (id, p) => api.notice(id, STEP_TYPES.closeTaxiway.notice(p), 'apply')
  },
  delay: {
    title: 'Delay one flight', unit: 3, icon: 'delay',
    blurb: 'One flight is late. If its buffer cannot absorb the delay, the interval tree finds who it now clashes with.',
    algorithms: ['Red-black interval tree', 'Maximum matching'],
    defaults: { flight: 'AI 2927', minutes: 60 },
    fields: [['flight', 'flight', 'Flight'], ['minutes', 'range', 'Delay (minutes)', 5, 300]],
    summary: (p) => p.flight + ' +' + p.minutes + ' min',
    run: (id, p) => api.delay(id, p.flight, p.minutes, null)
  },
  cancel: {
    title: 'Cancel a flight', unit: 2, icon: 'cancel',
    blurb: 'The stand frees up early: decrease-key in the Fibonacci heap, and waiting flights get another chance.',
    algorithms: ['Fibonacci heap', 'Maximum matching'],
    defaults: { flight: '6E 6362' },
    fields: [['flight', 'flight', 'Flight']],
    summary: (p) => p.flight,
    run: (id, p) => api.cancel(id, p.flight, null)
  },
  swap: {
    title: 'Aircraft swap', unit: 5, icon: 'swap',
    blurb: 'The airline sends a wide-body instead of a narrow-body. It no longer fits a narrow stand and must move.',
    algorithms: ['Red-black interval tree', 'Maximum matching', 'Minimum cut'],
    defaults: { flight: 'VZ 760', size: 'WIDE' },
    fields: [['flight', 'flight', 'Flight'], ['size', 'size', 'New aircraft']],
    summary: (p) => p.flight + ' becomes ' + (p.size === 'WIDE' ? 'wide-body' : 'narrow-body'),
    run: (id, p) => api.swap(id, p.flight, p.size)
  },
  realTimes: {
    title: 'Replay the real day', unit: 3, icon: 'real',
    blurb: 'Every flight moves to the times it really flew on that day (from the flight data).',
    algorithms: ['Red-black interval tree', 'Maximum matching'],
    defaults: {},
    fields: [],
    summary: () => 'actual on and off block times',
    run: (id) => api.realTimes(id)
  }
}

export const PRESETS = [
  {
    name: 'Monsoon afternoon', text: 'A severe storm hits from 14:00 to 17:00 and arrivals run late.',
    explain: 'Each arrival in the storm is delayed by its airline\'s real delay at the 95th percentile. Delays longer than the safety gap clash with the next visit on the same stand (found by the interval tree), and those flights are re-placed together by maximum matching.',
    steps: [{ type: 'storm', params: { from: 840, to: 1020, severity: 95, seed: 7 } }]
  },
  {
    name: 'Fog at dawn', text: 'Air traffic control holds every arrival from 06:00 to 08:00 for 45 minutes.',
    explain: 'All arrivals in the window land 45 minutes late. Most fit inside their safety gap; the rest overlap the next visit and are moved.',
    steps: [{ type: 'fog', params: { from: 360, to: 480, minutes: 45 } }]
  },
  {
    name: 'Pier closed at the peak', text: 'The south-east pier shuts in the busiest hour while 35 extra flights arrive.',
    explain: 'A notice closes 11 stands from 09:30 to 12:00 and diverted flights arrive. Every flight on those stands must move, and the extra arrivals need stands too.',
    steps: [{ type: 'closeStands', params: { groups: ['SE-S', 'SE-N'], from: 570, to: 720 } }, { type: 'rush', params: { at: 560, count: 35, seed: 11 } }]
  },
  {
    name: 'Greedy trap', compare: true, text: 'The south-east pier closes at night. Runs both repair methods so you can see greedy strand more flights.',
    explain: 'At 01:00 the south-east pier closes for two hours, so every aircraft parked there must move. Matching considers all of them together; greedy takes them one by one. Use the switch below to see both results on the map.',
    steps: [{ type: 'closeStands', params: { groups: ['SE-S', 'SE-N'], from: 60, to: 180 } }]
  },
  {
    name: 'Perfect storm', text: 'Storm, a closed pier, diversions and a taxiway closure in one evening.',
    explain: 'Four disruptions in a row, each solved on the plan left by the one before.',
    steps: [
      { type: 'storm', params: { from: 900, to: 1080, severity: 95, seed: 7 } },
      { type: 'closeStands', params: { groups: ['NE-S', 'NE-N'], from: 960, to: 1140 } },
      { type: 'rush', params: { at: 990, count: 45, seed: 23 } },
      { type: 'closeTaxiway', params: { twy: 'W', from: 1260, to: 1410 } }
    ]
  }
]

let stepSeq = 0
export function newStep(type, params) {
  return { key: 's' + ++stepSeq + '-' + Date.now(), type, params: { ...STEP_TYPES[type].defaults, ...(params || {}) } }
}

/** Runs base plan + steps on the backend. onProgress(i) is called before step i (0 = base plan). */
export async function runScenario({ day, buffer, recovery, steps }, onProgress) {
  onProgress && onProgress(0)
  let view = await api.createPlan(day, buffer, recovery)
  const results = [{ key: 'base', type: 'base', summary: view.summary, stats: view.stats, events: view.events || [], trace: view.trace || [] }]
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    onProgress && onProgress(i + 1)
    const t0 = performance.now()
    try {
      const res = await STEP_TYPES[step.type].run(view.planId, step.params)
      const next = res && res.plan ? res.plan : res
      if (!next || !next.visits) {
        results.push({ key: step.key, type: step.type, error: (res && res.notice && res.notice.note) || 'No change' })
        continue
      }
      view = next
      const events = view.events || []
      const at = STEP_TYPES[step.type].at ? STEP_TYPES[step.type].at(step.params)
        : (events.find((e) => e.time != null) || {}).time
      results.push({
        key: step.key, type: step.type, summary: view.summary, stats: view.stats, events, trace: view.trace || [], at,
        moved: events.filter((e) => e.type === 'MOVE').length, unplacedNow: events.filter((e) => e.type === 'UNPLACED').length,
        ms: performance.now() - t0, notice: res.notice
      })
    } catch (e) {
      results.push({ key: step.key, type: step.type, error: e.message })
    }
  }
  return { view, results }
}

export function totals(results) {
  const last = [...results].reverse().find((r) => r.stats)
  let moved = 0
  let backendMs = 0
  for (const r of results) {
    moved += r.moved || 0
    for (const t of r.trace || []) backendMs += t.timeMs || 0
  }
  return {
    placed: last ? last.stats.placed : 0, unplaced: last ? last.stats.unplaced : 0, standsUsed: last ? last.stats.standsUsed : 0,
    moved, backendMs
  }
}

/**
 * Plain reason when a step changed nothing, so an empty result never looks like a bug.
 * `base` is the stats of the clean plan (stands used at the busiest moment, stands available).
 */
export function noChangeWhy(step, result, base) {
  if (!step || !result || result.error) return null
  if ((result.moved || 0) > 0 || (result.unplacedNow || 0) > 0) return null
  const p = step.params
  const spare = base ? base.standsAvailable - base.standsUsed : null
  switch (step.type) {
    case 'rush':
      return 'All ' + p.count + ' extra flights found a free stand of the right class when they landed, so no flight already on a stand had to move.'
        + (spare != null ? ' Even at its busiest moment the plan leaves ' + spare + ' of ' + base.standsAvailable + ' stands free.' : '')
        + ' Add more flights, or pick a busier time (the peaks of the purple curve on the timeline), to see moves.'
    case 'storm':
      return 'Every delayed arrival still fitted inside its safety gap (its airline\'s real delay at the chosen percentile), so no stand ever had two aircraft at once. Raise the severity, choose a busier window, or lower the safety gap to see moves.'
    case 'fog':
      return 'Holding arrivals ' + p.minutes + ' minutes still fitted inside their safety gaps, so nobody overlapped the next flight on the same stand. Try a longer hold or a busier window.'
    case 'closeStands':
      return 'No aircraft was due on the closed stands between ' + hhmm(p.from) + ' and ' + hhmm(p.to) + ', so nothing had to move. Close them at a busier time to see moves.'
    case 'closeTaxiway':
      return 'No aircraft used a stand that can only be reached through taxiway ' + p.twy + ' between ' + hhmm(p.from) + ' and ' + hhmm(p.to) + '.'
    case 'delay':
      return 'The delay fits inside the flight\'s safety gap, or no other flight was due on its stand afterwards, so it keeps its stand.'
    case 'cancel':
      return 'Cancelling frees the stand early, but no flight was waiting for a stand, so nothing else had to change.'
    case 'swap':
      return 'Its stand already takes a wide-body aircraft, so it stays where it is.'
    case 'realTimes':
      return 'The real times stayed inside the safety gaps, so every flight kept its stand.'
    default:
      return 'Nothing in the plan clashed after this step, so no flight had to move.'
  }
}
