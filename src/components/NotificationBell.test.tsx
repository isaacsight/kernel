import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

// Chainable mock helper
const chain = (resolvedValue: unknown = {}) => {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {}
  const self = () => obj
  obj.select = vi.fn().mockReturnValue(self())
  obj.eq = vi.fn().mockReturnValue(self())
  obj.in = vi.fn().mockReturnValue(self())
  obj.order = vi.fn().mockReturnValue(self())
  obj.limit = vi.fn().mockResolvedValue(resolvedValue)
  obj.update = vi.fn().mockReturnValue(self())
  obj.delete = vi.fn().mockReturnValue(self())
  obj.then = vi.fn((cb: (v: unknown) => void) => { cb(resolvedValue); return Promise.resolve() })
  return obj
}

const testNotifs = [
  { id: '1', title: 'Test', body: 'Body', type: 'info', read: false, created_at: new Date().toISOString(), action_url: null },
  { id: '2', title: 'Clickable', body: 'Has URL', type: 'info', read: true, created_at: new Date().toISOString(), action_url: '#/goals' },
]

const mockChain = chain({ data: testNotifs })
const mockFrom = vi.fn().mockReturnValue(mockChain)

vi.mock('../engine/SupabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

vi.mock('../engine/Scheduler', () => ({
  subscribeToNotifications: () => () => {},
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const t: Record<string, string> = {
        'aria.notifications': 'Notifications',
        'notifications.title': 'Notifications',
        'notifications.clearAll': 'Clear all',
        'notifications.empty': 'No notifications yet',
      }
      return t[key] || fallback || key
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

  it('opens dropdown on click and shows notifications', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Clickable')).toBeInTheDocument()
  })

  it('shows clear all button when notifications exist', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  it('each notification has a dismiss button', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    const dismissBtns = screen.getAllByLabelText('Dismiss')
    expect(dismissBtns).toHaveLength(2)
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
