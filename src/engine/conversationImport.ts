// ─── AI Conversation Import Parsers ──────────────────────
//
// Parse exported conversations from ChatGPT, Claude, and Gemini
// into a unified text format that can be sent to Kernel.

export interface ParsedConversation {
  source: 'chatgpt' | 'claude' | 'gemini' | 'unknown'
  title: string
  messages: { role: string; content: string }[]
}

// ─── ChatGPT ─────────────────────────────────────────────
// Export: Settings > Data Controls > Export Data
// Format: ZIP containing conversations.json
// Structure: Array of conversations, each with a tree-based `mapping`
// where nodes have message.author.role and message.content.parts

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
// Export: Settings > Export Data (or Account > Export)
// Format: JSON with array of conversations
// Structure: Each conversation has chat_messages array with sender/text

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

// ─── Gemini ──────────────────────────────────────────────
// Export: Google Takeout > Gemini Apps
// Format: Individual JSON files per conversation
// Structure: Array with conversation objects containing parts

interface GeminiPart {
  text?: string
}

interface GeminiMessage {
  role: string  // 'user' or 'model'
  parts: GeminiPart[]
}

interface GeminiConversation {
  // Google Takeout Gemini format
  messages?: GeminiMessage[]
  // Alternative format
  contents?: GeminiMessage[]
}

function parseGeminiConversation(conv: GeminiConversation): ParsedConversation {
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

function isGeminiExport(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  const msgs = (obj.messages || obj.contents) as unknown[] | undefined
  if (!Array.isArray(msgs) || msgs.length === 0) return false
  const first = msgs[0] as Record<string, unknown>
  return 'role' in first && 'parts' in first
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

  // Gemini: single conversation with messages/contents + parts
  if (isGeminiExport(data)) {
    return [parseGeminiConversation(data as GeminiConversation)]
  }

  // Gemini Takeout: array of conversations
  if (Array.isArray(data) && data.length > 0 && isGeminiExport(data[0])) {
    return data.map((conv: GeminiConversation) => parseGeminiConversation(conv))
  }

  return []
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
