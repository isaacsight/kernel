import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconArrowRight } from './KernelIcons'
import { ParticleGrid } from './ParticleGrid'

interface OnboardingFlowProps {
  onComplete: (interests?: string[]) => void
  userName?: string
}

const stagger = (i: number) => ({ delay: 0.15 + i * 0.1 })

export function OnboardingFlow({ onComplete, userName }: OnboardingFlowProps) {
  const { t } = useTranslation('onboarding')
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const displayName = userName?.split('@')[0]

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const msg = value.trim()
    if (!msg) return
    sessionStorage.setItem('kernel-onboarding-message', msg)
    onComplete()
  }, [value, onComplete])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <div className="ka-onb-page">
      <button className="ka-onb-skip" onClick={handleSkip}>
        {t('skipIntro')}
      </button>

      <div className="ka-onb-content">
        <motion.div
          className="ka-onb-hero"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], ...stagger(0) }}
        >
          <ParticleGrid size={300} interactive />
        </motion.div>

        <motion.h1
          className="ka-onb-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], ...stagger(1) }}
        >
          {displayName ? t('greetingUser', { name: displayName }) : t('greeting')}
        </motion.h1>

        <motion.p
          className="ka-onb-tagline"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], ...stagger(2) }}
        >
          {t('tagline')}
        </motion.p>

        <motion.form
          className="ka-onb-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], ...stagger(3) }}
        >
          <input
            ref={inputRef}
            className="ka-onb-input"
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={t('placeholder')}
            autoFocus
          />
          <button
            className="ka-onb-submit"
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
          >
            <IconArrowRight size={18} />
          </button>
        </motion.form>
      </div>
    </div>
  )
}
