// kbot Agent Collaboration Protocol
//
// Four interlocking systems for multi-agent collaboration:
//   1. Handoff Protocol — structured agent-to-agent transitions
//   2. Shared Working Memory (Blackboard) — cross-agent whiteboard
//   3. Negotiation — multi-agent disagreement resolution
//   4. Trust Delegation — per-agent trust scores by domain
//
// All systems are in-memory per-session except trust profiles,
// which persist to ~/.kbot/trust.json for cross-session learning.

import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { registerTool } from './tools/index.js'

// ── Utilities ──

function shortId(): string {
  return randomBytes(4).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

const TRUST_FILE = join(homedir(), '.kbot', 'trust.json')

// ── 1. Handoff Protocol ──

export interface Handoff {
  id: string
  from: string
  to: string
  reason: string
  context: string
  artifacts: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  result?: string
  rejectionReason?: string
  created: string
  updated: string
}

const handoffs = new Map<string, Handoff>()

/** Create a handoff request from one agent to another */
export function createHandoff(
  from: string,
  to: string,
  reason: string,
  context: string,
  artifacts: string[] = [],
  priority: Handoff['priority'] = 'normal',
): Handoff {
  const handoff: Handoff = {
    id: shortId(),
    from,
    to,
    reason,
    context,
    artifacts,
    priority,
    status: 'pending',
    created: now(),
    updated: now(),
  }
  handoffs.set(handoff.id, handoff)
  return handoff
}

/** Accept a pending handoff */
export function acceptHandoff(id: string): Handoff {
  const h = handoffs.get(id)
  if (!h) throw new Error(`Handoff ${id} not found`)
  if (h.status !== 'pending') throw new Error(`Handoff ${id} is ${h.status}, cannot accept`)
  h.status = 'accepted'
  h.updated = now()
  return h
}

/** Reject a pending handoff with a reason */
export function rejectHandoff(id: string, reason: string): Handoff {
  const h = handoffs.get(id)
  if (!h) throw new Error(`Handoff ${id} not found`)
  if (h.status !== 'pending') throw new Error(`Handoff ${id} is ${h.status}, cannot reject`)
  h.status = 'rejected'
  h.rejectionReason = reason
  h.updated = now()
  return h
}

/** Mark a handoff as completed with a result */
export function completeHandoff(id: string, result: string): Handoff {
  const h = handoffs.get(id)
  if (!h) throw new Error(`Handoff ${id} not found`)
  if (h.status !== 'accepted') throw new Error(`Handoff ${id} is ${h.status}, must be accepted first`)
  h.status = 'completed'
  h.result = result
  h.updated = now()

  // Record in trust system: completing a handoff is a success signal
  updateTrust(h.to, 'handoff', true)

  return h
}

/** Get all pending handoffs, optionally filtered by target agent */
export function getActiveHandoffs(agentId?: string): Handoff[] {
  const active: Handoff[] = []
  for (const h of handoffs.values()) {
    if (h.status !== 'pending') continue
    if (agentId && h.to !== agentId) continue
    active.push(h)
  }
  return active.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/** Get full handoff history for analysis */
export function getHandoffHistory(): Handoff[] {
  return Array.from(handoffs.values()).sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  )
}

// ── 2. Shared Working Memory (Blackboard) ──

export interface BlackboardEntry {
  key: string
  value: unknown
  author: string
  type: 'fact' | 'hypothesis' | 'decision' | 'artifact' | 'question'
  confidence: number
  timestamp: string
  subscribers: string[]
}

export interface Blackboard {
  entries: Map<string, BlackboardEntry>
}

const blackboard: Blackboard = { entries: new Map() }

type SubscriptionCallback = (entry: BlackboardEntry) => void
const subscriptionCallbacks = new Map<string, SubscriptionCallback[]>()

/** Write an entry to the shared blackboard */
export function blackboardWrite(
  key: string,
  value: unknown,
  author: string,
  type: BlackboardEntry['type'],
  confidence: number = 1.0,
): BlackboardEntry {
  const existing = blackboard.entries.get(key)
  const subscribers = existing?.subscribers ?? []

  const entry: BlackboardEntry = {
    key,
    value,
    author,
    type,
    confidence: Math.max(0, Math.min(1, confidence)),
    timestamp: now(),
    subscribers,
  }
  blackboard.entries.set(key, entry)

  // Notify subscribers
  const callbacks = subscriptionCallbacks.get(key)
  if (callbacks) {
    for (const cb of callbacks) {
      try { cb(entry) } catch { /* subscriber errors don't propagate */ }
    }
  }

  return entry
}

/** Read an entry from the blackboard */
export function blackboardRead(key: string): BlackboardEntry | undefined {
  return blackboard.entries.get(key)
}

/** Query all entries, optionally filtered by type */
export function blackboardQuery(type?: BlackboardEntry['type']): BlackboardEntry[] {
  const entries = Array.from(blackboard.entries.values())
  if (!type) return entries
  return entries.filter(e => e.type === type)
}

/** Subscribe an agent to changes on a blackboard key */
export function blackboardSubscribe(
  key: string,
  agentId: string,
  callback?: SubscriptionCallback,
): void {
  // Track subscriber in the entry
  const entry = blackboard.entries.get(key)
  if (entry && !entry.subscribers.includes(agentId)) {
    entry.subscribers.push(agentId)
  }

  // Register callback if provided
  if (callback) {
    const existing = subscriptionCallbacks.get(key) ?? []
    existing.push(callback)
    subscriptionCallbacks.set(key, existing)
  }
}

/** Get all decision-type entries (consensus view) */
export function blackboardGetDecisions(): BlackboardEntry[] {
  return blackboardQuery('decision')
}

// ── Blackboard Broadcast Bus (Change 2: Global signal routing) ──
// Type-based pub/sub that allows cognitive modules to subscribe to
// specific blackboard entry types (or '*' for all). This turns the
// blackboard into a Global Workspace a la Baars (1988).

type BlackboardTypeSubscriber = (entry: BlackboardEntry) => void
const typeSubscribers = new Map<string, BlackboardTypeSubscriber[]>()

/** Subscribe to blackboard entries by type. Use '*' for wildcard (all types). */
export function subscribeToBlackboard(type: string, callback: BlackboardTypeSubscriber): void {
  if (!typeSubscribers.has(type)) typeSubscribers.set(type, [])
  typeSubscribers.get(type)!.push(callback)
}

/**
 * Write an entry to the blackboard AND broadcast to all type-based subscribers.
 * This is the preferred write path when cognitive modules should be notified.
 */
export function broadcastToBlackboard(
  key: string,
  value: unknown,
  author: string,
  type: BlackboardEntry['type'],
  confidence: number = 1.0,
): BlackboardEntry {
  // Write to blackboard (this already notifies key-based subscribers)
  const entry = blackboardWrite(key, value, author, type, confidence)

  // Broadcast to type-based subscribers
  const typeSubs = typeSubscribers.get(type) || []
  const wildcardSubs = typeSubscribers.get('*') || []
  for (const sub of [...typeSubs, ...wildcardSubs]) {
    try { sub(entry) } catch { /* subscriber errors don't break the bus */ }
  }

  return entry
}

/** Clear the entire blackboard for a new task */
export function blackboardClear(): void {
  blackboard.entries.clear()
  subscriptionCallbacks.clear()
}

// ── 3. Negotiation ──

export interface Proposal {
  id: string
  author: string
  description: string
  rationale: string
  votes: Map<string, { vote: 'agree' | 'disagree' | 'abstain'; reason?: string }>
  status: 'open' | 'accepted' | 'rejected' | 'compromised'
  resolution?: string
  created: string
}

const proposals = new Map<string, Proposal>()

/** Propose an approach for multi-agent negotiation */
export function propose(author: string, description: string, rationale: string): Proposal {
  const proposal: Proposal = {
    id: shortId(),
    author,
    description,
    rationale,
    votes: new Map(),
    status: 'open',
    created: now(),
  }
  // Author implicitly agrees with their own proposal
  proposal.votes.set(author, { vote: 'agree' })
  proposals.set(proposal.id, proposal)
  return proposal
}

/** Cast a vote on a proposal */
export function vote(
  proposalId: string,
  agentId: string,
  v: 'agree' | 'disagree' | 'abstain',
  reason?: string,
): Proposal {
  const p = proposals.get(proposalId)
  if (!p) throw new Error(`Proposal ${proposalId} not found`)
  if (p.status !== 'open') throw new Error(`Proposal ${proposalId} is ${p.status}, voting closed`)
  p.votes.set(agentId, { vote: v, reason })
  return p
}

/** Resolve a proposal: majority wins, trust-weighted tiebreaking */
export function resolveProposal(proposalId: string): Proposal {
  const p = proposals.get(proposalId)
  if (!p) throw new Error(`Proposal ${proposalId} not found`)
  if (p.status !== 'open') throw new Error(`Proposal ${proposalId} is already ${p.status}`)

  let agrees = 0
  let disagrees = 0

  for (const [, { vote: v }] of p.votes) {
    if (v === 'agree') agrees++
    else if (v === 'disagree') disagrees++
    // abstain doesn't count
  }

  if (agrees > disagrees) {
    p.status = 'accepted'
    p.resolution = `Accepted: ${agrees} agree, ${disagrees} disagree`
  } else if (disagrees > agrees) {
    p.status = 'rejected'
    p.resolution = `Rejected: ${disagrees} disagree, ${agrees} agree`
  } else {
    // Tie — use trust-weighted tiebreaking
    let agreeWeight = 0
    let disagreeWeight = 0

    for (const [agentId, { vote: v }] of p.votes) {
      if (v === 'abstain') continue
      const trust = getTrust(agentId)
      if (v === 'agree') agreeWeight += trust
      else disagreeWeight += trust
    }

    if (agreeWeight >= disagreeWeight) {
      p.status = 'accepted'
      p.resolution = `Accepted by trust-weighted tiebreak: agree=${agreeWeight.toFixed(2)}, disagree=${disagreeWeight.toFixed(2)}`
    } else {
      p.status = 'rejected'
      p.resolution = `Rejected by trust-weighted tiebreak: disagree=${disagreeWeight.toFixed(2)}, agree=${agreeWeight.toFixed(2)}`
    }
  }

  return p
}

/** Get consensus state of all proposals */
export function getConsensus(): Proposal[] {
  return Array.from(proposals.values()).sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  )
}

// ── 4. Trust Delegation ──

export interface TrustProfile {
  agentId: string
  domains: Map<string, number>
  overall: number
  history: { task: string; success: boolean; domain: string; timestamp: string }[]
}

const trustProfiles = new Map<string, TrustProfile>()
let trustLoaded = false

const DEFAULT_TRUST = 0.5
const TRUST_INCREMENT = 0.05
const TRUST_DECREMENT = 0.10
const MAX_HISTORY = 100

/** Load trust profiles from ~/.kbot/trust.json */
function loadTrust(): void {
  if (trustLoaded) return
  trustLoaded = true

  try {
    const data = readFileSync(TRUST_FILE, 'utf-8')
    const parsed = JSON.parse(data) as Array<{
      agentId: string
      domains: Record<string, number>
      overall: number
      history: { task: string; success: boolean; domain: string; timestamp: string }[]
    }>

    for (const p of parsed) {
      trustProfiles.set(p.agentId, {
        agentId: p.agentId,
        domains: new Map(Object.entries(p.domains)),
        overall: p.overall,
        history: p.history ?? [],
      })
    }
  } catch {
    // File doesn't exist or is invalid — start fresh
  }
}

/** Save trust profiles to ~/.kbot/trust.json */
function saveTrust(): void {
  const serializable = Array.from(trustProfiles.values()).map(p => ({
    agentId: p.agentId,
    domains: Object.fromEntries(p.domains),
    overall: p.overall,
    history: p.history.slice(-MAX_HISTORY),
  }))

  try {
    mkdirSync(join(homedir(), '.kbot'), { recursive: true })
    writeFileSync(TRUST_FILE, JSON.stringify(serializable, null, 2))
  } catch {
    // Best-effort persistence — don't crash on write failure
  }
}

/** Get or create a trust profile for an agent */
function getOrCreateProfile(agentId: string): TrustProfile {
  loadTrust()
  let profile = trustProfiles.get(agentId)
  if (!profile) {
    profile = {
      agentId,
      domains: new Map(),
      overall: DEFAULT_TRUST,
      history: [],
    }
    trustProfiles.set(agentId, profile)
  }
  return profile
}

/** Get trust score for an agent, optionally in a specific domain */
export function getTrust(agentId: string, domain?: string): number {
  const profile = getOrCreateProfile(agentId)
  if (domain) {
    return profile.domains.get(domain) ?? DEFAULT_TRUST
  }
  return profile.overall
}

/** Update trust for an agent after task completion */
export function updateTrust(agentId: string, domain: string, success: boolean): void {
  const profile = getOrCreateProfile(agentId)

  // Update domain-specific trust
  const currentDomain = profile.domains.get(domain) ?? DEFAULT_TRUST
  const newDomain = success
    ? Math.min(1.0, currentDomain + TRUST_INCREMENT)
    : Math.max(0.0, currentDomain - TRUST_DECREMENT)
  profile.domains.set(domain, newDomain)

  // Recalculate overall trust as average of all domain scores
  const domainValues = Array.from(profile.domains.values())
  profile.overall = domainValues.reduce((sum, v) => sum + v, 0) / domainValues.length

  // Record history
  profile.history.push({
    task: domain,
    success,
    domain,
    timestamp: now(),
  })

  // Trim history to prevent unbounded growth
  if (profile.history.length > MAX_HISTORY) {
    profile.history = profile.history.slice(-MAX_HISTORY)
  }

  saveTrust()
}

/** Get the most trusted agent for a specific domain */
export function getMostTrusted(domain: string): { agentId: string; trust: number } | null {
  loadTrust()

  let best: { agentId: string; trust: number } | null = null

  for (const profile of trustProfiles.values()) {
    const score = profile.domains.get(domain) ?? DEFAULT_TRUST
    if (!best || score > best.trust) {
      best = { agentId: profile.agentId, trust: score }
    }
  }

  return best
}

/** Get the full trust matrix for all agents */
export function getTrustReport(): string {
  loadTrust()

  if (trustProfiles.size === 0) {
    return 'No trust data recorded yet.'
  }

  const lines: string[] = ['Agent Trust Report', '─'.repeat(50)]

  for (const profile of trustProfiles.values()) {
    lines.push(`\n${profile.agentId} (overall: ${profile.overall.toFixed(2)})`)

    if (profile.domains.size > 0) {
      const sorted = Array.from(profile.domains.entries()).sort((a, b) => b[1] - a[1])
      for (const [domain, score] of sorted) {
        const bar = '█'.repeat(Math.round(score * 10)) + '░'.repeat(10 - Math.round(score * 10))
        lines.push(`  ${domain.padEnd(15)} ${bar} ${score.toFixed(2)}`)
      }
    }

    const recentHistory = profile.history.slice(-5)
    if (recentHistory.length > 0) {
      lines.push(`  Recent: ${recentHistory.map(h => h.success ? '+' : '-').join('')}`)
    }
  }

  return lines.join('\n')
}

// ── Tool Registration ──

export function registerAgentProtocolTools(): void {
  registerTool({
    name: 'agent_handoff',
    deprecated: true,
    description: 'Create a handoff to transfer work to another agent. Includes context, artifacts, and priority. The receiving agent can accept or reject. Use this when a task is better suited for a different specialist.',
    parameters: {
      from: { type: 'string', description: 'Agent ID initiating the handoff', required: true },
      to: { type: 'string', description: 'Target agent ID to hand off to (e.g., coder, researcher, writer, analyst, guardian, creative, developer)', required: true },
      reason: { type: 'string', description: 'Why this handoff is needed', required: true },
      context: { type: 'string', description: 'What the receiving agent needs to know to continue the work', required: true },
      artifacts: { type: 'string', description: 'Comma-separated file paths or data keys to pass along' },
      priority: { type: 'string', description: 'Priority: low, normal, high, critical (default: normal)' },
    },
    tier: 'free',
    async execute(args) {
      const from = String(args.from)
      const to = String(args.to)
      const reason = String(args.reason)
      const context = String(args.context)
      const artifacts = args.artifacts ? String(args.artifacts).split(',').map(s => s.trim()) : []
      const priority = (['low', 'normal', 'high', 'critical'].includes(String(args.priority))
        ? String(args.priority)
        : 'normal') as Handoff['priority']

      const handoff = createHandoff(from, to, reason, context, artifacts, priority)

      const lines = [
        `Handoff created: ${handoff.id}`,
        `  ${from} → ${to} [${priority}]`,
        `  Reason: ${reason}`,
        `  Context: ${context.slice(0, 200)}${context.length > 200 ? '...' : ''}`,
      ]
      if (artifacts.length > 0) {
        lines.push(`  Artifacts: ${artifacts.join(', ')}`)
      }

      // Show active handoffs
      const pending = getActiveHandoffs()
      if (pending.length > 1) {
        lines.push(`\n${pending.length} handoffs pending.`)
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'blackboard_write',
    deprecated: true,
    description: 'Write to the shared agent blackboard (working memory). Any agent can write facts, hypotheses, decisions, artifacts, or questions. Other agents can read these to coordinate without direct communication.',
    parameters: {
      key: { type: 'string', description: 'Key to write (e.g., "architecture_decision", "security_finding")', required: true },
      value: { type: 'string', description: 'Value to store (will be JSON-parsed if valid JSON, otherwise stored as string)', required: true },
      type: { type: 'string', description: 'Entry type: fact, hypothesis, decision, artifact, question (default: fact)' },
      confidence: { type: 'string', description: 'Confidence score 0-1 (default: 1.0)' },
      author: { type: 'string', description: 'Agent ID writing this entry (default: kernel)' },
    },
    tier: 'free',
    async execute(args) {
      const key = String(args.key)
      const rawValue = String(args.value)
      const type = (['fact', 'hypothesis', 'decision', 'artifact', 'question'].includes(String(args.type))
        ? String(args.type)
        : 'fact') as BlackboardEntry['type']
      const confidence = args.confidence ? parseFloat(String(args.confidence)) : 1.0
      const author = args.author ? String(args.author) : 'kernel'

      // Try to parse as JSON for structured data
      let value: unknown = rawValue
      try {
        value = JSON.parse(rawValue)
      } catch {
        // Keep as string
      }

      const entry = blackboardWrite(key, value, author, type, confidence)

      const subscriberInfo = entry.subscribers.length > 0
        ? ` (notifying: ${entry.subscribers.join(', ')})`
        : ''

      return `Blackboard [${type}] ${key} = ${typeof value === 'string' ? value.slice(0, 200) : JSON.stringify(value).slice(0, 200)}${subscriberInfo}\nAuthor: ${author} | Confidence: ${entry.confidence.toFixed(2)} | ${entry.timestamp}`
    },
  })

  registerTool({
    name: 'blackboard_read',
    deprecated: true,
    description: 'Read from the shared agent blackboard. Query a specific key or list all entries filtered by type. Use this to see what other agents have written and coordinate work.',
    parameters: {
      key: { type: 'string', description: 'Specific key to read. If omitted, returns all entries.' },
      type: { type: 'string', description: 'Filter by type: fact, hypothesis, decision, artifact, question' },
    },
    tier: 'free',
    async execute(args) {
      const key = args.key ? String(args.key) : undefined
      const type = args.type ? String(args.type) as BlackboardEntry['type'] : undefined

      if (key) {
        const entry = blackboardRead(key)
        if (!entry) return `Blackboard: key "${key}" not found.`

        const valueStr = typeof entry.value === 'string'
          ? entry.value
          : JSON.stringify(entry.value, null, 2)

        return [
          `Key: ${entry.key}`,
          `Type: ${entry.type} | Confidence: ${entry.confidence.toFixed(2)}`,
          `Author: ${entry.author} | Updated: ${entry.timestamp}`,
          `Subscribers: ${entry.subscribers.length > 0 ? entry.subscribers.join(', ') : 'none'}`,
          `Value:\n${valueStr}`,
        ].join('\n')
      }

      const entries = blackboardQuery(type)
      if (entries.length === 0) {
        return type ? `No ${type} entries on the blackboard.` : 'Blackboard is empty.'
      }

      const lines: string[] = [`Blackboard: ${entries.length} entries${type ? ` (type: ${type})` : ''}`]
      for (const e of entries) {
        const valuePreview = typeof e.value === 'string'
          ? e.value.slice(0, 80)
          : JSON.stringify(e.value).slice(0, 80)
        lines.push(`  [${e.type}] ${e.key} = ${valuePreview} (by ${e.author}, conf: ${e.confidence.toFixed(2)})`)
      }
      return lines.join('\n')
    },
  })

  registerTool({
    name: 'agent_propose',
    deprecated: true,
    description: 'Propose an approach for multi-agent negotiation. Other agents can vote agree/disagree/abstain. Use resolve to determine the outcome. Ties are broken by trust scores.',
    parameters: {
      action: { type: 'string', description: 'Action: propose, vote, resolve, or status', required: true },
      author: { type: 'string', description: 'Agent ID (for propose or vote)', required: true },
      description: { type: 'string', description: 'What is being proposed (for propose action)' },
      rationale: { type: 'string', description: 'Why this approach (for propose action)' },
      proposal_id: { type: 'string', description: 'Proposal ID (for vote or resolve)' },
      vote: { type: 'string', description: 'Vote: agree, disagree, or abstain (for vote action)' },
      reason: { type: 'string', description: 'Reason for the vote (for vote action)' },
    },
    tier: 'free',
    async execute(args) {
      const action = String(args.action)
      const author = String(args.author)

      switch (action) {
        case 'propose': {
          const description = String(args.description || '')
          const rationale = String(args.rationale || '')
          if (!description) return 'Error: description is required for propose action'
          if (!rationale) return 'Error: rationale is required for propose action'

          const p = propose(author, description, rationale)
          return [
            `Proposal ${p.id} created by ${author}`,
            `  "${description}"`,
            `  Rationale: ${rationale}`,
            `  Status: open (awaiting votes)`,
          ].join('\n')
        }

        case 'vote': {
          const proposalId = String(args.proposal_id || '')
          const v = String(args.vote || '') as 'agree' | 'disagree' | 'abstain'
          if (!proposalId) return 'Error: proposal_id is required for vote action'
          if (!['agree', 'disagree', 'abstain'].includes(v)) {
            return 'Error: vote must be agree, disagree, or abstain'
          }

          try {
            const p = vote(proposalId, author, v, args.reason ? String(args.reason) : undefined)
            const tally = { agree: 0, disagree: 0, abstain: 0 }
            for (const [, { vote: pv }] of p.votes) tally[pv]++
            return `Vote recorded: ${author} → ${v} on proposal ${proposalId}\n  Tally: ${tally.agree} agree, ${tally.disagree} disagree, ${tally.abstain} abstain`
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        }

        case 'resolve': {
          const proposalId = String(args.proposal_id || '')
          if (!proposalId) return 'Error: proposal_id is required for resolve action'

          try {
            const p = resolveProposal(proposalId)
            return [
              `Proposal ${p.id}: ${p.status.toUpperCase()}`,
              `  "${p.description}"`,
              `  ${p.resolution}`,
            ].join('\n')
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        }

        case 'status': {
          const all = getConsensus()
          if (all.length === 0) return 'No proposals.'

          const lines: string[] = [`${all.length} proposals:`]
          for (const p of all) {
            const tally = { agree: 0, disagree: 0, abstain: 0 }
            for (const [, { vote: pv }] of p.votes) tally[pv]++
            lines.push(`  [${p.status}] ${p.id}: "${p.description.slice(0, 60)}" — ${tally.agree}/${tally.disagree}/${tally.abstain} (a/d/ab)`)
          }
          return lines.join('\n')
        }

        default:
          return `Unknown action: ${action}. Use: propose, vote, resolve, or status`
      }
    },
  })

  registerTool({
    name: 'agent_trust',
    deprecated: true,
    description: 'Check or update trust scores for agents. Trust is asymmetric: success adds 0.05, failure subtracts 0.10. Scores persist across sessions in ~/.kbot/trust.json.',
    parameters: {
      action: { type: 'string', description: 'Action: check, update, best, or report', required: true },
      agent_id: { type: 'string', description: 'Agent ID to check or update' },
      domain: { type: 'string', description: 'Domain for trust lookup (e.g., coding, research, security)' },
      success: { type: 'string', description: 'Whether the task succeeded: true or false (for update action)' },
    },
    tier: 'free',
    async execute(args) {
      const action = String(args.action)

      switch (action) {
        case 'check': {
          const agentId = String(args.agent_id || '')
          if (!agentId) return 'Error: agent_id is required for check action'
          const domain = args.domain ? String(args.domain) : undefined
          const score = getTrust(agentId, domain)
          return domain
            ? `Trust for ${agentId} in ${domain}: ${score.toFixed(2)}`
            : `Overall trust for ${agentId}: ${score.toFixed(2)}`
        }

        case 'update': {
          const agentId = String(args.agent_id || '')
          const domain = String(args.domain || '')
          if (!agentId) return 'Error: agent_id is required for update action'
          if (!domain) return 'Error: domain is required for update action'
          const success = String(args.success) === 'true'

          const before = getTrust(agentId, domain)
          updateTrust(agentId, domain, success)
          const after = getTrust(agentId, domain)

          return `Trust updated for ${agentId} in ${domain}: ${before.toFixed(2)} → ${after.toFixed(2)} (${success ? '+success' : '-failure'})`
        }

        case 'best': {
          const domain = String(args.domain || '')
          if (!domain) return 'Error: domain is required for best action'
          const best = getMostTrusted(domain)
          if (!best) return `No trust data for domain: ${domain}`
          return `Most trusted for ${domain}: ${best.agentId} (${best.trust.toFixed(2)})`
        }

        case 'report':
          return getTrustReport()

        default:
          return `Unknown action: ${action}. Use: check, update, best, or report`
      }
    },
  })
}
