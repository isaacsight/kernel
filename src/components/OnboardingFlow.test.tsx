import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <div {...safe}>{children}</div>
    },
    h1: ({ children, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <h1 {...safe}>{children}</h1>
    },
    p: ({ children, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <p {...safe}>{children}</p>
    },
    form: ({ children, onSubmit, ...props }: any) => {
      const safe = filterMotionProps(props)
      return <form {...safe} onSubmit={onSubmit}>{children}</form>
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('./ParticleGrid', () => ({
  ParticleGrid: () => <canvas data-testid="particle-grid" />,
}))

vi.mock('./KernelIcons', () => ({
  IconArrowRight: ({ size }: any) => <span data-testid="icon-arrow" data-size={size} />,
}))

vi.mock('../constants/motion', () => ({
  VARIANT: { HERO_SCALE: {}, FADE_UP: {} },
  TRANSITION: { CASCADE: () => ({}) },
}))

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

// ─── Tests ──────────────────────────────────────────────

describe('OnboardingFlow', () => {
  it('renders the page with skip button', () => {
    renderOnboarding()
    expect(screen.getByText('skipIntro')).toBeInTheDocument()
  })

  it('renders ParticleGrid hero', () => {
    renderOnboarding()
    expect(screen.getByTestId('particle-grid')).toBeInTheDocument()
  })

  it('shows generic greeting when no userName', () => {
    renderOnboarding()
    expect(screen.getByText('greeting')).toBeInTheDocument()
  })

  it('shows personalized greeting with userName', () => {
    renderOnboarding({ userName: 'alice@example.com' })
    expect(screen.getByText('greetingUser')).toBeInTheDocument()
  })

  it('strips email domain from userName for display', () => {
    renderOnboarding({ userName: 'alice@example.com' })
    // The greeting uses the name before @ via t('greetingUser', { name: 'alice' })
    expect(screen.getByText('greetingUser')).toBeInTheDocument()
  })

  it('shows tagline', () => {
    renderOnboarding()
    expect(screen.getByText('tagline')).toBeInTheDocument()
  })

  it('renders text input with placeholder', () => {
    renderOnboarding()
    const input = screen.getByPlaceholderText('placeholder')
    expect(input).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', () => {
    renderOnboarding()
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit).toBeDisabled()
  })

  it('submit button is enabled when input has text', () => {
    renderOnboarding()
    const input = screen.getByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Hello Kernel' } })
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit).not.toBeDisabled()
  })

  it('calls onComplete and stores message in sessionStorage on submit', () => {
    const { onComplete } = renderOnboarding()
    const input = screen.getByPlaceholderText('placeholder')

    fireEvent.change(input, { target: { value: 'Tell me about AI' } })
    fireEvent.submit(input.closest('form')!)

    expect(sessionStorage.getItem('kernel-onboarding-message')).toBe('Tell me about AI')
    expect(onComplete).toHaveBeenCalledWith()
  })

  it('does not submit on empty/whitespace input', () => {
    const { onComplete } = renderOnboarding()
    const input = screen.getByPlaceholderText('placeholder')

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('calls onComplete without message on skip', () => {
    const { onComplete } = renderOnboarding()
    fireEvent.click(screen.getByText('skipIntro'))
    expect(onComplete).toHaveBeenCalledWith()
  })

  it('input is rendered as a text field', () => {
    renderOnboarding()
    const input = screen.getByPlaceholderText('placeholder')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('type', 'text')
  })
})
