import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomTabBar } from './BottomTabBar'

vi.mock('../hooks/useMiniPhone', () => ({
  useMiniPhone: vi.fn(() => false),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return {
    ...actual,
    MessageSquare: (props: any) => <svg data-testid="icon-home" {...props} />,
    List: (props: any) => <svg data-testid="icon-chats" {...props} />,
    Target: (props: any) => <svg data-testid="icon-goals" {...props} />,
    Newspaper: (props: any) => <svg data-testid="icon-briefings" {...props} />,
    MoreHorizontal: (props: any) => <svg data-testid="icon-more" {...props} />,
  }
})

describe('BottomTabBar', () => {
  const onTabChange = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('renders all 5 tabs with correct ARIA roles', () => {
    render(<BottomTabBar activeTab="home" onTabChange={onTabChange} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Main navigation')
  })

  it('marks active tab with aria-selected and CSS class', () => {
    render(<BottomTabBar activeTab="goals" onTabChange={onTabChange} />)

    const goalsTab = screen.getByRole('tab', { name: 'Goals' })
    expect(goalsTab).toHaveAttribute('aria-selected', 'true')
    expect(goalsTab.className).toContain('ka-tab-item--active')

    const homeTab = screen.getByRole('tab', { name: 'Home' })
    expect(homeTab).toHaveAttribute('aria-selected', 'false')
    expect(homeTab.className).not.toContain('ka-tab-item--active')
  })

  it('calls onTabChange with correct tab id on click', async () => {
    const user = userEvent.setup()
    render(<BottomTabBar activeTab="home" onTabChange={onTabChange} />)

    await user.click(screen.getByRole('tab', { name: 'Briefings' }))
    expect(onTabChange).toHaveBeenCalledWith('briefings')

    await user.click(screen.getByRole('tab', { name: 'More' }))
    expect(onTabChange).toHaveBeenCalledWith('more')
  })

  it('shows undiscovered feature dot on More tab', () => {
    const { container } = render(
      <BottomTabBar activeTab="home" onTabChange={onTabChange} undiscoveredCount={3} />
    )

    const dot = container.querySelector('.ka-feature-dot--tab')
    expect(dot).toBeInTheDocument()
  })

  it('hides feature dot when undiscoveredCount is 0', () => {
    const { container } = render(
      <BottomTabBar activeTab="home" onTabChange={onTabChange} undiscoveredCount={0} />
    )

    const dot = container.querySelector('.ka-feature-dot--tab')
    expect(dot).not.toBeInTheDocument()
  })

  it('filters to 3 tabs in mini phone mode', async () => {
    const { useMiniPhone } = await import('../hooks/useMiniPhone')
    vi.mocked(useMiniPhone).mockReturnValue(true)

    render(<BottomTabBar activeTab="home" onTabChange={onTabChange} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(screen.queryByRole('tab', { name: 'Goals' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Briefings' })).not.toBeInTheDocument()
  })
})
