// ─── BriefingGenerator ───────────────────────────────────
//
// Generates personalized daily briefings using DeepResearch pipeline.
// Reads user interests from KG entities and user_memory.

import { getProvider } from './providers/registry'
import type { KGEntity } from './KnowledgeGraph'
import type { UserMemoryProfile } from './MemoryAgent'

export interface Briefing {
  id?: string
  user_id: string
  title: string
  content: string
  topics: string[]
  sources: { url?: string; title: string }[]
  read_at: string | null
  created_at?: string
}

const QUERY_PLAN_SYSTEM = `You are a news briefing planner. Given a user's interests and knowledge graph entities, generate 3-5 focused web search queries that will produce a relevant morning briefing.

Focus on:
- Recent developments in their interest areas
- Updates related to entities they track (companies, projects, people)
- Practical, actionable information

Respond with ONLY valid JSON:
{"queries": ["query 1", "query 2", "query 3"], "topics": ["topic1", "topic2"]}`

const SYNTHESIZE_SYSTEM = `You are Kernel's briefing mode. Create a concise, engaging morning briefing from the search results below.

Format:
- Start with a warm, brief greeting
- Group findings by topic/theme
- Lead each section with the most important development
- Include specific facts, numbers, dates
- Keep it scannable — short paragraphs, bold key points
- End with 1-2 actionable takeaways

Write in Kernel's voice: warm, sharp, concise. Use markdown formatting.
Target length: 400-600 words.`

interface QueryPlan {
  queries: string[]
  topics: string[]
}

/** Build interest context from user memory and KG entities */
function buildInterestContext(
  memory: UserMemoryProfile | null,
  entities: KGEntity[],
): string {
  const parts: string[] = []

  if (memory) {
    if (memory.interests.length > 0) {
      parts.push(`Interests: ${memory.interests.join(', ')}`)
    }
    if (memory.goals.length > 0) {
      parts.push(`Goals: ${memory.goals.join(', ')}`)
    }
  }

  const topEntities = entities
    .filter(e => e.mention_count >= 2)
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 10)

  if (topEntities.length > 0) {
    const entityList = topEntities
      .map(e => `${e.name} (${e.entity_type})`)
      .join(', ')
    parts.push(`Key entities: ${entityList}`)
  }

  return parts.join('\n') || 'General technology and current events'
}

/** Execute a search query and return the finding */
async function executeSearch(query: string): Promise<string> {
  let finding = ''
  try {
    await getProvider().streamChat(
      [{ role: 'user', content: query }],
      (text) => { finding = text },
      {
        system: 'You are a research assistant. Search for the answer and provide a concise summary with specific facts.',
        tier: 'fast',
        max_tokens: 600,
        web_search: true,
      }
    )
    return finding ? `**${query}**\n${finding}` : ''
  } catch {
    return ''
  }
}

/** Generate a briefing for a user */
export async function generateBriefing(
  userId: string,
  memory: UserMemoryProfile | null,
  entities: KGEntity[],
  onProgress?: (phase: string) => void,
): Promise<Omit<Briefing, 'id' | 'created_at'>> {
  onProgress?.('planning')

  const interestContext = buildInterestContext(memory, entities)

  // Plan search queries
  let plan: QueryPlan
  try {
    plan = await getProvider().json<QueryPlan>(
      `Generate a morning briefing plan for this user:\n\n${interestContext}`,
      { system: QUERY_PLAN_SYSTEM, tier: 'fast', max_tokens: 300 }
    )
  } catch {
    plan = {
      queries: ['latest technology news today', 'AI developments this week', 'business news highlights'],
      topics: ['Technology', 'AI', 'Business'],
    }
  }

  const queries = (plan.queries || []).slice(0, 5)
  const topics = plan.topics || []

  // Execute searches in parallel
  onProgress?.('searching')
  const results = await Promise.allSettled(queries.map(q => executeSearch(q)))
  const findings = results
    .map(r => r.status === 'fulfilled' ? r.value : '')
    .filter(Boolean)

  if (findings.length === 0) {
    return {
      user_id: userId,
      title: `Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      content: 'Unable to generate briefing at this time. Please try again later.',
      topics: [],
      sources: [],
      read_at: null,
    }
  }

  // Synthesize
  onProgress?.('synthesizing')
  let content = ''
  await getProvider().streamChat(
    [
      {
        role: 'user',
        content: `User interests:\n${interestContext}\n\n## Research Findings\n\n${findings.join('\n\n---\n\n')}\n\nCreate a morning briefing from these findings.`,
      },
    ],
    (text) => { content = text },
    { system: SYNTHESIZE_SYSTEM, tier: 'strong', max_tokens: 1500 }
  )

  const title = `Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`

  // Don't expose raw search queries as sources — only include entries with actual URLs
  return {
    user_id: userId,
    title,
    content,
    topics,
    sources: [],
    read_at: null,
  }
}
