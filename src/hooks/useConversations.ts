import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getUserConversations,
  getChannelMessages,
  getLastAgentId,
  createConversation,
  deleteConversation,
  type DBConversation,
} from '../engine/SupabaseClient'
import {
  cacheConversations,
  cacheMessages,
  getCachedConversations,
  getCachedMessages,
} from '../engine/OfflineCache'

interface ChatMessage {
  id: string
  role: 'user' | 'kernel'
  content: string
  timestamp: number
  signalId?: string
  feedback?: 'helpful' | 'poor'
  attachments?: { name: string; type: string }[]
  agentId?: string
  agentName?: string
  isProactive?: boolean
}

export function useConversations(
  userId: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  historyDays?: number | null,
) {
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [convsLoading, setConvsLoading] = useState(true)
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [loadingAgentId, setLoadingAgentId] = useState<string | null>(null)

  // Use a ref so switchConversation always calls the latest setMessages callback
  // (avoids stale closure when called from useEffects that capture old render state)
  const setMessagesRef = useRef(setMessages)
  setMessagesRef.current = setMessages

  const loadConversations = useCallback(async () => {
    if (!userId) return
    try {
      let convs = await getUserConversations(userId)
      // Client-side history TTL for free users (data stays in DB — just hidden)
      if (historyDays != null) {
        const cutoff = Date.now() - historyDays * 86_400_000
        convs = convs.filter(c => new Date(c.updated_at).getTime() >= cutoff)
      }
      setConversations(convs)
      setConvsLoading(false)
      cacheConversations(convs).catch(() => {})
    } catch {
      const cached = await getCachedConversations()
      if (cached.length > 0) setConversations(cached)
      setConvsLoading(false)
    }
  }, [userId, historyDays])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const toChat = (dbMessages: { id: string; agent_id: string; content: string; created_at: string }[]): ChatMessage[] =>
    dbMessages.map(m => ({
      id: m.id,
      role: m.agent_id === 'user' ? 'user' as const : 'kernel' as const,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      agentId: m.agent_id !== 'user' ? m.agent_id : undefined,
      agentName: m.agent_id !== 'user' && m.agent_id !== 'kernel'
        ? m.agent_id.charAt(0).toUpperCase() + m.agent_id.slice(1)
        : m.agent_id !== 'user' ? 'Kernel' : undefined,
    }))

  const switchConversation = useCallback(async (convId: string) => {
    setMsgsLoading(true)
    setActiveConversationId(convId)
    setMessagesRef.current([])
    // Quick peek at last agent for loading palette
    getLastAgentId(convId).then(id => setLoadingAgentId(id)).catch(() => {})
    try {
      const dbMessages = await getChannelMessages(convId)
      setMessagesRef.current(toChat(dbMessages))
      // Cache messages for offline
      cacheMessages(convId, dbMessages).catch(() => {})
    } catch {
      // Offline fallback
      const cached = await getCachedMessages(convId)
      if (cached.length > 0) setMessagesRef.current(toChat(cached))
    }
    setMsgsLoading(false)
    setLoadingAgentId(null)
  }, [])

  const handleNewChat = useCallback(() => {
    setMessagesRef.current([])
    setActiveConversationId(null)
  }, [])

  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(convId)
    if (activeConversationId === convId) {
      setMessagesRef.current([])
      setActiveConversationId(null)
    }
    await loadConversations()
  }, [activeConversationId, loadConversations])

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  return {
    conversations, setConversations,
    activeConversationId, setActiveConversationId,
    activeConversation,
    convsLoading, msgsLoading, loadingAgentId,
    loadConversations, switchConversation, handleNewChat, handleDeleteConversation,
    createConversation,
  }
}
