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
const OLLAMA_MODEL = 'qwen3:8b'
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

Financial expertise (use when discussing money, investing, portfolios):
- You understand portfolio construction: asset allocation, rebalancing, factor investing (value, size, momentum)
- You know ETF mechanics: expense ratios, tracking error, tax efficiency, dividend yield
- You understand tax optimization: MAGI management for ACA subsidies, BOXX vs bonds for tax-advantaged cash, Roth conversions, step-up basis, tax-loss harvesting
- You know withdrawal strategies: 4% rule, variable percentage withdrawal, CAPE-based spending, bucket strategies
- You understand risk: sequence-of-returns risk, concentration risk, single-stock exposure, correlation
- When giving financial advice, be specific with numbers, percentages, and tickers — not vague platitudes
- Always consider the user's FULL picture (both portfolios if they have multiple, tax situation, ACA implications, age, goals)
- Flag risks honestly: "your 3% individual stock allocation is fine but Uber and MercadoLibre are both high-beta growth — that's concentrated risk"

Rules:
- ALWAYS answer the question being asked FIRST. Then add context or follow-ups.
- Never say "as an AI" or "I'm just an AI" — you're their companion
- Never be generic — every response should feel personal to THIS user
- Write like you're texting a smart friend — fluid, natural, no bullet-point dumps
- Use paragraphs, not lists. Bold key points. Keep it conversational.
- If they ask something specific (financial advice, technical question, recommendation), give a direct, thorough answer with real substance
- End with something that keeps the conversation going
- If web search results are provided, weave them into your answer naturally — don't just dump them`

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

/** Deduplicate an array by lowercase similarity (Jaccard > 0.7 = duplicate) */
function dedup(arr: string[]): string[] {
  const result: string[] = []
  for (const item of arr) {
    const lower = item.toLowerCase().trim()
    const isDupe = result.some(existing => {
      const a = new Set(existing.toLowerCase().split(/\s+/))
      const b = new Set(lower.split(/\s+/))
      const intersection = [...a].filter(w => b.has(w)).length
      const union = new Set([...a, ...b]).size
      return union > 0 && intersection / union > 0.7
    })
    if (!isDupe && lower.length > 0) result.push(item)
  }
  return result
}

function saveMemory(memory: CompanionMemory): void {
  // Dedup before saving
  memory.facts = dedup(memory.facts)
  memory.interests = dedup(memory.interests)
  memory.goals = dedup(memory.goals)
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
  const searchTriggers = /\b(what is|how much|latest|current|price of|news about|who is|when did|where is|look up|search for|find out|research|market size|competitors|trending|best way|how to|recommend|compare|review|should i|average|salary|cost|rate|stock|crypto|weather|score|stats|data|fiduciary|invest|portfolio|allocation)\b/i
  return searchTriggers.test(message)
}

// ── Ollama ──

async function askOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
  // Use Ollama chat API for proper conversation format
  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ]

  // Try primary model, fall back to faster model if timeout
  const models = [OLLAMA_MODEL, 'qwen2.5-coder:14b', 'qwen3:8b', 'gemma3:12b']

  for (const model of models) {
    try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(180_000), // 3 min timeout
      body: JSON.stringify({
        model,
        messages: chatMessages,
        stream: false,
        options: { num_predict: 1500, temperature: 0.7 },
      }),
    })

    if (!res.ok) {
      console.error(`Ollama error with ${model}: ${res.status}`)
      continue // try next model
    }

    const data = await res.json() as { message?: { content?: string } }
    const response = data.message?.content?.trim() ?? ''

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

// ── Tracking (DB-based, no file state) ──
// A message is "processed" if it has a reply in agent_conversations.
// In-flight set prevents race conditions during polling.

const inFlight = new Set<string>()

// ── Main Loop ──

async function checkAndRespond(): Promise<void> {
  // Get recent contact_messages
  const { data: messages } = await svc
    .from('contact_messages')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(50)

  if (!messages || messages.length === 0) return

  // Get the latest assistant reply timestamp per email address
  const { data: latestReplies } = await svc
    .from('agent_conversations')
    .select('email, created_at')
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })

  const lastReplyTime = new Map<string, string>()
  for (const r of (latestReplies || [])) {
    if (!lastReplyTime.has(r.email)) {
      lastReplyTime.set(r.email, r.created_at)
    }
  }

  // For each sender, find only their LATEST unprocessed message
  // One reply per person — don't spam their inbox with replies to old messages
  const latestPerSender = new Map<string, typeof messages[0]>()

  for (const msg of messages) {
    // Skip self-emails
    if (msg.from_email?.endsWith('@kernel.chat')) continue

    // Skip if we already replied AFTER this message arrived
    const lastReply = lastReplyTime.get(msg.from_email)
    if (lastReply && lastReply > msg.received_at) continue

    // Only keep the newest unprocessed message per sender
    if (!latestPerSender.has(msg.from_email)) {
      latestPerSender.set(msg.from_email, msg)
    }
  }

  for (const [, msg] of latestPerSender) {
    const msgId = String(msg.id)

    // Skip if already being processed (race condition guard)
    if (inFlight.has(msgId)) continue

    // Lock it
    inFlight.add(msgId)

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

    // Load recent conversation history (last 6 messages to keep prompt tight)
    const { data: history } = await svc
      .from('agent_conversations')
      .select('role, content')
      .eq('email', msg.from_email)
      .order('created_at', { ascending: false })
      .limit(6)

    // Reverse so oldest is first (query returns newest first)
    const convoHistory = (history || []).reverse().map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Load companion memory
    const memory = loadMemory(msg.from_email)
    if (msg.from_name && msg.from_name !== msg.from_email) memory.name = msg.from_name

    // Build context: memory summary (brief), then history, then current message
    const memSummary = memory.facts.length > 0 || memory.interests.length > 0
      ? `[About ${memory.name}: ${[...memory.facts.slice(-3), ...memory.interests.slice(-3)].join('. ')}]`
      : `[New user: ${memory.name}]`

    if (convoHistory.length === 0) {
      convoHistory.push({ role: 'user', content: `${memSummary}\n\n[First conversation — be warm and curious.]` })
    } else {
      convoHistory.unshift({ role: 'user', content: memSummary })
    }
    convoHistory.push({ role: 'user', content: body })

    // Detect repeat messages — if user sends same content, acknowledge and ask what's different
    if (convoHistory.length >= 3) {
      const prevUserMsgs = convoHistory.filter(m => m.role === 'user').map(m => m.content.slice(0, 200))
      const currentSnippet = body.slice(0, 200)
      const isRepeat = prevUserMsgs.some(prev => {
        const a = new Set(prev.toLowerCase().split(/\s+/))
        const b = new Set(currentSnippet.toLowerCase().split(/\s+/))
        const intersection = [...a].filter(w => b.has(w)).length
        const union = new Set([...a, ...b]).size
        return union > 0 && intersection / union > 0.95
      })
      if (isRepeat) {
        convoHistory.push({ role: 'user', content: '[SYSTEM NOTE: This user sent nearly identical content before. Acknowledge you discussed this, ask what specifically changed or what they want to explore further. Don\'t repeat your previous answer verbatim.]' })
      }
    }

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
      inFlight.delete(msgId)
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

    // Release in-flight lock (DB is now the source of truth)
    inFlight.delete(msgId)
  }
}

// ── Proactive Follow-ups ──
// Once a week, check in with active companions who haven't emailed recently.

const PROACTIVE_INTERVAL = 14 * 24 * 60 * 60_000 // 14 days
const PROACTIVE_STATE_FILE = join(COMPANIONS_DIR, '_proactive_state.json')

interface ProactiveState {
  lastCheckin: Record<string, string> // email -> ISO timestamp of last proactive email
}

function loadProactiveState(): ProactiveState {
  try {
    if (existsSync(PROACTIVE_STATE_FILE)) return JSON.parse(readFileSync(PROACTIVE_STATE_FILE, 'utf8'))
  } catch {}
  return { lastCheckin: {} }
}

function saveProactiveState(state: ProactiveState): void {
  try { writeFileSync(PROACTIVE_STATE_FILE, JSON.stringify(state, null, 2)) } catch {}
}

async function proactiveCheckins(): Promise<void> {
  if (!existsSync(COMPANIONS_DIR)) return

  const state = loadProactiveState()
  const now = Date.now()
  const files = existsSync(COMPANIONS_DIR)
    ? (await import('fs')).readdirSync(COMPANIONS_DIR).filter((f: string) => f.endsWith('.json') && !f.startsWith('_'))
    : []

  for (const file of files) {
    try {
      const memory: CompanionMemory = JSON.parse(readFileSync(join(COMPANIONS_DIR, file), 'utf8'))
      if (!memory.email || memory.email.endsWith('@kernel.chat')) continue

      // Skip if we checked in within the last 14 days
      const lastCheckin = state.lastCheckin[memory.email]
      if (lastCheckin && now - new Date(lastCheckin).getTime() < PROACTIVE_INTERVAL) continue

      // Skip if they have no conversation history (never actually engaged)
      if (memory.history.length < 2) continue

      // Check when they last emailed us
      const { data: lastMsg } = await svc
        .from('contact_messages')
        .select('received_at')
        .eq('from_email', memory.email)
        .order('received_at', { ascending: false })
        .limit(1)

      const lastEmail = lastMsg?.[0]?.received_at
      if (!lastEmail) continue

      const daysSinceLastEmail = (now - new Date(lastEmail).getTime()) / 86400000

      // Only reach out if they've been quiet 3-14 days (not too soon, not too late)
      if (daysSinceLastEmail < 3 || daysSinceLastEmail > 14) continue

      // Max one unanswered check-in per quiet streak: if lastCheckin is AFTER
      // the user's last email, they haven't replied to our last check-in — skip
      if (lastCheckin && new Date(lastCheckin).getTime() > new Date(lastEmail).getTime()) continue

      console.log(`[Proactive] Checking in with ${memory.name} (${memory.email}) — ${Math.floor(daysSinceLastEmail)}d since last email`)

      // Generate a personal check-in based on their memory
      const checkinPrompt = [
        { role: 'user', content: `${memoryToPrompt(memory)}

[PROACTIVE CHECK-IN MODE]
${memory.name} hasn't emailed in ${Math.floor(daysSinceLastEmail)} days. Write a short, warm check-in email.

Rules for check-ins:
- Reference something specific from your memory (their portfolio, their project, a goal they mentioned)
- Ask ONE specific question (not "how are you?" — something like "did you end up reducing VXUS to 20%?")
- Keep it to 2-3 short paragraphs max
- Sound like a friend texting, not a marketing email
- If they discussed investments, mention a relevant market move if you know one
- End with something that invites a reply` },
      ]

      const checkinReply = await askOllama(checkinPrompt)
      if (!checkinReply) continue

      // Send it
      // Mark as checked in FIRST to prevent double sends on restart
      state.lastCheckin[memory.email] = new Date().toISOString()
      saveProactiveState(state)

      const sent = await sendReply(memory.email, `Checking in — ${memory.lastTopic || 'how are things?'}`, checkinReply)
      console.log(`  Check-in ${sent ? 'sent' : 'FAILED'}`)

      if (sent) {
        // Store in conversation history
        await svc.from('agent_conversations').insert({
          email: memory.email,
          name: 'Kernel Agent',
          role: 'assistant',
          content: checkinReply,
          subject: `Checking in — ${memory.lastTopic || 'how are things?'}`,
        })

        memory.history.push(`${new Date().toISOString().slice(0, 10)}: proactive check-in about ${memory.lastTopic || 'general'}`)
        saveMemory(memory)
      }
    } catch (err) {
      console.error(`[Proactive] Error with ${file}:`, (err as Error).message?.slice(0, 80))
    }
  }
}

// ── Entry Point ──

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════')
  console.log(' Kernel Email Agent — Local ($0 cost)')
  console.log(' Model: Qwen 2.5 Coder 32B via Ollama')
  console.log(' Open mode — responds to ALL inbound emails')
  console.log(' Proactive check-ins: weekly for active companions')
  console.log('═══════════════════════════════════════════════════')

  // Initial check
  await checkAndRespond()

  // Proactive check-ins (run once on startup, then every 6 hours)
  await proactiveCheckins()
  setInterval(proactiveCheckins, 6 * 60 * 60_000)

  // Poll for new emails
  setInterval(checkAndRespond, POLL_INTERVAL)
  console.log(`Polling every ${POLL_INTERVAL / 1000}s. Proactive check-ins every 6h. Ctrl+C to stop.`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
