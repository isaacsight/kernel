// Shared Discord webhook helper. Replaces five near-identical copies that
// previously lived in community-manager, community-autopilot, personal-security,
// and notifications — each with its own truncation, timeout, and payload shape.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DISCORD_MESSAGE_LIMIT = 1900 // Discord's hard limit is 2000; leave room for truncation marker
const DEFAULT_TIMEOUT_MS = 10_000

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  timestamp?: string
  footer?: { text: string }
  fields?: { name: string; value: string; inline?: boolean }[]
  url?: string
}

export interface PostOptions {
  timeoutMs?: number
}

/** Read the Discord webhook URL from env, then ~/.kbot/config.json. Returns '' if neither is set. */
export function resolveDiscordWebhook(): string {
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL
  const configPath = join(homedir(), '.kbot', 'config.json')
  if (!existsSync(configPath)) return ''
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return config.discord_webhook || ''
  } catch {
    return ''
  }
}

/** POST a plain-content message. Truncates to Discord's 2000-char limit. */
export async function postDiscordContent(
  webhookUrl: string,
  content: string,
  opts: PostOptions = {},
): Promise<boolean> {
  if (!webhookUrl) return false
  const truncated = content.length > DISCORD_MESSAGE_LIMIT
    ? content.slice(0, DISCORD_MESSAGE_LIMIT) + '\n\n... (truncated)'
    : content
  return postRaw(webhookUrl, { content: truncated }, opts)
}

/** POST one or more embeds. */
export async function postDiscordEmbed(
  webhookUrl: string,
  embed: DiscordEmbed | DiscordEmbed[],
  opts: PostOptions = {},
): Promise<boolean> {
  if (!webhookUrl) return false
  const embeds = Array.isArray(embed) ? embed : [embed]
  return postRaw(webhookUrl, { embeds }, opts)
}

async function postRaw(webhookUrl: string, body: unknown, opts: PostOptions): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}
