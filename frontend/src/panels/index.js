// Placeholder panels so the app can import them before the real panels are ready.
import { createElement as h } from 'react'

function placeholder(title) {
  return function Placeholder() {
    return h('div', { className: 'panel' },
      h('div', { className: 'panel-head' }, h('div', { className: 'panel-title' }, title)),
      h('div', { className: 'empty-note' }, 'Coming soon'))
  }
}

export const DeparturesBoard = placeholder('Departures')
export const RadarScope = placeholder('Stand availability radar')
export const ChaosDesk = placeholder('Monsoon and chaos desk')
export const NoticeTeletype = placeholder('Notice teletype')
export const DelayLeaderboard = () => h('div', { className: 'empty-note' }, 'Coming soon')
export const BenchmarkLab = () => h('div', { className: 'empty-note' }, 'Coming soon')
export const Announcements = () => null
