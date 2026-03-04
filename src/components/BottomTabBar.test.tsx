import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomTabBar } from './BottomTabBar'

vi.mock('../hooks/useMiniPhone', () => ({
  useMiniPhone: vi.fn(() => false),
}))

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
    render(<BottomTabBar activeTab="files" onTabChange={onTabChange} />)

    const filesTab = screen.getByRole('tab', { name: 'Files' })
    expect(filesTab).toHaveAttribute('aria-selected', 'true')
    expect(filesTab.className).toContain('ka-tab-item--active')

    const homeTab = screen.getByRole('tab', { name: 'Home' })
    expect(homeTab).toHaveAttribute('aria-selected', 'false')
    expect(homeTab.className).not.toContain('ka-tab-item--active')
  })

  it('calls onTabChange with correct tab id on click', async () => {
    const user = userEvent.setup()
    render(<BottomTabBar activeTab="home" onTabChange={onTabChange} />)

    await user.click(screen.getByRole('tab', { name: 'Gallery' }))
    expect(onTabChange).toHaveBeenCalledWith('gallery')

    await user.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(onTabChange).toHaveBeenCalledWith('settings')
  })

  it('shows active dot only on active tab', () => {
    const { container } = render(
      <BottomTabBar activeTab="chats" onTabChange={onTabChange} />
    )

    const dots = container.querySelectorAll('.ka-tab-dot')
    expect(dots).toHaveLength(1)
  })

  it('filters to 3 tabs in mini phone mode', async () => {
    const { useMiniPhone } = await import('../hooks/useMiniPhone')
    vi.mocked(useMiniPhone).mockReturnValue(true)

    render(<BottomTabBar activeTab="home" onTabChange={onTabChange} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Chats' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Files' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Gallery' })).not.toBeInTheDocument()
  })
})
