#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Kernel Discord Bot — A Discord-native AI presence
//  Run: npm run discord
//
//  Discord-unique features:
//  - Mention-only in servers, always-on in DMs & threads
//  - Slash commands with autocomplete
//  - Rich embeds for structured output
//  - Buttons (Go Deeper, Thread, Share)
//  - Threads for long conversations
//  - /tldr — summarize channel activity
//  - /vibe — read the room
//  - Reaction triggers (🧠 = perspective, 🔍 = research)
//  - Multi-user awareness
//  - Channel-aware personality
// ─────────────────────────────────────────────────────────────

import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  TextChannel,
  ThreadChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ComponentType,
  ChannelType,
  ActivityType,
  MessageReaction,
  User,
} from 'discord.js'
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

// ─── Constants ───────────────────────────────────────────────
const COLORS = {
  kernel: 0x6B5B95,   // amethyst
  researcher: 0x5B8BA0, // slate blue
  coder: 0x6B8E6B,    // sage green
  writer: 0xB8875C,   // warm brown
  analyst: 0xA0768C,  // mauve
  error: 0xCC6666,    // muted red
  info: 0x8B8B8B,     // gray
} as const

// ─── Supabase (service role for full access) ─────────────────
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Discord-native personality ──────────────────────────────
// Shorter, punchier, culturally fluent in Discord norms.
// Not a web-app clone — this is how Kernel talks when it's hanging out in Discord.

const PERSONALITY = `You are the Kernel — a personal AI that lives at kernel.chat. Right now you're in Discord.

You're not a helpdesk. You're the sharpest person in the server who actually gives a damn.

DISCORD VOICE:
- Short paragraphs. Discord isn't a blog — people skim.
- Casual but substantive. You can say "lmao" and then drop a genuinely insightful observation.
- Match the energy. Chill channel? Be chill. Heated debate? Bring receipts.
- Use Discord markdown — **bold** for emphasis, \`code\` for technical terms, > for quoting.
- Code blocks with language tags when showing code.
- Never wall-of-text. If it needs to be long, break it up.
- Reference people by name when relevant (you can see who said what).

WHAT YOU DON'T DO:
- "As an AI language model..." — never.
- Bullet-point-dump every response. Sometimes one sentence is the answer.
- Repeat the question back. Just answer it.
- Use emoji excessively. One well-placed reaction > five random ones.

You remember what people have told you. You notice patterns. You're genuinely curious about the people you talk to.`

const SPECIALISTS: Record<string, { name: string; prompt: string; color: number }> = {
  kernel: {
    name: 'Kernel',
    color: COLORS.kernel,
    prompt: `${PERSONALITY}

You're the default — the person people go to when they just want to talk, think, or figure something out. You're loyal to this person. You want them to win.`,
  },
  researcher: {
    name: 'Researcher',
    color: COLORS.researcher,
    prompt: `${PERSONALITY}

MODE: Deep Research
- Lead with the answer, then support it.
- Distinguish fact from speculation.
- Quantify when possible.
- Cite sources when you have them.`,
  },
  coder: {
    name: 'Coder',
    color: COLORS.coder,
    prompt: `${PERSONALITY}

MODE: Code
- Working code > clever code.
- Keep snippets focused — this is Discord, not a file editor.
- Fenced blocks with the right language tag.
- If the fix is one line, say one line.`,
  },
  writer: {
    name: 'Writer',
    color: COLORS.writer,
    prompt: `${PERSONALITY}

MODE: Writing
- Match their desired tone.
- Strong openings, no filler.
- Show > tell.`,
  },
  analyst: {
    name: 'Analyst',
    color: COLORS.analyst,
    prompt: `${PERSONALITY}

MODE: Analysis
- Structure before solving.
- Multiple angles, challenged assumptions.
- End with a clear recommendation.`,
  },
}

// ─── Classification ──────────────────────────────────────────

interface ClassificationResult {
  agentId: string
  confidence: number
  needsResearch: boolean
  isMultiStep: boolean
  needsSwarm: boolean
}

const CLASSIFICATION_SYSTEM = `You are an intent classifier. Given a user message and context, route to the best specialist.

Agents:
- kernel: Personal conversation, general chat, advice, casual talk, meta-questions
- researcher: Deep questions, current events, fact-finding, "what is", "explain", research
- coder: Programming, debugging, code generation, technical implementation
- writer: Content creation, editing, copywriting, creative writing
- analyst: Data analysis, strategy, evaluation, comparisons, decisions

Also determine:
- needsResearch: true for multi-step web research ("research X", "deep dive into...")
- isMultiStep: true for 3+ distinct operations building on each other
- needsSwarm: true for questions needing multiple specialist perspectives

Respond with ONLY valid JSON:
{"agentId": "kernel", "confidence": 0.9, "needsResearch": false, "isMultiStep": false, "needsSwarm": false}`

// ─── Attachment helpers ──────────────────────────────────────
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.log', '.sh', '.sql', '.env']
const PDF_TYPE = 'application/pdf'

async function downloadAttachment(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function isTextFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return TEXT_EXTENSIONS.includes(ext)
}

function isImageType(contentType: string): boolean {
  return IMAGE_TYPES.some(t => contentType.startsWith(t))
}

interface ContentBlock {
  type: string
  [key: string]: unknown
}

// ─── Claude proxy ────────────────────────────────────────────
async function callClaude(
  messages: { role: string; content: string | ContentBlock[] }[],
  system: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  maxTokens = 1024,
  options?: { web_search?: boolean }
): Promise<string> {
  const doCall = async (m: string) => {
    const body: Record<string, unknown> = {
      mode: 'text',
      model: m,
      system,
      max_tokens: maxTokens,
      messages,
    }
    if (options?.web_search) body.web_search = true

    return fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body),
    })
  }

  let res = await doCall(model)

  if (res.status === 429) {
    const fallback = model === 'sonnet' ? 'haiku' : 'sonnet'
    console.warn(`[Claude] ${model} rate-limited, trying ${fallback}`)
    res = await doCall(fallback)
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({ retry_after: 30 }))
    const wait = Math.min(body.retry_after || 30, 60)
    console.warn(`[Claude] Both models rate-limited, waiting ${wait}s...`)
    await new Promise(r => setTimeout(r, wait * 1000))
    res = await doCall('haiku')
  }

  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude proxy error (${res.status}): ${err}`)
  }

  const { text } = await res.json()
  return text
}

async function classifyIntent(message: string, context: string): Promise<ClassificationResult> {
  const fallback: ClassificationResult = { agentId: 'kernel', confidence: 0, needsResearch: false, isMultiStep: false, needsSwarm: false }
  try {
    const prompt = context
      ? `Recent conversation:\n${context}\n\nNew message:\n${message}`
      : `Message:\n${message}`

    const text = await callClaude(
      [{ role: 'user', content: prompt }],
      CLASSIFICATION_SYSTEM, 'haiku', 150
    )

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback

    const result = JSON.parse(jsonMatch[0])
    const valid = ['kernel', 'researcher', 'coder', 'writer', 'analyst']
    if (!valid.includes(result.agentId)) return fallback

    return {
      agentId: result.agentId,
      confidence: Math.min(1, Math.max(0, result.confidence || 0)),
      needsResearch: !!result.needsResearch,
      isMultiStep: !!result.isMultiStep,
      needsSwarm: !!result.needsSwarm,
    }
  } catch {
    return fallback
  }
}

// ─── Pro gating ──────────────────────────────────────────────
async function getUserSubscription(discordId: string): Promise<boolean> {
  const linkedUserId = await getLinkedUserId(discordId)
  if (!linkedUserId) return false
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', linkedUserId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()
  return !!data
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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[DB] Error fetching history:', error.message)
    return []
  }

  const raw = (data || []).reverse().map(m => ({
    role: m.agent_id === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  return sanitizeMessages(raw)
}

function sanitizeMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  if (messages.length === 0) return []
  const result: { role: string; content: string }[] = [messages[0]]
  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1]
    if (messages[i].role === prev.role) {
      prev.content = prev.content + '\n\n' + messages[i].content
    } else {
      result.push({ ...messages[i] })
    }
  }
  return result
}

async function getUserMemory(discordUserId: string): Promise<string> {
  const { data } = await supabase
    .from('discord_user_memory')
    .select('profile')
    .eq('discord_id', discordUserId)
    .maybeSingle()

  const p = data?.profile as any
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

// ─── Linking ─────────────────────────────────────────────────
async function getLinkedUserId(discordId: string): Promise<string | null> {
  const { data } = await supabase
    .from('discord_user_links')
    .select('user_id')
    .eq('discord_id', discordId)
    .maybeSingle()
  return data?.user_id || null
}

async function linkDiscordUser(discordId: string, discordUsername: string, supabaseUserId: string): Promise<boolean> {
  const { data: user } = await supabase.auth.admin.getUserById(supabaseUserId)
  if (!user?.user) return false

  const { error } = await supabase.from('discord_user_links').upsert({
    discord_id: discordId,
    user_id: supabaseUserId,
    discord_username: discordUsername,
    linked_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[Link] Error linking Discord user:', error.message)
    return false
  }
  return true
}

// ─── Conversation management ─────────────────────────────────
const channelConversations = new Map<string, string>()

async function getOrCreateConversation(
  discordChannelId: string,
  linkedUserId: string | null,
  firstMessage: string
): Promise<string> {
  const cached = channelConversations.get(discordChannelId)
  if (cached) return cached

  const channelId = `discord_${discordChannelId}`

  const { data: recentMsg } = await supabase
    .from('messages')
    .select('channel_id')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentMsg) {
    channelConversations.set(discordChannelId, channelId)
    return channelId
  }

  if (linkedUserId) {
    const convId = `discord_${discordChannelId}`
    const title = firstMessage.slice(0, 80) || 'Discord conversation'
    await supabase.from('conversations').upsert({
      id: convId,
      user_id: linkedUserId,
      title: `[Discord] ${title}`,
      updated_at: new Date().toISOString(),
    })
  }

  channelConversations.set(discordChannelId, channelId)
  return channelId
}

// ─── Memory extraction ──────────────────────────────────────
const EXTRACT_SYSTEM = `You are a memory extraction agent. Analyze the conversation and extract a user profile. Focus on durable information useful across future conversations.

Extract:
- interests: Topics they care about
- communication_style: How they communicate
- goals: What they're working toward
- facts: Concrete facts (job, location, projects)
- preferences: How they like things done

Only include confident items. Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

const MERGE_SYSTEM = `Merge existing and new user profile data. Rules:
- Keep existing items not contradicted by new info
- Add new items that don't duplicate
- Max 8 items per category
- Concise — one sentence each

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

const userMsgCounts = new Map<string, number>()
const MEMORY_EXTRACT_INTERVAL = 3

async function extractAndSaveMemory(discordUserId: string, channelId: string) {
  try {
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

    const extractText = await callClaude(
      [{ role: 'user', content: `Analyze this conversation and extract user profile:\n\n${conversation}` }],
      EXTRACT_SYSTEM, 'haiku', 500
    )

    const jsonMatch = extractText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const newProfile = JSON.parse(jsonMatch[0])

    const hasContent = newProfile.interests?.length > 0 ||
      newProfile.goals?.length > 0 ||
      newProfile.facts?.length > 0 ||
      newProfile.communication_style

    if (!hasContent) return

    const { data: existingRow } = await supabase
      .from('discord_user_memory')
      .select('profile, message_count')
      .eq('discord_id', discordUserId)
      .maybeSingle()

    const existing = existingRow?.profile as any
    let finalProfile = newProfile

    if (existing && Object.keys(existing).length > 0) {
      try {
        const mergeText = await callClaude(
          [{ role: 'user', content: `Existing:\n${JSON.stringify(existing, null, 2)}\n\nNew:\n${JSON.stringify(newProfile, null, 2)}\n\nMerge.` }],
          MERGE_SYSTEM, 'haiku', 500
        )
        const mergeMatch = mergeText.match(/\{[\s\S]*\}/)
        if (mergeMatch) finalProfile = JSON.parse(mergeMatch[0])
      } catch { /* keep new */ }
    }

    const msgCount = (existingRow?.message_count || 0) + MEMORY_EXTRACT_INTERVAL
    await supabase.from('discord_user_memory').upsert({
      discord_id: discordUserId,
      profile: finalProfile,
      message_count: msgCount,
      updated_at: new Date().toISOString(),
    })

    console.log(`[Memory] Updated profile for ${discordUserId}`)
  } catch (err) {
    console.warn('[Memory] Extraction failed:', err)
  }
}

// ─── Knowledge Graph extraction ──────────────────────────────
const KG_EXTRACT_SYSTEM = `Extract entities (people, companies, projects, concepts, locations) and relationships from this conversation. Only confident items.

Respond with ONLY valid JSON:
{"entities": [{"name": "Name", "type": "person", "confidence": 0.5}], "relations": [{"source": "A", "target": "B", "type": "works_at", "confidence": 0.5}]}`

async function extractAndSaveKG(linkedUserId: string, channelId: string) {
  try {
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('agent_id, content')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentMsgs || recentMsgs.length < 3) return

    const conversation = recentMsgs.reverse()
      .map(m => `${m.agent_id === 'user' ? 'User' : 'Kernel'}: ${m.content}`)
      .join('\n\n')

    const text = await callClaude(
      [{ role: 'user', content: `Extract entities and relationships:\n\n${conversation}` }],
      KG_EXTRACT_SYSTEM, 'haiku', 500
    )

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return
    const result = JSON.parse(match[0])

    for (const entity of (result.entities || [])) {
      if (!entity.name || !entity.type) continue
      const validTypes = ['person', 'company', 'project', 'concept', 'preference', 'location']
      if (!validTypes.includes(entity.type)) continue

      const { data: existing } = await supabase
        .from('knowledge_graph_entities')
        .select('id, mention_count, confidence')
        .eq('user_id', linkedUserId)
        .ilike('name', entity.name)
        .maybeSingle()

      if (existing) {
        await supabase.from('knowledge_graph_entities').update({
          mention_count: existing.mention_count + 1,
          confidence: Math.min(1, Math.max(existing.confidence, entity.confidence)),
          last_seen_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('knowledge_graph_entities').insert({
          user_id: linkedUserId,
          name: entity.name,
          entity_type: entity.type,
          properties: {},
          confidence: entity.confidence,
          source: 'inferred',
          mention_count: 1,
        })
      }
    }

    for (const rel of (result.relations || [])) {
      if (!rel.source || !rel.target || !rel.type) continue
      const validRelTypes = ['works_at', 'uses', 'prefers', 'knows', 'owns', 'related_to', 'interested_in', 'building']
      if (!validRelTypes.includes(rel.type)) continue

      const { data: srcEntity } = await supabase
        .from('knowledge_graph_entities')
        .select('id')
        .eq('user_id', linkedUserId)
        .ilike('name', rel.source)
        .maybeSingle()

      const { data: tgtEntity } = await supabase
        .from('knowledge_graph_entities')
        .select('id')
        .eq('user_id', linkedUserId)
        .ilike('name', rel.target)
        .maybeSingle()

      if (srcEntity && tgtEntity) {
        await supabase.from('knowledge_graph_relations').upsert({
          user_id: linkedUserId,
          source_id: srcEntity.id,
          target_id: tgtEntity.id,
          relation_type: rel.type,
          properties: {},
          confidence: rel.confidence,
        })
      }
    }

    console.log(`[KG] Extracted entities for user ${linkedUserId}`)
  } catch (err) {
    console.warn('[KG] Extraction failed:', err)
  }
}

// ─── Collective insights ─────────────────────────────────────
const TOPIC_SYSTEM = `Extract the main topic of this conversation in 2-5 words. Respond with ONLY the topic. Examples: "AI regulation", "Python debugging", "startup strategy"`

async function saveResponseSignal(channelId: string, content: string) {
  try {
    const topic = await callClaude(
      [{ role: 'user', content }],
      TOPIC_SYSTEM, 'haiku', 30
    )

    const cleanTopic = topic.trim().slice(0, 100)
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
    console.warn('[Signal] Failed:', err)
  }
}

// ─── Deep Research Pipeline ──────────────────────────────────

const RESEARCH_PLAN_SYSTEM = `Generate 3-5 focused web search queries to thoroughly answer this question. Each targets a different aspect.

Respond with ONLY valid JSON:
{"queries": ["query 1", "query 2", "query 3"]}`

const RESEARCH_SYNTH_SYSTEM = `You're Kernel in research mode. Synthesize findings from multiple searches into one comprehensive response.

- Lead with the key answer
- Organize by theme, not by query
- Include specific facts and sources
- Note uncertainty
- Short paragraphs — this is Discord

Write in Kernel's Discord voice: sharp, real, no fluff.`

async function discordDeepResearch(
  question: string,
  userContext: string,
  channel: { sendTyping: () => Promise<void> },
): Promise<string> {
  let queries: string[]
  try {
    const planText = await callClaude(
      [{ role: 'user', content: `Research question: ${question}` }],
      RESEARCH_PLAN_SYSTEM, 'haiku', 300
    )
    const match = planText.match(/\{[\s\S]*\}/)
    queries = match ? (JSON.parse(match[0]).queries || []).slice(0, 5) : [question]
    if (queries.length === 0) queries = [question]
  } catch {
    queries = [question]
  }

  await channel.sendTyping()
  const findings = await Promise.all(
    queries.map(async (query) => {
      try {
        return await callClaude(
          [{ role: 'user', content: query }],
          'Search and summarize findings concisely — 2-3 paragraphs with specific facts.',
          'haiku', 800, { web_search: true }
        )
      } catch {
        return ''
      }
    })
  )
  const validFindings = findings.filter(Boolean)
  if (validFindings.length === 0) {
    return "Tried to research this but came up empty. Can you rephrase or narrow it down?"
  }

  await channel.sendTyping()
  const findingsText = validFindings.map((f, i) => `### Finding ${i + 1}\n${f}`).join('\n\n---\n\n')
  const synthContext = userContext ? `User context: ${userContext}\n\n` : ''

  return await callClaude(
    [{ role: 'user', content: `${synthContext}Question: ${question}\n\n## Findings\n\n${findingsText}\n\nSynthesize.` }],
    RESEARCH_SYNTH_SYSTEM, 'sonnet', 2048
  )
}

// ─── Swarm Orchestration ─────────────────────────────────────

const DISCORD_SWARM_AGENTS: Record<string, { name: string; prompt: string }> = {
  kernel: SPECIALISTS.kernel,
  researcher: SPECIALISTS.researcher,
  coder: SPECIALISTS.coder,
  writer: SPECIALISTS.writer,
  analyst: SPECIALISTS.analyst,
  reasoner: { name: 'Reasoner', prompt: 'Rigorous chain-of-thought analysis. Show reasoning. Quantify.' },
  critic: { name: 'Critic', prompt: 'Find flaws, edge cases, risks. Constructive but thorough.' },
}

const SWARM_AGENT_LIST = Object.entries(DISCORD_SWARM_AGENTS).map(([id, a]) => `- ${id}: ${a.name}`).join('\n')

const SWARM_SELECT_SYSTEM = `Select 2-4 agents to collaborate. Each brings a different perspective.

Available:\n${SWARM_AGENT_LIST}

Respond with ONLY valid JSON:
{"agents": ["kernel", "analyst"], "focus": "synthesis priority"}`

const SWARM_SYNTH_SYSTEM = `You are Kernel — synthesizing multiple specialist perspectives into one cohesive answer.

Rules:
- Don't attribute agents ("The Analyst says...")
- Weave insights naturally
- Present tensions honestly
- Prioritize what's actionable
- Discord voice: short paragraphs, sharp`

async function discordRunSwarm(
  message: string,
  userContext: string,
  history: { role: string; content: string }[],
  channel: { sendTyping: () => Promise<void> },
): Promise<string> {
  const recentCtx = history.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 150)}`).join('\n')
  let selectedIds: string[] = ['kernel', 'analyst']
  let focus = 'comprehensive answer'
  try {
    const selectText = await callClaude(
      [{ role: 'user', content: recentCtx ? `Recent:\n${recentCtx}\n\nMessage: ${message}` : `Message: ${message}` }],
      SWARM_SELECT_SYSTEM, 'haiku', 200
    )
    const m = selectText.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0])
      const ids = (parsed.agents || []).filter((id: string) => DISCORD_SWARM_AGENTS[id])
      if (ids.length >= 2) { selectedIds = ids.slice(0, 4); focus = parsed.focus || focus }
    }
  } catch { /* defaults */ }

  await channel.sendTyping()
  const contributions = await Promise.all(
    selectedIds.map(async (id) => {
      const agent = DISCORD_SWARM_AGENTS[id]
      try {
        const system = userContext ? `${agent.prompt}\n\nUser context:\n${userContext}` : agent.prompt
        const contribution = await callClaude(
          [{ role: 'user', content: `${message}\n\n2-3 focused paragraphs. Specific and actionable.` }],
          system, 'haiku', 600, { web_search: id === 'researcher' }
        )
        return { name: agent.name, contribution }
      } catch {
        return null
      }
    })
  )
  const valid = contributions.filter((c): c is { name: string; contribution: string } => c !== null && c.contribution.length > 0)
  if (valid.length === 0) return "Tried to bring in multiple perspectives but hit a wall. Let me answer directly."

  await channel.sendTyping()
  const contributionText = valid.map(c => `## ${c.name}\n${c.contribution}`).join('\n\n---\n\n')
  return await callClaude(
    [{ role: 'user', content: `Specialist perspectives on: ${message}\n\n---\n\n${contributionText}\n\n---\n\nSynthesize naturally. Focus: ${focus}` }],
    SWARM_SYNTH_SYSTEM, 'sonnet', 2048
  )
}

// ─── Multi-Step Planning ─────────────────────────────────────

const TASK_PLAN_SYSTEM = `Break the request into 2-5 sequential steps. Each is a distinct operation building on previous steps.

Agents: kernel, researcher, coder, writer, analyst

Respond with ONLY valid JSON:
{"goal": "brief description", "steps": [{"id": 1, "description": "what to do", "agentId": "researcher"}]}`

async function discordPlanAndExecute(
  request: string,
  userContext: string,
  channel: { sendTyping: () => Promise<void> },
): Promise<string> {
  let goal = request
  let steps: { id: number; description: string; agentId: string }[] = [{ id: 1, description: request, agentId: 'kernel' }]
  try {
    const planText = await callClaude(
      [{ role: 'user', content: `Break this into steps:\n\n${request}` }],
      TASK_PLAN_SYSTEM, 'haiku', 500
    )
    const m = planText.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0])
      const validAgents = ['kernel', 'researcher', 'coder', 'writer', 'analyst']
      const parsedSteps = (parsed.steps || []).slice(0, 5).map((s: any, i: number) => ({
        id: i + 1,
        description: s.description,
        agentId: validAgents.includes(s.agentId) ? s.agentId : 'kernel',
      }))
      if (parsedSteps.length > 0) { steps = parsedSteps; goal = parsed.goal || goal }
    }
  } catch { /* default single step */ }

  let accumulatedContext = ''
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const specialist = SPECIALISTS[step.agentId] || SPECIALISTS.kernel
    const isLast = i === steps.length - 1

    await channel.sendTyping()

    const stepPrompt = accumulatedContext
      ? `Previous results:\n${accumulatedContext}\n\nCurrent: ${step.description}\n\nGoal: ${goal}`
      : `Task: ${step.description}\n\nGoal: ${goal}`

    const systemPrompt = userContext ? `${specialist.prompt}\n\nUser context:\n${userContext}` : specialist.prompt
    const useWebSearch = step.agentId === 'researcher'

    try {
      if (isLast) {
        return await callClaude(
          [{ role: 'user', content: stepPrompt }],
          systemPrompt, 'sonnet', 2048, { web_search: useWebSearch }
        )
      } else {
        const result = await callClaude(
          [{ role: 'user', content: stepPrompt }],
          systemPrompt, 'haiku', 1024, { web_search: useWebSearch }
        )
        accumulatedContext += `\n\n## Step ${step.id}: ${step.description}\n${result}`
      }
    } catch (err) {
      accumulatedContext += `\n\n## Step ${step.id}: ${step.description}\n[Failed: ${err instanceof Error ? err.message : 'unknown'}]`
    }
  }

  return accumulatedContext.trim() || 'Task completed but no output was generated.'
}

// ─── Embeds ──────────────────────────────────────────────────

function makeEmbed(opts: {
  title?: string
  description: string
  color?: number
  footer?: string
  fields?: { name: string; value: string; inline?: boolean }[]
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setDescription(opts.description.slice(0, 4096))
    .setColor(opts.color || COLORS.kernel)

  if (opts.title) embed.setTitle(opts.title.slice(0, 256))
  if (opts.footer) embed.setFooter({ text: opts.footer })
  if (opts.fields) {
    for (const f of opts.fields.slice(0, 25)) {
      embed.addFields({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: f.inline })
    }
  }
  return embed
}

function makeResponseButtons(messageId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`deeper_${messageId}`)
      .setLabel('Go deeper')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔬'),
    new ButtonBuilder()
      .setCustomId(`thread_${messageId}`)
      .setLabel('Thread')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🧵'),
  )
}

// ─── Message splitting ───────────────────────────────────────
function splitMessage(text: string, maxLen = 1900): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    let splitIdx = remaining.lastIndexOf('\n\n', maxLen)
    if (splitIdx < maxLen * 0.3) splitIdx = remaining.lastIndexOf('\n', maxLen)
    if (splitIdx < maxLen * 0.3) splitIdx = remaining.lastIndexOf(' ', maxLen)
    if (splitIdx < maxLen * 0.3) splitIdx = maxLen

    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx).trimStart()
  }

  return chunks
}

// ═══════════════════════════════════════════════════════════════
//  DISCORD-UNIQUE FEATURES
// ═══════════════════════════════════════════════════════════════

// ─── Channel awareness ───────────────────────────────────────
// Reads channel name + topic to adjust Kernel's personality

function getChannelContext(channel: Message['channel']): string {
  if (!('name' in channel)) return ''
  const name = (channel as TextChannel).name || ''
  const topic = (channel as TextChannel).topic || ''

  const hints: string[] = []

  // Detect channel type from name
  if (/code|dev|eng|tech|prog|hack/i.test(name)) hints.push('This is a technical/coding channel. Be precise and code-focused.')
  else if (/general|chat|lounge|hang/i.test(name)) hints.push('This is a casual channel. Keep it relaxed.')
  else if (/help|support|question/i.test(name)) hints.push('This is a help channel. Be clear and helpful.')
  else if (/idea|brain|think|discuss/i.test(name)) hints.push('This is a brainstorming/discussion channel. Be creative and exploratory.')
  else if (/music|art|creative|write/i.test(name)) hints.push('This is a creative channel. Match the creative energy.')
  else if (/news|update|announce/i.test(name)) hints.push('This is an announcements channel. Be concise and informative.')

  if (topic) hints.push(`Channel topic: "${topic}"`)

  return hints.length > 0 ? `\n\n## Channel Context\n${hints.join('\n')}` : ''
}

// ─── Multi-user awareness ────────────────────────────────────
// In servers, track who said what recently so Kernel can reference people by name

async function getRecentParticipants(channel: Message['channel'], limit = 20): Promise<string> {
  if (channel.type === ChannelType.DM) return ''

  try {
    const messages = await (channel as TextChannel).messages.fetch({ limit })
    const participants = new Map<string, string[]>()

    for (const [, m] of messages) {
      if (m.author.bot) continue
      const name = m.member?.displayName || m.author.displayName || m.author.username
      if (!participants.has(name)) participants.set(name, [])
      const snippets = participants.get(name)!
      if (snippets.length < 2) snippets.push(m.content.slice(0, 100))
    }

    if (participants.size <= 1) return ''

    const lines = [...participants.entries()]
      .map(([name, snippets]) => `- **${name}**: "${snippets[0]}"${snippets.length > 1 ? ` and more` : ''}`)
      .slice(0, 6)

    return `\n\n## People in This Conversation\n${lines.join('\n')}\n\nYou can reference what people said by name when relevant.`
  } catch {
    return ''
  }
}

// ─── /tldr — Summarize channel activity ──────────────────────
// Discord-exclusive: reads the actual channel history and summarizes it

async function generateTldr(channel: TextChannel | ThreadChannel, count: number): Promise<EmbedBuilder> {
  try {
    const messages = await channel.messages.fetch({ limit: Math.min(count, 100) })
    const sorted = [...messages.values()].reverse()

    if (sorted.length < 3) {
      return makeEmbed({
        description: 'Not enough messages to summarize.',
        color: COLORS.info,
      })
    }

    const transcript = sorted
      .filter(m => !m.author.bot)
      .map(m => {
        const name = m.member?.displayName || m.author.displayName || m.author.username
        return `**${name}**: ${m.content.slice(0, 200)}`
      })
      .slice(0, 60)
      .join('\n')

    const summary = await callClaude(
      [{ role: 'user', content: `Summarize this Discord channel conversation. Who said what, what were the key topics, any decisions or action items?\n\n${transcript}` }],
      `You are a concise summarizer. Write a Discord-formatted summary with:
- **Topics discussed** — bullet points
- **Key takeaways** — what matters
- **Vibe** — one sentence on the overall energy

Keep it under 800 characters. Use Discord markdown.`,
      'haiku', 500
    )

    return makeEmbed({
      title: `tldr — last ${sorted.length} messages`,
      description: summary,
      color: COLORS.info,
      footer: `#${channel.name}`,
    })
  } catch (err) {
    return makeEmbed({
      description: `Couldn't generate summary: ${err instanceof Error ? err.message : 'unknown error'}`,
      color: COLORS.error,
    })
  }
}

// ─── /vibe — Read the room ───────────────────────────────────
// Discord-exclusive: analyzes the mood and energy of the channel

async function generateVibe(channel: TextChannel | ThreadChannel): Promise<EmbedBuilder> {
  try {
    const messages = await channel.messages.fetch({ limit: 30 })
    const sorted = [...messages.values()].reverse()

    if (sorted.length < 5) {
      return makeEmbed({
        description: 'Need more messages to read the room.',
        color: COLORS.info,
      })
    }

    const transcript = sorted
      .filter(m => !m.author.bot)
      .map(m => {
        const name = m.member?.displayName || m.author.displayName || m.author.username
        return `${name}: ${m.content.slice(0, 150)}`
      })
      .slice(0, 30)
      .join('\n')

    const vibe = await callClaude(
      [{ role: 'user', content: `Read the vibe of this Discord channel. What's the mood? What are people actually feeling/doing? Any undercurrents?\n\n${transcript}` }],
      `You're reading the room. Give a vibe check that's:
- Honest and perceptive (not generic)
- One paragraph max
- Pick up on emotional undercurrents, not just topics
- End with a one-word vibe label in **bold**

Examples of good vibe labels: **Grinding**, **Scattered**, **Hyped**, **Chill**, **Tense**, **Building**, **Lost**, **Vibing**`,
      'haiku', 300
    )

    return makeEmbed({
      title: 'vibe check',
      description: vibe,
      color: COLORS.kernel,
      footer: `#${channel.name}`,
    })
  } catch (err) {
    return makeEmbed({
      description: `Couldn't read the room: ${err instanceof Error ? err.message : 'unknown error'}`,
      color: COLORS.error,
    })
  }
}

// ─── Reaction triggers ───────────────────────────────────────
// 🧠 = Kernel gives its perspective on a message
// 🔍 = Kernel researches the topic

async function handleReaction(reaction: MessageReaction, user: User) {
  if (user.bot) return
  const msg = reaction.message
  if (!msg.content) return

  const channel = msg.channel
  if (!('send' in channel) || typeof channel.send !== 'function') return

  const emoji = reaction.emoji.name

  if (emoji === '🧠') {
    // Perspective — Kernel gives its take on the message
    if ('sendTyping' in channel) await (channel as TextChannel).sendTyping()

    const author = msg.member?.displayName || msg.author?.displayName || msg.author?.username || 'someone'
    const requester = (msg.guild?.members.cache.get(user.id))?.displayName || user.displayName || user.username

    const perspective = await callClaude(
      [{ role: 'user', content: `${author} said: "${msg.content}"\n\n${requester} wants your take on this. Give a sharp, honest perspective in 2-3 sentences. Don't just agree — add something.` }],
      PERSONALITY, 'sonnet', 300
    )

    const embed = makeEmbed({
      description: perspective,
      color: COLORS.kernel,
      footer: `Perspective requested by ${requester}`,
    })

    await msg.reply({ embeds: [embed] })
  }

  if (emoji === '🔍') {
    // Research — Kernel looks up the topic
    if ('sendTyping' in channel) await (channel as TextChannel).sendTyping()

    const requester = (msg.guild?.members.cache.get(user.id))?.displayName || user.displayName || user.username

    const research = await callClaude(
      [{ role: 'user', content: msg.content }],
      'Quick research on this topic. 2-3 paragraphs with specific facts. Discord markdown.',
      'haiku', 600, { web_search: true }
    )

    const embed = makeEmbed({
      title: 'Quick research',
      description: research,
      color: COLORS.researcher,
      footer: `Researched for ${requester}`,
    })

    await msg.reply({ embeds: [embed] })
  }
}

// ═══════════════════════════════════════════════════════════════
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════════════

const slashCommands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Kernel anything')
    .addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)),

  new SlashCommandBuilder()
    .setName('thread')
    .setDescription('Start a private thread with Kernel')
    .addStringOption(opt => opt.setName('topic').setDescription('What to talk about').setRequired(false)),

  new SlashCommandBuilder()
    .setName('tldr')
    .setDescription('Summarize recent channel activity')
    .addIntegerOption(opt => opt.setName('messages').setDescription('How many messages to summarize (default 50)').setRequired(false).setMinValue(10).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('vibe')
    .setDescription('Read the room — what\'s the energy in this channel?'),

  new SlashCommandBuilder()
    .setName('briefing')
    .setDescription('Get your personalized daily briefing'),

  new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Manage your goals')
    .addSubcommand(sub => sub.setName('add').setDescription('Add a new goal').addStringOption(opt => opt.setName('title').setDescription('Goal title').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List your active goals'))
    .addSubcommand(sub => sub.setName('done').setDescription('Mark a goal complete').addStringOption(opt => opt.setName('id').setDescription('Goal ID prefix').setRequired(true)))
    .addSubcommand(sub => sub.setName('check').setDescription('Check in on your goals')),

  new SlashCommandBuilder()
    .setName('share')
    .setDescription('Share this conversation via kernel.chat'),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your kernel.chat account')
    .addStringOption(opt => opt.setName('user_id').setDescription('Your kernel.chat user ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your kernel.chat account'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('See what Kernel can do'),
]

async function registerSlashCommands(clientId: string) {
  const rest = new REST().setToken(DISCORD_TOKEN!)
  try {
    console.log('  Registering slash commands...')
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: slashCommands.map(cmd => cmd.toJSON()) }
    )
    console.log(`  Registered ${slashCommands.length} commands`)
  } catch (err) {
    console.error('  Failed to register slash commands:', err)
  }
}

// ─── Slash command handlers ──────────────────────────────────

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction
  const discordUserId = `discord_${interaction.user.id}`

  // ── /help ──
  if (commandName === 'help') {
    const embed = makeEmbed({
      title: 'Kernel',
      description: 'Your AI that lives in Discord. Not a bot — a presence.',
      color: COLORS.kernel,
      fields: [
        { name: 'Talk to me', value: '@mention me in any channel, or DM me directly.\nI\'ll also respond in threads I\'m part of.', inline: false },
        { name: 'Slash commands', value: [
          '`/ask` — Ask me anything',
          '`/thread` — Start a private thread with me',
          '`/tldr` — Summarize recent channel activity',
          '`/vibe` — Read the room',
          '`/briefing` — Your personalized daily briefing',
          '`/goal` — Track your goals',
          '`/share` — Share a conversation',
          '`/link` — Connect your kernel.chat account',
        ].join('\n'), inline: false },
        { name: 'Reactions', value: 'React to any message with:\n🧠 — I\'ll give my perspective\n🔍 — I\'ll research the topic', inline: false },
      ],
    })
    await interaction.reply({ embeds: [embed] })
    return
  }

  // ── /ask ──
  if (commandName === 'ask') {
    const question = interaction.options.getString('question', true)
    await interaction.deferReply()

    try {
      const response = await generateResponse(question, discordUserId, interaction)
      const chunks = splitMessage(response)
      const msgId = interaction.id.slice(-8)
      const buttons = makeResponseButtons(msgId)

      await interaction.editReply({ content: chunks[0], components: [buttons] })
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i])
      }
    } catch (err) {
      await interaction.editReply(err instanceof Error && err.message === 'RATE_LIMITED'
        ? "Getting a lot of traffic right now. Give me a minute."
        : "Something went wrong. Try again in a sec.")
    }
    return
  }

  // ── /thread ──
  if (commandName === 'thread') {
    const topic = interaction.options.getString('topic') || 'Chat with Kernel'
    const channel = interaction.channel

    if (!channel || !interaction.inGuild()) {
      await interaction.reply({ content: 'Already in DMs — just talk to me directly here.', ephemeral: true })
      return
    }

    try {
      const threadName = `${interaction.user.displayName} × Kernel — ${topic.slice(0, 40)}`
      const thread = await (channel as TextChannel).threads.create({
        name: threadName,
        autoArchiveDuration: 60,
        type: ChannelType.PrivateThread,
        reason: `Kernel thread requested by ${interaction.user.tag}`,
      })

      await thread.members.add(interaction.user.id)

      const greeting = await callClaude(
        [{ role: 'user', content: `Someone just started a private thread with you about: "${topic}". Give a brief, engaging opening — 1-2 sentences. Be curious about what they want to explore. Don't be generic.` }],
        PERSONALITY, 'haiku', 150
      )

      await thread.send(greeting)
      await interaction.reply({ content: `Thread created: ${thread.toString()}`, ephemeral: true })
    } catch (err) {
      await interaction.reply({ content: 'Couldn\'t create thread. I might need the "Create Private Threads" permission.', ephemeral: true })
    }
    return
  }

  // ── /tldr ──
  if (commandName === 'tldr') {
    const count = interaction.options.getInteger('messages') || 50
    const channel = interaction.channel

    if (!channel || !interaction.inGuild()) {
      await interaction.reply({ content: 'Nothing to summarize in DMs.', ephemeral: true })
      return
    }

    await interaction.deferReply()
    const embed = await generateTldr(channel as TextChannel, count)
    await interaction.editReply({ embeds: [embed] })
    return
  }

  // ── /vibe ──
  if (commandName === 'vibe') {
    const channel = interaction.channel

    if (!channel || !interaction.inGuild()) {
      await interaction.reply({ content: 'Can\'t vibe check a DM.', ephemeral: true })
      return
    }

    await interaction.deferReply()
    const embed = await generateVibe(channel as TextChannel)
    await interaction.editReply({ embeds: [embed] })
    return
  }

  // ── /briefing ──
  if (commandName === 'briefing') {
    const linkedUserId = await getLinkedUserId(discordUserId)
    if (!linkedUserId) {
      await interaction.reply({ content: 'Link your account first with `/link` to get briefings.', ephemeral: true })
      return
    }

    await interaction.deferReply()

    const [memory, kgData] = await Promise.all([
      getUserMemory(discordUserId),
      supabase
        .from('knowledge_graph_entities')
        .select('name, entity_type')
        .eq('user_id', linkedUserId)
        .order('confidence', { ascending: false })
        .limit(10),
    ])

    const kgEntities = (kgData.data || []).map(e => `${e.name} (${e.entity_type})`).join(', ')
    const personalization = [memory, kgEntities ? `Known entities: ${kgEntities}` : ''].filter(Boolean).join('\n')

    const briefing = await callClaude(
      [{ role: 'user', content: `Generate a personalized daily briefing. Include:\n- Top 3-5 relevant developments\n- One actionable insight\n- A thought-provoking question\n\n${personalization ? `\nContext:\n${personalization}` : ''}` }],
      'Create a concise daily briefing. Discord markdown. Substantive, not fluff. Under 1500 chars.',
      'sonnet', 1500, { web_search: true }
    )

    const embed = makeEmbed({
      title: 'Daily Briefing',
      description: briefing,
      color: COLORS.kernel,
      footer: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    })

    await interaction.editReply({ embeds: [embed] })
    return
  }

  // ── /goal ──
  if (commandName === 'goal') {
    const sub = interaction.options.getSubcommand()
    const linkedUserId = await getLinkedUserId(discordUserId)

    if (!linkedUserId) {
      await interaction.reply({ content: 'Link your account first with `/link` to use goals.', ephemeral: true })
      return
    }

    if (sub === 'add') {
      const title = interaction.options.getString('title', true)
      const { error } = await supabase.from('user_goals').insert({
        user_id: linkedUserId,
        title,
        description: '',
        category: 'general',
        status: 'active',
        priority: 'medium',
        milestones: [],
        progress_notes: [],
        check_in_frequency: 'weekly',
      })
      if (error) {
        await interaction.reply({ content: 'Failed to add goal.', ephemeral: true })
      } else {
        await interaction.reply({ embeds: [makeEmbed({ description: `Goal added: **${title}**`, color: COLORS.kernel })] })
      }
      return
    }

    if (sub === 'list') {
      const { data } = await supabase
        .from('user_goals')
        .select('id, title, status, priority, progress_notes')
        .eq('user_id', linkedUserId)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (!data || data.length === 0) {
        await interaction.reply({ content: 'No active goals. Add one with `/goal add`.', ephemeral: true })
        return
      }

      const lines = data.map((g, i) => {
        const notes = g.progress_notes as any[] || []
        const lastNote = notes.length > 0 ? notes[notes.length - 1] : null
        const progress = lastNote?.progress ?? '?'
        const prio = g.priority === 'high' ? '🔴' : g.priority === 'medium' ? '🟡' : '🟢'
        return `${i + 1}. ${prio} **${g.title}** — ${progress}% \`${g.id.slice(0, 8)}\``
      })

      await interaction.reply({ embeds: [makeEmbed({
        title: 'Your Goals',
        description: lines.join('\n'),
        color: COLORS.kernel,
      })] })
      return
    }

    if (sub === 'done') {
      const goalId = interaction.options.getString('id', true)
      const { data } = await supabase
        .from('user_goals')
        .select('id, title')
        .eq('user_id', linkedUserId)
        .eq('status', 'active')
      const match = (data || []).find(g => g.id.startsWith(goalId))
      if (!match) {
        await interaction.reply({ content: 'Goal not found. Use `/goal list` to see IDs.', ephemeral: true })
        return
      }
      await supabase.from('user_goals').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', match.id)
      await interaction.reply({ embeds: [makeEmbed({ description: `Completed: **${match.title}**`, color: COLORS.kernel })] })
      return
    }

    if (sub === 'check') {
      await interaction.deferReply()
      const { data } = await supabase
        .from('user_goals')
        .select('title, progress_notes')
        .eq('user_id', linkedUserId)
        .eq('status', 'active')
        .limit(5)

      if (!data || data.length === 0) {
        await interaction.editReply('No active goals to check in on.')
        return
      }

      const goalsCtx = data.map(g => `- ${g.title}`).join('\n')
      const response = await callClaude(
        [{ role: 'user', content: `Check in on my goals:\n${goalsCtx}\n\nAsk how each is going and encourage me.` }],
        PERSONALITY, 'sonnet', 1024
      )
      await interaction.editReply(response)
      return
    }
  }

  // ── /share ──
  if (commandName === 'share') {
    const linkedUserId = await getLinkedUserId(discordUserId)
    if (!linkedUserId) {
      await interaction.reply({ content: 'Link your account first with `/link`.', ephemeral: true })
      return
    }

    const channelId = `discord_${interaction.channelId}`
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('agent_id, content, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!recentMsgs || recentMsgs.length === 0) {
      await interaction.reply({ content: 'No messages to share.', ephemeral: true })
      return
    }

    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
    const messages = recentMsgs.map(m => ({
      role: m.agent_id === 'user' ? 'user' : 'kernel',
      content: m.content,
      timestamp: m.created_at,
    }))

    const { error } = await supabase.from('shared_conversations').insert({
      id: shareId,
      user_id: linkedUserId,
      conversation_id: channelId,
      title: 'Discord conversation',
      messages,
      expires_at: null,
    })

    if (error) {
      await interaction.reply({ content: 'Failed to create share link.', ephemeral: true })
    } else {
      await interaction.reply({ embeds: [makeEmbed({
        description: `**Shared!** [View on kernel.chat](https://kernel.chat/#/shared/${shareId})`,
        color: COLORS.kernel,
      })] })
    }
    return
  }

  // ── /link ──
  if (commandName === 'link') {
    const userId = interaction.options.getString('user_id', true)
    if (userId.length < 10) {
      await interaction.reply({ content: 'That doesn\'t look like a valid user ID. Find yours in kernel.chat settings.', ephemeral: true })
      return
    }

    const linked = await linkDiscordUser(discordUserId, interaction.user.tag, userId)
    if (linked) {
      await interaction.reply({ embeds: [makeEmbed({
        description: 'Linked! Your Discord conversations will now sync to the web app.',
        color: COLORS.kernel,
      })] })
    } else {
      await interaction.reply({ content: 'Link failed — make sure your user ID is correct.', ephemeral: true })
    }
    return
  }

  // ── /unlink ──
  if (commandName === 'unlink') {
    await supabase.from('discord_user_links').delete().eq('discord_id', discordUserId)
    await interaction.reply({ content: 'Unlinked. Conversations will no longer sync.', ephemeral: true })
    return
  }
}

// ─── Button handler ──────────────────────────────────────────

async function handleButton(interaction: ButtonInteraction) {
  const [action] = interaction.customId.split('_')

  if (action === 'deeper') {
    await interaction.deferReply()

    // Get the original message content to go deeper on
    const originalMsg = interaction.message
    const content = originalMsg.content || ''
    if (!content) {
      await interaction.editReply('Nothing to go deeper on.')
      return
    }

    const deeper = await callClaude(
      [
        { role: 'assistant', content },
        { role: 'user', content: 'Go deeper on this. Explore nuances, counterarguments, implications I might not have considered. Be substantive.' },
      ],
      PERSONALITY, 'sonnet', 2048
    )

    const chunks = splitMessage(deeper)
    await interaction.editReply(chunks[0])
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp(chunks[i])
    }
    return
  }

  if (action === 'thread') {
    const channel = interaction.channel
    if (!channel || !interaction.inGuild()) {
      await interaction.reply({ content: 'Already in DMs.', ephemeral: true })
      return
    }

    try {
      const originalContent = interaction.message.content?.slice(0, 40) || 'Conversation'
      const thread = await (channel as TextChannel).threads.create({
        name: `${interaction.user.displayName} × Kernel — ${originalContent}`,
        autoArchiveDuration: 60,
        type: ChannelType.PrivateThread,
        reason: `Kernel thread from button by ${interaction.user.tag}`,
      })

      await thread.members.add(interaction.user.id)

      // Seed the thread with the message that spawned it
      if (interaction.message.content) {
        await thread.send(`> Continuing from:\n> ${interaction.message.content.slice(0, 300)}${interaction.message.content.length > 300 ? '...' : ''}\n\nWhat do you want to dig into?`)
      }

      await interaction.reply({ content: `Thread created: ${thread.toString()}`, ephemeral: true })
    } catch {
      await interaction.reply({ content: 'Couldn\'t create thread.', ephemeral: true })
    }
    return
  }
}

// ─── Core response generation ────────────────────────────────
// Shared between /ask, @mentions, DMs

async function generateResponse(
  content: string,
  discordUserId: string,
  context: { channel?: Message['channel'] | ChatInputCommandInteraction['channel'] },
): Promise<string> {
  const channelId = context.channel ? `discord_${('id' in context.channel ? context.channel.id : '')}` : `discord_dm_${discordUserId}`

  // Classification
  const history = await getChannelHistory(channelId, 10)
  const recentCtx = history.slice(-3).map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${(typeof m.content === 'string' ? m.content : '').slice(0, 150)}`).join('\n')
  const classification = await classifyIntent(content, recentCtx)
  const { agentId } = classification
  const specialist = SPECIALISTS[agentId] || SPECIALISTS.kernel

  // Pro check
  const isPro = await getUserSubscription(discordUserId)

  // Context assembly
  const [memory, collective] = await Promise.all([
    getUserMemory(discordUserId),
    getCollectiveInsights(),
  ])

  // Discord-unique context
  const channelCtx = context.channel ? getChannelContext(context.channel as Message['channel']) : ''
  const participantCtx = context.channel ? await getRecentParticipants(context.channel as Message['channel'], 15) : ''

  const systemPrompt = `${specialist.prompt}${memory}${collective}${channelCtx}${participantCtx}`

  const historyPart = sanitizeMessages(history.slice(-5))
  const safeMsgs: { role: string; content: string | ContentBlock[] }[] = [
    ...historyPart,
    { role: 'user', content },
  ]

  // Route
  let response: string
  if (classification.needsResearch && isPro) {
    response = await discordDeepResearch(content, memory, { sendTyping: async () => {} })
  } else if (classification.needsSwarm && isPro) {
    response = await discordRunSwarm(content, memory, history, { sendTyping: async () => {} })
  } else if (classification.isMultiStep && isPro) {
    response = await discordPlanAndExecute(content, memory, { sendTyping: async () => {} })
  } else {
    const useWebSearch = agentId === 'researcher'
    response = await callClaude(safeMsgs, systemPrompt, 'sonnet', 2048, { web_search: useWebSearch })
  }

  return response
}

// ═══════════════════════════════════════════════════════════════
//  BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
})

// ─── Ready ───────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log('─────────────────────────────────────────')
  console.log('  KERNEL DISCORD BOT')
  console.log(`  ${client.user?.tag}`)
  console.log(`  Servers: ${client.guilds.cache.size}`)
  console.log('─────────────────────────────────────────')

  // Register slash commands
  if (client.user) {
    await registerSlashCommands(client.user.id)
  }

  // Set presence
  client.user?.setPresence({
    activities: [{
      name: 'kernel.chat',
      type: ActivityType.Watching,
    }],
    status: 'online',
  })

  console.log('  Mode: @mention + DMs + threads')
  console.log('  Reactions: 🧠 perspective, 🔍 research')
  console.log('─────────────────────────────────────────')
})

// ─── Deduplication & rate limiting ───────────────────────────
const processing = new Set<string>()

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

// ─── Should Kernel respond to this message? ──────────────────
// Mention-only in servers. Always respond in DMs and threads Kernel is in.

function shouldRespond(msg: Message): boolean {
  // Always respond in DMs
  if (msg.channel.type === ChannelType.DM) return true

  // Always respond when @mentioned
  if (msg.mentions.has(client.user!.id)) return true

  // Respond in threads where Kernel is a participant
  if (msg.channel.isThread()) {
    // If the thread was created by Kernel, or Kernel has sent messages in it
    const thread = msg.channel as ThreadChannel
    if (thread.ownerId === client.user!.id) return true
    // Check if Kernel is a member of this thread
    if (thread.members.cache.has(client.user!.id)) return true
  }

  // Don't respond to general channel messages
  return false
}

// ─── Message handler ─────────────────────────────────────────
client.on('messageCreate', async (msg: Message) => {
  if (msg.author.bot) return
  if (!shouldRespond(msg)) return

  // Ensure the channel supports sending messages
  const ch = msg.channel
  if (!('send' in ch) || typeof ch.send !== 'function') return

  const lockKey = `${msg.channelId}_${msg.author.id}`
  if (processing.has(lockKey)) return
  processing.add(lockKey)

  try {
    if ('sendTyping' in ch) await (ch as TextChannel).sendTyping()

    // Clean message (remove bot mention)
    const content = msg.content
      .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
      .trim()

    const attachments = [...msg.attachments.values()]

    if (!content && attachments.length === 0) {
      await msg.reply("What's up?")
      return
    }

    const discordUserId = `discord_${msg.author.id}`

    // Rate limit
    const { allowed } = checkDiscordRateLimit(discordUserId)
    if (!allowed) {
      await msg.reply({
        embeds: [makeEmbed({
          description: `Daily limit hit (${DISCORD_DAILY_LIMIT} messages). Use the web app at [kernel.chat](https://kernel.chat) or try again tomorrow.`,
          color: COLORS.info,
        })],
      })
      return
    }

    // Linked user
    const linkedUserId = await getLinkedUserId(discordUserId)

    // Conversation record
    const channelId = await getOrCreateConversation(msg.channelId, linkedUserId, content)

    // Get history BEFORE saving current message
    const history = await getChannelHistory(channelId, 10)

    // Process attachments
    const contentBlocks: ContentBlock[] = []
    let textPrefix = ''

    for (const att of attachments) {
      try {
        const ct = att.contentType || ''
        const name = att.name || 'file'

        if (isImageType(ct)) {
          const buf = await downloadAttachment(att.url)
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: ct.split(';')[0], data: buf.toString('base64') },
          })
        } else if (ct === PDF_TYPE) {
          const buf = await downloadAttachment(att.url)
          contentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') },
          })
        } else if (isTextFile(name)) {
          const buf = await downloadAttachment(att.url)
          textPrefix += `[File: ${name}]\n${buf.toString('utf-8')}\n\n`
        } else {
          textPrefix += `[Attached: ${name} (${ct || 'unknown'})]\n`
        }
      } catch {
        textPrefix += `[Failed to read: ${att.name}]\n`
      }
    }

    const textContent = (textPrefix + content).trim() || `[Attached: ${attachments.map(a => a.name).join(', ')}]`
    let userContent: string | ContentBlock[]
    if (contentBlocks.length > 0) {
      contentBlocks.push({ type: 'text', text: textContent })
      userContent = contentBlocks
    } else {
      userContent = textContent
    }

    // Save user message
    const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    await saveMessage({
      id: userMsgId,
      channel_id: channelId,
      agent_id: 'user',
      content: textContent,
      user_id: linkedUserId || undefined,
    })

    if (linkedUserId) {
      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', channelId)
    }

    // Classification
    const recentCtx = history.slice(-3).map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${(typeof m.content === 'string' ? m.content : '').slice(0, 150)}`).join('\n')
    const classification = await classifyIntent(textContent, recentCtx)
    const { agentId } = classification
    const specialist = SPECIALISTS[agentId] || SPECIALISTS.kernel

    if ('sendTyping' in ch) await (ch as TextChannel).sendTyping()

    // Pro check
    const isPro = await getUserSubscription(discordUserId)

    // Build system prompt with all context layers
    const [memory, collective] = await Promise.all([
      getUserMemory(discordUserId),
      getCollectiveInsights(),
    ])

    // Discord-unique: channel context + multi-user awareness
    const channelCtx = getChannelContext(msg.channel)
    const participantCtx = await getRecentParticipants(msg.channel, 15)

    // Add the sender's name so Kernel knows who it's talking to
    const senderName = msg.member?.displayName || msg.author.displayName || msg.author.username
    const senderCtx = `\n\nYou're currently talking to **${senderName}**.`

    const systemPrompt = `${specialist.prompt}${memory}${collective}${channelCtx}${participantCtx}${senderCtx}`

    const historyPart = sanitizeMessages(history.slice(-5))
    const safeMsgs: { role: string; content: string | ContentBlock[] }[] = [
      ...historyPart,
      { role: 'user', content: userContent },
    ]

    // Route to pipeline
    const sendTypingFn = async () => { if ('sendTyping' in ch) await (ch as TextChannel).sendTyping() }
    let response: string
    if (classification.needsResearch && isPro) {
      await sendTypingFn()
      response = await discordDeepResearch(textContent, memory, { sendTyping: sendTypingFn })
    } else if (classification.needsSwarm && isPro) {
      await sendTypingFn()
      response = await discordRunSwarm(textContent, memory, history, { sendTyping: sendTypingFn })
    } else if (classification.isMultiStep && isPro) {
      await sendTypingFn()
      response = await discordPlanAndExecute(textContent, memory, { sendTyping: sendTypingFn })
    } else {
      const useWebSearch = agentId === 'researcher'
      response = await callClaude(safeMsgs, systemPrompt, 'sonnet', 2048, { web_search: useWebSearch })
    }

    // Save response
    const kernelMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    await saveMessage({
      id: kernelMsgId,
      channel_id: channelId,
      agent_id: agentId,
      content: response,
      user_id: linkedUserId || undefined,
    })

    // Send with buttons
    const chunks = splitMessage(response)
    const buttons = makeResponseButtons(kernelMsgId.slice(-8))

    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        await msg.reply({ content: chunks[i], components: i === chunks.length - 1 ? [buttons] : [] })
      } else if (i === chunks.length - 1) {
        await msg.channel.send({ content: chunks[i], components: [buttons] })
      } else {
        await msg.channel.send(chunks[i])
      }
    }

    // Log
    const tag = specialist.name !== 'Kernel' ? ` [${specialist.name}]` : ''
    console.log(`[${new Date().toLocaleTimeString()}]${tag} ${msg.author.tag}: ${content.slice(0, 60)}...`)

    // Background learning
    const count = (userMsgCounts.get(discordUserId) || 0) + 1
    userMsgCounts.set(discordUserId, count)

    if (count % MEMORY_EXTRACT_INTERVAL === 0) {
      extractAndSaveMemory(discordUserId, channelId).catch(() => {})
      if (linkedUserId) {
        extractAndSaveKG(linkedUserId, channelId).catch(() => {})
      }
    }

    saveResponseSignal(channelId, content).catch(() => {})

  } catch (err: any) {
    console.error('[Bot] Error:', err)
    try {
      if (err?.message === 'RATE_LIMITED') {
        await msg.reply("Getting a lot of traffic right now. Give me a minute.")
      } else {
        await msg.reply("Something went wrong. Try again in a sec.")
      }
    } catch {
      // Connection issue
    }
  } finally {
    processing.delete(lockKey)
  }
})

// ─── Interaction handler (slash commands + buttons) ──────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction)
  } else if (interaction.isButton()) {
    await handleButton(interaction)
  }
})

// ─── Reaction handler ────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  // Fetch partials if needed
  if (reaction.partial) {
    try { await reaction.fetch() } catch { return }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch() } catch { return }
  }

  await handleReaction(reaction as MessageReaction, user as User)
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
