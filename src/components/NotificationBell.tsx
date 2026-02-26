// ─── NotificationBell ────────────────────────────────────
//
// Header icon with unread count and notification dropdown.
// Supports proactive "Kernel noticed..." notifications with
// distinct styling and click-to-chat behavior.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBell, IconClose, IconSparkles } from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { subscribeToNotifications, type Notification } from '../engine/Scheduler'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'

interface NotificationBellProps {
  userId: string
  onProactiveClick?: (insightText: string) => void
}

export function NotificationBell({ userId, onProactiveClick }: NotificationBellProps) {
  const { t } = useTranslation('common')
  const { shouldShow } = useNotificationPrefs()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load notifications
  useEffect(() => {
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const notifs = (data || []) as Notification[]
        setNotifications(notifs)
        setUnreadCount(notifs.filter(n => !n.read).length)
      })
  }, [userId])

  // Subscribe to real-time new notifications
  useEffect(() => {
    return subscribeToNotifications(userId, (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 20))
      setUnreadCount(prev => prev + 1)
    })
  }, [userId])

  // Auto-mark all as read when dropdown opens
  useEffect(() => {
    if (!isOpen || unreadCount === 0) return
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      })
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [isOpen])

  const dismissOne = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDismissing(prev => new Set(prev).add(id))
    // Wait for CSS fade-out
    setTimeout(async () => {
      await supabase.from('notifications').delete().eq('id', id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setDismissing(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 200)
  }, [])

  const clearAll = useCallback(async () => {
    const ids = notifications.map(n => n.id)
    if (ids.length === 0) return
    setDismissing(new Set(ids))
    setTimeout(async () => {
      await supabase.from('notifications').delete().in('id', ids)
      setNotifications([])
      setUnreadCount(0)
      setDismissing(new Set())
    }, 200)
  }, [notifications])

  const handleNotificationClick = useCallback((n: Notification) => {
    // Proactive notifications open a new chat with the insight
    if (n.type === 'proactive' && n.proactive_trigger && onProactiveClick) {
      onProactiveClick(n.proactive_trigger)
      setIsOpen(false)
      return
    }

    // Default action_url handling
    if (n.action_url) {
      if (n.action_url.startsWith('#') || n.action_url.startsWith('/')) {
        window.location.hash = n.action_url.startsWith('#') ? n.action_url : `#${n.action_url}`
      } else {
        window.open(n.action_url, '_blank', 'noopener')
      }
      setIsOpen(false)
    }
  }, [onProactiveClick])

  const isClickable = (n: Notification) =>
    (n.type === 'proactive' && n.proactive_trigger && onProactiveClick) || n.action_url

  const visible = notifications.filter(n => shouldShow(n.type))

  return (
    <div className="ka-notif-wrap" ref={dropdownRef}>
      <button
        className="ka-header-icon-btn ka-notif-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('aria.notifications')}
      >
        <IconBell size={16} />
        {unreadCount > 0 && (
          <span className="ka-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="ka-notif-dropdown">
          <div className="ka-notif-dropdown-header">
            <span>{t('notifications.title')}</span>
            {visible.length > 0 && (
              <button className="ka-notif-clear-all" onClick={clearAll}>
                {t('notifications.clearAll', 'Clear all')}
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <div className="ka-notif-empty">{t('notifications.empty')}</div>
          ) : (
            <div className="ka-notif-list">
              {visible.map(n => (
                <div
                  key={n.id}
                  className={`ka-notif-item${isClickable(n) ? ' ka-notif-item--clickable' : ''}${n.type === 'proactive' ? ' ka-notif-proactive' : ''}${dismissing.has(n.id) ? ' ka-notif-item--dismissing' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={isClickable(n) ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } } : undefined}
                  role={isClickable(n) ? 'button' : undefined}
                  tabIndex={isClickable(n) ? 0 : undefined}
                >
                  <div className="ka-notif-item-content">
                    <div className="ka-notif-item-title">
                      {n.type === 'proactive' && <IconSparkles size={12} className="ka-notif-proactive-icon" />}
                      {n.title}
                    </div>
                    {n.body && <div className="ka-notif-item-body">{n.body}</div>}
                    <div className="ka-notif-item-time">
                      {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    className="ka-notif-dismiss"
                    onClick={(e) => dismissOne(e, n.id)}
                    aria-label="Dismiss"
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
