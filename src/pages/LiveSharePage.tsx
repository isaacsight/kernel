import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../providers/AuthProvider'
import { useLiveShare } from '../hooks/useLiveShare'
import { supabase } from '../engine/SupabaseClient'
import { MessageContent } from '../components/MessageContent'
import { IconArrowLeft } from '../components/KernelIcons'

interface LiveMessage {
  id: string
  role: string
  content: string
  created_at: string
}

export function LiveSharePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const liveShare = useLiveShare(user?.id ?? null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(true)

  // Join the live share on mount
  useEffect(() => {
    if (!code || !user) return

    const joinShare = async () => {
      setJoining(true)
      const conversationId = await liveShare.join(code)
      if (!conversationId) {
        setError('Unable to join this live share. The link may be invalid or expired.')
        setJoining(false)
        return
      }

      // Load existing messages
      const { data } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data)
      setJoining(false)
    }

    joinShare()
  }, [code, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for new messages
  useEffect(() => {
    liveShare.onNewMessage((msg) => {
      setMessages(prev => [...prev, msg])
    })
  }, [liveShare.onNewMessage])

  if (!user) {
    return (
      <div className="ka-live-page">
        <div className="ka-live-auth-prompt">
          <h2>Sign in to join</h2>
          <p>You need to be signed in to join a live share session.</p>
          <button onClick={() => navigate('/')} className="ka-share-create-btn">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ka-live-page">
        <div className="ka-live-error">
          <h2>Unable to Join</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="ka-share-create-btn">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-live-page">
      <header className="ka-live-header">
        <button className="ka-header-icon-btn" onClick={() => navigate('/')}>
          <IconArrowLeft size={18} />
        </button>
        <span className="ka-live-title">
          <span className="ka-live-dot" /> Live Share
        </span>
        <span className="ka-live-participants">
          {liveShare.state.participants.filter(p => p.online).length} online
        </span>
      </header>

      <div className="ka-live-messages">
        {joining && <p className="ka-live-loading">Joining live share...</p>}
        {messages.map(msg => (
          <div key={msg.id} className={`ka-msg ka-msg--${msg.role}`}>
            <div className="ka-msg-content">
              {msg.role === 'kernel' ? (
                <MessageContent text={msg.content} />
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
