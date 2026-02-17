import { useState, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { Sparkles, ArrowRight, MessageSquare, Brain, Users, Crown, Check } from 'lucide-react'

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
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
        >
          {/* Progress dots */}
          <div className="onboarding-dots">
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
              <div className="onboarding-icon"><Sparkles size={28} /></div>
              <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>
                {userName ? `Welcome, ${userName.split('@')[0]}` : 'Welcome to Kernel'}
              </h1>
              <p className="onboarding-subtitle">Your sovereign AI, built for you.</p>
              <p className="onboarding-body">
                Kernel is an AI engine that learns who you are, remembers what matters to you,
                and gets better with every conversation.
              </p>
            </>
          )}

          {/* Step 1: Memory */}
          {step === 1 && (
            <>
              <div className="onboarding-icon"><Brain size={28} /></div>
              <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>It Learns You</h1>
              <p className="onboarding-subtitle">Memory that compounds.</p>
              <p className="onboarding-body">
                As you talk, Kernel builds a knowledge graph of your interests, goals,
                and relationships. Every conversation makes the next one better.
              </p>
            </>
          )}

          {/* Step 2: Agents */}
          {step === 2 && (
            <>
              <div className="onboarding-icon"><Users size={28} /></div>
              <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>Specialist Agents</h1>
              <p className="onboarding-subtitle">The right mind for the job.</p>
              <p className="onboarding-body">
                Your messages are routed to specialist agents — a researcher for deep questions,
                a coder for technical work, a writer for creative tasks.
              </p>
            </>
          )}

          {/* Step 3: Interest Picker */}
          {step === 3 && (
            <>
              <div className="onboarding-icon"><MessageSquare size={28} /></div>
              <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>What interests you?</h1>
              <p className="onboarding-subtitle">Pick a few to help Kernel get to know you.</p>
              <div className="onboarding-interests">
                {INTERESTS.map(interest => (
                  <button
                    key={interest.id}
                    className={`onboarding-interest${selectedInterests.includes(interest.id) ? ' onboarding-interest--selected' : ''}`}
                    onClick={() => toggleInterest(interest.id)}
                  >
                    <span>{interest.emoji}</span>
                    <span>{interest.label}</span>
                    {selectedInterests.includes(interest.id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Free vs Pro + Begin */}
          {step === 4 && (
            <>
              <div className="onboarding-icon"><Crown size={28} /></div>
              <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>Ready to go</h1>
              <p className="onboarding-subtitle">Start free, upgrade anytime.</p>
              <div className="onboarding-tiers">
                <div className="onboarding-tier">
                  <span className="onboarding-tier-name">Free</span>
                  <ul className="onboarding-tier-features">
                    <li>10 messages</li>
                    <li>Basic agents</li>
                    <li>Memory</li>
                  </ul>
                </div>
                <div className="onboarding-tier onboarding-tier--pro">
                  <span className="onboarding-tier-name">Pro</span>
                  <ul className="onboarding-tier-features">
                    <li>Unlimited messages</li>
                    <li>Deep research</li>
                    <li>Multi-agent swarms</li>
                    <li>Knowledge graph</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* Action */}
          <button className="onboarding-btn" onClick={goNext}>
            {step === TOTAL_STEPS - 1 ? 'Begin' : step === 3 ? (selectedInterests.length > 0 ? 'Continue' : 'Skip') : 'Continue'}
            <ArrowRight size={16} />
          </button>

          {/* Skip */}
          {step < TOTAL_STEPS - 1 && (
            <button
              className="onboarding-skip"
              onClick={() => onComplete(selectedInterests.length > 0 ? selectedInterests : undefined)}
            >
              Skip intro
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
