// kbot Collective Intelligence Network — 10,000 instances learning from each other
//
// The crown jewel of distributed intelligence.
// Every kbot instance is a neuron in the network. Join, contribute, absorb.
//
// Privacy: device fingerprint is a one-way SHA-256 hash — not reversible.
// All patterns anonymized before contribution (PII stripped).
// Offline mode is always valid — the network is a bonus, not a dependency.

import { homedir, hostname, platform, arch, cpus, totalmem, uptime as osUptime } from 'node:os'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { collectAnonymizedPatterns, type AnonymizedPattern } from './collective-learning.js'

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const COLLECTIVE_DIR = join(KBOT_DIR, 'collective')
const MEMORY_DIR = join(KBOT_DIR, 'memory')
const CONTRIBUTIONS_FILE = join(COLLECTIVE_DIR, 'contributions.json')
const NETWORK_LOG_FILE = join(COLLECTIVE_DIR, 'network-log.jsonl')
const NETWORK_STATE_FILE = join(COLLECTIVE_DIR, 'network-state.json')
const PATTERNS_FILE = join(MEMORY_DIR, 'patterns.json')
const COLLECTIVE_PATTERNS_FILE = join(COLLECTIVE_DIR, 'learned-patterns.json')

const COLLECTIVE_URL = process.env.KBOT_COLLECTIVE_URL || 'https://kernel.chat/api/collective'
const NETWORK_TIMEOUT = 10_000
const DEFAULT_LOOP_INTERVAL = 60 * 60 * 1000 // 1 hour

// ── Types ──

export interface NetworkStats {
  total_nodes: number
  total_patterns: number
  your_contributions: number
  your_rank: number
  network_health: number
  top_tools: string[]
  top_agents: string[]
}

export interface ContributeResult {
  patterns_contributed: number
  reputation_score: number
}

export interface AbsorbResult {
  patterns_absorbed: number
  new_insights: string[]
}

interface ContributionRecord {
  timestamp: string
  patterns_sent: number
  accepted: number
}

interface NetworkState {
  node_id: string
  joined_at: string | null
  last_contribute: string | null
  last_absorb: string | null
  total_contributed: number
  total_absorbed: number
  reputation_score: number
}

interface CollectivePattern {
  type: string
  language: string | null
  framework: string | null
  successRate: number
  toolsUsed: string[]
  agentUsed: string | null
  hits: number
  keywords: string[]
  confidence: number
  sampleCount: number
  lastUpdated: string
  source?: string
}

interface JoinResponse {
  node_id: string
  total_nodes: number
  total_patterns: number
  network_health: number
}

interface ContributeResponse {
  accepted: number
  reputation_score: number
}

interface AbsorbResponse {
  patterns: CollectivePattern[]
  your_project_types: string[]
}

interface StatsResponse {
  total_nodes: number
  total_patterns: number
  your_contributions: number
  your_rank: number
  network_health: number
  top_tools: string[]
  top_agents: string[]
}

interface ReputationResponse {
  score: number
  patterns_contributed: number
  pattern_quality: number
  uptime_bonus: number
}

interface InsightResponse {
  patterns: CollectivePattern[]
  summary: string
}

interface LeaderboardEntry {
  rank: number
  node_id_short: string
  reputation: number
  contributions: number
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
}

// ── Helpers ──

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'))
    }
  } catch {
    // Corrupt file — return fallback
  }
  return fallback
}

function saveJSON(path: string, data: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2))
}

function logNetwork(entry: Record<string, unknown>): void {
  ensureDir(COLLECTIVE_DIR)
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() })
  appendFileSync(NETWORK_LOG_FILE, line + '\n')
}

function getDeviceFingerprint(): string {
  const raw = `${hostname()}:${homedir()}:${platform()}:${arch()}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function loadNetworkState(): NetworkState {
  return loadJSON<NetworkState>(NETWORK_STATE_FILE, {
    node_id: getDeviceFingerprint(),
    joined_at: null,
    last_contribute: null,
    last_absorb: null,
    total_contributed: 0,
    total_absorbed: 0,
    reputation_score: 0,
  })
}

function saveNetworkState(state: NetworkState): void {
  saveJSON(NETWORK_STATE_FILE, state)
}

function loadContributions(): ContributionRecord[] {
  return loadJSON<ContributionRecord[]>(CONTRIBUTIONS_FILE, [])
}

function saveContributions(records: ContributionRecord[]): void {
  // Keep last 100 contributions to limit file size
  const trimmed = records.slice(-100)
  saveJSON(CONTRIBUTIONS_FILE, trimmed)
}

/** Read kbot version from package.json (best-effort) */
function getKbotVersion(): string {
  try {
    // Walk up from this file to find package.json
    const candidates = [
      join(__dirname, '..', 'package.json'),
      join(__dirname, '..', '..', 'package.json'),
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8'))
        if (pkg.name === '@kernel.chat/kbot') return pkg.version
      }
    }
  } catch {
    // Fall through
  }
  return 'unknown'
}

/** Count tools from the tools directory (best-effort) */
function getToolCount(): number {
  try {
    const toolsDir = join(__dirname, 'tools')
    if (existsSync(toolsDir)) {
      const { readdirSync } = require('node:fs') as typeof import('node:fs')
      return readdirSync(toolsDir).filter((f: string) => f.endsWith('.ts') || f.endsWith('.js')).length
    }
  } catch {
    // Fall through
  }
  return 60 // approximate default
}

/** Count agents from learning patterns */
function getAgentCount(): number {
  try {
    const patterns = loadJSON<Array<{ agentUsed?: string }>>(PATTERNS_FILE, [])
    const agents = new Set(patterns.map(p => p.agentUsed).filter(Boolean))
    return Math.max(agents.size, 17) // at least the 17 specialists
  } catch {
    return 17
  }
}

/** Detect project types from local patterns */
function detectProjectTypes(): string[] {
  const patterns = loadJSON<Array<{ keywords?: string[] }>>(PATTERNS_FILE, [])
  const techCounts = new Map<string, number>()
  for (const p of patterns) {
    if (Array.isArray(p.keywords)) {
      for (const kw of p.keywords) {
        techCounts.set(kw, (techCounts.get(kw) || 0) + 1)
      }
    }
  }
  return Array.from(techCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw)
}

/** Generate a pattern dedup key */
function patternKey(p: AnonymizedPattern | CollectivePattern): string {
  const parts = [
    p.type,
    p.language || '',
    p.framework || '',
    ...(p.toolsUsed || []).sort(),
    ...(p.keywords || []).sort(),
  ]
  return parts.join(':').toLowerCase()
}

// ── Collective Network Class ──

export class CollectiveNetwork {
  private state: NetworkState
  private loopTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.state = loadNetworkState()
  }

  /**
   * Register this kbot instance with the collective network.
   * Sends device fingerprint, version, tool count, agent count, uptime.
   * Receives network stats.
   */
  async join(): Promise<NetworkStats> {
    const fingerprint = getDeviceFingerprint()
    const payload = {
      device_fingerprint: fingerprint,
      version: getKbotVersion(),
      tool_count: getToolCount(),
      agent_count: getAgentCount(),
      uptime: Math.round(osUptime()),
      platform: platform(),
      arch: arch(),
      cpus: cpus().length,
      memory_gb: Math.round(totalmem() / (1024 ** 3)),
    }

    try {
      const res = await fetch(`${COLLECTIVE_URL}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT),
      })

      if (!res.ok) {
        logNetwork({ event: 'join_failed', status: res.status })
        return this.offlineStats()
      }

      const data = await res.json() as JoinResponse

      this.state.node_id = data.node_id || fingerprint
      this.state.joined_at = new Date().toISOString()
      saveNetworkState(this.state)

      logNetwork({ event: 'joined', node_id: this.state.node_id, total_nodes: data.total_nodes })

      return {
        total_nodes: data.total_nodes,
        total_patterns: data.total_patterns,
        your_contributions: this.state.total_contributed,
        your_rank: 0,
        network_health: data.network_health,
        top_tools: [],
        top_agents: [],
      }
    } catch (err) {
      logNetwork({ event: 'join_error', error: (err as Error).message })
      return this.offlineStats()
    }
  }

  /**
   * Anonymize local patterns (strip PII, file paths, usernames),
   * send to collective endpoint,
   * track contribution history.
   */
  async contribute(): Promise<ContributeResult> {
    const patterns = collectAnonymizedPatterns()
    if (patterns.length === 0) {
      return { patterns_contributed: 0, reputation_score: this.state.reputation_score }
    }

    const fingerprint = getDeviceFingerprint()

    try {
      const res = await fetch(`${COLLECTIVE_URL}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_fingerprint: fingerprint,
          patterns,
          version: getKbotVersion(),
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT),
      })

      if (!res.ok) {
        logNetwork({ event: 'contribute_failed', status: res.status })
        return { patterns_contributed: 0, reputation_score: this.state.reputation_score }
      }

      const data = await res.json() as ContributeResponse
      const accepted = data.accepted ?? patterns.length

      // Track contribution history
      const contributions = loadContributions()
      contributions.push({
        timestamp: new Date().toISOString(),
        patterns_sent: patterns.length,
        accepted,
      })
      saveContributions(contributions)

      // Update state
      this.state.last_contribute = new Date().toISOString()
      this.state.total_contributed += accepted
      this.state.reputation_score = data.reputation_score ?? this.state.reputation_score
      saveNetworkState(this.state)

      logNetwork({ event: 'contributed', sent: patterns.length, accepted, reputation: this.state.reputation_score })

      return {
        patterns_contributed: accepted,
        reputation_score: this.state.reputation_score,
      }
    } catch (err) {
      logNetwork({ event: 'contribute_error', error: (err as Error).message })
      return { patterns_contributed: 0, reputation_score: this.state.reputation_score }
    }
  }

  /**
   * Fetch top patterns from the collective (sorted by confidence * frequency).
   * Filter for patterns relevant to this user's detected project types.
   * Merge into local patterns with source="collective" tag.
   * Deduplicate against existing patterns.
   */
  async absorb(): Promise<AbsorbResult> {
    const projectTypes = detectProjectTypes()
    const fingerprint = getDeviceFingerprint()

    try {
      const res = await fetch(`${COLLECTIVE_URL}/absorb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_fingerprint: fingerprint,
          project_types: projectTypes,
          current_count: loadJSON<CollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, []).length,
        }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT),
      })

      if (!res.ok) {
        logNetwork({ event: 'absorb_failed', status: res.status })
        return { patterns_absorbed: 0, new_insights: [] }
      }

      const data = await res.json() as AbsorbResponse
      const remote = data.patterns
      if (!Array.isArray(remote) || remote.length === 0) {
        return { patterns_absorbed: 0, new_insights: [] }
      }

      // Load existing collective patterns
      const existing = loadJSON<CollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, [])
      const existingMap = new Map<string, CollectivePattern>()
      for (const p of existing) {
        existingMap.set(patternKey(p), p)
      }

      // Also load local patterns for dedup
      const localPatterns = loadJSON<Array<Record<string, unknown>>>(PATTERNS_FILE, [])
      const localKeys = new Set(localPatterns.map(p => {
        const kws = Array.isArray(p.keywords) ? (p.keywords as string[]).sort() : []
        const tools = Array.isArray(p.toolSequence) ? (p.toolSequence as string[]).sort() : []
        return [...kws, ...tools].join(':').toLowerCase()
      }))

      let absorbed = 0
      const insights: string[] = []

      // Filter for relevance: patterns whose keywords overlap with our project types
      const projectTypeSet = new Set(projectTypes.map(t => t.toLowerCase()))

      for (const p of remote) {
        const key = patternKey(p)

        // Skip if we already have this locally (dedup)
        const simplifiedKey = [...(p.keywords || []).sort(), ...(p.toolsUsed || []).sort()].join(':').toLowerCase()
        if (localKeys.has(simplifiedKey)) continue

        // Relevance filter: at least one keyword must match our project types,
        // or pattern has no keywords (generic pattern — always useful)
        const hasRelevance = p.keywords.length === 0 ||
          p.keywords.some(k => projectTypeSet.has(k.toLowerCase()))
        if (!hasRelevance) continue

        // Tag with collective source
        const taggedPattern: CollectivePattern = {
          ...p,
          source: 'collective',
        }

        const existingPattern = existingMap.get(key)
        if (!existingPattern) {
          existingMap.set(key, taggedPattern)
          absorbed++

          // Generate insight for high-confidence patterns
          if (p.confidence > 0.8 && p.sampleCount > 5) {
            const desc = [
              p.language ? `${p.language}` : null,
              p.framework ? `${p.framework}` : null,
              p.toolsUsed.length > 0 ? `tools: ${p.toolsUsed.join(', ')}` : null,
            ].filter(Boolean).join(' ')
            insights.push(`High-confidence pattern: ${p.type} (${desc}) — ${p.sampleCount} contributors`)
          }
        } else if (p.confidence > existingPattern.confidence) {
          existingMap.set(key, taggedPattern)
          absorbed++
        }
      }

      // Save merged collective patterns (cap at 500)
      const merged = Array.from(existingMap.values())
        .sort((a, b) => (b.confidence * b.sampleCount) - (a.confidence * a.sampleCount))
        .slice(0, 500)
      saveJSON(COLLECTIVE_PATTERNS_FILE, merged)

      // Update state
      this.state.last_absorb = new Date().toISOString()
      this.state.total_absorbed += absorbed
      saveNetworkState(this.state)

      logNetwork({ event: 'absorbed', count: absorbed, insights: insights.length })

      return { patterns_absorbed: absorbed, new_insights: insights }
    } catch (err) {
      logNetwork({ event: 'absorb_error', error: (err as Error).message })
      return { patterns_absorbed: 0, new_insights: [] }
    }
  }

  /**
   * Get full network statistics.
   */
  async getNetworkStats(): Promise<NetworkStats> {
    const fingerprint = getDeviceFingerprint()

    try {
      const res = await fetch(`${COLLECTIVE_URL}/stats?node=${fingerprint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(NETWORK_TIMEOUT),
      })

      if (!res.ok) {
        return this.offlineStats()
      }

      const data = await res.json() as StatsResponse

      return {
        total_nodes: data.total_nodes,
        total_patterns: data.total_patterns,
        your_contributions: data.your_contributions ?? this.state.total_contributed,
        your_rank: data.your_rank ?? 0,
        network_health: data.network_health ?? 1.0,
        top_tools: data.top_tools ?? [],
        top_agents: data.top_agents ?? [],
      }
    } catch {
      return this.offlineStats()
    }
  }

  /**
   * Get reputation score (0-100).
   * Based on: patterns contributed, pattern quality, uptime.
   */
  async getReputationScore(): Promise<number> {
    const fingerprint = getDeviceFingerprint()

    try {
      const res = await fetch(`${COLLECTIVE_URL}/reputation?node=${fingerprint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(NETWORK_TIMEOUT),
      })

      if (!res.ok) {
        return this.calculateLocalReputation()
      }

      const data = await res.json() as ReputationResponse
      this.state.reputation_score = data.score ?? this.calculateLocalReputation()
      saveNetworkState(this.state)
      return this.state.reputation_score
    } catch {
      return this.calculateLocalReputation()
    }
  }

  /**
   * Run contribute -> absorb -> stats on interval (default 1 hour).
   * Logs each cycle to ~/.kbot/collective/network-log.jsonl.
   */
  runCollectiveLoop(interval_ms?: number): void {
    const interval = interval_ms ?? DEFAULT_LOOP_INTERVAL

    // Stop any existing loop
    if (this.loopTimer) {
      clearInterval(this.loopTimer)
    }

    // Run immediately, then on interval
    const cycle = async () => {
      const cycleStart = Date.now()
      try {
        const contributed = await this.contribute()
        const absorbed = await this.absorb()
        const stats = await this.getNetworkStats()

        logNetwork({
          event: 'cycle_complete',
          contributed: contributed.patterns_contributed,
          absorbed: absorbed.patterns_absorbed,
          insights: absorbed.new_insights.length,
          nodes: stats.total_nodes,
          reputation: contributed.reputation_score,
          duration_ms: Date.now() - cycleStart,
        })
      } catch (err) {
        logNetwork({
          event: 'cycle_error',
          error: (err as Error).message,
          duration_ms: Date.now() - cycleStart,
        })
      }
    }

    // Fire first cycle
    cycle().catch(() => {})

    this.loopTimer = setInterval(() => {
      cycle().catch(() => {})
    }, interval)

    // Unref so it doesn't prevent process exit
    if (this.loopTimer && typeof this.loopTimer.unref === 'function') {
      this.loopTimer.unref()
    }
  }

  /** Stop the collective loop */
  stopCollectiveLoop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer)
      this.loopTimer = null
    }
  }

  // ── Private Helpers ──

  private offlineStats(): NetworkStats {
    const collectivePatterns = loadJSON<CollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, [])
    return {
      total_nodes: 0,
      total_patterns: collectivePatterns.length,
      your_contributions: this.state.total_contributed,
      your_rank: 0,
      network_health: 0,
      top_tools: [],
      top_agents: [],
    }
  }

  /**
   * Calculate a local reputation estimate when the network is unreachable.
   * Score 0-100 based on contribution volume, pattern diversity, and uptime.
   */
  private calculateLocalReputation(): number {
    const contributions = loadContributions()
    const totalAccepted = contributions.reduce((sum, c) => sum + c.accepted, 0)
    const localPatterns = loadJSON<unknown[]>(PATTERNS_FILE, [])
    const collectivePatterns = loadJSON<CollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, [])

    // Volume score (0-40): based on total contributions
    const volumeScore = Math.min(totalAccepted / 50, 1) * 40

    // Diversity score (0-30): based on variety of local patterns
    const diversityScore = Math.min(localPatterns.length / 100, 1) * 30

    // Engagement score (0-30): based on how many collective patterns absorbed
    const engagementScore = Math.min(collectivePatterns.length / 200, 1) * 30

    return Math.round(volumeScore + diversityScore + engagementScore)
  }
}

// ── Standalone Functions ──

/**
 * Search the collective for patterns matching a query.
 * Returns relevant patterns and a summary.
 */
export async function getCollectiveInsight(query: string): Promise<{ patterns: CollectivePattern[]; summary: string }> {
  try {
    const res = await fetch(`${COLLECTIVE_URL}/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        device_fingerprint: getDeviceFingerprint(),
      }),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT),
    })

    if (!res.ok) {
      // Fallback: search local collective cache
      return searchLocalCollective(query)
    }

    const data = await res.json() as InsightResponse
    return {
      patterns: data.patterns ?? [],
      summary: data.summary ?? 'No insights found.',
    }
  } catch {
    // Offline fallback: search cached collective patterns
    return searchLocalCollective(query)
  }
}

/**
 * Publish a forged tool to the collective.
 * Other kbot instances can discover and install it.
 */
export async function shareToolWithCollective(toolName: string): Promise<boolean> {
  const fingerprint = getDeviceFingerprint()

  // Load the forged tool definition from ~/.kbot/tools/
  const toolPath = join(KBOT_DIR, 'tools', `${toolName}.json`)
  if (!existsSync(toolPath)) {
    logNetwork({ event: 'share_tool_not_found', tool: toolName })
    return false
  }

  let toolDef: unknown
  try {
    toolDef = JSON.parse(readFileSync(toolPath, 'utf-8'))
  } catch {
    logNetwork({ event: 'share_tool_parse_error', tool: toolName })
    return false
  }

  try {
    const res = await fetch(`${COLLECTIVE_URL}/tools/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_fingerprint: fingerprint,
        tool_name: toolName,
        tool_definition: toolDef,
        version: getKbotVersion(),
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT),
    })

    if (!res.ok) {
      logNetwork({ event: 'share_tool_failed', tool: toolName, status: res.status })
      return false
    }

    logNetwork({ event: 'tool_shared', tool: toolName })
    return true
  } catch (err) {
    logNetwork({ event: 'share_tool_error', tool: toolName, error: (err as Error).message })
    return false
  }
}

/**
 * Get the top 10 contributors by reputation.
 */
export async function getCollectiveLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${COLLECTIVE_URL}/leaderboard`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(NETWORK_TIMEOUT),
    })

    if (!res.ok) return []

    const data = await res.json() as LeaderboardResponse
    return data.leaderboard ?? []
  } catch {
    return []
  }
}

// ── Local Search Fallback ──

function searchLocalCollective(query: string): { patterns: CollectivePattern[]; summary: string } {
  const patterns = loadJSON<CollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, [])
  if (patterns.length === 0) {
    return { patterns: [], summary: 'No collective patterns cached locally.' }
  }

  const queryTerms = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  if (queryTerms.length === 0) {
    // Return top patterns by confidence
    const top = patterns.slice(0, 10)
    return { patterns: top, summary: `Showing top ${top.length} patterns from local cache.` }
  }

  // Score each pattern by keyword overlap with query
  const scored = patterns.map(p => {
    const allTerms = [
      ...(p.keywords || []),
      p.language?.toLowerCase() || '',
      p.framework?.toLowerCase() || '',
      p.type?.toLowerCase() || '',
      ...(p.toolsUsed || []).map(t => t.toLowerCase()),
    ].filter(Boolean)

    let score = 0
    for (const qt of queryTerms) {
      for (const term of allTerms) {
        if (term.includes(qt) || qt.includes(term)) {
          score++
        }
      }
    }
    return { pattern: p, score }
  })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const matched = scored.map(s => s.pattern)
  return {
    patterns: matched,
    summary: matched.length > 0
      ? `Found ${matched.length} relevant patterns in local collective cache.`
      : 'No matching patterns in local cache. Connect to the network for broader search.',
  }
}
