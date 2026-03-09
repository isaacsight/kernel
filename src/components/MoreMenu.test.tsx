import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoreMenu } from './MoreMenu'

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, onClick, className, ...rest }: any) => (
      <div className={className} onClick={onClick} data-testid={className}>
        {children}
      </div>
    ),
  },
  useDragControls: () => ({ start: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const t: Record<string, string> = {
        'menu.theme': 'Theme',
        'menu.themeLight': 'Light',
        'menu.themeDark': 'Dark',
        'menu.themeEink': 'E-ink',
        'menu.accountSettings': 'Account Settings',
        'menu.signOut': 'Sign Out',
        'menu.manageSubscription': 'Manage Subscription',
        'language': 'Language',
        'account': 'Account',
      }
      return t[key] || opts?.defaultValue || key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

describe('MoreMenu', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onUpgrade: vi.fn(),
    isPro: false,
    isAdmin: false,
  }

  beforeEach(() => vi.clearAllMocks())

  it('returns null when closed', () => {
    const { container } = render(<MoreMenu {...baseProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders language picker', () => {
    render(<MoreMenu {...baseProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('shows theme switcher when onSetTheme provided', () => {
    render(<MoreMenu {...baseProps} theme="light" onSetTheme={vi.fn()} />)
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('E-ink')).toBeInTheDocument()
  })

  it('calls onSetTheme when theme option clicked', () => {
    const onSetTheme = vi.fn()
    render(<MoreMenu {...baseProps} theme="light" onSetTheme={onSetTheme} />)
    fireEvent.click(screen.getByText('Dark'))
    expect(onSetTheme).toHaveBeenCalledWith('dark')
  })

  it('shows upgrade plans for free users', () => {
    render(<MoreMenu {...baseProps} isPro={false} />)
    expect(screen.getByText('Upgrade')).toBeInTheDocument()
    expect(screen.getAllByText('Pro')).toHaveLength(1)
  })

  it('hides upgrade plans for Pro users', () => {
    render(<MoreMenu {...baseProps} isPro={true} />)
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument()
  })

  it('calls onUpgrade and onClose when plan card clicked', () => {
    render(<MoreMenu {...baseProps} isPro={false} />)
    const proButtons = screen.getAllByText('Pro')
    fireEvent.click(proButtons[0].closest('button')!)
    expect(baseProps.onUpgrade).toHaveBeenCalledWith('pro')
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('always shows Account Settings and Sign Out', () => {
    render(<MoreMenu {...baseProps} />)
    expect(screen.getByText('Account Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('shows Manage Subscription when subscribed', () => {
    render(<MoreMenu {...baseProps} isPro={true} isSubscribed={true} />)
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument()
  })

  it('hides Manage Subscription when not subscribed', () => {
    render(<MoreMenu {...baseProps} isPro={false} />)
    expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument()
  })

  it('calls onSelect and onClose when Account Settings clicked', () => {
    render(<MoreMenu {...baseProps} />)
    fireEvent.click(screen.getByText('Account Settings'))
    expect(baseProps.onSelect).toHaveBeenCalledWith('account-settings')
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('calls onSelect and onClose when Sign Out clicked', () => {
    render(<MoreMenu {...baseProps} />)
    fireEvent.click(screen.getByText('Sign Out'))
    expect(baseProps.onSelect).toHaveBeenCalledWith('sign-out')
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('calls onClose when overlay clicked', () => {
    render(<MoreMenu {...baseProps} />)
    fireEvent.click(screen.getByTestId('ka-more-overlay'))
    expect(baseProps.onClose).toHaveBeenCalled()
  })
})
