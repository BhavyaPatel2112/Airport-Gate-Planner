import { useSyncExternalStore } from 'react'

// Camera heading and distance for the compass, kept outside React state so the app does not
// re-render while the camera moves.
let state = { azimuth: 0, distance: 2000 }
const listeners = new Set()

export const camStore = {
  set(next) {
    state = next
    for (const fn of listeners) fn()
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}

export function useCam() {
  return useSyncExternalStore(camStore.subscribe, () => state)
}
