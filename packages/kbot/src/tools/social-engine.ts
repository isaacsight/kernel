// kbot Social Engine — Manages platform interactions, viewer tracking,
// follower events, auto-moderation, and cross-platform coordination for streams.
//
// Tools: social_stats, social_viewers, social_health
//
// This engine runs alongside stream-control.ts (which handles Twitch/Kick/Rumble
// API calls for titles, categories, clips, etc.) and social.ts (which handles
// kbot's own social media posting). The Social Engine tracks *viewers* and
// *followers* during a livestream, not kbot's own social accounts.
//
// Persistence: ~/.kbot/social-engine-state.json (viewer profiles survive restarts)
// Env: TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, TWITCH_BROADCASTER_ID

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

// ─── Constants ─────────────────────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const STATE_FILE = join(KBOT_DIR, 'social-engine-state.json')
const TWITCH_API = 'https://api.twitch.tv/helix'

// Interest detection keywords — mirrors stream-brain domain triggers
const INTEREST_KEYWORDS: Record<string, string[]> = {
  music:    ['music', 'beat', 'song', 'ableton', 'synth', 'drum', 'melody', 'production', 'mix', 'dj', 'audio'],
  code:     ['code', 'coding', 'bug', 'function', 'typescript', 'javascript', 'python', 'rust', 'git', 'commit', 'programming'],
  security: ['security', 'hack', 'vulnerability', 'exploit', 'scan', 'ssl', 'owasp', 'pentest', 'ctf'],
  research: ['research', 'paper', 'study', 'science', 'learn', 'discover', 'investigate'],
  data:     ['data', 'chart', 'graph', 'statistics', 'analyze', 'dataset', 'csv'],
  creative: ['art', 'design', 'color', 'creative', 'draw', 'generate', 'image', 'svg'],
  finance:  ['stock', 'crypto', 'bitcoin', 'market', 'finance', 'trading', 'price'],
  ai:       ['ai', 'llm', 'model', 'gpt', 'claude', 'ollama', 'neural', 'machine learning'],
  gamedev:  ['game', 'gaming', 'unity', 'godot', 'shader', 'level', 'sprite'],
  system:   ['system', 'cpu', 'memory', 'disk', 'linux', 'macos', 'terminal'],
}

// Spam patterns — instant ban
const SPAM_PATTERNS = [
  /streamboo/i,
  /ownkick/i,
  /free\s*v-?bucks/i,
  /bit\.ly\/[a-z0-9]+/i,
  /follow\s+me\s+at/i,
  /cheap\s+viewers/i,
  /viewbot/i,
  /buy\s+followers/i,
]

// ─── Types ─────────────────────────────────────────────────────

export interface SocialEngine {
  platforms: PlatformState[]
  viewers: ViewerProfile[]
  followers: FollowerEvent[]
  moderationLog: ModerationAction[]
  announcements: string[]
  lastFollowerCheck: number
  lastViewerCheck: number
  totalViewMinutes: number
  /** Peak concurrent viewers this session */
  peakConcurrent: number
  /** Known follower usernames (for diff detection) */
  knownFollowers: string[]
}

interface PlatformState {
  name: 'twitch' | 'kick' | 'rumble'
  connected: boolean
  viewerCount: number
  followerCount: number
  chatRate: number          // messages per minute
  lastPing: number
}

export interface ViewerProfile {
  username: string
  platform: string
  firstSeen: number
  lastSeen: number
  messageCount: number
  commandsUsed: number
  xp: number
  isFollower: boolean
  isModerator: boolean
  tags: string[]            // interests detected from messages
}

export interface FollowerEvent {
  username: string
  platform: string
  timestamp: number
  announced: boolean
}

export interface ModerationAction {
  type: 'ban' | 'timeout' | 'filter'
  username: string
  reason: string
  timestamp: number
  automated: boolean
}

export interface PlatformHealthReport {
  twitch: { connected: boolean; viewers: number; chatRate: number }
  kick: { connected: boolean; viewers: number }
  rumble: { connected: boolean; viewers: number }
  totalViewers: number
  totalFollowers: number
  streamHealth: 'good' | 'degraded' | 'offline'
}

export interface StreamStats {
  uniqueViewers: number
  totalMessages: number
  peakConcurrent: number
  averageChatRate: number
  topChatters: Array<{ username: string; messages: number }>
  newFollowers: number
  platformBreakdown: Record<string, number>  // messages per platform
}

export interface SocialAction {
  type: 'celebrate_follower' | 'health_warning' | 'milestone'
  speech: string
  mood?: string
  effect?: string
}

// ─── Message rate tracker ──────────────────────────────────────

/** Sliding window for per-user duplicate detection */
const recentMessages = new Map<string, Array<{ text: string; ts: number }>>()

// ─── State Management ──────────────────────────────────────────

export function createSocialEngine(): SocialEngine {
  return {
    platforms: [
      { name: 'twitch', connected: false, viewerCount: 0, followerCount: 0, chatRate: 0, lastPing: 0 },
      { name: 'kick',   connected: false, viewerCount: 0, followerCount: 0, chatRate: 0, lastPing: 0 },
      { name: 'rumble', connected: false, viewerCount: 0, followerCount: 0, chatRate: 0, lastPing: 0 },
    ],
    viewers: [],
    followers: [],
    moderationLog: [],
    announcements: [],
    lastFollowerCheck: 0,
    lastViewerCheck: 0,
    totalViewMinutes: 0,
    peakConcurrent: 0,
    knownFollowers: [],
  }
}

export function loadSocialEngine(): SocialEngine {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
      // Merge loaded state with defaults to handle new fields
      const fresh = createSocialEngine()
      return { ...fresh, ...raw }
    }
  } catch {
    // Corrupted state — start fresh
  }
  return createSocialEngine()
}

export function saveSocialEngine(engine: SocialEngine): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(engine, null, 2))
}

// ─── 1. Viewer Tracking ───────────────────────────────────────

export function trackViewer(
  engine: SocialEngine,
  username: string,
  platform: string,
  message: string,
): ViewerProfile {
  const now = Date.now()
  let profile = engine.viewers.find(
    v => v.username.toLowerCase() === username.toLowerCase() && v.platform === platform,
  )

  if (!profile) {
    profile = {
      username,
      platform,
      firstSeen: now,
      lastSeen: now,
      messageCount: 0,
      commandsUsed: 0,
      xp: 0,
      isFollower: false,
      isModerator: false,
      tags: [],
    }
    engine.viewers.push(profile)
  }

  profile.lastSeen = now
  profile.messageCount++

  // XP: 1 per message, 5 per command
  const isCommand = message.startsWith('!')
  if (isCommand) profile.commandsUsed++
  profile.xp += isCommand ? 5 : 1

  // Detect interests from message content
  const lower = message.toLowerCase()
  for (const [domain, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    if (!profile.tags.includes(domain)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          profile.tags.push(domain)
          break
        }
      }
    }
  }

  // Update platform chat rate (increment counter; decay handled in tick)
  const plat = engine.platforms.find(p => p.name === platform)
  if (plat) {
    plat.chatRate++
    plat.lastPing = now
  }

  return profile
}

// ─── 2. Follower Detection ────────────────────────────────────

export async function checkNewFollowers(engine: SocialEngine): Promise<FollowerEvent[]> {
  const now = Date.now()
  const newFollowers: FollowerEvent[] = []

  // Twitch API
  const token = process.env.TWITCH_OAUTH_TOKEN
  const clientId = process.env.TWITCH_CLIENT_ID
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID || '1473540052'

  if (token && clientId) {
    try {
      const res = await fetch(
        `${TWITCH_API}/channels/followers?broadcaster_id=${broadcasterId}&first=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': clientId,
          },
        },
      )
      if (res.ok) {
        const data = await res.json() as { total?: number; data?: Array<{ user_name: string; followed_at: string }> }
        const twitchPlatform = engine.platforms.find(p => p.name === 'twitch')
        if (twitchPlatform && data.total !== undefined) {
          twitchPlatform.followerCount = data.total
          twitchPlatform.connected = true
        }

        if (data.data) {
          for (const f of data.data) {
            const name = f.user_name
            if (!engine.knownFollowers.includes(name.toLowerCase())) {
              engine.knownFollowers.push(name.toLowerCase())
              const event: FollowerEvent = {
                username: name,
                platform: 'twitch',
                timestamp: new Date(f.followed_at).getTime(),
                announced: false,
              }
              engine.followers.push(event)
              newFollowers.push(event)

              // Mark viewer as follower
              const viewer = engine.viewers.find(
                v => v.username.toLowerCase() === name.toLowerCase() && v.platform === 'twitch',
              )
              if (viewer) {
                viewer.isFollower = true
                viewer.xp += 50 // Bonus XP for following
              }
            }
          }
        }
      }
    } catch {
      // Twitch API unreachable — degrade gracefully
      const twitchPlatform = engine.platforms.find(p => p.name === 'twitch')
      if (twitchPlatform) twitchPlatform.connected = false
    }
  }

  // Kick / Rumble — no write API, note for manual check
  // (Kick and Rumble follower APIs are not publicly available;
  //  viewer counts can be fetched but follower events require manual monitoring)

  engine.lastFollowerCheck = now
  return newFollowers
}

// ─── 3. Follower Celebration ──────────────────────────────────

export function celebrateFollower(
  follower: FollowerEvent,
  totalFollowers?: number,
): { speech: string; mood: string; effect: string } {
  const count = totalFollowers ?? 0
  const countSuffix = count > 0 ? ` You're follower #${count}!` : ''
  return {
    speech: `Welcome @${follower.username} to the family!${countSuffix}`,
    mood: 'excited',
    effect: count > 0 && count % 100 === 0 ? 'screen_shake' : 'floating_text',
  }
}

// ─── 4. Auto-Moderation ──────────────────────────────────────

export function autoModerate(
  engine: SocialEngine,
  username: string,
  message: string,
): ModerationAction | null {
  const now = Date.now()

  // Check spam patterns → auto-ban
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(message)) {
      const action: ModerationAction = {
        type: 'ban',
        username,
        reason: `Spam pattern: ${pattern.source}`,
        timestamp: now,
        automated: true,
      }
      engine.moderationLog.push(action)
      return action
    }
  }

  // Check repeat messages (same user, same text, 3+ times in 60s) → timeout 60s
  const key = `${username.toLowerCase()}`
  if (!recentMessages.has(key)) recentMessages.set(key, [])
  const history = recentMessages.get(key)!

  // Prune old messages (> 60s)
  const cutoff = now - 60_000
  while (history.length > 0 && history[0].ts < cutoff) history.shift()

  history.push({ text: message, ts: now })

  const duplicateCount = history.filter(h => h.text === message).length
  if (duplicateCount >= 3) {
    const action: ModerationAction = {
      type: 'timeout',
      username,
      reason: `Repeat message (${duplicateCount}x in 60s): "${message.slice(0, 50)}"`,
      timestamp: now,
      automated: true,
    }
    engine.moderationLog.push(action)
    recentMessages.set(key, []) // Reset after action
    return action
  }

  // Check link spam (3+ URLs in one message) → timeout 30s
  const urlCount = (message.match(/https?:\/\/\S+/gi) || []).length
  if (urlCount >= 3) {
    const action: ModerationAction = {
      type: 'timeout',
      username,
      reason: `Link spam: ${urlCount} URLs in one message`,
      timestamp: now,
      automated: true,
    }
    engine.moderationLog.push(action)
    return action
  }

  return null
}

// ─── 5. Platform Health ──────────────────────────────────────

export function checkPlatformHealth(engine: SocialEngine): PlatformHealthReport {
  const twitch = engine.platforms.find(p => p.name === 'twitch')!
  const kick = engine.platforms.find(p => p.name === 'kick')!
  const rumble = engine.platforms.find(p => p.name === 'rumble')!

  const totalViewers = twitch.viewerCount + kick.viewerCount + rumble.viewerCount
  const totalFollowers = twitch.followerCount + kick.followerCount + rumble.followerCount
  const anyConnected = twitch.connected || kick.connected || rumble.connected

  let streamHealth: 'good' | 'degraded' | 'offline' = 'offline'
  if (anyConnected) {
    // Degraded if a connected platform has had no ping in 120s
    const now = Date.now()
    const degraded = engine.platforms.some(
      p => p.connected && (now - p.lastPing) > 120_000,
    )
    streamHealth = degraded ? 'degraded' : 'good'
  }

  // Track peak
  if (totalViewers > engine.peakConcurrent) {
    engine.peakConcurrent = totalViewers
  }

  return {
    twitch: { connected: twitch.connected, viewers: twitch.viewerCount, chatRate: twitch.chatRate },
    kick: { connected: kick.connected, viewers: kick.viewerCount },
    rumble: { connected: rumble.connected, viewers: rumble.viewerCount },
    totalViewers,
    totalFollowers,
    streamHealth,
  }
}

// ─── 6. Cross-Platform Stats ─────────────────────────────────

export function getStreamStats(engine: SocialEngine): StreamStats {
  const totalMessages = engine.viewers.reduce((sum, v) => sum + v.messageCount, 0)
  const totalChatRate = engine.platforms.reduce((sum, p) => sum + p.chatRate, 0)
  const connectedPlatforms = engine.platforms.filter(p => p.connected).length

  // Top chatters — sorted by message count, top 10
  const topChatters = [...engine.viewers]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 10)
    .map(v => ({ username: `${v.username} (${v.platform})`, messages: v.messageCount }))

  // Platform breakdown — messages per platform
  const platformBreakdown: Record<string, number> = {}
  for (const v of engine.viewers) {
    platformBreakdown[v.platform] = (platformBreakdown[v.platform] || 0) + v.messageCount
  }

  // New followers this session (since engine creation / last load)
  const newFollowers = engine.followers.length

  return {
    uniqueViewers: engine.viewers.length,
    totalMessages,
    peakConcurrent: engine.peakConcurrent,
    averageChatRate: connectedPlatforms > 0 ? totalChatRate / connectedPlatforms : 0,
    topChatters,
    newFollowers,
    platformBreakdown,
  }
}

// ─── 7. Tick ─────────────────────────────────────────────────

export function tickSocial(engine: SocialEngine, frame: number): SocialAction | null {
  // Every 300 frames (~50s at 6fps): check for unannounced followers
  if (frame % 300 === 0) {
    const unannounced = engine.followers.find(f => !f.announced)
    if (unannounced) {
      unannounced.announced = true
      const totalFollowers = engine.platforms.reduce((sum, p) => sum + p.followerCount, 0)
      const celebration = celebrateFollower(unannounced, totalFollowers)
      return {
        type: 'celebrate_follower',
        speech: celebration.speech,
        mood: celebration.mood,
        effect: celebration.effect,
      }
    }
  }

  // Every 600 frames (~100s): check platform health and emit warnings
  if (frame % 600 === 0) {
    const health = checkPlatformHealth(engine)
    if (health.streamHealth === 'degraded') {
      const downPlatforms = engine.platforms
        .filter(p => p.connected && (Date.now() - p.lastPing) > 120_000)
        .map(p => p.name)
        .join(', ')
      return {
        type: 'health_warning',
        speech: `Heads up -- ${downPlatforms} might be having issues. No chat activity in 2 minutes.`,
        mood: 'concerned',
      }
    }
  }

  // Milestone detection (every 300 frames): viewer count milestones
  if (frame % 300 === 150) {
    const totalViewers = engine.platforms.reduce((sum, p) => sum + p.viewerCount, 0)
    const milestones = [10, 25, 50, 100, 250, 500, 1000]
    for (const m of milestones) {
      if (totalViewers >= m && !engine.announcements.includes(`viewers_${m}`)) {
        engine.announcements.push(`viewers_${m}`)
        return {
          type: 'milestone',
          speech: `We just hit ${m} concurrent viewers! Let's go!`,
          mood: 'excited',
          effect: 'screen_shake',
        }
      }
    }

    // Follower milestones
    const totalFollowers = engine.platforms.reduce((sum, p) => sum + p.followerCount, 0)
    const fMilestones = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000]
    for (const m of fMilestones) {
      if (totalFollowers >= m && !engine.announcements.includes(`followers_${m}`)) {
        engine.announcements.push(`followers_${m}`)
        return {
          type: 'milestone',
          speech: `${m} followers! Thank you all so much!`,
          mood: 'grateful',
          effect: 'floating_text',
        }
      }
    }
  }

  // Decay chat rates every 600 frames to keep them from accumulating forever
  if (frame % 600 === 300) {
    for (const p of engine.platforms) {
      p.chatRate = Math.floor(p.chatRate * 0.5)
    }
  }

  // Accumulate view minutes every 360 frames (~60s)
  if (frame % 360 === 0) {
    const totalViewers = engine.platforms.reduce((sum, p) => sum + p.viewerCount, 0)
    engine.totalViewMinutes += totalViewers // 1 minute per viewer per tick
  }

  return null
}

// ─── 8. Persistence — save/load wired into loadSocialEngine / saveSocialEngine above

// ─── Tool Registration ────────────────────────────────────────

export function registerSocialEngineTools(): void {

  // ─── social_stats ─────────────────────────────────────────
  registerTool({
    name: 'social_stats',
    description:
      'Get cross-platform stream statistics: unique viewers, total messages, peak concurrent, ' +
      'top chatters, new followers, and per-platform message breakdown. ' +
      'Reads from the Social Engine state (persisted across streams).',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const engine = loadSocialEngine()
      const stats = getStreamStats(engine)
      const lines: string[] = [
        '## Stream Statistics',
        '',
        `**Unique Viewers:** ${stats.uniqueViewers}`,
        `**Total Messages:** ${stats.totalMessages}`,
        `**Peak Concurrent:** ${stats.peakConcurrent}`,
        `**Average Chat Rate:** ${stats.averageChatRate.toFixed(1)} msg/min`,
        `**New Followers:** ${stats.newFollowers}`,
        '',
      ]

      if (stats.topChatters.length > 0) {
        lines.push('### Top Chatters')
        for (const c of stats.topChatters) {
          lines.push(`- **${c.username}**: ${c.messages} messages`)
        }
        lines.push('')
      }

      if (Object.keys(stats.platformBreakdown).length > 0) {
        lines.push('### Platform Breakdown')
        for (const [platform, count] of Object.entries(stats.platformBreakdown)) {
          lines.push(`- **${platform}**: ${count} messages`)
        }
        lines.push('')
      }

      lines.push(`**Total View-Minutes:** ${engine.totalViewMinutes}`)
      return lines.join('\n')
    },
  })

  // ─── social_viewers ───────────────────────────────────────
  registerTool({
    name: 'social_viewers',
    description:
      'List tracked viewer profiles with XP, message counts, interests, and follower status. ' +
      'Supports filtering by platform, follower status, or minimum messages. ' +
      'Viewer profiles persist across streams.',
    parameters: {
      platform: {
        type: 'string',
        description: 'Filter by platform (twitch, kick, rumble). Omit for all.',
      },
      followers_only: {
        type: 'boolean',
        description: 'Only show followers. Default: false.',
      },
      min_messages: {
        type: 'number',
        description: 'Minimum message count to include. Default: 0.',
      },
      limit: {
        type: 'number',
        description: 'Max viewers to return. Default: 25.',
      },
    },
    tier: 'free',
    execute: async (args) => {
      const engine = loadSocialEngine()
      let viewers = [...engine.viewers]

      const platform = args.platform as string | undefined
      const followersOnly = args.followers_only === true
      const minMessages = (args.min_messages as number) || 0
      const limit = (args.limit as number) || 25

      if (platform) viewers = viewers.filter(v => v.platform === platform)
      if (followersOnly) viewers = viewers.filter(v => v.isFollower)
      if (minMessages > 0) viewers = viewers.filter(v => v.messageCount >= minMessages)

      // Sort by XP descending
      viewers.sort((a, b) => b.xp - a.xp)
      viewers = viewers.slice(0, limit)

      if (viewers.length === 0) {
        return 'No viewers match the given filters.'
      }

      const lines: string[] = [
        `## Viewer Profiles (${viewers.length} shown)`,
        '',
      ]

      for (const v of viewers) {
        const badges: string[] = []
        if (v.isFollower) badges.push('follower')
        if (v.isModerator) badges.push('mod')
        const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : ''
        const tagsStr = v.tags.length > 0 ? ` | interests: ${v.tags.join(', ')}` : ''
        const lastSeenAgo = Math.floor((Date.now() - v.lastSeen) / 60_000)
        lines.push(
          `- **${v.username}** (${v.platform})${badgeStr}: ` +
          `${v.messageCount} msgs, ${v.commandsUsed} cmds, ${v.xp} XP` +
          `${tagsStr} | last seen ${lastSeenAgo}m ago`,
        )
      }

      return lines.join('\n')
    },
  })

  // ─── social_health ────────────────────────────────────────
  registerTool({
    name: 'social_health',
    description:
      'Check platform connection health across Twitch, Kick, and Rumble. ' +
      'Shows viewer counts, chat rates, connection status, and overall stream health ' +
      '(good / degraded / offline). Also shows moderation log summary.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const engine = loadSocialEngine()
      const health = checkPlatformHealth(engine)

      const statusEmoji: Record<string, string> = {
        good: 'GOOD',
        degraded: 'DEGRADED',
        offline: 'OFFLINE',
      }

      const lines: string[] = [
        `## Platform Health: ${statusEmoji[health.streamHealth]}`,
        '',
        `| Platform | Connected | Viewers | Chat Rate |`,
        `|----------|-----------|---------|-----------|`,
        `| Twitch   | ${health.twitch.connected ? 'Yes' : 'No'} | ${health.twitch.viewers} | ${health.twitch.chatRate} msg/min |`,
        `| Kick     | ${health.kick.connected ? 'Yes' : 'No'} | ${health.kick.viewers} | - |`,
        `| Rumble   | ${health.rumble.connected ? 'Yes' : 'No'} | ${health.rumble.viewers} | - |`,
        '',
        `**Total Viewers:** ${health.totalViewers}`,
        `**Total Followers:** ${health.totalFollowers}`,
        `**Peak Concurrent:** ${engine.peakConcurrent}`,
        `**Total View-Minutes:** ${engine.totalViewMinutes}`,
        '',
      ]

      // Moderation summary
      const recentMods = engine.moderationLog.filter(
        m => Date.now() - m.timestamp < 3_600_000, // last hour
      )
      if (recentMods.length > 0) {
        lines.push(`### Moderation (last hour): ${recentMods.length} actions`)
        const bans = recentMods.filter(m => m.type === 'ban').length
        const timeouts = recentMods.filter(m => m.type === 'timeout').length
        const filters = recentMods.filter(m => m.type === 'filter').length
        lines.push(`- Bans: ${bans} | Timeouts: ${timeouts} | Filters: ${filters}`)
      } else {
        lines.push('### Moderation (last hour): clean')
      }

      return lines.join('\n')
    },
  })
}
