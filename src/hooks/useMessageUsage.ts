import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

interface MessageUsage {
  used: number
  limit: number
  loading: boolean
  refresh: () => void
}

/**
 * Fetches the user's daily message count from user_memory.
 * Returns used/limit for display in the input bar.
 */
export function useMessageUsage(userId: string | undefined, dailyLimit: number): MessageUsage {
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const { data } = await supabase
      .from('user_memory')
      .select('daily_message_count, daily_window_start')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      // If the stored window start is today, use the count. Otherwise it's a new day = 0.
      const storedDate = data.daily_window_start ? new Date(data.daily_window_start).toISOString().slice(0, 10) : null
      setUsed(storedDate === today ? (data.daily_message_count ?? 0) : 0)
    } else {
      setUsed(0)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  return { used, limit: dailyLimit, loading, refresh }
}
