import { useSyncExternalStore } from 'react'

// Replay clock. Minutes after local midnight of the chosen day; runs on requestAnimationFrame.
const listeners = new Set()
let state = { minute: 330, playing: false, speed: 60 }
let last = 0
let rafId = 0

export const DAY_END = 1440

function emit() {
  for (const fn of listeners) fn()
}

function tick(t) {
  if (!last) last = t
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  if (state.playing) {
    let m = state.minute + (dt * state.speed) / 60
    if (m >= DAY_END) {
      m = DAY_END
      state = { ...state, minute: m, playing: false }
    } else {
      state = { ...state, minute: m }
    }
    emit()
  }
  rafId = requestAnimationFrame(tick)
}

export const clock = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch }
    if (patch.minute !== undefined) state.minute = Math.max(0, Math.min(DAY_END, patch.minute))
    emit()
  },
  subscribe(fn) {
    listeners.add(fn)
    if (!rafId) rafId = requestAnimationFrame(tick)
    return () => listeners.delete(fn)
  }
}

/** Every frame: the exact clock minute (fractional). */
export function useClockValue() {
  return useSyncExternalStore(clock.subscribe, () => state.minute)
}

/** Re-renders only when the whole minute changes. */
export function useClockMinute(step = 1) {
  return useSyncExternalStore(clock.subscribe, () => Math.floor(state.minute / step) * step)
}

export function useClockState() {
  const playing = useSyncExternalStore(clock.subscribe, () => state.playing)
  const speed = useSyncExternalStore(clock.subscribe, () => state.speed)
  return { playing, speed }
}

export function hhmm(minute) {
  const m = Math.floor(minute)
  const d = Math.floor(m / 1440)
  const r = ((m % 1440) + 1440) % 1440
  const s = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0')
  return d > 0 ? s + ' +1' : s
}
