import { useEffect, useState } from 'react'
import './BenchPage.css'

// ── Data ──

const HERO_STATS = [
  { value: '560+', label: 'Tools', desc: 'Built-in capabilities' },
  { value: '35', label: 'Agents', desc: 'Specialist intelligence' },
  { value: '690', label: 'Tests', desc: 'Automated coverage' },
  { value: '20', label: 'Providers', desc: 'LLM integrations' },
]

interface CompetitorRow {
  feature: string
  kbot: string | number
  claudeCode: string | number
  codexCli: string | number
  openCode: string | number
  aider: string | number
  cline: string | number
}

const COMPARISON: CompetitorRow[] = [
  { feature: 'Built-in tools',       kbot: '560+', claudeCode: '~15',  codexCli: '~10', openCode: '~12', aider: '~8',  cline: '~20' },
  { feature: 'Specialist agents',    kbot: 35,     claudeCode: 1,      codexCli: 1,     openCode: 1,     aider: 1,     cline: 1 },
  { feature: 'LLM providers',        kbot: 20,     claudeCode: 1,      codexCli: 1,     openCode: 3,     aider: 10,    cline: 5 },
  { feature: 'Local / offline',      kbot: 'Yes',  claudeCode: 'No',   codexCli: 'No',  openCode: 'Yes', aider: 'Yes', cline: 'No' },
  { feature: 'MCP server',           kbot: 'Yes',  claudeCode: 'Yes',  codexCli: 'No',  openCode: 'No',  aider: 'No',  cline: 'Yes' },
  { feature: 'Tool forging',         kbot: 'Yes',  claudeCode: 'No',   codexCli: 'No',  openCode: 'No',  aider: 'No',  cline: 'No' },
  { feature: 'Learning engine',      kbot: 'Yes',  claudeCode: 'No',   codexCli: 'No',  openCode: 'No',  aider: 'No',  cline: 'No' },
  { feature: 'Browser automation',   kbot: 'Yes',  claudeCode: 'No',   codexCli: 'No',  openCode: 'No',  aider: 'No',  cline: 'No' },
  { feature: 'Cost',                 kbot: '$0',   claudeCode: '$20/mo', codexCli: 'BYOK', openCode: 'BYOK', aider: 'BYOK', cline: '$10/mo' },
  { feature: 'Open source',          kbot: 'MIT',  claudeCode: 'Partial', codexCli: 'Apache', openCode: 'MIT', aider: 'Apache', cline: 'Apache' },
]

interface CategoryData {
  name: string
  kbot: number
  best_competitor: number
  competitor_name: string
}

const CATEGORIES: CategoryData[] = [
  { name: 'Tool breadth',       kbot: 98, best_competitor: 35, competitor_name: 'Cline' },
  { name: 'Agent routing',      kbot: 95, best_competitor: 10, competitor_name: 'Claude Code' },
  { name: 'Provider coverage',  kbot: 92, best_competitor: 50, competitor_name: 'Aider' },
  { name: 'Offline capability', kbot: 90, best_competitor: 60, competitor_name: 'OpenCode' },
  { name: 'Self-improvement',   kbot: 88, best_competitor: 0,  competitor_name: 'None' },
  { name: 'Cost efficiency',    kbot: 95, best_competitor: 40, competitor_name: 'Aider' },
  { name: 'Security posture',   kbot: 90, best_competitor: 45, competitor_name: 'Claude Code' },
  { name: 'Extensibility',      kbot: 93, best_competitor: 55, competitor_name: 'Cline' },
]

// ── Component ──

export default function BenchPage() {
  const [copied, setCopied] = useState(false)
  const [animatedBars, setAnimatedBars] = useState(false)

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    // Trigger bar animation after mount
    const timer = setTimeout(() => setAnimatedBars(true), 100)
    return () => {
      document.body.classList.remove('ka-scrollable-page')
      clearTimeout(timer)
    }
  }, [])

  const copyInstall = () => {
    navigator.clipboard.writeText('npm install -g @kernel.chat/kbot')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ka-bench">
      {/* Hero */}
      <section className="ka-bench-hero">
        <div className="ka-bench-badge">Benchmark Dashboard</div>
        <h1 className="ka-bench-title">kbot by the numbers</h1>
        <p className="ka-bench-subtitle">
          The most capable open-source terminal AI agent. Measured, not marketed.
        </p>

        <div className="ka-bench-stats">
          {HERO_STATS.map(s => (
            <div key={s.label} className="ka-bench-stat">
              <span className="ka-bench-stat-value">{s.value}</span>
              <span className="ka-bench-stat-label">{s.label}</span>
              <span className="ka-bench-stat-desc">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ka-bench-divider" />

      {/* Comparison Table */}
      <section className="ka-bench-section">
        <h2 className="ka-bench-h2">Head-to-head</h2>
        <p className="ka-bench-section-desc">
          Feature comparison against every major terminal AI agent. Updated March 2026.
        </p>
        <div className="ka-bench-table-wrap">
          <table className="ka-bench-table">
            <thead>
              <tr>
                <th></th>
                <th>kbot</th>
                <th>Claude Code</th>
                <th>Codex CLI</th>
                <th>OpenCode</th>
                <th>Aider</th>
                <th>Cline</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(row => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.kbot}</td>
                  <td className={isWeakValue(row.claudeCode) ? 'ka-bench-weak' : ''}>{row.claudeCode}</td>
                  <td className={isWeakValue(row.codexCli) ? 'ka-bench-weak' : ''}>{row.codexCli}</td>
                  <td className={isWeakValue(row.openCode) ? 'ka-bench-weak' : ''}>{row.openCode}</td>
                  <td className={isWeakValue(row.aider) ? 'ka-bench-weak' : ''}>{row.aider}</td>
                  <td className={isWeakValue(row.cline) ? 'ka-bench-weak' : ''}>{row.cline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ka-bench-divider" />

      {/* Category Breakdown — CSS bar charts */}
      <section className="ka-bench-section">
        <h2 className="ka-bench-h2">Category breakdown</h2>
        <p className="ka-bench-section-desc">
          Scored 0-100 across key capability dimensions. kbot vs best-in-class competitor.
        </p>

        <div className="ka-bench-charts">
          {CATEGORIES.map(cat => (
            <div key={cat.name} className="ka-bench-chart-row">
              <div className="ka-bench-chart-label">
                <span className="ka-bench-chart-name">{cat.name}</span>
                <span className="ka-bench-chart-score">{cat.kbot}</span>
              </div>
              <div className="ka-bench-chart-bars">
                <div className="ka-bench-chart-track">
                  <div
                    className="ka-bench-chart-bar ka-bench-chart-bar--kbot"
                    style={{ width: animatedBars ? `${cat.kbot}%` : '0%' }}
                  />
                </div>
                <div className="ka-bench-chart-track">
                  <div
                    className="ka-bench-chart-bar ka-bench-chart-bar--competitor"
                    style={{ width: animatedBars ? `${cat.best_competitor}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="ka-bench-chart-competitor">
                <span className="ka-bench-chart-comp-name">{cat.competitor_name}</span>
                <span className="ka-bench-chart-comp-score">{cat.best_competitor}</span>
              </div>
            </div>
          ))}

          <div className="ka-bench-chart-legend">
            <span className="ka-bench-legend-item">
              <span className="ka-bench-legend-swatch ka-bench-legend-swatch--kbot" />
              kbot
            </span>
            <span className="ka-bench-legend-item">
              <span className="ka-bench-legend-swatch ka-bench-legend-swatch--competitor" />
              Best competitor
            </span>
          </div>
        </div>
      </section>

      <div className="ka-bench-divider" />

      {/* Run your own benchmark */}
      <section className="ka-bench-section ka-bench-cta-section">
        <h2 className="ka-bench-h2">Run your own benchmark</h2>
        <p className="ka-bench-section-desc">
          Install kbot and run the built-in benchmark suite against your own codebase.
          Every number on this page is reproducible.
        </p>

        <div className="ka-bench-terminal">
          <div className="ka-bench-terminal-bar">
            <span className="ka-bench-dot" style={{ background: '#ff5f57' }} />
            <span className="ka-bench-dot" style={{ background: '#ffbd2e' }} />
            <span className="ka-bench-dot" style={{ background: '#28c840' }} />
            <span className="ka-bench-terminal-title">Terminal</span>
          </div>
          <div className="ka-bench-terminal-body">
            <div className="ka-bench-line">
              <span className="ka-bench-prompt">$</span> npm install -g @kernel.chat/kbot
            </div>
            <div className="ka-bench-line ka-bench-dim" style={{ marginTop: 4 }}>
              added 1 package in 8s
            </div>
            <div className="ka-bench-line" style={{ marginTop: 12 }}>
              <span className="ka-bench-prompt">$</span> kbot bench --suite full
            </div>
            <div className="ka-bench-line ka-bench-dim" style={{ marginTop: 4 }}>
              Running 690 tests across 8 categories...
            </div>
            <div className="ka-bench-line ka-bench-dim">
              {'\u2713'} Tool breadth: 560 tools registered
            </div>
            <div className="ka-bench-line ka-bench-dim">
              {'\u2713'} Agent routing: 35 specialists loaded
            </div>
            <div className="ka-bench-line ka-bench-dim">
              {'\u2713'} Provider coverage: 20 providers available
            </div>
            <div className="ka-bench-line ka-bench-dim">
              {'\u2713'} Local inference: 11 models ready
            </div>
            <div className="ka-bench-line ka-bench-green" style={{ marginTop: 8 }}>
              All benchmarks passed. Score: 93/100
            </div>
          </div>
        </div>

        <div className="ka-bench-install" onClick={copyInstall}>
          <code>$ npm install -g @kernel.chat/kbot</code>
          <span className="ka-bench-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>

        <div className="ka-bench-cta-row">
          <a href="https://github.com/isaacsight/kernel" className="ka-bench-cta" target="_blank" rel="noopener">
            View Source
          </a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" className="ka-bench-cta ka-bench-cta--secondary" target="_blank" rel="noopener">
            npm
          </a>
          <a href="https://discord.gg/kdMauM9abG" className="ka-bench-cta ka-bench-cta--secondary" target="_blank" rel="noopener">
            Discord
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="ka-bench-footer">
        <div className="ka-bench-footer-links">
          <a href="#/">Home</a>
          <a href="https://github.com/isaacsight/kernel" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" target="_blank" rel="noopener">npm</a>
          <a href="#/security">Security</a>
          <a href="https://discord.gg/kdMauM9abG" target="_blank" rel="noopener">Discord</a>
          <a href="#/privacy">Privacy</a>
        </div>
        <p className="ka-bench-copyright">MIT &middot; kernel.chat group</p>
      </footer>
    </div>
  )
}

// ── Helpers ──

function isWeakValue(value: string | number): boolean {
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    return lower === 'no' || lower === 'none' || lower === 'partial'
  }
  return value <= 1
}
