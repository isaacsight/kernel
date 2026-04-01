// kbot Dream Engine — In-Process Memory Consolidation
//
// Inspired by Claude Code's autoDream system, but built kbot's way:
//   - Uses local Ollama models ($0 cost) instead of cloud API
//   - Runs post-session or on-demand via `kbot dream`
//   - Ages memories with exponential decay scoring
//   - Extracts cross-session insights ("dreams")
//   - Produces a dream journal that feeds back into system prompts
//
// The metaphor: after a session, kbot "sleeps" — consolidating short-term
// session history into long-term durable insights, just like biological memory.
//
// Storage: ~/.kbot/memory/dreams/
//   - journal.json   — consolidated insights (the "dream journal")
//   - state.json     — last dream timestamp, cycle count, stats
//   - archive/       — old dreams that aged out (kept for archaeology)

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { getHistory, type ConversationTurn } from './memory.js'
import { loadMemory } from './memory.js'
import {
  getTopPatterns,
  getTopSolutions,
  getProfileSummary,
  updateProfile,
  recordPattern,
  learnFact,
} from './learning.js'
import { getMemoryScannerStats } from './memory-scanner.js'
import {
  getLearningReport as getMusicLearningReport,
  getRecentHistory as getMusicRecentHistory,
  getPreferences as getMusicPreferences,
} from './music-learning.js'
import { getBehaviorForDream } from './user-behavior.js'
import { registerAmendment } from './prompt-evolution.js'

// ── Constants ──

const DREAM_DIR = join(homedir(), '.kbot', 'memory', 'dreams')
const JOURNAL_FILE = join(DREAM_DIR, 'journal.json')
const STATE_FILE = join(DREAM_DIR, 'state.json')
const ARCHIVE_DIR = join(DREAM_DIR, 'archive')

const MAX_INSIGHTS = 100         // Keep top 100 insights
const DECAY_RATE = 0.03          // ~3% relevance loss per day
const MIN_RELEVANCE = 0.15       // Below this → archive
const CONSOLIDATION_MODEL = 'kernel:latest'  // Local Ollama model
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_TIMEOUT = 60_000    // 60s per generation

// ── Types ──

export interface DreamInsight {
  /** Unique ID */
  id: string
  /** The consolidated insight */
  content: string
  /** Category: pattern | preference | skill | project | relationship */
  category: DreamCategory
  /** Keywords for retrieval */
  keywords: string[]
  /** Relevance score (0-1), decays over time */
  relevance: number
  /** How many sessions contributed to this insight */
  sessions: number
  /** Created timestamp */
  created: string
  /** Last reinforced (refreshed relevance) */
  lastReinforced: string
  /** Source: which sessions/topics generated this */
  source: string
}

export type DreamCategory = 'pattern' | 'preference' | 'skill' | 'project' | 'relationship' | 'music'

export interface DreamState {
  /** Total dream cycles completed */
  cycles: number
  /** Last dream timestamp */
  lastDream: string | null
  /** Total insights ever created */
  totalInsights: number
  /** Total insights archived (aged out) */
  totalArchived: number
  /** Insights currently active */
  activeInsights: number
  /** Last session turn count that was dreamed about */
  lastSessionTurns: number
}

// ── Helpers ──

function ensureDirs(): void {
  for (const dir of [DREAM_DIR, ARCHIVE_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

function loadJournal(): DreamInsight[] {
  ensureDirs()
  if (!existsSync(JOURNAL_FILE)) return []
  try { return JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8')) } catch { return [] }
}

function saveJournal(insights: DreamInsight[]): void {
  ensureDirs()
  writeFileSync(JOURNAL_FILE, JSON.stringify(insights, null, 2))
}

function loadState(): DreamState {
  ensureDirs()
  const defaults: DreamState = {
    cycles: 0, lastDream: null, totalInsights: 0,
    totalArchived: 0, activeInsights: 0, lastSessionTurns: 0,
  }
  if (!existsSync(STATE_FILE)) return defaults
  try { return { ...defaults, ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) } } catch { return defaults }
}

function saveState(state: DreamState): void {
  ensureDirs()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function generateId(): string {
  return `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Calculate days between two ISO dates */
function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}

// ── Ollama Integration ──

async function ollamaGenerate(prompt: string, model = CONSOLIDATION_MODEL): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT)

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 512 },
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    if (!res.ok) return null

    const data = await res.json() as { response?: string }
    return data.response?.trim() || null
  } catch {
    return null
  }
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

// ── Memory Aging ──

/** Apply exponential decay to all insights based on time elapsed */
export function ageMemories(insights: DreamInsight[]): { aged: DreamInsight[]; archived: DreamInsight[] } {
  const now = new Date().toISOString()
  const aged: DreamInsight[] = []
  const archived: DreamInsight[] = []

  for (const insight of insights) {
    const days = daysBetween(insight.lastReinforced, now)
    // Exponential decay: relevance * e^(-rate * days)
    const decayed = insight.relevance * Math.exp(-DECAY_RATE * days)

    if (decayed < MIN_RELEVANCE) {
      archived.push({ ...insight, relevance: decayed })
    } else {
      aged.push({ ...insight, relevance: Math.round(decayed * 1000) / 1000 })
    }
  }

  return { aged, archived }
}

/** Archive old insights to disk */
function archiveInsights(insights: DreamInsight[]): void {
  if (insights.length === 0) return
  ensureDirs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archivePath = join(ARCHIVE_DIR, `archived_${timestamp}.json`)
  writeFileSync(archivePath, JSON.stringify(insights, null, 2))
}

// ── Consolidation Prompts ──

function buildConsolidationPrompt(
  sessionHistory: ConversationTurn[],
  existingInsights: DreamInsight[],
  existingMemory: string,
): string {
  const historyText = sessionHistory
    .map(t => `[${t.role}]: ${t.content.slice(0, 500)}`)
    .join('\n')

  const existingText = existingInsights.length > 0
    ? existingInsights.slice(0, 20).map(i => `- [${i.category}] ${i.content}`).join('\n')
    : '(none yet)'

  // ── Tier 1: Pattern cache — intent → tool sequences ──
  const topPatterns = getTopPatterns(10)
  const patternsText = topPatterns.length > 0
    ? topPatterns.map(p =>
        `- "${p.intent}" → ${p.toolSequence.join(' → ')} (${p.hits}x, ${Math.round(p.successRate * 100)}% success)`
      ).join('\n')
    : '(no patterns yet)'

  // ── Tier 2: Solution index — Q&A pairs ──
  const topSolutions = getTopSolutions(5)
  const solutionsText = topSolutions.length > 0
    ? topSolutions.map(s =>
        `- Q: ${s.question.slice(0, 100)} → confidence: ${Math.round(s.confidence * 100)}%, reused ${s.reuses}x`
      ).join('\n')
    : '(no solutions yet)'

  // ── Tier 3: User profile ──
  const profileText = getProfileSummary() || '(no profile data yet)'

  // ── Tier 5: Memory scanner — recent passive detections ──
  const scannerStats = getMemoryScannerStats()
  const scannerText = scannerStats.recentDetections.length > 0
    ? scannerStats.recentDetections
        .slice(-5)
        .map(d => `- [${d.kind}] ${d.content.slice(0, 150)} (confidence: ${Math.round(d.confidence * 100)}%)`)
        .join('\n')
    : '(no recent detections)'

  // ── Tier 6: Music learning — sound, pattern, mix memories ──
  const musicPrefs = getMusicPreferences()
  const hasMusicData = musicPrefs.totalBeats > 0 || musicPrefs.totalSessions > 0
  let musicText = '(no music production data yet)'
  if (hasMusicData) {
    const report = getMusicLearningReport()
    const recentEvents = getMusicRecentHistory(10)
    const recentText = recentEvents.length > 0
      ? recentEvents.map(e =>
          `- [${e.action}] ${e.genre} ${e.key} ${e.bpm}bpm — ${e.detail || 'no detail'} (${e.feedback})`
        ).join('\n')
      : ''
    musicText = report + (recentText ? `\n\n**Recent production events:**\n${recentText}` : '')
  }

  // ── Tier 7: User computer behavior — desktop observation ──
  const behaviorText = getBehaviorForDream(48) || '(no behavior data yet)'

  return `You are a memory consolidation system. Analyze this conversation session and ALL accumulated knowledge tiers to extract durable cross-tier insights.

EXISTING DREAM INSIGHTS (Tier 4 — Dream Journal):
${existingText}

EXISTING PERSISTENT MEMORY:
${existingMemory.slice(0, 2000) || '(empty)'}

LEARNED PATTERNS (Tier 1 — Pattern Cache):
${patternsText}

PROVEN SOLUTIONS (Tier 2 — Solution Index):
${solutionsText}

USER PROFILE (Tier 3):
${profileText}

RECENT MEMORY SCANNER DETECTIONS (Tier 5 — Passive Detection):
${scannerText}

MUSIC PRODUCTION LEARNING (Tier 6 — Musical Memory):
${musicText}

USER COMPUTER BEHAVIOR (Tier 7 — Desktop Observation):
${behaviorText}

SESSION TO CONSOLIDATE:
${historyText}

INSTRUCTIONS:
Extract 1-5 insights by synthesizing across ALL tiers. Each insight should be:
- Durable (useful beyond this session)
- Non-obvious (not derivable from reading code)
- Cross-tier when possible (e.g., a pattern + preference = workflow insight)
- About the USER, their preferences, patterns, workflows, or project context

For music/production sessions, pay special attention to:
- Which sounds, instruments, and presets scored well and why
- BPM + key + genre combinations that the user gravitates toward
- Mix decisions that worked (volume balance, send levels, panning)
- Production patterns (e.g., "808 sub bass in F1 works well at 142 BPM for trap")
- Cross-domain insights (e.g., coding workflow preferences that mirror production habits)
Use category "music" for production-specific insights.

For desktop behavior data, look for:
- Workflow patterns (which apps are always open together, e.g., IDE + terminal + browser)
- Productivity habits (active hours, app switching frequency)
- Context-switching tendencies (many apps vs focused few)
- Tool preferences (which creative/dev tools dominate)
- Cross-domain insights (e.g., "user switches to music production apps in evening hours")

Pay special attention to:
- Patterns that confirm or contradict existing insights
- Scanner corrections that reveal unrecognized preferences
- Solution clusters that suggest emerging expertise areas
- Profile trends that indicate shifting priorities

Format each insight as a JSON array of objects:
[
  {
    "content": "the insight text",
    "category": "pattern|preference|skill|project|relationship|music",
    "keywords": ["keyword1", "keyword2"]
  }
]

If the session is too short or trivial for insights, return: []

Respond ONLY with the JSON array, no other text.`
}

function buildReinforcePrompt(
  sessionHistory: ConversationTurn[],
  existingInsights: DreamInsight[],
): string {
  const historyText = sessionHistory
    .map(t => `[${t.role}]: ${t.content.slice(0, 300)}`)
    .join('\n')

  const insightList = existingInsights
    .map((i, idx) => `${idx}: [${i.category}] ${i.content}`)
    .join('\n')

  return `You are a memory reinforcement system. Given this conversation, which existing insights are confirmed/relevant?

EXISTING INSIGHTS (by index):
${insightList}

SESSION:
${historyText}

Return a JSON array of insight indices that this session reinforces. Example: [0, 3, 7]
If none are reinforced, return: []

Respond ONLY with the JSON array.`
}

// ── Memory Cascade: Feed Insights Back into Tiers ──

/**
 * Apply dream insights back into the learning system.
 * This is the feedback loop that makes the memory cascade bidirectional:
 *   - "preference" insights → update user profile via learnFact()
 *   - "pattern" insights → hint the pattern cache via recordPattern()
 *   - "skill" insights → record as observed knowledge
 *   - "project" insights → record as project context
 *
 * Called at the end of every dream cycle after new insights are extracted.
 */
export function applyDreamInsights(insights: DreamInsight[]): ApplyResult {
  const result: ApplyResult = {
    preferencesApplied: 0,
    patternsHinted: 0,
    factsLearned: 0,
    promptAmendments: 0,
  }

  for (const insight of insights) {
    switch (insight.category) {
      case 'preference': {
        // Feed preference insights back into the knowledge base as observed facts.
        // This lets the learning context builder surface them in future prompts.
        learnFact(insight.content, 'preference', 'observed')

        // Also nudge the user profile if the insight mentions style/tech preferences
        const lower = insight.content.toLowerCase()
        if (/\b(?:concise|brief|short)\b/.test(lower)) {
          updateProfile({ taskType: 'prefers-concise' })
        } else if (/\b(?:detailed|thorough|verbose)\b/.test(lower)) {
          updateProfile({ taskType: 'prefers-detailed' })
        }

        // Extract any tech terms mentioned in the preference
        const techTerms = extractTechTermsFromInsight(insight.content)
        if (techTerms.length > 0) {
          updateProfile({ techTerms })
        }

        // High-relevance preference insights → prompt evolution amendments.
        // This wires dream consolidation into the GEPA prompt evolution system
        // so kbot's specialist prompts self-improve based on learned behavior.
        if (insight.relevance > 0.8) {
          const amendment = insightToAmendment(insight.content)
          if (amendment) {
            // Target the 'kernel' agent (general) — the preference applies broadly.
            // Tag with the dream insight ID for traceability / rollback.
            registerAmendment('kernel', amendment, `dream preference: ${insight.content.slice(0, 80)}`, insight.id)
            result.promptAmendments++
          }
        }

        result.preferencesApplied++
        break
      }

      case 'pattern': {
        // Feed pattern insights into the knowledge base.
        // If the insight describes a tool workflow, hint the pattern cache.
        learnFact(insight.content, 'context', 'observed')

        // Try to extract a tool sequence from the insight text
        // (e.g., "User typically reads files then runs tests" → [read_file, run_tests])
        const toolHints = extractToolHintsFromInsight(insight.content)
        if (toolHints.length >= 2) {
          // Record as a pattern with the insight content as the "intent"
          const intentWords = insight.keywords.join(' ') || insight.content.slice(0, 80)
          recordPattern(intentWords, toolHints, 0)
        }

        result.patternsHinted++
        break
      }

      case 'skill': {
        // Skills are knowledge about what the user is good at or learning.
        learnFact(insight.content, 'context', 'observed')
        result.factsLearned++
        break
      }

      case 'project': {
        // Project insights become project-scoped knowledge.
        learnFact(insight.content, 'project', 'observed')
        result.factsLearned++
        break
      }

      case 'relationship': {
        // Relationship insights (how user interacts, team dynamics) → context facts.
        learnFact(insight.content, 'context', 'observed')
        result.factsLearned++
        break
      }

      case 'music': {
        // Music production insights → context facts.
        // These capture durable knowledge like "808 sub in F1 at 142 BPM works for trap"
        // and feed back into the learning system for future prompt enrichment.
        learnFact(insight.content, 'context', 'observed')
        result.factsLearned++
        break
      }
    }
  }

  return result
}

export interface ApplyResult {
  preferencesApplied: number
  patternsHinted: number
  factsLearned: number
  promptAmendments: number
}

/**
 * Convert a preference insight into a concrete prompt amendment.
 * Maps common preference patterns to actionable instructions for the agent.
 * Returns null if no actionable amendment can be derived.
 */
function insightToAmendment(insightContent: string): string | null {
  const lower = insightContent.toLowerCase()

  // Speed / action-oriented preferences
  if (/\b(?:speed|fast|quick|ship|action|just do it|don't ask)\b/.test(lower)) {
    return 'Be action-oriented. Ship first, polish later. Don\'t ask for permission on non-destructive operations.'
  }

  // Conciseness preferences
  if (/\b(?:concise|brief|short|terse|no fluff|straight to the point)\b/.test(lower)) {
    return 'Keep responses concise. Lead with the answer or action. Skip preambles and restating the question.'
  }

  // Detail / thoroughness preferences
  if (/\b(?:detailed|thorough|explain|verbose|show work|step.by.step)\b/.test(lower)) {
    return 'Be thorough in explanations. Show reasoning steps. Include context and alternatives when relevant.'
  }

  // Code-first preferences
  if (/\b(?:code.first|show.code|less.talk|implementation|no.theory)\b/.test(lower)) {
    return 'Lead with code. Show the implementation first, then explain only if the user asks.'
  }

  // Terminal / CLI preferences
  if (/\b(?:terminal|cli|command.line|shell|no.gui|no.web)\b/.test(lower)) {
    return 'Prefer terminal-based solutions. Use CLI tools over web interfaces. Everything should be scriptable.'
  }

  // Safety / careful preferences
  if (/\b(?:careful|safe|confirm|check.first|verify|double.check)\b/.test(lower)) {
    return 'Verify before acting. Confirm destructive operations. Read files before editing. Run builds after changes.'
  }

  // Exploration / creative preferences
  if (/\b(?:creative|explore|try.new|experiment|novel|unconventional)\b/.test(lower)) {
    return 'Explore creative solutions. Consider unconventional approaches. Suggest alternatives the user might not have considered.'
  }

  // Fallback: use the insight content directly as a general behavioral nudge
  // Only if the insight is short enough to be a useful prompt instruction
  if (insightContent.length <= 200) {
    return `User preference: ${insightContent}`
  }

  return null
}

/** Extract tech-related terms from insight text */
function extractTechTermsFromInsight(text: string): string[] {
  const techTerms = new Set([
    'react', 'typescript', 'node', 'python', 'rust', 'go', 'docker',
    'api', 'database', 'supabase', 'postgres', 'redis', 'mongodb',
    'css', 'html', 'json', 'sql', 'git', 'npm', 'vite', 'webpack',
    'tailwind', 'next', 'express', 'fastify', 'deno', 'bun',
    'playwright', 'vitest', 'jest', 'eslint', 'prettier',
    'ollama', 'anthropic', 'openai', 'claude', 'gpt',
    'ableton', 'serum', 'splice', 'osc', 'midi',
  ])
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => techTerms.has(w))
}

/** Try to extract tool names from insight text describing a workflow */
function extractToolHintsFromInsight(text: string): string[] {
  const toolNames = new Set([
    'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'bash',
    'git_status', 'git_diff', 'git_commit', 'git_push', 'git_log',
    'run_tests', 'test_run', 'build_run', 'type_check', 'lint_check',
    'web_search', 'url_fetch', 'screenshot', 'browser_navigate',
    'kbot_agent', 'spawn_agent', 'memory_save', 'memory_search',
    'research', 'papers_search', 'github_search',
  ])

  // Match tool-like words (snake_case) in the text
  const words = text.toLowerCase().replace(/[^a-z0-9_\s]/g, ' ').split(/\s+/)
  const found = words.filter(w => toolNames.has(w))
  if (found.length >= 2) return found

  // Fallback: look for verb patterns that map to common tools
  const verbMap: Array<[RegExp, string]> = [
    [/\bread(?:s|ing)?\s+(?:file|code|source)/i, 'read_file'],
    [/\bwrit(?:e|es|ing)\s+(?:file|code)/i, 'write_file'],
    [/\bedit(?:s|ing)?\b/i, 'edit_file'],
    [/\bsearch(?:es|ing)?\s+(?:web|online|internet)/i, 'web_search'],
    [/\brun(?:s|ning)?\s+test/i, 'run_tests'],
    [/\bgrep(?:s|ping)?\b/i, 'grep'],
    [/\bgit\s+(?:commit|push|diff|status|log)/i, 'git_commit'],
    [/\bbuild(?:s|ing)?\b/i, 'build_run'],
    [/\bbash\b|\bshell\b|\bcommand\b/i, 'bash'],
  ]

  const mapped: string[] = []
  for (const [pattern, tool] of verbMap) {
    if (pattern.test(text) && !mapped.includes(tool)) {
      mapped.push(tool)
    }
  }
  return mapped
}

// ── Core Dream Functions ──

/** Run a full dream cycle — consolidate, reinforce, age */
export async function dream(sessionId = 'default'): Promise<DreamResult> {
  const result: DreamResult = {
    success: false,
    newInsights: 0,
    reinforced: 0,
    archived: 0,
    cycle: 0,
    duration: 0,
    error: null,
    applied: null,
  }

  const start = Date.now()

  // Check Ollama availability
  if (!(await isOllamaAvailable())) {
    // Fallback: still do aging even without Ollama
    const journal = loadJournal()
    if (journal.length > 0) {
      const { aged, archived } = ageMemories(journal)
      archiveInsights(archived)
      saveJournal(aged)
      result.archived = archived.length
    }
    result.error = 'Ollama not available — aging only (no new consolidation)'
    result.duration = Date.now() - start
    return result
  }

  const state = loadState()
  let journal = loadJournal()
  const history = getHistory(sessionId)
  const memory = loadMemory()

  // Skip if session too short
  if (history.length < 4) {
    result.error = 'Session too short for consolidation (< 4 turns)'
    result.duration = Date.now() - start
    return result
  }

  // Phase 1: Age existing memories
  const { aged, archived } = ageMemories(journal)
  archiveInsights(archived)
  journal = aged
  result.archived = archived.length

  // Phase 2: Extract new insights from session (cross-tier consolidation)
  const consolidationPrompt = buildConsolidationPrompt(history, journal, memory)
  const rawInsights = await ollamaGenerate(consolidationPrompt)
  const newlyCreatedInsights: DreamInsight[] = []

  if (rawInsights) {
    try {
      // Strip markdown code fences if Ollama wraps the JSON
      const cleaned = rawInsights.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned) as Array<{
        content: string
        category: DreamCategory
        keywords: string[]
      }>

      if (Array.isArray(parsed)) {
        const now = new Date().toISOString()
        for (const p of parsed.slice(0, 5)) {
          // Dedup: skip if very similar content exists
          const isDupe = journal.some(j =>
            j.content.toLowerCase().includes(p.content.toLowerCase().slice(0, 50)) ||
            p.content.toLowerCase().includes(j.content.toLowerCase().slice(0, 50))
          )
          if (isDupe) continue

          const insight: DreamInsight = {
            id: generateId(),
            content: p.content,
            category: p.category || 'pattern',
            keywords: p.keywords || [],
            relevance: 0.9,
            sessions: 1,
            created: now,
            lastReinforced: now,
            source: `session_${state.cycles + 1}`,
          }
          journal.push(insight)
          newlyCreatedInsights.push(insight)
          result.newInsights++
        }
      }
    } catch {
      // JSON parse failed — Ollama output wasn't clean
    }
  }

  // Phase 3: Reinforce existing insights mentioned in session
  if (journal.length > 0 && history.length >= 4) {
    const reinforcePrompt = buildReinforcePrompt(history, journal)
    const rawReinforce = await ollamaGenerate(reinforcePrompt)

    if (rawReinforce) {
      try {
        const cleanedR = rawReinforce.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        const indices = JSON.parse(cleanedR) as number[]
        if (Array.isArray(indices)) {
          const now = new Date().toISOString()
          for (const idx of indices) {
            if (idx >= 0 && idx < journal.length) {
              journal[idx].relevance = Math.min(1, journal[idx].relevance + 0.15)
              journal[idx].sessions++
              journal[idx].lastReinforced = now
              result.reinforced++
            }
          }
        }
      } catch {
        // Reinforcement parse failed — non-critical
      }
    }
  }

  // Phase 4: Sort by relevance, trim to max
  journal.sort((a, b) => b.relevance - a.relevance)
  if (journal.length > MAX_INSIGHTS) {
    const overflow = journal.slice(MAX_INSIGHTS)
    archiveInsights(overflow)
    journal = journal.slice(0, MAX_INSIGHTS)
    result.archived += overflow.length
  }

  // Phase 5: Feed new insights back into learning tiers (memory cascade)
  // This is the key integration — dream insights don't just sit in the journal,
  // they propagate back into the pattern cache, solution index, and user profile.
  if (newlyCreatedInsights.length > 0) {
    result.applied = applyDreamInsights(newlyCreatedInsights)
  }

  // Save everything
  saveJournal(journal)

  state.cycles++
  state.lastDream = new Date().toISOString()
  state.totalInsights += result.newInsights
  state.totalArchived += result.archived
  state.activeInsights = journal.length
  state.lastSessionTurns = history.length
  saveState(state)

  result.success = true
  result.cycle = state.cycles
  result.duration = Date.now() - start
  return result
}

export interface DreamResult {
  success: boolean
  newInsights: number
  reinforced: number
  archived: number
  cycle: number
  duration: number
  error: string | null
  /** Feedback from applying insights back into learning tiers */
  applied: ApplyResult | null
}

// ── Query Functions ──

/** Get dream insights for inclusion in system prompt */
export function getDreamPrompt(maxInsights = 10): string {
  const journal = loadJournal()
  if (journal.length === 0) return ''

  const top = journal
    .filter(i => i.relevance > 0.3)
    .slice(0, maxInsights)

  if (top.length === 0) return ''

  const lines = top.map(i =>
    `- [${i.category}] ${i.content} (relevance: ${Math.round(i.relevance * 100)}%)`
  )

  return `\n[Dream Journal — Consolidated Insights]\n${lines.join('\n')}\n`
}

/** Get full dream status */
export function getDreamStatus(): { state: DreamState; insights: DreamInsight[]; archiveCount: number } {
  const state = loadState()
  const insights = loadJournal()

  let archiveCount = 0
  if (existsSync(ARCHIVE_DIR)) {
    archiveCount = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json')).length
  }

  return { state, insights, archiveCount }
}

/** Search dream insights by keyword */
export function searchDreams(query: string): DreamInsight[] {
  const journal = loadJournal()
  const terms = query.toLowerCase().split(/\s+/)

  return journal
    .filter(i => {
      const text = `${i.content} ${i.keywords.join(' ')} ${i.category}`.toLowerCase()
      return terms.some(t => text.includes(t))
    })
    .sort((a, b) => b.relevance - a.relevance)
}

/** Manually reinforce a specific insight (user confirms it's still relevant) */
export function reinforceInsight(insightId: string): boolean {
  const journal = loadJournal()
  const insight = journal.find(i => i.id === insightId)
  if (!insight) return false

  insight.relevance = Math.min(1, insight.relevance + 0.2)
  insight.lastReinforced = new Date().toISOString()
  insight.sessions++
  saveJournal(journal)
  return true
}

/** Run dream after session ends (non-blocking) */
export function dreamAfterSession(sessionId = 'default'): void {
  // Fire and forget — don't block the user
  dream(sessionId).catch(() => {
    // Dream failed silently — non-critical
  })
}
