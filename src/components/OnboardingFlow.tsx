import { useState, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconArrowRight, IconCrown, IconCheck } from './KernelIcons'
import { DURATION, EASE } from '../constants/motion'

interface OnboardingFlowProps {
  onComplete: (interests?: string[]) => void
  userName?: string
}

// ─── Interest Picker ──────────────────────────────────

const INTERESTS = [
  { id: 'tech', label: 'Technology', emoji: '\u2699\ufe0f' },
  { id: 'business', label: 'Business', emoji: '\ud83d\udcbc' },
  { id: 'creative', label: 'Creative Writing', emoji: '\u270f\ufe0f' },
  { id: 'science', label: 'Science', emoji: '\ud83d\udd2c' },
  { id: 'health', label: 'Health & Fitness', emoji: '\ud83c\udfcb\ufe0f' },
  { id: 'finance', label: 'Finance', emoji: '\ud83d\udcb0' },
  { id: 'design', label: 'Design', emoji: '\ud83c\udfa8' },
  { id: 'coding', label: 'Coding', emoji: '\ud83d\udcbb' },
  { id: 'music', label: 'Music', emoji: '\ud83c\udfb5' },
  { id: 'philosophy', label: 'Philosophy', emoji: '\ud83e\udde0' },
  { id: 'travel', label: 'Travel', emoji: '\u2708\ufe0f' },
  { id: 'education', label: 'Education', emoji: '\ud83d\udcda' },
]

// ─── Steps ────────────────────────────────────────────

const TOTAL_STEPS = 5

export function OnboardingFlow({ onComplete, userName }: OnboardingFlowProps) {
  const { t } = useTranslation('onboarding')
  const [step, setStep] = useState(0)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = back

  const goNext = useCallback(() => {
    if (step >= TOTAL_STEPS - 1) {
      onComplete(selectedInterests.length > 0 ? selectedInterests : undefined)
    } else {
      setDirection(1)
      setStep(s => s + 1)
    }
  }, [step, selectedInterests, onComplete])

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep(s => s - 1)
    }
  }, [step])

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Swipe navigation
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -50 && info.velocity.x < -200) {
      goNext()
    } else if (info.offset.x > 50 && info.velocity.x > 200) {
      goBack()
    }
  }

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 80 : -80 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -80 : 80 }),
  }

  return (
    <div className="ka-gate">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          className="ka-gate-card onboarding-card"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: DURATION.NORMAL, ease: EASE.OUT }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
        >
          {/* Progress dots */}
          <div className="onboarding-dots" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={t('progress', { current: step + 1, total: TOTAL_STEPS })}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <>
              <img className="onboarding-illustration" src={`${import.meta.env.BASE_URL}concepts/onboarding-1-welcome.svg`} alt="" aria-hidden="true" />
              <h1 className="ka-gate-title onboarding-title">
                {userName ? t('step0.titleUser', { name: userName.split('@')[0] }) : t('step0.title')}
              </h1>
              <p className="onboarding-subtitle">{t('step0.subtitle')}</p>
              <p className="onboarding-body">
                {t('step0.body')}
              </p>
            </>
          )}

          {/* Step 1: Memory */}
          {step === 1 && (
            <>
              <img className="onboarding-illustration" src={`${import.meta.env.BASE_URL}concepts/onboarding-2-memory.svg`} alt="" aria-hidden="true" />
              <h1 className="ka-gate-title onboarding-title">{t('step1.title')}</h1>
              <p className="onboarding-subtitle">{t('step1.subtitle')}</p>
              <p className="onboarding-body">
                {t('step1.body')}
              </p>
            </>
          )}

          {/* Step 2: Agents */}
          {step === 2 && (
            <>
              <img className="onboarding-illustration" src={`${import.meta.env.BASE_URL}concepts/onboarding-3-agents.svg`} alt="" aria-hidden="true" />
              <h1 className="ka-gate-title onboarding-title">{t('step2.title')}</h1>
              <p className="onboarding-subtitle">{t('step2.subtitle')}</p>
              <p className="onboarding-body">
                {t('step2.body')}
              </p>
            </>
          )}

          {/* Step 3: Interest Picker */}
          {step === 3 && (
            <>
              <img className="onboarding-illustration" src={`${import.meta.env.BASE_URL}concepts/onboarding-4-interests.svg`} alt="" aria-hidden="true" />
              <h1 className="ka-gate-title onboarding-title">{t('step3.title')}</h1>
              <p className="onboarding-subtitle">{t('step3.subtitle')}</p>
              <div className="onboarding-interests">
                {INTERESTS.map(interest => (
                  <button
                    key={interest.id}
                    className={`onboarding-interest${selectedInterests.includes(interest.id) ? ' onboarding-interest--selected' : ''}`}
                    onClick={() => toggleInterest(interest.id)}
                  >
                    <span>{interest.emoji}</span>
                    <span>{t(`interests.${interest.id}`)}</span>
                    {selectedInterests.includes(interest.id) && <IconCheck size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Free vs Pro + Begin */}
          {step === 4 && (
            <>
              <div className="onboarding-icon"><IconCrown size={28} aria-hidden="true" /></div>
              <h1 className="ka-gate-title onboarding-title">{t('step4.title')}</h1>
              <p className="onboarding-subtitle">{t('step4.subtitle')}</p>
              <div className="onboarding-tiers">
                <div className="onboarding-tier">
                  <span className="onboarding-tier-name">{t('tiers.free')}</span>
                  <ul className="onboarding-tier-features">
                    <li>{t('tiers.freeFeature1')}</li>
                    <li>{t('tiers.freeFeature2')}</li>
                    <li>{t('tiers.freeFeature3')}</li>
                  </ul>
                </div>
                <div className="onboarding-tier onboarding-tier--pro">
                  <span className="onboarding-tier-name">{t('tiers.pro')}</span>
                  <ul className="onboarding-tier-features">
                    <li>{t('tiers.proFeature1')}</li>
                    <li>{t('tiers.proFeature2')}</li>
                    <li>{t('tiers.proFeature3')}</li>
                    <li>{t('tiers.proFeature4')}</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* Action */}
          <button className="onboarding-btn" onClick={goNext}>
            {step === TOTAL_STEPS - 1 ? t('begin') : step === 3 ? (selectedInterests.length > 0 ? t('continue') : t('skip')) : t('continue')}
            <IconArrowRight size={16} />
          </button>

          {/* Skip */}
          {step < TOTAL_STEPS - 1 && (
            <button
              className="onboarding-skip"
              onClick={() => onComplete(selectedInterests.length > 0 ? selectedInterests : undefined)}
            >
              {t('skipIntro')}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
