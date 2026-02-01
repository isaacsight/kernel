import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Send, MessageCircle, Image, X } from 'lucide-react'
import { useKernel } from './hooks/useKernel'
import { KERNEL_AGENTS, getAgent } from './agents'
import { MediaRenderer } from './components/MediaRenderer'
import { fileToBase64 } from './engine/GeminiClient'
import type { MediaAttachment } from './types'

const TOPIC_SUGGESTIONS = [
  'The future of human-AI collaboration',
  'What makes consciousness possible?',
  'The ethics of autonomous systems',
  'How creativity emerges from constraint',
  'The nature of intelligence itself'
]

export default function App() {
  const {
    messages,
    swarm,
    isGenerating,
    startSwarm,
    stopSwarm,
    injectMessage,
    setTopic
  } = useKernel()

  const [input, setInput] = useState('')
  const [showTopicInput, setShowTopicInput] = useState(true)
  const [customTopic, setCustomTopic] = useState(swarm.topic)
  const [pendingMedia, setPendingMedia] = useState<MediaAttachment[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleStart = () => {
    setShowTopicInput(false)
    setTopic(customTopic)
    startSwarm(customTopic)
  }

  const handleToggle = () => {
    if (swarm.isActive) {
      stopSwarm()
    } else {
      startSwarm(swarm.topic)
    }
  }

  const handleInject = () => {
    if (!input.trim() && pendingMedia.length === 0) return
    injectMessage(input, pendingMedia.length > 0 ? pendingMedia : undefined)
    setInput('')
    setPendingMedia([])
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const base64 = await fileToBase64(file)
        const url = URL.createObjectURL(file)

        setPendingMedia(prev => [...prev, {
          type: file.type.startsWith('image/') ? 'image' : 'video',
          url,
          mimeType: file.type,
          base64
        }])
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeMedia = (index: number) => {
    setPendingMedia(prev => prev.filter((_, i) => i !== index))
  }

  const getAgentColor = (agentId: string) => {
    const agent = getAgent(agentId)
    return agent?.color || '#1F1E1D'
  }

  return (
    <>
      {/* Server Icons */}
      <aside className="sidebar-servers">
        <div className="server-icon active" title="Sovereign Kernel">S</div>
        <div className="server-icon opacity-30" title="Coming Soon">+</div>
      </aside>

      {/* Channel Sidebar */}
      <aside className="sidebar-channels">
        <section>
          <div className="mono opacity-40 mb-4 px-2">Agents Online</div>
          <nav className="space-y-3">
            {KERNEL_AGENTS.map(agent => (
              <div
                key={agent.id}
                className="flex items-center gap-3 px-2"
                style={{ opacity: swarm.currentSpeaker === agent.id ? 1 : 0.5 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ backgroundColor: agent.color, color: '#FAF9F6' }}
                >
                  {agent.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="text-xs opacity-60 font-mono">
                    {swarm.currentSpeaker === agent.id && isGenerating
                      ? 'thinking...'
                      : swarm.currentSpeaker === agent.id
                        ? 'speaking'
                        : 'observing'}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </section>

        <div className="mt-auto p-4 border-t border-[--rubin-ivory-dark]">
          <div className="mono text-[10px] opacity-40">Observer</div>
          <div className="font-serif text-sm">Isaac Hernandez</div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="chat-container">
        <header className="h-16 border-b border-[--rubin-ivory-dark] flex items-center justify-between px-8">
          <div className="mono opacity-80"># sovereign-kernel</div>
          <div className="flex items-center gap-4">
            <span className="mono text-xs opacity-50">
              Turn {swarm.turnCount}
            </span>
            <button
              onClick={handleToggle}
              className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: swarm.isActive ? '#8B7355' : 'transparent',
                color: swarm.isActive ? '#FAF9F6' : '#1F1E1D',
                border: swarm.isActive ? 'none' : '1px solid #1F1E1D'
              }}
            >
              {swarm.isActive ? (
                <>
                  <Pause size={16} />
                  <span className="mono text-xs">Pause</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span className="mono text-xs">{messages.length > 0 ? 'Resume' : 'Start'}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Topic Selection / Welcome */}
        {showTopicInput && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl text-center"
            >
              <h1 className="text-4xl mb-4 tracking-wide">Sovereign Kernel</h1>
              <p className="text-xl opacity-60 mb-8 italic">
                Watch AI agents think together. Jump in when inspired.
              </p>

              <div className="mb-6">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Enter a topic for discussion..."
                  className="w-full px-4 py-3 border-b border-[--rubin-slate] bg-transparent text-center text-lg"
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {TOPIC_SUGGESTIONS.map(topic => (
                  <button
                    key={topic}
                    onClick={() => setCustomTopic(topic)}
                    className="px-3 py-1 text-sm mono opacity-50 hover:opacity-100 transition-opacity border border-[--rubin-ivory-dark] rounded-full"
                  >
                    {topic.slice(0, 30)}{topic.length > 30 ? '...' : ''}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStart}
                className="px-8 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full mono flex items-center gap-2 mx-auto hover:opacity-90 transition-opacity"
              >
                <Play size={18} />
                Begin Discussion
              </button>
            </motion.div>
          </div>
        )}

        {/* Messages */}
        {(!showTopicInput || messages.length > 0) && (
          <>
            <div className="px-8 py-4 border-b border-[--rubin-ivory-dark] bg-[--rubin-ivory-med]">
              <div className="mono text-xs opacity-50">DISCUSSING</div>
              <div className="text-lg italic">"{swarm.topic}"</div>
            </div>

            <main className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                        style={{
                          backgroundColor: m.agentId === 'human' ? '#1F1E1D' : getAgentColor(m.agentId),
                          color: '#FAF9F6'
                        }}
                      >
                        {m.agentId === 'human' ? 'I' : getAgent(m.agentId)?.avatar || '?'}
                      </div>
                      <div>
                        <span className="font-medium">{m.agentName}</span>
                        <span className="mono text-xs opacity-40 ml-2">
                          {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="pl-11">
                      <div className={`text-xl leading-relaxed ${m.agentId !== 'human' ? 'italic' : ''}`}>
                        <MediaRenderer content={m.content} isStreaming={m.isStreaming} attachments={m.media} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isGenerating && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 mono text-sm opacity-50"
                >
                  <MessageCircle size={16} className="animate-pulse" />
                  {getAgent(swarm.currentSpeaker || '')?.name || 'Agent'} is thinking...
                </motion.div>
              )}
            </main>

            {/* Input for injecting thoughts */}
            <footer className="p-6 bg-[--rubin-ivory] border-t border-[--rubin-ivory-dark]">
              {/* Media preview */}
              {pendingMedia.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {pendingMedia.map((media, index) => (
                    <div key={index} className="relative">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt="Upload preview"
                          className="h-20 w-20 object-cover rounded-lg"
                        />
                      ) : (
                        <video
                          src={media.url}
                          className="h-20 w-20 object-cover rounded-lg"
                        />
                      )}
                      <button
                        onClick={() => removeMedia(index)}
                        className="absolute -top-2 -right-2 p-1 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-full bg-[--rubin-ivory-med] hover:bg-[--rubin-ivory-dark] transition-colors"
                  title="Upload image or video"
                >
                  <Image size={18} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleInject()
                    }
                  }}
                  placeholder="Inject a thought into the discussion..."
                  className="flex-1 px-4 py-3 bg-[--rubin-ivory-med] border-none outline-none rounded-lg"
                />
                <button
                  onClick={handleInject}
                  disabled={!input.trim() && pendingMedia.length === 0}
                  className="p-3 rounded-full bg-[--rubin-slate] text-[--rubin-ivory] disabled:opacity-30 transition-opacity"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mono text-[10px] opacity-30 mt-2 text-center">
                Upload images/videos for agents to analyze, or press Enter to inject text
              </div>
            </footer>
          </>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--rubin-ivory-dark);
        }
        .server-icon.active {
          background: var(--rubin-slate);
          color: var(--rubin-ivory);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
