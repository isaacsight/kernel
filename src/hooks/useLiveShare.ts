import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, getAccessToken } from '../engine/SupabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const LIVE_SHARE_ENDPOINT = `${SUPABASE_URL}/functions/v1/live-share`

export interface LiveShareParticipant {
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
  online?: boolean
}

export interface LiveShareState {
  shareId: string | null
  accessCode: string | null
  conversationId: string | null
  isActive: boolean
  participants: LiveShareParticipant[]
}

interface UseLiveShareReturn {
  state: LiveShareState
  create: (conversationId: string) => Promise<string | null>
  join: (accessCode: string) => Promise<string | null>
  kick: (userId: string) => Promise<void>
  revoke: () => Promise<void>
  refresh: () => Promise<void>
  onNewMessage: (callback: (msg: any) => void) => void
}

async function callLiveShare(action: string, params: Record<string, any> = {}) {
  const token = await getAccessToken()
  const res = await fetch(LIVE_SHARE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...params }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || `Live share request failed (${res.status})`)
  }

  return res.json()
}

export function useLiveShare(userId: string | null): UseLiveShareReturn {
  const [state, setState] = useState<LiveShareState>({
    shareId: null,
    accessCode: null,
    conversationId: null,
    isActive: false,
    participants: [],
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const messageCallbackRef = useRef<((msg: any) => void) | null>(null)

  // Cleanup realtime channel on unmount or share change
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // Subscribe to realtime when share is active
  useEffect(() => {
    if (!state.shareId || !state.isActive || !userId) return

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel(`live:${state.shareId}`, {
      config: { presence: { key: userId } },
    })

    // Track presence
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState()
      setState(prev => ({
        ...prev,
        participants: prev.participants.map(p => ({
          ...p,
          online: Object.values(presenceState).flat().some(
            (ps: any) => ps.user_id === p.user_id
          ),
        })),
      }))
    })

    // Listen for new messages via postgres_changes
    channel.on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${state.conversationId}` },
      (payload: any) => {
        if (messageCallbackRef.current) {
          messageCallbackRef.current(payload.new)
        }
      }
    )

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() })
      }
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [state.shareId, state.isActive, state.conversationId, userId])

  const create = useCallback(async (conversationId: string): Promise<string | null> => {
    try {
      const result = await callLiveShare('create', { conversation_id: conversationId })
      const share = result.share
      setState({
        shareId: share.id,
        accessCode: share.access_code,
        conversationId,
        isActive: true,
        participants: [{ user_id: userId!, role: 'owner', joined_at: new Date().toISOString(), online: true }],
      })
      return share.access_code
    } catch (err) {
      console.error('Failed to create live share:', err)
      return null
    }
  }, [userId])

  const join = useCallback(async (accessCode: string): Promise<string | null> => {
    try {
      const result = await callLiveShare('join', { access_code: accessCode })
      setState({
        shareId: result.share_id,
        accessCode,
        conversationId: result.conversation_id,
        isActive: true,
        participants: [],
      })
      return result.conversation_id
    } catch (err) {
      console.error('Failed to join live share:', err)
      return null
    }
  }, [])

  const kick = useCallback(async (targetUserId: string) => {
    if (!state.shareId) return
    try {
      await callLiveShare('kick', { share_id: state.shareId, user_id: targetUserId })
      setState(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.user_id !== targetUserId),
      }))
    } catch (err) {
      console.error('Failed to kick participant:', err)
    }
  }, [state.shareId])

  const revoke = useCallback(async () => {
    if (!state.shareId) return
    try {
      await callLiveShare('revoke', { share_id: state.shareId })
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setState({
        shareId: null,
        accessCode: null,
        conversationId: null,
        isActive: false,
        participants: [],
      })
    } catch (err) {
      console.error('Failed to revoke live share:', err)
    }
  }, [state.shareId])

  const refresh = useCallback(async () => {
    if (!state.shareId) return
    try {
      const result = await callLiveShare('status', { share_id: state.shareId })
      setState(prev => ({
        ...prev,
        isActive: result.share.is_active,
        participants: result.participants,
      }))
    } catch (err) {
      console.error('Failed to refresh live share:', err)
    }
  }, [state.shareId])

  const onNewMessage = useCallback((callback: (msg: any) => void) => {
    messageCallbackRef.current = callback
  }, [])

  return { state, create, join, kick, revoke, refresh, onNewMessage }
}
