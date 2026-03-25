import { useSynthesisState, type SkillMapEntry, type ActiveCorrection, type ToolAdoption, type PaperInsight } from '../hooks/useSynthesisState'
import './PlayPage.css'

function timeAgo(iso: string): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function CycleRing({ current, target }: { current: number; target: number }) {
  const pct = Math.min(current / target, 1)
  const r = 90
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  return (
    <div className="ka-synth-cycle">
      <svg viewBox="0 0 200 200" className="ka-synth-cycle-svg">
        <circle cx="100" cy="100" r={r} className="ka-synth-cycle-bg" />
        <circle
          cx="100" cy="100" r={r}
          className="ka-synth-cycle-fill"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ka-synth-cycle-text">
        <span className="ka-synth-cycle-num">{current.toLocaleString()}</span>
        <span className="ka-synth-cycle-label">/ {target.toLocaleString()} cycles</span>
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: SkillMapEntry }) {
  const barWidth = Math.min((agent.overall.mu / 50) * 100, 100)
  const cats = Object.entries(agent.categories)
    .sort((a, b) => b[1].mu - a[1].mu)
    .slice(0, 3)

  return (
    <div className={`ka-synth-agent ka-synth-agent--${agent.status}`}>
      <div className="ka-synth-agent-header">
        <span className="ka-synth-agent-name">{agent.agent}</span>
        <span className={`ka-synth-agent-badge ka-synth-agent-badge--${agent.status}`}>
          {agent.status === 'proven' ? '\u2605' : agent.status === 'developing' ? '\u25C6' : '\u25CB'} {agent.status}
        </span>
      </div>
      <div className="ka-synth-agent-bar-track">
        <div className="ka-synth-agent-bar-fill" style={{ width: `${barWidth}%` }} />
        <span className="ka-synth-agent-mu">{agent.overall.mu.toFixed(1)}</span>
      </div>
      <div className="ka-synth-agent-sigma">&sigma; {agent.overall.sigma.toFixed(1)} &middot; {agent.overall.confidence}</div>
      {cats.length > 0 && (
        <div className="ka-synth-agent-cats">
          {cats.map(([cat, r]) => (
            <span key={cat} className="ka-synth-agent-cat">{cat}: {r.mu.toFixed(1)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function CorrectionCard({ c }: { c: ActiveCorrection }) {
  return (
    <div className={`ka-synth-correction ka-synth-correction--${c.severity}`}>
      <div className="ka-synth-correction-header">
        <span className="ka-synth-correction-severity">{c.severity === 'high' ? '!!' : c.severity === 'medium' ? '!' : '-'}</span>
        <span className="ka-synth-correction-source">{c.source}</span>
        <span className="ka-synth-correction-count">{c.occurrences}x</span>
      </div>
      <p className="ka-synth-correction-rule">{c.rule}</p>
    </div>
  )
}

function ToolCard({ t }: { t: ToolAdoption }) {
  return (
    <div className={`ka-synth-tool ka-synth-tool--${t.status}`}>
      <div className="ka-synth-tool-header">
        <a href={t.url} target="_blank" rel="noopener noreferrer" className="ka-synth-tool-name">{t.name}</a>
        <span className="ka-synth-tool-stars">{t.stars.toLocaleString()} &#9733;</span>
      </div>
      <span className={`ka-synth-tool-badge ka-synth-tool-badge--${t.status}`}>{t.status}</span>
      <p className="ka-synth-tool-reason">{t.reason}</p>
    </div>
  )
}

function PaperCard({ p }: { p: PaperInsight }) {
  return (
    <div className={`ka-synth-paper ka-synth-paper--${p.status}`}>
      <div className="ka-synth-paper-technique">{p.technique}</div>
      <div className="ka-synth-paper-title">{p.title}</div>
      <div className="ka-synth-paper-applies">Applies to: {p.applicableTo}</div>
      <span className={`ka-synth-paper-badge ka-synth-paper-badge--${p.status}`}>{p.status}</span>
    </div>
  )
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="ka-synth-stat">
      <div className="ka-synth-stat-header">
        <span className="ka-synth-stat-label">{label}</span>
        <span className="ka-synth-stat-value">{value.toLocaleString()}</span>
      </div>
      <div className="ka-synth-stat-track">
        <div className="ka-synth-stat-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function PlayPage() {
  const { data, loading } = useSynthesisState(30_000)

  if (loading || !data) {
    return (
      <div className="ka-synth ka-synth--loading">
        <div className="ka-synth-loading-ring" />
        <p className="ka-synth-loading-text">Waiting for synthesis data...</p>
        <p className="ka-synth-loading-sub">The daemon pushes every 15 minutes</p>
      </div>
    )
  }

  const proven = data.skillMap.filter(a => a.status === 'proven').length
  const developing = data.skillMap.filter(a => a.status === 'developing').length
  const untested = data.skillMap.filter(a => a.status === 'untested').length
  const ls = data.learningSummary

  return (
    <div className="ka-synth">
      {/* Scan line effect */}
      <div className="ka-synth-scanline" />

      {/* Header */}
      <header className="ka-synth-header">
        <button className="ka-synth-back" onClick={() => { window.location.hash = '#/' }}>
          &larr; kernel.chat
        </button>
        <div className="ka-synth-header-text">
          <h1 className="ka-synth-title">SYNTHESIS</h1>
          <p className="ka-synth-subtitle">kbot's closed-loop intelligence compounding</p>
        </div>
        <div className="ka-synth-pulse">
          <div className="ka-synth-pulse-dot" />
          <span>{timeAgo(data.lastCycleAt)}</span>
        </div>
      </header>

      {/* Cycle Progress */}
      <section className="ka-synth-section">
        <CycleRing current={data.totalCycles} target={1000} />
      </section>

      {/* Vitals Row */}
      <section className="ka-synth-vitals">
        <div className="ka-synth-vital">
          <span className="ka-synth-vital-num">{data.discoveryState.knownStars ?? '?'}</span>
          <span className="ka-synth-vital-label">GitHub Stars</span>
        </div>
        <div className="ka-synth-vital">
          <span className="ka-synth-vital-num">{data.discoveryState.knownDownloads?.toLocaleString() ?? '?'}</span>
          <span className="ka-synth-vital-label">npm Downloads</span>
        </div>
        <div className="ka-synth-vital">
          <span className="ka-synth-vital-num">{ls.sessions ?? 0}</span>
          <span className="ka-synth-vital-label">Sessions</span>
        </div>
        <div className="ka-synth-vital">
          <span className="ka-synth-vital-num">{ls.observer_total ?? 0}</span>
          <span className="ka-synth-vital-label">Tool Calls Observed</span>
        </div>
      </section>

      {/* Active Corrections */}
      {data.activeCorrections.length > 0 && (
        <section className="ka-synth-section">
          <h2 className="ka-synth-section-title">Active Corrections</h2>
          <p className="ka-synth-section-desc">Injected into every kbot prompt — learned from failures</p>
          <div className="ka-synth-corrections-grid">
            {data.activeCorrections.map((c, i) => <CorrectionCard key={i} c={c} />)}
          </div>
        </section>
      )}

      {/* Skill Map */}
      <section className="ka-synth-section">
        <h2 className="ka-synth-section-title">Agent Skill Map</h2>
        <p className="ka-synth-section-desc">
          Bayesian ratings (Bradley-Terry) &middot;
          <span className="ka-synth-proven-dot" /> {proven} proven &middot;
          <span className="ka-synth-developing-dot" /> {developing} developing &middot;
          <span className="ka-synth-untested-dot" /> {untested} untested
        </p>
        <div className="ka-synth-skillmap">
          {data.skillMap.map(a => <AgentCard key={a.agent} agent={a} />)}
        </div>
      </section>

      {/* Tool Evaluations */}
      {data.toolAdoptions.length > 0 && (
        <section className="ka-synth-section">
          <h2 className="ka-synth-section-title">Discovered Tools</h2>
          <p className="ka-synth-section-desc">
            Evaluated against failure patterns &middot;
            {data.stats.toolsAdopted ?? 0} adopted, {data.stats.toolsRejected ?? 0} rejected
          </p>
          <div className="ka-synth-tools-grid">
            {data.toolAdoptions.map((t, i) => <ToolCard key={i} t={t} />)}
          </div>
        </section>
      )}

      {/* Paper Insights */}
      {data.paperInsights.length > 0 && (
        <section className="ka-synth-section">
          <h2 className="ka-synth-section-title">Paper Insights</h2>
          <p className="ka-synth-section-desc">Academic techniques matched to kbot patterns</p>
          <div className="ka-synth-papers-grid">
            {data.paperInsights.map((p, i) => <PaperCard key={i} p={p} />)}
          </div>
        </section>
      )}

      {/* Learning Stores */}
      <section className="ka-synth-section">
        <h2 className="ka-synth-section-title">Learning Stores</h2>
        <p className="ka-synth-section-desc">What kbot knows — accumulated across {ls.sessions ?? 0} sessions</p>
        <div className="ka-synth-stores">
          <StatBar label="Patterns" value={ls.patterns_count ?? 0} max={200} />
          <StatBar label="Solutions" value={ls.solutions_count ?? 0} max={200} />
          <StatBar label="Reflections" value={ls.reflections_count ?? 0} max={100} />
          <StatBar label="Routing Entries" value={ls.routing_entries ?? 0} max={500} />
          <StatBar label="Messages" value={ls.total_messages ?? 0} max={1000} />
        </div>
      </section>

      {/* Footer */}
      <footer className="ka-synth-footer">
        <p>This page updates every 30 seconds. The daemon pushes every 15 minutes.</p>
        <p>All analysis runs on local models (Ollama/MLX). Zero API cost.</p>
      </footer>
    </div>
  )
}
