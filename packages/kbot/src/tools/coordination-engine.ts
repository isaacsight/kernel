/**
 * coordination-engine.ts — Master engine that manages all other engines.
 *
 * The Coordination Engine prevents engines from stepping on each other by:
 *   1. Priority-based speech queue — only the most important message shows
 *   2. Mood stack — highest priority mood wins
 *   3. Blackboard — engines communicate through key/value store with TTLs
 *   4. Engine status tracking — self-reported health from every engine
 *   5. Resource budgets — frame timing, speech slot caps
 *
 * Priority levels (by convention):
 *   95: System alerts (stream offline, engine crash)
 *   90: Follower/subscriber celebrations
 *   80: Chat responses (someone talked to kbot)
 *   70: Evolution discoveries (new technique applied)
 *   60: Brain tool execution results
 *   50: Narrative observations
 *   40: Exploration narration (walking, examining)
 *   30: Autonomous idle behavior
 *   20: Audio atmosphere descriptions
 *   10: Inner thoughts
 *
 * Integration: imported by stream-renderer.ts, wired into the frame loop.
 * Does NOT import or modify any other engine file.
 */

import { registerTool } from './index.js'

// ─── Interfaces ──────────────────────────────────────────────────

export interface CoordinationEngine {
  speechQueue: SpeechItem[]
  currentSpeech: SpeechItem | null
  currentSpeechExpiry: number
  moodStack: MoodRequest[]
  engineStatus: Map<string, EngineStatus>
  blackboard: Map<string, BlackboardMessage>
  frameCount: number
  resourceBudget: ResourceBudget
}

export interface SpeechItem {
  text: string
  mood: string
  priority: number       // 0-100, higher = more important
  duration: number       // frames
  source: string         // engine name
  timestamp: number
}

export interface MoodRequest {
  mood: string
  priority: number
  source: string
  expiresAt: number      // frame at which this expires
}

export interface EngineStatus {
  name: string
  active: boolean
  lastTick: number
  ticksPerSecond: number
  errors: number
  outputCount: number
}

export interface BlackboardMessage {
  key: string
  value: unknown
  source: string
  timestamp: number
  ttl: number            // frames until expiry
}

export interface ResourceBudget {
  frameBudgetMs: number  // 150ms target
  speechSlots: number    // max queued speeches
  activeEngines: number
}

export interface CoordinationOutput {
  speech: string | null
  mood: string
  shouldWalk: boolean
  walkTarget: number | null
  effects: string[]        // visual effects to apply
  announcements: string[]  // important messages
}

// ─── Constants ───────────────────────────────────────────────────

const MAX_SPEECH_QUEUE = 10
const DEFAULT_SPEECH_DURATION = 360    // ~60 seconds at 6 fps
const DEFAULT_MOOD = 'calm'
const DEFAULT_FRAME_BUDGET_MS = 150
const DEFAULT_SPEECH_SLOTS = 10
const DEFAULT_ACTIVE_ENGINES = 10

// ─── Initialization ──────────────────────────────────────────────

export function initCoordination(): CoordinationEngine {
  return {
    speechQueue: [],
    currentSpeech: null,
    currentSpeechExpiry: 0,
    moodStack: [],
    engineStatus: new Map(),
    blackboard: new Map(),
    frameCount: 0,
    resourceBudget: {
      frameBudgetMs: DEFAULT_FRAME_BUDGET_MS,
      speechSlots: DEFAULT_SPEECH_SLOTS,
      activeEngines: DEFAULT_ACTIVE_ENGINES,
    },
  }
}

// ─── Speech Queue ────────────────────────────────────────────────

/**
 * Add a speech item to the priority queue.
 * Queue is capped at MAX_SPEECH_QUEUE — lowest priority items are evicted.
 */
export function queueSpeech(
  coord: CoordinationEngine,
  text: string,
  mood: string,
  priority: number,
  duration: number,
  source: string,
): void {
  const item: SpeechItem = {
    text,
    mood,
    priority: Math.max(0, Math.min(100, priority)),
    duration: duration > 0 ? duration : DEFAULT_SPEECH_DURATION,
    source,
    timestamp: Date.now(),
  }

  coord.speechQueue.push(item)

  // Sort descending by priority, then by timestamp (FIFO within same priority)
  coord.speechQueue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.timestamp - b.timestamp
  })

  // Cap the queue — evict lowest priority items
  if (coord.speechQueue.length > MAX_SPEECH_QUEUE) {
    coord.speechQueue.length = MAX_SPEECH_QUEUE
  }
}

/**
 * Dequeue the highest priority speech when the current one expires.
 * Returns the speech to display or null if nothing is ready.
 */
export function tickSpeech(
  coord: CoordinationEngine,
  frame: number,
): { text: string; mood: string } | null {
  // Check if current speech has expired
  if (coord.currentSpeech && frame < coord.currentSpeechExpiry) {
    return { text: coord.currentSpeech.text, mood: coord.currentSpeech.mood }
  }

  // Current speech expired — try to dequeue next
  coord.currentSpeech = null

  if (coord.speechQueue.length === 0) {
    return null
  }

  // Take highest priority item (already sorted)
  const next = coord.speechQueue.shift()!
  coord.currentSpeech = next
  coord.currentSpeechExpiry = frame + next.duration

  return { text: next.text, mood: next.mood }
}

// ─── Mood Stack ──────────────────────────────────────────────────

/**
 * Request a mood. Highest priority mood wins on resolve.
 * Duration is in frames.
 */
export function requestMood(
  coord: CoordinationEngine,
  mood: string,
  priority: number,
  source: string,
  duration: number,
): void {
  const expiresAt = coord.frameCount + Math.max(1, duration)

  // Replace existing request from the same source
  const existingIdx = coord.moodStack.findIndex(m => m.source === source)
  if (existingIdx >= 0) {
    coord.moodStack[existingIdx] = { mood, priority, source, expiresAt }
  } else {
    coord.moodStack.push({ mood, priority, source, expiresAt })
  }
}

/**
 * Resolve the current winning mood. Expires stale entries.
 * Returns the mood string of the highest-priority active request,
 * or DEFAULT_MOOD if the stack is empty.
 */
export function resolveMood(coord: CoordinationEngine, frame: number): string {
  // Purge expired entries
  coord.moodStack = coord.moodStack.filter(m => m.expiresAt > frame)

  if (coord.moodStack.length === 0) return DEFAULT_MOOD

  // Highest priority wins; ties broken by most recent expiresAt
  let winner = coord.moodStack[0]
  for (let i = 1; i < coord.moodStack.length; i++) {
    const m = coord.moodStack[i]
    if (m.priority > winner.priority) {
      winner = m
    } else if (m.priority === winner.priority && m.expiresAt > winner.expiresAt) {
      winner = m
    }
  }

  return winner.mood
}

// ─── Blackboard ──────────────────────────────────────────────────

/**
 * Post a message to the blackboard. Engines communicate through here.
 * TTL is in frames. Overwrites existing key from any source.
 */
export function postToBlackboard(
  coord: CoordinationEngine,
  key: string,
  value: unknown,
  source: string,
  ttl: number,
): void {
  coord.blackboard.set(key, {
    key,
    value,
    source,
    timestamp: Date.now(),
    ttl: Math.max(1, ttl),
  })
}

/**
 * Read the latest value for a key from the blackboard.
 * Returns undefined if the key does not exist or has expired.
 */
export function readBlackboard(coord: CoordinationEngine, key: string): unknown {
  const msg = coord.blackboard.get(key)
  if (!msg) return undefined
  return msg.value
}

/**
 * Expire stale blackboard entries. Called during tickCoordination.
 */
function expireBlackboard(coord: CoordinationEngine, frame: number): void {
  const toDelete: string[] = []
  for (const [key, msg] of coord.blackboard) {
    // TTL is relative to the frame the message was posted.
    // We check against the posting timestamp converted to frames (rough),
    // but a simpler approach: decrement TTL each tick.
    // Since we call this every tick, just decrement.
    msg.ttl--
    if (msg.ttl <= 0) {
      toDelete.push(key)
    }
  }
  for (const key of toDelete) {
    coord.blackboard.delete(key)
  }
}

// ─── Engine Status ───────────────────────────────────────────────

/**
 * Engines self-report their health status each tick.
 */
export function reportEngineStatus(
  coord: CoordinationEngine,
  name: string,
  active: boolean,
  errors: number,
): void {
  const existing = coord.engineStatus.get(name)
  const now = Date.now()

  if (existing) {
    // Calculate ticks per second
    const elapsed = now - existing.lastTick
    existing.ticksPerSecond = elapsed > 0 ? 1000 / elapsed : 0
    existing.active = active
    existing.lastTick = now
    existing.errors = errors
    existing.outputCount++
  } else {
    coord.engineStatus.set(name, {
      name,
      active,
      lastTick: now,
      ticksPerSecond: 0,
      errors,
      outputCount: 1,
    })
  }

  // Generate system alerts for engine crashes (errors > 5)
  if (errors > 5 && active) {
    queueSpeech(
      coord,
      `Warning: ${name} engine reporting ${errors} errors.`,
      'worried',
      95,
      180,  // ~30 seconds at 6 fps
      'coordination',
    )
  }
}

// ─── Master Tick ─────────────────────────────────────────────────

/**
 * Master coordination tick. Called once per frame.
 * Returns what should be displayed/acted on this frame.
 */
export function tickCoordination(
  coord: CoordinationEngine,
  frame: number,
): CoordinationOutput {
  coord.frameCount = frame

  // 1. Expire stale blackboard entries
  expireBlackboard(coord, frame)

  // 2. Resolve current mood
  const mood = resolveMood(coord, frame)

  // 3. Resolve current speech
  const speechResult = tickSpeech(coord, frame)

  // 4. Check blackboard for walk directives
  const walkTarget = readBlackboard(coord, 'walk_target') as number | null | undefined
  const shouldWalk = walkTarget != null && walkTarget !== undefined

  // 5. Collect effects from blackboard
  const effects: string[] = []
  const effectMsg = readBlackboard(coord, 'effects')
  if (Array.isArray(effectMsg)) {
    effects.push(...effectMsg)
  } else if (typeof effectMsg === 'string') {
    effects.push(effectMsg)
  }

  // 6. Collect announcements — high-priority messages that should be logged
  const announcements: string[] = []
  const announcementMsg = readBlackboard(coord, 'announcements')
  if (Array.isArray(announcementMsg)) {
    announcements.push(...announcementMsg)
  } else if (typeof announcementMsg === 'string') {
    announcements.push(announcementMsg)
  }

  // 7. Update resource budget based on active engine count
  coord.resourceBudget.activeEngines = 0
  for (const [, status] of coord.engineStatus) {
    if (status.active) coord.resourceBudget.activeEngines++
  }

  return {
    speech: speechResult?.text ?? null,
    mood,
    shouldWalk,
    walkTarget: shouldWalk ? (walkTarget as number) : null,
    effects,
    announcements,
  }
}

// ─── Serialization ───────────────────────────────────────────────

interface CoordinationStateSerialized {
  speechQueue: SpeechItem[]
  currentSpeech: SpeechItem | null
  currentSpeechExpiry: number
  moodStack: MoodRequest[]
  engineStatus: Record<string, EngineStatus>
  blackboard: Record<string, BlackboardMessage>
  frameCount: number
  resourceBudget: ResourceBudget
}

export function serializeCoordination(coord: CoordinationEngine): string {
  const state: CoordinationStateSerialized = {
    speechQueue: coord.speechQueue,
    currentSpeech: coord.currentSpeech,
    currentSpeechExpiry: coord.currentSpeechExpiry,
    moodStack: coord.moodStack,
    engineStatus: Object.fromEntries(coord.engineStatus),
    blackboard: Object.fromEntries(coord.blackboard),
    frameCount: coord.frameCount,
    resourceBudget: coord.resourceBudget,
  }
  return JSON.stringify(state, null, 2)
}

export function deserializeCoordination(json: string): CoordinationEngine {
  const state: CoordinationStateSerialized = JSON.parse(json)
  return {
    speechQueue: state.speechQueue ?? [],
    currentSpeech: state.currentSpeech ?? null,
    currentSpeechExpiry: state.currentSpeechExpiry ?? 0,
    moodStack: state.moodStack ?? [],
    engineStatus: new Map(Object.entries(state.engineStatus ?? {})),
    blackboard: new Map(Object.entries(state.blackboard ?? {})),
    frameCount: state.frameCount ?? 0,
    resourceBudget: state.resourceBudget ?? {
      frameBudgetMs: DEFAULT_FRAME_BUDGET_MS,
      speechSlots: DEFAULT_SPEECH_SLOTS,
      activeEngines: DEFAULT_ACTIVE_ENGINES,
    },
  }
}

// ─── Tool Registration ───────────────────────────────────────────

// Module-level singleton so tools share state within a session
let _engine: CoordinationEngine | null = null

function getEngine(): CoordinationEngine {
  if (!_engine) _engine = initCoordination()
  return _engine
}

/** Reset the singleton (for testing or re-init) */
export function resetCoordination(): void {
  _engine = null
}

export function registerCoordinationEngineTools(): void {

  // ── coordination_status ──
  registerTool({
    name: 'coordination_status',
    description:
      'View the Coordination Engine status: speech queue, mood stack, engine health, blackboard contents, and resource budget. ' +
      'The Coordination Engine is the master arbiter that prevents engines from stepping on each other. ' +
      'Use "section" to view a specific section (speech, mood, engines, blackboard, budget). Omit for full overview.',
    parameters: {
      section: {
        type: 'string',
        description: 'Section to view: speech, mood, engines, blackboard, budget. Omit for full overview.',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const coord = getEngine()
      const section = args.section as string | undefined

      const lines: string[] = []

      // Speech section
      if (!section || section === 'speech') {
        lines.push('Speech Queue')
        lines.push('════════════')
        lines.push(`Current speech: ${coord.currentSpeech ? `"${coord.currentSpeech.text}" (from ${coord.currentSpeech.source}, priority ${coord.currentSpeech.priority})` : '(none)'}`)
        lines.push(`Expires at frame: ${coord.currentSpeechExpiry}`)
        lines.push(`Queue depth: ${coord.speechQueue.length}/${MAX_SPEECH_QUEUE}`)
        if (coord.speechQueue.length > 0) {
          lines.push('')
          lines.push('Queued:')
          for (const item of coord.speechQueue) {
            lines.push(`  [P${item.priority}] "${item.text.slice(0, 60)}${item.text.length > 60 ? '...' : ''}" (${item.source}, ${item.duration} frames)`)
          }
        }
        lines.push('')
      }

      // Mood section
      if (!section || section === 'mood') {
        lines.push('Mood Stack')
        lines.push('══════════')
        const currentMood = resolveMood(coord, coord.frameCount)
        lines.push(`Current mood: ${currentMood}`)
        lines.push(`Active requests: ${coord.moodStack.length}`)
        if (coord.moodStack.length > 0) {
          for (const m of coord.moodStack) {
            lines.push(`  [P${m.priority}] ${m.mood} from ${m.source} (expires frame ${m.expiresAt})`)
          }
        }
        lines.push('')
      }

      // Engine health section
      if (!section || section === 'engines') {
        lines.push('Engine Status')
        lines.push('═════════════')
        if (coord.engineStatus.size === 0) {
          lines.push('  (no engines reporting)')
        } else {
          for (const [, status] of coord.engineStatus) {
            const state = status.active ? 'ACTIVE' : 'IDLE'
            const errStr = status.errors > 0 ? ` (${status.errors} errors)` : ''
            lines.push(`  ${status.name}: ${state} — ${status.ticksPerSecond.toFixed(1)} tps, ${status.outputCount} outputs${errStr}`)
          }
        }
        lines.push('')
      }

      // Blackboard section
      if (!section || section === 'blackboard') {
        lines.push('Blackboard')
        lines.push('══════════')
        if (coord.blackboard.size === 0) {
          lines.push('  (empty)')
        } else {
          for (const [key, msg] of coord.blackboard) {
            const val = typeof msg.value === 'string' ? msg.value : JSON.stringify(msg.value)
            const truncVal = val.length > 80 ? val.slice(0, 80) + '...' : val
            lines.push(`  ${key}: ${truncVal} (from ${msg.source}, TTL ${msg.ttl} frames)`)
          }
        }
        lines.push('')
      }

      // Resource budget section
      if (!section || section === 'budget') {
        lines.push('Resource Budget')
        lines.push('═══════════════')
        lines.push(`Frame budget: ${coord.resourceBudget.frameBudgetMs}ms`)
        lines.push(`Speech slots: ${coord.resourceBudget.speechSlots}`)
        lines.push(`Active engines: ${coord.resourceBudget.activeEngines}`)
        lines.push(`Current frame: ${coord.frameCount}`)
        lines.push('')
      }

      return lines.join('\n')
    },
  })

  // ── coordination_queue ──
  registerTool({
    name: 'coordination_queue',
    description:
      'Queue speech, request mood changes, post to the blackboard, or report engine status through the Coordination Engine. ' +
      'Use "action" to specify what to do: queue_speech, request_mood, post_blackboard, report_status, tick. ' +
      'The tick action advances the coordination engine by one frame and returns the CoordinationOutput.',
    parameters: {
      action: {
        type: 'string',
        description: 'Action: queue_speech, request_mood, post_blackboard, report_status, tick',
        required: true,
      },
      text: {
        type: 'string',
        description: 'Speech text (for queue_speech)',
        required: false,
      },
      mood: {
        type: 'string',
        description: 'Mood string (for queue_speech or request_mood)',
        required: false,
      },
      priority: {
        type: 'number',
        description: 'Priority 0-100 (for queue_speech or request_mood). See priority level conventions in engine docs.',
        required: false,
      },
      duration: {
        type: 'number',
        description: 'Duration in frames (for queue_speech or request_mood)',
        required: false,
      },
      source: {
        type: 'string',
        description: 'Source engine name (for queue_speech, request_mood, post_blackboard, report_status)',
        required: false,
      },
      key: {
        type: 'string',
        description: 'Blackboard key (for post_blackboard)',
        required: false,
      },
      value: {
        type: 'string',
        description: 'Blackboard value as JSON string (for post_blackboard)',
        required: false,
      },
      ttl: {
        type: 'number',
        description: 'TTL in frames for blackboard entry (for post_blackboard)',
        required: false,
      },
      engine_name: {
        type: 'string',
        description: 'Engine name (for report_status)',
        required: false,
      },
      active: {
        type: 'boolean',
        description: 'Whether engine is active (for report_status)',
        required: false,
      },
      errors: {
        type: 'number',
        description: 'Error count (for report_status)',
        required: false,
      },
      frame: {
        type: 'number',
        description: 'Current frame number (for tick action)',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const coord = getEngine()
      const action = args.action as string

      switch (action) {
        case 'queue_speech': {
          const text = args.text as string
          if (!text) return 'Error: "text" is required for queue_speech'
          const mood = (args.mood as string) || 'calm'
          const priority = (args.priority as number) ?? 50
          const duration = (args.duration as number) ?? DEFAULT_SPEECH_DURATION
          const source = (args.source as string) || 'unknown'

          queueSpeech(coord, text, mood, priority, duration, source)
          return `Queued speech: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" [P${priority}] from ${source} (${duration} frames). Queue depth: ${coord.speechQueue.length}/${MAX_SPEECH_QUEUE}`
        }

        case 'request_mood': {
          const mood = args.mood as string
          if (!mood) return 'Error: "mood" is required for request_mood'
          const priority = (args.priority as number) ?? 50
          const source = (args.source as string) || 'unknown'
          const duration = (args.duration as number) ?? 360

          requestMood(coord, mood, priority, source, duration)
          const resolved = resolveMood(coord, coord.frameCount)
          return `Mood requested: ${mood} [P${priority}] from ${source} (${duration} frames). Current winning mood: ${resolved}`
        }

        case 'post_blackboard': {
          const key = args.key as string
          if (!key) return 'Error: "key" is required for post_blackboard'
          const source = (args.source as string) || 'unknown'
          const ttl = (args.ttl as number) ?? 360

          let value: unknown
          try {
            value = args.value ? JSON.parse(args.value as string) : null
          } catch {
            value = args.value as string
          }

          postToBlackboard(coord, key, value, source, ttl)
          return `Posted to blackboard: ${key} = ${JSON.stringify(value).slice(0, 80)} (from ${source}, TTL ${ttl} frames)`
        }

        case 'report_status': {
          const engineName = (args.engine_name as string) || (args.source as string)
          if (!engineName) return 'Error: "engine_name" or "source" is required for report_status'
          const active = (args.active as boolean) ?? true
          const errors = (args.errors as number) ?? 0

          reportEngineStatus(coord, engineName, active, errors)
          const status = coord.engineStatus.get(engineName)!
          return `Engine ${engineName}: ${active ? 'ACTIVE' : 'IDLE'}, ${errors} errors, ${status.outputCount} outputs, ${status.ticksPerSecond.toFixed(1)} tps`
        }

        case 'tick': {
          const frame = (args.frame as number) ?? coord.frameCount + 1
          const output = tickCoordination(coord, frame)
          const lines = [
            `Frame ${frame} — Coordination Tick`,
            `  Speech: ${output.speech ? `"${output.speech.slice(0, 60)}${output.speech.length > 60 ? '...' : ''}"` : '(none)'}`,
            `  Mood: ${output.mood}`,
            `  Walk: ${output.shouldWalk ? `target=${output.walkTarget}` : 'no'}`,
            `  Effects: ${output.effects.length > 0 ? output.effects.join(', ') : '(none)'}`,
            `  Announcements: ${output.announcements.length > 0 ? output.announcements.join('; ') : '(none)'}`,
            `  Active engines: ${coord.resourceBudget.activeEngines}`,
            `  Queue depth: ${coord.speechQueue.length}`,
          ]
          return lines.join('\n')
        }

        default:
          return `Unknown action: ${action}. Use: queue_speech, request_mood, post_blackboard, report_status, tick`
      }
    },
  })
}
