// SwarmOrchestrator — Multi-agent parallel collaboration
// Select agents → Parallel contributions (haiku) → Synthesize (sonnet, streamed)

import { claudeText, claudeJSON, claudeStreamChat } from './ClaudeClient'
import { SPECIALISTS } from '../agents/specialists'
import { SWARM_AGENTS } from '../agents/swarm'

// ── Unified agent pool ────────────────────────────────

interface SwarmAgent {
  id: string
  name: string
  icon: string
  systemPrompt: string
}

// Specialists + select swarm agents that add unique value
const AGENT_POOL: SwarmAgent[] = [
  ...Object.values(SPECIALISTS).map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    systemPrompt: s.systemPrompt,
  })),
  // Swarm agents that complement specialists
  ...(
    SWARM_AGENTS
      .filter(a => ['reasoner', 'critic', 'architect'].includes(a.id))
      .map(a => ({
        id: `swarm:${a.id}`,
        name: a.name,
        icon: a.avatar,
        systemPrompt: a.systemPrompt,
      }))
  ),
]

const AGENT_DESCRIPTIONS = AGENT_POOL
  .map(a => `- ${a.id}: ${a.name}`)
  .join('\n')

// ── Types ─────────────────────────────────────────────

export interface SwarmAgentStatus {
  id: string
  name: string
  icon: string
  status: 'pending' | 'working' | 'done'
}

export interface SwarmProgress {
  phase: 'selecting' | 'collaborating' | 'synthesizing' | 'complete'
  agents: SwarmAgentStatus[]
}

// ── Agent Selection ───────────────────────────────────

const SELECT_SYSTEM = `You are a swarm coordinator. Given a user's message, select 2-4 agents who should collaborate on this response. Each brings a different perspective.

Available agents:
${AGENT_DESCRIPTIONS}

Selection guidelines:
- Pick agents whose expertise complements each other
- "kernel" is the generalist — include when the query is personal or needs warmth
- "researcher" when facts or current events matter
- "analyst" for strategic/evaluative thinking
- "swarm:reasoner" for chain-of-thought deep analysis
- "swarm:critic" for reviewing ideas, finding flaws, edge cases
- "swarm:architect" for designing solutions or scoping projects
- "coder" for technical/programming aspects
- "writer" for content creation or communication
- 2 agents for focused queries, 3-4 for complex multi-domain questions

Respond with ONLY valid JSON:
{"agents": ["kernel", "analyst"], "focus": "what the synthesis should prioritize"}`

async function selectAgents(
  message: string,
  recentContext: string
): Promise<{ agents: SwarmAgent[]; focus: string }> {
  try {
    const result = await claudeJSON<{ agents: string[]; focus: string }>(
      recentContext
        ? `Recent conversation:\n${recentContext}\n\nUser message: ${message}`
        : `User message: ${message}`,
      { system: SELECT_SYSTEM, model: 'haiku', max_tokens: 200 }
    )

    const ids = (result.agents || []).slice(0, 4)
    const agents = ids
      .map(id => AGENT_POOL.find(a => a.id === id))
      .filter((a): a is SwarmAgent => a !== undefined)

    // Ensure at least 2 agents
    if (agents.length < 2) {
      const kernel = AGENT_POOL.find(a => a.id === 'kernel')!
      const analyst = AGENT_POOL.find(a => a.id === 'analyst')!
      return { agents: [kernel, analyst], focus: result.focus || 'comprehensive answer' }
    }

    return { agents, focus: result.focus || 'comprehensive answer' }
  } catch {
    const kernel = AGENT_POOL.find(a => a.id === 'kernel')!
    const analyst = AGENT_POOL.find(a => a.id === 'analyst')!
    return { agents: [kernel, analyst], focus: 'comprehensive answer' }
  }
}

// ── Parallel Execution ────────────────────────────────

async function getContributions(
  agents: SwarmAgent[],
  message: string,
  userMemoryContext: string,
  onProgress: (progress: SwarmProgress) => void,
  progress: SwarmProgress
): Promise<{ name: string; contribution: string }[]> {
  const results = await Promise.all(
    agents.map(async (agent, i) => {
      try {
        const system = userMemoryContext
          ? `${agent.systemPrompt}\n\n---\n\nUser context:\n${userMemoryContext}`
          : agent.systemPrompt

        const contribution = await claudeText(
          `${message}\n\nProvide your focused perspective in 2-3 concise paragraphs. Be specific and actionable.`,
          {
            system,
            model: 'haiku',
            max_tokens: 600,
            web_search: agent.id === 'researcher',
          }
        )

        progress.agents[i].status = 'done'
        onProgress({ ...progress })
        return { name: agent.name, contribution }
      } catch (err) {
        console.warn(`[Swarm] ${agent.name} failed:`, err)
        progress.agents[i].status = 'done'
        onProgress({ ...progress })
        return { name: agent.name, contribution: '' }
      }
    })
  )

  return results.filter(r => r.contribution)
}

// ── Synthesis ─────────────────────────────────────────

const SYNTH_SYSTEM = `You are the Kernel — synthesizing insights from multiple specialist agents into one cohesive response.

Your voice: Warm, sharp, real. Like a brilliant friend who actually listens. Short paragraphs. Let the whitespace breathe.

Rules:
- Do NOT attribute individual agents ("The Analyst says..." or "According to the Researcher...")
- Weave the best insights from each perspective into a natural, unified response
- If perspectives conflict, present the tension honestly — "On one hand... but..."
- Prioritize what's most useful and actionable for the user
- Keep it concise — the power of the swarm is synthesis, not volume
- Maintain the Kernel's warm, direct voice throughout`

// ── Main Orchestrator ─────────────────────────────────

export async function runSwarm(
  message: string,
  userMemoryContext: string,
  conversationHistory: { role: string; content: string }[],
  onProgress: (progress: SwarmProgress) => void,
  onStream: (text: string) => void
): Promise<string> {
  // Phase 1: Select agents
  const progress: SwarmProgress = { phase: 'selecting', agents: [] }
  onProgress({ ...progress })

  const recentCtx = conversationHistory
    .slice(-4)
    .map(m => `${m.role}: ${m.content.slice(0, 150)}`)
    .join('\n')

  const { agents, focus } = await selectAgents(message, recentCtx)

  // Phase 2: Parallel contributions
  progress.phase = 'collaborating'
  progress.agents = agents.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    status: 'working' as const,
  }))
  onProgress({ ...progress })

  const contributions = await getContributions(
    agents,
    message,
    userMemoryContext,
    onProgress,
    progress
  )

  if (contributions.length === 0) {
    // All agents failed — fall through to direct response
    onStream('I tried to bring in multiple perspectives but hit a wall. Let me answer directly.')
    return 'I tried to bring in multiple perspectives but hit a wall. Let me answer directly.'
  }

  // Phase 3: Synthesize
  progress.phase = 'synthesizing'
  onProgress({ ...progress })

  const contributionText = contributions
    .map(c => `## ${c.name}\n${c.contribution}`)
    .join('\n\n---\n\n')

  const synthSystem = `${SYNTH_SYSTEM}\n\nSynthesis focus: ${focus}`

  const result = await claudeStreamChat(
    [
      {
        role: 'user',
        content: `Here are specialist perspectives on my question. Synthesize them into your response.\n\nMy question: ${message}\n\n---\n\n${contributionText}\n\n---\n\nNow give me your synthesized response. Don't mention the agents or this process — just answer naturally.`,
      },
    ],
    onStream,
    { system: synthSystem, model: 'sonnet', max_tokens: 2048 }
  )

  progress.phase = 'complete'
  onProgress({ ...progress })

  return result
}
