import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../engine/SupabaseClient'

interface DiscordLink {
  discord_id: string
  discord_username: string | null
  linked_at: string
}

interface DiscordLinkState {
  link: DiscordLink | null
  code: string | null
  codeExpiresAt: number | null
  loading: boolean
  error: string | null
}

const INITIAL: DiscordLinkState = {
  link: null,
  code: null,
  codeExpiresAt: null,
  loading: false,
  error: null,
}

export function useDiscordLink(userId: string | undefined) {
  const [state, setState] = useState<DiscordLinkState>(INITIAL)

  const refresh = useCallback(async () => {
    if (!userId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('discord_user_links')
      .select('discord_id, discord_username, linked_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      setState(s => ({ ...s, loading: false, error: error.message }))
      return
    }
    setState(s => ({ ...s, link: data ?? null, loading: false }))
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const generateCode = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const { data, error } = await supabase.functions.invoke<{ code: string; expires_in_seconds: number }>(
        'discord-link-code',
        { body: {} },
      )
      if (error || !data?.code) throw new Error(error?.message || 'Failed to generate code')
      setState(s => ({
        ...s,
        code: data.code,
        codeExpiresAt: Date.now() + data.expires_in_seconds * 1000,
        loading: false,
      }))
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [])

  const clearCode = useCallback(() => {
    setState(s => ({ ...s, code: null, codeExpiresAt: null }))
  }, [])

  const unlink = useCallback(async () => {
    if (!userId) return
    setState(s => ({ ...s, loading: true, error: null }))
    const { error } = await supabase
      .from('discord_user_links')
      .delete()
      .eq('user_id', userId)
    if (error) {
      setState(s => ({ ...s, loading: false, error: error.message }))
      return
    }
    setState(s => ({ ...s, link: null, loading: false }))
  }, [userId])

  return {
    link: state.link,
    code: state.code,
    codeExpiresAt: state.codeExpiresAt,
    loading: state.loading,
    error: state.error,
    refresh,
    generateCode,
    clearCode,
    unlink,
  }
}
