// K:BOT Agent Creation Matrix
// Create, manage, and invoke custom specialist agents on-the-fly.
// Agents are local session constructs — they override the system prompt
// and can be invoked by the AI via tool calls or by the user via /matrix.

import chalk from 'chalk'
import { registerAgentVisuals } from './ui.js'
import { CREATIVE_PRESET, CREATIVE_BUILTIN } from './agents/creative.js'

export interface MatrixAgent {
  id: string
  name: string
  icon: string
  color: string
  systemPrompt: string
  createdAt: Date
  invocations: number
}

const AGENT_ICONS = ['◆', '◈', '⟐', '◇', '▣', '✦', '◉', '❖', '▲', '⬡', '∑', '⊕', '☉', '◷', '✧', '◎', '⟳', '⊗', '⊘', '⊛']
const AGENT_COLORS = ['#6B5B95', '#5B8BA0', '#6B8E6B', '#B8875C', '#A0768C', '#C4956A', '#4682B4', '#DAA520', '#228B22', '#9370DB', '#DB7093', '#20B2AA', '#8B4513', '#CD853F']

/** In-memory agent registry for this session */
const matrix = new Map<string, MatrixAgent>()

/** Slugify a name to an ID */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Create a new agent in the matrix */
export function createAgent(name: string, systemPrompt: string, icon?: string, color?: string): MatrixAgent {
  const id = slugify(name)
  if (matrix.has(id)) {
    throw new Error(`Agent "${id}" already exists. Use /matrix remove ${id} first.`)
  }
  const idx = matrix.size
  const agent: MatrixAgent = {
    id,
    name,
    icon: icon || AGENT_ICONS[idx % AGENT_ICONS.length],
    color: color || AGENT_COLORS[idx % AGENT_COLORS.length],
    systemPrompt,
    createdAt: new Date(),
    invocations: 0,
  }
  matrix.set(id, agent)
  registerAgentVisuals(id, agent.icon, agent.color)
  return agent
}

/** Get an agent by ID */
export function getAgent(id: string): MatrixAgent | undefined {
  return matrix.get(id)
}

/** Remove an agent */
export function removeAgent(id: string): boolean {
  return matrix.delete(id)
}

/** List all agents in the matrix */
export function listAgents(): MatrixAgent[] {
  return Array.from(matrix.values())
}

/** Get system prompt override if a matrix agent is active */
export function getMatrixSystemPrompt(agentId: string): string | null {
  const agent = matrix.get(agentId)
  if (!agent) return null
  agent.invocations++
  return agent.systemPrompt
}

/** Get matrix agent IDs for tool hints */
export function getMatrixAgentIds(): string[] {
  return Array.from(matrix.keys())
}

/** Format agent list for display */
export function formatAgentList(): string {
  const agents = listAgents()
  if (agents.length === 0) {
    return chalk.dim('  No agents in the matrix. Use /matrix create to add one.')
  }
  const lines = agents.map(a => {
    const color = chalk.hex(a.color)
    return `  ${color(a.icon)} ${color(a.name)} ${chalk.dim(`(${a.id})`)} — ${chalk.dim(`${a.invocations} calls`)}`
  })
  return lines.join('\n')
}

/** Format a single agent detail */
export function formatAgentDetail(agent: MatrixAgent): string {
  const color = chalk.hex(agent.color)
  return [
    `  ${color(agent.icon)} ${color(agent.name)}`,
    `  ${chalk.dim('ID:')} ${agent.id}`,
    `  ${chalk.dim('Calls:')} ${agent.invocations}`,
    `  ${chalk.dim('Prompt:')} ${agent.systemPrompt.slice(0, 120)}${agent.systemPrompt.length > 120 ? '...' : ''}`,
  ].join('\n')
}

// ── Preset Templates ──
// Quick-start agent templates users can spawn instantly

export const PRESETS: Record<string, { name: string; prompt: string }> = {
  'security-auditor': {
    name: 'Security Auditor',
    prompt: 'You are a senior security engineer. Analyze code for vulnerabilities: injection, XSS, CSRF, auth bypass, secrets exposure, insecure dependencies. Be thorough and cite OWASP categories. Provide severity ratings (Critical/High/Medium/Low) and fix recommendations.',
  },
  'ux-critic': {
    name: 'UX Critic',
    prompt: 'You are a UX design critic with expertise in mobile-first design. Evaluate interfaces for usability, accessibility (WCAG 2.1 AA), information hierarchy, touch targets, cognitive load, and visual consistency. Be constructive but honest about issues.',
  },
  'code-reviewer': {
    name: 'Code Reviewer',
    prompt: 'You are a senior staff engineer doing a code review. Focus on: correctness, edge cases, error handling, performance, maintainability, naming, and adherence to project conventions. Be specific — reference line numbers and suggest concrete improvements.',
  },
  'architect': {
    name: 'System Architect',
    prompt: 'You are a systems architect. Evaluate designs for scalability, separation of concerns, data flow, failure modes, and operational complexity. Propose alternatives when you see issues. Think in terms of trade-offs, not absolutes.',
  },
  'tech-writer': {
    name: 'Tech Writer',
    prompt: 'You are a technical writer. Write clear, concise documentation. Use active voice, short sentences, and code examples. Structure with headings, bullet points, and numbered steps. Target audience: experienced developers who are new to this codebase.',
  },
  'devil-advocate': {
    name: "Devil's Advocate",
    prompt: 'You challenge every assumption. When presented with a plan or design, find the weaknesses, edge cases, and failure modes. Ask uncomfortable questions. Your goal is to stress-test ideas before they ship. Be respectful but relentless.',
  },
  'hacker': {
    name: 'Hacker',
    prompt: 'You are an offensive security specialist and CTF solver. Think like a red teamer — every system has an attack surface. For CTF challenges: enumerate, analyze, exploit, show the full chain. For code review: look beyond OWASP top 10 — business logic flaws, race conditions, timing attacks, supply chain risks. Structure exploits as: Recon → Vulnerability → Exploitation → Post-exploitation → Remediation. Always include working proof-of-concept code and defensive recommendations. Respect scope — offensive techniques require clear authorization context.',
  },
  'operator': {
    name: 'Operator',
    prompt: 'You are the autonomous executor. When given a goal, you plan, execute, verify, and report back. Decompose complex tasks into concrete steps. Use an orchestrator-worker pattern: plan first, then execute each step, verify each result before moving on. Before any destructive action, pause and confirm scope. Track progress explicitly: what\'s done, what\'s next, what\'s blocked. Start with a brief plan, report at milestones, end with a clear status of what was accomplished.',
  },
  'dreamer': {
    name: 'Dreamer',
    prompt: 'You operate in the liminal space between imagination and reality. For dream interpretation: draw from Jungian archetypes, neuroscience, and personal symbolism. For worldbuilding: create internally consistent systems — physics, cultures, histories, languages. For vision engineering: help articulate futures not yet clearly seen. Cross-pollinate dream imagery with waking-life projects. Contemplative but precise — evocative language without losing analytical rigor. End with a question that opens further exploration.',
  },
  'creative': {
    name: CREATIVE_PRESET.name,
    prompt: CREATIVE_PRESET.prompt,
  },
}

// ══ MIMIC MATRIX ══════════════════════════════════════════
// Create agents that mimic the style, workflow, and conventions of
// specific tools, frameworks, teams, and coding philosophies.
// This is kbot's intelligence layer that OpenClaw doesn't have.

export interface MimicProfile {
  id: string
  name: string
  description: string
  systemPrompt: string
  icon: string
  color: string
  /** Code conventions to enforce */
  conventions?: string[]
  /** Example patterns to follow */
  examples?: string[]
}

export const MIMIC_PROFILES: Record<string, MimicProfile> = {
  // Tool mimics — write code like popular AI tools
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code Style',
    description: 'Write code the way Claude Code does — clean, minimal, well-tested',
    icon: '⊛',
    color: '#D97706',
    systemPrompt: `You write code in the style of Anthropic's Claude Code. Your conventions:
- Minimal, focused changes — never over-engineer
- Prefer editing existing files over creating new ones
- No unnecessary comments, docstrings, or type annotations on unchanged code
- Simple solutions: 3 similar lines > premature abstraction
- Validate at boundaries, trust internal code
- No feature flags or backwards-compat shims — just change the code
- When fixing bugs, fix the root cause, don't add workarounds
- Always verify your work by reading back the file after editing`,
    conventions: ['minimal changes', 'no over-engineering', 'edit > create', 'verify after edit'],
  },
  'cursor': {
    id: 'cursor',
    name: 'Cursor AI Style',
    description: 'Write code like Cursor — fast, inline, context-aware completions',
    icon: '⊗',
    color: '#7C3AED',
    systemPrompt: `You write code in the style of Cursor AI. Your conventions:
- Generate complete, ready-to-use code blocks — no placeholders
- Infer intent from context: file structure, imports, naming patterns
- Match the existing code style exactly: indentation, quotes, semicolons, naming
- When adding to a file, follow the patterns already established
- Suggest multi-file edits when a change touches multiple files
- Include imports and dependencies automatically
- Optimize for developer velocity — code should work on first paste`,
    conventions: ['complete code', 'match existing style', 'include imports', 'no placeholders'],
  },
  'copilot': {
    id: 'copilot',
    name: 'GitHub Copilot Style',
    description: 'Write code like Copilot — contextual, pattern-matching completions',
    icon: '⊘',
    color: '#1F6FEB',
    systemPrompt: `You write code in the style of GitHub Copilot. Your conventions:
- Complete the user's current thought — infer what comes next
- Use the same patterns visible in the current file and project
- Favor idiomatic solutions for the language being used
- Include inline comments only where logic is non-obvious
- Generate tests that mirror the project's existing test patterns
- When generating functions, use the naming conventions already in the codebase`,
    conventions: ['pattern completion', 'idiomatic code', 'match project conventions'],
  },

  // Framework mimics — enforce framework conventions
  'nextjs': {
    id: 'nextjs',
    name: 'Next.js Expert',
    description: 'Write Next.js code following Vercel best practices',
    icon: '▲',
    color: '#000000',
    systemPrompt: `You are a Next.js expert writing production code. Your conventions:
- Use App Router (app/ directory) by default, not Pages Router
- Server Components by default, 'use client' only when needed
- Use server actions for mutations, not API routes
- Streaming with Suspense for loading states
- Use next/image, next/font, next/link properly
- ISR/SSG where possible, SSR only when dynamic data is required
- Metadata API for SEO, not <Head>
- Follow Vercel deployment best practices
- TypeScript strict mode, Tailwind CSS for styling`,
    conventions: ['App Router', 'Server Components', 'server actions', 'Tailwind', 'TypeScript'],
  },
  'react': {
    id: 'react',
    name: 'Modern React',
    description: 'Write React code with modern patterns (hooks, composition)',
    icon: '⚛',
    color: '#61DAFB',
    systemPrompt: `You write modern React code. Your conventions:
- Functional components only, never class components
- Custom hooks for shared logic, not HOCs or render props
- useState/useReducer for local state, context sparingly
- React Query / TanStack Query for server state
- Composition over configuration — small, focused components
- Avoid useEffect for derived state — compute inline or useMemo
- Error boundaries at route level
- TypeScript for all components with proper prop types
- CSS Modules or Tailwind, never inline styles for production`,
    conventions: ['hooks', 'composition', 'TypeScript', 'React Query', 'no useEffect for derived state'],
  },
  'python': {
    id: 'python',
    name: 'Pythonic Code',
    description: 'Write clean, idiomatic Python following PEP standards',
    icon: '🐍',
    color: '#3776AB',
    systemPrompt: `You write idiomatic Python code. Your conventions:
- Follow PEP 8 style guide strictly
- Use type hints (Python 3.10+ syntax: list[str] not List[str])
- Prefer dataclasses or Pydantic models over dicts
- Use pathlib over os.path
- f-strings over .format() or % formatting
- List comprehensions where readable, loops when complex
- Use contextlib and with statements for resource management
- Proper exception handling — specific exceptions, not bare except
- Use ruff for linting, pytest for testing
- Virtual environments and pyproject.toml for dependencies`,
    conventions: ['PEP 8', 'type hints', 'dataclasses', 'pathlib', 'f-strings', 'pytest'],
  },
  'rust': {
    id: 'rust',
    name: 'Rust Idiomatic',
    description: 'Write safe, performant Rust following community conventions',
    icon: '⚙',
    color: '#DEA584',
    systemPrompt: `You write idiomatic Rust code. Your conventions:
- Ownership-first thinking — minimize cloning
- Use Result and Option properly, avoid unwrap in production
- Prefer &str over String for parameters
- Use iterators and combinators over manual loops
- Derive traits (Debug, Clone, PartialEq) generously
- Error types with thiserror or anyhow
- Use clippy suggestions as gospel
- Modules organized by functionality, not by type
- Integration tests in tests/, unit tests inline with #[cfg(test)]
- Document public APIs with /// and examples`,
    conventions: ['ownership', 'Result/Option', 'iterators', 'clippy', 'thiserror'],
  },

  // Philosophy mimics — coding mindsets
  'senior': {
    id: 'senior',
    name: 'Senior Engineer',
    description: 'Think and code like a principal engineer — trade-offs, simplicity, maintainability',
    icon: '★',
    color: '#B45309',
    systemPrompt: `You think and code like a principal software engineer with 15+ years of experience. Your philosophy:
- Simplicity is the ultimate sophistication — every line must earn its place
- Name things precisely — good names eliminate the need for comments
- Design for deletion — code should be easy to remove, not just add
- Make impossible states impossible via the type system
- Ship small, ship often — prefer incremental improvements
- Write code for the next person to read, not the compiler
- Performance matters, but correctness and clarity come first
- Every abstraction has a cost — don't abstract until you have 3+ examples
- Tests should describe behavior, not implementation
- Review your own code as if someone else wrote it`,
    conventions: ['simplicity', 'precise naming', 'design for deletion', 'incremental shipping'],
  },
  'startup': {
    id: 'startup',
    name: 'Startup Mode',
    description: 'Move fast, ship MVPs, pragmatic trade-offs',
    icon: '⚡',
    color: '#EF4444',
    systemPrompt: `You code for a fast-moving startup. Your philosophy:
- Ship first, optimize later — working > perfect
- Use proven tech: React, Node, PostgreSQL, Redis, AWS/Vercel
- Avoid premature optimization and over-engineering
- Copy-paste is fine for 2 instances, abstract at 3
- Use managed services (Supabase, Vercel, Clerk) over self-hosting
- Skip features users haven't asked for
- Prioritize user-facing functionality over internal tooling
- Quick iteration: deploy, measure, iterate
- Good enough error handling > perfect error handling that takes a week
- README with setup instructions is all the docs you need`,
    conventions: ['ship fast', 'proven stack', 'managed services', 'YAGNI'],
  },
}

/** Activate a mimic profile — creates a matrix agent with the mimic's conventions */
export function activateMimic(profileId: string): MatrixAgent | null {
  const profile = MIMIC_PROFILES[profileId]
  if (!profile) return null

  // Remove existing mimic with same ID if present
  matrix.delete(profile.id)

  const agent: MatrixAgent = {
    id: profile.id,
    name: profile.name,
    icon: profile.icon,
    color: profile.color,
    systemPrompt: profile.systemPrompt,
    createdAt: new Date(),
    invocations: 0,
  }
  matrix.set(profile.id, agent)
  registerAgentVisuals(profile.id, profile.icon, profile.color)
  return agent
}

// ── Built-in Agents ──
// These are always available without manual creation.
// Registered on startup so `kbot --agent hacker` works out of the box.

const BUILTIN_AGENTS: Record<string, { name: string; icon: string; color: string; prompt: string }> = {
  hacker: {
    name: 'Hacker',
    icon: '⚡',
    color: '#00FF41',
    prompt: PRESETS['hacker'].prompt,
  },
  operator: {
    name: 'Operator',
    icon: '⬡',
    color: '#FF6B35',
    prompt: PRESETS['operator'].prompt,
  },
  dreamer: {
    name: 'Dreamer',
    icon: '☾',
    color: '#7B68EE',
    prompt: PRESETS['dreamer'].prompt,
  },
  creative: {
    name: CREATIVE_BUILTIN.name,
    icon: CREATIVE_BUILTIN.icon,
    color: CREATIVE_BUILTIN.color,
    prompt: CREATIVE_BUILTIN.prompt,
  },
}

/** Register built-in agents so they're always available via --agent flag */
export function registerBuiltinAgents(): void {
  for (const [id, def] of Object.entries(BUILTIN_AGENTS)) {
    if (!matrix.has(id)) {
      const agent: MatrixAgent = {
        id,
        name: def.name,
        icon: def.icon,
        color: def.color,
        systemPrompt: def.prompt,
        createdAt: new Date(),
        invocations: 0,
      }
      matrix.set(id, agent)
      registerAgentVisuals(id, def.icon, def.color)
    }
  }
}

/** Format built-in agents for display */
export function formatBuiltinAgentList(): string {
  const builtins = Object.entries(BUILTIN_AGENTS).map(([id, def]) => {
    const color = chalk.hex(def.color)
    return `  ${color(def.icon)} ${color(def.name)} ${chalk.dim(`(${id})`)} — ${chalk.dim(PRESETS[id]?.prompt.slice(0, 80) + '...')}`
  })
  const customs = listAgents().filter(a => !BUILTIN_AGENTS[a.id as keyof typeof BUILTIN_AGENTS])
  const customLines = customs.map(a => {
    const color = chalk.hex(a.color)
    return `  ${color(a.icon)} ${color(a.name)} ${chalk.dim(`(${a.id})`)} — ${chalk.dim(a.systemPrompt.slice(0, 80) + '...')}`
  })
  let out = chalk.bold('Built-in Agents:\n') + builtins.join('\n')
  if (customLines.length > 0) {
    out += '\n\n' + chalk.bold('Custom Agents (this session):\n') + customLines.join('\n')
  }
  // Also show presets
  const presetIds = Object.keys(PRESETS).filter(id => !BUILTIN_AGENTS[id as keyof typeof BUILTIN_AGENTS])
  if (presetIds.length > 0) {
    const presetLines = presetIds.map(id => {
      const p = PRESETS[id]
      return `  ${chalk.dim('◇')} ${p.name} ${chalk.dim(`(${id})`)} — ${chalk.dim(p.prompt.slice(0, 80) + '...')}`
    })
    out += '\n\n' + chalk.bold('Presets (spawn with: /matrix create <id>):\n') + presetLines.join('\n')
  }
  return out
}

/** Format a single built-in agent detail */
export function formatBuiltinAgentDetail(id: string): string | null {
  const builtin = BUILTIN_AGENTS[id as keyof typeof BUILTIN_AGENTS]
  const preset = PRESETS[id]
  const agent = getAgent(id)
  if (!builtin && !preset && !agent) return null
  const name = builtin?.name || preset?.name || agent?.name || id
  const icon = builtin?.icon || agent?.icon || '◇'
  const color = builtin?.color || agent?.color || '#888888'
  const prompt = builtin?.prompt || preset?.prompt || agent?.systemPrompt || 'No description'
  const c = chalk.hex(color)
  return [
    `  ${c(icon)} ${c(name)} ${chalk.dim(`(${id})`)}`,
    `  ${chalk.dim('Color:')} ${color}`,
    `  ${chalk.dim('System Prompt:')}`,
    `  ${prompt}`,
  ].join('\n')
}

/** List all available mimic profiles */
export function listMimicProfiles(): MimicProfile[] {
  return Object.values(MIMIC_PROFILES)
}

/** Get mimic profile by ID */
export function getMimicProfile(id: string): MimicProfile | undefined {
  return MIMIC_PROFILES[id]
}
