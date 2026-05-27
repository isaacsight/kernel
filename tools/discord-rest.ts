// Shared Discord REST helper used by setup, check-guilds, create-server,
// and the channel agents. Centralizes 429 handling (the original copies
// only handled it in one of three places) and the env-mutation helper.

import * as fs from 'fs'

export const DISCORD_API = 'https://discord.com/api/v10'

export function botHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  }
}

export interface DiscordApiOptions {
  token: string
  maxRetries?: number
}

export async function discordApi(
  path: string,
  opts: DiscordApiOptions,
  method: string = 'GET',
  body?: unknown,
): Promise<any> {
  const maxRetries = opts.maxRetries ?? 3
  let attempt = 0

  while (true) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: botHeaders(opts.token),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 429) {
      if (attempt++ >= maxRetries) {
        throw new Error(`Discord ${method} ${path}: rate limited after ${maxRetries} retries`)
      }
      const retryAfter = Number(res.headers.get('Retry-After') || 5)
      console.log(`  Rate limited on ${method} ${path}, waiting ${retryAfter}s...`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Discord ${method} ${path}: ${res.status} ${text}`)
    }

    return res.json()
  }
}

// Append `KEY=VALUE` to .env iff KEY isn't already present.
// Used by discord-create-server.ts and discord-check-guilds.ts; previously
// both files inlined the same read/check/append pattern.
export function appendEnvIfMissing(envPath: string, key: string, value: string): boolean {
  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
  if (new RegExp(`^${key}=`, 'm').test(content)) return false
  const sep = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  fs.appendFileSync(envPath, `${sep}${key}=${value}\n`)
  return true
}
