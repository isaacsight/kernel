// DeepResearch — Multi-turn research orchestrator
// Plan (haiku) → Search (haiku + web_search) → Synthesize (sonnet, streamed)

import { getProvider } from './providers/registry'

export interface ResearchProgress {
  phase: 'planning' | 'searching' | 'synthesizing' | 'complete'
  totalQueries: number
  completedQueries: number
  currentQuery?: string
  findings: string[]
}

interface ResearchPlan {
  queries: string[]
}

const PLAN_SYSTEM = `You are a research planner. Given a question, generate 3-5 focused web search queries that would thoroughly answer it. Each query should target a different aspect of the question.

Respond with ONLY valid JSON:
{"queries": ["query 1", "query 2", "query 3"]}`

const SEARCH_SYSTEM = `You are a research assistant. You have access to web search. Search for the answer to the given query and provide a concise summary of what you find. Include specific facts, numbers, dates, and source names. Be thorough but concise — aim for 2-4 paragraphs of findings.`

const SYNTHESIZE_SYSTEM = `You are the Kernel's research mode. You've just completed deep research on a topic. Below are findings from multiple search queries.

Synthesize these findings into a comprehensive, well-structured response:
- Lead with the key answer or insight
- Organize by theme, not by search query
- Include specific facts, data points, and source attributions
- Note conflicting information or areas of uncertainty
- End with a brief synthesis of what this means

Write in the Kernel's voice: warm, sharp, real. Short paragraphs. Let the whitespace breathe.`

export async function deepResearch(
  question: string,
  userContext: string,
  onProgress: (progress: ResearchProgress) => void,
  onStream: (text: string) => void
): Promise<string> {
  const progress: ResearchProgress = {
    phase: 'planning',
    totalQueries: 0,
    completedQueries: 0,
    findings: [],
  }
  onProgress({ ...progress })

  // Step 1: Plan search queries (fall back to raw question if planning fails)
  let queries: string[]
  try {
    const plan = await getProvider().json<ResearchPlan>(
      `Research question: ${question}`,
      { system: PLAN_SYSTEM, tier: 'fast', max_tokens: 300 }
    )
    queries = (plan.queries || []).slice(0, 5)
    if (queries.length === 0) queries = [question]
  } catch {
    queries = [question]
  }

  progress.phase = 'searching'
  progress.totalQueries = queries.length
  onProgress({ ...progress })

  // Step 2: Execute searches in parallel (each uses web_search)
  progress.findings = new Array(queries.length).fill('')
  onProgress({ ...progress })

  await Promise.allSettled(queries.map(async (query, i) => {
    let finding = ''
    try {
      await getProvider().streamChat(
        [{ role: 'user', content: query }],
        (text) => { finding = text },
        { system: SEARCH_SYSTEM, tier: 'fast', max_tokens: 800, web_search: true }
      )
      progress.findings[i] = finding ? `**Query: ${query}**\n${finding}` : ''
    } catch {
      progress.findings[i] = `**Query: ${query}**\nSearch failed for this query.`
    }
    progress.completedQueries++
    progress.currentQuery = query
    onProgress({ ...progress })
  }))

  // Step 3: Synthesize findings into final response
  progress.phase = 'synthesizing'
  progress.currentQuery = undefined
  onProgress({ ...progress })

  const findingsText = progress.findings.filter(Boolean).join('\n\n---\n\n')
  const synthesisContext = userContext
    ? `User context: ${userContext}\n\n`
    : ''

  const result = await getProvider().streamChat(
    [
      {
        role: 'user',
        content: `${synthesisContext}Original question: ${question}\n\n## Research Findings\n\n${findingsText}\n\nSynthesize these findings into a comprehensive response.`,
      },
    ],
    onStream,
    { system: SYNTHESIZE_SYSTEM, tier: 'strong', max_tokens: 2048 }
  )

  progress.phase = 'complete'
  onProgress({ ...progress })

  return result
}
