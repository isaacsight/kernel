// ─── Share Link Parser ───────────────────────────────────
//
// Detects share links from ChatGPT, Claude, and Gemini
// in user messages, fetches the page via url-fetch edge
// function, and parses the conversation into ParsedConversation
// format compatible with the conversation import pipeline.
//
// Flow: detect URL → fetch raw HTML → parse → ParsedConversation[]

import type { ParsedConversation } from './conversationImport'
import { fetchUrlContent, fetchUrlRaw } from '../components/ChatHelpers'

// ─── URL Pattern Detection ──────────────────────────────

const CHATGPT_SHARE_RE = /https?:\/\/(?:chat\.openai\.com|chatgpt\.com)\/share\/[\w-]+/
const CLAUDE_SHARE_RE = /https?:\/\/claude\.ai\/share\/[\w-]+/
const GEMINI_SHARE_RE = /https?:\/\/(?:gemini\.google\.com\/share\/[\w-]+|g\.co\/gemini\/share\/[\w-]+)/

export type SharePlatform = 'chatgpt' | 'claude' | 'gemini'

export interface ShareLinkMatch {
  url: string
  platform: SharePlatform
}

/**
 * Detect share links from ChatGPT, Claude, or Gemini in a message.
 * Returns all matched share links with their platform.
 */
export function detectShareLinks(text: string): ShareLinkMatch[] {
  const matches: ShareLinkMatch[] = []

  const chatgpt = text.match(new RegExp(CHATGPT_SHARE_RE.source, 'g'))
  if (chatgpt) chatgpt.forEach(url => matches.push({ url, platform: 'chatgpt' }))

  const claude = text.match(new RegExp(CLAUDE_SHARE_RE.source, 'g'))
  if (claude) claude.forEach(url => matches.push({ url, platform: 'claude' }))

  const gemini = text.match(new RegExp(GEMINI_SHARE_RE.source, 'g'))
  if (gemini) gemini.forEach(url => matches.push({ url, platform: 'gemini' }))

  return matches
}

/**
 * Check if a URL is a recognized AI platform share link.
 */
export function isShareLink(url: string): SharePlatform | null {
  if (CHATGPT_SHARE_RE.test(url)) return 'chatgpt'
  if (CLAUDE_SHARE_RE.test(url)) return 'claude'
  if (GEMINI_SHARE_RE.test(url)) return 'gemini'
  return null
}

// ─── HTML Parsers ───────────────────────────────────────

/**
 * Parse a ChatGPT share page's HTML for conversation data.
 *
 * ChatGPT embeds conversation data via React Router's loaderData.
 * In the SSR HTML, there may be a <script> with serialized state,
 * or we can extract from the visible rendered text.
 */
function parseChatGPTShareHtml(html: string): ParsedConversation | null {
  const messages: { role: string; content: string }[] = []

  // Strategy 1: Look for server-serialized JSON in <script> tags
  // ChatGPT may embed __remixContext or similar with conversation data
  const scriptMatch = html.match(/<script[^>]*>\s*window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i)
    || html.match(/<script[^>]*>\s*window\.__reactRouterContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i)

  if (scriptMatch) {
    try {
      const ctx = JSON.parse(scriptMatch[1])
      // Navigate to the conversation data in the serialized state
      const loaderData = ctx?.state?.loaderData || ctx?.loaderData || {}
      for (const key of Object.keys(loaderData)) {
        const data = loaderData[key]?.serverResponse?.data || loaderData[key]?.data
        if (data?.mapping) {
          // Same tree structure as conversations.json export
          return parseChatGPTMapping(data)
        }
        if (data?.linear_conversation) {
          // Some share pages use a linearized format
          for (const item of data.linear_conversation) {
            const msg = item?.message
            if (!msg) continue
            const role = msg.author?.role
            const text = msg.content?.parts
              ?.filter((p: unknown): p is string => typeof p === 'string')
              ?.join('')
              ?.trim()
            if (text && (role === 'user' || role === 'assistant')) {
              messages.push({ role, content: text })
            }
          }
          if (messages.length > 0) {
            const title = data.title || 'ChatGPT Conversation'
            return { source: 'chatgpt', title, messages }
          }
        }
      }
    } catch { /* JSON parse failed, fall through */ }
  }

  // Strategy 2: Look for __NEXT_DATA__ (older ChatGPT versions)
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/i)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const props = nextData?.props?.pageProps?.serverResponse?.data
      if (props?.mapping) {
        return parseChatGPTMapping(props)
      }
    } catch { /* fall through */ }
  }

  // Strategy 3: Parse visible text from rendered HTML
  return parseChatFromRenderedHtml(html, 'chatgpt')
}

/**
 * Parse ChatGPT's tree-based mapping structure into a linear conversation.
 */
function parseChatGPTMapping(data: { title?: string; mapping: Record<string, unknown> }): ParsedConversation | null {
  const messages: { role: string; content: string }[] = []
  const mapping = data.mapping

  // Find root (parent === null) and walk tree
  const visited = new Set<string>()
  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = mapping[nodeId] as {
      message?: { author: { role: string }; content: { parts?: (string | null)[] } }
      children?: string[]
    } | undefined
    if (!node) return

    if (node.message?.content?.parts) {
      const role = node.message.author.role
      const text = node.message.content.parts
        .filter((p): p is string => typeof p === 'string')
        .join('')
        .trim()
      if (text && (role === 'user' || role === 'assistant')) {
        messages.push({ role, content: text })
      }
    }

    for (const childId of (node.children || [])) {
      walk(childId)
    }
  }

  const rootId = Object.keys(mapping).find(id => {
    const n = mapping[id] as { parent?: string | null } | undefined
    return n?.parent === null || n?.parent === undefined
  })
  if (rootId) walk(rootId)

  if (messages.length === 0) return null
  return { source: 'chatgpt', title: data.title || 'ChatGPT Conversation', messages }
}

/**
 * Parse a Claude share page's HTML for conversation data.
 * Claude share pages render conversation messages in the DOM.
 */
function parseClaudeShareHtml(html: string): ParsedConversation | null {
  const messages: { role: string; content: string }[] = []

  // Strategy 1: Look for embedded JSON data
  // Claude may embed conversation data in a script tag
  const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []
  for (const tag of scriptTags) {
    const content = tag.replace(/<\/?script[^>]*>/gi, '').trim()
    if (content.includes('chat_messages') || content.includes('"sender"')) {
      try {
        // Try to find JSON within the script content
        const jsonMatch = content.match(/\{[\s\S]*"chat_messages"[\s\S]*\}/)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0])
          if (Array.isArray(data.chat_messages)) {
            for (const msg of data.chat_messages) {
              if (msg.text?.trim()) {
                messages.push({
                  role: msg.sender === 'human' ? 'user' : 'assistant',
                  content: msg.text.trim(),
                })
              }
            }
            if (messages.length > 0) {
              return { source: 'claude', title: data.name || 'Claude Conversation', messages }
            }
          }
        }
      } catch { /* fall through */ }
    }
  }

  // Strategy 2: Parse from rendered HTML using Claude's DOM patterns
  // Claude share pages render with data-testid or specific class patterns
  return parseChatFromRenderedHtml(html, 'claude')
}

/**
 * Parse a Gemini share page's HTML for conversation data.
 * Gemini share pages are static HTML — most parseable of the three.
 */
function parseGeminiShareHtml(html: string): ParsedConversation | null {
  // Strategy 1: Parse from rendered HTML structure
  // Gemini share pages render conversation turns as visible DOM elements
  return parseChatFromRenderedHtml(html, 'gemini')
}

/**
 * Generic fallback parser that extracts conversation turns from rendered HTML.
 * Works by identifying alternating user/assistant message blocks in the text.
 *
 * This is the "best effort" approach when structured JSON isn't available.
 * Share pages typically render messages with clear visual separation.
 */
function parseChatFromRenderedHtml(
  html: string,
  source: 'chatgpt' | 'claude' | 'gemini',
): ParsedConversation | null {
  const messages: { role: string; content: string }[] = []

  // Extract title from <title> or og:title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/)
  const title = ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || `${source} Conversation`

  // Strip scripts, styles, nav, header, footer
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')

  // Platform-specific message block extraction
  if (source === 'chatgpt') {
    // ChatGPT renders with data-message-author-role attributes
    const turnPattern = /data-message-author-role="(user|assistant)"[\s\S]*?<div[^>]*class="[^"]*markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    let match
    while ((match = turnPattern.exec(cleaned)) !== null) {
      const role = match[1]
      const content = stripTags(match[2]).trim()
      if (content) messages.push({ role, content })
    }
  }

  if (source === 'claude') {
    // Claude renders with human-turn / assistant-turn patterns
    const humanTurns = cleaned.match(/<div[^>]*class="[^"]*human[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []
    const assistantTurns = cleaned.match(/<div[^>]*class="[^"]*assistant[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []

    // Interleave human and assistant turns
    const maxLen = Math.max(humanTurns.length, assistantTurns.length)
    for (let i = 0; i < maxLen; i++) {
      if (humanTurns[i]) {
        const content = stripTags(humanTurns[i]).trim()
        if (content) messages.push({ role: 'user', content })
      }
      if (assistantTurns[i]) {
        const content = stripTags(assistantTurns[i]).trim()
        if (content) messages.push({ role: 'assistant', content })
      }
    }
  }

  if (source === 'gemini') {
    // Gemini renders conversation turns with query-text / model-response patterns
    const queryPattern = /<div[^>]*class="[^"]*query-text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    const responsePattern = /<div[^>]*class="[^"]*model-response[^"]*"[^>]*>([\s\S]*?)<\/div>/gi

    const queries = [...cleaned.matchAll(queryPattern)].map(m => stripTags(m[1]).trim())
    const responses = [...cleaned.matchAll(responsePattern)].map(m => stripTags(m[1]).trim())

    const maxLen = Math.max(queries.length, responses.length)
    for (let i = 0; i < maxLen; i++) {
      if (queries[i]) messages.push({ role: 'user', content: queries[i] })
      if (responses[i]) messages.push({ role: 'assistant', content: responses[i] })
    }
  }

  // If platform-specific parsing found nothing, try generic text extraction
  if (messages.length === 0) {
    return parseFromPlainText(html, source, title)
  }

  return messages.length > 0
    ? { source, title, messages }
    : null
}

/**
 * Last resort: parse conversation from the plain text output of the page.
 * Looks for patterns like "You said:" / response blocks.
 */
function parseFromPlainText(
  html: string,
  source: 'chatgpt' | 'claude' | 'gemini',
  title: string,
): ParsedConversation | null {
  // Strip all HTML to get plain text
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  if (!text || text.length < 20) return null

  const messages: { role: string; content: string }[] = []

  // ChatGPT share pages often have "You said:" labels
  const youSaidPattern = /You said:\s*([\s\S]*?)(?=ChatGPT said:|You said:|$)/gi
  const gptSaidPattern = /ChatGPT said:\s*([\s\S]*?)(?=You said:|ChatGPT said:|$)/gi

  const userMsgs = [...text.matchAll(youSaidPattern)]
  const assistantMsgs = [...text.matchAll(gptSaidPattern)]

  if (userMsgs.length > 0 || assistantMsgs.length > 0) {
    // Reconstruct by finding all markers and sorting by position
    const markers: { pos: number; role: string; content: string }[] = []
    for (const m of userMsgs) {
      markers.push({ pos: m.index!, role: 'user', content: m[1].trim() })
    }
    for (const m of assistantMsgs) {
      markers.push({ pos: m.index!, role: 'assistant', content: m[1].trim() })
    }
    markers.sort((a, b) => a.pos - b.pos)
    for (const m of markers) {
      if (m.content) messages.push({ role: m.role, content: m.content })
    }
  }

  // Claude share pages may show "Human:" / "Assistant:" labels
  if (messages.length === 0) {
    const humanPattern = /(?:^|\n)\s*(?:Human|User|You):\s*([\s\S]*?)(?=\n\s*(?:Assistant|Claude|AI):|\n\s*(?:Human|User|You):|$)/gi
    const assistPattern = /(?:^|\n)\s*(?:Assistant|Claude|AI):\s*([\s\S]*?)(?=\n\s*(?:Human|User|You):|\n\s*(?:Assistant|Claude|AI):|$)/gi

    const hMsgs = [...text.matchAll(humanPattern)]
    const aMsgs = [...text.matchAll(assistPattern)]

    if (hMsgs.length > 0 || aMsgs.length > 0) {
      const markers: { pos: number; role: string; content: string }[] = []
      for (const m of hMsgs) markers.push({ pos: m.index!, role: 'user', content: m[1].trim() })
      for (const m of aMsgs) markers.push({ pos: m.index!, role: 'assistant', content: m[1].trim() })
      markers.sort((a, b) => a.pos - b.pos)
      for (const m of markers) {
        if (m.content) messages.push({ role: m.role, content: m.content })
      }
    }
  }

  if (messages.length === 0) return null
  return { source, title, messages }
}

/**
 * Strip HTML tags from a string.
 */
function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}

// ─── Main Parser ────────────────────────────────────────

/**
 * Fetch and parse a share link into conversations.
 * Uses the url-fetch edge function to get the HTML,
 * then applies platform-specific parsers.
 *
 * Returns null if the link couldn't be parsed (caller should
 * fall back to passing the URL as regular context).
 */
export async function parseShareLink(url: string): Promise<ParsedConversation | null> {
  const platform = isShareLink(url)
  if (!platform) return null

  try {
    // Try raw HTML first for better parsing
    let html = await fetchUrlRaw(url)

    if (!html || html.length < 100) {
      // Fallback to text-only fetch
      const text = await fetchUrlContent(url)
      if (!text) return null
      // Wrap text in a minimal HTML structure for the parsers
      html = `<html><body>${text}</body></html>`
    }

    switch (platform) {
      case 'chatgpt':
        return parseChatGPTShareHtml(html)
      case 'claude':
        return parseClaudeShareHtml(html)
      case 'gemini':
        return parseGeminiShareHtml(html)
      default:
        return null
    }
  } catch {
    return null
  }
}
