// K:BOT Share — Share conversations as GitHub Gists for organic discovery
//
// Creates branded, shareable Gists from saved sessions or the current
// conversation. Each share links back to kbot, turning every user into
// a distribution channel.
//
// Usage:
//   /share                — share current conversation
//   /share <session-id>   — share a saved session
//   kbot share <id>       — CLI subcommand

import { execSync } from 'node:child_process'
import { getHistory, type ConversationTurn } from './memory.js'
import { loadSession, saveSession, type Session } from './sessions.js'

const KBOT_URL = 'https://www.npmjs.com/package/@kernel.chat/kbot'
const REPO_URL = 'https://github.com/isaacsight/kernel'

/**
 * Format a conversation into branded markdown for sharing.
 */
export function formatShareMarkdown(
  turns: ConversationTurn[],
  meta?: { name?: string; agent?: string; created?: string },
): string {
  const agent = meta?.agent || 'auto'
  const date = meta?.created
    ? new Date(meta.created).toLocaleDateString()
    : new Date().toLocaleDateString()
  const name = meta?.name || 'K:BOT Conversation'

  const lines: string[] = [
    `# ${name}`,
    '',
    `> Generated with [K:BOT](${KBOT_URL}) — 22 specialist agents, 223 tools, 20 AI providers`,
    `> Agent: \`${agent}\` | Date: ${date}`,
    '',
    '---',
    '',
  ]

  for (const turn of turns) {
    if (turn.role === 'user') {
      lines.push(`### You`, '', turn.content, '')
    } else {
      lines.push(`### K:BOT`, '', turn.content, '')
    }
    lines.push('---', '')
  }

  lines.push(
    '',
    '---',
    '',
    `*Shared from [K:BOT](${KBOT_URL}) — the open-source terminal AI agent by [kernel.chat](https://kernel.chat)*`,
    `*Install: \`npm install -g @kernel.chat/kbot\` | [GitHub](${REPO_URL})*`,
  )

  return lines.join('\n')
}

/**
 * Check if GitHub CLI (gh) is available and authenticated.
 */
function hasGitHubCLI(): boolean {
  try {
    execSync('gh auth status', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Create a GitHub Gist with the conversation and return the URL.
 */
export function createGist(
  content: string,
  filename: string,
  description: string,
  isPublic = true,
): string {
  const flag = isPublic ? '--public' : ''
  const safeDesc = description.replace(/'/g, "'\\''")
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-')

  // Write content to a temp file to avoid shell escaping issues
  const tmpFile = `/tmp/kbot-share-${Date.now()}.md`
  const { writeFileSync, unlinkSync } = require('node:fs') as typeof import('node:fs')
  writeFileSync(tmpFile, content, 'utf-8')

  try {
    const result = execSync(
      `gh gist create ${flag} --desc '${safeDesc}' --filename '${safeFilename}' '${tmpFile}'`,
      { encoding: 'utf-8', timeout: 15000 },
    ).trim()
    return result // gh gist create returns the URL
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

/**
 * Copy text to system clipboard (macOS/Linux/Windows).
 */
function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform
    if (platform === 'darwin') {
      execSync('pbcopy', { input: text, timeout: 3000 })
    } else if (platform === 'linux') {
      execSync('xclip -selection clipboard', { input: text, timeout: 3000 })
    } else if (platform === 'win32') {
      execSync('clip', { input: text, timeout: 3000 })
    } else {
      return false
    }
    return true
  } catch {
    return false
  }
}

export interface ShareResult {
  url?: string
  copied: boolean
  method: 'gist' | 'clipboard' | 'stdout'
  markdown: string
}

/**
 * Share a conversation. Tries GitHub Gist first, falls back to clipboard.
 *
 * @param sessionId - Optional session ID. If omitted, shares current conversation.
 * @param options - Share options
 */
export async function shareConversation(
  sessionId?: string,
  options: { public?: boolean; title?: string } = {},
): Promise<ShareResult> {
  let turns: ConversationTurn[]
  let meta: { name?: string; agent?: string; created?: string } = {}

  if (sessionId) {
    // Share a saved session
    const session = loadSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    turns = session.history
    meta = {
      name: options.title || session.name,
      agent: session.agent,
      created: session.created,
    }
  } else {
    // Share current conversation
    turns = getHistory()
    if (turns.length === 0) {
      throw new Error('No conversation to share. Say something first, or specify a session ID.')
    }
    // Auto-save the session so it's persisted
    const saved = saveSession(options.title)
    meta = {
      name: options.title || saved.name,
      agent: saved.agent,
      created: saved.created,
    }
  }

  const markdown = formatShareMarkdown(turns, meta)
  const title = meta.name || 'K:BOT Conversation'
  const filename = `kbot-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.md`

  // Try GitHub Gist first
  if (hasGitHubCLI()) {
    try {
      const url = createGist(
        markdown,
        filename,
        `${title} — shared from K:BOT`,
        options.public !== false,
      )
      if (url && url.startsWith('http')) {
        copyToClipboard(url)
        return { url, copied: true, method: 'gist', markdown }
      }
    } catch {
      // Fall through to clipboard
    }
  }

  // Fallback: copy markdown to clipboard
  const copied = copyToClipboard(markdown)
  return { copied, method: copied ? 'clipboard' : 'stdout', markdown }
}
