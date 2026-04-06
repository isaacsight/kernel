// kbot Intelligence Coordinator — Unified Brain
//
// Orchestrates kbot's 14 intelligence systems into a coherent cognitive loop.
// Called before, during, and after each agent interaction.
//
// All module imports are LAZY (dynamic) to avoid circular dependency issues.
// State persists to ~/.kbot/coordinator-state.json.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import chalk from 'chalk'

// ── Lazy module loaders (dynamic imports to break circular deps) ──

async function getLearning() { return import('./learning.js') }
async function getConfidence() { return import('./confidence.js') }
async function getReasoning() { return import('./reasoning.js') }
async function getGraphMemory() { return import('./graph-memory.js') }
async function getLearnedRouter() { return import('./learned-router.js') }
async function getIntentionality() { return import('./intentionality.js') }
async function getTemporal() { return import('./temporal.js') }
async function getBehaviour() { return import('./behaviour.js') }
async function getEmergent(): Promise<Record<string, any> | null> {
  try {
    // emergent.ts doesn't exist yet — will be created when emergent module is built
    // Using indirect import to prevent TypeScript from resolving at compile time
    const path = './tools/emergent' + '.js'
    return await import(/* @vite-ignore */ path)
  } catch { return null }
}

// ── Types ──

export interface Goal {
  id: string
  description: string
  priority: number  // 0-1, higher = more important
  status: 'active' | 'completed' | 'abandoned'
  created: string
  toolsUsed: string[]
}

export interface Insight {
  id: string
  content: string
  source: string  // which module produced it
  confidence: number
  timestamp: string
}

export interface Conflict {
  modules: [string, string]
  description: string
  resolution: string | null
  timestamp: string
}

export interface SelfEval {
  sessionId: string
  messageHash: string
  score: number  // 0-1
  toolSuccessRate: number
  responseAppropriate: boolean
  patternsMatched: number
  timestamp: string
}

export interface PreProcessResult {
  agent: string | null
  confidence: number
  graphContext: string
  reasoning: string
  toolHints: string[]
  systemPromptAddition: string
  needsClarification: boolean
  clarificationReason?: string
  drives: { dominant: string; level: number } | null
  anticipation: string | null
}

export interface ToolEvaluation {
  allow: boolean
  warn?: string
  alternatives?: string[]
  anticipated: boolean
}

export interface PostProcessResult {
  score: number
  patternsExtracted: number
  insightsGenerated: number
  graphUpdates: number
  consolidationTriggered: boolean
}

export interface ConsolidationResult {
  patternsConsolidated: number
  rulesAdded: number
  insightsFound: number
  graphPruned: { nodes: number; edges: number }
  routingAccuracy: number
}

export interface CoordinatorStats {
  totalInteractions: number
  successRate: number
  patternsLearnedToday: number
  routingAccuracy: number
  activeGoals: number
  recentInsights: number
  conflicts: number
  lastConsolidation: string | null
  policy: 'explore' | 'exploit' | 'balanced'
  confidenceThreshold: number
  uptimeMs: number
}

export interface CoordinatorState {
  // Synthesis
  lastPolicy: 'explore' | 'exploit' | 'balanced'
  confidenceThreshold: number
  totalInteractions: number
  successRate: number  // rolling average of self-eval scores

  // Cross-module state
  activeGoals: Goal[]
  recentInsights: Insight[]
  conflictLog: Conflict[]

  // Self-eval history
  evalHistory: SelfEval[]

  // Learning velocity
  patternsLearnedToday: number
  patternsLearnedDate: string  // ISO date string, resets daily
  routingAccuracy: number

  // Timing
  lastConsolidation: string | null
  startedAt: string
}

// ── Defaults ──

const DEFAULT_CONFIDENCE_THRESHOLD = 0.4
const CONSOLIDATION_INTERVAL = 10  // every N interactions
const MAX_EVAL_HISTORY = 200
const MAX_INSIGHTS = 100
const MAX_CONFLICTS = 50
const MAX_GOALS = 20

function defaultState(): CoordinatorState {
  return {
    lastPolicy: 'balanced',
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    totalInteractions: 0,
    successRate: 0.5,
    activeGoals: [],
    recentInsights: [],
    conflictLog: [],
    evalHistory: [],
    patternsLearnedToday: 0,
    patternsLearnedDate: new Date().toISOString().slice(0, 10),
    routingAccuracy: 0.5,
    lastConsolidation: null,
    startedAt: new Date().toISOString(),
  }
}

// ── Persistence helpers ──

const KBOT_DIR = join(homedir(), '.kbot')
const STATE_FILE = join(KBOT_DIR, 'coordinator-state.json')

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

function loadState(): CoordinatorState {
  ensureDir()
  if (!existsSync(STATE_FILE)) return defaultState()
  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) }
  } catch {
    return defaultState()
  }
}

function saveState(state: CoordinatorState): void {
  ensureDir()
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // best-effort — coordinator state can be regenerated
  }
}

// ── Utility ──

function shortHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36).slice(0, 8)
}

function shortId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── IntelligenceCoordinator ──

export class IntelligenceCoordinator {
  private state: CoordinatorState
  private anticipatedTools: string[] = []
  private currentSessionId: string | null = null
  private pendingRouteAgent: string | null = null
  private initTime: number = Date.now()

  constructor() {
    this.state = loadState()
    // Reset daily pattern counter if it's a new day
    if (this.state.patternsLearnedDate !== todayStr()) {
      this.state.patternsLearnedToday = 0
      this.state.patternsLearnedDate = todayStr()
    }
  }

  // ── Phase 1: Pre-Execution (before LLM API call) ──

  async preProcess(message: string, sessionId: string): Promise<PreProcessResult> {
    this.currentSessionId = sessionId
    this.state.totalInteractions++

    const result: PreProcessResult = {
      agent: null,
      confidence: 0.5,
      graphContext: '',
      reasoning: '',
      toolHints: [],
      systemPromptAddition: '',
      needsClarification: false,
      drives: null,
      anticipation: null,
    }

    // 1. Route message through learned-router
    try {
      const router = await getLearnedRouter()
      const route = router.learnedRoute(message)
      if (route) {
        result.agent = route.agent
        result.confidence = route.confidence
        this.pendingRouteAgent = route.agent
      }
    } catch { /* non-critical */ }

    // 2. Check confidence — if below threshold, flag for clarification
    try {
      const conf = await getConfidence()
      const score = conf.estimateConfidence(message, '')
      result.confidence = Math.max(result.confidence, score.overall)

      if (score.overall < this.state.confidenceThreshold) {
        result.needsClarification = true
        result.clarificationReason = score.reasoning || 'Low confidence — consider asking for more details'
      }
    } catch { /* non-critical */ }

    // 3. Query graph-memory for relevant context
    try {
      const graph = await getGraphMemory()
      const contextStr = graph.toContext(1500)
      if (contextStr && contextStr.length > 10) {
        result.graphContext = contextStr
      }

      // Also find nodes related to message keywords
      const found = graph.findNode(message.slice(0, 100))
      if (found.length > 0) {
        const entityNames = found.slice(0, 5).map(n => n.name).join(', ')
        result.graphContext += `\nRelated entities: ${entityNames}`
      }
    } catch { /* non-critical */ }

    // 4. Run abductive reasoning to infer intent
    try {
      const reasoning = await getReasoning()
      const strategy = reasoning.selectStrategy(message, '')
      result.reasoning = strategy.reasoning || strategy.chosenStrategy
    } catch { /* non-critical */ }

    // 5. Check intentionality drives
    try {
      const intent = await getIntentionality()
      const drives = intent.getDriveState()
      if (drives && drives.drives && drives.drives.length > 0) {
        const top = drives.drives.reduce((a, b) =>
          (b.weight * (1 - b.currentSatisfaction)) > (a.weight * (1 - a.currentSatisfaction)) ? b : a
        )
        result.drives = { dominant: top.name, level: top.weight }
      }
    } catch { /* non-critical */ }

    // 6. Anticipate what tools will be needed (temporal)
    try {
      const temporal = await getTemporal()
      const anticipated = temporal.anticipateNext([message], message)
      if (anticipated && anticipated.length > 0 && anticipated[0].prediction) {
        result.anticipation = anticipated[0].prediction
        result.toolHints = anticipated[0].preparation || []
        this.anticipatedTools = result.toolHints
      }
    } catch { /* non-critical */ }

    // 7. Load behaviour rules for system prompt
    try {
      const behaviour = await getBehaviour()
      const prompt = behaviour.getBehaviourPrompt()
      if (prompt && prompt.length > 5) {
        result.systemPromptAddition = prompt
      }
    } catch { /* non-critical */ }

    // 8. Synthesize policy from signals
    this.state.lastPolicy = this.synthesizePolicy(result.confidence)

    // Add policy hint to system prompt
    if (this.state.lastPolicy === 'explore') {
      result.systemPromptAddition += '\n\nNote: Consider unconventional approaches. The user may benefit from a different perspective.'
    } else if (this.state.lastPolicy === 'exploit') {
      result.systemPromptAddition += '\n\nNote: Use the most reliable, proven approach. The user needs a direct solution.'
    }

    // Trim empty lines from system prompt addition
    result.systemPromptAddition = result.systemPromptAddition.trim()

    this.save()
    return result
  }

  // ── Phase 2: Tool Oversight (before each tool execution) ──

  evaluateToolCall(
    toolName: string,
    args: Record<string, unknown>,
    _context?: { sessionId?: string; agent?: string; message?: string },
  ): ToolEvaluation {
    const evaluation: ToolEvaluation = {
      allow: true,
      anticipated: false,
    }

    // 1. Check if tool matches anticipated needs
    if (this.anticipatedTools.length > 0) {
      evaluation.anticipated = this.anticipatedTools.some(hint =>
        toolName.includes(hint) || hint.includes(toolName)
      )
    }

    // 2. Confidence-gate: warn if success rate is low for this tool pattern
    // We check the eval history for similar tool usage patterns
    const recentEvals = this.state.evalHistory.slice(-20)
    if (recentEvals.length >= 5) {
      const avgScore = recentEvals.reduce((s, e) => s + e.score, 0) / recentEvals.length
      if (avgScore < 0.3) {
        evaluation.warn = `Recent interaction quality is low (${(avgScore * 100).toFixed(0)}%). Consider verifying approach.`
      }
    }

    // 3. Check behaviour rules for restrictions (synchronous)
    // We do a lightweight check against known restricted patterns
    try {
      // Destructive tool patterns that should trigger caution
      const cautionPatterns = [
        'delete', 'remove', 'drop', 'destroy', 'force', 'reset',
        'truncate', 'wipe', 'purge', 'nuke',
      ]
      const toolLower = toolName.toLowerCase()
      const argsStr = JSON.stringify(args).toLowerCase()

      const isDestructive = cautionPatterns.some(p =>
        toolLower.includes(p) || argsStr.includes(p)
      )

      if (isDestructive && !evaluation.warn) {
        evaluation.warn = `Tool "${toolName}" appears destructive. Verify intent.`
      }
    } catch { /* non-critical */ }

    // 4. Log tool usage to graph-memory (async, fire-and-forget)
    this.logToolToGraph(toolName, args).catch(() => {})

    return evaluation
  }

  // ── Phase 3: Post-Response Self-Evaluation ──

  async postProcess(
    message: string,
    response: string,
    toolsUsed: string[],
    sessionId: string,
  ): Promise<PostProcessResult> {
    const result: PostProcessResult = {
      score: 0.5,
      patternsExtracted: 0,
      insightsGenerated: 0,
      graphUpdates: 0,
      consolidationTriggered: false,
    }

    // 1. Self-evaluate: was the response helpful? (heuristic, no LLM call)
    result.score = this.selfEvaluate(message, response, toolsUsed)

    // Record the evaluation
    const evalEntry: SelfEval = {
      sessionId,
      messageHash: shortHash(message),
      score: result.score,
      toolSuccessRate: toolsUsed.length > 0 ? result.score : 1,
      responseAppropriate: result.score >= 0.4,
      patternsMatched: 0,
      timestamp: new Date().toISOString(),
    }

    this.state.evalHistory.push(evalEntry)
    if (this.state.evalHistory.length > MAX_EVAL_HISTORY) {
      this.state.evalHistory = this.state.evalHistory.slice(-MAX_EVAL_HISTORY)
    }

    // Update rolling success rate (exponential moving average, alpha=0.1)
    this.state.successRate = this.state.successRate * 0.9 + result.score * 0.1

    // 2. Extract patterns from successful interaction
    if (result.score >= 0.5) {
      try {
        const learning = await getLearning()
        learning.learnFromExchange(message, response, toolsUsed)
        result.patternsExtracted++
        this.state.patternsLearnedToday++
      } catch { /* non-critical */ }
    }

    // 3. Record routing outcome
    if (this.pendingRouteAgent) {
      try {
        const router = await getLearnedRouter()
        router.recordRoute(message, this.pendingRouteAgent, 'learned', result.score >= 0.5)

        // Update routing accuracy
        const routerStats = router.getRoutingStats()
        if (routerStats.totalRoutes > 0) {
          this.state.routingAccuracy = routerStats.learnedHits / routerStats.totalRoutes
        }
      } catch { /* non-critical */ }
      this.pendingRouteAgent = null
    }

    // 4. Update graph-memory with entities from the exchange
    try {
      const graph = await getGraphMemory()
      const entities = graph.extractEntities(message, response)
      result.graphUpdates = entities.length
    } catch { /* non-critical */ }

    // 5. Update confidence calibration
    try {
      const conf = await getConfidence()
      conf.recordCalibration(message, result.score, result.score >= 0.5 ? 1 : 0)
    } catch { /* non-critical */ }

    // 6. Update intentionality drives
    try {
      const intent = await getIntentionality()
      intent.updateMotivation({
        type: result.score >= 0.6 ? 'task_success' : result.score >= 0.3 ? 'learned_something' : 'task_failure',
      })
    } catch { /* non-critical */ }

    // 7. Check if emergent insights arise
    try {
      const emergent = await getEmergent() as Record<string, unknown> | null
      if (emergent && typeof emergent.synthesizeAcross === 'function') {
        const insights = await (emergent.synthesizeAcross as (hashes: string[]) => Promise<unknown[]>)(
          this.state.evalHistory.slice(-10).map(e => e.messageHash),
        )
        if (insights && Array.isArray(insights)) {
          for (const insight of insights.slice(0, 3)) {
            this.addInsight(
              typeof insight === 'string' ? insight : JSON.stringify(insight),
              'emergent',
              0.6,
            )
            result.insightsGenerated++
          }
        }
      }
    } catch { /* emergent module may not exist yet */ }

    // 8. Check if consolidation is needed
    if (this.state.totalInteractions % CONSOLIDATION_INTERVAL === 0) {
      result.consolidationTriggered = true
      // Fire-and-forget — don't block the response
      this.consolidate().catch(() => {})
    }

    this.save()
    return result
  }

  // ── Phase 4: Cross-Session Learning ──

  async consolidate(): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      patternsConsolidated: 0,
      rulesAdded: 0,
      insightsFound: 0,
      graphPruned: { nodes: 0, edges: 0 },
      routingAccuracy: this.state.routingAccuracy,
    }

    // 1. Run selfTrain() on accumulated patterns
    try {
      const learning = await getLearning()
      const trained = learning.selfTrain()
      result.patternsConsolidated = trained.optimized ?? 0
    } catch { /* non-critical */ }

    // 2. Prune weak graph edges
    try {
      const graph = await getGraphMemory()
      // Decay nodes unused for 30 days
      graph.decayUnused(30)
      // Prune very weak connections
      const pruned = graph.prune(0.1)
      result.graphPruned = { nodes: pruned.removedNodes, edges: pruned.removedEdges }
      graph.save()
    } catch { /* non-critical */ }

    // 3. Derive behaviour rules from recurring patterns
    try {
      const learning = await getLearning()
      const topPatterns = learning.getTopPatterns(5)
      const behaviour = await getBehaviour()

      for (const pattern of topPatterns) {
        // If a pattern has been used many times, it might warrant a behaviour rule
        if (pattern.hits >= 10 && pattern.successRate >= 0.8) {
          const ruleText = `When asked about "${pattern.intent}", prefer tools: ${pattern.toolSequence.join(', ')}`
          const added = behaviour.learnGeneral(ruleText)
          if (added) result.rulesAdded++
        }
      }
    } catch { /* non-critical */ }

    // 4. Run emergent synthesis
    try {
      const emergent = await getEmergent() as Record<string, unknown> | null
      if (emergent && typeof emergent.consolidate === 'function') {
        const consolidated = await (emergent.consolidate as () => Promise<{ insights?: number }>)()
        if (consolidated && typeof consolidated.insights === 'number') {
          result.insightsFound = consolidated.insights
        }
      }
    } catch { /* emergent module may not exist yet */ }

    // 5. Update routing weights from outcome history
    try {
      const router = await getLearnedRouter()
      const stats = router.getRoutingStats()
      if (stats.totalRoutes > 0) {
        result.routingAccuracy = stats.learnedHits / stats.totalRoutes
        this.state.routingAccuracy = result.routingAccuracy
      }
    } catch { /* non-critical */ }

    this.state.lastConsolidation = new Date().toISOString()
    this.save()
    return result
  }

  // ── Self-Evaluation (heuristic, no LLM call) ──

  private selfEvaluate(message: string, response: string, toolsUsed: string[]): number {
    let score = 0.5  // neutral baseline

    // Response length appropriateness
    if (message.length > 50 && response.length < 20) {
      score -= 0.15
    } else if (response.length > 50) {
      score += 0.1
    }

    // Tool success signals
    if (toolsUsed.length > 0) {
      const errorPatterns = ['error', 'failed', 'could not', 'unable to', 'not found', 'permission denied']
      const responseLower = response.toLowerCase()
      const errorCount = errorPatterns.filter(p => responseLower.includes(p)).length
      if (errorCount === 0) score += 0.2
      else if (errorCount >= 3) score -= 0.2
    } else {
      score += 0.05
    }

    // Pattern match bonus
    try {
      if (this.pendingRouteAgent) score += 0.1
    } catch { /* non-critical */ }

    // Actionable content bonus (code blocks, file paths)
    if (response.includes('```') || response.match(/(?:\/[\w./-]+\.\w+)/)) {
      score += 0.1
    }

    // Repetition penalty
    const recentHashes = this.state.evalHistory.slice(-3).map(e => e.messageHash)
    if (recentHashes.includes(shortHash(response.slice(0, 200)))) {
      score -= 0.1
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score))
  }

  // ── Policy Synthesis ──

  private synthesizePolicy(confidence: number): 'explore' | 'exploit' | 'balanced' {
    // High confidence + high success rate → exploit (use proven approaches)
    if (confidence > 0.7 && this.state.successRate > 0.7) return 'exploit'
    // Low confidence or low success → explore (try new approaches)
    if (confidence < 0.4 || this.state.successRate < 0.3) return 'explore'
    return 'balanced'
  }

  // ── Graph Memory Logging ──

  private async logToolToGraph(toolName: string, args: Record<string, unknown>): Promise<void> {
    try {
      const graph = await getGraphMemory()

      // Add the tool as an entity
      const toolNode = graph.findNode(toolName)
      let toolNodeId: string

      if (toolNode.length > 0) {
        toolNodeId = toolNode[0].id
      } else {
        const added = graph.addNode('entity', toolName, { kind: 'tool', lastUsed: new Date().toISOString() })
        toolNodeId = added?.id || ''
      }

      // If we have a session goal, connect tool to goal
      if (toolNodeId && this.state.activeGoals.length > 0) {
        const currentGoal = this.state.activeGoals[this.state.activeGoals.length - 1]
        const goalNodes = graph.findNode(currentGoal.description.slice(0, 50))
        if (goalNodes.length > 0) {
          graph.addEdge(toolNodeId, goalNodes[0].id, 'used_for', 0.5)
        }
      }

      graph.save()
    } catch { /* graph logging is non-critical */ }
  }

  // ── Insight Management ──

  private addInsight(content: string, source: string, confidence: number): void {
    this.state.recentInsights.push({
      id: shortId(),
      content,
      source,
      confidence,
      timestamp: new Date().toISOString(),
    })

    // Trim to max
    if (this.state.recentInsights.length > MAX_INSIGHTS) {
      this.state.recentInsights = this.state.recentInsights.slice(-MAX_INSIGHTS)
    }
  }

  // ── Goal Management ──

  addGoal(description: string, priority: number = 0.5): Goal {
    const goal: Goal = {
      id: shortId(),
      description,
      priority: Math.max(0, Math.min(1, priority)),
      status: 'active',
      created: new Date().toISOString(),
      toolsUsed: [],
    }
    this.state.activeGoals.push(goal)

    // Trim old completed/abandoned goals
    if (this.state.activeGoals.length > MAX_GOALS) {
      this.state.activeGoals = this.state.activeGoals
        .filter(g => g.status === 'active')
        .slice(-MAX_GOALS)
    }

    this.save()
    return goal
  }

  completeGoal(goalId: string): void {
    const goal = this.state.activeGoals.find(g => g.id === goalId)
    if (goal) {
      goal.status = 'completed'
      this.save()
    }
  }

  // ── Conflict Detection ──

  recordConflict(modules: [string, string], description: string, resolution?: string): void {
    this.state.conflictLog.push({
      modules,
      description,
      resolution: resolution ?? null,
      timestamp: new Date().toISOString(),
    })

    if (this.state.conflictLog.length > MAX_CONFLICTS) {
      this.state.conflictLog = this.state.conflictLog.slice(-MAX_CONFLICTS)
    }

    this.save()
  }

  // ── Persistence ──

  load(): void {
    this.state = loadState()
    if (this.state.patternsLearnedDate !== todayStr()) {
      this.state.patternsLearnedToday = 0
      this.state.patternsLearnedDate = todayStr()
    }
  }

  save(): void {
    saveState(this.state)
  }

  // ── Diagnostics ──

  getStats(): CoordinatorStats {
    return {
      totalInteractions: this.state.totalInteractions,
      successRate: Math.round(this.state.successRate * 1000) / 1000,
      patternsLearnedToday: this.state.patternsLearnedToday,
      routingAccuracy: Math.round(this.state.routingAccuracy * 1000) / 1000,
      activeGoals: this.state.activeGoals.filter(g => g.status === 'active').length,
      recentInsights: this.state.recentInsights.length,
      conflicts: this.state.conflictLog.length,
      lastConsolidation: this.state.lastConsolidation,
      policy: this.state.lastPolicy,
      confidenceThreshold: this.state.confidenceThreshold,
      uptimeMs: Date.now() - this.initTime,
    }
  }

  getHealthReport(): string {
    const stats = this.getStats()
    const lines: string[] = [
      '=== Intelligence Coordinator Health Report ===',
      '',
      `Total interactions: ${stats.totalInteractions}`,
      `Success rate: ${(stats.successRate * 100).toFixed(1)}%`,
      `Routing accuracy: ${(stats.routingAccuracy * 100).toFixed(1)}%`,
      `Policy: ${stats.policy}`,
      `Confidence threshold: ${stats.confidenceThreshold}`,
      '',
      `Active goals: ${stats.activeGoals}`,
      `Recent insights: ${stats.recentInsights}`,
      `Conflicts: ${stats.conflicts}`,
      `Patterns learned today: ${stats.patternsLearnedToday}`,
      '',
      `Last consolidation: ${stats.lastConsolidation ?? 'never'}`,
      `Uptime: ${Math.round(stats.uptimeMs / 1000)}s`,
    ]

    // Health checks
    const issues: string[] = []
    if (stats.successRate < 0.3) issues.push('LOW: Success rate below 30%')
    if (stats.routingAccuracy < 0.3) issues.push('LOW: Routing accuracy below 30%')
    if (stats.totalInteractions > 50 && stats.patternsLearnedToday === 0) {
      issues.push('STALE: No patterns learned today despite activity')
    }
    if (!stats.lastConsolidation) {
      issues.push('PENDING: No consolidation has ever run')
    }

    if (issues.length > 0) {
      lines.push('', '--- Issues ---')
      for (const issue of issues) lines.push(`  ! ${issue}`)
    } else {
      lines.push('', 'All systems nominal.')
    }

    return lines.join('\n')
  }

  getState(): Readonly<CoordinatorState> {
    return this.state
  }

  /** Adjust the confidence threshold (e.g., user prefers fewer clarification requests) */
  setConfidenceThreshold(threshold: number): void {
    this.state.confidenceThreshold = Math.max(0, Math.min(1, threshold))
    this.save()
  }

  /** Reset all state (for testing or fresh start) */
  reset(): void {
    this.state = defaultState()
    this.anticipatedTools = []
    this.pendingRouteAgent = null
    this.save()
  }
}

// ── Singleton ──

let singleton: IntelligenceCoordinator | null = null

export function getCoordinator(): IntelligenceCoordinator {
  if (!singleton) {
    singleton = new IntelligenceCoordinator()
  }
  return singleton
}

// ── Tool Registration ──

/** Register coordinator tools with the kbot tool registry */
export function registerCoordinatorTools(): void {
  // Lazy import to avoid circular deps at module load time
  import('./tools/index.js').then(({ registerTool }) => {
    registerTool({
      name: 'coordinator_status',
      description: 'Show intelligence coordinator stats: success rate, routing accuracy, policy, interactions, goals, insights',
      parameters: {},
      tier: 'free',
      execute: async () => {
        const c = getCoordinator()
        const stats = c.getStats()
        return JSON.stringify(stats, null, 2)
      },
    })

    registerTool({
      name: 'coordinator_health',
      description: 'Run a health check on all intelligence subsystems and report issues',
      parameters: {},
      tier: 'free',
      execute: async () => {
        const c = getCoordinator()
        return c.getHealthReport()
      },
    })

    registerTool({
      name: 'coordinator_consolidate',
      description: 'Force a cross-session learning consolidation: self-train patterns, prune graph, derive behaviour rules, synthesize insights',
      parameters: {},
      tier: 'free',
      execute: async () => {
        const c = getCoordinator()
        const result = await c.consolidate()
        return JSON.stringify(result, null, 2)
      },
    })
    registerTool({
      name: 'coordinator_orchestrate',
      description: 'Decompose a goal into sub-tasks, assign specialist agents, execute in dependency order, and synthesize results',
      parameters: { goal: { type: 'string', description: 'The high-level goal to orchestrate', required: true } },
      tier: 'free',
      execute: async (args) => coordinate(args.goal as string),
    })

  }).catch(() => {
    // tools/index.js not available — skip registration
  })
}

// ── Goal Decomposition & Multi-Agent Orchestration ──
//
// Takes a high-level goal and:
// 1. Decomposes it into ordered sub-tasks via LLM
// 2. Assigns each sub-task to the best specialist agent
// 3. Manages dependencies between sub-tasks
// 4. Synthesizes results into a final output
// 5. Learns from the execution for next time

const COORD_AMETHYST = chalk.hex('#6B5B95')

export interface Task {
  id: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  agent: string
  dependencies: string[]  // task IDs that must complete first
  result?: string
  error?: string
}

export interface CoordinatorPlan {
  id: string
  goal: string
  tasks: Task[]
  createdAt: string
  completedAt?: string
  status: 'planning' | 'executing' | 'done' | 'failed'
}

const DECOMPOSE_PROMPT = `You are a task decomposition engine. Break the goal into 2-6 concrete sub-tasks.
Output ONLY valid JSON: {"tasks":[{"id":"t1","goal":"...","agent":"agent_id","dependencies":[]}]}
Agents: kernel (general), coder (code/debug), researcher (research), writer (docs), analyst (strategy), guardian (security), infrastructure (devops).
Rules: each task independently verifiable, use dependencies for ordering, assign best agent, one objective per task.`

/**
 * Decompose a high-level goal into ordered sub-tasks with dependencies.
 * Uses the LLM (via runAgent) to break the goal into 2-6 concrete tasks.
 */
export async function decompose(goal: string): Promise<CoordinatorPlan> {
  const planId = shortId()
  const plan: CoordinatorPlan = {
    id: planId,
    goal,
    tasks: [],
    createdAt: new Date().toISOString(),
    status: 'planning',
  }

  process.stderr.write(`  ${COORD_AMETHYST('◆ decompose')} ${chalk.dim(goal.slice(0, 80))}${goal.length > 80 ? '...' : ''}\n`)

  try {
    // Lazy import to avoid circular dependency
    const { runAgent } = await import('./agent.js')

    const response = await runAgent(
      `${DECOMPOSE_PROMPT}\n\nGoal: ${goal}\n\nOutput JSON:`,
      { agent: 'kernel', skipPlanner: true, sessionId: `coord-${planId}` },
    )

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { tasks: Array<{ id: string; goal: string; agent: string; dependencies?: string[] }> }

      plan.tasks = (parsed.tasks || []).slice(0, 6).map(t => ({
        id: t.id || shortId(),
        goal: t.goal,
        status: 'pending' as const,
        agent: t.agent || 'kernel',
        dependencies: t.dependencies || [],
      }))
    }
  } catch (err) {
    process.stderr.write(`  ${chalk.red('✗')} decomposition failed: ${err instanceof Error ? err.message : String(err)}\n`)
  }

  // Fallback: if decomposition produced nothing, create a single task
  if (plan.tasks.length === 0) {
    plan.tasks = [{
      id: 't1',
      goal,
      status: 'pending',
      agent: 'kernel',
      dependencies: [],
    }]
  }

  plan.status = 'executing'

  for (const task of plan.tasks) {
    const deps = task.dependencies.length > 0 ? chalk.dim(` -> ${task.dependencies.join(',')}`) : ''
    process.stderr.write(`  ${chalk.dim('│')} ${chalk.cyan(task.id)} ${task.goal} ${chalk.magenta(`@${task.agent}`)}${deps}\n`)
  }
  return plan
}

/**
 * Execute a plan's tasks in dependency order (sequential for now).
 * Tasks whose dependencies are all 'done' are eligible to run.
 */
export async function execute(plan: CoordinatorPlan): Promise<CoordinatorPlan> {
  const { runAgent } = await import('./agent.js')
  const completed = new Set<string>()

  process.stderr.write(`\n  ${COORD_AMETHYST('◆ execute')} ${plan.tasks.length} tasks\n`)

  while (completed.size < plan.tasks.length) {
    // Find tasks whose dependencies are all satisfied
    const ready = plan.tasks.filter(t =>
      t.status === 'pending' &&
      t.dependencies.every(dep => completed.has(dep)),
    )

    if (ready.length === 0) {
      // Remaining tasks have unmet deps — mark them failed
      for (const t of plan.tasks) {
        if (t.status === 'pending') {
          t.status = 'failed'
          t.error = 'Unmet dependencies (earlier tasks failed)'
          completed.add(t.id)
        }
      }
      break
    }

    // Execute ready tasks sequentially (parallel execution can come later)
    for (const task of ready) {
      task.status = 'running'
      process.stderr.write(`  ${chalk.dim('├')} ${chalk.yellow('●')} ${task.id}: ${task.goal}\n`)

      // Gather dependency results as context
      const depCtx = task.dependencies
        .map(id => { const d = plan.tasks.find(t => t.id === id); return d?.result ? `[${id}]: ${d.result.slice(0, 500)}` : '' })
        .filter(Boolean).join('\n')
      const prompt = `You are executing a sub-task of a larger plan.${depCtx ? `\n\nPrevious results:\n${depCtx}` : ''}\n\nYour task: ${task.goal}\n\nExecute this now.`

      try {
        const response = await runAgent(prompt, {
          agent: task.agent,
          skipPlanner: true,
          sessionId: `coord-${plan.id}-${task.id}`,
        })
        task.result = response.content
        task.status = 'done'
        process.stderr.write(`  ${chalk.dim('│')} ${chalk.green('✓')} ${task.id} done\n`)
      } catch (err) {
        task.status = 'failed'
        task.error = err instanceof Error ? err.message : String(err)
        process.stderr.write(`  ${chalk.dim('│')} ${chalk.red('✗')} ${task.id} failed: ${task.error}\n`)
      }

      completed.add(task.id)
    }
  }

  // Determine final plan status
  const failed = plan.tasks.filter(t => t.status === 'failed')
  plan.status = failed.length === 0 ? 'done' : 'failed'
  plan.completedAt = new Date().toISOString()

  const done = plan.tasks.filter(t => t.status === 'done').length
  process.stderr.write(`  ${chalk.dim('└')} ${done}/${plan.tasks.length} tasks succeeded\n`)

  // Record outcome for learning
  try {
    const coord = getCoordinator()
    if (plan.status === 'done') coord.addGoal(plan.goal, 0.7).status = 'completed'
    const learning = await getLearning()
    learning.learnFromExchange(`[coordinator] ${plan.goal}`, `${done}/${plan.tasks.length} done`, plan.tasks.map(t => t.agent))
  } catch { /* non-critical */ }

  return plan
}

/**
 * Convenience: decompose a goal, execute the plan, and synthesize results.
 * Returns a human-readable summary of what was accomplished.
 */
export async function coordinate(goal: string): Promise<string> {
  const plan = await decompose(goal)
  const executed = await execute(plan)

  // Synthesize results
  const results = executed.tasks
    .filter(t => t.status === 'done' && t.result)
    .map(t => `## ${t.goal}\n${t.result}`)
    .join('\n\n')

  const failed = executed.tasks.filter(t => t.status === 'failed')
  const failSummary = failed.length > 0
    ? `\n\n---\n${failed.length} task(s) failed:\n${failed.map(t => `- ${t.goal}: ${t.error}`).join('\n')}`
    : ''

  return results + failSummary
}

// Auto-register tools when this module is imported
registerCoordinatorTools()
