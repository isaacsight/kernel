// kbot Agent Teams — Claude Code Teammate Integration
//
// Registers kbot's specialist agents as Claude Code teammates so they
// can be invoked collaboratively within a Claude Code session.
//
// Usage:
//   import { registerTeammates, delegateToTeammate } from './agent-teams.js'
//
//   const teammates = registerTeammates()
//   const result = await delegateToTeammate('coder', 'refactor auth.ts into smaller functions')

import { SPECIALISTS, type SpecialistDef } from './agents/specialists.js'
import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { SilentUIAdapter } from './ui-adapter.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TeammateDefinition {
  /** Agent identifier */
  name: string
  /** What this specialist focuses on */
  description: string
  /** Model tier: 'sonnet' for fast agents, 'opus' for complex reasoning */
  model: 'sonnet' | 'opus'
  /** System prompt that defines the specialist's behavior */
  initialPrompt: string
  /** Preferred tools for this specialist */
  tools: string[]
}

export interface DelegationResult {
  /** The response content from the teammate */
  content: string
  /** Which agent handled the task */
  agent: string
  /** Model used */
  model: string
  /** Number of tool calls made */
  toolCalls: number
  /** Token usage, if available */
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
}

// ── Teammate tool mappings ──────────────────────────────────────────────────

const TOOL_PREFERENCES: Record<string, string[]> = {
  kernel: [
    'read_file', 'write_file', 'glob', 'grep', 'bash',
    'web_search', 'memory_save', 'memory_search',
  ],
  coder: [
    'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'bash',
    'git_status', 'git_diff', 'git_commit', 'lint', 'test_runner',
    'type_check', 'format_code',
  ],
  researcher: [
    'web_search', 'url_fetch', 'read_file', 'grep', 'glob',
    'arxiv_search', 'semantic_scholar', 'memory_save',
  ],
  writer: [
    'read_file', 'write_file', 'edit_file', 'glob', 'grep',
    'web_search', 'url_fetch',
  ],
  analyst: [
    'read_file', 'glob', 'grep', 'bash', 'web_search',
    'url_fetch', 'csv_read', 'csv_query',
  ],
  guardian: [
    'read_file', 'glob', 'grep', 'bash', 'dep_audit',
    'secret_scan', 'ssl_check', 'headers_check', 'cve_lookup',
    'port_scan', 'owasp_check',
  ],
  aesthete: [
    'read_file', 'write_file', 'edit_file', 'glob', 'grep',
    'bash', 'design_variants',
  ],
  curator: [
    'read_file', 'write_file', 'edit_file', 'glob', 'grep',
    'memory_save', 'memory_search', 'web_search',
  ],
  strategist: [
    'read_file', 'glob', 'grep', 'web_search', 'url_fetch',
    'bash', 'csv_read', 'csv_query',
  ],
}

// Agents that benefit from complex reasoning get opus; others use sonnet for speed
const OPUS_AGENTS = new Set(['analyst', 'strategist', 'guardian', 'researcher'])

// ── Teammate descriptions ───────────────────────────────────────────────────

const DESCRIPTIONS: Record<string, string> = {
  kernel: 'General-purpose assistant — handles conversation, coordination, and tasks that span multiple domains.',
  coder: 'Programming specialist — writes, reviews, refactors, and debugs production-quality code across all major languages.',
  researcher: 'Research specialist — finds, verifies, and synthesizes information from web, papers, and codebases.',
  writer: 'Content specialist — writes docs, blog posts, changelogs, emails, and social media with appropriate tone and structure.',
  analyst: 'Strategy & evaluation specialist — breaks down complex decisions with data-driven analysis and frameworks.',
  guardian: 'Security specialist — audits code, scans dependencies, checks for vulnerabilities, and hardens systems.',
  aesthete: 'Design specialist — evaluates and creates UI/UX, enforces design systems, and ensures accessibility.',
  curator: 'Knowledge management specialist — organizes documentation, maintains knowledge bases, and fills information gaps.',
  strategist: 'Business strategy specialist — connects technical decisions to business outcomes, builds roadmaps, and analyzes competitors.',
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Register kbot specialists as Claude Code teammates.
 *
 * Returns an array of teammate definitions — one for each of kbot's
 * core and extended specialist agents (9 total).
 *
 * @example
 * const teammates = registerTeammates()
 * // teammates[0] = { name: 'kernel', model: 'sonnet', ... }
 */
export function registerTeammates(): TeammateDefinition[] {
  const teammateIds = [
    'kernel', 'coder', 'researcher', 'writer', 'analyst',
    'guardian', 'aesthete', 'curator', 'strategist',
  ]

  return teammateIds.map((id) => {
    const specialist = SPECIALISTS[id]
    if (!specialist) {
      throw new Error(`Specialist "${id}" not found in SPECIALISTS registry.`)
    }

    return {
      name: id,
      description: DESCRIPTIONS[id] ?? specialist.name,
      model: OPUS_AGENTS.has(id) ? 'opus' as const : 'sonnet' as const,
      initialPrompt: specialist.prompt,
      tools: TOOL_PREFERENCES[id] ?? TOOL_PREFERENCES.kernel,
    }
  })
}

/**
 * Delegate a task to a specific kbot teammate by name.
 *
 * Routes the task through kbot's full agent loop (think -> plan -> execute -> learn)
 * using a silent UI adapter so output is captured, not printed.
 *
 * @param name - The teammate/specialist ID (e.g. 'coder', 'researcher')
 * @param task - The task description or prompt to execute
 * @returns The delegation result with content, agent info, and usage stats
 *
 * @example
 * const result = await delegateToTeammate('coder', 'add input validation to auth.ts')
 * console.log(result.content)
 */
export async function delegateToTeammate(
  name: string,
  task: string,
): Promise<DelegationResult> {
  // Validate the teammate exists
  const specialist = SPECIALISTS[name]
  if (!specialist) {
    const available = Object.keys(SPECIALISTS).join(', ')
    throw new Error(
      `Unknown teammate "${name}". Available: ${available}`,
    )
  }

  const ui = new SilentUIAdapter()

  const options: AgentOptions = {
    agent: name,
    stream: false,
    ui,
  }

  const response: AgentResponse = await runAgent(task, options)

  return {
    content: response.content ?? (ui as any).content ?? '',
    agent: response.agent ?? name,
    model: response.model ?? '',
    toolCalls: response.toolCalls ?? 0,
    usage: response.usage,
  }
}
