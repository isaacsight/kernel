import { useState, useCallback, useEffect } from 'react'
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
    setMessages([])
    const dbMessages = await getChannelMessages(convId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => ({
      id: m.id,
      role: m.agent_id === 'user' ? 'user' : 'kernel',
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
    }))
    setMessages(chatMessages)
    setMsgsLoading(false)
  }, [setMessages])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
  }, [setMessages])

  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(convId)
    if (activeConversationId === convId) {
      setMessages([])
      setActiveConversationId(null)
    }
    await loadConversations()
  }, [activeConversationId, loadConversations, setMessages])

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
