import { useApp } from '../state/app'
import RedBlackTreeView from './RedBlackTreeView'
import MatchingView from './MatchingView'
import FibonacciHeapView from './FibonacciHeapView'
import SuffixTreeView from './SuffixTreeView'
import './machine.css'

const TABS = [
  ['rbtree', 'RB tree', 3],
  ['matching', 'Matching', 5],
  ['fibheap', 'Fib heap', 2],
  ['suffix', 'Suffix', 4]
]

export default function MachineView() {
  const app = useApp()
  const tab = app.machineTab
  return (
    <div className="panel machine">
      <div className="panel-head">
        <div className="panel-title"><span className="pict">M</span>Machine</div>
        <div className="spacer" />
        <div className="m-tabs">
          {TABS.map(([k, label, u]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => app.setMachineTab(k)}>
              <span className={'dot u' + u} />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body m-body">
        {tab === 'rbtree' && <RedBlackTreeView />}
        {tab === 'matching' && <MatchingView />}
        {tab === 'fibheap' && <FibonacciHeapView />}
        {tab === 'suffix' && <SuffixTreeView />}
      </div>
    </div>
  )
}
