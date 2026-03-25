import { useEffect, useState } from 'react'
import './SecurityPage.css'

const SECURITY_FEATURES = [
  {
    icon: '\u2592',
    title: 'AES-256-CBC encryption',
    desc: 'API keys and wallet keys encrypted at rest. Never stored in plaintext. Never transmitted unencrypted.',
    tag: 'cryptography',
  },
  {
    icon: '\u2718',
    title: 'Permission gates',
    desc: 'Destructive operations — rm -rf, force push, DROP TABLE — require explicit confirmation before execution.',
    tag: 'access control',
  },
  {
    icon: '\u29D7',
    title: '5-min tool timeout',
    desc: 'Every tool execution has a hard timeout. Runaway processes are killed automatically. No infinite loops.',
    tag: 'runtime safety',
  },
  {
    icon: '\u2691',
    title: 'Immune agent self-audit',
    desc: 'Built-in drift detection agent monitors kbot\'s own behavior for anomalies and unauthorized changes.',
    tag: 'introspection',
  },
  {
    icon: '\u2B21',
    title: 'Docker sandbox isolation',
    desc: 'Untrusted code runs in isolated Docker containers. Network, filesystem, and process boundaries enforced.',
    tag: 'isolation',
  },
  {
    icon: '\u2302',
    title: 'Local-first architecture',
    desc: 'Runs fully offline with embedded models. Zero data sent externally unless you opt in. Your code stays yours.',
    tag: 'privacy',
  },
  {
    icon: '\u26A0',
    title: 'Wallet guardrails',
    desc: 'Max transaction limits and confirmation gates for any financial operation. No silent transfers. Ever.',
    tag: 'financial safety',
  },
  {
    icon: '\u2630',
    title: 'File permissions lockdown',
    desc: 'Config files set to chmod 600. Only the owner can read kbot\'s configuration. No group or world access.',
    tag: 'filesystem',
  },
]

const COMPARISON_ROWS = [
  { feature: 'Encrypted key storage', kbot: 'AES-256-CBC', chatgpt: 'Server-side', cursor: 'Plaintext .env', copilot: 'Server-side' },
  { feature: 'Destructive op gates', kbot: 'Yes', chatgpt: 'No', cursor: 'No', copilot: 'No' },
  { feature: 'Tool execution timeout', kbot: '5 min', chatgpt: 'N/A', cursor: 'None', copilot: 'N/A' },
  { feature: 'Self-audit agent', kbot: 'Yes', chatgpt: 'No', cursor: 'No', copilot: 'No' },
  { feature: 'Sandbox isolation', kbot: 'Docker', chatgpt: 'Server VM', cursor: 'None', copilot: 'None' },
  { feature: 'Runs offline', kbot: 'Yes', chatgpt: 'No', cursor: 'No', copilot: 'No' },
  { feature: 'Open source', kbot: 'MIT', chatgpt: 'No', cursor: 'No', copilot: 'No' },
  { feature: 'Your data leaves machine', kbot: 'Never*', chatgpt: 'Always', cursor: 'Always', copilot: 'Always' },
]

export function SecurityPage() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  const copyInstall = () => {
    navigator.clipboard.writeText('npm install -g @kernel.chat/kbot')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ka-security">
      {/* Hero */}
      <section className="ka-security-hero">
        <div className="ka-security-shield" aria-hidden="true" />
        <div className="ka-security-badge">Security-First Design</div>
        <h1 className="ka-security-title">Security-First AI Agent</h1>
        <p className="ka-security-subtitle">
          Your keys encrypted. Your code local. Your permissions enforced.
        </p>
        <p className="ka-security-tagline">
          kbot was built with the assumption that AI agents are dangerous by default.
          Every capability has a corresponding constraint. Every tool has a boundary.
        </p>

        <div className="ka-security-install" onClick={copyInstall}>
          <code>$ npm install -g @kernel.chat/kbot</code>
          <span className="ka-security-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>
      </section>

      {/* Security Features Grid */}
      <section className="ka-security-section">
        <h2 className="ka-security-h2">8 layers of defense</h2>
        <p className="ka-security-section-desc">
          Not bolted on. Built in from day one. Every layer works independently.
        </p>
        <div className="ka-security-grid">
          {SECURITY_FEATURES.map(f => (
            <div key={f.title} className="ka-security-card">
              <span className="ka-security-card-icon" aria-hidden="true">{f.icon}</span>
              <h3 className="ka-security-card-title">{f.title}</h3>
              <p className="ka-security-card-desc">{f.desc}</p>
              <span className="ka-security-card-tag">{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ka-security-divider" />

      {/* How it works — terminal demo */}
      <section className="ka-security-section">
        <h2 className="ka-security-h2">See it in action</h2>
        <p className="ka-security-section-desc">
          kbot blocks dangerous commands, asks for confirmation, and logs everything.
        </p>
        <div className="ka-security-terminal">
          <div className="ka-security-terminal-bar">
            <span className="ka-security-dot" style={{ background: '#ff5f57' }} />
            <span className="ka-security-dot" style={{ background: '#ffbd2e' }} />
            <span className="ka-security-dot" style={{ background: '#28c840' }} />
            <span className="ka-security-terminal-title">kbot</span>
          </div>
          <div className="ka-security-terminal-body">
            <div className="ka-security-line">
              <span className="ka-security-prompt">$</span> kbot "delete everything in /usr"
            </div>
            <div className="ka-security-line ka-security-dim" style={{ marginTop: 8 }}>
              <span className="ka-security-green">{'\u26A0'} BLOCKED</span> &mdash; Destructive operation detected
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;Command: rm -rf /usr/*
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;Risk: CRITICAL &mdash; system directory deletion
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;Action: Blocked. Requires --allow-destructive flag.
            </div>
            <div className="ka-security-line" style={{ marginTop: 12 }}>
              <span className="ka-security-prompt">$</span> kbot "show my API keys"
            </div>
            <div className="ka-security-line ka-security-dim" style={{ marginTop: 8 }}>
              <span className="ka-security-green">{'\u2713'}</span> Keys stored at ~/.kbot/config.json
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;Encryption: AES-256-CBC
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;Permissions: -rw------- (600)
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;anthropic: sk-ant-...****7x2f
            </div>
            <div className="ka-security-line ka-security-dim">
              &nbsp;&nbsp;openai: sk-...****9k3m
            </div>
          </div>
        </div>
      </section>

      <div className="ka-security-divider" />

      {/* Comparison */}
      <section className="ka-security-section">
        <h2 className="ka-security-h2">What others don't have</h2>
        <p className="ka-security-section-desc">
          Most AI tools treat security as an afterthought. kbot treats it as the foundation.
        </p>
        <div className="ka-security-table-wrap">
          <table className="ka-security-table">
            <thead>
              <tr>
                <th></th>
                <th>kbot</th>
                <th>ChatGPT</th>
                <th>Cursor</th>
                <th>Copilot</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(row => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.kbot}</td>
                  <td className={row.chatgpt === 'No' || row.chatgpt === 'Always' ? 'ka-security-no' : ''}>{row.chatgpt}</td>
                  <td className={row.cursor === 'No' || row.cursor === 'None' || row.cursor === 'Always' || row.cursor === 'Plaintext .env' ? 'ka-security-no' : ''}>{row.cursor}</td>
                  <td className={row.copilot === 'No' || row.copilot === 'None' || row.copilot === 'Always' ? 'ka-security-no' : ''}>{row.copilot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ka-security-section-desc" style={{ marginTop: 16, fontSize: 13, color: '#555' }}>
          * With local models only. API-mode sends prompts to the provider you choose.
        </p>
      </section>

      <div className="ka-security-divider" />

      {/* Security principles */}
      <section className="ka-security-section">
        <h2 className="ka-security-h2">Security principles</h2>
        <div className="ka-security-principles">
          <div className="ka-security-principle">
            <span className="ka-security-principle-num">01</span>
            <p className="ka-security-principle-text">
              <strong>Deny by default.</strong> No tool runs without explicit capability grants.
              New tools start with zero permissions and earn trust through use.
            </p>
          </div>
          <div className="ka-security-principle">
            <span className="ka-security-principle-num">02</span>
            <p className="ka-security-principle-text">
              <strong>Encrypt everything at rest.</strong> API keys, wallet keys, session data, learning profiles.
              AES-256-CBC with per-machine derived keys.
            </p>
          </div>
          <div className="ka-security-principle">
            <span className="ka-security-principle-num">03</span>
            <p className="ka-security-principle-text">
              <strong>Confirm before destroying.</strong> File deletion, git force-push, database drops, financial transactions.
              All require human confirmation.
            </p>
          </div>
          <div className="ka-security-principle">
            <span className="ka-security-principle-num">04</span>
            <p className="ka-security-principle-text">
              <strong>Audit the code yourself.</strong> MIT licensed. Every line on GitHub.
              No obfuscation, no telemetry, no hidden network calls.
            </p>
          </div>
        </div>
      </section>

      <div className="ka-security-divider" />

      {/* Open Source */}
      <section className="ka-security-opensource">
        <div className="ka-security-opensource-badge">OPEN SOURCE</div>
        <h2 className="ka-security-h2">Transparency is the best security</h2>
        <p className="ka-security-body">
          kbot is MIT licensed. The entire codebase is public on GitHub.
          You can read every line that touches your filesystem, your network, your keys.
          No trust required — verify it yourself.
        </p>
        <p className="ka-security-body" style={{ color: '#666' }}>
          Found a vulnerability? Open an issue or email security@kernel.chat.
          We take every report seriously.
        </p>

        <div className="ka-security-terminal" style={{ maxWidth: 480, marginTop: 32 }}>
          <div className="ka-security-terminal-bar">
            <span className="ka-security-dot" style={{ background: '#ff5f57' }} />
            <span className="ka-security-dot" style={{ background: '#ffbd2e' }} />
            <span className="ka-security-dot" style={{ background: '#28c840' }} />
          </div>
          <div className="ka-security-terminal-body">
            <div className="ka-security-line">
              <span className="ka-security-prompt">$</span> kbot doctor --security
            </div>
            <div className="ka-security-line ka-security-dim" style={{ marginTop: 4 }}>
              {'\u2713'} API keys encrypted (AES-256-CBC)
            </div>
            <div className="ka-security-line ka-security-dim">
              {'\u2713'} Config permissions 600
            </div>
            <div className="ka-security-line ka-security-dim">
              {'\u2713'} Destructive ops gated
            </div>
            <div className="ka-security-line ka-security-dim">
              {'\u2713'} Tool timeout 300s active
            </div>
            <div className="ka-security-line ka-security-dim">
              {'\u2713'} No secrets in env
            </div>
            <div className="ka-security-line ka-security-green" style={{ marginTop: 8 }}>
              All 5 checks passed. kbot is secure.
            </div>
          </div>
        </div>

        <div className="ka-security-cta-row">
          <a href="https://github.com/isaacsight/kernel" className="ka-security-cta" target="_blank" rel="noopener">
            View Source on GitHub
          </a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" className="ka-security-cta ka-security-cta--secondary" target="_blank" rel="noopener">
            npm
          </a>
          <a href="https://discord.gg/kdMauM9abG" className="ka-security-cta ka-security-cta--secondary" target="_blank" rel="noopener">
            Discord
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="ka-security-footer">
        <div className="ka-security-footer-links">
          <a href="#/">Home</a>
          <a href="https://github.com/isaacsight/kernel" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" target="_blank" rel="noopener">npm</a>
          <a href="https://discord.gg/kdMauM9abG" target="_blank" rel="noopener">Discord</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </div>
        <p className="ka-security-copyright">MIT &middot; kernel.chat group</p>
      </footer>
    </div>
  )
}
