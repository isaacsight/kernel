import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, MessageSquare, Brain, Users } from 'lucide-react'

interface OnboardingFlowProps {
  onComplete: () => void
  userName?: string
}

const STEPS = [
  {
    icon: <Sparkles size={28} />,
    title: 'Welcome to Kernel',
    subtitle: 'Your sovereign AI, built for you.',
    body: 'Kernel is an AI engine that learns who you are, remembers what matters to you, and gets better with every conversation.',
  },
  {
    icon: <Brain size={28} />,
    title: 'It Learns You',
    subtitle: 'Memory that compounds.',
    body: 'As you talk, Kernel builds a profile of your interests, goals, and communication style. Every conversation makes the next one better.',
  },
  {
    icon: <Users size={28} />,
    title: 'Specialist Agents',
    subtitle: 'The right mind for the job.',
    body: 'Your messages are routed to specialist agents — a researcher for deep questions, a coder for technical work, a writer for creative tasks. The Kernel decides who handles what.',
  },
  {
    icon: <MessageSquare size={28} />,
    title: 'Start a Conversation',
    subtitle: 'Say anything.',
    body: 'Ask a question, share an idea, or just say hello. There are no wrong starts here.',
  },
]

export function OnboardingFlow({ onComplete, userName }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="ka-gate">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="ka-gate-card onboarding-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Progress dots */}
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="onboarding-icon">{current.icon}</div>

          {/* Content */}
          <h1 className="ka-gate-title" style={{ marginBottom: 4 }}>
            {step === 0 && userName ? `Welcome, ${userName.split('@')[0]}` : current.title}
          </h1>
          <p className="onboarding-subtitle">{current.subtitle}</p>
          <p className="onboarding-body">{current.body}</p>

          {/* Action */}
          <button
            className="onboarding-btn"
            onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
          >
            {isLast ? 'Begin' : 'Continue'}
            <ArrowRight size={16} />
          </button>

          {/* Skip */}
          {!isLast && (
            <button className="onboarding-skip" onClick={onComplete}>
              Skip intro
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
