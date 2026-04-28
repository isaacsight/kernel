// Slack channel adapter.
//
// Uses the Slack Web API directly via `fetch` — no SDK dependency.
// Token: SLACK_BOT_TOKEN (xoxb-…) with at minimum chat:write,
// channels:history, channels:read, groups:read scopes.

import type {
  ChannelAdapter,
  ChannelEnvelope,
  ChannelInfo,
  ChannelMessage,
  ChannelReceiveOptions,
} from './types.js'

const SLACK_API = 'https://slack.com/api'

interface SlackBaseResponse {
  ok: boolean
  error?: string
  warning?: string
}

interface SlackPostMessageResponse extends SlackBaseResponse {
  ts?: string
  channel?: string
  message?: { ts?: string; text?: string }
}

interface SlackHistoryMessage {
  ts: string
  user?: string
  bot_id?: string
  username?: string
  text?: string
}

interface SlackHistoryResponse extends SlackBaseResponse {
  messages?: SlackHistoryMessage[]
}

interface SlackConversation {
  id: string
  name?: string
  topic?: { value?: string }
}

interface SlackConversationsListResponse extends SlackBaseResponse {
  channels?: SlackConversation[]
}

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN is not set — Slack adapter cannot authenticate')
  }
  return token
}

async function slackFetch<T extends SlackBaseResponse>(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch(`${SLACK_API}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  // Slack always returns 200 with `ok` flag in the body, but guard anyway.
  if (!res.ok) {
    throw new Error(`Slack API ${path} HTTP ${res.status}: ${res.statusText}`)
  }
  const json = (await res.json()) as T
  if (!json.ok) {
    throw new Error(`Slack API ${path} error: ${json.error ?? 'unknown_error'}`)
  }
  return json
}

function tsToMs(ts: string | undefined): number {
  if (!ts) return Date.now()
  // Slack `ts` is a string like "1700000000.000123" (seconds.microseconds).
  const n = Number.parseFloat(ts)
  if (Number.isNaN(n)) return Date.now()
  return Math.round(n * 1000)
}

function msToTs(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined
  return (ms / 1000).toFixed(6)
}

export const slackAdapter: ChannelAdapter = {
  name: 'slack',

  isConfigured(): boolean {
    return Boolean(process.env.SLACK_BOT_TOKEN)
  },

  async send(envelope: ChannelEnvelope): Promise<{ id: string; ts: number }> {
    const token = getToken()
    const body: Record<string, unknown> = {
      channel: envelope.channel,
      text: envelope.text,
    }
    if (envelope.blocks !== undefined) body.blocks = envelope.blocks
    if (envelope.options) Object.assign(body, envelope.options)

    const json = await slackFetch<SlackPostMessageResponse>('chat.postMessage', body, token)
    const ts = json.ts ?? json.message?.ts
    return { id: ts ?? '', ts: tsToMs(ts) }
  },

  async receive(opts: ChannelReceiveOptions): Promise<ChannelMessage[]> {
    const token = getToken()
    const body: Record<string, unknown> = {
      channel: opts.channel,
      limit: opts.limit ?? 100,
    }
    const oldest = msToTs(opts.oldest)
    if (oldest) body.oldest = oldest

    const json = await slackFetch<SlackHistoryResponse>('conversations.history', body, token)
    const messages = json.messages ?? []
    return messages.map((m) => ({
      id: m.ts,
      from: m.user ?? m.username ?? m.bot_id ?? 'unknown',
      text: m.text ?? '',
      ts: tsToMs(m.ts),
      raw: m,
    }))
  },

  async listChannels(): Promise<ChannelInfo[]> {
    const token = getToken()
    const json = await slackFetch<SlackConversationsListResponse>(
      'conversations.list',
      { exclude_archived: true, limit: 200 },
      token,
    )
    const channels = json.channels ?? []
    return channels.map((c) => ({
      id: c.id,
      name: c.name ?? c.id,
      topic: c.topic?.value,
    }))
  },
}

export default slackAdapter
