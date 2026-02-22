// ─── AI Conversation Import Parsers ──────────────────────
//
// Parse exported conversations from ChatGPT, Claude, and Gemini
// into a unified text format that can be sent to Kernel.
//
// All three platforms export as ZIPs containing JSON:
// - ChatGPT: ZIP → conversations.json (tree-based mapping structure)
// - Claude:  ZIP → conversations.json (flat chat_messages array)
// - Gemini:  ZIP → MyActivity.json (activity log, not conversations)

export interface ParsedConversation {
  source: 'chatgpt' | 'claude' | 'gemini' | 'unknown'
  title: string
  messages: { role: string; content: string }[]
}

// ─── HTML stripping (for Gemini responses) ───────────────

function stripHtml(html: string): string {
  // Use DOMParser if available (browser), otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent?.trim() || ''
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── ChatGPT ─────────────────────────────────────────────
// Export: Settings > Data Controls > Export Data
// Format: ZIP containing conversations.json
// Structure: Array of conversations, each with a tree-based `mapping`
// where nodes have message.author.role and message.content.parts
// Timestamps are Unix epoch floats, not ISO 8601

interface ChatGPTNode {
  id: string
  parent: string | null
  children: string[]
  message?: {
    author: { role: string }
    content: { content_type: string; parts?: (string | null)[] }
    create_time?: number
  }
}

interface ChatGPTConversation {
  title: string
  mapping: Record<string, ChatGPTNode>
  create_time?: number
}

function parseChatGPTConversation(conv: ChatGPTConversation): ParsedConversation {
  const messages: { role: string; content: string }[] = []

  // Walk the mapping tree in order (follow children from root)
  const visited = new Set<string>()
  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = conv.mapping[nodeId]
    if (!node) return

    if (node.message && node.message.content?.parts) {
      const role = node.message.author.role
      const text = node.message.content.parts
        .filter((p): p is string => typeof p === 'string')
        .join('')
        .trim()
      if (text && (role === 'user' || role === 'assistant')) {
        messages.push({ role, content: text })
      }
    }

    for (const childId of node.children) {
      walk(childId)
    }
  }

  // Find root node (parent === null)
  const rootId = Object.keys(conv.mapping).find(
    id => conv.mapping[id].parent === null
  )
  if (rootId) walk(rootId)

  return { source: 'chatgpt', title: conv.title || 'ChatGPT Conversation', messages }
}

function isChatGPTExport(data: unknown): data is ChatGPTConversation[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return false
  const first = data[0]
  return typeof first === 'object' && first !== null && 'mapping' in first
}

function isSingleChatGPTConversation(data: unknown): data is ChatGPTConversation {
  return typeof data === 'object' && data !== null && 'mapping' in data && 'title' in data
}

// ─── Claude ──────────────────────────────────────────────
// Export: Settings > Privacy > Export Data
// Format: ZIP containing conversations.json
// Structure: Flat array of conversations, each with chat_messages
// Uses sender: "human"/"assistant" (not "user"/"assistant")

interface ClaudeMessage {
  sender: 'human' | 'assistant'
  text: string
  created_at?: string
}

interface ClaudeConversation {
  uuid?: string
  name?: string
  chat_messages: ClaudeMessage[]
  created_at?: string
}

function parseClaudeConversation(conv: ClaudeConversation): ParsedConversation {
  const messages = conv.chat_messages
    .filter(m => m.text?.trim())
    .map(m => ({
      role: m.sender === 'human' ? 'user' : 'assistant',
      content: m.text.trim(),
    }))

  return { source: 'claude', title: conv.name || 'Claude Conversation', messages }
}

function isClaudeExport(data: unknown): data is ClaudeConversation[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return false
  const first = data[0]
  return typeof first === 'object' && first !== null && 'chat_messages' in first
}

function isSingleClaudeConversation(data: unknown): data is ClaudeConversation {
  return typeof data === 'object' && data !== null && 'chat_messages' in data
}

// ─── Gemini (Google Takeout) ─────────────────────────────
// Export: Google Takeout > My Activity > Gemini Apps (format: JSON)
// Format: ZIP → Takeout/My Activity/Gemini Apps/MyActivity.json
// Structure: Activity log — NOT conversations. Each entry is a
// prompt-response pair: title = user prompt, safeHtmlItem = response.
// No conversation grouping — must reconstruct by time proximity.

interface GeminiActivityEntry {
  header: string
  title: string  // User's prompt
  time: string   // ISO 8601
  products?: string[]
  safeHtmlItem?: { content: string }  // Model response as HTML
}

function isGeminiTakeout(data: unknown): data is GeminiActivityEntry[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return false
  const first = data[0] as Record<string, unknown>
  return 'header' in first && 'title' in first && 'time' in first
}

function parseGeminiTakeout(entries: GeminiActivityEntry[]): ParsedConversation[] {
  // Filter to Gemini entries only
  const geminiEntries = entries.filter(
    e => e.header === 'Gemini Apps' || e.products?.includes('Gemini Apps')
  )
  if (geminiEntries.length === 0) return []

  // Sort by time
  geminiEntries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  // Group into conversations by time proximity (>5min gap = new conversation)
  const GAP_MS = 5 * 60 * 1000
  const conversations: ParsedConversation[] = []
  let currentMessages: { role: string; content: string }[] = []
  let lastTime = 0

  for (const entry of geminiEntries) {
    const entryTime = new Date(entry.time).getTime()

    if (lastTime > 0 && entryTime - lastTime > GAP_MS && currentMessages.length > 0) {
      // Start new conversation
      conversations.push({
        source: 'gemini',
        title: currentMessages[0]?.content.slice(0, 60) || 'Gemini Conversation',
        messages: currentMessages,
      })
      currentMessages = []
    }

    // User prompt from title
    if (entry.title?.trim()) {
      currentMessages.push({ role: 'user', content: entry.title.trim() })
    }

    // Model response from safeHtmlItem (HTML → text)
    if (entry.safeHtmlItem?.content) {
      const text = stripHtml(entry.safeHtmlItem.content)
      if (text) {
        currentMessages.push({ role: 'assistant', content: text })
      }
    }

    lastTime = entryTime
  }

  // Push final conversation
  if (currentMessages.length > 0) {
    conversations.push({
      source: 'gemini',
      title: currentMessages[0]?.content.slice(0, 60) || 'Gemini Conversation',
      messages: currentMessages,
    })
  }

  return conversations
}

// ─── Gemini API/AI Studio format ─────────────────────────
// Alternative format from Google AI Studio with role/parts

interface GeminiAPIPart { text?: string }
interface GeminiAPIMessage { role: string; parts: GeminiAPIPart[] }
interface GeminiAPIConversation {
  messages?: GeminiAPIMessage[]
  contents?: GeminiAPIMessage[]
}

function isGeminiAPIFormat(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  const msgs = (obj.messages || obj.contents) as unknown[] | undefined
  if (!Array.isArray(msgs) || msgs.length === 0) return false
  const first = msgs[0] as Record<string, unknown>
  return 'role' in first && 'parts' in first
}

function parseGeminiAPIConversation(conv: GeminiAPIConversation): ParsedConversation {
  const rawMessages = conv.messages || conv.contents || []
  const messages = rawMessages
    .filter(m => {
      const text = m.parts?.map(p => p.text ?? '').join('').trim()
      return text && (m.role === 'user' || m.role === 'model')
    })
    .map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.parts.map(p => p.text ?? '').join('').trim(),
    }))

  return { source: 'gemini', title: 'Gemini Conversation', messages }
}

// ─── ZIP extraction ──────────────────────────────────────
// ChatGPT and Claude exports come as ZIPs. We dynamically
// import JSZip to extract conversations.json from inside.

async function extractJsonFromZip(file: File): Promise<string | null> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())

    // Look for known conversation files
    const targets = [
      'conversations.json',
      'MyActivity.json',
      'Takeout/My Activity/Gemini Apps/MyActivity.json',
    ]

    for (const target of targets) {
      // Try exact match first
      let entry = zip.file(target)
      if (!entry) {
        // Try case-insensitive / nested path search
        const found = zip.file(new RegExp(target.replace(/\//g, '\\/'), 'i'))
        entry = found.length > 0 ? found[0] : null
      }
      if (entry) {
        return await entry.async('string')
      }
    }

    // Fallback: find any .json file
    const jsonFiles = zip.file(/\.json$/i)
    if (jsonFiles.length > 0) {
      // Prefer largest JSON file (likely the conversations)
      let largest = jsonFiles[0]
      for (const f of jsonFiles) {
        const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
        const largestSize = (largest as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
        if (size > largestSize) largest = f
      }
      return await largest.async('string')
    }

    return null
  } catch {
    return null
  }
}

// ─── Unified Parser ──────────────────────────────────────

export function parseConversationExport(jsonText: string): ParsedConversation[] {
  const data = JSON.parse(jsonText)

  // ChatGPT: array of conversations with mapping
  if (isChatGPTExport(data)) {
    return data.map(parseChatGPTConversation)
  }

  // ChatGPT: single conversation
  if (isSingleChatGPTConversation(data)) {
    return [parseChatGPTConversation(data)]
  }

  // Claude: array of conversations with chat_messages
  if (isClaudeExport(data)) {
    return data.map(parseClaudeConversation)
  }

  // Claude: single conversation
  if (isSingleClaudeConversation(data)) {
    return [parseClaudeConversation(data)]
  }

  // Gemini Takeout: activity log with header/title/time
  if (isGeminiTakeout(data)) {
    return parseGeminiTakeout(data)
  }

  // Gemini API/AI Studio: conversation with role/parts
  if (isGeminiAPIFormat(data)) {
    return [parseGeminiAPIConversation(data as GeminiAPIConversation)]
  }

  // Array of Gemini API conversations
  if (Array.isArray(data) && data.length > 0 && isGeminiAPIFormat(data[0])) {
    return data.map((conv: GeminiAPIConversation) => parseGeminiAPIConversation(conv))
  }

  return []
}

/**
 * Parse a conversation export from a File.
 * Handles both raw JSON files and ZIP archives.
 */
export async function parseConversationFile(file: File): Promise<ParsedConversation[]> {
  const isZip = file.type === 'application/zip'
    || file.type === 'application/x-zip-compressed'
    || file.name.toLowerCase().endsWith('.zip')

  let jsonText: string | null = null

  if (isZip) {
    jsonText = await extractJsonFromZip(file)
    if (!jsonText) return []
  } else {
    jsonText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  return parseConversationExport(jsonText)
}

/**
 * Format parsed conversations into readable text for Claude.
 * Limits total output to stay within text message bounds.
 */
export function formatConversationsAsText(
  conversations: ParsedConversation[],
  maxChars = 100000,
): string {
  const parts: string[] = []
  let totalLen = 0

  for (const conv of conversations) {
    if (conv.messages.length === 0) continue

    const header = `── ${conv.title} (${conv.source}) ──`
    const msgs = conv.messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')
    const block = `${header}\n\n${msgs}`

    if (totalLen + block.length > maxChars) {
      const remaining = maxChars - totalLen
      if (remaining > 200) {
        parts.push(block.slice(0, remaining) + '\n\n[... truncated]')
      }
      break
    }

    parts.push(block)
    totalLen += block.length
  }

  return parts.join('\n\n---\n\n')
}
