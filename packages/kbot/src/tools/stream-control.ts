// kbot Stream Control Tools — Manage Twitch, Kick, and Rumble dashboards
//
// Tools: stream_title, stream_category, stream_info, stream_viewers,
//        stream_chat_settings, stream_clip, stream_marker, stream_followers,
//        stream_chat_send, stream_ban, stream_announce, stream_dashboard,
//        stream_setup_oauth
//
// These tools manage the streaming platform *dashboards* — titles, categories,
// chat moderation, clips, markers, followers — not the video feed itself
// (that's in streaming.ts).
//
// Env: TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, TWITCH_BROADCASTER_ID
//      RUMBLE_API_KEY
//      KICK_CHANNEL_SLUG (for browser-based fallback)

import { registerTool } from './index.js'

// ─── Constants ─────────────────────────────────────────────────

const TWITCH_API = 'https://api.twitch.tv/helix'
const KICK_API = 'https://kick.com/api/v2'
const RUMBLE_API = 'https://rumble.com/-livestream-api/get-data'

// ─── Twitch Helpers ────────────────────────────────────────────

function twitchHeaders(): Record<string, string> {
  const token = process.env.TWITCH_OAUTH_TOKEN
  const clientId = process.env.TWITCH_CLIENT_ID
  if (!token || !clientId) {
    throw new Error(
      'Twitch OAuth not configured. Set TWITCH_OAUTH_TOKEN and TWITCH_CLIENT_ID.\n' +
      'Run stream_setup_oauth for instructions.'
    )
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Client-Id': clientId,
    'Content-Type': 'application/json',
  }
}

function getBroadcasterId(): string {
  const id = process.env.TWITCH_BROADCASTER_ID
  if (!id) {
    throw new Error(
      'TWITCH_BROADCASTER_ID not set. Find yours at: https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/'
    )
  }
  return id
}

async function twitchGet(endpoint: string): Promise<any> {
  const res = await fetch(`${TWITCH_API}${endpoint}`, { headers: twitchHeaders() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Twitch API ${res.status}: ${body}`)
  }
  return res.json()
}

async function twitchPatch(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${TWITCH_API}${endpoint}`, {
    method: 'PATCH',
    headers: twitchHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch API ${res.status}: ${text}`)
  }
  // 204 No Content is a success response for PATCH
  if (res.status === 204) return { ok: true }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return { ok: true }
}

async function twitchPost(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${TWITCH_API}${endpoint}`, {
    method: 'POST',
    headers: twitchHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch API ${res.status}: ${text}`)
  }
  if (res.status === 204) return { ok: true }
  return res.json()
}

// ─── Rumble Helpers ────────────────────────────────────────────

async function rumbleGetData(): Promise<any> {
  const key = process.env.RUMBLE_API_KEY
  if (!key) throw new Error('RUMBLE_API_KEY not set.')
  const res = await fetch(`${RUMBLE_API}?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error(`Rumble API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── Kick Helpers ──────────────────────────────────────────────

async function kickGetChannel(): Promise<any> {
  const slug = process.env.KICK_CHANNEL_SLUG
  if (!slug) throw new Error('KICK_CHANNEL_SLUG not set.')
  const res = await fetch(`${KICK_API}/channels/${encodeURIComponent(slug)}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Kick API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── Utility ───────────────────────────────────────────────────

function hasTwitch(): boolean {
  return !!(process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_CLIENT_ID)
}

function hasRumble(): boolean {
  return !!process.env.RUMBLE_API_KEY
}

function hasKick(): boolean {
  return !!process.env.KICK_CHANNEL_SLUG
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt)
  const now = new Date()
  const diff = now.getTime() - start.getTime()
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

function noPlatforms(): string {
  return (
    'No streaming platforms configured. Set at least one:\n' +
    '  TWITCH_CLIENT_ID + TWITCH_OAUTH_TOKEN + TWITCH_BROADCASTER_ID (Twitch)\n' +
    '  RUMBLE_API_KEY (Rumble)\n' +
    '  KICK_CHANNEL_SLUG (Kick)\n\n' +
    'Run stream_setup_oauth for detailed instructions.'
  )
}

// ─── Registration ──────────────────────────────────────────────

export function registerStreamControlTools(): void {

  // ── stream_title ──

  registerTool({
    name: 'stream_title',
    description: 'Update the stream title on Twitch. Optionally update the category/game at the same time. Kick dashboard changes require browser (noted in output).',
    parameters: {
      title: { type: 'string', description: 'New stream title (max 140 chars for Twitch)', required: true },
      category: { type: 'string', description: 'Optional: category/game name to set alongside the title' },
    },
    tier: 'free',
    execute: async (args) => {
      const title = String(args.title || '').slice(0, 140)
      if (!title) return 'Error: title is required.'

      const results: string[] = []

      // Twitch
      if (hasTwitch()) {
        try {
          const broadcasterId = getBroadcasterId()
          const body: Record<string, unknown> = { title }

          // If category provided, search for game_id first
          if (args.category) {
            const search = await twitchGet(`/search/categories?query=${encodeURIComponent(String(args.category))}&first=1`)
            if (search.data?.length > 0) {
              body.game_id = search.data[0].id
              results.push(`Twitch: title set to "${title}", category set to "${search.data[0].name}" (id: ${search.data[0].id})`)
            } else {
              results.push(`Twitch: title set to "${title}" (category "${args.category}" not found, skipped)`)
            }
          } else {
            results.push(`Twitch: title set to "${title}"`)
          }

          await twitchPatch(`/channels?broadcaster_id=${broadcasterId}`, body)
        } catch (e: any) {
          results.push(`Twitch: ${e.message}`)
        }
      }

      // Kick — no direct API for title changes
      if (hasKick()) {
        results.push('Kick: title changes require the dashboard (dashboard.kick.com/Stream). Use computer-use tools or kbot_browse to navigate there.')
      }

      // Rumble — read-only API
      if (hasRumble()) {
        results.push('Rumble: title changes not available via API. Use the Rumble Studio dashboard.')
      }

      if (results.length === 0) return noPlatforms()
      return results.join('\n')
    },
  })

  // ── stream_category ──

  registerTool({
    name: 'stream_category',
    description: 'Change the stream category/game on Twitch. Searches Twitch categories by name and applies the best match.',
    parameters: {
      category: { type: 'string', description: 'Category/game name to search for and set', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const query = String(args.category || '')
      if (!query) return 'Error: category is required.'

      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const search = await twitchGet(`/search/categories?query=${encodeURIComponent(query)}&first=5`)

        if (!search.data?.length) {
          return `No categories found for "${query}". Try a different search term.`
        }

        // Use the first match
        const cat = search.data[0]
        await twitchPatch(`/channels?broadcaster_id=${broadcasterId}`, { game_id: cat.id })

        const alternatives = search.data.slice(1, 5).map((c: any) => `  - ${c.name} (id: ${c.id})`).join('\n')
        let result = `Category set to: ${cat.name} (id: ${cat.id})`
        if (alternatives) result += `\n\nOther matches:\n${alternatives}`
        return result
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_info ──

  registerTool({
    name: 'stream_info',
    description: 'Get current stream info from Twitch (viewers, uptime, title, category) and Rumble (viewers, status). Shows whether you are live on each platform.',
    parameters: {
      platform: { type: 'string', description: 'Specific platform: "twitch", "kick", "rumble". Default: all configured' },
    },
    tier: 'free',
    execute: async (args) => {
      const platform = args.platform ? String(args.platform).toLowerCase() : 'all'
      const results: string[] = []

      // Twitch
      if ((platform === 'all' || platform === 'twitch') && hasTwitch()) {
        try {
          const broadcasterId = getBroadcasterId()
          const streams = await twitchGet(`/streams?user_id=${broadcasterId}`)
          const channelInfo = await twitchGet(`/channels?broadcaster_id=${broadcasterId}`)
          const channel = channelInfo.data?.[0]

          if (streams.data?.length > 0) {
            const s = streams.data[0]
            results.push(
              `TWITCH [LIVE]\n` +
              `  Title:    ${s.title}\n` +
              `  Category: ${s.game_name}\n` +
              `  Viewers:  ${s.viewer_count.toLocaleString()}\n` +
              `  Uptime:   ${formatUptime(s.started_at)}\n` +
              `  Language:  ${s.language}`
            )
          } else {
            results.push(
              `TWITCH [OFFLINE]\n` +
              `  Title:    ${channel?.title || 'N/A'}\n` +
              `  Category: ${channel?.game_name || 'N/A'}`
            )
          }
        } catch (e: any) {
          results.push(`TWITCH: Error — ${e.message}`)
        }
      }

      // Rumble
      if ((platform === 'all' || platform === 'rumble') && hasRumble()) {
        try {
          const data = await rumbleGetData()
          if (data.is_live) {
            results.push(
              `RUMBLE [LIVE]\n` +
              `  Viewers:    ${(data.viewers || 0).toLocaleString()}\n` +
              `  Chat count: ${(data.chat_messages || 0).toLocaleString()}`
            )
          } else {
            results.push('RUMBLE [OFFLINE]')
          }
        } catch (e: any) {
          results.push(`RUMBLE: Error — ${e.message}`)
        }
      }

      // Kick
      if ((platform === 'all' || platform === 'kick') && hasKick()) {
        try {
          const data = await kickGetChannel()
          const livestream = data.livestream
          if (livestream && livestream.is_live) {
            results.push(
              `KICK [LIVE]\n` +
              `  Title:    ${livestream.session_title || 'N/A'}\n` +
              `  Category: ${livestream.categories?.[0]?.name || 'N/A'}\n` +
              `  Viewers:  ${(livestream.viewer_count || 0).toLocaleString()}`
            )
          } else {
            results.push(
              `KICK [OFFLINE]\n` +
              `  Channel: ${data.slug || process.env.KICK_CHANNEL_SLUG}`
            )
          }
        } catch (e: any) {
          results.push(`KICK: Error — ${e.message}`)
        }
      }

      if (results.length === 0) return noPlatforms()
      return results.join('\n\n')
    },
  })

  // ── stream_viewers ──

  registerTool({
    name: 'stream_viewers',
    description: 'Get viewer count across all configured streaming platforms (Twitch, Kick, Rumble). Returns per-platform counts and a combined total.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const counts: { platform: string; viewers: number; live: boolean }[] = []

      // Twitch
      if (hasTwitch()) {
        try {
          const broadcasterId = getBroadcasterId()
          const streams = await twitchGet(`/streams?user_id=${broadcasterId}`)
          if (streams.data?.length > 0) {
            counts.push({ platform: 'Twitch', viewers: streams.data[0].viewer_count, live: true })
          } else {
            counts.push({ platform: 'Twitch', viewers: 0, live: false })
          }
        } catch (e: any) {
          counts.push({ platform: 'Twitch', viewers: 0, live: false })
        }
      }

      // Rumble
      if (hasRumble()) {
        try {
          const data = await rumbleGetData()
          counts.push({ platform: 'Rumble', viewers: data.viewers || 0, live: !!data.is_live })
        } catch {
          counts.push({ platform: 'Rumble', viewers: 0, live: false })
        }
      }

      // Kick
      if (hasKick()) {
        try {
          const data = await kickGetChannel()
          const live = data.livestream?.is_live || false
          counts.push({ platform: 'Kick', viewers: live ? (data.livestream?.viewer_count || 0) : 0, live })
        } catch {
          counts.push({ platform: 'Kick', viewers: 0, live: false })
        }
      }

      if (counts.length === 0) return noPlatforms()

      const total = counts.reduce((sum, c) => sum + c.viewers, 0)
      const lines = counts.map(c =>
        `  ${c.platform.padEnd(8)} ${c.live ? 'LIVE' : 'OFF '} ${c.viewers.toLocaleString().padStart(8)} viewers`
      )
      lines.push(`  ${'TOTAL'.padEnd(8)}      ${total.toLocaleString().padStart(8)} viewers`)

      return `Viewer counts:\n${lines.join('\n')}`
    },
  })

  // ── stream_chat_settings ──

  registerTool({
    name: 'stream_chat_settings',
    description: 'Manage Twitch chat settings: slow mode, subscriber-only mode, emote-only mode, follower-only mode. Pass the settings you want to change.',
    parameters: {
      slow_mode: { type: 'string', description: '"on" or "off" — enable/disable slow mode' },
      slow_mode_wait: { type: 'string', description: 'Seconds between messages in slow mode (3-120). Default: 10' },
      sub_only: { type: 'string', description: '"on" or "off" — subscriber-only mode' },
      emote_only: { type: 'string', description: '"on" or "off" — emote-only mode' },
      follower_only: { type: 'string', description: '"on" or "off" — follower-only mode' },
      follower_only_minutes: { type: 'string', description: 'Minutes a user must follow before chatting (0-129600). Default: 10' },
    },
    tier: 'free',
    execute: async (args) => {
      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const body: Record<string, unknown> = {}

        if (args.slow_mode !== undefined) {
          body.slow_mode = args.slow_mode === 'on'
          if (body.slow_mode && args.slow_mode_wait) {
            body.slow_mode_wait_time = Math.max(3, Math.min(120, parseInt(String(args.slow_mode_wait), 10) || 10))
          }
        }
        if (args.sub_only !== undefined) body.subscriber_mode = args.sub_only === 'on'
        if (args.emote_only !== undefined) body.emote_mode = args.emote_only === 'on'
        if (args.follower_only !== undefined) {
          body.follower_mode = args.follower_only === 'on'
          if (body.follower_mode && args.follower_only_minutes) {
            body.follower_mode_duration = Math.max(0, Math.min(129600, parseInt(String(args.follower_only_minutes), 10) || 10))
          }
        }

        if (Object.keys(body).length === 0) {
          return 'No settings provided. Available: slow_mode, sub_only, emote_only, follower_only'
        }

        // moderator_id = broadcaster_id when the broadcaster is the moderator
        await twitchPatch(`/chat/settings?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`, body)

        const applied = Object.entries(body)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')
        return `Chat settings updated:\n${applied}`
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_clip ──

  registerTool({
    name: 'stream_clip',
    description: 'Create a clip of the current Twitch stream. The stream must be live. Returns the clip edit URL.',
    parameters: {
      has_delay: { type: 'string', description: '"true" if the stream has a delay (captures from the delay buffer). Default: false' },
    },
    tier: 'free',
    execute: async (args) => {
      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()

        // Verify stream is live
        const streams = await twitchGet(`/streams?user_id=${broadcasterId}`)
        if (!streams.data?.length) {
          return 'Cannot create clip — stream is not live.'
        }

        const body: Record<string, unknown> = { broadcaster_id: broadcasterId }
        if (args.has_delay === 'true') body.has_delay = true

        const result = await twitchPost('/clips', body)
        const clip = result.data?.[0]
        if (clip) {
          return `Clip created!\n  Edit URL: ${clip.edit_url}\n  ID: ${clip.id}\n\nNote: It takes ~15 seconds for the clip to be processed.`
        }
        return 'Clip creation returned no data. The stream may not be clippable.'
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_marker ──

  registerTool({
    name: 'stream_marker',
    description: 'Add a stream marker (bookmark) on the current Twitch stream. Useful for marking interesting moments to highlight later. Stream must be live.',
    parameters: {
      description: { type: 'string', description: 'Description of the marker (max 140 chars). Default: "Marked by kbot"' },
    },
    tier: 'free',
    execute: async (args) => {
      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const description = String(args.description || 'Marked by kbot').slice(0, 140)

        const result = await twitchPost('/streams/markers', {
          user_id: broadcasterId,
          description,
        })

        const marker = result.data?.[0]
        if (marker) {
          return `Stream marker added at ${marker.position_seconds}s: "${description}"\n  ID: ${marker.id}\n  Created: ${marker.created_at}`
        }
        return 'Marker created (no position data returned). Stream must be live for markers to work.'
      } catch (e: any) {
        if (e.message.includes('404')) return 'Cannot add marker — stream is not live.'
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_followers ──

  registerTool({
    name: 'stream_followers',
    description: 'Get follower count and recent followers from Twitch. Shows total count and the latest followers with follow dates.',
    parameters: {
      count: { type: 'string', description: 'Number of recent followers to show (1-100). Default: 10' },
    },
    tier: 'free',
    execute: async (args) => {
      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const first = Math.max(1, Math.min(100, parseInt(String(args.count || '10'), 10) || 10))

        const result = await twitchGet(`/channels/followers?broadcaster_id=${broadcasterId}&first=${first}`)
        const total = result.total || 0
        const followers = (result.data || []).map((f: any) => {
          const date = new Date(f.followed_at).toLocaleDateString()
          return `  ${f.user_name.padEnd(25)} followed ${date}`
        })

        let output = `Total followers: ${total.toLocaleString()}\n`
        if (followers.length > 0) {
          output += `\nRecent followers:\n${followers.join('\n')}`
        } else {
          output += '\nNo recent followers found.'
        }
        return output
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_chat_send ──

  registerTool({
    name: 'stream_chat_send',
    description: 'Send a message to Twitch chat as the authenticated user/bot. Requires the chat:edit scope on the OAuth token.',
    parameters: {
      message: { type: 'string', description: 'Message to send to chat (max 500 chars)', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const message = String(args.message || '').slice(0, 500)
      if (!message) return 'Error: message is required.'

      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()

        await twitchPost('/chat/messages', {
          broadcaster_id: broadcasterId,
          sender_id: broadcasterId,
          message,
        })

        return `Message sent to Twitch chat: "${message}"`
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_ban ──

  registerTool({
    name: 'stream_ban',
    description: 'Ban or timeout a user from Twitch chat. Omit duration for a permanent ban. Set duration in seconds for a timeout.',
    parameters: {
      user_id: { type: 'string', description: 'Twitch user ID to ban. Use stream_followers or Twitch API to look up by username.', required: true },
      duration: { type: 'string', description: 'Timeout duration in seconds (1-1209600). Omit for permanent ban.' },
      reason: { type: 'string', description: 'Reason for the ban/timeout. Default: "Banned by kbot"' },
    },
    tier: 'free',
    execute: async (args) => {
      const userId = String(args.user_id || '')
      if (!userId) return 'Error: user_id is required.'

      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const banData: Record<string, unknown> = {
          user_id: userId,
          reason: String(args.reason || 'Banned by kbot'),
        }

        if (args.duration) {
          const dur = Math.max(1, Math.min(1_209_600, parseInt(String(args.duration), 10) || 600))
          banData.duration = dur
        }

        await twitchPost(`/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`, {
          data: banData,
        })

        const action = args.duration ? `timed out for ${args.duration}s` : 'permanently banned'
        return `User ${userId} ${action}. Reason: ${banData.reason}`
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_announce ──

  registerTool({
    name: 'stream_announce',
    description: 'Send an announcement to Twitch chat. Announcements appear highlighted in chat. Requires moderator:manage:chat_settings scope.',
    parameters: {
      message: { type: 'string', description: 'Announcement message', required: true },
      color: { type: 'string', description: 'Announcement color: "primary" (default), "blue", "green", "orange", "purple"' },
    },
    tier: 'free',
    execute: async (args) => {
      const message = String(args.message || '')
      if (!message) return 'Error: message is required.'

      if (!hasTwitch()) return 'Twitch not configured. Set TWITCH_CLIENT_ID, TWITCH_OAUTH_TOKEN, and TWITCH_BROADCASTER_ID.'

      try {
        const broadcasterId = getBroadcasterId()
        const validColors = ['primary', 'blue', 'green', 'orange', 'purple']
        const color = validColors.includes(String(args.color || '')) ? String(args.color) : 'primary'

        await twitchPost(
          `/chat/announcements?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`,
          { message, color }
        )

        return `Announcement sent (${color}): "${message}"`
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })

  // ── stream_dashboard ──

  registerTool({
    name: 'stream_dashboard',
    description: 'Get a unified dashboard view across all configured streaming platforms. Shows live status, viewers, title, category, uptime, and follower count from Twitch, Kick, and Rumble.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const sections: string[] = []
      const configured = [hasTwitch() && 'Twitch', hasRumble() && 'Rumble', hasKick() && 'Kick'].filter(Boolean)

      if (configured.length === 0) return noPlatforms()

      sections.push(`STREAM DASHBOARD — ${new Date().toLocaleString()}`)
      sections.push('═'.repeat(50))

      // Twitch
      if (hasTwitch()) {
        try {
          const broadcasterId = getBroadcasterId()
          const [streams, channelInfo, followers] = await Promise.all([
            twitchGet(`/streams?user_id=${broadcasterId}`),
            twitchGet(`/channels?broadcaster_id=${broadcasterId}`),
            twitchGet(`/channels/followers?broadcaster_id=${broadcasterId}&first=1`),
          ])

          const channel = channelInfo.data?.[0]
          const isLive = streams.data?.length > 0
          const stream = isLive ? streams.data[0] : null

          sections.push(
            `\nTWITCH ${isLive ? '🔴 LIVE' : '⚫ OFFLINE'}` +
            `\n  Title:     ${stream?.title || channel?.title || 'N/A'}` +
            `\n  Category:  ${stream?.game_name || channel?.game_name || 'N/A'}` +
            (isLive ? `\n  Viewers:   ${stream.viewer_count.toLocaleString()}` : '') +
            (isLive ? `\n  Uptime:    ${formatUptime(stream.started_at)}` : '') +
            `\n  Followers: ${(followers.total || 0).toLocaleString()}`
          )
        } catch (e: any) {
          sections.push(`\nTWITCH: Error — ${e.message}`)
        }
      }

      // Kick
      if (hasKick()) {
        try {
          const data = await kickGetChannel()
          const livestream = data.livestream
          const isLive = livestream?.is_live || false

          sections.push(
            `\nKICK ${isLive ? '🔴 LIVE' : '⚫ OFFLINE'}` +
            `\n  Channel:   ${data.slug || process.env.KICK_CHANNEL_SLUG}` +
            (isLive ? `\n  Title:     ${livestream.session_title || 'N/A'}` : '') +
            (isLive ? `\n  Category:  ${livestream.categories?.[0]?.name || 'N/A'}` : '') +
            (isLive ? `\n  Viewers:   ${(livestream.viewer_count || 0).toLocaleString()}` : '') +
            `\n  Followers: ${(data.followers_count || 0).toLocaleString()}`
          )
        } catch (e: any) {
          sections.push(`\nKICK: Error — ${e.message}`)
        }
      }

      // Rumble
      if (hasRumble()) {
        try {
          const data = await rumbleGetData()
          const isLive = !!data.is_live

          sections.push(
            `\nRUMBLE ${isLive ? '🔴 LIVE' : '⚫ OFFLINE'}` +
            (isLive ? `\n  Viewers:      ${(data.viewers || 0).toLocaleString()}` : '') +
            (isLive ? `\n  Chat msgs:    ${(data.chat_messages || 0).toLocaleString()}` : '') +
            (data.followers !== undefined ? `\n  Followers:    ${(data.followers || 0).toLocaleString()}` : '')
          )
        } catch (e: any) {
          sections.push(`\nRUMBLE: Error — ${e.message}`)
        }
      }

      // Combined stats
      let totalViewers = 0
      if (hasTwitch()) {
        try {
          const broadcasterId = getBroadcasterId()
          const s = await twitchGet(`/streams?user_id=${broadcasterId}`)
          if (s.data?.length) totalViewers += s.data[0].viewer_count
        } catch { /* skip */ }
      }
      if (hasRumble()) {
        try {
          const d = await rumbleGetData()
          if (d.is_live) totalViewers += d.viewers || 0
        } catch { /* skip */ }
      }
      if (hasKick()) {
        try {
          const d = await kickGetChannel()
          if (d.livestream?.is_live) totalViewers += d.livestream.viewer_count || 0
        } catch { /* skip */ }
      }

      sections.push(`\n${'═'.repeat(50)}`)
      sections.push(`Combined viewers: ${totalViewers.toLocaleString()}`)
      sections.push(`Platforms: ${configured.join(', ')}`)

      return sections.join('\n')
    },
  })

  // ── stream_setup_oauth ──

  registerTool({
    name: 'stream_setup_oauth',
    description: 'Show instructions for setting up OAuth tokens for Twitch, Kick, and Rumble streaming platform control. Does not execute anything — just shows the setup guide.',
    parameters: {
      platform: { type: 'string', description: 'Specific platform to show setup for: "twitch", "kick", "rumble". Default: all' },
    },
    tier: 'free',
    execute: async (args) => {
      const platform = args.platform ? String(args.platform).toLowerCase() : 'all'
      const sections: string[] = []

      sections.push('STREAM CONTROL — OAUTH SETUP GUIDE')
      sections.push('═'.repeat(50))

      if (platform === 'all' || platform === 'twitch') {
        const scopes = [
          'channel:manage:broadcast',
          'chat:edit',
          'chat:read',
          'moderator:manage:chat_settings',
          'clips:edit',
          'channel:read:stream_key',
          'moderator:manage:banned_users',
          'moderator:manage:announcements',
          'channel:read:editors',
        ].join('+')

        sections.push(`
TWITCH (Helix API)
──────────────────
1. Go to: https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
3. Name: "kbot" (or anything)
4. OAuth Redirect URL: http://localhost
5. Category: Chat Bot
6. Click "Create" — note the Client ID

7. Generate an OAuth token:
   Open this URL in your browser (replace YOUR_CLIENT_ID):

   https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=token&scope=${scopes}

8. After authorizing, you'll be redirected to:
   http://localhost/#access_token=YOUR_TOKEN&...
   Copy the access_token value.

9. Find your broadcaster ID:
   https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/

10. Set environment variables:
    export TWITCH_CLIENT_ID="your_client_id"
    export TWITCH_OAUTH_TOKEN="your_access_token"
    export TWITCH_BROADCASTER_ID="your_user_id"

Required scopes:
  channel:manage:broadcast — update title/category
  chat:edit — send chat messages
  chat:read — read chat
  moderator:manage:chat_settings — slow mode, sub-only, etc.
  clips:edit — create clips
  moderator:manage:banned_users — ban/timeout users
  moderator:manage:announcements — send announcements`)
      }

      if (platform === 'all' || platform === 'kick') {
        sections.push(`
KICK
────
Kick has a limited public API. For most dashboard actions, kbot uses
its built-in browser (kbot_browse) or computer-use tools to navigate
dashboard.kick.com.

For basic channel info via API:
  export KICK_CHANNEL_SLUG="your_channel_name"

For full dashboard control, use kbot with --computer-use flag:
  kbot --computer-use "update my Kick stream title"`)
      }

      if (platform === 'all' || platform === 'rumble') {
        sections.push(`
RUMBLE
──────
Rumble provides a livestream API key for reading stream data.

1. Go to your Rumble account settings
2. Find the "Livestream API" section
3. Copy your API key

4. Set environment variable:
   export RUMBLE_API_KEY="your_api_key"

Note: Rumble's API is mostly read-only (viewer count, chat, status).
For dashboard changes, use kbot with --computer-use flag or kbot_browse.`)
      }

      // Show current status
      sections.push(`\n${'═'.repeat(50)}`)
      sections.push('CURRENT STATUS:')
      sections.push(`  Twitch:  ${hasTwitch() ? 'Configured' : 'NOT configured'}${process.env.TWITCH_BROADCASTER_ID ? '' : ' (missing TWITCH_BROADCASTER_ID)'}`)
      sections.push(`  Kick:    ${hasKick() ? 'Configured' : 'NOT configured'}`)
      sections.push(`  Rumble:  ${hasRumble() ? 'Configured' : 'NOT configured'}`)

      return sections.join('\n')
    },
  })
}
