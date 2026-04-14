import { useEffect, useState } from 'react'
import { ISSUE } from '../content/issue'
import './LandingPage.css'

/* ──────────────────────────────────────────────
   kernel.chat — "A Magazine for City Coders"
   Popeye-inspired editorial landing.
   Grammar: issue-number monument, bracketed
   categories, numbered catalog, bilingual
   lockups, tomato spot color, paper stocks.
   ────────────────────────────────────────────── */

const CONTENTS = [
  { n: '001', en: 'Computer-use desktop agent', jp: 'デスクトップ制御', tag: 'FEATURE' },
  { n: '002', en: 'Max 4 Live device pack (×9)', jp: 'M4L デバイス', tag: 'SOUND' },
  { n: '003', en: 'DJ Set Builder', jp: 'DJ セット', tag: 'SOUND' },
  { n: '004', en: 'Serum 2 preset tool', jp: 'シーラム プリセット', tag: 'SOUND' },
  { n: '005', en: 'Session isolation fix', jp: 'セッション分離', tag: 'SHIP' },
  { n: '006', en: 'SSRF protection via dns.lookup()', jp: 'SSRF 対策', tag: 'SECURITY' },
]

const FEATURES = [
  {
    n: '01',
    title: 'Learns from you',
    jp: '君から学ぶ',
    desc: 'Bayesian skill ratings + pattern extraction. Gets faster every session. Your 100th prompt is handled better than your 1st.',
    tag: 'MEMORY',
  },
  {
    n: '02',
    title: 'Learns from everyone',
    jp: 'みんなから学ぶ',
    desc: 'Opt-in collective intelligence. The 1,000th user starts smarter than the 1st. A network effect no other CLI agent has.',
    tag: 'NETWORK',
  },
  {
    n: '03',
    title: 'Builds its own tools',
    jp: '自分で道具を作る',
    desc: 'forge_tool creates new capabilities at runtime. If kbot can\'t do something, it builds the tool for it. Sandboxed, persisted, shareable.',
    tag: 'FORGE',
  },
  {
    n: '04',
    title: 'Dream engine',
    jp: '夢のエンジン',
    desc: 'After each session, kbot consolidates what it learned about you using local AI. Your preferences, patterns, and project context — all remembered.',
    tag: 'DREAM',
  },
  {
    n: '05',
    title: 'Twenty providers, zero lock-in',
    jp: '二十のプロバイダー',
    desc: 'Claude, GPT, Gemini, Grok, DeepSeek, Ollama, embedded llama.cpp. Switch with one command. Bring your own key.',
    tag: 'BYOK',
  },
  {
    n: '06',
    title: 'Runs fully offline',
    jp: '完全オフライン',
    desc: 'Embedded model, no API key required, no data leaves your machine. $0 cost. Fully private.',
    tag: 'LOCAL',
  },
]

const AGENTS = [
  { id: 'kernel', en: 'Generalist', jp: 'ジェネラリスト' },
  { id: 'coder', en: 'Programmer', jp: 'プログラマー' },
  { id: 'researcher', en: 'Researcher', jp: 'リサーチャー' },
  { id: 'writer', en: 'Writer', jp: 'ライター' },
  { id: 'analyst', en: 'Analyst', jp: 'アナリスト' },
  { id: 'guardian', en: 'Security', jp: 'ガーディアン' },
  { id: 'aesthete', en: 'Designer', jp: 'エステート' },
  { id: 'curator', en: 'Curator', jp: 'キュレーター' },
  { id: 'strategist', en: 'Strategist', jp: 'ストラテジスト' },
  { id: 'infrastructure', en: 'DevOps', jp: 'インフラ' },
  { id: 'quant', en: 'Quant', jp: 'クォンツ' },
  { id: 'investigator', en: 'Detective', jp: 'インベスティゲーター' },
]

const STATS_URL = 'https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot'

export function LandingPage() {
  const [downloads, setDownloads] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  useEffect(() => {
    fetch(STATS_URL).then(r => r.json()).then(d => setDownloads(d.downloads)).catch(() => {})
  }, [])

  const copyInstall = () => {
    navigator.clipboard.writeText('npm install -g @kernel.chat/kbot')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="pop-landing">

      {/* ═══════════════════════════════════════════════
          COVER — the Print Object. Loud, warm, editorial.
          ═══════════════════════════════════════════════ */}
      <section className="pop-cover pop-stock-cream">
        <div className="pop-cover-inner">

          {/* Top dateline — folio style */}
          <div className="pop-cover-dateline">
            <span className="pop-folio">都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。</span>
            <span className="pop-folio">ISSUE {ISSUE.number} · {ISSUE.month} {ISSUE.year}</span>
          </div>

          <hr className="pop-rule" />

          {/* Masthead lockup */}
          <div className="pop-masthead">
            <h1 className="pop-wordmark">
              kernel<span className="pop-wordmark-dot">.</span>chat
            </h1>
            <div className="pop-masthead-meta">
              <span className="pop-banner">MAGAZINE FOR CITY CODERS</span>
              <span className="pop-price">{ISSUE.price}</span>
            </div>
          </div>

          <hr className="pop-rule pop-rule--tomato" />

          {/* Feature hero — editorial headline */}
          <div className="pop-feature">
            <div className="pop-feature-kicker">
              <span className="pop-kicker pop-kicker--tomato">FEATURE · {ISSUE.number}</span>
            </div>
            <h2 className="pop-display pop-feature-title">
              The <em>Urban Outdoors</em><br />
              Review
            </h2>
            <p className="pop-swash pop-feature-swash">
              A terminal companion for city coders.
            </p>
            <p className="pop-feature-jp">
              {ISSUE.featureJp}
            </p>
          </div>

          {/* Issue monument — bottom-right block */}
          <div className="pop-cover-bottom">
            <div className="pop-monument">
              <span>ISSUE</span>
              <strong>{ISSUE.number}</strong>
              <span>{ISSUE.month} {ISSUE.year}</span>
              <span>{ISSUE.price}</span>
            </div>

            <div className="pop-cover-install" onClick={copyInstall}>
              <span className="pop-folio">INSTALL</span>
              <code>npm i -g @kernel.chat/kbot</code>
              <span className="pop-folio">{copied ? 'COPIED' : 'COPY'}</span>
            </div>
          </div>

          <div className="pop-cover-stats">
            <span className="pop-hash">open-source</span>
            <span className="pop-hash">mit-licensed</span>
            <span className="pop-hash">byok</span>
            <span className="pop-hash">local-first</span>
            {downloads && <span className="pop-hash">{downloads.toLocaleString()}-weekly</span>}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          CONTENTS — numbered table of contents
          ═══════════════════════════════════════════════ */}
      <section className="pop-contents pop-stock-ivory">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">CONTENTS · 目次</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">
              In this issue
            </h2>
          </header>

          <ol className="pop-toc">
            {CONTENTS.map((item) => (
              <li key={item.n} className="pop-row">
                <span className="pop-catalog-num">{item.n}.</span>
                <span className="pop-row-label">
                  {item.en}
                  <span className="pop-row-sub">{item.jp}</span>
                </span>
                <span className="pop-banner pop-banner--kraft">{item.tag}</span>
              </li>
            ))}
          </ol>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          FEATURE GRID — numbered catalog
          ═══════════════════════════════════════════════ */}
      <section className="pop-features pop-stock-butter">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">THE CATALOG · カタログ</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">
              What makes <em>kbot</em> different.
            </h2>
            <p className="pop-swash">Six notes from the field.</p>
          </header>

          <div className="pop-catalog-grid">
            {FEATURES.map((f) => (
              <article key={f.n} className="pop-catalog-card">
                <div className="pop-catalog-card-header">
                  <span className="pop-catalog-num">{f.n}.</span>
                  <span className="pop-banner">{f.tag}</span>
                </div>
                <h3 className="pop-catalog-card-title">{f.title}</h3>
                <p className="pop-catalog-card-jp">{f.jp}</p>
                <hr className="pop-rule pop-rule--soft" />
                <p className="pop-catalog-card-desc">{f.desc}</p>
              </article>
            ))}
          </div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          FIELD REPORT — the terminal demo (quiet voice)
          Bifurcation: editorial frame, utility content.
          ═══════════════════════════════════════════════ */}
      <section className="pop-field pop-stock-ink">
        <div className="pop-section-inner">

          <header className="pop-section-header pop-section-header--on-ink">
            <span className="pop-kicker pop-kicker--tomato">FIELD REPORT · 実地レポート</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title pop-section-title--on-ink">
              A dispatch from the <em>terminal</em>.
            </h2>
            <p className="pop-swash pop-swash--on-ink">
              What kbot actually does when you let it touch the keyboard.
            </p>
          </header>

          <div className="pop-terminal">
            <div className="pop-terminal-bar">
              <span className="pop-terminal-dot" style={{ background: '#ff5f57' }} />
              <span className="pop-terminal-dot" style={{ background: '#ffbd2e' }} />
              <span className="pop-terminal-dot" style={{ background: '#28c840' }} />
              <span className="pop-terminal-title">kbot</span>
            </div>
            <div className="pop-terminal-body">
              <div className="pop-terminal-line">
                <span className="pop-terminal-prompt">$</span> kbot "find and fix the auth bug"
              </div>
              <div className="pop-terminal-line pop-terminal-dim">
                <span className="pop-terminal-agent">● coder</span> Investigating auth flow...
              </div>
              <div className="pop-terminal-line pop-terminal-dim">&nbsp;&nbsp;▸ grep "authenticate" src/ — 3 matches</div>
              <div className="pop-terminal-line pop-terminal-dim">&nbsp;&nbsp;▸ read_file src/auth.ts</div>
              <div className="pop-terminal-line pop-terminal-dim">&nbsp;&nbsp;▸ edit_file src/auth.ts — fixed token expiry check</div>
              <div className="pop-terminal-line pop-terminal-dim">&nbsp;&nbsp;▸ run_tests — 47 passed</div>
              <div className="pop-terminal-line" style={{ marginTop: 12 }}>
                Found the bug: token expiry was compared as string<br />
                instead of timestamp. Fixed and tests pass. The change<br />
                is staged — run <code>git diff</code> to review.
              </div>
              <div className="pop-terminal-line pop-terminal-dim" style={{ marginTop: 8 }}>
                4 tool calls · 1,203 tokens · $0.005
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          SPECIALISTS — agent catalog (bilingual)
          ═══════════════════════════════════════════════ */}
      <section className="pop-specialists pop-stock-ivory">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">SPECIALISTS · 専門家</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">
              Thirty-five specialist agents.
            </h2>
            <p className="pop-swash">
              kbot auto-routes your request to the right expert. Or pick one.
            </p>
          </header>

          <div className="pop-specialist-grid">
            {AGENTS.map((a, i) => (
              <div key={a.id} className="pop-specialist-card">
                <span className="pop-catalog-num">{String(i + 1).padStart(2, '0')}.</span>
                <div className="pop-specialist-body">
                  <span className="pop-specialist-id">{a.id}</span>
                  <span className="pop-specialist-en">{a.en}</span>
                  <span className="pop-specialist-jp">{a.jp}</span>
                </div>
              </div>
            ))}
            <div className="pop-specialist-card pop-specialist-card--more">
              <span className="pop-catalog-num">+</span>
              <div className="pop-specialist-body">
                <span className="pop-specialist-id">twenty-three more</span>
                <span className="pop-specialist-jp">他 23 名</span>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          COMPARISON — spec sheet grammar
          ═══════════════════════════════════════════════ */}
      <section className="pop-compare pop-stock-cream">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">THE SPECS · スペック</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">
              How it compares.
            </h2>
          </header>

          <div className="pop-compare-table-wrap">
            <table className="pop-compare-table">
              <thead>
                <tr>
                  <th></th>
                  <th><span className="pop-banner">kbot</span></th>
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
                <tr><td>Built-in tools</td><td>787+</td><td>~15</td><td>~10</td><td>~10</td></tr>
                <tr><td>Runs offline</td><td>Yes</td><td>No</td><td>No</td><td>Yes</td></tr>
                <tr><td>Open source</td><td>MIT</td><td>No</td><td>No</td><td>Apache</td></tr>
                <tr><td>Cost</td><td>$0 local</td><td>$20+/mo</td><td>$20/mo</td><td>BYOK</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          QUICK START — "First time in the city" primer
          ═══════════════════════════════════════════════ */}
      <section className="pop-quickstart pop-stock-kraft">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">FIELD PRIMER · 入門</span>
            <hr className="pop-rule pop-rule--short" />
            <h2 className="pop-display pop-section-title">
              Quick start.
            </h2>
            <p className="pop-swash">Three commands. One coffee.</p>
          </header>

          <div className="pop-terminal pop-terminal--light">
            <div className="pop-terminal-bar">
              <span className="pop-terminal-dot" style={{ background: '#ff5f57' }} />
              <span className="pop-terminal-dot" style={{ background: '#ffbd2e' }} />
              <span className="pop-terminal-dot" style={{ background: '#28c840' }} />
            </div>
            <div className="pop-terminal-body">
              <div className="pop-terminal-line"><span className="pop-terminal-prompt">$</span> npm i -g @kernel.chat/kbot</div>
              <div className="pop-terminal-line"><span className="pop-terminal-prompt">$</span> kbot "hello"</div>
              <div className="pop-terminal-line pop-terminal-dim">No API key needed. Works instantly.</div>
              <div className="pop-terminal-line" style={{ marginTop: 8 }}><span className="pop-terminal-prompt">$</span> kbot --agent coder "fix the auth bug"</div>
              <div className="pop-terminal-line"><span className="pop-terminal-prompt">$</span> kbot --agent researcher "papers on active inference"</div>
              <div className="pop-terminal-line"><span className="pop-terminal-prompt">$</span> git diff | kbot "review this"</div>
            </div>
          </div>

          <div className="pop-cta-row">
            <a href="https://github.com/isaacsight/kernel" className="pop-cta" target="_blank" rel="noopener">
              <span className="pop-folio">VISIT</span>
              <span>GitHub →</span>
            </a>
            <a href="https://www.npmjs.com/package/@kernel.chat/kbot" className="pop-cta pop-cta--alt" target="_blank" rel="noopener">
              <span className="pop-folio">INSTALL</span>
              <span>npm →</span>
            </a>
            <a href="https://discord.gg/kdMauM9abG" className="pop-cta pop-cta--alt" target="_blank" rel="noopener">
              <span className="pop-folio">JOIN</span>
              <span>Discord →</span>
            </a>
          </div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          COLOPHON — magazine-style footer
          ═══════════════════════════════════════════════ */}
      <footer className="pop-colophon pop-stock-ivory">
        <div className="pop-section-inner">
          <hr className="pop-rule" />

          <div className="pop-colophon-row">
            <div className="pop-colophon-masthead">
              <span className="pop-wordmark-sm">kernel<span className="pop-wordmark-dot">.</span>chat</span>
              <span className="pop-folio">MAGAZINE FOR CITY CODERS · 街のコーダーのために</span>
            </div>
            <div className="pop-monument pop-monument--sm">
              <span>ISSUE</span>
              <strong>{ISSUE.number}</strong>
              <span>{ISSUE.month} {ISSUE.year}</span>
            </div>
          </div>

          <hr className="pop-rule pop-rule--soft" />

          <div className="pop-colophon-links">
            <a href="https://github.com/isaacsight/kernel" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.npmjs.com/package/@kernel.chat/kbot" target="_blank" rel="noopener">npm</a>
            <a href="https://discord.gg/kdMauM9abG" target="_blank" rel="noopener">Discord</a>
            <a href="#/security">Security</a>
            <a href="#/bench">Benchmarks</a>
            <a href="#/privacy">Privacy</a>
            <a href="#/terms">Terms</a>
          </div>

          <p className="pop-folio pop-colophon-copy">
            MIT · kernel.chat group · Published monthly from the terminal.
          </p>
        </div>
      </footer>

    </div>
  )
}
