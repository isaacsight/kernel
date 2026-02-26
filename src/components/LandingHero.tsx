import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ParticleGrid } from './ParticleGrid'
import { useColorCycle } from '../hooks/useColorCycle'
import { VARIANT, TRANSITION } from '../constants/motion'

const AGENT_COLORS = [
  'var(--agent-kernel)',
  'var(--agent-researcher)',
  'var(--agent-coder)',
  'var(--agent-writer)',
  'var(--agent-analyst)',
]

interface LandingHeroProps {
  onGetStarted: () => void
}

export function LandingHero({ onGetStarted }: LandingHeroProps) {
  const { t } = useTranslation('auth')
  const palette = useColorCycle(true)
  const heroRef = useRef<HTMLElement>(null)
  const [scrollOpacity, setScrollOpacity] = useState(1)

  // Scroll-driven fade: hero particles fade as user scrolls past
  useEffect(() => {
    const el = heroRef.current?.closest('.landing')
    if (!el) return
    const onScroll = () => {
      const scrollY = el.scrollTop
      const fadeStart = window.innerHeight * 0.2
      const fadeEnd = window.innerHeight * 0.7
      if (scrollY <= fadeStart) setScrollOpacity(1)
      else if (scrollY >= fadeEnd) setScrollOpacity(0.3)
      else setScrollOpacity(1 - (scrollY - fadeStart) / (fadeEnd - fadeStart) * 0.7)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.section
      ref={heroRef}
      className="landing-hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION.HERO}
    >
      {/* Full-bleed particle background */}
      <div className="landing-hero-particles" style={{ opacity: scrollOpacity }}>
        <ParticleGrid
          palette={palette ?? undefined}
          width={1280}
          height={800}
          interactive
          className="landing-hero-grid"
        />
      </div>

      {/* Frosted glass content panel */}
      <motion.div
        className="landing-hero-content"
        variants={VARIANT.FADE_UP}
        initial="hidden"
        animate="visible"
        transition={TRANSITION.FEATURE(0.3)}
      >
        <img
          className="landing-logo"
          src={`${import.meta.env.BASE_URL}logo-mark.svg`}
          alt="Kernel"
        />
        <h1 className="landing-title">{t('login.title')}</h1>
        <p className="landing-subtitle">{t('login.subtitle')}</p>

        {/* Agent palette dots */}
        <div className="landing-hero-dots">
          {AGENT_COLORS.map((color, i) => (
            <span
              key={i}
              className="landing-hero-dot"
              style={{ background: color }}
            />
          ))}
        </div>

        <button className="landing-cta" onClick={onGetStarted}>
          {t('login.cta')}
        </button>
        <p className="landing-hint">{t('login.hint')}</p>
      </motion.div>
    </motion.section>
  )
}
