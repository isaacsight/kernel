// Supabase Edge Function: import-conversation
// Fetches a shared conversation link from ChatGPT, Claude, or Gemini
// and extracts structured message data.
//
// Strategy: These platforms are SPAs — the HTML shell has no content.
// 1. ChatGPT: Hit the backend JSON API at /backend-api/share/{id}
// 2. Claude/Gemini: Fetch HTML with full browser UA, parse what we can,
//    then use Haiku to extract turns from the raw text as a fallback.
//
// Deploy: npx supabase functions deploy import-conversation --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, checkSSRF } from '../_shared/validate.ts'

// ─── Configuration ──────────────────────────────────────
const MAX_MESSAGES = 200
const MAX_HTML_SIZE = 2_000_000 // 2MB

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Safe text reader — enforces MAX_HTML_SIZE on response body
async function safeReadText(res: Response): Promise<string> {
  const cl = res.headers.get('content-length')
  if (cl && parseInt(cl, 10) > MAX_HTML_SIZE) {
    throw new Error(`Response too large (${cl} bytes, max ${MAX_HTML_SIZE})`)
  }
  const text = await res.text()
  if (text.length > MAX_HTML_SIZE) {
    return text.slice(0, MAX_HTML_SIZE)
  }
  return text
}

// ─── Platform detection ────────────────────────────────
type Platform = 'chatgpt' | 'claude' | 'gemini'

function detectPlatform(url: string): Platform | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '')
    if (host === 'chatgpt.com' || host === 'chat.openai.com') return 'chatgpt'
    if (host === 'claude.ai') return 'claude'
    if (host === 'gemini.google.com' || host === 'g.co') return 'gemini'
    return null
  } catch {
    return null
  }
}

// Extract share ID from URL path
function extractShareId(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Patterns: /share/UUID, /share/UUID/continue, /s/UUID
    const match = parsed.pathname.match(/\/(?:share|s)\/([a-zA-Z0-9_-]+)/)
    return match?.[1] || null
  } catch {
    return null
  }
}

// ─── HTML entity decoding ──────────────────────────────
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

// ─── Types ─────────────────────────────────────────────

interface ParsedMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ParseResult {
  platform: Platform | 'unknown'
  title: string
  messages: ParsedMessage[]
}

// ─── ChatGPT: Backend JSON API ─────────────────────────

async function fetchChatGPT(url: string): Promise<ParseResult> {
  const shareId = extractShareId(url)
  if (!shareId) {
    return { platform: 'chatgpt', title: 'ChatGPT Conversation', messages: [] }
  }

  // ChatGPT exposes a public JSON API for shared conversations
  const apiUrl = `https://chatgpt.com/backend-api/share/${shareId}`
  console.log(`[import] Trying ChatGPT API: ${apiUrl}`)

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json',
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    console.log(`[import] ChatGPT API returned ${res.status}, falling back to HTML`)
    return fetchChatGPTHtml(url)
  }

  try {
    const data = await res.json()

    const title = data.title || data.chat_title || 'ChatGPT Conversation'
    const mapping = data.mapping || data.data?.mapping || {}
    const messages: ParsedMessage[] = []

    // The mapping is a tree of nodes. Walk it to extract messages in order.
    // Find the root node (no parent), then walk children in order.
    const nodes = mapping as Record<string, {
      id: string
      parent?: string | null
      children?: string[]
      message?: {
        author?: { role?: string }
        content?: { parts?: string[]; content_type?: string }
        status?: string
      }
    }>

    // Build a depth-first ordered list from the tree
    const rootId = Object.keys(nodes).find(id => !nodes[id].parent)
    if (rootId) {
      const queue: string[] = [rootId]
      const visited = new Set<string>()
      while (queue.length > 0) {
        const nodeId = queue.shift()!
        if (visited.has(nodeId)) continue
        visited.add(nodeId)

        const node = nodes[nodeId]
        if (node?.message?.content?.parts?.length) {
          const role = node.message.author?.role
          if (role === 'user' || role === 'assistant') {
            const content = node.message.content.parts
              .filter((p: unknown) => typeof p === 'string')
              .join('\n')
              .trim()
            if (content) {
              messages.push({ role, content })
            }
          }
        }
        // Add children to queue
        if (node?.children) {
          queue.push(...node.children)
        }
      }
    } else {
      // No tree structure, just iterate all nodes
      for (const node of Object.values(nodes)) {
        const msg = node?.message
        if (!msg?.content?.parts?.length) continue
        const role = msg.author?.role
        if (role !== 'user' && role !== 'assistant') continue
        const content = msg.content.parts
          .filter((p: unknown) => typeof p === 'string')
          .join('\n')
          .trim()
        if (content) {
          messages.push({ role: role as 'user' | 'assistant', content })
        }
      }
    }

    if (messages.length > 0) {
      return { platform: 'chatgpt', title, messages: messages.slice(0, MAX_MESSAGES) }
    }

    console.log('[import] ChatGPT API returned JSON but no messages extracted')
    return { platform: 'chatgpt', title, messages: [] }
  } catch (err) {
    console.error('[import] ChatGPT API JSON parse failed:', err)
    return fetchChatGPTHtml(url)
  }
}

async function fetchChatGPTHtml(url: string): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
    redirect: 'follow',
  })
  if (!res.ok) return { platform: 'chatgpt', title: 'ChatGPT Conversation', messages: [] }

  const html = await safeReadText(res)
  const messages: ParsedMessage[] = []
  let title = ''

  // Try __NEXT_DATA__ JSON blob
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1])
      const pageProps = data?.props?.pageProps
      if (pageProps) {
        title = pageProps.title || pageProps.chatTitle || ''
        const mapping = pageProps.serverResponse?.data?.mapping || pageProps.mapping || {}
        for (const node of Object.values(mapping) as Array<{ message?: { author?: { role?: string }; content?: { parts?: string[] } } }>) {
          const msg = node?.message
          if (!msg?.content?.parts?.length) continue
          const role = msg.author?.role
          if (role !== 'user' && role !== 'assistant') continue
          const content = msg.content.parts.join('\n').trim()
          if (content) messages.push({ role: role as 'user' | 'assistant', content })
        }
      }
    } catch { /* parse error */ }
  }

  // Try data-message-author-role pattern
  if (messages.length === 0) {
    const turnPattern = /data-message-author-role="(user|assistant)"[\s\S]*?<div[^>]*class="[^"]*markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/g
    let match
    while ((match = turnPattern.exec(html)) !== null) {
      const content = stripTags(match[2])
      if (content) messages.push({ role: match[1] as 'user' | 'assistant', content })
    }
  }

  if (!title) {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    title = ogTitle?.[1] || titleTag?.[1] || 'ChatGPT Conversation'
  }

  return { platform: 'chatgpt', title: decodeEntities(title), messages: messages.slice(0, MAX_MESSAGES) }
}

// ─── Claude: Fetch and parse ───────────────────────────

async function fetchClaude(url: string): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  if (!res.ok) return { platform: 'claude', title: 'Claude Conversation', messages: [] }

  const html = await safeReadText(res)
  const messages: ParsedMessage[] = []

  // Look for role markers in HTML structure
  const blocks = html.split(/(?=<div[^>]*(?:data-|class=)[^>]*(?:human|user|assistant|ai))/i)
  for (const block of blocks) {
    const isHuman = /(?:data-|class=)[^>]*(?:human|user)/i.test(block)
    const isAssistant = /(?:data-|class=)[^>]*(?:assistant|ai)/i.test(block)
    if (!isHuman && !isAssistant) continue
    const content = stripTags(block)
    if (content.length > 5) {
      messages.push({ role: isHuman ? 'user' : 'assistant', content })
    }
  }

  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = ogTitle?.[1] || titleTag?.[1] || 'Claude Conversation'

  // If HTML parsing found nothing, try the raw text approach
  if (messages.length === 0) {
    const text = stripTags(html)
    if (text.length > 50) {
      return await extractTurnsWithHaiku(text, 'claude', decodeEntities(title))
    }
  }

  return { platform: 'claude', title: decodeEntities(title), messages: messages.slice(0, MAX_MESSAGES) }
}

// ─── Gemini: Fetch and parse ───────────────────────────

async function fetchGemini(url: string): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  if (!res.ok) return { platform: 'gemini', title: 'Gemini Conversation', messages: [] }

  const html = await safeReadText(res)
  const messages: ParsedMessage[] = []

  // Gemini share pages — look for conversation blocks
  const blocks = html.split(/(?=<div[^>]*(?:data-|class=)[^>]*(?:query|response|user|model|prompt|answer))/i)
  for (const block of blocks) {
    const isUser = /(?:data-|class=)[^>]*(?:query|user|prompt)/i.test(block)
    const isModel = /(?:data-|class=)[^>]*(?:response|model|answer)/i.test(block)
    if (!isUser && !isModel) continue
    const content = stripTags(block)
    if (content.length > 5) {
      messages.push({ role: isUser ? 'user' : 'assistant', content })
    }
  }

  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = ogTitle?.[1] || titleTag?.[1] || 'Gemini Conversation'

  // If HTML parsing found nothing, try the raw text approach
  if (messages.length === 0) {
    const text = stripTags(html)
    if (text.length > 50) {
      return await extractTurnsWithHaiku(text, 'gemini', decodeEntities(title))
    }
  }

  return { platform: 'gemini', title: decodeEntities(title), messages: messages.slice(0, MAX_MESSAGES) }
}

// ─── Generic: unknown platform ─────────────────────────

async function fetchGeneric(url: string): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
    redirect: 'follow',
  })
  if (!res.ok) return { platform: 'unknown', title: 'Imported Conversation', messages: [] }

  const html = await safeReadText(res)
  const text = stripTags(html)

  if (text.length > 50) {
    return await extractTurnsWithHaiku(text, 'unknown', 'Imported Conversation')
  }

  return { platform: 'unknown', title: 'Imported Conversation', messages: [] }
}

// ─── Haiku fallback: extract conversation turns from raw text ─────

async function extractTurnsWithHaiku(
  text: string,
  platform: Platform | 'unknown',
  title: string
): Promise<ParseResult> {
  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY')
  if (!claudeApiKey) {
    console.warn('[import] No Claude API key — cannot use Haiku fallback')
    // Best-effort: try simple pattern matching
    return simplePatternExtract(text, platform, title)
  }

  // Truncate to fit Haiku context
  const truncated = text.slice(0, 12000)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `You extract conversation turns from raw text. The text is from a shared ${platform} conversation page. Extract the user messages and assistant responses as a JSON array. Return ONLY valid JSON, no explanation.

Format: {"title": "conversation title if visible", "messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}

Rules:
- "role" must be exactly "user" or "assistant"
- Preserve the content as-is, don't summarize
- If you can't identify turns, return {"title": "", "messages": []}
- Skip navigation, headers, footers, and UI text
- Only include actual conversation content`,
        messages: [{
          role: 'user',
          content: `Extract the conversation turns from this text:\n\n${truncated}`,
        }],
      }),
    })

    if (!res.ok) {
      console.error('[import] Haiku API error:', res.status)
      return simplePatternExtract(text, platform, title)
    }

    const result = await res.json()
    const content = result.content?.[0]?.text || ''

    // Parse the JSON from Haiku's response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const messages: ParsedMessage[] = (parsed.messages || [])
        .filter((m: { role: string; content: string }) =>
          (m.role === 'user' || m.role === 'assistant') && m.content?.trim()
        )
        .slice(0, MAX_MESSAGES)

      if (messages.length > 0) {
        return {
          platform,
          title: parsed.title || title,
          messages,
        }
      }
    }
  } catch (err) {
    console.error('[import] Haiku extraction failed:', err)
  }

  return simplePatternExtract(text, platform, title)
}

// ─── Simple pattern extraction (no AI) ─────────────────

function simplePatternExtract(
  text: string,
  platform: Platform | 'unknown',
  title: string
): ParseResult {
  const messages: ParsedMessage[] = []

  // Try to detect alternating "User:" / "Assistant:" patterns
  const turnSplitPattern = /(?:^|\n)(?:(?:User|Human|You|Question)\s*[:：])/i
  const parts = text.split(turnSplitPattern)

  if (parts.length >= 2) {
    for (let i = 1; i < parts.length; i++) {
      const assistantSplit = parts[i].split(/\n(?:(?:Assistant|AI|ChatGPT|Claude|Gemini|Answer|Response)\s*[:：])/i)
      if (assistantSplit[0]?.trim()) {
        messages.push({ role: 'user', content: assistantSplit[0].trim().slice(0, 4000) })
      }
      if (assistantSplit[1]?.trim()) {
        messages.push({ role: 'assistant', content: assistantSplit[1].trim().slice(0, 4000) })
      }
    }
  }

  // If we still got nothing, treat the whole text as one assistant message
  if (messages.length === 0 && text.trim().length > 20) {
    messages.push({ role: 'assistant', content: text.trim().slice(0, 8000) })
  }

  return { platform, title, messages: messages.slice(0, MAX_MESSAGES) }
}

// ─── Main handler ──────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  // Content-type check
  const ctErr = requireContentType(req)
  if (ctErr) return ctErr(CORS_HEADERS)

  try {
    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Rate limit via Postgres RPC
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'import-conversation')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    const body = await req.json()
    const { url, text } = body as { url?: string; text?: string }

    if (!url && !text) {
      return new Response(
        JSON.stringify({ error: 'url or text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    let result: ParseResult

    if (text && typeof text === 'string') {
      // ─── Paste mode: extract turns from raw text ───
      const trimmed = text.trim()
      if (trimmed.length < 20) {
        return new Response(
          JSON.stringify({ error: 'Text is too short to extract a conversation' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
      if (trimmed.length > 200_000) {
        return new Response(
          JSON.stringify({ error: 'Text exceeds 200KB limit' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
      result = await extractTurnsWithHaiku(trimmed, 'unknown', 'Imported Conversation')
    } else {
      // ─── Link mode: fetch URL and parse ───
      if (!url || typeof url !== 'string') {
        return new Response(
          JSON.stringify({ error: 'url must be a string' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      // SSRF protection via shared utility
      const ssrfErr = checkSSRF(url)
      if (ssrfErr) return ssrfErr(CORS_HEADERS)

      // Detect platform and fetch with platform-specific strategy
      const platform = detectPlatform(url)

      switch (platform) {
        case 'chatgpt':
          result = await fetchChatGPT(url)
          break
        case 'claude':
          result = await fetchClaude(url)
          break
        case 'gemini':
          result = await fetchGemini(url)
          break
        default:
          result = await fetchGeneric(url)
          break
      }
    }

    // Audit log — user action (fire-and-forget)
    logAudit(svc, {
      actorId: user.id, eventType: 'user.action', action: 'import-conversation',
      source: 'import-conversation', status: 'success', statusCode: 200,
      metadata: { platform: result.platform, messageCount: result.messages.length },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({
        platform: result.platform,
        title: result.title,
        messages: result.messages,
        message_count: result.messages.length,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('import-conversation error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to import conversation' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
