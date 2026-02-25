import { useState, useRef, useEffect, useCallback } from 'react'
import { getEngine, type EngineState, type EngineEvent } from '../engine/AIEngine'
import { claudeStreamChat, RateLimitError, FreeLimitError, PlatformRefundError, type ContentBlock } from '../engine/ClaudeClient'
import { fileToBase64 } from '../engine/fileUtils'
import { getSpecialist } from '../agents/specialists'
import { classifyIntent, buildRecentContext, resolveModelFromClassification } from '../engine/AgentRouter'
import { deepResearch, type ResearchProgress } from '../engine/DeepResearch'
import { extractMemory, mergeMemory, formatMemoryForPrompt, emptyProfile, type UserMemoryProfile } from '../engine/MemoryAgent'
import { extractFacet, converge, formatMirrorForPrompt, shouldConverge, resolveFacetAgent, emptyMirror, type UserMirror } from '../engine/Convergence'
import { extractEntities, formatGraphForPrompt, mergeExtraction, type KGEntity, type KGRelation } from '../engine/KnowledgeGraph'
import { planTask, executeTask, type TaskProgress } from '../engine/TaskPlanner'
import { runSwarm, type SwarmProgress } from '../engine/SwarmOrchestrator'
import { getGoalCheckInPrompt, extractGoalProgress, type UserGoal } from '../engine/GoalTracker'
import {
  saveMessage,
  getUserRecentMessages,
  touchConversation,
  saveResponseSignal,
  upsertCollectiveInsight,
  getUserMemory,
  upsertUserMemory,
  upsertUserMirror,
  getKGEntities,
  getKGRelations,
  upsertKGEntity,
  upsertKGRelation,
  getUserGoals,
  upsertUserGoal,
  supabase,
  type DBCollectiveInsight,
} from '../engine/SupabaseClient'
import { getCollectiveInsights } from '../engine/SupabaseClient'
import {
  TEXT_EXTENSIONS, LINK_REGEX,
  getMediaType, isImageFile, isPdfFile, isAudioFile, readFileAsText,
  serializeState, fetchUrlContent,
} from '../components/ChatHelpers'
import { isPlatformShareLink, importConversation, formatImportedContext, detectPlatformUrl } from '../engine/conversationImport'
import { transcribeAudio } from '../engine/transcribe'

export interface ChatMessage {
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

interface UseChatEngineParams {
  userId: string
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  loadConversations: () => Promise<void>
  createConversation: (userId: string, title: string) => Promise<{ id: string } | null>
  showToast: (msg: string) => void
  setShowUpgradeWall: (v: boolean) => void
  setFreeLimitResetsAt?: (v: string | null) => void
  signOut: () => void
  attachedFiles: File[]
  setAttachedFiles: (files: File[]) => void
  handleNewChat: () => void
  isPro?: boolean
}

export function useChatEngine(params: UseChatEngineParams) {
  const {
    userId, activeConversationId, setActiveConversationId,
    loadConversations, createConversation, showToast,
    setShowUpgradeWall, setFreeLimitResetsAt, signOut,
    attachedFiles, setAttachedFiles, handleNewChat,
    isPro = false,
  } = params

  const engine = getEngine()
  const [engineState, setEngineState] = useState<EngineState>(engine.getState())
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null)
  const [swarmProgress, setSwarmProgress] = useState<SwarmProgress | null>(null)
  const [collectiveInsights, setCollectiveInsights] = useState<DBCollectiveInsight[]>([])

  // Memory & KG state
  const [userMemory, setUserMemory] = useState<UserMemoryProfile>(emptyProfile())
  const userMemoryRef = useRef<UserMemoryProfile>(userMemory)
  userMemoryRef.current = userMemory
  const messageCountRef = useRef(0)

  // Convergence mirror — multi-agent perception synthesis
  const [userMirror, setUserMirror] = useState<UserMirror>(emptyMirror())
  const userMirrorRef = useRef<UserMirror>(userMirror)
  userMirrorRef.current = userMirror
  const [kgEntities, setKGEntities] = useState<KGEntity[]>([])
  const [kgRelations, setKGRelations] = useState<KGRelation[]>([])
  const kgEntitiesRef = useRef<KGEntity[]>([])
  kgEntitiesRef.current = kgEntities
  const [userGoals, setUserGoals] = useState<UserGoal[]>([])
  const userGoalsRef = useRef<UserGoal[]>([])
  userGoalsRef.current = userGoals

  // Today's briefing for home screen
  const [todayBriefing, setTodayBriefing] = useState<{ id: string; title: string; content: string } | null>(null)

  // Refs
  const latestKernelContentRef = useRef<string>('')
  const sendMessageRef = useRef<(content: string) => Promise<void>>(async () => { })
  const streamAbortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages
  const isThinkingRef = useRef(false)
  isThinkingRef.current = isThinking

  // Clean up active stream on unmount
  useEffect(() => {
    return () => { streamAbortRef.current?.abort() }
  }, [])

  // Sync engine state with Supabase on auth
  useEffect(() => {
    engine.setUserId(userId)
    engine.loadFromSupabase()
    return () => { engine.setUserId(null) }
  }, [userId, engine])

  // Subscribe to engine events
  useEffect(() => {
    return engine.subscribe((event) => {
      setEvents(prev => [...prev.slice(-49), event])
      setEngineState(engine.getState())
    })
  }, [engine])

  // Load user memory + mirror
  useEffect(() => {
    getUserMemory(userId).then(async (mem) => {
      if (mem && mem.profile) {
        const p = mem.profile as Record<string, unknown>
        const hasContent = Object.values(p).some(v =>
          (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v.length > 0)
        )
        if (hasContent) {
          setUserMemory(p as unknown as UserMemoryProfile)
          messageCountRef.current = mem.message_count

          // Load mirror data if present
          if (mem.agent_facets && Object.keys(mem.agent_facets).length > 0) {
            const mirror: UserMirror = {
              facets: mem.agent_facets as unknown as UserMirror['facets'],
              insights: (mem.convergence_insights || []) as unknown as UserMirror['insights'],
              lastConvergence: mem.last_convergence ? new Date(mem.last_convergence).getTime() : 0,
              convergenceCount: ((mem.convergence_insights || []) as unknown[]).length > 0 ? 1 : 0,
            }
            setUserMirror(mirror)
          }
          return
        }
      }
      const msgs = await getUserRecentMessages(userId, 40)
      if (msgs.length >= 2) {
        const recentMsgs = msgs.map(m => ({
          role: m.agent_id === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))
        try {
          const profile = await extractMemory(recentMsgs)
          const hasData = profile.interests.length > 0 || profile.goals.length > 0 ||
            profile.facts.length > 0 || profile.communication_style.length > 0
          if (hasData) {
            setUserMemory(profile)
            await upsertUserMemory(userId, profile as unknown as Record<string, unknown>, msgs.length)
          }
        } catch (err) {
          console.warn('[Memory] Bootstrap extraction failed:', err)
        }
      }
    }).catch(err => console.warn('[Memory] Failed to load user memory:', err))
  }, [userId])

  // Load Knowledge Graph
  useEffect(() => {
    Promise.all([getKGEntities(userId), getKGRelations(userId)])
      .then(([entities, relations]) => {
        setKGEntities(entities)
        setKGRelations(relations)
      })
      .catch(err => console.warn('[KG] Failed to load knowledge graph:', err))
  }, [userId])

  // Load user goals
  useEffect(() => {
    getUserGoals(userId).then(setUserGoals).catch(err => console.warn('[Goals] Failed to load:', err))
  }, [userId])

  // Load collective insights
  useEffect(() => {
    getCollectiveInsights(10).then(setCollectiveInsights).catch(() => { })
  }, [])

  // Load today's briefing
  useEffect(() => {
    const loadTodayBriefing = async () => {
      try {
        const midnight = new Date()
        midnight.setHours(0, 0, 0, 0)
        const { data } = await supabase
          .from('briefings')
          .select('id, title, content')
          .eq('user_id', userId)
          .gte('created_at', midnight.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        if (data && data.length > 0) {
          const b = data[0]
          if (!b.content.startsWith('Unable to generate briefing')) {
            setTodayBriefing({ id: b.id, title: b.title, content: b.content })
          }
        }
      } catch { /* no briefing today */ }
    }
    loadTodayBriefing()
  }, [userId])

  // Auto-title helper
  function generateTitle(content: string): string {
    if (content.length <= 50) return content
    const truncated = content.substring(0, 50)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...'
  }

  const sendMessage = async (content: string) => {
    if (isStreaming || (!content.trim() && attachedFiles.length === 0)) return

    const trimmed = content.trim()
    const filesToSend = [...attachedFiles]

    // Show immediate feedback — add user message and thinking state BEFORE any network calls.
    // This ensures the home screen disappears instantly on slow Android connections.
    const attachmentMeta = filesToSend.map(f => ({ name: f.name, type: f.type }))
    const userMsgId = `user_${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setIsThinking(true)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setAttachedFiles([])
    setResearchProgress(null)
    setTaskProgress(null)
    setSwarmProgress(null)

    // Lazy-create conversation on first message
    let convId = activeConversationId
    if (!convId) {
      const title = generateTitle(trimmed || filesToSend[0]?.name || 'New chat')
      let conv: Awaited<ReturnType<typeof createConversation>>
      try {
        conv = await createConversation(userId, title)
      } catch {
        setMessages(prev => prev.filter(m => m.id !== userMsgId))
        setIsStreaming(false)
        setIsThinking(false)
        showToast('Session expired. Signing you out — please sign back in.')
        signOut()
        return
      }
      if (!conv) {
        setMessages(prev => prev.filter(m => m.id !== userMsgId))
        setIsStreaming(false)
        setIsThinking(false)
        showToast('Failed to create conversation. Please try again.')
        return
      }
      convId = conv.id
      setActiveConversationId(convId)
    }

    // Classify intent via AgentRouter (read from ref for latest state across awaits)
    const recentCtx = buildRecentContext(
      messagesRef.current.filter(m => m.content.trim()).map(m => ({
        role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }))
    )
    let classification: Awaited<ReturnType<typeof classifyIntent>>
    try {
      classification = await classifyIntent(trimmed, recentCtx, filesToSend.length > 0)
    } catch (err) {
      console.error('[engine] classifyIntent failed:', err)
      // Fall back to kernel agent on classifier failure
      classification = { agentId: 'kernel', confidence: 0.5, complexity: 0.3, needsSwarm: false, needsResearch: false, isMultiStep: false }
    }
    const specialist = getSpecialist(classification.agentId)
    setThinkingAgent(specialist.name)

    // Fetch URL content if message contains links
    let urlContext = ''
    const urls = trimmed.match(LINK_REGEX)
    if (urls && urls.length > 0) {
      const fetches = await Promise.all(urls.slice(0, 3).map(async (url) => {
        // Detect platform share links (ChatGPT, Claude, Gemini)
        if (isPlatformShareLink(url)) {
          try {
            const result = await importConversation(url)
            if (result.messages.length > 0) {
              return formatImportedContext(result, '')
            }
            // Import returned 0 messages — these platforms load data client-side.
            // Return a helpful context note instead of raw HTML scaffold.
            const platform = result.platform === 'chatgpt' ? 'ChatGPT'
              : result.platform === 'claude' ? 'Claude'
              : result.platform === 'gemini' ? 'Gemini' : 'an AI platform'
            const titleNote = result.title && result.title !== 'Imported Conversation'
              ? ` titled "${result.title}"` : ''
            return `[The user shared a ${platform} conversation link${titleNote}: ${url}]\n[Note: The conversation content could not be extracted because ${platform} loads it client-side. Ask the user to paste the key parts of the conversation directly.]\n`
          } catch (err) {
            console.warn('[Import] Failed to import conversation:', err)
            const platform = isPlatformShareLink(url) ? detectPlatformUrl(url) : null
            const name = platform === 'chatgpt' ? 'ChatGPT' : platform === 'claude' ? 'Claude' : platform === 'gemini' ? 'Gemini' : 'an AI platform'
            return `[The user shared a ${name} conversation link: ${url}]\n[Note: Could not fetch the conversation. Ask the user to paste the relevant parts directly.]\n`
          }
        }
        const text = await fetchUrlContent(url)
        return text ? `[URL: ${url}]\n${text}\n` : ''
      }))
      urlContext = fetches.filter(Boolean).join('\n')
    }

    // Build content blocks for Claude API
    let userContent: string | ContentBlock[] = urlContext
      ? `${urlContext}\n---\n${trimmed}`
      : trimmed

    if (filesToSend.length > 0) {
      const blocks: ContentBlock[] = []
      let textPrefix = ''

      for (const file of filesToSend) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()

        if (isAudioFile(file)) {
          try {
            const result = await transcribeAudio(file)
            const duration = result.duration_seconds ? ` (${Math.round(result.duration_seconds)}s)` : ''
            textPrefix += `[Audio transcription: ${file.name}${duration}]\n${result.text}\n\n`
          } catch (err) {
            console.warn('[Transcribe] Failed:', err)
            textPrefix += `[Audio: ${file.name} — transcription failed]\n\n`
          }
        } else if (TEXT_EXTENSIONS.includes(ext)) {
          let text = await readFileAsText(file)
          const MAX_TEXT_CHARS = 30000
          if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS) + `\n\n[... truncated — file was ${(text.length / 1000).toFixed(0)}K chars, showing first ${(MAX_TEXT_CHARS / 1000).toFixed(0)}K]`
          }
          textPrefix += `[File: ${file.name}]\n${text}\n\n`
        } else if (isImageFile(file)) {
          const data = await fileToBase64(file)
          blocks.push({
            type: 'image',
            source: { type: 'base64', media_type: getMediaType(file), data },
          })
        } else if (isPdfFile(file)) {
          const data = await fileToBase64(file)
          blocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data },
          })
        }
      }

      const finalText = (urlContext + textPrefix + trimmed).trim() || `[Attached: ${filesToSend.map(f => f.name).join(', ')}]`
      blocks.push({ type: 'text', text: finalText })
      userContent = blocks
    }

    // Persist user message
    saveMessage({
      id: userMsgId,
      channel_id: convId,
      agent_id: 'user',
      content: trimmed,
      user_id: userId,
      attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
    })

    // Build system prompt
    const snapshot = serializeState(engine.getState())
    const memoryText = formatMemoryForPrompt(userMemory)
    const memoryBlock = memoryText
      ? `\n\n---\n\n## User Memory\nYou know this about the user. Use it naturally — don't announce it.\n\n${memoryText}`
      : ''
    const mirrorText = formatMirrorForPrompt(userMirrorRef.current)
    const mirrorBlock = mirrorText
      ? `\n\n## Mirror\nDeeper patterns the agents have noticed together:\n\n${mirrorText}`
      : ''
    const kgText = formatGraphForPrompt(kgEntities, kgRelations)
    const kgBlock = kgText
      ? `\n\n## Knowledge Graph\nStructured facts and relationships you've learned:\n\n${kgText}`
      : ''
    const collectiveBlock = collectiveInsights.length > 0
      ? `\n\n---\n\n## Collective Intelligence (learned from all users)\nThese patterns have emerged from conversations across all users. Use them to improve your responses:\n${collectiveInsights.map(i => `- [strength ${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
      : ''
    const goalBlock = getGoalCheckInPrompt(userGoalsRef.current)
    const systemPrompt = `${specialist.systemPrompt}\n\n---\n\n${snapshot}${memoryBlock}${mirrorBlock}${kgBlock}${goalBlock}${collectiveBlock}`

    const kernelId = `kernel_${Date.now()}`
    setMessages(prev => [...prev, {
      id: kernelId,
      role: 'kernel',
      content: '',
      timestamp: Date.now(),
      agentId: specialist.id,
      agentName: specialist.name,
    }])
    latestKernelContentRef.current = ''

    // Build claude messages (read from ref for latest state across awaits)
    const rawHistory = messagesRef.current
      .filter(m => m.content.trim() !== '')
      .map(m => ({
        role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }))
    const sanitized: { role: 'user' | 'assistant'; content: string }[] = []
    for (const m of rawHistory) {
      const prev = sanitized[sanitized.length - 1]
      if (prev && m.role === prev.role) {
        prev.content = prev.content + '\n\n' + m.content
      } else {
        sanitized.push({ ...m })
      }
    }
    const claudeMessages: { role: string; content: string | ContentBlock[] }[] = [
      ...sanitized,
      { role: 'user', content: userContent },
    ]

    const updateKernelMsg = (text: string) => {
      if (isThinkingRef.current) { setIsThinking(false); setThinkingAgent(null); isThinkingRef.current = false }
      latestKernelContentRef.current = text
      setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: text } : m))
    }

    try {
      if (classification.isMultiStep && isPro) {
        const plan = await planTask(trimmed)
        setTaskProgress({ plan, currentStep: 0 })
        await executeTask(
          plan,
          memoryText,
          (progress) => setTaskProgress(progress),
          updateKernelMsg
        )
        setTaskProgress(null)
      } else if (classification.needsSwarm && isPro) {
        const history = messagesRef.current
          .filter(m => m.content.trim())
          .map(m => ({
            role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
            content: m.content,
          }))
        await runSwarm(
          trimmed,
          memoryText,
          history,
          (progress) => setSwarmProgress(progress),
          updateKernelMsg
        )
        setSwarmProgress(null)
      } else if (classification.needsResearch && isPro) {
        await deepResearch(
          trimmed,
          memoryText,
          (progress) => setResearchProgress(progress),
          updateKernelMsg
        )
        setResearchProgress(null)
      } else {
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        const autoModel = resolveModelFromClassification(classification)
        console.log(`[engine] Auto-selected model: ${autoModel} (complexity: ${classification.complexity})`)
        await claudeStreamChat(
          claudeMessages,
          updateKernelMsg,
          {
            system: systemPrompt,
            model: autoModel,
            max_tokens: autoModel === 'opus' ? 8192 : autoModel === 'haiku' ? 512 : 1024,
            web_search: specialist.id === 'researcher' || specialist.id === 'kernel',
            signal: abortController.signal,
          }
        )
        streamAbortRef.current = null
      }

      // Persist kernel response
      const finalContent = latestKernelContentRef.current
      if (finalContent) {
        saveMessage({
          id: kernelId,
          channel_id: convId,
          agent_id: specialist.id,
          content: finalContent,
          user_id: userId,
        })

        const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const topic = trimmed.slice(0, 60).trim()
        saveResponseSignal({
          id: signalId,
          user_id: userId,
          conversation_id: convId,
          topic,
          response_quality: 'neutral',
        })
        if (topic.length > 3) {
          upsertCollectiveInsight(topic)
        }
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, signalId } : m))
      }
      touchConversation(convId)
      loadConversations()

      // Background memory + KG + convergence extraction every 3 messages
      messageCountRef.current++
      const currentMsgCount = messageCountRef.current
      if (currentMsgCount % 3 === 0) {
        setMessages(currentMsgs => {
          const recentMsgs = currentMsgs
            .slice(-10)
            .filter(m => m.content.trim())
            .map(m => ({ role: m.role === 'kernel' ? 'assistant' : 'user', content: m.content }))
          if (recentMsgs.length > 0) {
            // Memory extraction
            extractMemory(recentMsgs).then(async (newProfile) => {
              const hasData = newProfile.interests.length > 0 || newProfile.goals.length > 0 ||
                newProfile.facts.length > 0 || newProfile.communication_style.length > 0
              if (!hasData) return
              const merged = await mergeMemory(userMemoryRef.current, newProfile)
              setUserMemory(merged)
              await upsertUserMemory(userId, merged as unknown as Record<string, unknown>, currentMsgCount)
            }).catch((err) => console.warn('[Memory] Periodic extraction failed:', err))

            // Convergence — facet extraction for the active agent
            const facetAgentId = resolveFacetAgent(classification.agentId)
            const existingFacet = userMirrorRef.current.facets[facetAgentId]
            extractFacet(facetAgentId, recentMsgs, existingFacet).then(async (facet) => {
              if (!facet) return
              const updatedMirror: UserMirror = {
                ...userMirrorRef.current,
                facets: { ...userMirrorRef.current.facets, [facetAgentId]: facet },
              }

              // Check if convergence should run
              if (shouldConverge(updatedMirror, currentMsgCount)) {
                console.log('[Convergence] Running convergence...')
                const insights = await converge(updatedMirror)
                updatedMirror.insights = insights
                updatedMirror.lastConvergence = Date.now()
                updatedMirror.convergenceCount++
                console.log(`[Convergence] Produced ${insights.length} insights`)
              }

              setUserMirror(updatedMirror)
              await upsertUserMirror(
                userId,
                updatedMirror.facets as unknown as Record<string, unknown>,
                updatedMirror.insights as unknown[],
                updatedMirror.lastConvergence ? new Date(updatedMirror.lastConvergence).toISOString() : null,
              )
            }).catch(err => console.warn('[Convergence] Facet extraction failed:', err))

            // Goal progress extraction
            const activeGoals = userGoalsRef.current.filter(g => g.status === 'active')
            if (activeGoals.length > 0) {
              const lastUserMsg = recentMsgs.filter(m => m.role === 'user').pop()
              if (lastUserMsg) {
                extractGoalProgress(lastUserMsg.content, activeGoals).then(async (progress) => {
                  if (!progress) return
                  const goal = activeGoals.find(g => g.title === progress.goalTitle)
                  if (!goal) return
                  const updatedGoal: UserGoal = {
                    ...goal,
                    progress_notes: [...goal.progress_notes, { content: progress.note, timestamp: new Date().toISOString(), source: 'auto' }],
                    last_check_in_at: new Date().toISOString(),
                    milestones: progress.milestoneCompleted
                      ? goal.milestones.map(m => m.title === progress.milestoneCompleted ? { ...m, completed: true, completed_at: new Date().toISOString() } : m)
                      : goal.milestones,
                  }
                  await upsertUserGoal(updatedGoal)
                  setUserGoals(prev => prev.map(g => g.id === goal.id ? updatedGoal : g))
                }).catch(err => console.warn('[Goals] Extraction failed:', err))
              }
            }

            // KG extraction
            const kgMessages = currentMsgs.slice(-10).filter(m => m.content.trim()).map(m => ({
              id: m.id,
              agentId: m.role === 'user' ? 'human' : (m.agentId || 'kernel'),
              agentName: m.role === 'user' ? 'User' : (m.agentName || 'Kernel'),
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
            extractEntities(kgMessages, kgEntitiesRef.current.map(e => e.name)).then(async (extraction) => {
              if (extraction.entities.length === 0 && extraction.relations.length === 0) return
              await mergeExtraction(userId, extraction, kgEntitiesRef.current, upsertKGEntity, upsertKGRelation)
              const [entities, relations] = await Promise.all([getKGEntities(userId), getKGRelations(userId)])
              setKGEntities(entities)
              setKGRelations(relations)
            }).catch((err) => console.warn('[KG] Extraction failed:', err))
          }
          return currentMsgs
        })
      }
    } catch (err) {
      if (err instanceof FreeLimitError) {
        setFreeLimitResetsAt?.(err.resetsAt)
        setShowUpgradeWall(true)
        setMessages(prev => prev.filter(m => m.id !== kernelId))
      } else if (err instanceof PlatformRefundError) {
        // Platform error — message was auto-refunded, show friendly notice
        setMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*Something went wrong on our end. Your message has been refunded automatically — please try again.*` }
          : m
        ))
        showToast('Message refunded — something went wrong on our end')
      } else if (err instanceof RateLimitError) {
        setMessages(prev => prev.filter(m => m.id !== kernelId))
      } else {
        const errMsg = err instanceof Error ? err.message : 'Failed to reach kernel.chat'
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: `*${errMsg}*` } : m))
      }
      setResearchProgress(null)
      setTaskProgress(null)
      setSwarmProgress(null)
    } finally {
      setIsStreaming(false)
      setIsThinking(false)
    }
  }

  // Keep ref in sync
  sendMessageRef.current = sendMessage

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Onboarding first message — same transient-mount guard as briefing
  const onboardingConsumedRef = useRef(false)
  useEffect(() => {
    if (onboardingConsumedRef.current) return
    const timer = setTimeout(() => {
      const msg = sessionStorage.getItem('kernel-onboarding-message')
      if (!msg) return
      onboardingConsumedRef.current = true
      sessionStorage.removeItem('kernel-onboarding-message')
      handleNewChat()
      setTimeout(() => sendMessageRef.current(msg), 150)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Briefing page → chat: BriefingPage stores context in sessionStorage then
  // navigates to '/'. AnimatePresence mode="wait" causes a transient mount of
  // EnginePage inside the exiting wrapper (because Outlet re-renders for the new
  // route). That transient mount unmounts after ~200ms when the exit animation
  // completes, then the real mount happens. We use a 350ms delay so the transient
  // mount's cleanup cancels the timer, preserving sessionStorage for the real mount.
  const briefingConsumedRef = useRef(false)
  useEffect(() => {
    if (briefingConsumedRef.current) return
    const timer = setTimeout(() => {
      const raw = sessionStorage.getItem('kernel-briefing-context')
      if (!raw) return
      briefingConsumedRef.current = true
      sessionStorage.removeItem('kernel-briefing-context')
      try {
        const { title, section, content } = JSON.parse(raw) as { title: string; section: string; content: string }
        const msg = `I just read the "${section}" section of my briefing "${title}". Here's the content:\n\n${content}\n\nLet's go deeper on this.`
        handleNewChat()
        setTimeout(() => sendMessageRef.current(msg), 150)
      } catch { /* invalid JSON, ignore */ }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Briefing panel → Chat callback
  const handleBriefingGoDeeper = useCallback((title: string, content: string) => {
    handleNewChat()
    const msg = `I just read my briefing "${title}". Here's a summary:\n\n${content.slice(0, 800)}\n\nLet's discuss this.`
    setTimeout(() => sendMessageRef.current(msg), 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNewChat])

  // Briefing panel → Goal callback
  const handleBriefingAddGoal = useCallback(async (title: string, description: string) => {
    const goal: UserGoal = {
      user_id: userId,
      title,
      description,
      category: 'briefing',
      status: 'active',
      priority: 'medium',
      target_date: null,
      milestones: [],
      progress_notes: [],
      check_in_frequency: 'weekly',
      last_check_in_at: null,
    }
    await upsertUserGoal(goal)
    const goals = await getUserGoals(userId)
    setUserGoals(goals)
    showToast('Goal added from briefing')
  }, [userId, showToast])

  // Stop streaming
  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    setIsStreaming(false)
    setIsThinking(false)
    setResearchProgress(null)
    setTaskProgress(null)
    setSwarmProgress(null)
  }, [])

  return {
    engine, engineState, events,
    messages, setMessages,
    input, setInput,
    isStreaming, isThinking, thinkingAgent,
    researchProgress, taskProgress, swarmProgress,
    userMemory, kgEntities, kgRelations, userGoals, setUserGoals,
    todayBriefing,
    inputRef, sendMessage, handleSubmit, stopStreaming,
    messageCountRef,
    handleBriefingGoDeeper, handleBriefingAddGoal,
  }
}
