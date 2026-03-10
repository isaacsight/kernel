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
        'menu.usage': 'Usage',
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

  it('always shows Account Settings, Usage, and Sign Out', () => {
    render(<MoreMenu {...baseProps} />)
    expect(screen.getByText('Account Settings')).toBeInTheDocument()
    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
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
