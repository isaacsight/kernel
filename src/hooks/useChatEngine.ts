import { useState, useRef, useEffect, useCallback } from 'react'
import { getEngine, type EngineState, type EngineEvent } from '../engine/AIEngine'
import { claudeStreamChat, RateLimitError, FreeLimitError, ProLimitError, ImageLimitError, MonthlyLimitError, FileLimitError, FairUseLimitError, PlatformRefundError, type ContentBlock } from '../engine/ClaudeClient'
import { fileToBase64 } from '../engine/fileUtils'
import { getSpecialist, EXPLAIN_MODE_SUFFIX } from '../agents/specialists'
import { classifyIntent, buildRecentContext, resolveModelFromClassification } from '../engine/AgentRouter'
import { deepResearch, type ResearchProgress } from '../engine/DeepResearch'
import { extractMemory, mergeMemory, formatMemoryForPrompt, isEmptyProfile, emptyProfile, updateWarmth, applyProfileDecay, type UserMemoryProfile } from '../engine/MemoryAgent'
import { summarizeConversation, getMessagesToSummarize, formatSummaryForPrompt, SUMMARY_THRESHOLD, type ConversationSummary } from '../engine/ConversationSummarizer'
import { extractFacet, converge, formatMirrorForPrompt, formatCraftCalibration, shouldConverge, resolveFacetAgent, emptyMirror, type UserMirror } from '../engine/Convergence'
import {
  captureOutcome, recordOutcome, detectRephrase,
  buildRoutingContext, buildSwarmContext, formatSelfMirror,
  emptyLoomState, serializeLoomState, deserializeLoomState,
  type LoomState, type Outcome, type UserSignal,
} from '../engine/Loom'
import { extractEntities, formatGraphForPrompt, mergeExtraction, type KGEntity, type KGRelation } from '../engine/KnowledgeGraph'
import { extractKeyEntities } from '../engine/textAnalysis'
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
  getLoomState,
  upsertLoomState,
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
import { formatCrisisResourcesForPrompt } from '../engine/CrisisDetector'
import { generateImage, ImageCreditError, ImageGenLimitError, type ImageGenResult, type PreviousImage, type ReferenceImage } from '../engine/imageGen'
import { useProjectStore } from '../stores/projectStore'

export interface WorkflowStepState {
  name: string
  status: 'pending' | 'active' | 'complete' | 'failed' | 'skipped'
  result?: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'kernel'
  content: string
  timestamp: number
  signalId?: string
  feedback?: 'helpful' | 'poor'
  attachments?: { name: string; type: string }[]
  imageDataUrls?: string[]  // data URLs for inline image thumbnails
  agentId?: string
  agentName?: string
  thinking?: string
  workflowSteps?: WorkflowStepState[]
  isProactive?: boolean
  generatedImages?: ImageGenResult[]
}

/** Active document for multi-turn document analysis (Pro only) */
export interface ActiveDocument {
  name: string
  type: string
  dataUrl: string
  contentBlock: ContentBlock
}

interface UseChatEngineParams {
  userId: string
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  loadConversations: () => Promise<void>
  createConversation: (userId: string, title: string) => Promise<{ id: string } | null>
  conversations: { id: string; title: string; updated_at: string }[]
  showToast: (msg: string) => void
  setShowUpgradeWall: (v: boolean) => void
  setFreeLimitResetsAt?: (v: string | null) => void
  signOut: () => void
  attachedFiles: File[]
  setAttachedFiles: (files: File[]) => void
  handleNewChat: () => void
  isPro?: boolean
  planLimits?: import('../config/planLimits').PlanLimits
  crisisActive?: boolean
  crisisSeverity?: import('../engine/CrisisDetector').CrisisSeverity | null
  onShowCreditModal?: () => void
}

export function useChatEngine(params: UseChatEngineParams) {
  const {
    userId, activeConversationId, setActiveConversationId,
    loadConversations, createConversation, showToast,
    setShowUpgradeWall, setFreeLimitResetsAt, signOut,
    attachedFiles, setAttachedFiles, handleNewChat,
    isPro = false,
    crisisActive = false, crisisSeverity = null,
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

  // Agentic Workflow state (Pro only)
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepState[]>([])
  const [isWorkflowActive, setIsWorkflowActive] = useState(false)
  const workflowRef = useRef<import('../engine/AgenticWorkflow').AgenticWorkflow | null>(null)

  // Extended thinking state (Pro only)
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false)
  const [currentThinking, setCurrentThinking] = useState('')
  const thinkingStartRef = useRef<number>(0)

  // Code Explain Mode — pedagogical code generation
  const [explainModeEnabled, setExplainModeEnabled] = useState(false)

  // Project context — select only the action for stable reference
  const formatProjectManifest = useProjectStore(s => s.formatManifest)

  // Deep Document Analysis state (Pro only)
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null)
  const activeDocumentRef = useRef<ActiveDocument | null>(null)
  activeDocumentRef.current = activeDocument

  // Memory & KG state
  const [userMemory, setUserMemory] = useState<UserMemoryProfile>(emptyProfile())
  const userMemoryRef = useRef<UserMemoryProfile>(userMemory)
  userMemoryRef.current = userMemory
  const messageCountRef = useRef(0)

  // Conversation summarization — cached summaries for long conversations
  const convSummaryRef = useRef<ConversationSummary | null>(null)

  // Convergence mirror — multi-agent perception synthesis
  const [userMirror, setUserMirror] = useState<UserMirror>(emptyMirror())
  const userMirrorRef = useRef<UserMirror>(userMirror)
  userMirrorRef.current = userMirror

  // Loom — reflexive intelligence (the system observing itself)
  const loomRef = useRef<LoomState>(emptyLoomState())
  const pendingOutcomeRef = useRef<{
    classification: Awaited<ReturnType<typeof classifyIntent>>
    agentUsed: string
    swarmComposition: string[] | null
    modelUsed: string
    responseContent: string
    timestamp: number
    previousUserMsg: string
  } | null>(null)
  const avgUserMsgLengthRef = useRef(60) // rolling average for length delta

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
  // Track the conversation ID that's currently streaming — if the user switches
  // conversations, UI updates are skipped but the stream continues and persists to DB.
  const streamingConvIdRef = useRef<string | null>(null)
  const activeConvIdRef = useRef<string | null>(activeConversationId)
  activeConvIdRef.current = activeConversationId

  // Clean up active stream on unmount
  useEffect(() => {
    return () => { streamAbortRef.current?.abort() }
  }, [])

  // Clean up UI state when conversation changes — but DON'T abort the stream.
  // Let background responses finish and persist to DB so they're there when the user comes back.
  useEffect(() => {
    setActiveDocument(null)
    setIsStreaming(false)
    setIsThinking(false)
    setThinkingAgent(null)
    setResearchProgress(null)
    setTaskProgress(null)
    setSwarmProgress(null)
    setIsWorkflowActive(false)
    setCurrentThinking('')
    convSummaryRef.current = null // Reset summary for new conversation
  }, [activeConversationId])

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

  // Load Loom state
  useEffect(() => {
    getLoomState(userId).then(data => {
      if (data) loomRef.current = deserializeLoomState(data)
    }).catch(err => console.warn('[Loom] Failed to load:', err))
  }, [userId])

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

    // Loom — resolve pending outcome from previous response
    const pending = pendingOutcomeRef.current
    if (pending && trimmed) {
      const latencyMs = Date.now() - pending.timestamp
      const isRephrase = detectRephrase(pending.previousUserMsg, trimmed)
      const avg = avgUserMsgLengthRef.current
      const lengthDelta = avg > 0 ? (trimmed.length - avg) / avg : 0
      avgUserMsgLengthRef.current = avg * 0.8 + trimmed.length * 0.2

      const signal: UserSignal = {
        continued: true,
        messageLatencyMs: latencyMs,
        lengthDelta: Math.max(-1, Math.min(1, lengthDelta)),
        rephrased: isRephrase,
        abandoned: false,
      }

      // Build a lightweight reflection from engine state
      const engineReflection = engine.getState().lasting.reflections.slice(-1)[0]
      if (engineReflection) {
        const outcome = captureOutcome(
          pending.classification,
          pending.agentUsed,
          pending.swarmComposition,
          pending.modelUsed,
          engineReflection,
          signal,
        )
        recordOutcome(loomRef.current, outcome).then(didSynthesize => {
          if (didSynthesize) console.log('[Loom] Pattern synthesis complete')
          upsertLoomState(userId, serializeLoomState(loomRef.current) as Record<string, unknown>)
        }).catch(err => console.warn('[Loom] Record outcome failed:', err))
      }
      pendingOutcomeRef.current = null
    }

    // Show immediate feedback — add user message and thinking state BEFORE any network calls.
    // This ensures the home screen disappears instantly on slow Android connections.
    const attachmentMeta = filesToSend.map(f => ({ name: f.name, type: f.type }))

    // Generate data URLs for image files (for inline thumbnails in chat) — parallel
    const imageFiles = filesToSend.filter(f => isImageFile(f))
    const imageDataUrls = (await Promise.all(
      imageFiles.map(imgFile =>
        new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.readAsDataURL(imgFile)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => resolve('') // skip failed reads
        })
      )
    )).filter(Boolean)

    const userMsgId = `user_${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
      imageDataUrls: imageDataUrls.length > 0 ? imageDataUrls : undefined,
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setIsThinking(true)
    setCurrentThinking('')
    thinkingStartRef.current = Date.now()
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setAttachedFiles([])
    setResearchProgress(null)
    setTaskProgress(null)
    setSwarmProgress(null)

    // ── Run conversation creation, classification, and URL fetching in PARALLEL ──
    // These three operations are independent and were previously sequential (~1-3s wasted).

    // 1. Conversation creation (only if needed)
    const convPromise = (async () => {
      if (activeConversationId) return activeConversationId
      const title = generateTitle(trimmed || filesToSend[0]?.name || 'New chat')
      try {
        const conv = await createConversation(userId, title)
        if (!conv) return null
        return conv.id
      } catch {
        return 'session_expired' as const
      }
    })()

    // 2. Classification
    // Compute memory text once — reused for both routing and system prompt
    const memoryText = formatMemoryForPrompt(userMemoryRef.current)
    const recentCtx = buildRecentContext(
      messagesRef.current.filter(m => m.content.trim()).map(m => ({
        role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }))
    )
    const classifyPromise = (async () => {
      try {
        const loomRoutingCtx = buildRoutingContext(loomRef.current)
        return await classifyIntent(trimmed, recentCtx, filesToSend.length > 0, loomRoutingCtx || undefined, memoryText || undefined)
      } catch (err) {
        console.error('[engine] classifyIntent failed:', err)
        return { agentId: 'kernel' as const, confidence: 0.5, complexity: 0.3, needsSwarm: false, needsResearch: false, isMultiStep: false, needsImageGen: false, needsImageRefinement: false }
      }
    })()

    // 3. URL fetching (only if links present)
    const urls = trimmed.match(LINK_REGEX)
    const urlPromise = (async () => {
      if (!urls || urls.length === 0) return ''
      const fetches = await Promise.all(urls.slice(0, 3).map(async (url) => {
        if (isPlatformShareLink(url)) {
          try {
            const result = await importConversation(url)
            if (result.messages.length > 0) {
              return formatImportedContext(result, '')
            }
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
      return fetches.filter(Boolean).join('\n')
    })()

    // Await all three in parallel
    const [convResult, classifyResult, urlContext] = await Promise.all([convPromise, classifyPromise, urlPromise])

    // Handle conversation creation result
    let convId: string
    if (convResult === 'session_expired') {
      setMessages(prev => prev.filter(m => m.id !== userMsgId))
      setIsStreaming(false)
      setIsThinking(false)
      showToast('Session expired. Signing you out — please sign back in.')
      signOut()
      return
    } else if (!convResult) {
      setMessages(prev => prev.filter(m => m.id !== userMsgId))
      setIsStreaming(false)
      setIsThinking(false)
      showToast('Failed to create conversation. Please try again.')
      return
    } else {
      convId = convResult
      if (!activeConversationId) setActiveConversationId(convId)
    }

    // Track which conversation is streaming — UI updates are skipped if user switches away
    streamingConvIdRef.current = convId
    const isStillActive = () => activeConvIdRef.current === convId || activeConvIdRef.current === null
    // Guarded setMessages — only updates UI if this conversation is still in view
    const guardedSetMessages: typeof setMessages = (updater) => {
      if (isStillActive()) setMessages(updater)
    }

    // Handle classification result
    let classification = classifyResult
    if (crisisActive && crisisSeverity === 'high') {
      classification = { ...classification, agentId: 'kernel', needsSwarm: false, needsResearch: false, isMultiStep: false, needsImageGen: false, needsImageRefinement: false }
    }
    const specialist = getSpecialist(classification.agentId)
    setThinkingAgent(specialist.name)

    // Build content blocks for Claude API
    let userContent: string | ContentBlock[] = urlContext
      ? `${urlContext}\n---\n${trimmed}`
      : trimmed

    if (filesToSend.length > 0) {
      const blocks: ContentBlock[] = []
      let textPrefix = ''

      // Process files in parallel for speed
      const fileResults = await Promise.all(filesToSend.map(async (file) => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()

        if (isAudioFile(file)) {
          try {
            const result = await transcribeAudio(file)
            const duration = result.duration_seconds ? ` (${Math.round(result.duration_seconds)}s)` : ''
            return { type: 'text' as const, text: `[Audio transcription: ${file.name}${duration}]\n${result.text}\n\n` }
          } catch (err) {
            console.warn('[Transcribe] Failed:', err)
            return { type: 'text' as const, text: `[Audio: ${file.name} — transcription failed]\n\n` }
          }
        } else if (TEXT_EXTENSIONS.includes(ext)) {
          let text = await readFileAsText(file)
          const MAX_TEXT_CHARS = 30000
          if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS) + `\n\n[... truncated — file was ${(text.length / 1000).toFixed(0)}K chars, showing first ${(MAX_TEXT_CHARS / 1000).toFixed(0)}K]`
          }
          return { type: 'text' as const, text: `[File: ${file.name}]\n${text}\n\n` }
        } else if (isImageFile(file)) {
          const data = await fileToBase64(file)
          return { type: 'image' as const, block: { type: 'image', source: { type: 'base64', media_type: getMediaType(file), data } } as ContentBlock }
        } else if (isPdfFile(file)) {
          const data = await fileToBase64(file)
          const docBlock: ContentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
          return { type: 'pdf' as const, block: docBlock, file, data }
        }
        return null
      }))

      // Collect results preserving order
      for (const result of fileResults) {
        if (!result) continue
        if (result.type === 'text') textPrefix += result.text
        else if (result.type === 'image') blocks.push(result.block)
        else if (result.type === 'pdf') {
          blocks.push(result.block)
          if (isPro) {
            setActiveDocument({
              name: result.file.name,
              type: result.file.type || 'application/pdf',
              dataUrl: `data:application/pdf;base64,${result.data}`,
              contentBlock: result.block,
            })
          }
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

    // Build system prompt (memoryText computed above alongside classification)
    const snapshot = serializeState(engine.getState())
    const memoryBlock = memoryText
      ? `\n\n---\n\n## User Memory\nYou know this about the user from previous conversations. Weave this knowledge naturally into your responses — reference their interests, goals, and facts when relevant. Never say "I don't know anything about you" when this context exists.\n\n${memoryText}`
      : ''
    const mirrorText = formatMirrorForPrompt(userMirrorRef.current)
    const mirrorBlock = mirrorText
      ? `\n\n## Mirror\nDeeper patterns the agents have noticed together:\n\n${mirrorText}`
      : ''
    // Craft calibration — inject coder-specific adaptation when routing to coder
    const craftBlock = specialist.id === 'coder'
      ? (() => {
          const craftText = formatCraftCalibration(userMirrorRef.current)
          return craftText ? `\n\n${craftText}` : ''
        })()
      : ''
    const selfMirrorText = formatSelfMirror(loomRef.current)
    const selfBlock = selfMirrorText
      ? `\n\n## Self\nWhat the Loom sees about how I serve this user:\n\n${selfMirrorText}`
      : ''
    const kgText = formatGraphForPrompt(kgEntities, kgRelations)
    const kgBlock = kgText
      ? `\n\n## Knowledge Graph\nStructured facts and relationships you've learned:\n\n${kgText}`
      : ''
    const collectiveBlock = collectiveInsights.length > 0
      ? `\n\n---\n\n## Collective Intelligence (learned from all users)\nThese patterns have emerged from conversations across all users. Use them to improve your responses:\n${collectiveInsights.map(i => `- [strength ${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
      : ''
    const goalBlock = getGoalCheckInPrompt(userGoalsRef.current)
    const docCitationBlock = activeDocumentRef.current
      ? `\n\n## Document Analysis Mode\nThe user has an active document loaded: "${activeDocumentRef.current.name}". When referencing the uploaded document, always cite specific locations using [p.X] notation for pages, [p.X-Y] for page ranges, [§X] for sections, or direct quotes in "quotation marks". Be precise about where information comes from in the document.`
      : ''
    // Explain mode — append pedagogical instructions when enabled
    const explainBlock = explainModeEnabled && specialist.id === 'coder' ? EXPLAIN_MODE_SUFFIX : ''
    // Project manifest — inject file context for coder
    const projectManifest = activeConversationId && specialist.id === 'coder'
      ? (() => {
          const manifest = formatProjectManifest(activeConversationId)
          return manifest ? `\n\n${manifest}` : ''
        })()
      : ''
    // Crisis mode — reinforce protocol with formatted resources
    const crisisBlock = crisisActive
      ? `\n\n## CRISIS MODE ACTIVE\nThe user may be in emotional distress. Lead with empathy. Acknowledge their pain before anything else.\n\nResources to weave naturally into your response:\n${formatCrisisResourcesForPrompt()}\n\nDo NOT recite resources mechanically. Be a person first.`
      : ''
    // Build conversation context — summarize prior messages so Claude actively references them
    const priorMessages = messagesRef.current.filter(m => m.content.trim() !== '')
    const conversationContextBlock = priorMessages.length >= 2
      ? (() => {
          const topics = new Set<string>()
          const userPoints: string[] = []
          for (const m of priorMessages.slice(-12)) {
            if (m.role === 'user') {
              const summary = m.content.slice(0, 120).replace(/\n+/g, ' ').trim()
              if (summary) userPoints.push(summary)
            }
            // Extract key topics from both sides (reuses textAnalysis utility)
            extractKeyEntities(m.content.slice(0, 200)).forEach(w => topics.add(w))
          }
          const topicStr = [...topics].slice(0, 8).join(', ')
          const pointsStr = userPoints.slice(-4).map(p => `- ${p}`).join('\n')
          return `\n\n## Conversation Context\nYou have full access to this conversation's history (${priorMessages.length} messages). Reference earlier messages naturally when relevant. Do NOT say you can't see or remember what was discussed.\n\n**Topics discussed:** ${topicStr || 'various'}\n**Recent user messages:**\n${pointsStr}`
        })()
      : ''

    // Recent conversations — derived from already-loaded conversations list (always fresh)
    const recentConvTitles = params.conversations
      .filter(c => c.title !== 'New Conversation' && c.id !== activeConversationId)
      .slice(0, 6)
    const recentConvsBlock = recentConvTitles.length > 0
      ? `\n\n## Recent Conversations\nThese are the user's recent conversation topics. You can reference them if the user asks about previous discussions.\n${recentConvTitles.map(c => `- ${c.title}`).join('\n')}`
      : ''

    // Conversation summary — inject cached summary of older messages for long conversations
    const summaryBlock = convSummaryRef.current
      ? `\n\n${formatSummaryForPrompt(convSummaryRef.current)}`
      : ''

    const systemPrompt = `${specialist.systemPrompt}${explainBlock}\n\n---\n\n${snapshot}${memoryBlock}${mirrorBlock}${craftBlock}${selfBlock}${kgBlock}${goalBlock}${collectiveBlock}${recentConvsBlock}${summaryBlock}${conversationContextBlock}${docCitationBlock}${projectManifest}${crisisBlock}`

    const kernelId = `kernel_${Date.now()}`
    guardedSetMessages(prev => [...prev, {
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
    // If there's an active document and no file was just attached, re-inject the
    // document content block so Claude retains document context for follow-up questions
    const docRef = activeDocumentRef.current
    const hasNewFileAttachment = filesToSend.length > 0
    if (docRef && !hasNewFileAttachment && typeof userContent === 'string') {
      userContent = [
        docRef.contentBlock,
        { type: 'text', text: `[Continuing analysis of: ${docRef.name}]\n\n${userContent}` },
      ] as ContentBlock[]
    }

    // If there's a recently generated image, inject it so Claude can reference/describe it.
    // Look for the most recent generated image in conversation history (within last 10 messages).
    if (!classification.needsImageGen && typeof userContent === 'string') {
      const recentMsgs = messagesRef.current.slice(-10)
      for (let i = recentMsgs.length - 1; i >= 0; i--) {
        const msg = recentMsgs[i]
        if (msg.generatedImages && msg.generatedImages.length > 0) {
          const lastImg = msg.generatedImages[msg.generatedImages.length - 1]
          // Use in-memory base64 if available, otherwise try the storage URL
          let imageBase64: string | null = null
          let imageMimeType: string = lastImg.mimeType || 'image/png'
          if (lastImg.image) {
            imageBase64 = lastImg.image
          } else if (lastImg.image_url) {
            try {
              const imgRes = await fetch(lastImg.image_url)
              const blob = await imgRes.blob()
              imageBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                  const dataUrl = reader.result as string
                  resolve(dataUrl.split(',')[1] || '')
                }
                reader.readAsDataURL(blob)
              })
            } catch { /* skip — Claude just won't see the image */ }
          }
          if (imageBase64) {
            userContent = [
              {
                type: 'image',
                source: { type: 'base64', media_type: imageMimeType, data: imageBase64 },
              } as ContentBlock,
              { type: 'text', text: `[This is the most recently generated image in our conversation]\n\n${userContent}` },
            ] as ContentBlock[]
          }
          break
        }
      }
    }

    const claudeMessages: { role: string; content: string | ContentBlock[] }[] = [
      ...sanitized,
      { role: 'user', content: userContent },
    ]

    const updateKernelMsg = (text: string, thinkingText?: string) => {
      if (isThinkingRef.current && (text || thinkingText) && isStillActive()) { setIsThinking(false); setThinkingAgent(null); isThinkingRef.current = false }
      latestKernelContentRef.current = text
      guardedSetMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: text, thinking: thinkingText ?? m.thinking } : m))
    }

    let swarmAgentIds: string[] | null = null
    // When files are attached (images, PDFs), always use direct Claude call.
    // Swarm/workflow/research paths only pass string content, losing ContentBlock[].
    const hasFileContent = Array.isArray(userContent)
    try {
      // ── Image Generation (credit-gated) ────────────────
      if (classification.needsImageGen) {
        setThinkingAgent('Kernel')
        try {
          // ── Refinement: find previous generated image ──
          let previousImage: PreviousImage | undefined
          if (classification.needsImageRefinement) {
            const currentMsgs = messagesRef.current
            for (let i = currentMsgs.length - 1; i >= 0; i--) {
              const msg = currentMsgs[i]
              if (msg.generatedImages && msg.generatedImages.length > 0) {
                const lastImg = msg.generatedImages[msg.generatedImages.length - 1]
                // Use base64 if still in memory
                if (lastImg.image) {
                  previousImage = { base64: lastImg.image, mimeType: lastImg.mimeType }
                } else if (lastImg.image_url) {
                  // Fetch from storage URL and convert to base64
                  try {
                    const imgRes = await fetch(lastImg.image_url)
                    const blob = await imgRes.blob()
                    const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        const dataUrl = reader.result as string
                        resolve(dataUrl.split(',')[1] || '')
                      }
                      reader.readAsDataURL(blob)
                    })
                    previousImage = { base64, mimeType: lastImg.mimeType }
                  } catch (fetchErr) {
                    console.warn('[ImageGen] Failed to fetch previous image for refinement:', fetchErr)
                  }
                }
                break
              }
            }
          }

          // ── Reference images: pull from attachments + conversation history ──
          const referenceImages: ReferenceImage[] = []

          // 1. Current message attachments (highest priority — user explicitly attached them)
          for (const file of filesToSend) {
            if (isImageFile(file) && referenceImages.length < 4) {
              try {
                const data = await fileToBase64(file)
                referenceImages.push({ base64: data, mimeType: getMediaType(file) })
              } catch { /* skip failed reads */ }
            }
          }

          // 2. Recent uploaded images from conversation history
          if (referenceImages.length < 4) {
            const currentMsgs = messagesRef.current
            for (let i = currentMsgs.length - 1; i >= 0 && referenceImages.length < 4; i--) {
              const msg = currentMsgs[i]
              if (msg.role === 'user' && msg.imageDataUrls && msg.imageDataUrls.length > 0) {
                for (const dataUrl of msg.imageDataUrls) {
                  if (referenceImages.length >= 4) break
                  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
                  if (match) {
                    referenceImages.push({ base64: match[2], mimeType: match[1] })
                  }
                }
              }
            }
          }

          const result = await generateImage(trimmed, previousImage, referenceImages.length > 0 ? referenceImages : undefined)
          setIsThinking(false)
          isThinkingRef.current = false
          guardedSetMessages(prev => prev.map(m => m.id === kernelId
            ? { ...m, content: trimmed, generatedImages: [result] }
            : m
          ))
          latestKernelContentRef.current = `[Generated image: ${trimmed}]`
          // Persist a record of the generation
          saveMessage({
            id: kernelId,
            channel_id: convId,
            agent_id: 'kernel',
            content: `[Generated image: ${trimmed}]`,
            user_id: userId,
            ...(result.image_url && { attachments: [{ url: result.image_url, type: result.mimeType, name: `kernel-image.${(result.mimeType || 'image/png').split('/')[1] || 'png'}` }] }),
          })
          // Show toast if auto-reload was triggered
          if (result.auto_reloaded && result.reloaded_credits) {
            const packName = result.reloaded_pack
              ? result.reloaded_pack.charAt(0).toUpperCase() + result.reloaded_pack.slice(1)
              : 'Credit'
            showToast(`Auto-reloaded ${result.reloaded_credits} credits (${packName} pack)`)
          }
          touchConversation(convId)
          loadConversations()
          setIsStreaming(false)
          return
        } catch (imgErr) {
          if (imgErr instanceof ImageCreditError) {
            setIsThinking(false)
            isThinkingRef.current = false
            guardedSetMessages(prev => prev.map(m => m.id === kernelId
              ? { ...m, content: '*You need image credits to generate images. Purchase a credit pack to get started.*' }
              : m
            ))
            params.onShowCreditModal?.()
            setIsStreaming(false)
            return
          } else if (imgErr instanceof ImageGenLimitError) {
            setIsThinking(false)
            isThinkingRef.current = false
            guardedSetMessages(prev => prev.map(m => m.id === kernelId
              ? { ...m, content: '*Image generation rate limited. Please wait a moment and try again.*' }
              : m
            ))
            showToast('Image generation rate limited')
            setIsStreaming(false)
            return
          }
          // Other errors — fall through to normal routing as fallback
          console.warn('[ImageGen] Failed, falling through to normal response:', imgErr)
          classification = { ...classification, needsImageGen: false, needsImageRefinement: false }
        }
      }

      if (!hasFileContent && classification.isMultiStep && classification.needsResearch && isPro) {
        // Agentic Workflow: multi-step + research = autonomous workflow execution
        const { AgenticWorkflow } = await import('../engine/AgenticWorkflow')
        const workflow = new AgenticWorkflow(systemPrompt, {
          onProgress: () => {},
          onChunk: updateKernelMsg,
          onStepsUpdate: (steps) => {
            setWorkflowSteps(steps)
            guardedSetMessages(prev => prev.map(m => m.id === kernelId
              ? { ...m, workflowSteps: steps }
              : m
            ))
          },
        })
        workflowRef.current = workflow
        setIsWorkflowActive(true)
        setWorkflowSteps([])
        const workflowConvContext = messagesRef.current
          .filter(m => m.content.trim())
          .slice(-10)
          .map(m => `${m.role === 'user' ? 'User' : (m.agentName || 'Kernel')}: ${m.content}`)
          .join('\n')
        // Enrich workflow context with user memory so task planning is personalized
        const workflowMemoryCtx = memoryText ? `\nUser context:\n${memoryText}\n\n` : ''
        await workflow.execute(trimmed, workflowMemoryCtx + workflowConvContext)
        setIsWorkflowActive(false)
        workflowRef.current = null
      } else if (!hasFileContent && classification.isMultiStep && isPro) {
        const plan = await planTask(trimmed)
        setTaskProgress({ plan, currentStep: 0 })
        await executeTask(
          plan,
          memoryText,
          (progress) => setTaskProgress(progress),
          updateKernelMsg
        )
        setTaskProgress(null)
      } else if (!hasFileContent && classification.needsSwarm && isPro) {
        const history = messagesRef.current
          .filter(m => m.content.trim())
          .map(m => ({
            role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
            content: m.content,
          }))
        const loomSwarmCtx = buildSwarmContext(loomRef.current)
        await runSwarm(
          trimmed,
          memoryText,
          history,
          (progress) => {
            setSwarmProgress(progress)
            if (progress.agents.length > 0 && !swarmAgentIds) {
              swarmAgentIds = progress.agents.map(a => a.id)
            }
          },
          updateKernelMsg,
          loomSwarmCtx || undefined,
        )
        setSwarmProgress(null)
      } else if (!hasFileContent && classification.needsResearch && isPro) {
        await deepResearch(
          userContent,
          memoryText,
          (progress) => setResearchProgress(progress),
          updateKernelMsg
        )
        setResearchProgress(null)
      } else {
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        const userMsgCount = messagesRef.current.filter(m => m.role === 'user').length
        const routingCtx = {
          messageWordCount: trimmed.split(/\s+/).length,
          turnCount: userMsgCount,
          extendedThinking: extendedThinkingEnabled && isPro,
        }
        const autoModel = resolveModelFromClassification(classification, routingCtx)
        console.log(`[engine] Auto-selected model: ${autoModel} (complexity: ${classification.complexity}, words: ${routingCtx.messageWordCount}, turns: ${userMsgCount})`)
        // Content-producing agents (writer, coder, aesthete) need higher token budgets
        const isContentAgent = specialist.id === 'writer' || specialist.id === 'coder' || specialist.id === 'aesthete'
        const maxTokens = isContentAgent
          ? (autoModel === 'haiku' ? 8192 : 16384)
          : (autoModel === 'haiku' ? 4096 : 8192)
        const streamResult = await claudeStreamChat(
          claudeMessages,
          updateKernelMsg,
          {
            system: systemPrompt,
            model: autoModel,
            max_tokens: maxTokens,
            web_search: specialist.id === 'researcher' || specialist.id === 'kernel',
            signal: abortController.signal,
            thinking: extendedThinkingEnabled && isPro ? { type: 'enabled', budget_tokens: 10000 } : undefined,
            onThinking: extendedThinkingEnabled && isPro ? (text: string) => { setCurrentThinking(text) } : undefined,
          }
        )
        streamAbortRef.current = null
        // Store thinking text on the assistant message when complete
        if (streamResult.thinking) {
          guardedSetMessages(prev => prev.map(m => m.id === kernelId ? { ...m, thinking: streamResult.thinking } : m))
        }
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
        const signalSaved = await saveResponseSignal({
          id: signalId,
          user_id: userId,
          conversation_id: convId,
          topic,
          response_quality: 'neutral',
        })
        if (topic.length > 3) {
          upsertCollectiveInsight(topic)
        }
        // Only show feedback buttons if signal was persisted — clicking them updates the signal row
        if (signalSaved) {
          guardedSetMessages(prev => prev.map(m => m.id === kernelId ? { ...m, signalId } : m))
        }
      }
      touchConversation(convId)
      loadConversations()

      // Loom — capture pending outcome (resolved on next user message)
      if (finalContent) {
        pendingOutcomeRef.current = {
          classification,
          agentUsed: specialist.id,
          swarmComposition: swarmAgentIds,
          modelUsed: resolveModelFromClassification(classification, {
            messageWordCount: trimmed.split(/\s+/).length,
            turnCount: messagesRef.current.filter(m => m.role === 'user').length,
            extendedThinking: extendedThinkingEnabled && isPro,
          }),
          responseContent: finalContent,
          timestamp: Date.now(),
          previousUserMsg: trimmed,
        }
      }

      // Background memory + KG + convergence extraction every 3 messages
      // Also extract on first response if no memory exists (bootstrap)
      // CRISIS GUARD: skip all persistent extraction when crisis is active
      messageCountRef.current++
      const currentMsgCount = messageCountRef.current
      const shouldExtract = isEmptyProfile(userMemoryRef.current)
        ? currentMsgCount >= 1  // Bootstrap: extract on first response if no memory
        : currentMsgCount % 3 === 0  // Regular: extract every 3 messages
      if (shouldExtract && !crisisActive && params.planLimits?.memory !== false) {
        guardedSetMessages(currentMsgs => {
          const recentMsgs = currentMsgs
            .slice(-10)
            .filter(m => m.content.trim())
            .map(m => ({ role: m.role === 'kernel' ? 'assistant' : 'user', content: m.content }))
          if (recentMsgs.length > 0) {
            // Memory extraction with warmth tracking + decay
            extractMemory(recentMsgs).then(async (newProfile) => {
              const hasData = newProfile.interests.length > 0 || newProfile.goals.length > 0 ||
                newProfile.facts.length > 0 || newProfile.communication_style.length > 0
              if (!hasData) return
              const merged = await mergeMemory(userMemoryRef.current, newProfile)
              const withWarmth = updateWarmth(merged, userMemoryRef.current)
              const decayed = applyProfileDecay(withWarmth)
              setUserMemory(decayed)
              await upsertUserMemory(userId, decayed as unknown as Record<string, unknown>, currentMsgCount)
            }).catch((err) => console.warn('[Memory] Periodic extraction failed:', err))

            // Conversation summarization — summarize older messages in long conversations
            if (currentMsgs.length >= SUMMARY_THRESHOLD) {
              const allMsgs = currentMsgs.filter(m => m.content.trim()).map(m => ({
                role: m.role === 'kernel' ? 'assistant' : 'user',
                content: m.content,
              }))
              const toSummarize = getMessagesToSummarize(allMsgs, convSummaryRef.current)
              if (toSummarize) {
                summarizeConversation(toSummarize).then(text => {
                  if (!text) return
                  convSummaryRef.current = {
                    text,
                    messagesCovered: toSummarize.length,
                    generatedAt: Date.now(),
                  }
                  console.log(`[Summarizer] Summarized ${toSummarize.length} older messages`)
                }).catch(err => console.warn('[Summarizer] Failed:', err))
              }
            }

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
        guardedSetMessages(prev => prev.filter(m => m.id !== kernelId))
      } else if (err instanceof MonthlyLimitError) {
        setShowUpgradeWall(true)
        guardedSetMessages(prev => prev.filter(m => m.id !== kernelId))
      } else if (err instanceof FairUseLimitError) {
        const resetDate = err.resetsAt ? new Date(err.resetsAt).toLocaleDateString([], { month: 'long', day: 'numeric' }) : 'the 1st of next month'
        guardedSetMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*You've reached your fair use limit for this month. Your messages reset on ${resetDate}. We'll see you then.*\n\n*If you think this is an error, contact support at hi@kernel.chat*` }
          : m
        ))
      } else if (err instanceof ProLimitError) {
        const resetTime = err.resetsAt ? new Date(err.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'soon'
        guardedSetMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*You've used all ${err.limit} messages for today. Resets at ${resetTime}.*` }
          : m
        ))
      } else if (err instanceof FileLimitError) {
        guardedSetMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*File analysis is a Pro feature. Upgrade to analyze images and documents.*` }
          : m
        ))
        setShowUpgradeWall(true)
      } else if (err instanceof ImageLimitError) {
        guardedSetMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*You've used all ${err.limit} free image analyses for today.${err.resetsAt ? ` Resets at ${new Date(err.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : ''} Upgrade to Pro for more image analysis.*` }
          : m
        ))
        showToast(`Daily image limit reached (${err.used}/${err.limit})`)
      } else if (err instanceof PlatformRefundError) {
        // Platform error — message was auto-refunded, show friendly notice
        guardedSetMessages(prev => prev.map(m => m.id === kernelId
          ? { ...m, content: `*Something went wrong on our end. Your message has been refunded automatically — please try again.*` }
          : m
        ))
        showToast('Message refunded — something went wrong on our end')
      } else if (err instanceof RateLimitError) {
        guardedSetMessages(prev => prev.filter(m => m.id !== kernelId))
      } else {
        const errMsg = err instanceof Error ? err.message : 'Failed to reach kernel.chat'
        guardedSetMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: `*${errMsg}*` } : m))
      }
      setResearchProgress(null)
      setTaskProgress(null)
      setSwarmProgress(null)
      setIsWorkflowActive(false)
      workflowRef.current = null
    } finally {
      streamingConvIdRef.current = null
      if (isStillActive()) {
        setIsStreaming(false)
        setIsThinking(false)
      }
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
    // Cancel any active workflow
    if (workflowRef.current) {
      workflowRef.current.cancel()
      workflowRef.current = null
    }
    setIsWorkflowActive(false)
  }, [])

  // Cancel workflow specifically
  const cancelWorkflow = useCallback(() => {
    if (workflowRef.current) {
      workflowRef.current.cancel()
      workflowRef.current = null
    }
    setIsWorkflowActive(false)
  }, [])

  // Clear active document (manual dismiss)
  const clearDocument = useCallback(() => {
    setActiveDocument(null)
  }, [])

  // Inject a proactive "Kernel noticed..." message into a new conversation
  const injectProactiveMessage = useCallback(async (text: string) => {
    handleNewChat()
    // Small delay to let the new chat state settle
    await new Promise(r => setTimeout(r, 200))
    const proactiveId = `proactive_${Date.now()}`
    const proactiveMsg: ChatMessage = {
      id: proactiveId,
      role: 'kernel',
      content: text,
      timestamp: Date.now(),
      agentId: 'kernel',
      agentName: 'Kernel',
      isProactive: true,
    }
    setMessages([proactiveMsg])
  }, [handleNewChat])

  return {
    engine, engineState, events,
    messages, setMessages,
    input, setInput,
    isStreaming, isThinking, thinkingAgent,
    researchProgress, taskProgress, swarmProgress,
    workflowSteps, isWorkflowActive, cancelWorkflow,
    userMemory, kgEntities, kgRelations, userGoals, setUserGoals,
    todayBriefing,
    inputRef, sendMessage, handleSubmit, stopStreaming,
    messageCountRef,
    handleBriefingGoDeeper, handleBriefingAddGoal,
    userMirror,
    extendedThinkingEnabled, setExtendedThinkingEnabled,
    explainModeEnabled, setExplainModeEnabled,
    currentThinking, thinkingStartRef,
    activeDocument, hasActiveDocument: !!activeDocument, clearDocument,
    injectProactiveMessage,
  }
}
