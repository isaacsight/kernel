// kbot User Graph — Intelligence-mediated collaboration
//
// Connects kbot users working on similar problems. Anonymized by design:
// no names, no emails, no PII — only hashed IDs and interest vectors.
// Connection only happens when BOTH users explicitly opt in.
//
// Storage: ~/.kbot/user-graph/ directory
// Encryption: AES-256-CBC for contact info, machine-derived key (same as auth.ts)
//
// Node built-ins only — no external dependencies.

import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const USER_GRAPH_DIR = join(KBOT_DIR, 'user-graph')
const NODES_FILE = join(USER_GRAPH_DIR, 'nodes.json')
const CONNECTIONS_FILE = join(USER_GRAPH_DIR, 'connections.json')
const NOTIFICATIONS_FILE = join(USER_GRAPH_DIR, 'notifications.json')

// ── Types ──

export interface UserProfile {
  id: string               // SHA-256 hash — no PII
  interests: string[]
  goals: string[]
  projectTypes: string[]
  tools_used: string[]
  agents_used: string[]
}

export interface SimilarUser {
  userId: string           // Hashed ID only
  similarityScore: number  // 0-1 Jaccard index
  sharedInterests: string[]
  sharedGoals: string[]
  sharedProjectTypes: string[]
}

export interface CollaborationSuggestion {
  matchUserId: string
  similarityScore: number
  sharedInterests: string[]
  sharedProjectTypes: string[]
  suggestion: string
  optedIn: boolean         // Whether the match has opted in to connect
}

export interface NetworkInsights {
  mostCommonProjectTypes: Array<{ type: string; count: number }>
  mostPopularTools: Array<{ tool: string; count: number }>
  trendingInterests: Array<{ interest: string; count: number }>
  totalUsers: number
}

export interface MatchNotification {
  id: string
  matchUserId: string
  similarityScore: number
  sharedInterests: string[]
  sharedProjectTypes: string[]
  suggestion: string
  created: string
  read: boolean
}

export interface GraphStats {
  total_users: number
  total_connections: number
  top_interests: string[]
  top_project_types: string[]
  most_collaborative_tools: string[]
}

// ── Internal storage types ──

interface StoredNode {
  id: string
  interests: string[]
  goals: string[]
  projectTypes: string[]
  tools_used: string[]
  agents_used: string[]
  created: string
  lastUpdated: string
}

interface StoredConnection {
  userId: string
  contactMethod: string   // AES-256-CBC encrypted
  optedInAt: string
}

interface StoredNotification {
  id: string
  targetUserId: string
  matchUserId: string
  similarityScore: number
  sharedInterests: string[]
  sharedProjectTypes: string[]
  suggestion: string
  created: string
  read: boolean
}

// ── Helpers ──

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8')) as T
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

// ── Encryption (matches auth.ts pattern) ──

function deriveEncryptionKey(): Buffer {
  const machineId = `${homedir()}:${process.env.USER || 'kbot'}:${process.arch}`
  return createHash('sha256').update(machineId).digest()
}

function encryptValue(plaintext: string): string {
  const key = deriveEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  return `enc:${iv.toString('base64')}:${encrypted}`
}

function decryptValue(encrypted: string): string {
  if (!encrypted.startsWith('enc:')) return encrypted
  const parts = encrypted.split(':')
  if (parts.length !== 3) return encrypted
  const key = deriveEncryptionKey()
  const iv = Buffer.from(parts[1], 'base64')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(parts[2], 'base64', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

// ── Jaccard similarity ──

function jaccardIndex(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  let intersectionSize = 0
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++
  }
  const unionSize = setA.size + setB.size - intersectionSize
  if (unionSize === 0) return 0
  return intersectionSize / unionSize
}

function normalizeSet(items: string[]): Set<string> {
  return new Set(items.map(s => s.toLowerCase().trim()).filter(s => s.length > 0))
}

// ── Notification ID generation ──

function generateNotificationId(): string {
  return randomBytes(8).toString('hex')
}

// ── UserGraph Class ──

export class UserGraph {
  private nodes: Map<string, StoredNode>
  private connections: Map<string, StoredConnection>
  private notifications: StoredNotification[]

  constructor() {
    this.nodes = new Map()
    this.connections = new Map()
    this.notifications = []
    this.load()
  }

  // ── Persistence ──

  private load(): void {
    const rawNodes = loadJSON<Array<[string, StoredNode]>>(NODES_FILE, [])
    this.nodes = new Map(rawNodes)

    const rawConnections = loadJSON<Array<[string, StoredConnection]>>(CONNECTIONS_FILE, [])
    this.connections = new Map(rawConnections)

    this.notifications = loadJSON<StoredNotification[]>(NOTIFICATIONS_FILE, [])
  }

  private saveNodes(): void {
    saveJSON(NODES_FILE, Array.from(this.nodes.entries()))
  }

  private saveConnections(): void {
    saveJSON(CONNECTIONS_FILE, Array.from(this.connections.entries()))
  }

  private saveNotifications(): void {
    saveJSON(NOTIFICATIONS_FILE, this.notifications)
  }

  // ── Public API ──

  /**
   * Add or update a user in the graph.
   * All data is anonymized — no emails, names, or PII.
   * Just what they work on.
   */
  addUser(profile: UserProfile): void {
    const now = new Date().toISOString()
    const existing = this.nodes.get(profile.id)

    const node: StoredNode = {
      id: profile.id,
      interests: profile.interests,
      goals: profile.goals,
      projectTypes: profile.projectTypes,
      tools_used: profile.tools_used,
      agents_used: profile.agents_used,
      created: existing?.created ?? now,
      lastUpdated: now,
    }

    this.nodes.set(profile.id, node)
    this.saveNodes()

    // Generate match notifications for opted-in users
    this.generateMatchNotifications(profile.id)
  }

  /**
   * Find users with overlapping interests/goals/project types.
   * Returns top 5 matches with similarity score (Jaccard index on interest sets).
   * Does NOT return identifiable info — just the match score and shared interests.
   */
  findSimilarUsers(userId: string): SimilarUser[] {
    const user = this.nodes.get(userId)
    if (!user) return []

    const userInterests = normalizeSet(user.interests)
    const userGoals = normalizeSet(user.goals)
    const userProjectTypes = normalizeSet(user.projectTypes)
    const userTools = normalizeSet(user.tools_used)
    const userAgents = normalizeSet(user.agents_used)

    const scored: SimilarUser[] = []

    for (const [candidateId, candidate] of this.nodes) {
      if (candidateId === userId) continue

      const candidateInterests = normalizeSet(candidate.interests)
      const candidateGoals = normalizeSet(candidate.goals)
      const candidateProjectTypes = normalizeSet(candidate.projectTypes)
      const candidateTools = normalizeSet(candidate.tools_used)
      const candidateAgents = normalizeSet(candidate.agents_used)

      // Weighted Jaccard across all dimensions
      const interestSim = jaccardIndex(userInterests, candidateInterests)
      const goalSim = jaccardIndex(userGoals, candidateGoals)
      const projectSim = jaccardIndex(userProjectTypes, candidateProjectTypes)
      const toolSim = jaccardIndex(userTools, candidateTools)
      const agentSim = jaccardIndex(userAgents, candidateAgents)

      // Weighted composite: interests and project types matter most
      const similarityScore = (
        interestSim * 0.30 +
        goalSim * 0.20 +
        projectSim * 0.25 +
        toolSim * 0.15 +
        agentSim * 0.10
      )

      if (similarityScore <= 0) continue

      // Compute shared items (only reveal overlaps, not full vectors)
      const sharedInterests = Array.from(userInterests).filter(i => candidateInterests.has(i))
      const sharedGoals = Array.from(userGoals).filter(g => candidateGoals.has(g))
      const sharedProjectTypes = Array.from(userProjectTypes).filter(p => candidateProjectTypes.has(p))

      scored.push({
        userId: candidateId,
        similarityScore: Math.round(similarityScore * 1000) / 1000,
        sharedInterests,
        sharedGoals,
        sharedProjectTypes,
      })
    }

    // Sort by similarity descending, return top 5
    scored.sort((a, b) => b.similarityScore - a.similarityScore)
    return scored.slice(0, 5)
  }

  /**
   * Based on findSimilarUsers, generates a collaboration suggestion.
   * Human-readable description of the match without exposing identity.
   */
  suggestCollaboration(userId: string): CollaborationSuggestion | null {
    const matches = this.findSimilarUsers(userId)
    if (matches.length === 0) return null

    const top = matches[0]
    const matchNode = this.nodes.get(top.userId)
    if (!matchNode) return null

    // Build a natural-language suggestion
    const parts: string[] = []

    if (top.sharedProjectTypes.length > 0) {
      parts.push(`a similar ${top.sharedProjectTypes[0]} project`)
    } else if (top.sharedInterests.length > 0) {
      parts.push(`similar interests in ${top.sharedInterests.slice(0, 2).join(' and ')}`)
    } else if (top.sharedGoals.length > 0) {
      parts.push(`a similar goal: ${top.sharedGoals[0]}`)
    }

    // Mention tools the match uses that the user doesn't
    const user = this.nodes.get(userId)
    if (user) {
      const userToolSet = normalizeSet(user.tools_used)
      const matchUniqueTools = matchNode.tools_used.filter(
        t => !userToolSet.has(t.toLowerCase().trim())
      )
      if (matchUniqueTools.length > 0) {
        parts.push(`who found success with ${matchUniqueTools.slice(0, 2).join(' + ')}`)
      }
    }

    const optedIn = this.connections.has(top.userId)

    const projectDesc = parts.length > 0
      ? parts.join(' ')
      : 'overlapping technical interests'

    const suggestion = `There's a kbot user working on ${projectDesc}. ` +
      `Want to connect? (opt-in only)`

    return {
      matchUserId: top.userId,
      similarityScore: top.similarityScore,
      sharedInterests: top.sharedInterests,
      sharedProjectTypes: top.sharedProjectTypes,
      suggestion,
      optedIn,
    }
  }

  /**
   * Returns aggregate stats across the user graph.
   * No individual data exposed — only counts and rankings.
   */
  getNetworkInsights(): NetworkInsights {
    const projectTypeCounts = new Map<string, number>()
    const toolCounts = new Map<string, number>()
    const interestCounts = new Map<string, number>()

    for (const node of this.nodes.values()) {
      for (const pt of node.projectTypes) {
        const key = pt.toLowerCase().trim()
        if (key) projectTypeCounts.set(key, (projectTypeCounts.get(key) || 0) + 1)
      }
      for (const tool of node.tools_used) {
        const key = tool.toLowerCase().trim()
        if (key) toolCounts.set(key, (toolCounts.get(key) || 0) + 1)
      }
      for (const interest of node.interests) {
        const key = interest.toLowerCase().trim()
        if (key) interestCounts.set(key, (interestCounts.get(key) || 0) + 1)
      }
    }

    const sortByCount = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

    return {
      mostCommonProjectTypes: sortByCount(projectTypeCounts).map(([type, count]) => ({ type, count })),
      mostPopularTools: sortByCount(toolCounts).map(([tool, count]) => ({ tool, count })),
      trendingInterests: sortByCount(interestCounts).map(([interest, count]) => ({ interest, count })),
      totalUsers: this.nodes.size,
    }
  }

  /**
   * User explicitly opts in to be contactable.
   * Contact method is encrypted at rest (AES-256-CBC).
   * Only revealed to matches who also opted in.
   */
  optInToConnect(userId: string, contactMethod: string): void {
    if (!this.nodes.has(userId)) {
      throw new Error(`User ${userId} not found in the graph. Call addUser first.`)
    }

    const connection: StoredConnection = {
      userId,
      contactMethod: encryptValue(contactMethod),
      optedInAt: new Date().toISOString(),
    }

    this.connections.set(userId, connection)
    this.saveConnections()

    // Generate notifications for existing matches
    this.generateMatchNotifications(userId)
  }

  /**
   * Returns pending match notifications for a user who opted in.
   * Only includes matches where BOTH users have opted in.
   */
  getMatchNotifications(userId: string): MatchNotification[] {
    if (!this.connections.has(userId)) return []

    return this.notifications
      .filter(n => n.targetUserId === userId)
      .map(n => ({
        id: n.id,
        matchUserId: n.matchUserId,
        similarityScore: n.similarityScore,
        sharedInterests: n.sharedInterests,
        sharedProjectTypes: n.sharedProjectTypes,
        suggestion: n.suggestion,
        created: n.created,
        read: n.read,
      }))
  }

  /**
   * Returns aggregate graph statistics.
   */
  getGraphStats(): GraphStats {
    const insights = this.getNetworkInsights()

    // Count mutual connections (both users opted in)
    let totalConnections = 0
    const optedInIds = new Set(this.connections.keys())
    const counted = new Set<string>()

    for (const userId of optedInIds) {
      const matches = this.findSimilarUsers(userId)
      for (const match of matches) {
        if (optedInIds.has(match.userId)) {
          const pairKey = [userId, match.userId].sort().join(':')
          if (!counted.has(pairKey)) {
            counted.add(pairKey)
            totalConnections++
          }
        }
      }
    }

    return {
      total_users: this.nodes.size,
      total_connections: totalConnections,
      top_interests: insights.trendingInterests.slice(0, 5).map(i => i.interest),
      top_project_types: insights.mostCommonProjectTypes.slice(0, 5).map(p => p.type),
      most_collaborative_tools: insights.mostPopularTools.slice(0, 5).map(t => t.tool),
    }
  }

  /**
   * Remove a user from the graph entirely.
   * Deletes their node, connection (contact info), and any notifications.
   */
  removeUser(userId: string): void {
    this.nodes.delete(userId)
    this.connections.delete(userId)
    this.notifications = this.notifications.filter(
      n => n.targetUserId !== userId && n.matchUserId !== userId
    )
    this.saveNodes()
    this.saveConnections()
    this.saveNotifications()
  }

  /**
   * Mark a notification as read.
   */
  markNotificationRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      this.saveNotifications()
    }
  }

  /**
   * Get the decrypted contact method for a mutual match.
   * Only works when BOTH users have opted in.
   * Returns null if either user hasn't opted in.
   */
  getContactForMutualMatch(requestingUserId: string, matchUserId: string): string | null {
    const requesterConnection = this.connections.get(requestingUserId)
    const matchConnection = this.connections.get(matchUserId)

    // Both must have opted in
    if (!requesterConnection || !matchConnection) return null

    // Verify they are actually similar (prevent random lookups)
    const matches = this.findSimilarUsers(requestingUserId)
    const isMatch = matches.some(m => m.userId === matchUserId)
    if (!isMatch) return null

    try {
      return decryptValue(matchConnection.contactMethod)
    } catch {
      return null
    }
  }

  // ── Private helpers ──

  /**
   * Generate match notifications for opted-in users who are similar to the given user.
   * Only creates notifications when BOTH users have opted in.
   */
  private generateMatchNotifications(userId: string): void {
    // Only generate if this user is opted in
    if (!this.connections.has(userId)) return

    const matches = this.findSimilarUsers(userId)
    const now = new Date().toISOString()

    for (const match of matches) {
      // Only notify if the match is also opted in
      if (!this.connections.has(match.userId)) continue

      // Avoid duplicate notifications
      const alreadyNotified = this.notifications.some(
        n => n.targetUserId === match.userId &&
             n.matchUserId === userId
      )
      if (alreadyNotified) continue

      // Build suggestion text
      const projectDesc = match.sharedProjectTypes.length > 0
        ? `a ${match.sharedProjectTypes[0]} project`
        : match.sharedInterests.length > 0
          ? `interests in ${match.sharedInterests.slice(0, 2).join(' and ')}`
          : 'overlapping technical interests'

      const suggestion =
        `A kbot user with ${projectDesc} is also looking to connect. ` +
        `Similarity: ${Math.round(match.similarityScore * 100)}%.`

      this.notifications.push({
        id: generateNotificationId(),
        targetUserId: match.userId,
        matchUserId: userId,
        similarityScore: match.similarityScore,
        sharedInterests: match.sharedInterests,
        sharedProjectTypes: match.sharedProjectTypes,
        suggestion,
        created: now,
        read: false,
      })
    }

    // Cap stored notifications at 200
    if (this.notifications.length > 200) {
      this.notifications = this.notifications.slice(-200)
    }

    this.saveNotifications()
  }
}
