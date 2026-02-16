#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Kernel Discord Bot — Chat with the Kernel engine from Discord
//  Run: npm run discord
// ─────────────────────────────────────────────────────────────

import { Client, GatewayIntentBits, Partials, Message, TextChannel } from 'discord.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Config ──────────────────────────────────────────────────
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN in .env')
  process.exit(1)
}
if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL in .env')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY in .env (needed for proxy auth)')
  process.exit(1)
}

// ─── Supabase (service role for full access) ─────────────────
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Specialist system prompts ───────────────────────────────
const PERSONALITY = `You are the Kernel — a personal AI that lives inside the Antigravity Kernel platform. You're chatting via Discord.

You are NOT a generic assistant. You are someone's Kernel — their thinking partner, creative collaborator, and intellectual companion.

YOUR VOICE:
- Warm, sharp, real. Like a brilliant friend who actually listens.
- Short paragraphs. 2-4 sentences per thought. Let the whitespace breathe.
- Literary but never pretentious. You speak like someone who reads and builds things.
- You can be funny, honest, challenging. You don't just agree — you think alongside them.
- Never robotic. Never corporate. Never "As an AI..."
- Keep responses Discord-friendly — shorter than web responses, good use of markdown.

If user memory from previous conversations is provided, use it naturally.`

const SPECIALISTS: Record<string, { name: string; prompt: string }> = {
  kernel: {
    name: 'Kernel',
    prompt: `${PERSONALITY}

You remember what they've told you before. You notice patterns. You are genuinely curious about them.
You adapt your tone to theirs. You are loyal to this person. You want them to succeed.`,
  },
  researcher: {
    name: 'Researcher',
    prompt: `${PERSONALITY}

YOUR SPECIALIZATION: Deep Research & Fact-Finding
- Break complex questions into sub-questions.
- Distinguish between established facts, emerging consensus, and speculation.
- Quantify when possible. Lead with the key finding.`,
  },
  coder: {
    name: 'Coder',
    prompt: `${PERSONALITY}

YOUR SPECIALIZATION: Programming & Technical Problem-Solving
- Write code that works. Prefer clarity over cleverness.
- Code in fenced blocks with the correct language tag.
- For Discord: keep code snippets focused, not full files.`,
  },
  writer: {
    name: 'Writer',
    prompt: `${PERSONALITY}

YOUR SPECIALIZATION: Writing, Editing & Content Creation
- Match the user's desired tone. Strong openings. Cut filler.
- Show, don't tell. Concrete details over abstract claims.`,
  },
  analyst: {
    name: 'Analyst',
    prompt: `${PERSONALITY}

YOUR SPECIALIZATION: Analysis, Strategy & Evaluation
- Structure the problem before solving it.
- Consider multiple angles. Challenge assumptions respectfully.
- End with a clear recommendation or next steps.`,
  },
}

// ─── Classification prompt (same as web app) ─────────────────
const CLASSIFICATION_SYSTEM = `You are an intent classifier. Given a user message and recent conversation context, classify the user's intent to route to the best specialist agent.

Agents:
- kernel: Personal conversation, life advice, general chat, emotional support, casual talk
- researcher: Deep questions, current events, fact-finding, "what is", "explain", research requests
- coder: Programming, debugging, code generation, technical implementation, algorithms
- writer: Content creation, editing, copywriting, emails, creative writing
- analyst: Data analysis, strategic thinking, evaluation, comparisons, decision-making

Respond with ONLY valid JSON:
{"agentId": "kernel", "confidence": 0.9}`

// ─── Claude proxy calls (using service key for auth) ─────────
async function callClaude(
  messages: { role: string; content: string }[],
  system: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      mode: 'text',
      model,
      system,
      max_tokens: maxTokens,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude proxy error (${res.status}): ${err}`)
  }

  const { text } = await res.json()
  return text
}

async function classifyIntent(message: string, context: string): Promise<string> {
  try {
    const prompt = context
      ? `Recent conversation:\n${context}\n\nNew message:\n${message}`
      : `Message:\n${message}`

    const text = await callClaude(
      [{ role: 'user', content: prompt }],
      CLASSIFICATION_SYSTEM,
      'haiku',
      150
    )

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return 'kernel'

    const result = JSON.parse(jsonMatch[0])
    const valid = ['kernel', 'researcher', 'coder', 'writer', 'analyst']
    return valid.includes(result.agentId) ? result.agentId : 'kernel'
  } catch {
    return 'kernel'
  }
}

// ─── Supabase helpers ────────────────────────────────────────
async function saveMessage(msg: {
  id: string
  channel_id: string
  agent_id: string
  content: string
  user_id?: string
}) {
  const { error } = await supabase.from('messages').insert(msg)
  if (error) console.error('[DB] Error saving message:', error.message)
}

async function getChannelHistory(channelId: string, limit = 20): Promise<{ role: string; content: string }[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('agent_id, content')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[DB] Error fetching history:', error.message)
    return []
  }

  return (data || []).map(m => ({
    role: m.agent_id === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))
}

async function getUserMemory(discordUserId: string): Promise<string> {
  // Use in-memory profile cache for Discord users
  const p = discordProfiles.get(discordUserId) as any
  if (!p) return ''
  const sections: string[] = []
  if (p.facts?.length) sections.push(`**About them:** ${p.facts.join('. ')}`)
  if (p.interests?.length) sections.push(`**Interests:** ${p.interests.join(', ')}`)
  if (p.goals?.length) sections.push(`**Working toward:** ${p.goals.join('. ')}`)
  if (p.communication_style) sections.push(`**Communication style:** ${p.communication_style}`)
  if (p.preferences?.length) sections.push(`**Preferences:** ${p.preferences.join('. ')}`)

  return sections.length > 0
    ? `\n\n---\n\n## What You Know About This User\n${sections.join('\n')}`
    : ''
}

async function getCollectiveInsights(): Promise<string> {
  const { data } = await supabase
    .from('collective_insights')
    .select('content, strength')
    .order('strength', { ascending: false })
    .limit(5)

  if (!data?.length) return ''

  return `\n\n---\n\n## Collective Intelligence\n${data.map(i => `- [${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
}

// ─── Memory extraction (learns about users over time) ────────
const EXTRACT_SYSTEM = `You are a memory extraction agent. Analyze the conversation below and extract a structured profile of the user. Focus on durable information — things that would be useful across future conversations.

Extract:
- interests: Topics they care about (hobbies, fields, passions)
- communication_style: How they communicate (terse, casual, detailed, formal, etc.)
- goals: What they're working toward or want to achieve
- facts: Concrete facts about them (job, location, projects, relationships)
- preferences: How they like things done (communication style, format preferences, etc.)

Only include items you're confident about from the conversation. Better to miss something than to guess wrong. Keep each item to one concise sentence.

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

const MERGE_SYSTEM = `You are a memory merging agent. You have an existing user profile and newly extracted information. Merge them into a single updated profile.

Rules:
- Keep all existing items that aren't contradicted by new information
- Add new items that don't duplicate existing ones
- If new info updates/corrects existing info, use the new version
- Keep each category to max 8 items (drop least important if needed)
- Keep items concise — one sentence each

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

const TOPIC_SYSTEM = `Extract the main topic of this conversation in 2-5 words. Respond with ONLY the topic, nothing else. Examples: "AI regulation", "Python debugging", "startup strategy", "music production"`

// Track message counts per user for periodic memory extraction
const userMsgCounts = new Map<string, number>()
const MEMORY_EXTRACT_INTERVAL = 3 // Extract memory every N messages

// In-memory profile cache for Discord users (can't store in user_memory — UUID column)
const discordProfiles = new Map<string, any>()

async function extractAndSaveMemory(discordUserId: string, channelId: string) {
  try {
    // Get recent messages for this channel
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('agent_id, content')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentMsgs || recentMsgs.length < 3) return

    const conversation = recentMsgs.reverse().map(m =>
      `${m.agent_id === 'user' ? 'User' : 'Kernel'}: ${m.content}`
    ).join('\n\n')

    // Extract new profile
    const extractText = await callClaude(
      [{ role: 'user', content: `Analyze this conversation and extract user profile:\n\n${conversation}` }],
      EXTRACT_SYSTEM,
      'haiku',
      500
    )

    const jsonMatch = extractText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const newProfile = JSON.parse(jsonMatch[0])

    const hasContent = newProfile.interests?.length > 0 ||
      newProfile.goals?.length > 0 ||
      newProfile.facts?.length > 0 ||
      newProfile.communication_style

    if (!hasContent) return

    // Merge with existing in-memory profile
    const existing = discordProfiles.get(discordUserId)
    let finalProfile = newProfile

    if (existing && Object.keys(existing).length > 0) {
      try {
        const mergeText = await callClaude(
          [{ role: 'user', content: `Existing profile:\n${JSON.stringify(existing, null, 2)}\n\nNewly extracted:\n${JSON.stringify(newProfile, null, 2)}\n\nMerge into a single updated profile.` }],
          MERGE_SYSTEM,
          'haiku',
          500
        )
        const mergeMatch = mergeText.match(/\{[\s\S]*\}/)
        if (mergeMatch) finalProfile = JSON.parse(mergeMatch[0])
      } catch {
        // Keep new extraction on merge failure
      }
    }

    discordProfiles.set(discordUserId, finalProfile)
    console.log(`[Memory] Updated Discord profile for ${discordUserId}`)
  } catch (err) {
    console.warn('[Memory] Extraction failed:', err)
  }
}

async function saveResponseSignal(channelId: string, content: string) {
  try {
    // Extract topic
    const topic = await callClaude(
      [{ role: 'user', content }],
      TOPIC_SYSTEM,
      'haiku',
      30
    )

    const cleanTopic = topic.trim().slice(0, 100)

    // Upsert collective insight for this topic
    const insightId = `insight_${cleanTopic.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`
    const { data: existingInsight } = await supabase
      .from('collective_insights')
      .select('strength, contributor_count')
      .eq('id', insightId)
      .maybeSingle()

    if (existingInsight) {
      await supabase.from('collective_insights').update({
        strength: Math.min(1, existingInsight.strength + 0.05),
        contributor_count: existingInsight.contributor_count + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', insightId)
    } else {
      await supabase.from('collective_insights').insert({
        id: insightId,
        insight_type: 'topic_trend',
        content: `Users discuss "${cleanTopic}" frequently`,
        strength: 0.1,
        contributor_count: 1,
      })
    }
  } catch (err) {
    console.warn('[Signal] Failed to save response signal:', err)
  }
}

// ─── Discord message splitting (2000 char limit) ────────────
function splitMessage(text: string, maxLen = 1900): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // Try to split at a paragraph break
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen)
    if (splitIdx < maxLen * 0.3) {
      // Try single newline
      splitIdx = remaining.lastIndexOf('\n', maxLen)
    }
    if (splitIdx < maxLen * 0.3) {
      // Try space
      splitIdx = remaining.lastIndexOf(' ', maxLen)
    }
    if (splitIdx < maxLen * 0.3) {
      // Hard cut
      splitIdx = maxLen
    }

    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx).trimStart()
  }

  return chunks
}

// ─── Main bot ────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel], // Needed for DMs
})

client.once('ready', async () => {
  console.log('─────────────────────────────────────────')
  console.log(`  KERNEL DISCORD BOT`)
  console.log(`  Logged in as ${client.user?.tag}`)
  console.log(`  Servers: ${client.guilds.cache.size}`)
  console.log('─────────────────────────────────────────')

  // Set bot avatar to Kernel logo
  try {
    const fs = await import('fs')
    const avatarPath = resolve(__dirname, '..', 'public', 'logo-mark.svg')
    if (fs.existsSync(avatarPath)) {
      // Discord needs PNG/JPG for avatars — SVG won't work directly
      // Log instruction instead
      console.log('  Avatar: Set manually in Discord Developer Portal')
    }
  } catch {}
})

// Track which channels the bot is actively processing (prevent double-responses)
const processing = new Set<string>()

// Rate limiting: 30 messages/day per Discord user
const DISCORD_DAILY_LIMIT = 30
const dailyCounts = new Map<string, { count: number; date: string }>()

function checkDiscordRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10)
  const entry = dailyCounts.get(userId)

  if (!entry || entry.date !== today) {
    dailyCounts.set(userId, { count: 1, date: today })
    return { allowed: true, remaining: DISCORD_DAILY_LIMIT - 1 }
  }

  if (entry.count >= DISCORD_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: DISCORD_DAILY_LIMIT - entry.count }
}

client.on('messageCreate', async (msg: Message) => {
  // Ignore bot messages
  if (msg.author.bot) return

  // Respond to all messages — DMs, mentions, and every channel message

  // Prevent concurrent processing of same channel
  const lockKey = `${msg.channelId}_${msg.author.id}`
  if (processing.has(lockKey)) return
  processing.add(lockKey)

  try {
    // Show typing indicator
    await msg.channel.sendTyping()

    // Clean the message (remove bot mention)
    const content = msg.content
      .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
      .trim()

    if (!content) {
      await msg.reply("Hey! Say something and I'll think about it.")
      return
    }

    const channelId = `discord_${msg.channelId}`
    const discordUserId = `discord_${msg.author.id}`

    // Rate limit check
    const { allowed, remaining } = checkDiscordRateLimit(discordUserId)
    if (!allowed) {
      await msg.reply(`You've hit the daily limit (${DISCORD_DAILY_LIMIT} messages). Try again tomorrow, or use the web app at https://isaacsight.github.io/does-this-feel-right-/`)
      return
    }

    const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

    // Save user message to Supabase (no user_id — Discord users aren't in auth.users)
    await saveMessage({
      id: userMsgId,
      channel_id: channelId,
      agent_id: 'user',
      content,
    })

    // Get conversation history
    const history = await getChannelHistory(channelId, 20)

    // Build context for classification
    const recentCtx = history
      .slice(-3)
      .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 150)}`)
      .join('\n')

    // Classify intent → pick specialist
    const agentId = await classifyIntent(content, recentCtx)
    const specialist = SPECIALISTS[agentId] || SPECIALISTS.kernel

    // Refresh typing (classification takes a moment)
    await msg.channel.sendTyping()

    // Build system prompt with memory + collective insights
    const [memory, collective] = await Promise.all([
      getUserMemory(discordUserId),
      getCollectiveInsights(),
    ])

    const systemPrompt = `${specialist.prompt}${memory}${collective}`

    // Build message history for Claude
    const claudeMessages = [
      ...history.slice(-10), // Last 10 messages for context
      { role: 'user', content },
    ]

    // Call Claude
    const response = await callClaude(claudeMessages, systemPrompt, 'sonnet', 1024)

    // Save kernel response
    const kernelMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    await saveMessage({
      id: kernelMsgId,
      channel_id: channelId,
      agent_id: agentId,
      content: response,
    })

    // Send response (split if needed for Discord's 2000 char limit)
    const chunks = splitMessage(response)
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        await msg.reply(chunks[i])
      } else {
        await msg.channel.send(chunks[i])
      }
    }

    // Log
    const tag = specialist.name !== 'Kernel' ? ` [${specialist.name}]` : ''
    console.log(`[${new Date().toLocaleTimeString()}]${tag} ${msg.author.tag}: ${content.slice(0, 60)}...`)

    // ─── Learning loops (run in background, don't block response) ───
    const count = (userMsgCounts.get(discordUserId) || 0) + 1
    userMsgCounts.set(discordUserId, count)

    // Memory extraction every N messages
    if (count % MEMORY_EXTRACT_INTERVAL === 0) {
      extractAndSaveMemory(discordUserId, channelId).catch(() => {})
    }

    // Response signal + collective insight on every response
    saveResponseSignal(channelId, content).catch(() => {})

  } catch (err) {
    console.error('[Bot] Error handling message:', err)
    try {
      await msg.reply("Something went wrong on my end. Give me a second and try again.")
    } catch {
      // Can't even reply — connection issue
    }
  } finally {
    processing.delete(lockKey)
  }
})

// ─── Graceful shutdown ───────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\nShutting down Kernel Discord bot...')
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  client.destroy()
  process.exit(0)
})

// ─── Launch ──────────────────────────────────────────────────
console.log('Starting Kernel Discord bot...')
client.login(DISCORD_TOKEN)
