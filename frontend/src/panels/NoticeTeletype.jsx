import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useApp } from '../state/app'
import { hhmm } from '../state/clock'

function Typed({ text, speed = 14 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(id), x) : x + 1)), speed)
    return () => clearInterval(id)
  }, [text, speed])
  return <>{text.slice(0, n)}{n < text.length && <span className="tt-cursor">▌</span>}</>
}

function Line({ notice, standSet, hits, fresh, onWithdraw }) {
  const tokens = notice.text.split(' ')
  return (
    <div className={'tt-line' + (notice.inModel ? '' : ' outside') + (hits ? ' hit' : '')}>
      <span className="tt-id">{notice.id}</span>
      <span className="tt-text">
        {fresh ? <Typed text={notice.text} /> : tokens.map((t, i) => {
          const parts = t.split(',')
          return (
            <span key={i}>
              {parts.map((p, k) => (
                <span key={k} className={standSet.has(p) && notice.standIds.includes(p) ? 'tt-stand' : ''}>{p}{k < parts.length - 1 ? ',' : ''}</span>
              ))}
              {' '}
            </span>
          )
        })}
      </span>
      <span className="tt-note">{notice.note}{notice.inModel && notice.from > 0 ? '' : ''}</span>
      {!notice.inModel && <span className="tt-stamp">OUTSIDE MODEL</span>}
      <button className="tt-x" title="Withdraw notice" onClick={() => onWithdraw(notice.id)}>×</button>
    </div>
  )
}

export default function NoticeTeletype() {
  const app = useApp()
  const [text, setText] = useState('VABB STAND ')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [find, setFind] = useState('')
  const [hits, setHits] = useState(null)
  const [fresh, setFresh] = useState(null)
  const paper = useRef(null)
  const plan = app.plan
  const standSet = useMemo(() => new Set(plan ? plan.stands.map((s) => s.id) : []), [plan])
  const notices = plan ? plan.notices : []

  useEffect(() => {
    if (paper.current) paper.current.scrollTop = paper.current.scrollHeight
  }, [notices.length, preview, error])

  async function submit(mode) {
    setError(null)
    try {
      const r = await (mode === 'apply'
        ? app.run('notice', () => api.notice(plan.planId, text, 'apply'))
        : api.notice(plan.planId, text, 'preview'))
      if (mode === 'apply') {
        setFresh(r.notice.id)
        setPreview(null)
        setText('VABB STAND ')
        app.setMachineTab('suffix')
      } else {
        setPreview(r)
      }
    } catch (e) {
      setPreview(null)
      setError(e.message)
    }
  }

  async function search(e) {
    e.preventDefault()
    if (!find.trim()) {
      setHits(null)
      return
    }
    try {
      const r = await api.searchNotices(plan.planId, find)
      setHits(new Set(r.hits.map((h) => h.noticeId)))
      app.setSearchResult({ pattern: r.query, path: r.path, hits: r.hits.length, textLength: r.textLength, nodes: r.treeNodes,
        suffixTreeMs: r.suffixTreeMs, kmpMs: r.kmpMs })
      app.setMachineTab('suffix')
    } catch (ex) {
      setError(ex.message)
    }
  }

  async function withdraw(nid) {
    await app.run('notice', () => api.withdrawNotice(plan.planId, nid)).catch(() => {})
  }

  return (
    <div className="panel teletype">
      <div className="panel-head">
        <div className="panel-title"><span className="pict">N</span>Notice teletype</div>
        <div className="spacer" />
        <form onSubmit={search} className="tt-find">
          <input className="input" placeholder="Find (suffix tree)" value={find} onChange={(e) => setFind(e.target.value)} />
        </form>
      </div>
      <div className="tt-paper" ref={paper}>
        <div className="tt-header mono">VABB MUMBAI · ACTIVE NOTICES · {notices.length} ON FILE</div>
        {notices.map((n) => (
          <Line key={n.id} notice={n} standSet={standSet} hits={hits && hits.has(n.id)} fresh={fresh === n.id} onWithdraw={withdraw} />
        ))}
        {preview && (
          <div className="tt-preview">
            <div className="tt-ok">VALID · {preview.notice.note}</div>
            {preview.affected.length > 0 ? (
              <div className="tt-aff">
                {preview.affected.length} visits would move:{' '}
                {preview.affected.slice(0, 8).map((a) => a.label + ' (' + a.stand + ' ' + a.start + ')').join(', ')}
                {preview.affected.length > 8 ? ' ...' : ''}
              </div>
            ) : <div className="tt-aff">No visit is on these stands in that window.</div>}
          </div>
        )}
        {error && <div className="tt-reject"><span className="stamp">REJECTED</span>{error}</div>}
      </div>
      <form className="tt-input" onSubmit={(e) => { e.preventDefault(); submit('preview') }}>
        <span className="tt-prompt mono">&gt;</span>
        <input className="mono" value={text} onChange={(e) => { setText(e.target.value.toUpperCase()); setPreview(null); setError(null) }}
          placeholder="VABB STAND 42A CLSD 1400-1800" spellCheck="false" />
        <button type="submit" className="btn small" disabled={!plan || app.busy}>Preview</button>
        <button type="button" className="btn small primary" disabled={!plan || app.busy} onClick={() => submit('apply')}>Apply</button>
      </form>
    </div>
  )
}

export { hhmm }
