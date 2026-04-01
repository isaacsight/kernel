// kbot Dream Tools — Agent-accessible memory consolidation
//
// Exposes the dream engine to kbot's tool system so agents can:
//   - Trigger consolidation on demand
//   - Query the dream journal for insights
//   - Check dream system status
//   - Search dreams by keyword
//   - Reinforce insights that are still relevant

import { registerTool } from './index.js'
import { dream, getDreamStatus, getDreamPrompt, searchDreams, reinforceInsight } from '../dream.js'

export function registerDreamTools(): void {

// ── dream_now ──
// Trigger a full dream cycle: consolidate, reinforce, age

registerTool({
  name: 'dream_now',
  description: 'Run a dream cycle — consolidate session memories into durable insights using local AI. Ages old memories, extracts new patterns, reinforces confirmed knowledge. Uses Ollama ($0 cost). Call this at session end or when the user says "dream" or "consolidate".',
  parameters: {
    session_id: {
      type: 'string',
      description: 'Session ID to consolidate (default: "default")',
      required: false,
      default: 'default',
    },
  },
  tier: 'free',
  timeout: 120_000, // 2 min — Ollama can be slow on first run
  execute: async (args) => {
    const sessionId = (args.session_id as string) || 'default'
    const result = await dream(sessionId)

    if (!result.success && result.error) {
      return `Dream cycle (partial): ${result.error}\n` +
        `Archived: ${result.archived} aged-out insights\n` +
        `Duration: ${result.duration}ms`
    }

    const lines = [
      `Dream cycle #${result.cycle} complete`,
      `  New insights: ${result.newInsights}`,
      `  Reinforced: ${result.reinforced} existing insights`,
      `  Archived: ${result.archived} aged-out insights`,
      `  Duration: ${result.duration}ms`,
    ]

    if (result.newInsights === 0) {
      lines.push('  (Session may have been too short or trivial for new insights)')
    }

    return lines.join('\n')
  },
})

// ── dream_status ──
// Check the dream system's current state

registerTool({
  name: 'dream_status',
  description: 'Show dream engine status — cycle count, active insights, archive size, last dream timestamp. Use this to check if the dream system is healthy and working.',
  parameters: {},
  tier: 'free',
  execute: async () => {
    const { state, insights, archiveCount } = getDreamStatus()

    const categoryBreakdown: Record<string, number> = {}
    for (const i of insights) {
      categoryBreakdown[i.category] = (categoryBreakdown[i.category] || 0) + 1
    }

    const avgRelevance = insights.length > 0
      ? Math.round(insights.reduce((sum, i) => sum + i.relevance, 0) / insights.length * 100)
      : 0

    const lines = [
      'Dream Engine Status',
      '═══════════════════',
      `Cycles completed: ${state.cycles}`,
      `Last dream: ${state.lastDream || 'never'}`,
      `Active insights: ${state.activeInsights}`,
      `Total created: ${state.totalInsights}`,
      `Total archived: ${state.totalArchived}`,
      `Archive files: ${archiveCount}`,
      `Average relevance: ${avgRelevance}%`,
      '',
      'Category breakdown:',
      ...Object.entries(categoryBreakdown).map(([cat, count]) => `  ${cat}: ${count}`),
    ]

    if (insights.length > 0) {
      lines.push('', 'Top 5 insights:')
      for (const i of insights.slice(0, 5)) {
        lines.push(`  [${Math.round(i.relevance * 100)}%] [${i.category}] ${i.content}`)
      }
    }

    return lines.join('\n')
  },
})

// ── dream_journal ──
// Get dream insights formatted for system prompt injection

registerTool({
  name: 'dream_journal',
  description: 'Retrieve the dream journal — consolidated insights from past sessions, ranked by relevance. Use this to understand accumulated knowledge about the user and their projects.',
  parameters: {
    max_insights: {
      type: 'number',
      description: 'Maximum insights to return (default: 15)',
      required: false,
      default: 15,
    },
  },
  tier: 'free',
  execute: async (args) => {
    const max = (args.max_insights as number) || 15
    const prompt = getDreamPrompt(max)
    return prompt || 'Dream journal is empty — no consolidation cycles have run yet. Use dream_now to start.'
  },
})

// ── dream_search ──
// Search dreams by keyword

registerTool({
  name: 'dream_search',
  description: 'Search dream insights by keyword. Returns matching insights sorted by relevance.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query (keywords)',
      required: true,
    },
  },
  tier: 'free',
  execute: async (args) => {
    const query = args.query as string
    if (!query) return 'Error: query is required'

    const results = searchDreams(query)
    if (results.length === 0) return `No dream insights match "${query}"`

    const lines = [`Dream search: "${query}" — ${results.length} results`, '']
    for (const i of results.slice(0, 10)) {
      lines.push(`[${i.id}] [${Math.round(i.relevance * 100)}%] [${i.category}] ${i.content}`)
      lines.push(`  Keywords: ${i.keywords.join(', ')} | Sessions: ${i.sessions} | Created: ${i.created.split('T')[0]}`)
    }

    return lines.join('\n')
  },
})

// ── dream_reinforce ──
// Manually boost an insight's relevance

registerTool({
  name: 'dream_reinforce',
  description: 'Reinforce a dream insight — boost its relevance when the user confirms it is still accurate/useful. Prevents important insights from aging out.',
  parameters: {
    insight_id: {
      type: 'string',
      description: 'The dream insight ID to reinforce',
      required: true,
    },
  },
  tier: 'free',
  execute: async (args) => {
    const id = args.insight_id as string
    if (!id) return 'Error: insight_id is required'

    const success = reinforceInsight(id)
    return success
      ? `Reinforced insight ${id} — relevance boosted, decay clock reset.`
      : `Insight ${id} not found.`
  },
})

} // end registerDreamTools
