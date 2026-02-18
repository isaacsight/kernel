// ─── SharedConversationPage ──────────────────────────────
//
// Read-only public view of a shared conversation.
// No login required. "Try Kernel" CTA at bottom.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { MessageContent, Linkify } from '../components/MessageContent'
import { getSpecialist } from '../agents/specialists'

interface SharedMessage {
  role: string
  content: string
  agentName?: string
  timestamp: number
}

interface SharedData {
  id: string
  title: string
  messages: SharedMessage[]
  view_count: number
  created_at: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const BASE = import.meta.env.BASE_URL

export function SharedConversationPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Override body fixed positioning so the page can scroll naturally
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`${SUPABASE_URL}/functions/v1/shared-conversation?id=${encodeURIComponent(id)}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Not found' }))
          throw new Error(body.error || 'Not found')
        }
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="ka-shared-page">
        <div className="ka-shared-loading">Loading conversation...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="ka-shared-page">
        <div className="ka-shared-error">
          <h1>Conversation not found</h1>
          <p>This link may have expired or been removed.</p>
          <a href={`${BASE}#/`} className="ka-shared-cta">
            Try Kernel
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-shared-page">
      <header className="ka-shared-header">
        <a href={`${BASE}#/`} className="ka-shared-logo-link">
          <img className="ka-logo" src={`${BASE}logo-mark.svg`} alt="Kernel" />
        </a>
        <div className="ka-shared-header-text">
          <h1 className="ka-shared-title">{data.title}</h1>
          <span className="ka-shared-meta">
            {new Date(data.created_at).toLocaleDateString()} &middot; {data.messages.length} message{data.messages.length !== 1 ? 's' : ''} &middot; {data.view_count} view{data.view_count !== 1 ? 's' : ''}
          </span>
        </div>
        <a href={`${BASE}#/`} className="ka-shared-new-chat" title="Start a new conversation">
          <MessageSquare size={18} />
        </a>
      </header>

      <div className="ka-shared-messages">
        {data.messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`ka-msg ka-msg--${msg.role === 'user' ? 'user' : 'kernel'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            {msg.role !== 'user' && (
              <div className="ka-msg-avatar-col">
                <div className="ka-msg-avatar">K</div>
                {msg.agentName && msg.agentName !== 'Kernel' && (
                  <span className="ka-agent-badge">{msg.agentName}</span>
                )}
              </div>
            )}
            <div className="ka-msg-col">
              <div className="ka-msg-bubble">
                {msg.role !== 'user' ? (
                  <MessageContent text={msg.content} />
                ) : (
                  <Linkify text={msg.content} />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="ka-shared-footer">
        <p>This conversation was shared from <strong>Kernel</strong> — a personal AI that learns your preferences, tracks your goals, and gets better every time you talk.</p>
        <a href={`${BASE}#/`} className="ka-shared-cta">
          Start your own conversation
        </a>
      </div>
    </div>
  )
}
