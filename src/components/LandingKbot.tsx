import { useRef, useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { VARIANT, TRANSITION } from '../constants/motion'

/** Animated terminal line — types out text character by character */
function TermLine({ text, delay = 0, prefix }: { text: string; delay?: number; prefix?: string }) {
  const [displayed, setDisplayed] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!started) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 25)
    return () => clearInterval(interval)
  }, [started, text])

  if (!started) return <div className="landing-kbot-term-line">&nbsp;</div>

  return (
    <div className="landing-kbot-term-line">
      {prefix && <span className="landing-kbot-term-prefix">{prefix}</span>}
      <span className="landing-kbot-term-text">{displayed}</span>
      {displayed.length < text.length && <span className="landing-kbot-cursor">▊</span>}
    </div>
  )
}

export function LandingKbot() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="landing-kbot-section" ref={ref}>
      <motion.div
        className="landing-kbot-content"
        variants={VARIANT.FADE_UP}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={TRANSITION.CASCADE(0)}
      >
        <span className="landing-kbot-badge">Open Source</span>
        <h2 className="landing-kbot-title">K:BOT</h2>
        <p className="landing-kbot-subtitle">
          Your keys. Your data. Your models. An open-source terminal AI agent
          that connects to any provider — no middleman, no markup.
        </p>

        <div className="landing-kbot-features">
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">●</span>
            <span>Bring your own key — Claude, GPT, Gemini, Grok, DeepSeek, Mistral &amp; more</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">◆</span>
            <span>60+ tools — files, git, web search, GitHub, Docker sandboxes</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">▸</span>
            <span>17 specialist agents with auto-routing</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">⚡</span>
            <span>Run local models with Ollama — fully offline, zero cost</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">✎</span>
            <span>Learning engine — caches patterns, reduces token usage over time</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="landing-kbot-terminal"
        variants={VARIANT.FADE_UP}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={TRANSITION.CASCADE(1)}
      >
        <div className="landing-kbot-term-bar">
          <div className="landing-kbot-term-dots">
            <span /><span /><span />
          </div>
          <span className="landing-kbot-term-title">Terminal</span>
        </div>
        <div className="landing-kbot-term-body">
          {visible && (
            <>
              <TermLine text="npm i -g @kernel.chat/kbot" prefix="$ " delay={300} />
              <TermLine text="kbot auth" prefix="$ " delay={1400} />
              <TermLine text="✓ Anthropic (Claude) connected" delay={2200} />
              <TermLine text="" delay={2600} />
              <TermLine text="kbot" prefix="$ " delay={2800} />
              <TermLine text="" delay={3400} />
              <div className="landing-kbot-term-art">
{`  +╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌+
  ┊ ◦  ·  ●──●  ·  ◦  ·    ●  · ┊
  ┊   ◦ ·   │   · ◦   ·    ╱  · ┊
  ┼╌╌·╌╌·╌●╌╌·╌╌·╌╌●───●╌╌●╌╌·╌┼
  ┊  · ◦╱  ·  ◦ ·   ╲  ╱◦ ·  ●  ┊
  ┊ ·   ●  ·   · ◦  · ●  ·  │  ┊
  +╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌+`}
              </div>
              <TermLine text="  K:BOT v2.3.1" delay={3800} />
              <TermLine text="" delay={4000} />
              <TermLine text="fix the auth redirect bug" prefix="  ~/project ❯ " delay={4200} />
            </>
          )}
        </div>
      </motion.div>
    </section>
  )
}
