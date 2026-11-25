import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { useClockMinute } from '../state/clock'
import SplitFlap from './SplitFlap'

const ROWS = 9

export default function DeparturesBoard() {
  const app = useApp()
  const minute = useClockMinute(2)
  const [type, setType] = useState('DEP')
  const [rows, setRows] = useState([])
  const last = useRef(0)
  const planId = app.plan && app.plan.planId

  useEffect(() => {
    if (!planId) return undefined
    const now = performance.now()
    const wait = Math.max(0, 900 - (now - last.current))
    const t = setTimeout(() => {
      last.current = performance.now()
      api.board(planId, minute, type, ROWS).then((r) => setRows(r.rows)).catch(() => {})
    }, wait)
    return () => clearTimeout(t)
  }, [planId, minute, type, app.boardTick])

  const blank = Array.from({ length: Math.max(0, ROWS - rows.length) })
  return (
    <div className="panel board">
      <div className="board-head">
        <div className="board-title">
          <span className="board-pict">{type === 'DEP' ? '↗' : '↘'}</span>
          {type === 'DEP' ? 'DEPARTURES' : 'ARRIVALS'}
          <span className="board-hindi">{type === 'DEP' ? 'प्रस्थान' : 'आगमन'}</span>
        </div>
        <div className="board-toggle">
          <button className={type === 'DEP' ? 'on' : ''} onClick={() => setType('DEP')}>DEP</button>
          <button className={type === 'ARR' ? 'on' : ''} onClick={() => setType('ARR')}>ARR</button>
        </div>
      </div>
      <div className="board-cols">
        <span>TIME</span><span>FLIGHT</span><span>{type === 'DEP' ? 'DESTINATION' : 'FROM'}</span><span>STAND</span><span>REMARKS</span>
      </div>
      <div className="board-rows">
        {rows.map((r, i) => {
          const remark = r.status === 'DELAYED' ? 'EXP ' + r.expected
            : r.status === 'GATE CHANGE' ? 'GATE ' + (r.previousGate || '') + '>' + r.gate : r.status
          return (
            <div key={i} className={'brow s-' + r.status.replace(' ', '-').toLowerCase()} onClick={() => app.select(r.visit)}>
              <SplitFlap text={r.scheduled} width={5} sound={app.sound} />
              <SplitFlap text={r.flight.replace(' ', '')} width={7} sound={app.sound} />
              <SplitFlap text={r.city} width={13} sound={app.sound} />
              <SplitFlap text={r.gate || '--'} width={4} sound={app.sound} className="gate" />
              <SplitFlap text={remark} width={14} sound={app.sound} className="remark" />
            </div>
          )
        })}
        {blank.map((_, i) => (
          <div key={'b' + i} className="brow empty">
            <SplitFlap text="" width={5} /><SplitFlap text="" width={7} /><SplitFlap text="" width={13} />
            <SplitFlap text="" width={4} /><SplitFlap text="" width={14} />
          </div>
        ))}
      </div>
    </div>
  )
}
