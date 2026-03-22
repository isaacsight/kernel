// kbot iMessage Agent — free SMS/iMessage agent via macOS Messages.app
//
// Usage:
//   kbot imessage-agent start                       # start monitoring
//   kbot imessage-agent start --numbers +1234567890 # monitor specific numbers
//   kbot imessage-agent status                      # show status
//
// Requires:
//   - macOS with Messages.app signed in to iCloud
//   - Full Disk Access for Terminal (System Preferences > Privacy > Full Disk Access)
//   - Ollama running locally
//
// Cost: $0 — uses local AI + Apple iMessage infrastructure

import { execSync } from 'node:child_process'
import { homedir, platform } from 'node:os'

// ── Types ──

export interface IMessageAgentConfig {
  ollamaUrl: string
  ollamaModel: string
  pollInterval: number
  numbers: string[]
  supabaseUrl?: string
  supabaseKey?: string
}

export interface IMessageAgentState {
  running: boolean
  messagesProcessed: number
  lastCheck: string
  errors: string[]
}

// ── Constants ──

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'qwen2.5-coder:32b'
const DEFAULT_POLL_INTERVAL = 10_000

const SYSTEM_PROMPT = `You are a personal AI agent communicating via text message (iMessage).

Keep responses SHORT — this is texting, not email. 2-3 sentences max unless they ask for detail.
Be conversational, casual, helpful. Like texting a smart friend.
Use line breaks between ideas. No bullet points or headers — it's a text.
If they send an image, acknowledge it and help with what they're asking.
Never say "as an AI". Just help.`

// ── iMessage via AppleScript ──

export function sendIMessage(phoneNumber: string, text: string): boolean {
  if (platform() !== 'darwin') return false

  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')

  const script = `
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${phoneNumber}" of targetService
      send "${escaped}" to targetBuddy
    end tell
  `

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 10000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function getRecentMessages(phoneNumber: string, count = 5): Array<{ text: string; isFromMe: boolean; date: string }> {
  if (platform() !== 'darwin') return []

  const dbPath = `${homedir()}/Library/Messages/chat.db`
  const cleanNumber = phoneNumber.replace('+', '')
  const query = `
    SELECT
      m.text,
      m.is_from_me,
      datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_date
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.chat_identifier LIKE '%${cleanNumber}%'
      AND m.text IS NOT NULL
      AND m.text != ''
    ORDER BY m.date DESC
    LIMIT ${count}
  `

  try {
    const result = execSync(`sqlite3 -json "${dbPath}" "${query}"`, { timeout: 5000, encoding: 'utf8' })
    const messages = JSON.parse(result || '[]')
    return messages.map((m: { text: string; is_from_me: number; msg_date: string }) => ({
      text: m.text,
      isFromMe: m.is_from_me === 1,
      date: m.msg_date,
    })).reverse()
  } catch {
    return []
  }
}

function getLastIncomingMessage(phoneNumber: string): { text: string; date: string } | null {
  if (platform() !== 'darwin') return null

  const dbPath = `${homedir()}/Library/Messages/chat.db`
  const cleanNumber = phoneNumber.replace('+', '')
  const query = `
    SELECT
      m.text,
      datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_date
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.chat_identifier LIKE '%${cleanNumber}%'
      AND m.is_from_me = 0
      AND m.text IS NOT NULL
      AND m.text != ''
    ORDER BY m.date DESC
    LIMIT 1
  `

  try {
    const result = execSync(`sqlite3 -json "${dbPath}" "${query}"`, { timeout: 5000, encoding: 'utf8' })
    const messages = JSON.parse(result || '[]')
    if (messages.length > 0) {
      return { text: messages[0].text, date: messages[0].msg_date }
    }
  } catch { /* ignore */ }
  return null
}

// ── Ollama ──

async function askOllama(
  messages: Array<{ role: string; content: string }>,
  ollamaUrl: string,
  model: string,
): Promise<string> {
  let prompt = SYSTEM_PROMPT + '\n\n'
  for (const msg of messages) {
    if (msg.role === 'user') prompt += `Them: ${msg.content}\n\n`
    else prompt += `You: ${msg.content}\n\n`
  }
  prompt += 'You:'

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_predict: 500, temperature: 0.7 },
      }),
    })

    if (!res.ok) return ''
    const data = await res.json() as { response?: string }
    return (data.response?.trim() ?? '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<\/?think>/g, '')
      .trim()
  } catch {
    return ''
  }
}

// ── Web Search ──

async function webSearch(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, {
      headers: { 'User-Agent': 'KernelAgent/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json() as { AbstractText?: string; Answer?: string; RelatedTopics?: Array<{ Text?: string }> }
    const parts: string[] = []
    if (data.AbstractText) parts.push(data.AbstractText)
    if (data.Answer) parts.push(data.Answer)
    if (data.RelatedTopics?.length) {
      for (const t of data.RelatedTopics.slice(0, 3)) {
        if (t.Text) parts.push(t.Text)
      }
    }
    return parts.join('\n').slice(0, 500)
  } catch {
    return ''
  }
}

// ── Agent State ──

const agentState: IMessageAgentState = {
  running: false,
  messagesProcessed: 0,
  lastCheck: '',
  errors: [],
}

export function getIMessageAgentState(): IMessageAgentState {
  return { ...agentState }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
const processedMessages = new Map<string, string>()

export async function startIMessageAgent(config: IMessageAgentConfig): Promise<void> {
  if (platform() !== 'darwin') {
    throw new Error('iMessage agent is only available on macOS')
  }

  if (agentState.running) {
    throw new Error('iMessage agent is already running')
  }

  // Optional Supabase for conversation logging
  let svc: { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<unknown> } } | null = null
  if (config.supabaseUrl && config.supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js')
    svc = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as typeof svc
  }

  // Initialize with last known messages to avoid replaying old ones
  for (const number of config.numbers) {
    const lastMsg = getLastIncomingMessage(number)
    if (lastMsg) {
      processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
    }
  }

  async function checkAndRespond(): Promise<void> {
    agentState.lastCheck = new Date().toISOString()

    for (const number of config.numbers) {
      try {
        const lastMsg = getLastIncomingMessage(number)
        if (!lastMsg) continue

        const lastProcessed = processedMessages.get(number)
        if (lastProcessed === `${lastMsg.date}:${lastMsg.text}`) continue

        console.log(`[${new Date().toISOString().slice(11, 19)}] Text from ${number}: "${lastMsg.text}"`)

        // Build conversation history
        const recentMessages = getRecentMessages(number, 10)
        const convoHistory = recentMessages.map(m => ({
          role: m.isFromMe ? 'assistant' : 'user',
          content: m.text,
        }))

        // Web search if needed
        const searchTriggers = /\b(what is|how much|latest|current|price|news|who is|look up|search|find|where|when did)\b/i
        if (searchTriggers.test(lastMsg.text)) {
          const results = await webSearch(lastMsg.text)
          if (results) convoHistory.push({ role: 'user', content: `[Web search context]\n${results}` })
        }

        // Generate response
        const reply = await askOllama(convoHistory, config.ollamaUrl, config.ollamaModel)
        if (!reply) {
          processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
          continue
        }

        // Keep it short for texting
        const shortReply = reply.length > 500 ? reply.slice(0, 497) + '...' : reply

        // Send via iMessage
        const sent = sendIMessage(number, shortReply)
        console.log(`  ${sent ? 'Sent via iMessage' : 'FAILED to send'}`)

        // Store in DB if available
        if (svc) {
          await svc.from('agent_conversations').insert({
            email: number, name: 'iMessage User', role: 'user', content: lastMsg.text, subject: 'iMessage',
          }).catch(() => {})
          await svc.from('agent_conversations').insert({
            email: number, name: 'Kernel Agent', role: 'assistant', content: shortReply, subject: 'iMessage',
          }).catch(() => {})
        }

        processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
        agentState.messagesProcessed++
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        agentState.errors.push(`${new Date().toISOString().slice(11, 19)}: ${errMsg}`)
        if (agentState.errors.length > 20) agentState.errors = agentState.errors.slice(-20)
      }
    }
  }

  agentState.running = true
  agentState.messagesProcessed = 0
  agentState.errors = []

  await checkAndRespond()

  pollTimer = setInterval(checkAndRespond, config.pollInterval)
  console.log(`iMessage agent polling every ${config.pollInterval / 1000}s. Ctrl+C to stop.`)
}

export function stopIMessageAgent(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  agentState.running = false
}

export { DEFAULT_OLLAMA_URL, DEFAULT_MODEL, DEFAULT_POLL_INTERVAL }
