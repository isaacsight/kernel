// ─── Tool RAG — Dynamic Tool Selection ──────────────────────
//
// As tools grow beyond 10, loading all schemas into every LLM call
// wastes tokens and confuses the model. This module selects only
// the most relevant tools per query.

import type { Tool } from './types'

const DEFAULT_MAX_TOOLS = 4

export function selectTools(
  input: string,
  agentId: string,
  allTools: Tool[],
  agentPerformance?: Record<string, { uses: number; avgQuality: number }>,
  maxTools: number = DEFAULT_MAX_TOOLS,
): Tool[] {
  if (allTools.length <= maxTools) return allTools

  const scored: { tool: Tool; score: number }[] = []
  const inputLower = input.toLowerCase()
  const inputWords = new Set(inputLower.split(/\s+/).filter(w => w.length > 2))

  for (const tool of allTools) {
    let score = 0

    // 1. Agent whitelist — tool must be available to this agent
    if (tool.agents && tool.agents.length > 0 && !tool.agents.includes(agentId)) {
      continue // Skip tools not available to this agent
    }

    // 2. Agent-specific boost — tools whitelisted for this agent get +3
    if (tool.agents?.includes(agentId)) {
      score += 3
    }

    // 3. Keyword matching — check tool keywords against input
    if (tool.keywords) {
      for (const keyword of tool.keywords) {
        if (inputLower.includes(keyword.toLowerCase())) {
          score += 2
        }
      }
    }

    // 4. Description matching — check tool description against input words
    const descLower = tool.description.toLowerCase()
    for (const word of inputWords) {
      if (descLower.includes(word)) {
        score += 0.5
      }
    }

    // 5. Tool name matching
    if (inputLower.includes(tool.name.toLowerCase())) {
      score += 3
    }

    // 6. Usage history — tools that performed well get priority
    if (agentPerformance) {
      const perf = agentPerformance[agentId]
      if (perf && perf.avgQuality > 0.7) {
        score += 1 // Agent performs well generally, trust its tool needs
      }
    }

    // 7. Category relevance
    if (tool.category) {
      // Search tools get boosted for question-like inputs
      if (tool.category === 'search' && (inputLower.includes('?') || inputLower.startsWith('what') || inputLower.startsWith('how') || inputLower.startsWith('why'))) {
        score += 1.5
      }
      // Compute tools for math/analysis
      if (tool.category === 'compute' && /\d/.test(input)) {
        score += 1
      }
      // Memory tools for recall
      if (tool.category === 'memory' && (inputLower.includes('remember') || inputLower.includes('recall') || inputLower.includes('last time'))) {
        score += 2
      }
    }

    scored.push({ tool, score })
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxTools).map(s => s.tool)
}
