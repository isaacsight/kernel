import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Send, MessageCircle, Image, X, Trash2, ChevronDown } from 'lucide-react'
import { useKernel } from '../hooks/useKernel'
import { getAgent } from '../agents'
import { getSwarmAgent } from '../agents/swarm'
import { MediaRenderer } from '../components/MediaRenderer'
import { fileToBase64 } from '../engine/GeminiClient'
import { NVIDIA_MODELS, getNvidiaModel, setNvidiaModel, isNvidiaAvailable } from '../engine/NvidiaClient'
import type { Provider } from '../engine/ProviderRouter'
import type { MediaAttachment } from '../types'

export function ObserverPage() {
  const {
    messages,
    swarm,
    isGenerating,
    provider,
    startSwarm,
    stopSwarm,
    injectMessage,
    setTopic,
    clearMessages,
    setProvider
  } = useKernel()

  const [input, setInput] = useState('')
  const [showTopicInput, setShowTopicInput] = useState(true)
  const [customTopic, setCustomTopic] = useState(swarm.topic)
  const [pendingMedia, setPendingMedia] = useState<MediaAttachment[]>([])
  const [showProviderMenu, setShowProviderMenu] = useState(false)
  const [nvidiaModel, setNvidiaModelLocal] = useState(getNvidiaModel())
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const providerRef = useRef<HTMLDivElement>(null)

  // Close provider menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    setShowProviderMenu(false)
  }

  const handleNvidiaModelChange = (modelId: string) => {
    setNvidiaModel(modelId)
    setNvidiaModelLocal(modelId)
  }

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

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeMedia = (index: number) => {
    setPendingMedia(prev => prev.filter((_, i) => i !== index))
  }

  const getAgentColor = (agentId: string) => {
    const agent = getAgent(agentId) || getSwarmAgent(agentId)
    return agent?.color || '#1F1E1D'
  }

  const getAgentAvatar = (agentId: string) => {
    const agent = getAgent(agentId) || getSwarmAgent(agentId)
    return agent?.avatar || '?'
  }

  return (
    <>
      <header className="h-16 border-b border-[--rubin-ivory-dark] flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="mono opacity-80"># observer-mode</div>
        </div>
        <div className="flex items-center gap-4">
          {messages.length > 0 && (
            <button
              onClick={() => { stopSwarm(); clearMessages(); setShowTopicInput(true); }}
              className="p-2 rounded-full hover:bg-[--rubin-ivory-med] transition-colors opacity-50 hover:opacity-100"
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
          )}

          {/* Provider selector */}
          <div className="relative" ref={providerRef}>
            <button
              onClick={() => setShowProviderMenu(!showProviderMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[--rubin-ivory-med] transition-colors mono text-xs"
              title="Switch LLM provider"
            >
              <span className="opacity-60">{provider === 'nvidia' ? 'NIM' : 'Gemini'}</span>
              <ChevronDown size={12} className="opacity-40" />
            </button>

            {showProviderMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg shadow-lg z-50 min-w-[220px]">
                <div className="p-2">
                  <button
                    onClick={() => handleProviderChange('gemini')}
                    className={`w-full text-left px-3 py-2 rounded-md mono text-xs transition-colors ${provider === 'gemini' ? 'bg-[--rubin-ivory-med] font-bold' : 'hover:bg-[--rubin-ivory-med]'}`}
                  >
                    Gemini
                  </button>
                  <button
                    onClick={() => handleProviderChange('nvidia')}
                    disabled={!isNvidiaAvailable()}
                    className={`w-full text-left px-3 py-2 rounded-md mono text-xs transition-colors ${!isNvidiaAvailable() ? 'opacity-30 cursor-not-allowed' : provider === 'nvidia' ? 'bg-[--rubin-ivory-med] font-bold' : 'hover:bg-[--rubin-ivory-med]'}`}
                  >
                    NVIDIA NIM {!isNvidiaAvailable() && '(no key)'}
                  </button>
                </div>

                {provider === 'nvidia' && isNvidiaAvailable() && (
                  <div className="border-t border-[--rubin-ivory-dark] p-2" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {Object.entries(
                      NVIDIA_MODELS.reduce<Record<string, typeof NVIDIA_MODELS>>((acc, m) => {
                        const cat = m.category || 'Other';
                        (acc[cat] ??= []).push(m);
                        return acc;
                      }, {})
                    ).map(([category, models]) => (
                      <div key={category}>
                        <div className="px-3 py-1 mt-2 mono text-[10px] opacity-40 uppercase">{category}</div>
                        {models.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleNvidiaModelChange(m.id)}
                            className={`w-full text-left px-3 py-1.5 rounded-md mono text-xs transition-colors ${nvidiaModel === m.id ? 'bg-[--rubin-ivory-med] font-bold' : 'hover:bg-[--rubin-ivory-med]'}`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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

      {showTopicInput && messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl text-center"
          >
            <h1 className="text-4xl mb-4 tracking-wide">Observer Mode</h1>
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

            <button
              onClick={handleStart}
              className="px-8 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full mono flex items-center gap-2 mx-auto hover:opacity-90 transition-opacity"
            >
              <Play size={18} />
              Begin Discussion
            </button>
          </motion.div>
        </div>
      ) : (
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
                      {m.agentId === 'human' ? 'I' : getAgentAvatar(m.agentId)}
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

          <footer className="p-6 bg-[--rubin-ivory] border-t border-[--rubin-ivory-dark]">
            {pendingMedia.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {pendingMedia.map((media, index) => (
                  <div key={index} className="relative">
                    {media.type === 'image' ? (
                      <img src={media.url} alt="Upload preview" className="h-20 w-20 object-cover rounded-lg" />
                    ) : (
                      <video src={media.url} className="h-20 w-20 object-cover rounded-lg" />
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
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" multiple className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full bg-[--rubin-ivory-med] hover:bg-[--rubin-ivory-dark] transition-colors" title="Upload image or video">
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
    </>
  )
}
