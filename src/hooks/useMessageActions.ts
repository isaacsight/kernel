import { useState, useCallback } from 'react'
import { updateSignalQuality, upsertCollectiveInsight } from '../engine/SupabaseClient'
import { downloadFile } from '../components/ChatHelpers'
import type { DBConversation } from '../engine/SupabaseClient'

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

export function useMessageActions(
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  activeConversationId: string | null,
  activeConversation: DBConversation | undefined,
  showToast: (msg: string) => void,
  sendMessage: (content: string) => Promise<void>,
) {
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)

  const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }, [])

  const handleEditMessage = useCallback(async (msgId: string, newContent: string) => {
    if (!newContent.trim()) return
    setEditingMsgId(null)
    setEditingContent('')
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      return idx >= 0 ? prev.slice(0, idx) : prev
    })
    await sendMessage(newContent.trim())
  }, [setMessages, sendMessage])

  const handleFeedback = useCallback(async (msg: ChatMessage, quality: 'helpful' | 'poor') => {
    if (!msg.signalId || msg.feedback) return
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: quality } : m))
    updateSignalQuality(msg.signalId, quality)
    if (quality === 'helpful' && msg.signalId) {
      const idx = messages.findIndex(m => m.id === msg.id)
      const userMsg = idx > 0 ? messages[idx - 1] : null
      if (userMsg && userMsg.role === 'user') {
        const topic = userMsg.content.slice(0, 60).trim()
        upsertCollectiveInsight(topic)
      }
    }
  }, [messages, setMessages])

  const handleShare = useCallback(async () => {
    if (!activeConversationId || messages.length === 0) return
    const title = activeConversation?.title || 'Kernel Conversation'
    const text = messages
      .map(m => `${m.role === 'user' ? 'You' : 'Kernel'}: ${m.content}`)
      .join('\n\n')
    try {
      if (navigator.share) {
        await navigator.share({ title, text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Conversation copied to clipboard')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      showToast('Could not share — try Export instead')
    }
  }, [activeConversationId, messages, activeConversation, showToast])

  const handleExportConversation = useCallback(() => {
    if (messages.length === 0) return
    const title = activeConversation?.title || 'Kernel Conversation'
    const md = `# ${title}\n\n` + messages
      .map(m => {
        const who = m.role === 'user' ? '**You**' : `**Kernel** _(${m.agentName || 'Kernel'})_`
        const time = new Date(m.timestamp).toLocaleString()
        return `### ${who}\n_${time}_\n\n${m.content}`
      })
      .join('\n\n---\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Conversation exported')
  }, [messages, activeConversation, showToast])

  return {
    copiedMsgId,
    editingMsgId, setEditingMsgId,
    editingContent, setEditingContent,
    showShareModal, setShowShareModal,
    handleCopyMessage, handleEditMessage, handleFeedback,
    handleShare, handleExportConversation,
    downloadFile,
  }
}
