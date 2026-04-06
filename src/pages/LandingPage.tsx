import { useEffect, useState, useRef, useCallback } from 'react'
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

/* ── Scroll Reveal Hook ── */
function useScrollReveal() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('ka-revealed')
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

/* ── Particle Canvas ── */
interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; color: string; alpha: number
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const raf = useRef(0)
  const mouse = useRef({ x: -1000, y: -1000 })

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const count = Math.min(80, Math.floor(canvas.width * canvas.height / 12000))
    const colors = ['#6B5B95', '#28c840', '#7d6da8', '#3ad65a', '#5B8BA0']
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.8 + 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.15,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.parentElement!.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.scale(dpr, dpr)
      init(canvas)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    canvas.addEventListener('mousemove', onMouse)

    const LINE_DIST = 120
    const MOUSE_DIST = 150

    const draw = () => {
      const w = canvas.style.width ? parseFloat(canvas.style.width) : canvas.width
      const h = canvas.style.height ? parseFloat(canvas.style.height) : canvas.height
      ctx.clearRect(0, 0, w, h)

      const pts = particles.current
      for (const p of pts) {
        // Mouse repulsion
        const dx = p.x - mouse.current.x
        const dy = p.y - mouse.current.y
        const md = Math.sqrt(dx * dx + dy * dy)
        if (md < MOUSE_DIST && md > 0) {
          const force = (MOUSE_DIST - md) / MOUSE_DIST * 0.015
          p.vx += (dx / md) * force
          p.vy += (dy / md) * force
        }

        p.x += p.vx
        p.y += p.vy

        // Damping
        p.vx *= 0.999
        p.vy *= 0.999

        // Wrap
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
      }

      // Draw connections
      ctx.globalAlpha = 1
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINE_DIST) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = pts[i].color
            ctx.globalAlpha = (1 - dist / LINE_DIST) * 0.08
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMouse)
    }
  }, [init])

  return <canvas ref={canvasRef} className="ka-landing-particles" />
}

export function LandingPage() {
  const [downloads, setDownloads] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // Scroll reveal refs for each section
  const s1 = useScrollReveal()
  const s2 = useScrollReveal()
  const s3 = useScrollReveal()
  const s4 = useScrollReveal()
  const s5 = useScrollReveal()
  const s6 = useScrollReveal()

  // Enable scrolling on the landing page
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
    <div className="ka-landing">
      {/* Particle background */}
      <div className="ka-landing-particle-wrap">
        <ParticleField />
      </div>

      {/* Top Nav */}
      <nav className="ka-landing-nav">
        <a href="#/security">Security</a>
        <a href="#/bench">Benchmarks</a>
        <a href="#/sound-engineer">Sound Engineer</a>
      </nav>

      {/* Hero */}
      <section className="ka-landing-hero ka-landing-hero--animated">
        <div className="ka-landing-badge ka-hero-anim" style={{ animationDelay: '0.1s' }}>Open Source &middot; MIT Licensed</div>
        <h1 className="ka-landing-title ka-hero-anim" style={{ animationDelay: '0.25s' }}>kbot</h1>
        <p className="ka-landing-subtitle ka-hero-anim" style={{ animationDelay: '0.4s' }}>
          The AI that gets smarter every time anyone uses it.
        </p>
        <p className="ka-landing-tagline ka-hero-anim" style={{ animationDelay: '0.55s' }}>
          Terminal AI agent. 764+ tools. 35 specialists. Science lab. Runs offline.
          {downloads && <><br />{downloads.toLocaleString()} downloads this week.</>}
        </p>

        <div className="ka-landing-install ka-hero-anim" style={{ animationDelay: '0.7s' }} onClick={copyInstall}>
          <code>$ npm install -g @kernel.chat/kbot</code>
          <span className="ka-landing-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>

        <div className="ka-landing-cta-row ka-hero-anim" style={{ animationDelay: '0.85s' }}>
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
      <section ref={s1} className="ka-landing-section ka-reveal">
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
              agent in packages/kbot/ with 764+ tools across 80+ modules...
            </div>
            <div className="ka-landing-line ka-landing-dim" style={{ marginTop: 8 }}>
              3 tool calls &middot; 847 tokens &middot; $0.003
            </div>
          </div>
        </div>
      </section>

      {/* What makes kbot different */}
      <section ref={s2} className="ka-landing-section ka-reveal">
        <h2 className="ka-landing-h2">What makes kbot different</h2>
        <div className="ka-landing-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="ka-landing-card ka-stagger" style={{ transitionDelay: `${i * 0.08}s` }}>
              <h3 className="ka-landing-card-title">{f.title}</h3>
              <p className="ka-landing-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Collective Intelligence */}
      <section ref={s3} className="ka-landing-section ka-reveal">
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
      <section ref={s4} className="ka-landing-section ka-reveal">
        <h2 className="ka-landing-h2">23 Specialist Agents</h2>
        <p className="ka-landing-body">
          kbot auto-routes your request to the right expert. Or pick one yourself.
        </p>
        <div className="ka-landing-agents">
          {AGENTS.map((a, i) => (
            <span key={a} className="ka-landing-agent-tag ka-stagger" style={{ transitionDelay: `${i * 0.05}s` }}>{a}</span>
          ))}
          <span className="ka-landing-agent-tag ka-landing-dim ka-stagger" style={{ transitionDelay: `${AGENTS.length * 0.05}s` }}>+11 more</span>
        </div>
      </section>


      {/* Comparison */}
      <section ref={s5} className="ka-landing-section ka-reveal">
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
      <section ref={s6} className="ka-landing-section ka-reveal">
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
          <a href="#/sound-engineer">Sound Engineer</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </div>
        <p className="ka-landing-copyright">MIT &middot; kernel.chat group</p>
      </footer>
    </div>
  )
}
