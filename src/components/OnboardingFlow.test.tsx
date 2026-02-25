import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { OnboardingFlow } from './OnboardingFlow'

// ─── Mocks ──────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.name) return key.replace('{{name}}', opts.name)
      return key
    },
  }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <div {...safe}>{children}</div>
    },
    button: ({ children, style, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <button {...safe}>{children}</button>
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('../agents/specialists', () => ({
  SPECIALISTS: {
    kernel: { id: 'kernel', name: 'Kernel', icon: 'K', emblem: 'concepts/emblem-kernel.svg', color: '#6B5B95' },
    researcher: { id: 'researcher', name: 'Researcher', icon: 'R', emblem: 'concepts/emblem-researcher.svg', color: '#5B8BA0' },
    coder: { id: 'coder', name: 'Coder', icon: 'C', emblem: 'concepts/emblem-coder.svg', color: '#6B8E6B' },
    writer: { id: 'writer', name: 'Writer', icon: 'W', emblem: 'concepts/emblem-writer.svg', color: '#B8875C' },
    analyst: { id: 'analyst', name: 'Analyst', icon: 'A', emblem: 'concepts/emblem-analyst.svg', color: '#A0768C' },
  },
}))

vi.mock('./KernelIcons', () => ({
  IconArrowRight: ({ size }: any) => <span data-testid="icon-arrow" data-size={size} />,
  IconCheck: ({ size }: any) => <span data-testid="icon-check" data-size={size} />,
}))

// Filter out framer-motion specific props
function filterMotionProps(props: Record<string, any>) {
  const filtered: Record<string, any> = {}
  const skip = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants', 'custom',
    'drag', 'dragConstraints', 'dragElastic', 'onDragEnd',
    'whileHover', 'whileTap', 'layout',
  ])
  for (const [key, value] of Object.entries(props)) {
    if (!skip.has(key)) filtered[key] = value
  }
  return filtered
}

// ─── Helpers ────────────────────────────────────────────

function renderOnboarding(props: Partial<Parameters<typeof OnboardingFlow>[0]> = {}) {
  const onComplete = vi.fn()
  const result = render(
    <OnboardingFlow onComplete={onComplete} {...props} />
  )
  return { ...result, onComplete }
}

// Flush all pending timers and React state updates.
// Each act(runAllTimers) fires pending timers, which triggers state updates,
// which triggers effects that schedule new timers. Repeat until stable.
async function flushTimers(iterations = 10) {
  for (let i = 0; i < iterations; i++) {
    await act(async () => {
      vi.runAllTimers()
    })
  }
}

// ─── Tests ──────────────────────────────────────────────

describe('OnboardingFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ─── Stage: Welcome ────────────────────────────

  it('renders the onboarding page with skip link', () => {
    renderOnboarding()
    expect(screen.getByText('skipIntro')).toBeInTheDocument()
    expect(screen.getByAltText('Kernel')).toBeInTheDocument()
  })

  it('shows typing indicator during message sequence', async () => {
    renderOnboarding()
    // First: advance past idle delay to trigger welcome stage
    await act(async () => {
      vi.advanceTimersByTime(850)
    })
    // Then: advance into the queueMessages typing phase
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    // Typing indicator should be visible now
    const typingDots = document.querySelectorAll('.ka-typing span')
    expect(typingDots.length).toBe(3)
  })

  it('shows welcome messages after timer flush', async () => {
    renderOnboarding()
    await flushTimers()
    expect(screen.getByText('welcome.greeting')).toBeInTheDocument()
    expect(screen.getByText('welcome.intro')).toBeInTheDocument()
  })

  it('uses userName in greeting when provided', async () => {
    renderOnboarding({ userName: 'alice@example.com' })
    await flushTimers()
    expect(screen.getByText('welcome.greetingUser')).toBeInTheDocument()
  })

  it('shows quick replies after welcome messages', async () => {
    renderOnboarding()
    await flushTimers()
    expect(screen.getByText('replies.whatCanYouDo')).toBeInTheDocument()
    expect(screen.getByText('replies.tellMeMore')).toBeInTheDocument()
    expect(screen.getByText('replies.letsStart')).toBeInTheDocument()
  })

  // ─── Stage: Capabilities ───────────────────────

  it('transitions to capabilities on quick reply click', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.whatCanYouDo'))
    await flushTimers()

    expect(screen.getByText('capabilities.agents')).toBeInTheDocument()
    expect(screen.getByText('capabilities.agentsDetail')).toBeInTheDocument()
  })

  it('shows agent showcase with 5 agents', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.whatCanYouDo'))
    await flushTimers()

    expect(screen.getByText('Kernel')).toBeInTheDocument()
    expect(screen.getByText('Researcher')).toBeInTheDocument()
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText('Writer')).toBeInTheDocument()
    expect(screen.getByText('Analyst')).toBeInTheDocument()
  })

  it('shows capabilities quick replies', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.whatCanYouDo'))
    await flushTimers()

    expect(screen.getByText('replies.thatsCool')).toBeInTheDocument()
    expect(screen.getByText('replies.howMemory')).toBeInTheDocument()
    expect(screen.getByText('replies.skipToChat')).toBeInTheDocument()
  })

  // ─── Stage: Interests ─────────────────────────

  it('skips capabilities when "Let\'s just start" is selected', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    // Should go to interests directly
    expect(screen.getByText('interests.prompt')).toBeInTheDocument()
    // Should NOT show capabilities
    expect(screen.queryByText('capabilities.agents')).not.toBeInTheDocument()
  })

  it('shows interest picker with 12 options', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(12)
  })

  it('allows multi-select on interest pills', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    const techBtn = screen.getByRole('checkbox', { name: /interests.tech/i })
    const scienceBtn = screen.getByRole('checkbox', { name: /interests.science/i })

    fireEvent.click(techBtn)
    expect(techBtn).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(scienceBtn)
    expect(scienceBtn).toHaveAttribute('aria-checked', 'true')

    // Deselect tech
    fireEvent.click(techBtn)
    expect(techBtn).toHaveAttribute('aria-checked', 'false')
  })

  it('shows Continue button after selecting 1+ interest', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    // No Continue button before selection
    expect(screen.queryByText('continue')).not.toBeInTheDocument()

    // Select an interest
    fireEvent.click(screen.getByRole('checkbox', { name: /interests.design/i }))

    // Continue button should appear
    expect(screen.getByText('continue')).toBeInTheDocument()
  })

  // ─── Stage: Ready ─────────────────────────────

  it('transitions to ready after interests confirmed', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    fireEvent.click(screen.getByRole('checkbox', { name: /interests.tech/i }))
    fireEvent.click(screen.getByText('continue'))
    await flushTimers()

    expect(screen.getByText('ready.noted')).toBeInTheDocument()
    expect(screen.getByText('ready.freeMessages')).toBeInTheDocument()
    expect(screen.getByText('ready.startCta')).toBeInTheDocument()
  })

  // ─── onComplete ───────────────────────────────

  it('calls onComplete with selected interests on Start', async () => {
    const { onComplete } = renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    fireEvent.click(screen.getByRole('checkbox', { name: /interests.tech/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /interests.coding/i }))
    fireEvent.click(screen.getByText('continue'))
    await flushTimers()

    fireEvent.click(screen.getByText('ready.startCta'))
    expect(onComplete).toHaveBeenCalledWith(['tech', 'coding'])
  })

  it('calls onComplete without interests on skip', () => {
    const { onComplete } = renderOnboarding()
    fireEvent.click(screen.getByText('skipIntro'))
    expect(onComplete).toHaveBeenCalledWith(undefined)
  })

  it('calls onComplete with interests on skip if some were selected', async () => {
    const { onComplete } = renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    fireEvent.click(screen.getByRole('checkbox', { name: /interests.music/i }))
    fireEvent.click(screen.getByText('skipIntro'))

    expect(onComplete).toHaveBeenCalledWith(['music'])
  })

  // ─── Accessibility ────────────────────────────

  it('has role="log" and aria-live on chat container', () => {
    renderOnboarding()
    const chatContainer = document.querySelector('.ka-onb-chat')
    expect(chatContainer).toHaveAttribute('role', 'log')
    expect(chatContainer).toHaveAttribute('aria-live', 'polite')
  })

  it('quick replies have role="group"', async () => {
    renderOnboarding()
    await flushTimers()

    const group = screen.getByRole('group')
    expect(group).toBeInTheDocument()
  })

  it('interest pills have role="checkbox" and aria-checked', async () => {
    renderOnboarding()
    await flushTimers()

    fireEvent.click(screen.getByText('replies.letsStart'))
    await flushTimers()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(12)
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true')
  })

  // ─── Interface Contract ───────────────────────

  it('preserves existing interface: onComplete receives string[] or undefined', () => {
    const { onComplete } = renderOnboarding()

    fireEvent.click(screen.getByText('skipIntro'))
    const call = onComplete.mock.calls[0][0]
    expect(call === undefined || Array.isArray(call)).toBe(true)
  })

  // ─── Full Flow ────────────────────────────────

  it('completes full welcome → capabilities → interests → ready flow', async () => {
    const { onComplete } = renderOnboarding({ userName: 'test@example.com' })
    await flushTimers()

    // Welcome → capabilities
    fireEvent.click(screen.getByText('replies.tellMeMore'))
    await flushTimers()

    // Capabilities → interests
    fireEvent.click(screen.getByText('replies.thatsCool'))
    await flushTimers()

    // Pick interests → continue
    fireEvent.click(screen.getByRole('checkbox', { name: /interests.science/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /interests.philosophy/i }))
    fireEvent.click(screen.getByText('continue'))
    await flushTimers()

    // Start
    fireEvent.click(screen.getByText('ready.startCta'))
    expect(onComplete).toHaveBeenCalledWith(['science', 'philosophy'])
  })
})
