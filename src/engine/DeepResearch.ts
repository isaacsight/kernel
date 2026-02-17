// DeepResearch — Multi-turn research orchestrator with self-correcting retrieval
// Plan (haiku) → Search (parallel) → Grade → [Reformulate if low] → Synthesize (sonnet)

import { getProvider } from './providers/registry'

export interface ResearchProgress {
  phase: 'planning' | 'searching' | 'grading' | 'reformulating' | 'synthesizing' | 'complete'
  totalQueries: number
  completedQueries: number
  currentQuery?: string
  findings: string[]
  confidence?: number
}

interface ResearchPlan {
  queries: string[]
}

interface RelevanceGrade {
  score: number
  gaps: string[]
}

interface ReformulationResult {
  queries: string[]
}

const PLAN_SYSTEM = `You are a research planner. Given a question, generate 3-5 focused web search queries that would thoroughly answer it. Each query should target a different aspect of the question.

Respond with ONLY valid JSON:
{"queries": ["query 1", "query 2", "query 3"]}`

const SEARCH_SYSTEM = `You are a research assistant. You have access to web search. Search for the answer to the given query and provide a concise summary of what you find. Include specific facts, numbers, dates, and source names. Be thorough but concise — aim for 2-4 paragraphs of findings.`

const GRADE_SYSTEM = `You are a relevance grading agent. Given an original research question and a search result, evaluate how relevant and useful the result is for answering the question.

Score from 0.0 to 1.0:
- 0.0-0.3: Irrelevant or off-topic
- 0.3-0.6: Partially relevant, missing key information
- 0.6-0.8: Good, covers main points
- 0.8-1.0: Excellent, directly addresses the question with specifics

Also identify gaps — what important information is still missing?

Respond with ONLY valid JSON:
{"score": 0.5, "gaps": ["missing detail 1", "missing detail 2"]}`

const REFORMULATE_SYSTEM = `You are a search query reformulation agent. The previous search didn't fully answer the question. Based on the identified gaps, generate 1-2 follow-up search queries that target the missing information.

Respond with ONLY valid JSON:
{"queries": ["follow-up query 1"]}`

const SYNTHESIZE_SYSTEM = `You are the Kernel's research mode. You've just completed deep research on a topic. Below are findings from multiple search queries.

Synthesize these findings into a comprehensive, well-structured response:
- Lead with the key answer or insight
- Organize by theme, not by search query
- Include specific facts, data points, and source attributions
- Note conflicting information or areas of uncertainty
- End with a brief synthesis of what this means

Write in the Kernel's voice: warm, sharp, real. Short paragraphs. Let the whitespace breathe.`

// ─── Relevance Grading ──────────────────────────────────────

async function gradeRelevance(
  query: string,
  result: string,
  originalQuestion: string,
): Promise<RelevanceGrade> {
  try {
    return await getProvider().json<RelevanceGrade>(
      `Original question: ${originalQuestion}\n\nSearch query: ${query}\n\nSearch result:\n${result}\n\nGrade the relevance of this result.`,
      { system: GRADE_SYSTEM, tier: 'fast', max_tokens: 200 }
    )
  } catch {
    return { score: 0.5, gaps: [] }
  }
}

// ─── Query Reformulation ────────────────────────────────────

async function reformulateQueries(
  originalQuestion: string,
  gaps: string[],
  previousResults: string[],
): Promise<string[]> {
  if (gaps.length === 0) return []

  try {
    const result = await getProvider().json<ReformulationResult>(
      `Original question: ${originalQuestion}\n\nGaps identified: ${gaps.join('; ')}\n\nPrevious findings covered: ${previousResults.slice(0, 3).map(r => r.slice(0, 200)).join('\n---\n')}\n\nGenerate follow-up queries to fill these gaps.`,
      { system: REFORMULATE_SYSTEM, tier: 'fast', max_tokens: 200 }
    )
    return (result.queries || []).slice(0, 2)
  } catch {
    return []
  }
}

// ─── Search Execution ───────────────────────────────────────

async function executeSearch(query: string): Promise<string> {
  let finding = ''
  try {
    await getProvider().streamChat(
      [{ role: 'user', content: query }],
      (text) => { finding = text },
      { system: SEARCH_SYSTEM, tier: 'fast', max_tokens: 800, web_search: true }
    )
    return finding ? `**Query: ${query}**\n${finding}` : `**Query: ${query}**\nNo results found.`
  } catch {
    return `**Query: ${query}**\nSearch failed for this query.`
  }
}

// ─── Main Pipeline ──────────────────────────────────────────

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

  // Step 1: Plan search queries
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

  // Steps 2+3: Execute searches and grade in parallel
  // Each finding is graded immediately as its search completes,
  // overlapping the two phases instead of running them sequentially
  progress.findings = new Array(queries.length).fill('')
  onProgress({ ...progress })

  let allGaps: string[] = []
  let totalScore = 0
  let gradeCount = 0
  const gradePromises: Promise<void>[] = []

  await Promise.allSettled(queries.map(async (query, i) => {
    const finding = await executeSearch(query)
    progress.findings[i] = finding
    progress.completedQueries++
    progress.currentQuery = query
    onProgress({ ...progress })

    // Start grading immediately — don't wait for other searches
    if (finding) {
      const gradePromise = gradeRelevance(
        finding.split('\n')[0].replace('**Query: ', '').replace('**', ''),
        finding,
        question
      ).then(grade => {
        totalScore += grade.score
        gradeCount++
        if (grade.score < 0.4) {
          allGaps.push(...grade.gaps)
        }
      }).catch(() => {
        // Grade failure — use neutral score
        totalScore += 0.5
        gradeCount++
      })
      gradePromises.push(gradePromise)
    }
  }))

  // Wait for any remaining grades (most will already be done)
  progress.phase = 'grading'
  progress.currentQuery = undefined
  onProgress({ ...progress })

  await Promise.allSettled(gradePromises)

  const avgScore = gradeCount > 0 ? totalScore / gradeCount : 0.5

  // Step 4: Reformulate if average relevance is low
  if (avgScore < 0.5 && allGaps.length > 0) {
    progress.phase = 'reformulating'
    onProgress({ ...progress })

    const followUpQueries = await reformulateQueries(question, allGaps, progress.findings.filter(Boolean))

    if (followUpQueries.length > 0) {
      progress.totalQueries += followUpQueries.length
      onProgress({ ...progress })

      // Execute follow-up searches
      await Promise.allSettled(followUpQueries.map(async (query) => {
        const result = await executeSearch(query)
        progress.findings.push(result)
        progress.completedQueries++
        progress.currentQuery = query
        onProgress({ ...progress })
      }))
    }
  }

  // Step 5: Synthesize findings
  progress.phase = 'synthesizing'
  progress.currentQuery = undefined
  progress.confidence = avgScore
  onProgress({ ...progress })

  const findingsText = progress.findings.filter(Boolean).join('\n\n---\n\n')
  const synthesisContext = userContext
    ? `User context: ${userContext}\n\n`
    : ''

  const confidenceNote = avgScore < 0.5
    ? '\n\nNote: Research confidence is low — some findings may be incomplete or tangential. Flag this to the user.'
    : ''

  const result = await getProvider().streamChat(
    [
      {
        role: 'user',
        content: `${synthesisContext}Original question: ${question}\n\n## Research Findings\n\n${findingsText}${confidenceNote}\n\nSynthesize these findings into a comprehensive response.`,
      },
    ],
    onStream,
    { system: SYNTHESIZE_SYSTEM, tier: 'strong', max_tokens: 2048 }
  )

  progress.phase = 'complete'
  progress.confidence = avgScore
  onProgress({ ...progress })

  return result
}
