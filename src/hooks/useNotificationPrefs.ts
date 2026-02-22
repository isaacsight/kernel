import { useState, useCallback } from 'react'

export interface NotificationPrefs {
  inApp: boolean
  briefings: boolean
  goals: boolean
  reminders: boolean
}

const STORAGE_KEY = 'kernel-notification-prefs'

const DEFAULTS: NotificationPrefs = {
  inApp: true,
  briefings: true,
  goals: true,
  reminders: true,
}

function load(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(load)

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const shouldShow = useCallback((type: string): boolean => {
    if (!prefs.inApp) return false
    if (type === 'briefing' && !prefs.briefings) return false
    if (type === 'goal' && !prefs.goals) return false
    if (type === 'reminder' && !prefs.reminders) return false
    return true
  }, [prefs])

  return { prefs, update, shouldShow }
}
