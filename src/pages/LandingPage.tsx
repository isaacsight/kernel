import { useEffect, useState } from 'react'
import './LandingPage.css'

const FEATURES = [
  { title: 'Learns from you', desc: 'Bayesian skill ratings + pattern extraction. Gets faster every session.' },
  { title: 'Learns from everyone', desc: 'Opt-in collective intelligence. The 1,000th user starts smarter than the 1st.' },
  { title: 'Builds its own tools', desc: 'forge_tool creates new capabilities at runtime. Sandboxed, persisted, shareable.' },
  { title: '11 cognitive modules', desc: 'Free Energy, Predictive Processing, Strange Loops — peer-reviewed research, running TypeScript.' },
  { title: '20 providers, zero lock-in', desc: 'Claude, GPT, Gemini, Ollama, embedded llama.cpp. Switch with one command.' },
  { title: 'Runs fully offline', desc: 'Embedded model, no API key, no data leaves your machine. $0.' },
]

const AGENTS = [
  'kernel', 'coder', 'researcher', 'writer', 'analyst',
  'guardian', 'aesthete', 'curator', 'strategist',
  'infrastructure', 'quant', 'investigator',
]

const STATS_URL = 'https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot'

export function LandingPage() {
  const [downloads, setDownloads] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(STATS_URL).then(r => r.json()).then(d => setDownloads(d.downloads)).catch(() => {})
  }, [])

  const copyInstall = () => {
    navigator.clipboard.writeText('npm install -g @kernel.chat/kbot')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ka-landing">
      {/* Hero */}
      <section className="ka-landing-hero">
        <div className="ka-landing-badge">Open Source &middot; MIT Licensed</div>
        <h1 className="ka-landing-title">kbot</h1>
        <p className="ka-landing-subtitle">
          The AI that gets smarter every time anyone uses it.
        </p>
        <p className="ka-landing-tagline">
          Terminal AI agent. 290 tools. 23 specialists. Runs offline.
          {downloads && <><br />{downloads.toLocaleString()} downloads this week.</>}
        </p>

        <div className="ka-landing-install" onClick={copyInstall}>
          <code>$ npm install -g @kernel.chat/kbot</code>
          <span className="ka-landing-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>

        <div className="ka-landing-cta-row">
          <a href="https://github.com/isaacsight/kernel" className="ka-landing-cta" target="_blank" rel="noopener">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" className="ka-landing-cta ka-landing-cta--secondary" target="_blank" rel="noopener">
            npm
          </a>
          <a href="https://discord.gg/kdMauM9abG" className="ka-landing-cta ka-landing-cta--secondary" target="_blank" rel="noopener">
            Discord
          </a>
        </div>
      </section>

      {/* Demo */}
      <section className="ka-landing-section">
        <div className="ka-landing-terminal">
          <div className="ka-landing-terminal-bar">
            <span className="ka-landing-dot" style={{ background: '#ff5f57' }} />
            <span className="ka-landing-dot" style={{ background: '#ffbd2e' }} />
            <span className="ka-landing-dot" style={{ background: '#28c840' }} />
            <span className="ka-landing-terminal-title">kbot</span>
          </div>
          <div className="ka-landing-terminal-body">
            <div className="ka-landing-line"><span className="ka-landing-prompt">$</span> kbot "explain this codebase"</div>
            <div className="ka-landing-line ka-landing-dim">
              <span className="ka-landing-agent">&#9673; coder</span> Reading project structure...
            </div>
            <div className="ka-landing-line ka-landing-dim">&nbsp;&nbsp;&#9656; read_file package.json</div>
            <div className="ka-landing-line ka-landing-dim">&nbsp;&nbsp;&#9656; glob src/**/*.ts</div>
            <div className="ka-landing-line ka-landing-dim">&nbsp;&nbsp;&#9656; grep "export function" src/</div>
            <div className="ka-landing-line" style={{ marginTop: 12 }}>
              This is a TypeScript monorepo with a React frontend and<br />
              Supabase backend. The main product is kbot, a terminal AI<br />
              agent in packages/kbot/ with 290 tools across 46 modules...
            </div>
            <div className="ka-landing-line ka-landing-dim" style={{ marginTop: 8 }}>
              3 tool calls &middot; 847 tokens &middot; $0.003
            </div>
          </div>
        </div>
      </section>

      {/* What makes kbot different */}
      <section className="ka-landing-section">
        <h2 className="ka-landing-h2">What makes kbot different</h2>
        <div className="ka-landing-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="ka-landing-card">
              <h3 className="ka-landing-card-title">{f.title}</h3>
              <p className="ka-landing-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Collective Intelligence */}
      <section className="ka-landing-section">
        <h2 className="ka-landing-h2">Collective Intelligence</h2>
        <p className="ka-landing-body">
          Every kbot user who opts in contributes anonymized signals — what task type,
          which agent, what tools, did it work. No code, no files, no identity. Ever.
        </p>
        <p className="ka-landing-body">
          The result: the 1,000th person to install kbot gets a smarter agent than the 1st.
          The more people use it, the better it gets for everyone. A network effect
          no other AI tool has.
        </p>
        <div className="ka-landing-install" onClick={copyInstall} style={{ maxWidth: 440 }}>
          <code>$ kbot collective --enable</code>
          <span className="ka-landing-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>
      </section>

      {/* Agents */}
      <section className="ka-landing-section">
        <h2 className="ka-landing-h2">23 Specialist Agents</h2>
        <p className="ka-landing-body">
          kbot auto-routes your request to the right expert. Or pick one yourself.
        </p>
        <div className="ka-landing-agents">
          {AGENTS.map(a => (
            <span key={a} className="ka-landing-agent-tag">{a}</span>
          ))}
          <span className="ka-landing-agent-tag ka-landing-dim">+11 more</span>
        </div>
      </section>

      {/* Comparison */}
      <section className="ka-landing-section">
        <h2 className="ka-landing-h2">How it compares</h2>
        <div className="ka-landing-table-wrap">
          <table className="ka-landing-table">
            <thead>
              <tr>
                <th></th>
                <th>kbot</th>
                <th>Claude Code</th>
                <th>Cursor</th>
                <th>Aider</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Learns from you</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
              <tr><td>Learns from everyone</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
              <tr><td>Builds own tools</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
              <tr><td>Cognitive modules</td><td>11</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>AI providers</td><td>20</td><td>1</td><td>4</td><td>100+</td></tr>
              <tr><td>Built-in tools</td><td>290</td><td>~15</td><td>~10</td><td>~10</td></tr>
              <tr><td>Runs offline</td><td>Yes</td><td>No</td><td>No</td><td>Yes</td></tr>
              <tr><td>Open source</td><td>MIT</td><td>No</td><td>No</td><td>Apache</td></tr>
              <tr><td>Cost</td><td>$0 local</td><td>$20+/mo</td><td>$20/mo</td><td>BYOK</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick start */}
      <section className="ka-landing-section">
        <h2 className="ka-landing-h2">Quick start</h2>
        <div className="ka-landing-terminal" style={{ maxWidth: 500 }}>
          <div className="ka-landing-terminal-bar">
            <span className="ka-landing-dot" style={{ background: '#ff5f57' }} />
            <span className="ka-landing-dot" style={{ background: '#ffbd2e' }} />
            <span className="ka-landing-dot" style={{ background: '#28c840' }} />
          </div>
          <div className="ka-landing-terminal-body">
            <div className="ka-landing-line"><span className="ka-landing-prompt">$</span> npm i -g @kernel.chat/kbot</div>
            <div className="ka-landing-line"><span className="ka-landing-prompt">$</span> kbot "hello"</div>
            <div className="ka-landing-line ka-landing-dim">No API key needed. Works instantly.</div>
            <div className="ka-landing-line" style={{ marginTop: 8 }}><span className="ka-landing-prompt">$</span> kbot --agent coder "fix the auth bug"</div>
            <div className="ka-landing-line"><span className="ka-landing-prompt">$</span> kbot --agent researcher "papers on active inference"</div>
            <div className="ka-landing-line"><span className="ka-landing-prompt">$</span> git diff | kbot "review this"</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ka-landing-footer">
        <div className="ka-landing-footer-links">
          <a href="https://github.com/isaacsight/kernel" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" target="_blank" rel="noopener">npm</a>
          <a href="https://discord.gg/kdMauM9abG" target="_blank" rel="noopener">Discord</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </div>
        <p className="ka-landing-copyright">MIT &middot; kernel.chat group</p>
      </footer>
    </div>
  )
}
