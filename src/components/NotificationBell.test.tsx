import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

// Mock Supabase
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: '1', title: 'Test', body: 'Body', type: 'info', read: false, created_at: new Date().toISOString(), action_url: null },
            { id: '2', title: 'Clickable', body: 'Has URL', type: 'info', read: true, created_at: new Date().toISOString(), action_url: '#/goals' },
          ],
        }),
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({}) }),
})

vi.mock('../engine/SupabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

vi.mock('../engine/Scheduler', () => ({
  subscribeToNotifications: () => () => {},
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const t: Record<string, string> = {
        'aria.notifications': 'Notifications',
        'notifications.title': 'Notifications',
        'notifications.markAllRead': 'Mark all read',
        'notifications.empty': 'No notifications yet',
      }
      return t[key] || key
    },
  }),
}))

vi.mock('../hooks/useNotificationPrefs', () => ({
  useNotificationPrefs: () => ({
    shouldShow: () => true,
  }),
}))

describe('NotificationBell', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders bell button with aria-label', async () => {
    render(<NotificationBell userId="u1" />)
    const btn = screen.getByLabelText('Notifications')
    expect(btn).toBeInTheDocument()
  })

  it('shows unread badge', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('opens dropdown on click', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('clickable notifications have role="button" and tabIndex', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))

    const clickableItem = screen.getByText('Clickable').closest('[role="button"]')
    expect(clickableItem).toBeInTheDocument()
    expect(clickableItem).toHaveAttribute('tabindex', '0')
  })

  it('clickable notifications respond to Enter key', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))

    const clickableItem = screen.getByText('Clickable').closest('[role="button"]')!
    fireEvent.keyDown(clickableItem, { key: 'Enter' })
    // Should navigate — hash should be set
    expect(window.location.hash).toBe('#/goals')
  })

  it('clickable notifications respond to Space key', async () => {
    window.location.hash = ''
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))

    const clickableItem = screen.getByText('Clickable').closest('[role="button"]')!
    fireEvent.keyDown(clickableItem, { key: ' ' })
    expect(window.location.hash).toBe('#/goals')
  })

  it('non-clickable notifications have no role or tabIndex', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))

    const nonClickableItem = screen.getByText('Test').closest('.ka-notif-item')
    expect(nonClickableItem).not.toHaveAttribute('role')
    expect(nonClickableItem).not.toHaveAttribute('tabindex')
  })
})
