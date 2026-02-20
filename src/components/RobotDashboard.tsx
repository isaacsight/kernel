import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft } from 'lucide-react'
import { useAuthContext } from '../providers/AuthProvider'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useVoiceOutput } from '../hooks/useVoiceOutput'
import { useConversations } from '../hooks/useConversations'
import { useToast } from '../hooks/useToast'
import { useChatEngine, type ChatMessage } from '../hooks/useChatEngine'
import { MessageContent } from './MessageContent'
import { LoginGate } from './LoginGate'

/**
 * Robot Voice Assistant — Talk to Kernel, manage the platform.
 *
 * Uses Web Speech API for STT + TTS. Works on Safari (iOS/Mac) and Chrome.
 * Tap the mic button, speak, and Kernel responds with voice + text.
 */

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

export function RobotDashboard() {
  const { user, isLoading, isAuthenticated, isAdmin, isSubscribed, signOut } = useAuthContext()

  if (isLoading) {
    return (
      <div className="rv-loading">
        <div className="rv-orb rv-orb--pulse" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <LoginGate />
  }

  return <RobotVoice />
}

function RobotVoice() {
  const { user, isAdmin, isSubscribed, signOut } = useAuthContext()
  const isPro = isSubscribed || isAdmin
  const { toast, showToast } = useToast()

  // Conversation + chat engine
  const setMessagesRef = useRef<React.Dispatch<React.SetStateAction<ChatMessage[]>>>(() => {})
  const convs = useConversations(user?.id, (msgs) => {
    setMessagesRef.current(msgs as ChatMessage[])
  })

  const fileState = useState<File[]>([])
  const chatEngine = useChatEngine({
    userId: user!.id,
    activeConversationId: convs.activeConversationId,
    setActiveConversationId: convs.setActiveConversationId,
    loadConversations: convs.loadConversations,
    createConversation: convs.createConversation,
    showToast,
    setShowUpgradeWall: () => {},
    signOut,
    attachedFiles: fileState[0],
    setAttachedFiles: fileState[1],
    handleNewChat: convs.handleNewChat,
    isPro,
  })

  // Keep ref in sync
  setMessagesRef.current = chatEngine.setMessages

  // Voice I/O
  const voiceOutput = useVoiceOutput()
  const [pendingTranscript, setPendingTranscript] = useState('')
  const { isListening, toggleVoice } = useVoiceInput(
    (text) => setPendingTranscript(text),
    showToast,
  )

  // Derive voice state
  const voiceState: VoiceState = isListening
    ? 'listening'
    : chatEngine.isThinking || chatEngine.isStreaming
      ? voiceOutput.isSpeaking ? 'speaking' : 'thinking'
      : voiceOutput.isSpeaking
        ? 'speaking'
        : 'idle'

  // Auto-send when user stops speaking
  const lastSentRef = useRef('')
  useEffect(() => {
    if (!isListening && pendingTranscript.trim() && pendingTranscript !== lastSentRef.current) {
      lastSentRef.current = pendingTranscript
      chatEngine.sendMessage(pendingTranscript)
      setPendingTranscript('')
    }
  }, [isListening, pendingTranscript, chatEngine])

  // Auto-speak Kernel responses when streaming completes
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = chatEngine.isStreaming

    if (wasStreaming && !chatEngine.isStreaming) {
      const lastMsg = chatEngine.messages[chatEngine.messages.length - 1]
      if (lastMsg?.role === 'kernel' && lastMsg.content) {
        voiceOutput.speak(lastMsg.content)
      }
    }
  }, [chatEngine.isStreaming, chatEngine.messages, voiceOutput])

  // Scroll to bottom
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatEngine.messages.length])

  const handleMicPress = useCallback(() => {
    if (voiceOutput.isSpeaking) {
      voiceOutput.stop()
    }
    toggleVoice()
  }, [toggleVoice, voiceOutput])

  const orbColor = voiceState === 'listening'
    ? '#EF4444'
    : voiceState === 'thinking'
      ? '#6366F1'
      : voiceState === 'speaking'
        ? '#22C55E'
        : '#6366F1'

  return (
    <div className="rv-container">
      <style>{`
        .rv-container {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: var(--color-ivory, #FAF9F6);
          color: var(--color-slate, #1F1E1D);
          font-family: 'Courier Prime', monospace;
          overflow: hidden;
        }

        /* Loading */
        .rv-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100dvh;
          background: var(--color-ivory, #FAF9F6);
        }

        /* Header */
        .rv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          flex-shrink: 0;
        }
        .rv-back {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
          padding: 4px;
        }
        .rv-back:hover { opacity: 1; }
        .rv-title {
          font-family: 'EB Garamond', serif;
          font-size: 20px;
          font-weight: 600;
        }
        .rv-voice-toggle {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
          padding: 4px;
        }
        .rv-voice-toggle:hover { opacity: 1; }

        /* Status */
        .rv-status {
          text-align: center;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          opacity: 0.45;
          padding: 0 20px 8px;
        }

        /* Messages */
        .rv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0 20px 16px;
          -webkit-overflow-scrolling: touch;
        }
        .rv-msg {
          margin-bottom: 20px;
          max-width: 85%;
        }
        .rv-msg--user {
          margin-left: auto;
          text-align: right;
        }
        .rv-msg--kernel {
          margin-right: auto;
        }
        .rv-msg-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.4;
          margin-bottom: 4px;
        }
        .rv-msg-bubble {
          display: inline-block;
          text-align: left;
          font-size: 15px;
          line-height: 1.55;
          font-family: 'EB Garamond', serif;
        }
        .rv-msg--user .rv-msg-bubble {
          background: rgba(99,102,241,0.08);
          padding: 10px 14px;
          border-radius: 16px 16px 4px 16px;
          font-family: 'Courier Prime', monospace;
          font-size: 14px;
        }
        .rv-msg--kernel .rv-msg-bubble {
          padding: 4px 0;
        }

        /* Typing dots */
        .rv-typing {
          display: inline-flex;
          gap: 4px;
          padding: 8px 0;
        }
        .rv-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-slate, #1F1E1D);
          opacity: 0.3;
          animation: rv-dot 1.2s ease-in-out infinite;
        }
        .rv-typing span:nth-child(2) { animation-delay: 0.15s; }
        .rv-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes rv-dot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(1); }
          30% { opacity: 0.6; transform: scale(1.2); }
        }

        /* Transcript preview */
        .rv-transcript {
          text-align: center;
          padding: 8px 20px;
          font-size: 14px;
          opacity: 0.6;
          font-style: italic;
          min-height: 28px;
        }

        /* Orb + Controls */
        .rv-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px 32px;
          flex-shrink: 0;
        }

        .rv-orb-wrap {
          position: relative;
          width: 88px;
          height: 88px;
          margin-bottom: 12px;
        }

        .rv-orb {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s, box-shadow 0.3s;
          position: relative;
          z-index: 1;
          -webkit-tap-highlight-color: transparent;
        }
        .rv-orb:active {
          transform: scale(0.95);
        }
        .rv-orb svg {
          color: white;
          width: 28px;
          height: 28px;
        }
        .rv-orb--pulse {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #6366F1;
          animation: rv-pulse 2s ease-in-out infinite;
        }

        /* Rings animation */
        .rv-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: 2px solid;
          opacity: 0;
          z-index: 0;
        }

        @keyframes rv-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }

        .rv-hint {
          font-size: 11px;
          opacity: 0.35;
          text-align: center;
        }

        /* Toast */
        .rv-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-slate, #1F1E1D);
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 13px;
          font-family: 'Courier Prime', monospace;
          z-index: 100;
        }

        /* Safe area for iPhone notch */
        @supports (padding-top: env(safe-area-inset-top)) {
          .rv-header { padding-top: calc(16px + env(safe-area-inset-top)); }
          .rv-controls { padding-bottom: calc(32px + env(safe-area-inset-bottom)); }
        }
      `}</style>

      {/* Header */}
      <div className="rv-header">
        <button className="rv-back" onClick={() => { window.location.hash = '#/' }}>
          <ArrowLeft size={20} />
        </button>
        <span className="rv-title">Kernel</span>
        <button
          className="rv-voice-toggle"
          onClick={() => voiceOutput.setVoiceEnabled(!voiceOutput.voiceEnabled)}
          title={voiceOutput.voiceEnabled ? 'Mute voice' : 'Unmute voice'}
        >
          {voiceOutput.voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Status line */}
      <div className="rv-status">
        {voiceState === 'listening' ? 'Listening...'
          : voiceState === 'thinking' ? (chatEngine.thinkingAgent ? `${chatEngine.thinkingAgent} is thinking...` : 'Thinking...')
          : voiceState === 'speaking' ? 'Speaking...'
          : 'Tap to talk'}
      </div>

      {/* Messages */}
      <div className="rv-messages" ref={scrollRef}>
        {chatEngine.messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '30%', opacity: 0.3 }}>
            <p style={{ fontFamily: 'EB Garamond, serif', fontSize: 18, marginBottom: 8 }}>
              Hey. I'm listening.
            </p>
            <p style={{ fontSize: 12 }}>
              Tap the mic and talk to me.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {chatEngine.messages.map(msg => (
            <motion.div
              key={msg.id}
              className={`rv-msg rv-msg--${msg.role}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === 'kernel' && msg.agentName && (
                <div className="rv-msg-label">{msg.agentName}</div>
              )}
              {msg.role === 'user' && (
                <div className="rv-msg-label">You</div>
              )}
              <div className="rv-msg-bubble">
                {msg.content ? (
                  msg.role === 'kernel'
                    ? <MessageContent text={msg.content} />
                    : msg.content
                ) : (
                  <span className="rv-typing"><span /><span /><span /></span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Live transcript */}
      <div className="rv-transcript">
        {isListening && pendingTranscript ? pendingTranscript : '\u00A0'}
      </div>

      {/* Mic button */}
      <div className="rv-controls">
        <div className="rv-orb-wrap">
          {/* Animated rings */}
          <AnimatePresence>
            {(voiceState === 'listening' || voiceState === 'speaking') && (
              <>
                <motion.div
                  className="rv-ring"
                  style={{ borderColor: orbColor }}
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0.4, 0], scale: [1, 1.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="rv-ring"
                  style={{ borderColor: orbColor }}
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0.3, 0], scale: [1, 1.9] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                />
              </>
            )}
          </AnimatePresence>

          <motion.button
            className="rv-orb"
            style={{ backgroundColor: orbColor }}
            onClick={handleMicPress}
            whileTap={{ scale: 0.92 }}
            animate={
              voiceState === 'thinking'
                ? { scale: [1, 1.06, 1], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }
                : { scale: 1 }
            }
          >
            {isListening ? <MicOff /> : <Mic />}
          </motion.button>
        </div>

        <div className="rv-hint">
          {voiceState === 'idle' && chatEngine.messages.length > 0 && 'Tap to continue'}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="rv-toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
