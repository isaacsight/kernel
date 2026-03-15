import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

interface MessageUsage {
  used: number
  limit: number
  loading: boolean
  refresh: () => void
}

/**
 * Fetches the user's monthly message count from user_memory.
 * Returns used/limit for display in the input bar.
 */
export function useMessageUsage(userId: string | undefined, monthlyLimit: number): MessageUsage {
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('user_memory')
      .select('monthly_message_count, monthly_window_start')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      // Check if we're still in the same billing month
      const now = new Date()
      const windowStart = data.monthly_window_start ? new Date(data.monthly_window_start) : null
      const sameMonth = windowStart
        && windowStart.getMonth() === now.getMonth()
        && windowStart.getFullYear() === now.getFullYear()
      setUsed(sameMonth ? (data.monthly_message_count ?? 0) : 0)
    } else {
      setUsed(0)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  return { used, limit: monthlyLimit, loading, refresh }
}
