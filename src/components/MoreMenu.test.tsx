import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoreMenu } from './MoreMenu'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...rest }: any) => (
      <div className={className} onClick={onClick} data-testid={className}>
        {children}
      </div>
    ),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const t: Record<string, string> = {
        'menu.workflows': 'Workflows',
        'menu.scheduledTasks': 'Scheduled Tasks',
        'menu.whatKernelKnows': 'What Kernel Knows',
        'menu.yourStats': 'Your Stats',
        'menu.insights': 'Insights',
        'menu.upgradeToPro': 'Upgrade to Pro',
        'menu.manageSubscription': 'Manage Subscription',
        'menu.signOut': 'Sign Out',
        'menu.deleteAccount': 'Delete Account',
        'menu.notifications': 'Notifications',
        'menu.notifInApp': 'In-app notifications',
        'menu.notifBriefings': 'Briefing alerts',
        'menu.notifGoals': 'Goal updates',
        'menu.notifReminders': 'Reminders',
        'features': 'Features',
        'language': 'Language',
        'account': 'Account',
      }
      return t[key] || key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../hooks/useNotificationPrefs', () => ({
  useNotificationPrefs: () => ({
    prefs: { inApp: true, briefings: true, goals: false, reminders: true },
    update: vi.fn(),
  }),
}))

vi.mock('lucide-react', () => {
  const icon = (props: any) => <svg {...props} />
  return {
    Zap: icon, Clock: icon, Brain: icon, BarChart3: icon, Eye: icon,
    Crown: icon, Settings: icon, LogOut: icon, Trash2: icon, Globe: icon,
  }
})

describe('MoreMenu', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    isPro: false,
    isAdmin: false,
  }

  beforeEach(() => vi.clearAllMocks())

  it('returns null when closed', () => {
    const { container } = render(<MoreMenu {...baseProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all 5 feature items', () => {
    render(<MoreMenu {...baseProps} />)

    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(screen.getByText('Scheduled Tasks')).toBeInTheDocument()
    expect(screen.getByText('What Kernel Knows')).toBeInTheDocument()
    expect(screen.getByText('Your Stats')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
  })

  it('calls onSelect + onClose when feature item clicked', () => {
    render(<MoreMenu {...baseProps} />)

    fireEvent.click(screen.getByText('Workflows'))
    expect(baseProps.onSelect).toHaveBeenCalledWith('workflows')
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('shows Upgrade for free users, hides for pro', () => {
    const { rerender } = render(<MoreMenu {...baseProps} isPro={false} />)
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument()

    rerender(<MoreMenu {...baseProps} isPro={true} isAdmin={false} />)
    expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument()
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument()
  })

  it('hides Manage Subscription for admins', () => {
    render(<MoreMenu {...baseProps} isPro={true} isAdmin={true} />)
    expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument()
  })

  it('always shows Sign Out and Delete Account', () => {
    render(<MoreMenu {...baseProps} />)
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
    expect(screen.getByText('Delete Account')).toBeInTheDocument()
  })

  it('applies danger class to Delete Account', () => {
    render(<MoreMenu {...baseProps} />)
    const deleteBtn = screen.getByText('Delete Account').closest('button')
    expect(deleteBtn?.className).toContain('ka-more-menu-item--danger')
  })

  it('renders language picker', () => {
    render(<MoreMenu {...baseProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('shows feature discovery dot when isNewFeature returns true', () => {
    const { container } = render(
      <MoreMenu {...baseProps} isNewFeature={(id) => id === 'insights'} />
    )
    const dots = container.querySelectorAll('.ka-feature-dot')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('calls onClose when overlay clicked', () => {
    render(<MoreMenu {...baseProps} />)
    fireEvent.click(screen.getByTestId('ka-more-overlay'))
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('renders notification preference toggles', () => {
    render(<MoreMenu {...baseProps} />)
    expect(screen.getByText('In-app notifications')).toBeInTheDocument()
    expect(screen.getByText('Briefing alerts')).toBeInTheDocument()
    expect(screen.getByText('Goal updates')).toBeInTheDocument()
    expect(screen.getByText('Reminders')).toBeInTheDocument()
  })

  it('toggles have role="switch" for accessibility', () => {
    render(<MoreMenu {...baseProps} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(4)
  })

  it('toggle states reflect notification prefs', () => {
    render(<MoreMenu {...baseProps} />)
    const switches = screen.getAllByRole('switch')
    // inApp: true, briefings: true, goals: false, reminders: true
    expect(switches[0]).toBeChecked() // inApp
    expect(switches[1]).toBeChecked() // briefings
    expect(switches[2]).not.toBeChecked() // goals
    expect(switches[3]).toBeChecked() // reminders
  })
})
