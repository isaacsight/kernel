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
          Use your own AI keys. Your data stays yours. A free tool that runs
          right in your terminal and works with any AI — Claude, GPT, Gemini, and more.
        </p>

        <div className="landing-kbot-features">
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">●</span>
            <span>Use your own AI key — works with Claude, GPT, Gemini, Grok, DeepSeek, and more</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">◆</span>
            <span>764+ built-in tools — manage files, search the web, use GitHub, and more</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">▸</span>
            <span>35 smart helpers that pick the right one for your question</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">⚡</span>
            <span>Run AI on your own computer — works offline, totally free</span>
          </div>
          <div className="landing-kbot-feat">
            <span className="landing-kbot-feat-icon">✎</span>
            <span>Gets faster over time — learns your patterns so it uses less power</span>
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
              <TermLine text="  K:BOT" delay={3800} />
              <TermLine text="" delay={4000} />
              <TermLine text="fix the auth redirect bug" prefix="  ~/project ❯ " delay={4200} />
            </>
          )}
        </div>
      </motion.div>
    </section>
  )
}
