#!/usr/bin/env npx tsx
// iMessage Agent — Free SMS/iMessage agent via macOS Messages.app
// Uses AppleScript to send/receive iMessages. $0 cost, unlimited.
//
// Usage: npx tsx tools/imessage-agent.ts
// Requires: macOS with Messages.app signed in to iCloud

import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Config ──

const PROJECT_ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(PROJECT_ROOT, '.env'), 'utf8')
function getEnv(key: string): string {
  const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return match?.[1]?.trim() ?? ''
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_KEY')
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen2.5-coder:32b'
const POLL_INTERVAL = 10_000 // 10 seconds

// Users who can text the agent
const AGENT_NUMBERS = [
  '+17147886771', // Isaac
]

const SYSTEM_PROMPT = `You are a personal AI agent communicating via text message (iMessage).

Keep responses SHORT — this is texting, not email. 2-3 sentences max unless they ask for detail.
Be conversational, casual, helpful. Like texting a smart friend.
Use line breaks between ideas. No bullet points or headers — it's a text.
If they send an image, acknowledge it and help with what they're asking.
Never say "as an AI". Just help.`

// ── Supabase ──

const svc = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── iMessage via AppleScript ──

function sendMessage(phoneNumber: string, text: string): boolean {
  // Escape for AppleScript
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
  } catch (err) {
    console.error('iMessage send failed:', err)
    return false
  }
}

function getRecentMessages(phoneNumber: string, count = 5): Array<{ text: string; isFromMe: boolean; date: string }> {
  // Read from Messages SQLite database
  const dbPath = `${process.env.HOME}/Library/Messages/chat.db`
  const query = `
    SELECT
      m.text,
      m.is_from_me,
      datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_date
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.chat_identifier LIKE '%${phoneNumber.replace('+', '')}%'
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
  const dbPath = `${process.env.HOME}/Library/Messages/chat.db`
  const query = `
    SELECT
      m.text,
      datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_date
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.chat_identifier LIKE '%${phoneNumber.replace('+', '')}%'
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
  } catch {}
  return null
}

// ── Ollama ──

async function askOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
  let prompt = SYSTEM_PROMPT + '\n\n'
  for (const msg of messages) {
    if (msg.role === 'user') prompt += `Them: ${msg.content}\n\n`
    else prompt += `You: ${msg.content}\n\n`
  }
  prompt += 'You:'

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { num_predict: 500, temperature: 0.7 }, // Short for texting
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

// ── Main Loop ──

const processedMessages = new Map<string, string>() // number -> last processed message text

async function checkAndRespond(): Promise<void> {
  for (const number of AGENT_NUMBERS) {
    const lastMsg = getLastIncomingMessage(number)
    if (!lastMsg) continue

    // Skip if already processed
    const lastProcessed = processedMessages.get(number)
    if (lastProcessed === `${lastMsg.date}:${lastMsg.text}`) continue

    console.log(`[${new Date().toISOString().slice(11, 19)}] Text from ${number}: "${lastMsg.text}"`)

    // Build conversation history from recent messages
    const recentMessages = getRecentMessages(number, 10)
    const convoHistory = recentMessages.map(m => ({
      role: m.isFromMe ? 'assistant' : 'user',
      content: m.text,
    }))

    // Web search if needed
    const searchTriggers = /\b(what is|how much|latest|current|price|news|who is|look up|search|find|where|when did)\b/i
    if (searchTriggers.test(lastMsg.text)) {
      console.log('  Searching web...')
      const results = await webSearch(lastMsg.text)
      if (results) {
        convoHistory.push({ role: 'user', content: `[Web search context]\n${results}` })
      }
    }

    // Get response
    console.log('  Thinking...')
    const reply = await askOllama(convoHistory)

    if (!reply) {
      console.error('  No response from Ollama')
      processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
      continue
    }

    // Keep it short for texting — truncate if too long
    const shortReply = reply.length > 500 ? reply.slice(0, 497) + '...' : reply

    console.log(`  Reply: "${shortReply.slice(0, 80)}..."`)

    // Send via iMessage
    const sent = sendMessage(number, shortReply)
    console.log(`  ${sent ? 'Sent via iMessage' : 'FAILED to send'}`)

    // Store in DB for history
    await svc.from('agent_conversations').insert({
      email: number,
      name: 'iMessage User',
      role: 'user',
      content: lastMsg.text,
      subject: 'iMessage',
    }).catch(() => {})

    await svc.from('agent_conversations').insert({
      email: number,
      name: 'Kernel Agent',
      role: 'assistant',
      content: shortReply,
      subject: 'iMessage',
    }).catch(() => {})

    processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
  }
}

// ── Entry Point ──

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════')
  console.log(' Kernel iMessage Agent — Free, Unlimited')
  console.log(' Model: Qwen 2.5 Coder 32B via Ollama')
  console.log(` Monitoring: ${AGENT_NUMBERS.join(', ')}`)
  console.log('═══════════════════════════════════════════════════')

  // Initialize with last known messages
  for (const number of AGENT_NUMBERS) {
    const lastMsg = getLastIncomingMessage(number)
    if (lastMsg) {
      processedMessages.set(number, `${lastMsg.date}:${lastMsg.text}`)
      console.log(`Initialized ${number}: last msg = "${lastMsg.text.slice(0, 40)}..."`)
    }
  }

  // Poll
  setInterval(checkAndRespond, POLL_INTERVAL)
  console.log(`Polling every ${POLL_INTERVAL / 1000}s. Ctrl+C to stop.`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
