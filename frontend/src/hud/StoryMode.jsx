import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { clock, useClockMinute } from '../state/clock'

// "Play the day": a scripted run with captions. Every action is a normal backend call.
const SCRIPT = [
  { at: 340, cam: 'overview', caption: 'Mumbai, Monday 16 November 2026. Every real flight already has a stand, on the fewest stands possible: the busiest moment equals the stands used.' },
  { at: 368, cam: 'runway', caption: '6 am rush: 30 extra arrivals appear. Matching finds each one a free compatible stand; the X-ray shows every step.',
    run: (app, id) => app.run('rush', () => api.rush(id, 30, 11, 370)) },
  { at: 470, cam: 't2', caption: 'Click any aircraft for its boarding pass and the reason it is on that stand.' },
  { at: 828, cam: 'overview', caption: '2 pm monsoon: arrivals slip by each airline\'s real 95th percentile delay (randomized Quickselect). Interval trees find the clashes.',
    run: (app, id) => { app.setStorm({ severity: 95, from: 830, to: 1010 }); return app.run('storm', () => api.storm(id, 95, 7, 830, 1010)) } },
  { at: 955, cam: '65A', caption: '4 pm notice: four international stands close. The suffix tree finds every mention; affected flights move to free stands.',
    run: (app, id) => app.run('notice', () => api.notice(id, 'VABB STANDS 65A,65B,67A,67B CLSD 1600-1900 DUE WIP', 'apply')) },
  { at: 1255, cam: 'west', caption: '9 pm overload: taxiway W closes and cuts off 31 stands. Some flights cannot fit, and the minimum cut proves exactly why.',
    run: (app, id) => app.run('notice', () => api.notice(id, 'VABB TWY W CLSD 2100-2330 DUE AIRCRAFT ON GROUND', 'apply')) },
  { at: 1380, cam: 'overview', caption: 'That was the day. Every decision came from Java; the browser only drew it.', end: true }
]

export default function StoryMode() {
  const app = useApp()
  const minute = useClockMinute()
  const done = useRef(new Set())
  const starting = useRef(false)

  useEffect(() => {
    if (!app.story) {
      done.current = new Set()
      app.setCaption(null)
      return
    }
    starting.current = true
    app.setDay(1)
    clock.set({ minute: 330, speed: 300, playing: false })
    const t = setTimeout(() => {
      starting.current = false
      clock.set({ playing: true })
    }, 1200)
    return () => clearTimeout(t)
  }, [app.story]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!app.story || starting.current || !app.plan) return
    for (const step of SCRIPT) {
      if (minute >= step.at && !done.current.has(step.at)) {
        done.current.add(step.at)
        app.setCaption(step.caption)
        if (step.cam) app.flyTo(step.cam)
        if (step.run) {
          clock.set({ playing: false })
          Promise.resolve(step.run(app, app.plan.planId)).catch(() => {}).finally(() => {
            setTimeout(() => app.story && clock.set({ playing: true }), 1800)
          })
        }
        if (step.end) {
          setTimeout(() => { app.setStory(false); clock.set({ playing: false }) }, 6000)
        }
        break
      }
    }
  }, [minute, app.story, app.plan]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
