// kbot Email Agent — autonomous email companion ($0 cost via local Ollama)
//
// Usage:
//   kbot email-agent start                     # start polling for emails
//   kbot email-agent start --model gemma3:12b  # use a specific model
//   kbot email-agent status                    # show agent status
//
// Requires:
//   - Ollama running locally (ollama serve)
//   - Supabase project with contact_messages + agent_conversations tables
//   - Resend API key for sending replies
//   - Environment variables in .env or ~/.kbot/config.json

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── Types ──

export interface CompanionMemory {
  name: string
  email: string
  firstContact: string
  interests: string[]
  goals: string[]
  facts: string[]
  preferences: string[]
  history: string[]
  lastTopic: string
}

export interface EmailAgentConfig {
  supabaseUrl: string
  supabaseKey: string
  resendKey: string
  ollamaUrl: string
  ollamaModel: string
  pollInterval: number
  /** If empty, accepts ALL inbound emails (open mode) */
  agentUsers: string[]
}

// ── Constants ──

const COMPANIONS_DIR = join(homedir(), '.kbot', 'companions')
const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'qwen2.5-coder:32b'
const DEFAULT_POLL_INTERVAL = 15_000

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
- You bring up things they haven't asked about
- You push back when you disagree
- You celebrate their progress
- You develop inside jokes and callbacks to earlier conversations
- You notice patterns

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
- Format for email — paragraphs, not bullet points. Like writing to a friend.
- IMPORTANT: You will be given a [MEMORY] section with everything you know about this user. Reference it naturally.`

// ── Memory Management ──

function ensureCompanionsDir(): void {
  if (!existsSync(COMPANIONS_DIR)) mkdirSync(COMPANIONS_DIR, { recursive: true })
}

export function loadCompanionMemory(email: string): CompanionMemory {
  ensureCompanionsDir()
  const file = join(COMPANIONS_DIR, `${email.replace(/[@.]/g, '_')}.json`)
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf8'))
    }
  } catch { /* ignore parse errors */ }
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

export function saveCompanionMemory(memory: CompanionMemory): void {
  ensureCompanionsDir()
  const file = join(COMPANIONS_DIR, `${memory.email.replace(/[@.]/g, '_')}.json`)
  writeFileSync(file, JSON.stringify(memory, null, 2))
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

// ── Ollama ──

async function askOllama(
  messages: Array<{ role: string; content: string }>,
  ollamaUrl: string,
  model: string,
): Promise<string> {
  let prompt = SYSTEM_PROMPT + '\n\n'
  for (const msg of messages) {
    if (msg.role === 'user') prompt += `User: ${msg.content}\n\n`
    else prompt += `You: ${msg.content}\n\n`
  }
  prompt += 'You:'

  const models = [model, 'qwen2.5-coder:14b', 'qwen3:8b', 'gemma3:12b']

  for (const m of models) {
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: m,
          prompt,
          stream: false,
          options: { num_predict: 1000, temperature: 0.7 },
        }),
      })

      if (!res.ok) continue
      const data = await res.json() as { response?: string }
      const response = data.response?.trim() ?? ''
      if (!response) continue

      return response
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<\/?think>/g, '')
        .trim()
    } catch {
      continue
    }
  }
  return ''
}

async function updateMemoryViaOllama(
  memory: CompanionMemory,
  userMessage: string,
  agentReply: string,
  ollamaUrl: string,
  model: string,
): Promise<void> {
  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
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
        if (memory.facts.length > 20) memory.facts = memory.facts.slice(-20)
        if (memory.history.length > 10) memory.history = memory.history.slice(-10)
        memory.history.push(`${new Date().toISOString().slice(0, 10)}: discussed ${extracted.topic || 'general chat'}`)
        saveCompanionMemory(memory)
      }
    }
  } catch { /* memory update is best-effort */ }
}

// ── Web Search (DuckDuckGo — free) ──

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
  return /\b(what is|how much|latest|current|price of|news about|who is|when did|where is|look up|search for|find out|research|market size|competitors|trending)\b/i.test(message)
}

// ── Email Commands ──
// Users can email commands by putting them as the first line of the email body.
// Commands start with "/" and are processed before the AI generates a response.

export interface EmailCommand {
  name: string
  aliases: string[]
  description: string
  usage: string
  handler: (args: string, ctx: EmailCommandContext) => Promise<string>
}

export interface EmailCommandContext {
  fromEmail: string
  fromName: string
  subject: string
  memory: CompanionMemory
  ollamaUrl: string
  ollamaModel: string
}

const EMAIL_COMMANDS: EmailCommand[] = [
  {
    name: 'help',
    aliases: ['h', 'commands', '?'],
    description: 'List all available email commands',
    usage: '/help',
    handler: async () => {
      const lines = [
        '**Available Email Commands**',
        '',
        'Send any of these as the first line of your email to kbot:',
        '',
      ]
      for (const cmd of EMAIL_COMMANDS) {
        const aliases = cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.map(a => '/' + a).join(', ')})` : ''
        lines.push(`**${cmd.usage}**${aliases}`)
        lines.push(`  ${cmd.description}`)
        lines.push('')
      }
      lines.push('Any email without a command is treated as a normal conversation.')
      return lines.join('\n')
    },
  },
  {
    name: 'status',
    aliases: ['ping', 'alive'],
    description: 'Check if kbot is running and get basic stats',
    usage: '/status',
    handler: async (_args, ctx) => {
      const memory = ctx.memory
      const convoCount = memory.history.length
      const factCount = memory.facts.length
      return [
        `**kbot Status: Online**`,
        '',
        `Hey ${memory.name}! I'm up and running.`,
        '',
        `- Conversations with you: ${convoCount}`,
        `- Things I remember about you: ${factCount}`,
        `- Your interests I've tracked: ${memory.interests.length}`,
        `- Your goals I'm following: ${memory.goals.length}`,
        `- First contact: ${memory.firstContact.slice(0, 10)}`,
        `- Last topic: ${memory.lastTopic || 'none yet'}`,
      ].join('\n')
    },
  },
  {
    name: 'memory',
    aliases: ['remember', 'about-me', 'profile'],
    description: 'See everything kbot remembers about you',
    usage: '/memory',
    handler: async (_args, ctx) => {
      const m = ctx.memory
      const sections: string[] = [`**What I Know About You, ${m.name}**`, '']

      if (m.facts.length > 0) {
        sections.push('**Facts:**')
        for (const f of m.facts) sections.push(`- ${f}`)
        sections.push('')
      }

      if (m.interests.length > 0) {
        sections.push('**Interests:**')
        for (const i of m.interests) sections.push(`- ${i}`)
        sections.push('')
      }

      if (m.goals.length > 0) {
        sections.push('**Goals:**')
        for (const g of m.goals) sections.push(`- ${g}`)
        sections.push('')
      }

      if (m.preferences.length > 0) {
        sections.push('**Preferences:**')
        for (const p of m.preferences) sections.push(`- ${p}`)
        sections.push('')
      }

      if (m.history.length > 0) {
        sections.push('**Recent History:**')
        for (const h of m.history.slice(-5)) sections.push(`- ${h}`)
        sections.push('')
      }

      if (m.facts.length === 0 && m.interests.length === 0 && m.goals.length === 0) {
        sections.push("I don't know much about you yet — keep chatting and I'll learn!")
      }

      return sections.join('\n')
    },
  },
  {
    name: 'forget',
    aliases: ['reset', 'clear-memory'],
    description: 'Clear all memory kbot has about you (fresh start)',
    usage: '/forget',
    handler: async (_args, ctx) => {
      const fresh: CompanionMemory = {
        name: ctx.fromName || ctx.fromEmail.split('@')[0],
        email: ctx.fromEmail,
        firstContact: new Date().toISOString(),
        interests: [],
        goals: [],
        facts: [],
        preferences: [],
        history: [],
        lastTopic: '',
      }
      saveCompanionMemory(fresh)
      // Update the context memory reference
      Object.assign(ctx.memory, fresh)
      return [
        `**Memory Cleared**`,
        '',
        `Done! I've forgotten everything about you, ${fresh.name}. We're starting fresh.`,
        '',
        `Feel free to re-introduce yourself — I'll learn as we go.`,
      ].join('\n')
    },
  },
  {
    name: 'search',
    aliases: ['lookup', 'find', 'google'],
    description: 'Search the web for something and get results',
    usage: '/search <query>',
    handler: async (args, ctx) => {
      const query = args.trim()
      if (!query) {
        return 'Please provide a search query. Example: /search latest TypeScript features'
      }
      const results = await webSearch(query)
      if (!results) {
        return `I couldn't find results for "${query}". Try rephrasing your search.`
      }
      return [
        `**Search Results for "${query}"**`,
        '',
        results,
        '',
        `Want me to dig deeper into any of these? Just reply with what you'd like to know more about.`,
      ].join('\n')
    },
  },
  {
    name: 'summarize',
    aliases: ['summary', 'recap', 'tldr'],
    description: 'Get a summary of your conversation history with kbot',
    usage: '/summarize',
    handler: async (_args, ctx) => {
      const m = ctx.memory
      if (m.history.length === 0 && m.facts.length === 0) {
        return `We haven't had enough conversations yet for a summary, ${m.name}. Email me about anything and I'll start tracking!`
      }

      const sections: string[] = [`**Conversation Summary for ${m.name}**`, '']

      if (m.lastTopic) {
        sections.push(`**Last topic:** ${m.lastTopic}`)
        sections.push('')
      }

      if (m.history.length > 0) {
        sections.push('**Timeline:**')
        for (const h of m.history) sections.push(`- ${h}`)
        sections.push('')
      }

      if (m.goals.length > 0) {
        sections.push('**Goals we\'ve discussed:**')
        for (const g of m.goals) sections.push(`- ${g}`)
        sections.push('')
      }

      if (m.interests.length > 0) {
        sections.push('**Topics you\'re into:**')
        sections.push(m.interests.join(', '))
        sections.push('')
      }

      sections.push('Reply to pick up where we left off!')
      return sections.join('\n')
    },
  },
  {
    name: 'teach',
    aliases: ['learn', 'remember-this'],
    description: 'Tell kbot to remember a specific fact about you',
    usage: '/teach <fact>',
    handler: async (args, ctx) => {
      const fact = args.trim()
      if (!fact) {
        return 'Tell me what to remember! Example: /teach I prefer Python over JavaScript'
      }
      ctx.memory.facts.push(fact)
      if (ctx.memory.facts.length > 20) ctx.memory.facts = ctx.memory.facts.slice(-20)
      saveCompanionMemory(ctx.memory)
      return [
        `**Got it!**`,
        '',
        `I'll remember: "${fact}"`,
        '',
        `You can check everything I know with /memory, or clear it all with /forget.`,
      ].join('\n')
    },
  },
  {
    name: 'goal',
    aliases: ['track', 'add-goal'],
    description: 'Add a goal for kbot to track and follow up on',
    usage: '/goal <description>',
    handler: async (args, ctx) => {
      const goal = args.trim()
      if (!goal) {
        return 'Describe your goal! Example: /goal Launch my SaaS by Q2'
      }
      if (!ctx.memory.goals.includes(goal)) {
        ctx.memory.goals.push(goal)
        saveCompanionMemory(ctx.memory)
      }
      return [
        `**Goal Tracked!**`,
        '',
        `I'm now tracking: "${goal}"`,
        '',
        `I'll check in on this in future conversations. Your active goals:`,
        ...ctx.memory.goals.map((g, i) => `${i + 1}. ${g}`),
        '',
        `Update or remove goals anytime by emailing me.`,
      ].join('\n')
    },
  },
  {
    name: 'done',
    aliases: ['complete', 'achieved'],
    description: 'Mark a goal as completed',
    usage: '/done <goal number or text>',
    handler: async (args, ctx) => {
      const input = args.trim()
      if (!input) {
        if (ctx.memory.goals.length === 0) {
          return "You don't have any active goals. Add one with /goal <description>"
        }
        return [
          'Which goal did you complete? Reply with the number:',
          '',
          ...ctx.memory.goals.map((g, i) => `${i + 1}. ${g}`),
          '',
          'Example: /done 1',
        ].join('\n')
      }

      const num = parseInt(input, 10)
      let removed: string | undefined
      if (!isNaN(num) && num >= 1 && num <= ctx.memory.goals.length) {
        removed = ctx.memory.goals.splice(num - 1, 1)[0]
      } else {
        // Try matching by text
        const idx = ctx.memory.goals.findIndex(g =>
          g.toLowerCase().includes(input.toLowerCase()),
        )
        if (idx !== -1) removed = ctx.memory.goals.splice(idx, 1)[0]
      }

      if (removed) {
        ctx.memory.history.push(`${new Date().toISOString().slice(0, 10)}: completed goal — ${removed}`)
        if (ctx.memory.history.length > 10) ctx.memory.history = ctx.memory.history.slice(-10)
        saveCompanionMemory(ctx.memory)
        return [
          `**Goal Completed! 🎉**`,
          '',
          `Marked as done: "${removed}"`,
          '',
          ctx.memory.goals.length > 0
            ? `Remaining goals:\n${ctx.memory.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`
            : `No more active goals — time to set a new one with /goal!`,
        ].join('\n')
      }

      return `Couldn't find that goal. Your current goals:\n${ctx.memory.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\nUse /done <number> to mark one complete.`
    },
  },
]

/** Parse an email body for a command. Returns null if no command found. */
export function parseEmailCommand(body: string): { command: string; args: string } | null {
  const trimmed = body.trim()
  // Command must be the first line and start with /
  const firstLine = trimmed.split('\n')[0].trim()
  const match = firstLine.match(/^\/(\S+)(?:\s+(.*))?$/)
  if (!match) return null
  return { command: match[1].toLowerCase(), args: (match[2] || '').trim() }
}

/** Find and execute an email command. Returns the response string, or null if not a command. */
export async function handleEmailCommand(
  body: string,
  ctx: EmailCommandContext,
): Promise<string | null> {
  const parsed = parseEmailCommand(body)
  if (!parsed) return null

  for (const cmd of EMAIL_COMMANDS) {
    if (cmd.name === parsed.command || cmd.aliases.includes(parsed.command)) {
      return cmd.handler(parsed.args, ctx)
    }
  }

  // Unknown command — return help hint
  return [
    `Unknown command: /${parsed.command}`,
    '',
    `Type /help to see available commands, or just send a normal email to chat.`,
  ].join('\n')
}

// ── Email Sending (Resend) ──

async function sendReply(to: string, subject: string, body: string, resendKey: string): Promise<boolean> {
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
        'Authorization': `Bearer ${resendKey}`,
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

// ── Main Agent Loop ──

export interface EmailAgentState {
  running: boolean
  processedCount: number
  lastCheck: string
  errors: string[]
}

const agentState: EmailAgentState = {
  running: false,
  processedCount: 0,
  lastCheck: '',
  errors: [],
}

export function getEmailAgentState(): EmailAgentState {
  return { ...agentState }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export async function startEmailAgent(config: EmailAgentConfig): Promise<void> {
  if (agentState.running) {
    throw new Error('Email agent is already running')
  }

  // Dynamically import Supabase client
  const { createClient } = await import('@supabase/supabase-js')
  const svc = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const processedIds = new Set<string>()

  // Load previously processed IDs
  const stateFile = join(homedir(), '.kbot', 'email-agent-processed.json')
  try {
    if (existsSync(stateFile)) {
      const saved = JSON.parse(readFileSync(stateFile, 'utf8'))
      for (const id of saved) processedIds.add(id)
    }
  } catch { /* ignore */ }

  function saveProcessed(): void {
    try {
      const dir = join(homedir(), '.kbot')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(stateFile, JSON.stringify([...processedIds].slice(-500)))
    } catch { /* best-effort */ }
  }

  async function checkAndRespond(): Promise<void> {
    agentState.lastCheck = new Date().toISOString()
    try {
      // Open mode: if no users specified, accept all inbound emails
      const query = svc.from('contact_messages').select('*')
      const { data: messages } = config.agentUsers.length > 0
        ? await query.in('from_email', config.agentUsers)
        : await query.order('created_at', { ascending: false }).limit(50)

      if (!messages || messages.length === 0) return

      for (const msg of messages) {
        const msgId = String(msg.id)
        if (processedIds.has(msgId)) continue

        // Extract body
        let body = msg.body_text?.trim() || ''
        if (!body && msg.body_html) {
          body = msg.body_html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim()
        }
        if (!body) body = `(User replied to: "${msg.subject}")`

        const userName = msg.from_name || msg.from_email.split('@')[0]
        console.log(`[${new Date().toISOString().slice(11, 19)}] New email from ${userName}: "${msg.subject}"`)

        // Load companion memory (needed for both commands and conversation)
        const memory = loadCompanionMemory(msg.from_email)
        if (msg.from_name && msg.from_name !== msg.from_email) memory.name = msg.from_name

        // ── Check for email commands (e.g. /help, /status, /memory) ──
        const commandResult = await handleEmailCommand(body, {
          fromEmail: msg.from_email,
          fromName: userName,
          subject: msg.subject,
          memory,
          ollamaUrl: config.ollamaUrl,
          ollamaModel: config.ollamaModel,
        })

        if (commandResult) {
          console.log(`  Command detected — handling /${parseEmailCommand(body)?.command}`)

          // Store command + response in conversation history
          await svc.from('agent_conversations').insert({
            email: msg.from_email, name: userName, role: 'user', content: body, subject: msg.subject,
          })
          await svc.from('agent_conversations').insert({
            email: msg.from_email, name: 'Kernel Agent', role: 'assistant', content: commandResult, subject: `Re: ${msg.subject}`,
          })

          const sent = await sendReply(msg.from_email, msg.subject, commandResult, config.resendKey)
          console.log(`  Command reply ${sent ? 'sent' : 'FAILED'} to ${msg.from_email}`)

          processedIds.add(msgId)
          saveProcessed()
          agentState.processedCount++
          continue
        }

        // ── Normal conversation flow (no command) ──

        // Load conversation history
        const { data: history } = await svc
          .from('agent_conversations')
          .select('role, content')
          .eq('email', msg.from_email)
          .order('created_at', { ascending: true })
          .limit(20)

        const convoHistory = (history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))

        // Inject companion memory
        convoHistory.unshift({ role: 'user', content: memoryToPrompt(memory) })

        if (convoHistory.length <= 1) {
          convoHistory.push({ role: 'user', content: `[First conversation with ${memory.name}. Get to know them.]` })
        }
        convoHistory.push({ role: 'user', content: body })

        // Web search if needed
        if (needsWebSearch(body)) {
          const results = await webSearch(body.slice(0, 200))
          if (results) convoHistory.push({ role: 'user', content: `[Web search context]\n${results}` })
        }

        // Generate response
        const reply = await askOllama(convoHistory, config.ollamaUrl, config.ollamaModel)
        if (!reply) {
          console.error('  No response from Ollama — skipping')
          processedIds.add(msgId)
          continue
        }

        // Store conversation
        await svc.from('agent_conversations').insert({
          email: msg.from_email, name: userName, role: 'user', content: body, subject: msg.subject,
        })
        await svc.from('agent_conversations').insert({
          email: msg.from_email, name: 'Kernel Agent', role: 'assistant', content: reply, subject: `Re: ${msg.subject}`,
        })

        // Send reply email
        const sent = await sendReply(msg.from_email, msg.subject, reply, config.resendKey)
        console.log(`  Email ${sent ? 'sent' : 'FAILED'} to ${msg.from_email}`)

        // Update companion memory
        await updateMemoryViaOllama(memory, body, reply, config.ollamaUrl, config.ollamaModel)

        processedIds.add(msgId)
        saveProcessed()
        agentState.processedCount++
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      agentState.errors.push(`${new Date().toISOString().slice(11, 19)}: ${errMsg}`)
      if (agentState.errors.length > 20) agentState.errors = agentState.errors.slice(-20)
    }
  }

  agentState.running = true
  agentState.processedCount = 0
  agentState.errors = []

  // Initial check
  await checkAndRespond()

  // Start polling
  pollTimer = setInterval(checkAndRespond, config.pollInterval)
  console.log(`Email agent polling every ${config.pollInterval / 1000}s. Ctrl+C to stop.`)
}

export function stopEmailAgent(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  agentState.running = false
}
