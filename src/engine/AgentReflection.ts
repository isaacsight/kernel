/**
 * Agent Self-Reflection System
 *
 * Structured introspection questions that each agent asks about Kernel's
 * architecture, engines, and patterns. Powers /retro, /team, and
 * continuous self-improvement loops.
 *
 * Each question has a domain, severity, and expected evidence type —
 * agents don't just answer "yes/no", they produce findings with proof.
 */

export type ReflectionDomain =
  | 'architecture'
  | 'engines'
  | 'agents'
  | 'data'
  | 'ux'
  | 'security'
  | 'performance'
  | 'resilience'
  | 'product'
  | 'dx' // developer experience

export type EvidenceType =
  | 'metric'       // number with unit (e.g., "93KB gzip")
  | 'code-path'    // file:line reference
  | 'screenshot'   // visual proof
  | 'test-result'  // pass/fail with details
  | 'comparison'   // before/after or A/B
  | 'user-signal'  // analytics, feedback, behavior
  | 'reasoning'    // logical argument with cited facts

export type Severity = 'critical' | 'important' | 'exploratory'

export interface ReflectionQuestion {
  id: string
  domain: ReflectionDomain
  severity: Severity
  question: string
  context: string
  evidence: EvidenceType[]
  agent: 'qa' | 'designer' | 'performance' | 'security' | 'devops' | 'product' | 'all'
}

export interface ReflectionFinding {
  questionId: string
  agent: string
  answer: string
  evidence: string[]
  severity: 'p0' | 'p1' | 'p2' | 'info'
  actionRequired: boolean
  suggestedFix?: string
  timestamp: number
}

// ─── Architecture Questions ──────────────────────────────────

const ARCHITECTURE_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'arch-001',
    domain: 'architecture',
    severity: 'critical',
    question: 'Is EnginePage.tsx still maintainable, or has it crossed the complexity threshold where it needs decomposition?',
    context: 'EnginePage is the god component — it holds state for messages, panels, billing, entity, tour, tags, and 20+ UI concerns. Every new feature adds more state here.',
    evidence: ['metric', 'code-path', 'reasoning'],
    agent: 'qa',
  },
  {
    id: 'arch-002',
    domain: 'architecture',
    severity: 'critical',
    question: 'Are there circular dependency chains between engines that could cause initialization failures or bundle bloat?',
    context: 'MasterAgent imports all 7 domain engines. Each engine may import shared utilities. If any engine re-imports MasterAgent or a sibling, tree-shaking breaks.',
    evidence: ['code-path', 'metric'],
    agent: 'performance',
  },
  {
    id: 'arch-003',
    domain: 'architecture',
    severity: 'important',
    question: 'Is the Zustand store topology correct — or are stores duplicating state that should be derived?',
    context: 'We have adaptiveStore, communicationStore, pricingStore, projectStore, masterStore. Some state may overlap with what useChatEngine already tracks.',
    evidence: ['code-path', 'reasoning'],
    agent: 'qa',
  },
  {
    id: 'arch-004',
    domain: 'architecture',
    severity: 'important',
    question: 'Does the hash router constraint (#/ routes) create real limitations we should solve, or is it fine for our scale?',
    context: 'GitHub Pages requires hash routing — no server-side rewrites. This affects SEO, deep linking, and share URLs (we work around it with Cloudflare Workers).',
    evidence: ['reasoning', 'user-signal'],
    agent: 'product',
  },
  {
    id: 'arch-005',
    domain: 'architecture',
    severity: 'exploratory',
    question: 'Should we extract the engine layer into a standalone package that could run outside the React app?',
    context: 'The engine layer (AI, agents, memory, convergence) has no React dependencies. Extracting it would enable: CLI tools, Discord bot integration, server-side usage, testing in isolation.',
    evidence: ['code-path', 'reasoning'],
    agent: 'all',
  },
]

// ─── Engine Questions ────────────────────────────────────────

const ENGINE_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'eng-001',
    domain: 'engines',
    severity: 'critical',
    question: 'Is the MasterAgent orchestrator actually making better routing decisions than the simpler AgentRouter, or is it adding latency without improving quality?',
    context: 'MasterAgent was added on top of AgentRouter. If both run, we pay double classification cost. Need evidence that orchestration improves response quality.',
    evidence: ['metric', 'comparison', 'user-signal'],
    agent: 'product',
  },
  {
    id: 'eng-002',
    domain: 'engines',
    severity: 'critical',
    question: 'Is the Convergence engine (6 facet lenses) producing insights that users actually see and value, or is it burning Haiku tokens invisibly?',
    context: 'Convergence runs every ~5 messages: 6 facet extractions (Haiku) + 1 convergence (Sonnet). The Mirror panel shows results, but how many users open it?',
    evidence: ['metric', 'user-signal', 'reasoning'],
    agent: 'product',
  },
  {
    id: 'eng-003',
    domain: 'engines',
    severity: 'important',
    question: 'Are the 7 domain engines (Content, Knowledge, Algorithm, Platform, Adaptive, Communication, Pricing) all being used, or are some dead code?',
    context: 'Each engine was built for a purpose but some may not have active callers. Dead engines increase bundle size and maintenance burden.',
    evidence: ['code-path', 'metric'],
    agent: 'performance',
  },
  {
    id: 'eng-004',
    domain: 'engines',
    severity: 'important',
    question: 'Is the MemoryAgent extracting user profiles accurately, or is it hallucinating interests/facts from ambiguous conversations?',
    context: 'MemoryAgent uses Haiku to extract interests, goals, facts, communication style every 3 messages. Hallucinated facts persist and compound.',
    evidence: ['test-result', 'comparison'],
    agent: 'qa',
  },
  {
    id: 'eng-005',
    domain: 'engines',
    severity: 'important',
    question: 'Is the SwarmOrchestrator adding value over a single specialist response? What\'s the quality delta?',
    context: 'Swarm runs 2-4 Haiku agents in parallel, then Sonnet synthesizes. This costs 3-5x a single response. The quality should be noticeably better.',
    evidence: ['comparison', 'user-signal', 'metric'],
    agent: 'product',
  },
  {
    id: 'eng-006',
    domain: 'engines',
    severity: 'exploratory',
    question: 'Should the engine layer support streaming from multiple providers simultaneously for redundancy and speed?',
    context: 'Currently claude-proxy routes to one provider. We could race Claude vs Gemini and return the faster/better response.',
    evidence: ['reasoning', 'metric'],
    agent: 'all',
  },
]

// ─── Agent System Questions ──────────────────────────────────

const AGENT_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'agt-001',
    domain: 'agents',
    severity: 'critical',
    question: 'Is AgentRouter correctly classifying intent, or is it defaulting to "kernel" too often because other specialists have low confidence?',
    context: 'AgentRouter uses Haiku to classify. If confidence < 0.7, it falls back to kernel. We should track classification distribution to spot bias.',
    evidence: ['metric', 'test-result'],
    agent: 'qa',
  },
  {
    id: 'agt-002',
    domain: 'agents',
    severity: 'important',
    question: 'Are the 17 agent personalities actually distinct in output, or do they converge to similar responses regardless of persona?',
    context: '5 specialists + 4 extended + 5 swarm + 3 discussion agents. Each has a system prompt persona. But Claude may flatten personalities.',
    evidence: ['comparison', 'test-result'],
    agent: 'product',
  },
  {
    id: 'agt-003',
    domain: 'agents',
    severity: 'important',
    question: 'Is the agent team (QA, Designer, Performance, Security, DevOps, Product) actually finding real issues, or are they producing noise?',
    context: 'The 6 team agents have persistent memory. Review their memory files — are findings actionable, or are they repetitive/false positives?',
    evidence: ['reasoning', 'metric'],
    agent: 'all',
  },
  {
    id: 'agt-004',
    domain: 'agents',
    severity: 'exploratory',
    question: 'Should agents be able to modify their own system prompts based on user feedback and accumulated memory?',
    context: 'Currently agent personas are static in specialists.ts. Self-modifying prompts could make agents more effective but also more unpredictable.',
    evidence: ['reasoning'],
    agent: 'all',
  },
]

// ─── Data & State Questions ──────────────────────────────────

const DATA_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'dat-001',
    domain: 'data',
    severity: 'critical',
    question: 'Is conversation data actually persisting correctly across sessions, or are there silent data loss scenarios?',
    context: 'Messages save to Supabase, but the app also keeps local state in Zustand. If the DB write fails silently, users lose messages.',
    evidence: ['test-result', 'code-path'],
    agent: 'qa',
  },
  {
    id: 'dat-002',
    domain: 'data',
    severity: 'important',
    question: 'Is the Knowledge Graph (entity/relation extraction) growing coherently, or is it accumulating contradictory or duplicate entities?',
    context: 'KG extraction happens every 3 messages via Haiku. Entity deduplication relies on name matching. "React" the framework vs "react" the verb could collide.',
    evidence: ['test-result', 'metric'],
    agent: 'qa',
  },
  {
    id: 'dat-003',
    domain: 'data',
    severity: 'important',
    question: 'Are Supabase RPC functions and RLS policies correctly preventing cross-user data access?',
    context: 'All RPCs are SECURITY DEFINER. RLS policies should enforce user_id isolation. A single misconfigured policy = data breach.',
    evidence: ['test-result', 'code-path'],
    agent: 'security',
  },
  {
    id: 'dat-004',
    domain: 'data',
    severity: 'exploratory',
    question: 'How much storage per user are we consuming, and what\'s the growth trajectory?',
    context: 'Messages, KG entities, memory profiles, conversation metadata, generated images — all stored in Supabase. Need to model per-user storage cost.',
    evidence: ['metric', 'reasoning'],
    agent: 'devops',
  },
]

// ─── UX Questions ────────────────────────────────────────────

const UX_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'ux-001',
    domain: 'ux',
    severity: 'critical',
    question: 'What is the actual time-to-first-response for a new user\'s first message, and is it fast enough?',
    context: 'First message flow: create conversation → classify intent → route to specialist → stream response. Each step has latency. Users expect < 2 seconds.',
    evidence: ['metric', 'user-signal'],
    agent: 'product',
  },
  {
    id: 'ux-002',
    domain: 'ux',
    severity: 'critical',
    question: 'Is the free-to-Pro conversion funnel working? What percentage of free users hit the upgrade wall, and how many convert?',
    context: '20 messages/day free limit. Upgrade wall shows at limit. But if the wall is too aggressive or not compelling enough, we lose users both ways.',
    evidence: ['metric', 'user-signal'],
    agent: 'product',
  },
  {
    id: 'ux-003',
    domain: 'ux',
    severity: 'important',
    question: 'Is the bottom-sheet pattern (used for all panels) actually good on desktop, or does it feel like a mobile-first compromise?',
    context: 'Every panel (stats, insights, knowledge, settings, etc.) uses bottom-sheet. On a 27" monitor, content slides up from the bottom — potentially awkward.',
    evidence: ['screenshot', 'comparison', 'user-signal'],
    agent: 'designer',
  },
  {
    id: 'ux-004',
    domain: 'ux',
    severity: 'important',
    question: 'Are the 8 new UX improvements (desktop width, counter, sections, entity tap, agent why, chips, tour, tags) discoverable without the tour?',
    context: 'The feature tour only runs once on first visit. Returning users who update to the new version won\'t see the tour. Are the new features self-evident?',
    evidence: ['user-signal', 'reasoning'],
    agent: 'product',
  },
  {
    id: 'ux-005',
    domain: 'ux',
    severity: 'exploratory',
    question: 'Should we add keyboard shortcuts for power users (Cmd+K search, Cmd+N new chat, etc.)?',
    context: 'Currently Cmd+K opens the conversation drawer. But there\'s no shortcut for new chat, toggle thinking, switch panels, etc.',
    evidence: ['reasoning', 'user-signal'],
    agent: 'product',
  },
]

// ─── Security Questions ──────────────────────────────────────

const SECURITY_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'sec-001',
    domain: 'security',
    severity: 'critical',
    question: 'Can a free user bypass tier gating by manipulating the client-side `isPro` flag or intercepting the claude-proxy request?',
    context: 'Tier gating happens in claude-proxy (server-side) AND in useChatEngine (client-side). If only client-side, it\'s bypassable via DevTools.',
    evidence: ['test-result', 'code-path'],
    agent: 'security',
  },
  {
    id: 'sec-002',
    domain: 'security',
    severity: 'critical',
    question: 'Are all edge functions that accept user input properly sanitizing against injection (SQL, NoSQL, prompt injection)?',
    context: 'Edge functions receive JSON payloads. Supabase client parameterizes queries, but any raw string interpolation is a risk.',
    evidence: ['code-path', 'test-result'],
    agent: 'security',
  },
  {
    id: 'sec-003',
    domain: 'security',
    severity: 'important',
    question: 'Is the SSRF blocklist in url-fetch comprehensive enough, or can it be bypassed with DNS rebinding or IPv6?',
    context: 'url-fetch has 10 regex patterns blocking private ranges. But DNS rebinding (domain resolves to public IP first, then private) can bypass regex-based checks.',
    evidence: ['test-result', 'reasoning'],
    agent: 'security',
  },
  {
    id: 'sec-004',
    domain: 'security',
    severity: 'important',
    question: 'Are API keys rotated on a schedule, and is there a documented rotation procedure?',
    context: 'Anthropic key, Google key, Stripe keys, Supabase service key, Discord webhook — all long-lived secrets. If compromised, response time matters.',
    evidence: ['reasoning', 'code-path'],
    agent: 'security',
  },
]

// ─── Performance Questions ───────────────────────────────────

const PERFORMANCE_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'perf-001',
    domain: 'performance',
    severity: 'critical',
    question: 'Is the CSS file (~250KB, 60KB gzip) causing layout thrashing or slow first paint on mobile?',
    context: 'Single monolithic index.css with 15,000+ lines. Browser must parse all of it before first paint. Critical CSS extraction could help.',
    evidence: ['metric', 'comparison'],
    agent: 'performance',
  },
  {
    id: 'perf-002',
    domain: 'performance',
    severity: 'important',
    question: 'Are lazy-loaded panels actually lazy, or does Vite bundle them into the main chunk?',
    context: 'We use lazyRetry() for 30+ panel imports. If tree-shaking fails or a shared dependency pulls them in, the main bundle bloats.',
    evidence: ['metric', 'code-path'],
    agent: 'performance',
  },
  {
    id: 'perf-003',
    domain: 'performance',
    severity: 'important',
    question: 'How many re-renders does a single message send trigger in EnginePage, and can we reduce them?',
    context: 'sendMessage updates: messages state, isStreaming, isThinking, thinkingAgent, possibly suggestions, routingReason. Each state change = re-render.',
    evidence: ['metric', 'code-path'],
    agent: 'performance',
  },
  {
    id: 'perf-004',
    domain: 'performance',
    severity: 'exploratory',
    question: 'Should we implement virtual scrolling for long conversations (100+ messages)?',
    context: 'Currently all messages render to DOM. At 100+ messages with code blocks, images, and artifacts, scroll performance degrades.',
    evidence: ['metric', 'comparison'],
    agent: 'performance',
  },
]

// ─── Resilience Questions ────────────────────────────────────

const RESILIENCE_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'res-001',
    domain: 'resilience',
    severity: 'critical',
    question: 'What happens when the Claude API is down? Does the app degrade gracefully or break completely?',
    context: 'All AI features depend on claude-proxy → Anthropic API. If Anthropic has an outage, every message fails. Do we show useful error states?',
    evidence: ['test-result', 'code-path'],
    agent: 'devops',
  },
  {
    id: 'res-002',
    domain: 'resilience',
    severity: 'important',
    question: 'Is the service worker correctly serving cached content when offline, or does it break the app?',
    context: 'PWA service worker caches static assets. But if it serves stale JS while the API expects a newer format, things break silently.',
    evidence: ['test-result', 'code-path'],
    agent: 'devops',
  },
  {
    id: 'res-003',
    domain: 'resilience',
    severity: 'important',
    question: 'Is there a circuit breaker for background processes (memory extraction, convergence, KG) that fail repeatedly?',
    context: 'Background Haiku calls run every 3 messages. If the API is rate-limited or erroring, we keep retrying wastefully. Need backoff/circuit breaker.',
    evidence: ['code-path', 'reasoning'],
    agent: 'devops',
  },
]

// ─── Product Questions ───────────────────────────────────────

const PRODUCT_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'prod-001',
    domain: 'product',
    severity: 'critical',
    question: 'What is our DAU/MAU ratio, and what does it say about retention?',
    context: 'If users try Kernel once and don\'t return, the product isn\'t sticky enough. Need to measure: how many users return within 7 days?',
    evidence: ['metric', 'user-signal'],
    agent: 'product',
  },
  {
    id: 'prod-002',
    domain: 'product',
    severity: 'critical',
    question: 'What single feature would make a user choose Kernel over ChatGPT, Claude.ai, or Gemini?',
    context: 'We need a defensible differentiator. Memory? Convergence? The entity? The agent system? Which one do users actually care about?',
    evidence: ['user-signal', 'reasoning'],
    agent: 'product',
  },
  {
    id: 'prod-003',
    domain: 'product',
    severity: 'important',
    question: 'Is the More Menu too cluttered? With 25 items in 4 sections, is the IA (information architecture) working?',
    context: 'We just added section headers. But 25 items is still a lot. Should some be promoted to the main UI? Should others be removed?',
    evidence: ['user-signal', 'comparison', 'reasoning'],
    agent: 'designer',
  },
  {
    id: 'prod-004',
    domain: 'product',
    severity: 'exploratory',
    question: 'Should Kernel have a "workspace" or "project" mode where it persists files and context across sessions for a specific task?',
    context: 'Currently each conversation is isolated. Power users working on a project need persistent file context, not just memory.',
    evidence: ['reasoning', 'user-signal'],
    agent: 'product',
  },
]

// ─── Developer Experience Questions ──────────────────────────

const DX_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'dx-001',
    domain: 'dx',
    severity: 'important',
    question: 'Can a new developer understand the codebase in under 2 hours? What\'s the biggest barrier?',
    context: 'CLAUDE.md exists but the engine layer is complex. 17 agents, 8 engines, 5 MCP servers, 30+ edge functions. Onboarding path matters.',
    evidence: ['reasoning'],
    agent: 'all',
  },
  {
    id: 'dx-002',
    domain: 'dx',
    severity: 'important',
    question: 'Is the test coverage adequate for the critical paths, or are we flying blind on regressions?',
    context: 'Vitest is configured but test count is low. Critical paths: auth, message send, tier gating, payment flow, memory extraction.',
    evidence: ['metric', 'code-path'],
    agent: 'qa',
  },
  {
    id: 'dx-003',
    domain: 'dx',
    severity: 'exploratory',
    question: 'Should we add Storybook or a similar component catalog for the Rubin design system?',
    context: 'We have 250KB of CSS with ~200 component classes. No visual catalog exists — designers and developers rely on live app inspection.',
    evidence: ['reasoning'],
    agent: 'designer',
  },
]

// ─── All Questions Combined ──────────────────────────────────

export const ALL_REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  ...ARCHITECTURE_QUESTIONS,
  ...ENGINE_QUESTIONS,
  ...AGENT_QUESTIONS,
  ...DATA_QUESTIONS,
  ...UX_QUESTIONS,
  ...SECURITY_QUESTIONS,
  ...PERFORMANCE_QUESTIONS,
  ...RESILIENCE_QUESTIONS,
  ...PRODUCT_QUESTIONS,
  ...DX_QUESTIONS,
]

// ─── Helpers ─────────────────────────────────────────────────

/** Get questions for a specific agent */
export function getQuestionsForAgent(agentId: string): ReflectionQuestion[] {
  return ALL_REFLECTION_QUESTIONS.filter(q => q.agent === agentId || q.agent === 'all')
}

/** Get questions by domain */
export function getQuestionsByDomain(domain: ReflectionDomain): ReflectionQuestion[] {
  return ALL_REFLECTION_QUESTIONS.filter(q => q.domain === domain)
}

/** Get critical questions only */
export function getCriticalQuestions(): ReflectionQuestion[] {
  return ALL_REFLECTION_QUESTIONS.filter(q => q.severity === 'critical')
}

/** Format questions for injection into an agent's system prompt */
export function formatQuestionsForPrompt(questions: ReflectionQuestion[]): string {
  const grouped = new Map<ReflectionDomain, ReflectionQuestion[]>()
  for (const q of questions) {
    const list = grouped.get(q.domain) || []
    list.push(q)
    grouped.set(q.domain, list)
  }

  const sections: string[] = []
  for (const [domain, qs] of grouped) {
    const lines = qs.map(q =>
      `- [${q.severity.toUpperCase()}] ${q.question}\n  Context: ${q.context}\n  Evidence needed: ${q.evidence.join(', ')}`
    )
    sections.push(`## ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n${lines.join('\n\n')}`)
  }

  return `# Self-Reflection Questions\n\nAnswer each question with evidence. Be honest — the goal is improvement, not validation.\n\n${sections.join('\n\n')}`
}

/** Count questions by severity */
export function questionStats(): { critical: number; important: number; exploratory: number; total: number } {
  return {
    critical: ALL_REFLECTION_QUESTIONS.filter(q => q.severity === 'critical').length,
    important: ALL_REFLECTION_QUESTIONS.filter(q => q.severity === 'important').length,
    exploratory: ALL_REFLECTION_QUESTIONS.filter(q => q.severity === 'exploratory').length,
    total: ALL_REFLECTION_QUESTIONS.length,
  }
}
