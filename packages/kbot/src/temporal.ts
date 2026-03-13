// K:BOT Temporal Reasoning — Regret, Anticipation, and Identity
//
// Three systems that give the agent a sense of time:
//
// 1. REGRET & BACKTRACKING — Recognize mistakes and recover.
//    The agent creates checkpoints before risky operations and can
//    detect when the current path is failing (error loops, cost overruns,
//    circular tool calls). When regret is detected, it suggests which
//    checkpoint to revert to and what alternative approach to take.
//
// 2. ANTICIPATION — Predict what the user will ask next.
//    Based on common task sequences (fix → test → commit), current file
//    context, and learned user patterns, the agent pre-loads relevant
//    files and prepares context before being asked.
//
// 3. SESSION CONTINUITY / IDENTITY — Persistent agent personality.
//    An evolving identity that tracks total sessions, tool preferences,
//    personality dimensions (verbosity, caution, creativity, autonomy),
//    and milestones. Adjusts slowly over time based on user feedback.
//
// All persistence lives under ~/.kbot/ (identity.json, sequences.json,
// checkpoints are session-scoped and ephemeral).

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { registerTool } from './tools/index.js'

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface Checkpoint {
  id: string
  step: number
  timestamp: string
  description: string
  state: {
    filesModified: string[]
    toolsUsed: string[]
    decisions: string[]
  }
  canRevert: boolean
}

export interface RegretSignal {
  checkpoint: string
  reason: string
  severity: 'minor' | 'moderate' | 'critical'
  alternative: string
}

export interface Anticipation {
  prediction: string
  confidence: number
  preparation: string[]
  reasoning: string
}

export interface AgentIdentity {
  created: string
  totalSessions: number
  totalMessages: number
  totalToolCalls: number
  personality: {
    verbosity: number
    caution: number
    creativity: number
    autonomy: number
  }
  preferences: {
    favoriteTools: string[]
    avoidedPatterns: string[]
    userStyle: string
  }
  milestones: { date: string; event: string }[]
}

export interface SessionSummary {
  messages: number
  toolCalls: number
  toolsUsed: string[]
  errors: string[]
  duration: number
}

// ══════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════

const KBOT_DIR = join(homedir(), '.kbot')
const IDENTITY_PATH = join(KBOT_DIR, 'identity.json')
const SEQUENCES_PATH = join(KBOT_DIR, 'sequences.json')
const MAX_CHECKPOINTS = 20
const PERSONALITY_DELTA = 0.02
const PERSONALITY_MIN = 0.0
const PERSONALITY_MAX = 1.0

/** Common task sequences used for anticipation when no learned data exists */
const DEFAULT_SEQUENCES: Record<string, string[]> = {
  fix_bug: ['run_tests', 'commit'],
  add_feature: ['write_tests', 'update_docs'],
  refactor: ['run_tests', 'commit'],
  debug: ['read_logs', 'add_breakpoint', 'fix_bug'],
  review_pr: ['checkout_branch', 'run_tests', 'comment'],
  write_tests: ['run_tests', 'commit'],
  deploy: ['run_tests', 'build', 'push'],
  edit_file: ['run_tests', 'commit'],
  create_file: ['write_tests', 'commit'],
  read_file: ['edit_file', 'run_tests'],
}

/** File extension to related test file patterns */
const TEST_FILE_PATTERNS: Record<string, string> = {
  '.ts': '.test.ts',
  '.tsx': '.test.tsx',
  '.js': '.test.js',
  '.jsx': '.test.jsx',
  '.py': '_test.py',
  '.rs': '_test.rs',
  '.go': '_test.go',
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

function ensureKbotDir(): void {
  if (!existsSync(KBOT_DIR)) {
    mkdirSync(KBOT_DIR, { recursive: true })
  }
}

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(path: string, data: unknown): void {
  ensureKbotDir()
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

function generateId(): string {
  return `ckpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function inferTestFile(filePath: string): string | null {
  for (const [ext, testExt] of Object.entries(TEST_FILE_PATTERNS)) {
    if (filePath.endsWith(ext) && !filePath.includes('.test.') && !filePath.includes('_test.')) {
      return filePath.replace(new RegExp(`${ext.replace('.', '\\.')}$`), testExt)
    }
  }
  return null
}

// ══════════════════════════════════════════════════════════════════════
// 1. Regret & Backtracking
// ══════════════════════════════════════════════════════════════════════

let checkpoints: Checkpoint[] = []

/**
 * Save a snapshot before a risky operation.
 * Maintains a rolling window of MAX_CHECKPOINTS entries.
 */
export function createCheckpoint(
  description: string,
  state: Checkpoint['state'],
): Checkpoint {
  const checkpoint: Checkpoint = {
    id: generateId(),
    step: checkpoints.length,
    timestamp: new Date().toISOString(),
    description,
    state: {
      filesModified: [...state.filesModified],
      toolsUsed: [...state.toolsUsed],
      decisions: [...state.decisions],
    },
    canRevert: true,
  }

  checkpoints.push(checkpoint)

  // Rolling window — drop oldest when exceeding limit
  if (checkpoints.length > MAX_CHECKPOINTS) {
    checkpoints = checkpoints.slice(-MAX_CHECKPOINTS)
  }

  return checkpoint
}

/** List all checkpoints in the current session */
export function getCheckpoints(): Checkpoint[] {
  return [...checkpoints]
}

/** Clear all checkpoints (e.g., on session reset) */
export function clearCheckpoints(): void {
  checkpoints = []
}

/**
 * Analyze whether the current execution path has gone wrong.
 *
 * Detects regret signals when:
 *   - Error count is increasing (more errors than successes recently)
 *   - Circular tool usage (same tool called 3+ times consecutively)
 *   - Cost exceeding 2x the original estimate
 *   - Tests that previously passed are now failing
 */
export function detectRegret(
  currentState: {
    recentErrors: string[]
    recentToolCalls: string[]
    currentCost: number
    estimatedCost: number
    testsPassedBefore: string[]
    testsFailingNow: string[]
  },
  expectedOutcome: string,
): RegretSignal | null {
  // Check: error count increasing
  if (currentState.recentErrors.length >= 3) {
    const lastCheckpoint = findBestRevertTarget('error_accumulation')
    if (lastCheckpoint) {
      return {
        checkpoint: lastCheckpoint.id,
        reason: `Accumulated ${currentState.recentErrors.length} errors: ${currentState.recentErrors.slice(-2).join('; ')}`,
        severity: currentState.recentErrors.length >= 5 ? 'critical' : 'moderate',
        alternative: `Revert to "${lastCheckpoint.description}" and try a different approach to: ${expectedOutcome}`,
      }
    }
  }

  // Check: circular tool usage (same tool 3+ times in a row)
  const circularTool = detectCircularToolUse(currentState.recentToolCalls)
  if (circularTool) {
    const lastCheckpoint = findBestRevertTarget('circular_tools')
    if (lastCheckpoint) {
      return {
        checkpoint: lastCheckpoint.id,
        reason: `Tool "${circularTool}" called 3+ times consecutively — likely stuck in a loop`,
        severity: 'moderate',
        alternative: `Stop using "${circularTool}" and try alternative tools or approach for: ${expectedOutcome}`,
      }
    }
  }

  // Check: cost overrun (2x estimated)
  if (
    currentState.estimatedCost > 0 &&
    currentState.currentCost > currentState.estimatedCost * 2
  ) {
    const lastCheckpoint = findBestRevertTarget('cost_overrun')
    if (lastCheckpoint) {
      return {
        checkpoint: lastCheckpoint.id,
        reason: `Cost $${currentState.currentCost.toFixed(4)} exceeds 2x estimate of $${currentState.estimatedCost.toFixed(4)}`,
        severity: currentState.currentCost > currentState.estimatedCost * 4 ? 'critical' : 'minor',
        alternative: `Revert and use a more efficient approach (fewer API calls, simpler plan) for: ${expectedOutcome}`,
      }
    }
  }

  // Check: test regression
  const regressions = currentState.testsFailingNow.filter(
    t => currentState.testsPassedBefore.includes(t),
  )
  if (regressions.length > 0) {
    const lastCheckpoint = findBestRevertTarget('test_regression')
    if (lastCheckpoint) {
      return {
        checkpoint: lastCheckpoint.id,
        reason: `${regressions.length} tests regressed: ${regressions.slice(0, 3).join(', ')}`,
        severity: regressions.length >= 3 ? 'critical' : 'moderate',
        alternative: `Revert to "${lastCheckpoint.description}" — the changes broke existing tests`,
      }
    }
  }

  return null
}

/** Find a tool that appears 3+ times consecutively in recent calls */
function detectCircularToolUse(toolCalls: string[]): string | null {
  if (toolCalls.length < 3) return null

  // Check last N calls for consecutive repetition
  for (let i = toolCalls.length - 1; i >= 2; i--) {
    if (toolCalls[i] === toolCalls[i - 1] && toolCalls[i] === toolCalls[i - 2]) {
      return toolCalls[i]
    }
  }
  return null
}

/** Find the most recent revertable checkpoint */
function findBestRevertTarget(_reason: string): Checkpoint | null {
  // Walk backwards to find the most recent revertable checkpoint
  for (let i = checkpoints.length - 1; i >= 0; i--) {
    if (checkpoints[i].canRevert) {
      return checkpoints[i]
    }
  }
  return null
}

/**
 * Recommend which checkpoint to return to given a regret signal.
 * Returns a human-readable recommendation string.
 */
export function suggestBacktrack(regret: RegretSignal): string {
  const checkpoint = checkpoints.find(c => c.id === regret.checkpoint)
  if (!checkpoint) {
    return `Cannot find checkpoint "${regret.checkpoint}". No revert available.`
  }

  const lines: string[] = [
    `BACKTRACK RECOMMENDATION (severity: ${regret.severity})`,
    ``,
    `Reason: ${regret.reason}`,
    ``,
    `Suggested revert to: "${checkpoint.description}" (step ${checkpoint.step})`,
    `  Timestamp: ${checkpoint.timestamp}`,
    `  Files modified at that point: ${checkpoint.state.filesModified.join(', ') || 'none'}`,
    `  Decisions made: ${checkpoint.state.decisions.join('; ') || 'none'}`,
    ``,
    `Alternative approach: ${regret.alternative}`,
  ]

  return lines.join('\n')
}

/**
 * Revert to a previous checkpoint.
 * Returns the checkpoint's state so the agent can resume from that point.
 * All checkpoints after the reverted one are removed.
 */
export function revertToCheckpoint(id: string): Checkpoint | null {
  const index = checkpoints.findIndex(c => c.id === id)
  if (index === -1) return null

  const checkpoint = checkpoints[index]
  if (!checkpoint.canRevert) return null

  // Drop all checkpoints after this one
  checkpoints = checkpoints.slice(0, index + 1)

  return { ...checkpoint }
}

// ══════════════════════════════════════════════════════════════════════
// 2. Anticipation
// ══════════════════════════════════════════════════════════════════════

let anticipationCache: Anticipation[] = []

/** Load learned task sequences from disk, merged with defaults */
function loadSequences(): Record<string, string[]> {
  const learned = readJson<Record<string, string[]>>(SEQUENCES_PATH, {})
  return { ...DEFAULT_SEQUENCES, ...learned }
}

/** Save a new learned sequence */
export function learnSequence(trigger: string, followUp: string[]): void {
  const sequences = readJson<Record<string, string[]>>(SEQUENCES_PATH, {})
  sequences[trigger] = followUp
  writeJson(SEQUENCES_PATH, sequences)
}

/**
 * Predict up to 3 likely next requests based on:
 *   - Common task sequences (fix bug -> run tests -> commit)
 *   - Current file context (editing auth.ts -> likely needs auth.test.ts)
 *   - Conversation momentum (research -> implement -> verify)
 */
export function anticipateNext(
  conversationHistory: string[],
  currentTask: string,
): Anticipation[] {
  const predictions: Anticipation[] = []
  const sequences = loadSequences()
  const taskLower = currentTask.toLowerCase()

  // Strategy 1: Match current task against known sequences
  for (const [trigger, followUps] of Object.entries(sequences)) {
    const triggerWords = trigger.replace(/_/g, ' ').split(' ')
    const matchScore = triggerWords.filter(w => taskLower.includes(w)).length / triggerWords.length

    if (matchScore >= 0.5 && followUps.length > 0) {
      const nextAction = followUps[0]
      predictions.push({
        prediction: `User will likely want to: ${nextAction.replace(/_/g, ' ')}`,
        confidence: clamp(matchScore * 0.8, 0, 1),
        preparation: followUps.slice(0, 2).map(f => f.replace(/_/g, ' ')),
        reasoning: `Task "${currentTask}" matches sequence "${trigger}" -> [${followUps.join(', ')}]`,
      })
    }
  }

  // Strategy 2: File context anticipation
  const fileRefs = extractFilePaths(currentTask)
  for (const filePath of fileRefs) {
    const testFile = inferTestFile(filePath)
    if (testFile) {
      predictions.push({
        prediction: `User will want to check or update tests for ${filePath}`,
        confidence: 0.6,
        preparation: [testFile, filePath],
        reasoning: `Currently working on ${filePath}, test file would be at ${testFile}`,
      })
    }
  }

  // Strategy 3: Conversation momentum
  if (conversationHistory.length >= 2) {
    const momentum = detectMomentum(conversationHistory)
    if (momentum) {
      predictions.push(momentum)
    }
  }

  // Sort by confidence, take top 3
  predictions.sort((a, b) => b.confidence - a.confidence)
  anticipationCache = predictions.slice(0, 3)
  return anticipationCache
}

/** Extract file paths from a string (simple heuristic) */
function extractFilePaths(text: string): string[] {
  const pathRegex = /(?:^|\s)((?:\.\/|\/|[a-zA-Z0-9_-]+\/)[a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,6})/g
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = pathRegex.exec(text)) !== null) {
    matches.push(match[1].trim())
  }
  return matches
}

/** Detect conversation momentum (research -> implement -> verify) */
function detectMomentum(history: string[]): Anticipation | null {
  const recent = history.slice(-4).map(h => h.toLowerCase())

  // Pattern: research/read phase -> suggest implementation
  const researchWords = ['search', 'find', 'look', 'read', 'show', 'list', 'explore', 'check']
  const implementWords = ['create', 'write', 'build', 'add', 'implement', 'fix', 'update', 'modify']
  const verifyWords = ['test', 'run', 'verify', 'check', 'confirm', 'validate']

  const recentIsResearch = recent.some(r => researchWords.some(w => r.includes(w)))
  const recentIsImplement = recent.some(r => implementWords.some(w => r.includes(w)))
  const recentIsVerify = recent.some(r => verifyWords.some(w => r.includes(w)))

  if (recentIsResearch && !recentIsImplement) {
    return {
      prediction: 'User will likely move to implementation after this research phase',
      confidence: 0.5,
      preparation: ['implementation'],
      reasoning: 'Recent messages indicate a research/exploration phase — implementation typically follows',
    }
  }

  if (recentIsImplement && !recentIsVerify) {
    return {
      prediction: 'User will likely want to test or verify the changes',
      confidence: 0.65,
      preparation: ['run tests', 'verify output'],
      reasoning: 'Recent messages indicate implementation — verification typically follows',
    }
  }

  if (recentIsVerify) {
    return {
      prediction: 'User will likely want to commit or deploy after verification',
      confidence: 0.55,
      preparation: ['git commit', 'deploy'],
      reasoning: 'Recent messages indicate verification — commit/deploy typically follows',
    }
  }

  return null
}

/** Get the current anticipation cache */
export function getAnticipationCache(): Anticipation[] {
  return [...anticipationCache]
}

/**
 * Pre-load context for an anticipated request.
 * Returns a list of file paths that should be read into context.
 * (The caller is responsible for actually reading them.)
 */
export function preloadForAnticipation(anticipation: Anticipation): string[] {
  return [...anticipation.preparation]
}

/**
 * Record an actual user action so we can learn sequences.
 * Call this after each user message to update sequence knowledge.
 */
export function recordUserAction(previousAction: string, currentAction: string): void {
  if (!previousAction || !currentAction) return

  const prevKey = normalizeAction(previousAction)
  const currKey = normalizeAction(currentAction)

  if (prevKey && currKey && prevKey !== currKey) {
    const sequences = readJson<Record<string, string[]>>(SEQUENCES_PATH, {})
    const existing = sequences[prevKey] || []

    // Add to sequence if not already there
    if (!existing.includes(currKey)) {
      existing.push(currKey)
      // Keep sequences manageable — max 5 follow-ups per trigger
      sequences[prevKey] = existing.slice(-5)
      writeJson(SEQUENCES_PATH, sequences)
    }
  }
}

/** Normalize a user action description into a snake_case key */
function normalizeAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Session Continuity / Identity
// ══════════════════════════════════════════════════════════════════════

const DEFAULT_IDENTITY: AgentIdentity = {
  created: new Date().toISOString(),
  totalSessions: 0,
  totalMessages: 0,
  totalToolCalls: 0,
  personality: {
    verbosity: 0.5,
    caution: 0.5,
    creativity: 0.5,
    autonomy: 0.5,
  },
  preferences: {
    favoriteTools: [],
    avoidedPatterns: [],
    userStyle: '',
  },
  milestones: [],
}

/** Load or create the agent identity from disk */
export function getIdentity(): AgentIdentity {
  const identity = readJson<AgentIdentity>(IDENTITY_PATH, { ...DEFAULT_IDENTITY })

  // Ensure all fields exist (handles schema evolution)
  if (!identity.personality) identity.personality = { ...DEFAULT_IDENTITY.personality }
  if (!identity.preferences) identity.preferences = { ...DEFAULT_IDENTITY.preferences }
  if (!identity.milestones) identity.milestones = []
  if (typeof identity.totalSessions !== 'number') identity.totalSessions = 0
  if (typeof identity.totalMessages !== 'number') identity.totalMessages = 0
  if (typeof identity.totalToolCalls !== 'number') identity.totalToolCalls = 0

  return identity
}

/** Persist the identity to disk */
function saveIdentity(identity: AgentIdentity): void {
  writeJson(IDENTITY_PATH, identity)
}

/**
 * Update identity after a session ends.
 * Adjusts tool preferences and statistics based on session activity.
 */
export function updateIdentity(session: SessionSummary): void {
  const identity = getIdentity()

  identity.totalSessions += 1
  identity.totalMessages += session.messages
  identity.totalToolCalls += session.toolCalls

  // Update favorite tools — track usage frequency
  const toolCounts = new Map<string, number>()
  for (const tool of identity.preferences.favoriteTools) {
    toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1)
  }
  for (const tool of session.toolsUsed) {
    toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1)
  }

  // Keep top 10 most-used tools
  identity.preferences.favoriteTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool]) => tool)

  // Track patterns that consistently fail
  if (session.errors.length > 0) {
    for (const err of session.errors) {
      const pattern = err.slice(0, 60)
      if (!identity.preferences.avoidedPatterns.includes(pattern)) {
        identity.preferences.avoidedPatterns.push(pattern)
        // Keep list manageable
        if (identity.preferences.avoidedPatterns.length > 20) {
          identity.preferences.avoidedPatterns = identity.preferences.avoidedPatterns.slice(-20)
        }
      }
    }
  }

  // Auto-adjust caution based on error rate
  if (session.toolCalls > 0) {
    const errorRate = session.errors.length / session.toolCalls
    if (errorRate > 0.3) {
      // Many errors — become more cautious
      identity.personality.caution = clamp(
        identity.personality.caution + PERSONALITY_DELTA,
        PERSONALITY_MIN,
        PERSONALITY_MAX,
      )
    } else if (errorRate === 0 && session.toolCalls > 5) {
      // No errors with significant activity — become slightly less cautious
      identity.personality.caution = clamp(
        identity.personality.caution - PERSONALITY_DELTA * 0.5,
        PERSONALITY_MIN,
        PERSONALITY_MAX,
      )
    }
  }

  saveIdentity(identity)
}

/** Record a notable milestone */
export function addMilestone(event: string): void {
  const identity = getIdentity()
  identity.milestones.push({
    date: new Date().toISOString().split('T')[0],
    event,
  })
  // Keep last 50 milestones
  if (identity.milestones.length > 50) {
    identity.milestones = identity.milestones.slice(-50)
  }
  saveIdentity(identity)
}

/** Generate a one-paragraph summary of the agent's evolved personality */
export function getPersonalitySummary(): string {
  const identity = getIdentity()
  const p = identity.personality

  const verbosityDesc = p.verbosity > 0.7 ? 'detailed and thorough'
    : p.verbosity > 0.4 ? 'balanced'
    : 'concise and direct'

  const cautionDesc = p.caution > 0.7 ? 'very cautious, always asking before acting'
    : p.caution > 0.4 ? 'moderately careful'
    : 'bold, preferring to act quickly'

  const creativityDesc = p.creativity > 0.7 ? 'innovative and experimental'
    : p.creativity > 0.4 ? 'pragmatic'
    : 'conventional and proven'

  const autonomyDesc = p.autonomy > 0.7 ? 'highly autonomous, acting independently'
    : p.autonomy > 0.4 ? 'collaborative, mixing autonomy with check-ins'
    : 'deferential, preferring to ask permission'

  const age = Math.floor(
    (Date.now() - new Date(identity.created).getTime()) / (1000 * 60 * 60 * 24),
  )

  const toolNote = identity.preferences.favoriteTools.length > 0
    ? ` Most-used tools: ${identity.preferences.favoriteTools.slice(0, 5).join(', ')}.`
    : ''

  const milestoneNote = identity.milestones.length > 0
    ? ` Notable: ${identity.milestones[identity.milestones.length - 1].event}.`
    : ''

  return (
    `K:BOT identity (${age} days old, ${identity.totalSessions} sessions, ` +
    `${identity.totalMessages} messages). Communication style: ${verbosityDesc}. ` +
    `Risk profile: ${cautionDesc}. Problem-solving: ${creativityDesc} with ` +
    `${autonomyDesc} tendencies.${toolNote}${milestoneNote}`
  )
}

/**
 * Nudge a personality dimension based on user feedback.
 * Clamped to +/- PERSONALITY_DELTA per call, range [0, 1].
 */
export function adjustPersonality(
  dimension: keyof AgentIdentity['personality'],
  direction: 'increase' | 'decrease',
): { dimension: string; oldValue: number; newValue: number } {
  const identity = getIdentity()
  const oldValue = identity.personality[dimension]

  const delta = direction === 'increase' ? PERSONALITY_DELTA : -PERSONALITY_DELTA
  const newValue = clamp(oldValue + delta, PERSONALITY_MIN, PERSONALITY_MAX)

  identity.personality[dimension] = newValue
  saveIdentity(identity)

  return {
    dimension,
    oldValue: parseFloat(oldValue.toFixed(3)),
    newValue: parseFloat(newValue.toFixed(3)),
  }
}

// ══════════════════════════════════════════════════════════════════════
// Tool Registration
// ══════════════════════════════════════════════════════════════════════

export function registerTemporalTools(): void {
  // ── checkpoint_create ──
  registerTool({
    name: 'checkpoint_create',
    description:
      'Save a checkpoint before a risky operation. Records the current state ' +
      '(files modified, tools used, decisions made) so the agent can revert ' +
      'if things go wrong. Max 20 checkpoints per session (rolling window).',
    parameters: {
      description: {
        type: 'string',
        description: 'What is being done at this checkpoint (e.g., "before refactoring auth module")',
        required: true,
      },
      files_modified: {
        type: 'string',
        description: 'Comma-separated list of files modified so far',
        required: false,
      },
      tools_used: {
        type: 'string',
        description: 'Comma-separated list of tools used so far',
        required: false,
      },
      decisions: {
        type: 'string',
        description: 'Comma-separated list of key decisions made',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const description = String(args.description || 'unnamed checkpoint')
      const filesModified = args.files_modified
        ? String(args.files_modified).split(',').map(s => s.trim()).filter(Boolean)
        : []
      const toolsUsed = args.tools_used
        ? String(args.tools_used).split(',').map(s => s.trim()).filter(Boolean)
        : []
      const decisions = args.decisions
        ? String(args.decisions).split(',').map(s => s.trim()).filter(Boolean)
        : []

      const checkpoint = createCheckpoint(description, {
        filesModified,
        toolsUsed,
        decisions,
      })

      return JSON.stringify({
        status: 'checkpoint_created',
        id: checkpoint.id,
        step: checkpoint.step,
        description: checkpoint.description,
        totalCheckpoints: checkpoints.length,
      }, null, 2)
    },
  })

  // ── checkpoint_revert ──
  registerTool({
    name: 'checkpoint_revert',
    description:
      'Revert to a previously saved checkpoint. Returns the checkpoint state ' +
      'so the agent can resume from that point. All subsequent checkpoints ' +
      'are removed. Use "list" as the id to see all available checkpoints.',
    parameters: {
      id: {
        type: 'string',
        description: 'The checkpoint ID to revert to, or "list" to see all checkpoints',
        required: true,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const id = String(args.id || '')

      if (id === 'list') {
        const all = getCheckpoints()
        if (all.length === 0) {
          return 'No checkpoints saved in this session.'
        }
        return JSON.stringify(all.map(c => ({
          id: c.id,
          step: c.step,
          description: c.description,
          timestamp: c.timestamp,
          canRevert: c.canRevert,
          filesModified: c.state.filesModified,
        })), null, 2)
      }

      const checkpoint = revertToCheckpoint(id)
      if (!checkpoint) {
        return `Checkpoint "${id}" not found or not revertable. Use id "list" to see available checkpoints.`
      }

      return JSON.stringify({
        status: 'reverted',
        checkpoint: {
          id: checkpoint.id,
          step: checkpoint.step,
          description: checkpoint.description,
          state: checkpoint.state,
        },
        remainingCheckpoints: checkpoints.length,
        message: `Reverted to "${checkpoint.description}". All subsequent checkpoints removed. Resume from this state.`,
      }, null, 2)
    },
  })

  // ── anticipate ──
  registerTool({
    name: 'anticipate',
    description:
      'Predict what the user will likely ask next based on conversation history, ' +
      'current task context, and learned task sequences. Returns up to 3 predictions ' +
      'with confidence scores and suggested preparations.',
    parameters: {
      current_task: {
        type: 'string',
        description: 'What the user is currently working on',
        required: true,
      },
      recent_messages: {
        type: 'string',
        description: 'Pipe-separated (|) list of recent user messages for context',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const currentTask = String(args.current_task || '')
      const recentMessages = args.recent_messages
        ? String(args.recent_messages).split('|').map(s => s.trim()).filter(Boolean)
        : []

      const predictions = anticipateNext(recentMessages, currentTask)

      if (predictions.length === 0) {
        return JSON.stringify({
          predictions: [],
          message: 'No strong predictions for next action. Waiting for more context.',
        }, null, 2)
      }

      return JSON.stringify({
        predictions: predictions.map(p => ({
          prediction: p.prediction,
          confidence: parseFloat(p.confidence.toFixed(2)),
          preparation: p.preparation,
          reasoning: p.reasoning,
        })),
      }, null, 2)
    },
  })

  // ── identity ──
  registerTool({
    name: 'identity',
    description:
      'Show the agent identity, personality profile, and evolution over time. ' +
      'The identity persists across sessions and evolves based on usage patterns. ' +
      'Use action "show" to view, "milestone" to record an achievement, or ' +
      '"adjust" to nudge a personality dimension.',
    parameters: {
      action: {
        type: 'string',
        description: 'Action: "show" (default), "milestone", "adjust", "summary"',
        required: false,
        default: 'show',
      },
      event: {
        type: 'string',
        description: 'For "milestone" action: the event to record',
        required: false,
      },
      dimension: {
        type: 'string',
        description: 'For "adjust" action: personality dimension (verbosity, caution, creativity, autonomy)',
        required: false,
      },
      direction: {
        type: 'string',
        description: 'For "adjust" action: "increase" or "decrease"',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const action = String(args.action || 'show')

      switch (action) {
        case 'summary':
          return getPersonalitySummary()

        case 'milestone': {
          const event = String(args.event || '')
          if (!event) return 'Error: "event" parameter required for milestone action.'
          addMilestone(event)
          return `Milestone recorded: "${event}"`
        }

        case 'adjust': {
          const dimension = String(args.dimension || '') as keyof AgentIdentity['personality']
          const direction = String(args.direction || '') as 'increase' | 'decrease'

          const validDimensions = ['verbosity', 'caution', 'creativity', 'autonomy']
          if (!validDimensions.includes(dimension)) {
            return `Error: dimension must be one of: ${validDimensions.join(', ')}`
          }
          if (direction !== 'increase' && direction !== 'decrease') {
            return 'Error: direction must be "increase" or "decrease"'
          }

          const result = adjustPersonality(dimension, direction)
          return `Personality adjusted: ${result.dimension} ${result.oldValue} -> ${result.newValue} (${direction}d by ${PERSONALITY_DELTA})`
        }

        case 'show':
        default: {
          const identity = getIdentity()
          return JSON.stringify({
            created: identity.created,
            totalSessions: identity.totalSessions,
            totalMessages: identity.totalMessages,
            totalToolCalls: identity.totalToolCalls,
            personality: identity.personality,
            preferences: identity.preferences,
            recentMilestones: identity.milestones.slice(-5),
            summary: getPersonalitySummary(),
          }, null, 2)
        }
      }
    },
  })
}
