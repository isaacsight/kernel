// ─── NotificationBell ────────────────────────────────────
//
// Header icon with unread count and notification dropdown.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBell, IconCheck } from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { subscribeToNotifications, type Notification } from '../engine/Scheduler'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { t } = useTranslation('common')
  const { shouldShow } = useNotificationPrefs()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
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

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [notifications])

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
            {unreadCount > 0 && (
              <button className="ka-notif-mark-read" onClick={markAllRead}>
                <IconCheck size={12} /> {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {notifications.filter(n => shouldShow(n.type)).length === 0 ? (
            <div className="ka-notif-empty">{t('notifications.empty')}</div>
          ) : (
            <div className="ka-notif-list">
              {notifications.filter(n => shouldShow(n.type)).map(n => (
                <div
                  key={n.id}
                  className={`ka-notif-item${n.read ? '' : ' ka-notif-item--unread'}${n.action_url ? ' ka-notif-item--clickable' : ''}`}
                  onClick={() => {
                    if (n.action_url) {
                      if (n.action_url.startsWith('#') || n.action_url.startsWith('/')) {
                        window.location.hash = n.action_url.startsWith('#') ? n.action_url : `#${n.action_url}`
                      } else {
                        window.open(n.action_url, '_blank', 'noopener')
                      }
                      setIsOpen(false)
                    }
                  }}
                  onKeyDown={n.action_url ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } } : undefined}
                  role={n.action_url ? 'button' : undefined}
                  tabIndex={n.action_url ? 0 : undefined}
                >
                  <div className="ka-notif-item-title">{n.title}</div>
                  {n.body && <div className="ka-notif-item-body">{n.body}</div>}
                  <div className="ka-notif-item-time">
                    {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
