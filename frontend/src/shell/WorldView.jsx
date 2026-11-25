import { useEffect, useRef } from 'react'
import { useApp } from '../state/app'
import { useClockMinute } from '../state/clock'
import Weather from '../scene/Weather'
import { AirportWorld } from '../world/AirportWorld'

/** Full-screen 3D airport. All overlays live in the shell around it. */
export default function WorldView() {
  const app = useApp()
  const host = useRef(null)
  const world = useRef(null)

  useEffect(() => {
    const w = new AirportWorld(host.current, {
      onSelect: (id) => app.worldClick(id),
      onCamera: (c) => app.setCam(c),
      quality: app.quality
    })
    w.onQuality = (q) => app.setQuality(q, true)
    world.current = w
    app.registerWorld(w)
    const intro = app.introPending
    app.consumeIntro()
    w.flyTo(intro ? 'intro' : 'tower', 10)
    // start the opening flight only once the first frames are on screen, then lift the curtain
    w.onReady = () => {
      if (intro) w.playIntro()
      app.worldReady()
    }
    return () => {
      app.registerWorld(null)
      w.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!world.current) return
    world.current.setData({
      visits: app.plan ? app.plan.visits : [],
      closures: app.plan ? app.plan.closures : [],
      selected: app.selected,
      follow: app.follow,
      effects: app.effects,
      storm: app.storm,
      layers: app.layers
    })
  }, [app.plan, app.selected, app.follow, app.effects, app.storm, app.layers])

  useEffect(() => {
    if (world.current && world.current.quality !== app.quality) world.current.setQuality(app.quality)
  }, [app.quality])

  useEffect(() => {
    if (world.current) world.current.setInsets(app.rightOpen ? 400 + 28 : 0)
  }, [app.rightOpen])

  const minute = useClockMinute()
  const storm = app.storm && minute >= app.storm.from - 20 && minute <= app.storm.to + 20 ? app.storm : null
  return (
    <div className={'world' + (storm ? ' storm' : '')}>
      <div className="world-gl" ref={host} />
      <Weather active={!!storm} severity={storm ? storm.severity : 50} reducedMotion={app.reducedMotion} />
      <div className="world-vignette" />
    </div>
  )
}
