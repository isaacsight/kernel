import { useMemo, useState } from 'react'
import { PALMIER_CATEGORIES, PALMIER_SUITE, type PalmierToolDefinition, type PalmierToolStatus } from '../data/palmierSuite'
import './PalmierSuitePage.css'

const statusCopy: Record<PalmierToolStatus, string> = {
  ready: 'Runs now',
  partial: 'MCP + native work',
  'native-required': 'Native engine required',
}

function ToolRow({ tool, active, onSelect }: { tool: PalmierToolDefinition; active: boolean; onSelect: () => void }) {
  return (
    <button className={`ps-tool-row ${active ? 'is-active' : ''}`} onClick={onSelect} aria-pressed={active}>
      <span className="ps-tool-index">{String(PALMIER_SUITE.indexOf(tool) + 1).padStart(2, '0')}</span>
      <span className="ps-tool-main">
        <strong>{tool.name}</strong>
        <span>{tool.outcome}</span>
      </span>
      <span className={`ps-status ps-status-${tool.status}`}>{statusCopy[tool.status]}</span>
    </button>
  )
}

export function PalmierSuitePage() {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('director')
  const [receipt, setReceipt] = useState('')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PALMIER_SUITE.filter(tool => (category === 'All' || tool.category === category)
      && (!needle || `${tool.name} ${tool.outcome} ${tool.category}`.toLowerCase().includes(needle)))
  }, [category, query])

  const selected = PALMIER_SUITE.find(tool => tool.id === selectedId) ?? visible[0] ?? PALMIER_SUITE[0]
  const counts = PALMIER_SUITE.reduce((acc, tool) => ({ ...acc, [tool.status]: acc[tool.status] + 1 }), { ready: 0, partial: 0, 'native-required': 0 })

  const prepareTool = async () => {
    const command = selected.status === 'native-required'
      ? 'node tools/palmier/suite.mjs adapters'
      : `npm run video:palmier:suite -- plan ${selected.id}`
    try { await navigator.clipboard.writeText(command) } catch { /* Clipboard may be unavailable in local previews. */ }
    setReceipt(selected.status === 'native-required'
      ? `Build contract ready: ${selected.blockers?.length ?? 0} native capabilities identified. Command copied.`
      : `Workflow ready: ${selected.operations.length} operations identified. Planning command copied.`)
  }

  return (
    <main className="ps-shell">
      <header className="ps-header">
        <a className="ps-brand" href="/">PALMIER <span>PRO</span></a>
        <div className="ps-header-meta"><span>Production system</span><span>32 tools</span><span>18 engine adapters</span></div>
      </header>

      <section className="ps-hero">
        <div>
          <p className="ps-eyebrow">THE PROGRAMMABLE EDITING ROOM</p>
          <h1>One project.<br />Every version.</h1>
        </div>
        <p className="ps-hero-copy">Plan, generate, edit, verify, and deliver with humans and agents working on the same traceable timeline.</p>
      </section>

      <section className="ps-metrics" aria-label="Suite readiness">
        <div><strong>{counts.ready}</strong><span>RUN NOW</span></div>
        <div><strong>{counts.partial}</strong><span>PARTIAL</span></div>
        <div><strong>{counts['native-required']}</strong><span>NATIVE BUILD</span></div>
        <div><strong>66</strong><span>VALIDATED OPERATIONS</span></div>
      </section>

      <section className="ps-workspace">
        <aside className="ps-directory">
          <label className="ps-search">
            <span>Find a tool</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the suite" />
          </label>
          <nav className="ps-filters" aria-label="Tool categories">
            {['All', ...PALMIER_CATEGORIES].map(item => (
              <button key={item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </nav>
          <p className="ps-results">{visible.length} tools</p>
        </aside>

        <div className="ps-tool-list">
          {visible.map(tool => <ToolRow key={tool.id} tool={tool} active={selected.id === tool.id} onSelect={() => setSelectedId(tool.id)} />)}
          {!visible.length && <p className="ps-empty">No tools match this search.</p>}
        </div>

        <aside className="ps-inspector" aria-live="polite">
          <div className="ps-inspector-top">
            <span className="ps-kicker">{selected.category}</span>
            <span className={`ps-status ps-status-${selected.status}`}>{statusCopy[selected.status]}</span>
          </div>
          <h2>{selected.name}</h2>
          <p className="ps-inspector-outcome">{selected.outcome}</p>

          <section>
            <h3>Inputs</h3>
            <ul>{selected.inputs.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h3>Operations</h3>
            <ul>{selected.operations.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          {selected.blockers && (
            <section className="ps-blockers">
              <h3>Native engine work</h3>
              <ul>{selected.blockers.map(item => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
          {selected.approval && <p className="ps-approval">Explicit {selected.approval} approval required.</p>}
          {receipt && <p className="ps-receipt">{receipt}</p>}
          <button className="ps-primary" onClick={prepareTool}>
            {selected.status === 'ready' ? 'Prepare workflow' : selected.status === 'partial' ? 'Open available workflow' : 'View build contract'}
          </button>
        </aside>
      </section>
    </main>
  )
}
