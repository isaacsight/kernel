// ─── Scheduler ───────────────────────────────────────────
//
// Client-side module for scheduled tasks.
// Calculates next run times and subscribes to notifications
// via Supabase real-time.

import { supabase } from './SupabaseClient'

export interface TaskSchedule {
  type: 'once' | 'daily' | 'weekdays' | 'weekly' | 'custom'
  time?: string      // HH:MM format
  dayOfWeek?: number // 0=Sunday for weekly
  cronExpr?: string  // for custom
}

export interface ScheduledTask {
  id?: string
  user_id: string
  title: string
  description: string
  task_type: 'reminder' | 'workflow' | 'briefing' | 'goal_checkin'
  schedule: TaskSchedule
  next_run_at: string
  is_active: boolean
  notification_channel: 'in_app' | 'email' | 'discord'
  config: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: 'info' | 'reminder' | 'task_complete' | 'briefing' | 'goal'
  read: boolean
  action_url: string | null
  created_at: string
}

/** Calculate the next run time based on schedule */
export function calculateNextRunAt(schedule: TaskSchedule, fromDate = new Date()): Date {
  const time = schedule.time || '09:00'
  const [hours, minutes] = time.split(':').map(Number)

  switch (schedule.type) {
    case 'once':
      // Next occurrence of the specified time
      const once = new Date(fromDate)
      once.setHours(hours, minutes, 0, 0)
      if (once <= fromDate) once.setDate(once.getDate() + 1)
      return once

    case 'daily': {
      const daily = new Date(fromDate)
      daily.setHours(hours, minutes, 0, 0)
      if (daily <= fromDate) daily.setDate(daily.getDate() + 1)
      return daily
    }

    case 'weekdays': {
      const wd = new Date(fromDate)
      wd.setHours(hours, minutes, 0, 0)
      if (wd <= fromDate) wd.setDate(wd.getDate() + 1)
      // Skip weekends
      while (wd.getDay() === 0 || wd.getDay() === 6) {
        wd.setDate(wd.getDate() + 1)
      }
      return wd
    }

    case 'weekly': {
      const weekly = new Date(fromDate)
      weekly.setHours(hours, minutes, 0, 0)
      const targetDay = schedule.dayOfWeek ?? 1 // Default Monday
      const daysUntil = (targetDay - fromDate.getDay() + 7) % 7
      weekly.setDate(weekly.getDate() + (daysUntil === 0 && weekly <= fromDate ? 7 : daysUntil))
      return weekly
    }

    default:
      // Fallback: tomorrow at specified time
      const fallback = new Date(fromDate)
      fallback.setDate(fallback.getDate() + 1)
      fallback.setHours(hours, minutes, 0, 0)
      return fallback
  }
}

/** Subscribe to real-time notifications for a user */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void,
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
