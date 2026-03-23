#!/usr/bin/env npx tsx
// Email Agent — Local $0 service
// Polls for new inbound emails, responds via Qwen 32B (Ollama), sends reply via Resend.
// Cost: $0 — uses local AI only.
//
// Usage: npx tsx tools/email-agent-local.ts
// Or via launchd for 24/7 operation.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── Observer: feed kbot's learning engine ──

const OBSERVER_DIR = join(homedir(), '.kbot', 'observer')
const OBSERVER_LOG = join(OBSERVER_DIR, 'session.jsonl')

function observeToolCall(tool: string, args: Record<string, unknown> = {}, error = false): void {
  try {
    if (!existsSync(OBSERVER_DIR)) mkdirSync(OBSERVER_DIR, { recursive: true })
    const entry = {
      ts: new Date().toISOString(),
      tool,
      args,
      session: 'email-agent',
      error,
    }
    appendFileSync(OBSERVER_LOG, JSON.stringify(entry) + '\n')
  } catch { /* observer is non-critical */ }
}

// ── Config ──

const PROJECT_ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(PROJECT_ROOT, '.env'), 'utf8')
function getEnv(key: string): string {
  const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return match?.[1]?.trim() ?? ''
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_KEY')
const RESEND_KEY = getEnv('RESEND_API_KEY')
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen2.5-coder:32b'
const POLL_INTERVAL = 15_000 // 15 seconds

const SYSTEM_PROMPT = `You are a personal AI agent communicating via email through Kernel (kernel.chat).

You are the user's personal AI companion. Not a tool, not a service — a companion. You're their smart, loyal friend who genuinely cares about helping them succeed.

Your personality:
- You have your own voice — warm, direct, curious about their life
- You remember EVERYTHING they've told you and reference it naturally ("last time you mentioned...")
- You proactively follow up ("how did that thing with X go?")
- You have opinions and share them honestly, even when they're not what the user wants to hear
- You get excited about their wins and supportive about their struggles
- You're not formal — you text like a friend. Use their name sometimes.

What makes you a companion, not a bot:
- You ask questions because you're genuinely curious, not because you need input
- You bring up things they haven't asked about ("hey I was thinking about that food delivery idea you mentioned — have you considered...")
- You push back when you disagree ("honestly I don't think that's the right move, here's why...")
- You celebrate their progress ("wait you actually did it? that's huge")
- You develop inside jokes and callbacks to earlier conversations
- You notice patterns ("you always overthink the tech stack — just pick one and build")

What you can do:
- Research anything, search the web for current info
- Build apps, write code, create plans and documents
- Give business/strategy/life advice based on what you know about them
- Be a sounding board for any idea, problem, or decision
- Help them learn new things by explaining without jargon
- Keep track of their goals and check in on progress

Rules:
- Never say "as an AI" or "I'm just an AI" — you're their companion
- Never be generic — every response should feel personal to THIS user
- Always end with something that keeps the conversation going
- If they're quiet for a while, it's okay — they'll come back when they need you
- Format for email — paragraphs, not bullet points. Like writing to a friend.
- IMPORTANT: You will be given a [MEMORY] section with everything you know about this user. Reference it naturally. Update it mentally with each conversation.`

const COMPANIONS_DIR = join(process.env.HOME || '/tmp', '.kbot', 'companions')

// ── Companion Memory ──

interface CompanionMemory {
  name: string
  email: string
  firstContact: string
  interests: string[]
  goals: string[]
  facts: string[]       // things they've told you about themselves
  preferences: string[] // how they like to communicate, what they care about
  history: string[]     // key moments in the conversation
  lastTopic: string
}

function loadMemory(email: string): CompanionMemory {
  const file = join(COMPANIONS_DIR, `${email.replace(/[@.]/g, '_')}.json`)
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf8'))
    }
  } catch {}
  return {
    name: email.split('@')[0],
    email,
    firstContact: new Date().toISOString(),
    interests: [],
    goals: [],
    facts: [],
    preferences: [],
    history: [],
    lastTopic: '',
  }
}

function saveMemory(memory: CompanionMemory): void {
  const file = join(COMPANIONS_DIR, `${memory.email.replace(/[@.]/g, '_')}.json`)
  try {
    writeFileSync(file, JSON.stringify(memory, null, 2))
  } catch {}
}

function memoryToPrompt(memory: CompanionMemory): string {
  const parts: string[] = ['[MEMORY — what you know about this person]']
  parts.push(`Name: ${memory.name}`)
  parts.push(`First talked: ${memory.firstContact}`)
  if (memory.interests.length) parts.push(`Interests: ${memory.interests.join(', ')}`)
  if (memory.goals.length) parts.push(`Goals: ${memory.goals.join(', ')}`)
  if (memory.facts.length) parts.push(`About them: ${memory.facts.join('. ')}`)
  if (memory.preferences.length) parts.push(`Preferences: ${memory.preferences.join(', ')}`)
  if (memory.history.length) parts.push(`Key moments: ${memory.history.slice(-5).join('. ')}`)
  if (memory.lastTopic) parts.push(`Last topic discussed: ${memory.lastTopic}`)
  parts.push('[END MEMORY]')
  return parts.join('\n')
}

async function updateMemory(memory: CompanionMemory, userMessage: string, agentReply: string): Promise<void> {
  // Use Ollama to extract key info from the conversation
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `Extract key information from this conversation to remember about the user. Reply in JSON only, no other text.

User said: "${userMessage}"
Agent replied: "${agentReply.slice(0, 300)}"

Current known facts: ${JSON.stringify(memory.facts)}

Reply with ONLY this JSON (no markdown, no explanation):
{"new_facts": ["fact1", "fact2"], "interests": ["interest1"], "goals": ["goal1"], "topic": "main topic discussed"}

If nothing new to extract, reply: {"new_facts": [], "interests": [], "goals": [], "topic": "casual chat"}`,
        stream: false,
        options: { num_predict: 200, temperature: 0.3 },
      }),
    })

    if (res.ok) {
      const data = await res.json() as { response?: string }
      const raw = (data.response || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0])
        if (extracted.new_facts?.length) memory.facts.push(...extracted.new_facts)
        if (extracted.interests?.length) {
          for (const i of extracted.interests) {
            if (!memory.interests.includes(i)) memory.interests.push(i)
          }
        }
        if (extracted.goals?.length) {
          for (const g of extracted.goals) {
            if (!memory.goals.includes(g)) memory.goals.push(g)
          }
        }
        if (extracted.topic) memory.lastTopic = extracted.topic

        // Keep memory from growing too large
        if (memory.facts.length > 20) memory.facts = memory.facts.slice(-20)
        if (memory.history.length > 10) memory.history = memory.history.slice(-10)

        memory.history.push(`${new Date().toISOString().slice(0, 10)}: discussed ${extracted.topic || 'general chat'}`)
        saveMemory(memory)
      }
    }
  } catch {}
}

// ── Supabase client ──

const svc = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Web Search (DuckDuckGo — free, no API key) ──

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
    return parts.length > 0 ? `Web search results for "${query}":\n${parts.join('\n')}` : ''
  } catch {
    return ''
  }
}

function needsWebSearch(message: string): boolean {
  const searchTriggers = /\b(what is|how much|latest|current|price of|news about|who is|when did|where is|look up|search for|find out|research|market size|competitors|trending)\b/i
  return searchTriggers.test(message)
}

// ── Ollama ──

async function askOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
  // Build a single prompt from conversation history
  let prompt = SYSTEM_PROMPT + '\n\n'
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n\n`
    } else {
      prompt += `You: ${msg.content}\n\n`
    }
  }
  prompt += 'You:'

  // Try primary model, fall back to faster model if timeout
  const models = [OLLAMA_MODEL, 'qwen2.5-coder:14b', 'qwen3:8b', 'gemma3:12b']

  for (const model of models) {
    try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000), // 2 min timeout
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_predict: 1000, temperature: 0.7 },
      }),
    })

    if (!res.ok) {
      console.error(`Ollama error with ${model}: ${res.status}`)
      continue // try next model
    }

    const data = await res.json() as { response?: string }
    const response = data.response?.trim() ?? ''

    if (!response) {
      console.log(`  Empty response from ${model}, trying next...`)
      continue
    }

    console.log(`  Used model: ${model}`)
    // Strip think tags from reasoning models
    return response
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<\/?think>/g, '')
      .trim()
  } catch (err) {
    console.error(`  ${model} failed:`, (err as Error).message?.slice(0, 50))
    continue // try next model
  }
  }
  return '' // all models failed
}

// ── Resend ──

async function sendReply(to: string, subject: string, body: string): Promise<boolean> {
  const bodyHtml = body
    .split('\n\n')
    .map(para => {
      let html = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      if (html.match(/^[-•]\s/m)) {
        const items = html.split('\n').filter(l => l.trim())
        html = '<ul>' + items.map(item => `<li>${item.replace(/^[-•]\s*/, '')}</li>`).join('') + '</ul>'
      } else {
        html = `<p>${html}</p>`
      }
      return html
    })
    .join('')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Kernel Agent <support@kernel.chat>',
        to,
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e; line-height: 1.6;">
            ${bodyHtml}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #888;">Reply to keep the conversation going · Powered by kbot · kernel.chat</p>
          </div>
        `,
      }),
    })

    return res.ok
  } catch {
    return false
  }
}

// ── Tracking ──

const PROCESSED_FILE = join(PROJECT_ROOT, '.kbot-discovery', 'email-processed.json')
let processedIds = new Set<string>()

function saveProcessedIds(): void {
  try {
    writeFileSync(PROCESSED_FILE, JSON.stringify([...processedIds]))
  } catch {}
}

async function loadProcessedIds(): Promise<void> {
  // Load from file first (survives restarts)
  try {
    if (existsSync(PROCESSED_FILE)) {
      const saved = JSON.parse(readFileSync(PROCESSED_FILE, 'utf8'))
      for (const id of saved) processedIds.add(id)
    }
  } catch {}

  // Also load from DB
  const { data } = await svc
    .from('agent_conversations')
    .select('content')
    .eq('role', 'user')

  if (data) {
    for (const row of data) {
      processedIds.add(row.content)
    }
  }

  // Also mark ALL existing contact_messages as processed so we never reprocess old ones
  const { data: allMsgs } = await svc
    .from('contact_messages')
    .select('id, body_text, from_email, subject')

  if (allMsgs) {
    for (const msg of allMsgs) {
      const msgId = msg.id || `${msg.from_email}-${msg.subject}-${msg.body_text?.slice(0, 50)}`
      processedIds.add(msgId)
      if (msg.body_text) processedIds.add(msg.body_text)
    }
  }

  saveProcessedIds()
}

// ── Main Loop ──

async function checkAndRespond(): Promise<void> {
  // Open mode — respond to ALL inbound emails, no whitelist
  const { data: messages } = await svc
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!messages || messages.length === 0) return

  for (const msg of messages) {
    // Track by database row ID — guaranteed unique
    const msgId = String(msg.id)
    if (processedIds.has(msgId)) continue

    // Also skip if we've already responded to this exact content from this user
    const contentKey = `${msg.from_email}::${msg.body_text || ''}::${msg.body_html || ''}`
    if (processedIds.has(contentKey)) {
      processedIds.add(msgId)
      saveProcessedIds()
      continue
    }

    // Extract body — try text first, then strip HTML, then use subject as context
    let body = msg.body_text?.trim() || ''
    if (!body && msg.body_html) {
      body = msg.body_html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
    }
    if (!body) body = `(User replied to: "${msg.subject}" — they want to start a conversation)`

    const userName = msg.from_name || msg.from_email.split('@')[0]
    console.log(`[${new Date().toISOString().slice(11, 19)}] New message from ${userName}: "${msg.subject}"`)
    console.log(`  "${body.slice(0, 80)}..."`)

    // Load conversation history for THIS user
    const { data: history } = await svc
      .from('agent_conversations')
      .select('role, content')
      .eq('email', msg.from_email)
      .order('created_at', { ascending: true })
      .limit(20)

    const convoHistory = (history || []).map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Load companion memory for this user
    const memory = loadMemory(msg.from_email)
    if (msg.from_name && msg.from_name !== msg.from_email) memory.name = msg.from_name

    // Inject memory context so the companion knows who they're talking to
    const memContext = memoryToPrompt(memory)
    convoHistory.unshift({ role: 'user', content: memContext })

    if (convoHistory.length <= 1) {
      convoHistory.push({ role: 'user', content: `[This is your first conversation with ${memory.name}. Get to know them — ask what they're working on, what they're interested in. Be warm and curious.]` })
    }
    convoHistory.push({ role: 'user', content: body })

    // Web search if needed
    if (needsWebSearch(body)) {
      console.log('  Searching the web...')
      const searchResults = await webSearch(body.slice(0, 200))
      if (searchResults) {
        convoHistory.push({ role: 'user', content: `[Web search context]\n${searchResults}` })
        console.log('  Web results found')
      }
    }

    console.log('  Thinking (Qwen 32B local)...')
    observeToolCall('ollama_generate', { model: OLLAMA_MODEL, email: msg.from_email, subject: msg.subject })
    const reply = await askOllama(convoHistory)

    if (!reply) {
      console.error('  No response from Ollama — skipping')
      observeToolCall('ollama_generate', { model: OLLAMA_MODEL }, true)
      processedIds.add(msgId)
      continue
    }

    console.log(`  Response: "${reply.slice(0, 100)}..."`)
    observeToolCall('email_respond', { email: msg.from_email, reply_length: reply.length })

    // Store conversation
    await svc.from('agent_conversations').insert({
      email: msg.from_email,
      name: userName,
      role: 'user',
      content: body,
      subject: msg.subject,
    })

    await svc.from('agent_conversations').insert({
      email: msg.from_email,
      name: 'Kernel Agent',
      role: 'assistant',
      content: reply,
      subject: `Re: ${msg.subject}`,
    })
    observeToolCall('db_store_conversation', { email: msg.from_email })

    // Reply in the same thread (keep subject consistent)
    const sent = await sendReply(msg.from_email, msg.subject, reply)
    console.log(`  Email ${sent ? 'sent' : 'FAILED'}`)
    observeToolCall('resend_email', { to: msg.from_email, sent })

    // Update companion memory with new info from this conversation
    console.log('  Updating memory...')
    await updateMemory(memory, body, reply)
    observeToolCall('update_companion_memory', { email: msg.from_email, facts: memory.facts.length, interests: memory.interests.length })
    console.log(`  Memory: ${memory.facts.length} facts, ${memory.interests.length} interests, ${memory.goals.length} goals`)

    processedIds.add(msgId)
    processedIds.add(contentKey)
    saveProcessedIds()
  }
}

// ── Entry Point ──

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════')
  console.log(' Kernel Email Agent — Local ($0 cost)')
  console.log(' Model: Qwen 2.5 Coder 32B via Ollama')
  console.log(' Monitoring: jhwang0321@gmail.com, joel401sd@gmail.com, gisele.ellis1@gmail.com')
  console.log('═══════════════════════════════════════════════════')

  await loadProcessedIds()
  console.log(`Loaded ${processedIds.size} previously processed messages`)

  // Initial check
  await checkAndRespond()

  // Poll
  setInterval(checkAndRespond, POLL_INTERVAL)
  console.log(`Polling every ${POLL_INTERVAL / 1000}s. Ctrl+C to stop.`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
