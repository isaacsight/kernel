// kbot Memory Synthesis — Three-Tier Generative Memory
//
// Inspired by Stanford's "Generative Agents" paper (Park et al., 2023).
//
// Three tiers of memory:
//   1. OBSERVATIONS — Raw facts from interactions (patterns, solutions, knowledge in learning.ts)
//   2. REFLECTIONS — Periodic synthesis of observations into higher-level insights (THIS FILE)
//   3. IDENTITY   — Long-term personality and preference evolution (temporal.ts)
//
// The Reflection tier runs a scheduled synthesis pass that reads all raw memory
// files, groups observations by theme, and produces higher-order insights using
// pure frequency analysis and pattern matching — no LLM calls required.
//
// Storage: ~/.kbot/memory/synthesis.json
// Max 50 insights, ranked by confidence.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import type { CachedPattern, CachedSolution, UserProfile, KnowledgeEntry, Correction, ProjectMemory } from './learning.js'

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export type InsightCategory =
  | 'coding_style'
  | 'project_pattern'
  | 'tool_preference'
  | 'agent_preference'
  | 'workflow'
  | 'personality'

export interface Insight {
  /** The synthesized observation in natural language */
  text: string
  /** Thematic category */
  category: InsightCategory
  /** 0-1, based on number of supporting observations */
  confidence: number
  /** How many raw observations support this insight */
  supportingCount: number
  /** ISO timestamp when this insight was first created */
  created: string
}

export interface MemorySynthesis {
  insights: Insight[]
  /** ISO timestamp of last synthesis run */
  synthesizedAt: string
  /** How many raw observations were processed in the last run */
  observationCount: number
}

// ══════════════════════════════════════════════════════════════════════
// Constants & Paths
// ══════════════════════════════════════════════════════════════════════

const LEARN_DIR = join(homedir(), '.kbot', 'memory')
const SYNTHESIS_FILE = join(LEARN_DIR, 'synthesis.json')
const PATTERNS_FILE = join(LEARN_DIR, 'patterns.json')
const SOLUTIONS_FILE = join(LEARN_DIR, 'solutions.json')
const PROFILE_FILE = join(LEARN_DIR, 'profile.json')
const KNOWLEDGE_FILE = join(LEARN_DIR, 'knowledge.json')
const CORRECTIONS_FILE = join(LEARN_DIR, 'corrections.json')
const PROJECTS_FILE = join(LEARN_DIR, 'projects.json')
const TECH_FREQ_FILE = join(LEARN_DIR, 'tech-freq.json')

const MAX_INSIGHTS = 50
/** Minimum raw observations before synthesis is worthwhile */
const MIN_OBSERVATIONS_FOR_SYNTHESIS = 20

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

function ensureDir(): void {
  if (!existsSync(LEARN_DIR)) mkdirSync(LEARN_DIR, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

function saveJSON(path: string, data: unknown): void {
  ensureDir()
  writeFileSync(path, JSON.stringify(data, null, 2))
}

/** Load the current synthesis state from disk */
function loadSynthesis(): MemorySynthesis {
  return loadJSON<MemorySynthesis>(SYNTHESIS_FILE, {
    insights: [],
    synthesizedAt: '',
    observationCount: 0,
  })
}

/** Persist synthesis state to disk */
function saveSynthesis(synthesis: MemorySynthesis): void {
  saveJSON(SYNTHESIS_FILE, synthesis)
}

// ══════════════════════════════════════════════════════════════════════
// Observation Counting
// ══════════════════════════════════════════════════════════════════════

/** Count total raw observations across all memory files */
function countObservations(): number {
  const patterns = loadJSON<CachedPattern[]>(PATTERNS_FILE, [])
  const solutions = loadJSON<CachedSolution[]>(SOLUTIONS_FILE, [])
  const knowledge = loadJSON<KnowledgeEntry[]>(KNOWLEDGE_FILE, [])
  const corrections = loadJSON<Correction[]>(CORRECTIONS_FILE, [])
  return patterns.length + solutions.length + knowledge.length + corrections.length
}

// ══════════════════════════════════════════════════════════════════════
// Core: shouldSynthesize()
// ══════════════════════════════════════════════════════════════════════

/**
 * Returns true if there are enough new observations since the last
 * synthesis to justify another pass (>20 new observations).
 */
export function shouldSynthesize(): boolean {
  const current = countObservations()
  if (current < MIN_OBSERVATIONS_FOR_SYNTHESIS) return false

  const synthesis = loadSynthesis()
  if (!synthesis.synthesizedAt) return true  // never synthesized

  const newObservations = current - synthesis.observationCount
  return newObservations >= MIN_OBSERVATIONS_FOR_SYNTHESIS
}

// ══════════════════════════════════════════════════════════════════════
// Core: synthesizeMemory()
// ══════════════════════════════════════════════════════════════════════

/**
 * Run the full synthesis pass.
 *
 * Reads all memory files, performs frequency analysis and pattern matching,
 * and produces higher-order insights. No LLM calls — pure statistics.
 *
 * Returns the updated MemorySynthesis.
 */
export function synthesizeMemory(): MemorySynthesis {
  const patterns = loadJSON<CachedPattern[]>(PATTERNS_FILE, [])
  const solutions = loadJSON<CachedSolution[]>(SOLUTIONS_FILE, [])
  const profile = loadJSON<UserProfile>(PROFILE_FILE, {
    responseStyle: 'auto', techStack: [], taskPatterns: {},
    preferredAgents: {}, totalMessages: 0, totalTokens: 0,
    tokensSaved: 0, avgTokensPerMessage: 0, sessions: 0,
  })
  const knowledge = loadJSON<KnowledgeEntry[]>(KNOWLEDGE_FILE, [])
  const corrections = loadJSON<Correction[]>(CORRECTIONS_FILE, [])
  const projects = loadJSON<ProjectMemory[]>(PROJECTS_FILE, [])
  const techFreq = loadJSON<Record<string, number>>(TECH_FREQ_FILE, {})

  const insights: Insight[] = []
  const now = new Date().toISOString()

  // ── 1. Tool preference analysis ─────────────────────────────────
  const toolCounts: Record<string, number> = {}
  for (const p of patterns) {
    for (const tool of p.toolSequence) {
      toolCounts[tool] = (toolCounts[tool] || 0) + p.hits
    }
  }
  const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])

  if (sortedTools.length >= 2) {
    const top3 = sortedTools.slice(0, 3)
    const totalHits = sortedTools.reduce((sum, [, n]) => sum + n, 0)
    insights.push({
      text: `Most-used tools: ${top3.map(([t, n]) => `${t} (${n}x)`).join(', ')}`,
      category: 'tool_preference',
      confidence: clampConfidence(totalHits, 10, 100),
      supportingCount: totalHits,
      created: now,
    })
  }

  // Tool pair analysis — find common two-step sequences
  const pairCounts: Record<string, number> = {}
  for (const p of patterns) {
    for (let i = 0; i < p.toolSequence.length - 1; i++) {
      const pair = `${p.toolSequence[i]} -> ${p.toolSequence[i + 1]}`
      pairCounts[pair] = (pairCounts[pair] || 0) + p.hits
    }
  }
  const sortedPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])
  if (sortedPairs.length >= 1) {
    const topPair = sortedPairs[0]
    if (topPair[1] >= 3) {
      // Compare with other pairs to generate comparative insight
      const secondPair = sortedPairs.length > 1 ? sortedPairs[1] : null
      let text = `Most common tool sequence: ${topPair[0]} (${topPair[1]}x)`
      if (secondPair && topPair[1] > secondPair[1] * 2) {
        text = `Tool sequence "${topPair[0]}" is ${Math.round(topPair[1] / secondPair[1])}x more common than "${secondPair[0]}"`
      }
      insights.push({
        text,
        category: 'workflow',
        confidence: clampConfidence(topPair[1], 3, 30),
        supportingCount: topPair[1],
        created: now,
      })
    }
  }

  // ── 2. Agent routing analysis ──────────────────────────────────
  const agentEntries = Object.entries(profile.preferredAgents)
  if (agentEntries.length >= 1) {
    const sorted = agentEntries.sort((a, b) => b[1] - a[1])
    const totalRoutes = sorted.reduce((sum, [, n]) => sum + n, 0)

    // Top agent
    const [topAgent, topCount] = sorted[0]
    const pct = Math.round((topCount / totalRoutes) * 100)
    insights.push({
      text: `The ${topAgent} agent handles ${pct}% of tasks (${topCount}/${totalRoutes})`,
      category: 'agent_preference',
      confidence: clampConfidence(totalRoutes, 10, 100),
      supportingCount: totalRoutes,
      created: now,
    })

    // If there is a clear second agent, mention the distribution
    if (sorted.length >= 2) {
      const [secondAgent, secondCount] = sorted[1]
      const secondPct = Math.round((secondCount / totalRoutes) * 100)
      if (secondPct >= 10) {
        insights.push({
          text: `Agent distribution: ${topAgent} ${pct}%, ${secondAgent} ${secondPct}%${sorted.length > 2 ? `, ${sorted.length - 2} others ${100 - pct - secondPct}%` : ''}`,
          category: 'agent_preference',
          confidence: clampConfidence(totalRoutes, 15, 100),
          supportingCount: totalRoutes,
          created: now,
        })
      }
    }
  }

  // ── 3. Tech stack / coding style analysis ──────────────────────
  const techEntries = Object.entries(techFreq).sort((a, b) => b[1] - a[1])
  if (techEntries.length >= 2) {
    const totalTechMentions = techEntries.reduce((sum, [, n]) => sum + n, 0)
    const top5 = techEntries.slice(0, 5)

    // Detect dominant language/framework
    const [topTech, topTechCount] = top5[0]
    const topPct = Math.round((topTechCount / totalTechMentions) * 100)
    if (topPct >= 30) {
      insights.push({
        text: `This user works primarily in ${topTech} (${topPct}% of tech mentions)`,
        category: 'coding_style',
        confidence: clampConfidence(topTechCount, 5, 50),
        supportingCount: topTechCount,
        created: now,
      })
    }

    // Detect stack combinations
    if (top5.length >= 2) {
      const stackStr = top5.map(([t]) => t).join(' + ')
      insights.push({
        text: `Primary tech stack: ${stackStr}`,
        category: 'project_pattern',
        confidence: clampConfidence(totalTechMentions, 10, 80),
        supportingCount: totalTechMentions,
        created: now,
      })
    }

    // Detect paradigm preferences from tech terms
    const functionalTerms = ['functional', 'map', 'reduce', 'filter', 'pipe', 'compose', 'immutable', 'pure']
    const oopTerms = ['class', 'interface', 'extends', 'inherit', 'abstract', 'override', 'polymorphism']
    const functionalScore = techEntries.filter(([t]) => functionalTerms.includes(t)).reduce((s, [, n]) => s + n, 0)
    const oopScore = techEntries.filter(([t]) => oopTerms.includes(t)).reduce((s, [, n]) => s + n, 0)
    if (functionalScore > 0 || oopScore > 0) {
      if (functionalScore > oopScore * 2 && functionalScore >= 3) {
        insights.push({
          text: 'This user prefers functional programming style over OOP',
          category: 'coding_style',
          confidence: clampConfidence(functionalScore, 3, 20),
          supportingCount: functionalScore,
          created: now,
        })
      } else if (oopScore > functionalScore * 2 && oopScore >= 3) {
        insights.push({
          text: 'This user prefers object-oriented programming style',
          category: 'coding_style',
          confidence: clampConfidence(oopScore, 3, 20),
          supportingCount: oopScore,
          created: now,
        })
      }
    }
  }

  // ── 4. Task type analysis ──────────────────────────────────────
  const taskEntries = Object.entries(profile.taskPatterns).sort((a, b) => b[1] - a[1])
  if (taskEntries.length >= 1) {
    const totalTasks = taskEntries.reduce((sum, [, n]) => sum + n, 0)

    // Dominant task type
    const [topTask, topTaskCount] = taskEntries[0]
    const taskPct = Math.round((topTaskCount / totalTasks) * 100)
    insights.push({
      text: `${taskPct}% of tasks are "${topTask}" (${topTaskCount}/${totalTasks})`,
      category: 'workflow',
      confidence: clampConfidence(totalTasks, 10, 100),
      supportingCount: totalTasks,
      created: now,
    })

    // Task diversity
    if (taskEntries.length >= 3) {
      const distribution = taskEntries.slice(0, 4)
        .map(([t, n]) => `${t} ${Math.round((n / totalTasks) * 100)}%`)
        .join(', ')
      insights.push({
        text: `Task distribution: ${distribution}`,
        category: 'workflow',
        confidence: clampConfidence(totalTasks, 15, 100),
        supportingCount: totalTasks,
        created: now,
      })
    }
  }

  // ── 5. Correction pattern analysis ─────────────────────────────
  if (corrections.length >= 2) {
    // Look for recurring correction themes
    const correctionWords: Record<string, number> = {}
    for (const c of corrections) {
      const words = c.userMessage.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
      for (const w of words) {
        correctionWords[w] = (correctionWords[w] || 0) + c.occurrences
      }
    }
    const topCorrectionWords = Object.entries(correctionWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, n]) => n >= 2)

    if (topCorrectionWords.length > 0) {
      const themes = topCorrectionWords.map(([w]) => w).join(', ')
      insights.push({
        text: `Common correction themes: ${themes} (user frequently corrects on these topics)`,
        category: 'personality',
        confidence: clampConfidence(corrections.length, 2, 15),
        supportingCount: corrections.length,
        created: now,
      })
    }

    // Response style preference from corrections
    const conciseCorrections = corrections.filter(c =>
      /(?:too\s+(?:long|verbose|detailed)|shorter|brief|tldr|concise)/i.test(c.userMessage),
    )
    const detailedCorrections = corrections.filter(c =>
      /(?:more\s+detail|elaborate|explain|too\s+short|too\s+brief)/i.test(c.userMessage),
    )
    if (conciseCorrections.length > detailedCorrections.length && conciseCorrections.length >= 2) {
      insights.push({
        text: 'This user prefers concise responses (corrected for verbosity multiple times)',
        category: 'personality',
        confidence: clampConfidence(conciseCorrections.length, 2, 10),
        supportingCount: conciseCorrections.length,
        created: now,
      })
    } else if (detailedCorrections.length > conciseCorrections.length && detailedCorrections.length >= 2) {
      insights.push({
        text: 'This user prefers detailed, thorough responses',
        category: 'personality',
        confidence: clampConfidence(detailedCorrections.length, 2, 10),
        supportingCount: detailedCorrections.length,
        created: now,
      })
    }
  }

  // ── 6. Project pattern analysis ────────────────────────────────
  if (projects.length >= 1) {
    // Detect common project stacks
    const stackCounts: Record<string, number> = {}
    for (const p of projects) {
      for (const s of p.stack) {
        stackCounts[s] = (stackCounts[s] || 0) + 1
      }
    }
    const commonStack = Object.entries(stackCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (commonStack.length >= 2 && projects.length >= 2) {
      const stackStr = commonStack.map(([s]) => s).join(' + ')
      insights.push({
        text: `Projects are mostly ${stackStr} (across ${projects.length} projects)`,
        category: 'project_pattern',
        confidence: clampConfidence(projects.length, 2, 10),
        supportingCount: projects.length,
        created: now,
      })
    }

    // Detect frequently edited files across projects
    const globalFiles: Record<string, number> = {}
    for (const p of projects) {
      for (const [file, count] of Object.entries(p.frequentFiles)) {
        // Use just the filename, not full path, for cross-project matching
        const basename = file.split('/').pop() || file
        globalFiles[basename] = (globalFiles[basename] || 0) + count
      }
    }
    const hotFiles = Object.entries(globalFiles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter(([, n]) => n >= 3)

    if (hotFiles.length > 0) {
      insights.push({
        text: `Most frequently edited files: ${hotFiles.map(([f, n]) => `${f} (${n}x)`).join(', ')}`,
        category: 'project_pattern',
        confidence: clampConfidence(hotFiles[0][1], 3, 20),
        supportingCount: hotFiles.reduce((s, [, n]) => s + n, 0),
        created: now,
      })
    }
  }

  // ── 7. Knowledge base theme analysis ───────────────────────────
  if (knowledge.length >= 3) {
    const categoryCounts: Record<string, number> = {}
    for (const k of knowledge) {
      categoryCounts[k.category] = (categoryCounts[k.category] || 0) + 1
    }
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]
    if (topCategory && topCategory[1] >= 3) {
      insights.push({
        text: `Most knowledge entries are "${topCategory[0]}" type (${topCategory[1]}/${knowledge.length})`,
        category: 'personality',
        confidence: clampConfidence(knowledge.length, 3, 30),
        supportingCount: knowledge.length,
        created: now,
      })
    }

    // User-taught vs extracted ratio
    const taughtCount = knowledge.filter(k => k.source === 'user-taught').length
    const extractedCount = knowledge.filter(k => k.source === 'extracted' || k.source === 'observed').length
    if (taughtCount > extractedCount * 2 && taughtCount >= 3) {
      insights.push({
        text: 'This user actively teaches kbot (more user-taught than auto-extracted knowledge)',
        category: 'personality',
        confidence: clampConfidence(taughtCount, 3, 15),
        supportingCount: taughtCount,
        created: now,
      })
    }
  }

  // ── 8. Efficiency trend analysis ───────────────────────────────
  if (profile.totalMessages > 20 && profile.avgTokensPerMessage > 0) {
    const baseline = 2000
    if (profile.avgTokensPerMessage < baseline * 0.7) {
      const effPct = Math.round((1 - profile.avgTokensPerMessage / baseline) * 100)
      insights.push({
        text: `Token efficiency is ${effPct}% above baseline (${Math.round(profile.avgTokensPerMessage)} avg vs ${baseline} baseline)`,
        category: 'workflow',
        confidence: clampConfidence(profile.totalMessages, 20, 200),
        supportingCount: profile.totalMessages,
        created: now,
      })
    }
  }

  // ── 9. Solution reuse analysis ─────────────────────────────────
  const highReuseSolutions = solutions.filter(s => s.reuses >= 2)
  if (highReuseSolutions.length >= 2) {
    // Extract common keywords from highly-reused solutions
    const solutionKeywords: Record<string, number> = {}
    for (const s of highReuseSolutions) {
      for (const kw of s.keywords) {
        solutionKeywords[kw] = (solutionKeywords[kw] || 0) + s.reuses
      }
    }
    const topSolKw = Object.entries(solutionKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (topSolKw.length > 0) {
      insights.push({
        text: `Most reused solution topics: ${topSolKw.map(([k, n]) => `${k} (${n} reuses)`).join(', ')}`,
        category: 'workflow',
        confidence: clampConfidence(highReuseSolutions.length, 2, 20),
        supportingCount: highReuseSolutions.reduce((s, sol) => s + sol.reuses, 0),
        created: now,
      })
    }
  }

  // ── Finalize ───────────────────────────────────────────────────
  // Sort by confidence descending, cap at MAX_INSIGHTS
  insights.sort((a, b) => b.confidence - a.confidence)
  const finalInsights = insights.slice(0, MAX_INSIGHTS)

  const observationCount = countObservations()

  const synthesis: MemorySynthesis = {
    insights: finalInsights,
    synthesizedAt: now,
    observationCount,
  }

  saveSynthesis(synthesis)
  return synthesis
}

// ══════════════════════════════════════════════════════════════════════
// Core: getInsights()
// ══════════════════════════════════════════════════════════════════════

/**
 * Retrieve synthesized insights, optionally filtered by category.
 * Returns up to `max` insights sorted by confidence.
 */
export function getInsights(category?: InsightCategory, max: number = 10): Insight[] {
  const synthesis = loadSynthesis()
  let results = synthesis.insights

  if (category) {
    results = results.filter(i => i.category === category)
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max)
}

// ══════════════════════════════════════════════════════════════════════
// Core: formatInsightsForPrompt()
// ══════════════════════════════════════════════════════════════════════

/**
 * Format insights for injection into the system prompt.
 * Produces a compact, readable block that gives the agent
 * deeper self-awareness about the user.
 */
export function formatInsightsForPrompt(insights: Insight[]): string {
  if (insights.length === 0) return ''

  const lines: string[] = ['[Synthesized User Insights]']

  for (const insight of insights) {
    const conf = Math.round(insight.confidence * 100)
    lines.push(`- ${insight.text} (${conf}% confidence)`)
  }

  return lines.join('\n')
}

// ══════════════════════════════════════════════════════════════════════
// Integration: getSynthesisContext()
// ══════════════════════════════════════════════════════════════════════

/**
 * Convenience function for the agent loop.
 * Returns formatted top insights ready for system prompt injection,
 * or empty string if no synthesis data exists.
 */
export function getSynthesisContext(maxInsights: number = 8): string {
  const synthesis = loadSynthesis()
  if (synthesis.insights.length === 0) return ''

  const top = synthesis.insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxInsights)

  return formatInsightsForPrompt(top)
}

// ══════════════════════════════════════════════════════════════════════
// Integration: maybeSynthesize()
// ══════════════════════════════════════════════════════════════════════

/**
 * Check-and-run: if synthesis is due, run it and return the count
 * of new insights produced. Otherwise return 0.
 * Safe to call on every session start — it is a no-op when not needed.
 */
export function maybeSynthesize(): number {
  if (!shouldSynthesize()) return 0
  const result = synthesizeMemory()
  return result.insights.length
}

// ══════════════════════════════════════════════════════════════════════
// Stats
// ══════════════════════════════════════════════════════════════════════

/**
 * Get synthesis stats for display in `kbot stats` or diagnostics.
 */
export function getSynthesisStats(): {
  insightCount: number
  lastSynthesized: string
  observationCount: number
  topInsights: string[]
} {
  const synthesis = loadSynthesis()
  return {
    insightCount: synthesis.insights.length,
    lastSynthesized: synthesis.synthesizedAt || 'never',
    observationCount: synthesis.observationCount,
    topInsights: synthesis.insights
      .slice(0, 5)
      .map(i => i.text),
  }
}

// ══════════════════════════════════════════════════════════════════════
// Internal helpers
// ══════════════════════════════════════════════════════════════════════

/**
 * Map a raw count to a 0-1 confidence score.
 * Uses a logarithmic curve: confidence rises steeply at first,
 * then flattens as count grows beyond `high`.
 *
 * @param count  - number of supporting observations
 * @param low    - count at which confidence starts being meaningful (~0.4)
 * @param high   - count at which confidence saturates (~0.95)
 */
function clampConfidence(count: number, low: number, high: number): number {
  if (count <= 0) return 0
  if (count >= high) return 0.95
  // Logarithmic scaling between low and high
  const normalized = (count - low) / (high - low)
  const clamped = Math.max(0, Math.min(1, normalized))
  // Curve: 0.4 at low end, 0.95 at high end
  return parseFloat((0.4 + clamped * 0.55).toFixed(2))
}
