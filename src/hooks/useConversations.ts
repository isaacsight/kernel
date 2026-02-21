import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getUserConversations,
  getChannelMessages,
  createConversation,
  deleteConversation,
  type DBConversation,
} from '../engine/SupabaseClient'

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
}

export function useConversations(
  userId: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
) {
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [convsLoading, setConvsLoading] = useState(true)
  const [msgsLoading, setMsgsLoading] = useState(false)

  // Use a ref so switchConversation always calls the latest setMessages callback
  // (avoids stale closure when called from useEffects that capture old render state)
  const setMessagesRef = useRef(setMessages)
  setMessagesRef.current = setMessages

  const loadConversations = useCallback(async () => {
    if (!userId) return
    const convs = await getUserConversations(userId)
    setConversations(convs)
    setConvsLoading(false)
  }, [userId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const switchConversation = useCallback(async (convId: string) => {
    setMsgsLoading(true)
    setActiveConversationId(convId)
    setMessagesRef.current([])
    const dbMessages = await getChannelMessages(convId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => ({
      id: m.id,
      role: m.agent_id === 'user' ? 'user' : 'kernel',
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      agentId: m.agent_id !== 'user' ? m.agent_id : undefined,
      agentName: m.agent_id !== 'user' && m.agent_id !== 'kernel'
        ? m.agent_id.charAt(0).toUpperCase() + m.agent_id.slice(1)
        : m.agent_id !== 'user' ? 'Kernel' : undefined,
    }))
    setMessagesRef.current(chatMessages)
    setMsgsLoading(false)
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
    convsLoading, msgsLoading,
    loadConversations, switchConversation, handleNewChat, handleDeleteConversation,
    createConversation,
  }
}
