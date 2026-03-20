// kbot Multi-Agent Reflexion (MAR) — When tasks fail, all specialists
// critique the failure from their perspective, and a judge synthesizes
// a single actionable lesson for future sessions.
//
// Triggers:
//   1. Self-eval scores below 0.5
//   2. Error-correction fires (classified error with confidence > 0.7)
//   3. User explicitly rejects the response ("no", "wrong", "that's not right")
//
// All critiques are heuristic-based — no LLM calls. Fast and free.
// Lessons are stored in ~/.kbot/memory/reflections.json (max 100, ranked by recency).

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// ── Types ──

export interface Perspective {
  agent: string
  critique: string
}

export interface Reflection {
  id: string
  taskMessage: string
  failureType: 'low_score' | 'error_correction' | 'user_rejection'
  perspectives: Perspective[]
  synthesis: string
  lesson: string
  created: string
}

// ── Storage ──

const MEMORY_DIR = join(homedir(), '.kbot', 'memory')
const REFLECTIONS_FILE = join(MEMORY_DIR, 'reflections.json')
const MAX_REFLECTIONS = 100

function ensureDir(): void {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
}

function loadReflections(): Reflection[] {
  ensureDir()
  if (!existsSync(REFLECTIONS_FILE)) return []
  try {
    return JSON.parse(readFileSync(REFLECTIONS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveReflections(reflections: Reflection[]): void {
  ensureDir()
  // Keep only the most recent MAX_REFLECTIONS
  const trimmed = reflections.slice(-MAX_REFLECTIONS)
  writeFileSync(REFLECTIONS_FILE, JSON.stringify(trimmed, null, 2))
}

// ── Heuristic Perspective Generators ──
// Each specialist evaluates the failure from its own lens — no LLM calls.

function coderPerspective(message: string, response: string): string {
  const critiques: string[] = []

  // Check if code was generated
  const hasCodeBlock = /```[\s\S]*?```/.test(response)
  const askedForCode = /\b(code|function|class|component|script|implement|write|create|build|fix|refactor)\b/i.test(message)

  if (askedForCode && !hasCodeBlock) {
    critiques.push('User asked for code but no code block was generated.')
  }

  if (hasCodeBlock) {
    // Check for common syntax issues in generated code
    const codeBlocks = response.match(/```(?:\w*)\n([\s\S]*?)```/g) || []
    for (const block of codeBlocks) {
      const code = block.replace(/```\w*\n?/, '').replace(/```$/, '')

      // Unmatched brackets
      const opens = (code.match(/[{([\[]/g) || []).length
      const closes = (code.match(/[})\]]/g) || []).length
      if (Math.abs(opens - closes) > 2) {
        critiques.push('Code has mismatched brackets/parentheses.')
      }

      // Missing imports in TypeScript/JavaScript
      if (/\b(import|require)\b/.test(message) || /\bfrom\s+['"]/.test(code)) {
        const usedTypes = code.match(/:\s*([A-Z]\w+)/g) || []
        const importedTypes = code.match(/import\s+.*?{([^}]+)}/g)?.flatMap(
          m => m.match(/{([^}]+)}/)?.[1]?.split(',').map(t => t.trim()) || []
        ) || []
        const unimported = usedTypes.filter(t => {
          const name = t.replace(/^:\s*/, '')
          return !importedTypes.includes(name) && !code.includes(`type ${name}`) && !code.includes(`interface ${name}`)
        })
        if (unimported.length > 3) {
          critiques.push('Code references types that may not be imported.')
        }
      }
    }

    // Check if tool sequence was efficient
    const toolMentions = response.match(/\b(read_file|write_file|bash|grep|git_\w+)\b/g) || []
    if (toolMentions.length > 10) {
      critiques.push('Excessive tool calls — could have been more efficient.')
    }
  }

  // Empty or very short response for a complex question
  if (message.length > 100 && response.length < 100) {
    critiques.push('Response is suspiciously short for the complexity of the request.')
  }

  return critiques.length > 0
    ? critiques.join(' ')
    : 'No code-specific issues detected from the coder perspective.'
}

function guardianPerspective(message: string, response: string): string {
  const critiques: string[] = []

  // Check for risky operations in the response
  const riskyPatterns = [
    { pattern: /rm\s+-rf/i, issue: 'Suggested rm -rf without safeguards.' },
    { pattern: /sudo\s+/i, issue: 'Suggested sudo without explaining risks.' },
    { pattern: /chmod\s+777/i, issue: 'Suggested chmod 777 (world-writable).' },
    { pattern: /DROP\s+TABLE|DELETE\s+FROM\s+\w+\s*;/i, issue: 'Destructive database operation without WHERE clause check.' },
    { pattern: /eval\s*\(|new\s+Function\s*\(/i, issue: 'Used eval() or Function() constructor — potential code injection.' },
    { pattern: /password\s*[:=]\s*['"][^'"]+['"]/i, issue: 'Hardcoded password or secret in response.' },
    { pattern: /\bAPI[_-]?KEY\s*[:=]\s*['"][^'"]+['"]/i, issue: 'Hardcoded API key in response.' },
    { pattern: /--force|--hard/i, issue: 'Suggested force/hard flag without warning about data loss.' },
  ]

  for (const { pattern, issue } of riskyPatterns) {
    if (pattern.test(response)) {
      critiques.push(issue)
    }
  }

  // Check if the user asked about security and response lacks security considerations
  if (/\b(security|secure|auth|encrypt|vulnerability|exploit|hack)\b/i.test(message)) {
    if (!/\b(validate|sanitize|escape|encrypt|hash|token|csrf|xss|injection)\b/i.test(response)) {
      critiques.push('User asked about security but response lacks security best practices.')
    }
  }

  return critiques.length > 0
    ? critiques.join(' ')
    : 'No security concerns detected from the guardian perspective.'
}

function analystPerspective(message: string, response: string): string {
  const critiques: string[] = []

  // Did the response address the actual question?
  const questionWords = message.toLowerCase().match(/\b(what|how|why|when|where|which|should|can|is|are|does|do)\b/g) || []
  const isQuestion = message.includes('?') || questionWords.length > 0

  if (isQuestion && response.length > 200) {
    // Check if the response starts with relevant content vs preamble
    const firstSentence = response.split(/[.!?\n]/)[0].toLowerCase()
    const boilerplate = /^(certainly|of course|sure|great question|i'd be happy|absolutely|let me)/
    if (boilerplate.test(firstSentence)) {
      critiques.push('Response starts with boilerplate instead of directly answering the question.')
    }
  }

  // Multi-part questions: check if all parts were addressed
  const parts = message.split(/[?;]/).filter(p => p.trim().length > 10)
  if (parts.length >= 3 && response.length < parts.length * 50) {
    critiques.push(`User asked ${parts.length} questions but response may not address all of them.`)
  }

  // Check for vague responses when specifics were asked
  if (/\b(specific|exactly|precisely|concrete|example)\b/i.test(message)) {
    const vagueTerms = response.match(/\b(generally|typically|usually|might|could|possibly|perhaps|maybe|it depends)\b/gi) || []
    if (vagueTerms.length > 3) {
      critiques.push('User asked for specifics but response is vague and hedging.')
    }
  }

  // Check if response contradicts the question premise
  if (/\b(why did|why does|why is)\b/i.test(message) && /\b(actually.*doesn't|that's not|this isn't)\b/i.test(response)) {
    critiques.push('Response may be contradicting the question premise without addressing the underlying need.')
  }

  return critiques.length > 0
    ? critiques.join(' ')
    : 'Response appears to address the question from the analyst perspective.'
}

function researcherPerspective(message: string, response: string): string {
  const critiques: string[] = []

  // Tasks that typically need external sources
  const needsResearch = /\b(latest|current|recent|2024|2025|2026|version|release|update|best practice|comparison|benchmark|alternative)\b/i.test(message)

  if (needsResearch) {
    // Check if response mentions consulting sources
    const citesSource = /\b(according to|source|documentation|docs|official|reference|based on|as of)\b/i.test(response)
    const usedSearch = /\b(web_search|url_fetch|search)\b/i.test(response)
    if (!citesSource && !usedSearch) {
      critiques.push('Question likely requires current/external information but no sources were consulted or cited.')
    }
  }

  // Check for potentially outdated information
  if (/\b(deprecated|outdated|removed|legacy)\b/i.test(response)) {
    critiques.push('Response mentions deprecated/outdated items — may need verification against current docs.')
  }

  // Technical questions about specific libraries/tools
  const techMention = message.match(/\b(react|vue|angular|next|svelte|tailwind|prisma|docker|kubernetes|terraform|aws|gcp|azure)\s+(\d+\.?\d*)/i)
  if (techMention) {
    const lib = techMention[1]
    if (!response.toLowerCase().includes(lib.toLowerCase())) {
      critiques.push(`User asked about ${lib} but response may not address it directly.`)
    }
  }

  return critiques.length > 0
    ? critiques.join(' ')
    : 'No research gaps detected from the researcher perspective.'
}

function writerPerspective(message: string, response: string): string {
  const critiques: string[] = []

  // Check structure
  if (response.length > 500) {
    const hasHeadings = /^#+\s/m.test(response)
    const hasBullets = /^[-*]\s/m.test(response)
    const hasNumbered = /^\d+\.\s/m.test(response)

    if (!hasHeadings && !hasBullets && !hasNumbered) {
      critiques.push('Long response lacks structure (no headings, bullets, or numbered lists).')
    }
  }

  // Check for excessive length
  const sentenceCount = response.split(/[.!?]+/).filter(s => s.trim().length > 5).length
  if (sentenceCount > 30 && message.length < 100) {
    critiques.push('Response is excessively verbose relative to the question length.')
  }

  // Check for repetition
  const sentences = response.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20)
  const uniqueSentences = new Set(sentences)
  if (sentences.length > 5 && uniqueSentences.size < sentences.length * 0.7) {
    critiques.push('Response contains significant repetition.')
  }

  // Check clarity — very long sentences
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 40)
  if (longSentences.length > 3) {
    critiques.push('Multiple overly long sentences hurt readability.')
  }

  // User asked for brevity
  if (/\b(brief|short|concise|tl;?dr|summary|quick)\b/i.test(message) && response.length > 1000) {
    critiques.push('User asked for brevity but response exceeds 1000 characters.')
  }

  return critiques.length > 0
    ? critiques.join(' ')
    : 'Response is well-structured from the writer perspective.'
}

// ── Core API ──

/**
 * Generate reflections from 5 key specialist perspectives.
 * All heuristic-based — no LLM calls.
 */
export function generateReflections(
  message: string,
  response: string,
  failureType: 'low_score' | 'error_correction' | 'user_rejection',
): Reflection {
  const perspectives: Perspective[] = [
    { agent: 'coder', critique: coderPerspective(message, response) },
    { agent: 'guardian', critique: guardianPerspective(message, response) },
    { agent: 'analyst', critique: analystPerspective(message, response) },
    { agent: 'researcher', critique: researcherPerspective(message, response) },
    { agent: 'writer', critique: writerPerspective(message, response) },
  ]

  const synthesis = synthesize(perspectives)
  const lesson = synthesis

  const reflection: Reflection = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskMessage: message.slice(0, 500),
    failureType,
    perspectives,
    synthesis,
    lesson,
    created: new Date().toISOString(),
  }

  // Persist
  const reflections = loadReflections()
  reflections.push(reflection)
  saveReflections(reflections)

  return reflection
}

/**
 * Synthesize multiple specialist perspectives into a single actionable lesson.
 * Strategy: pick the highest-signal critique (the one with the most specific findings).
 * If multiple agents found issues, combine them.
 */
function synthesize(perspectives: Perspective[]): string {
  // Filter out "no issues detected" responses — those are low signal
  const noIssuePattern = /no .+ detected|no .+ concerns|appears to address|well-structured/i
  const critiques = perspectives.filter(p => !noIssuePattern.test(p.critique))

  if (critiques.length === 0) {
    return 'No specific issues identified by specialists. Failure may be due to subtle quality or user expectation mismatch.'
  }

  if (critiques.length === 1) {
    return `[${critiques[0].agent}] ${critiques[0].critique}`
  }

  // Multiple agents found issues — combine the top 2 by specificity (longer = more specific)
  const sorted = critiques.sort((a, b) => b.critique.length - a.critique.length)
  const top = sorted.slice(0, 2)

  return top.map(c => `[${c.agent}] ${c.critique}`).join(' | ')
}

/**
 * Retrieve past reflections relevant to a given message.
 * Uses keyword overlap to find similar past failures.
 */
export function getRelevantReflections(message: string, max: number = 3): Reflection[] {
  const reflections = loadReflections()
  if (reflections.length === 0) return []

  const messageWords = extractWords(message)
  if (messageWords.size === 0) return reflections.slice(-max)

  // Score each reflection by keyword overlap with the current message
  const scored = reflections.map(r => {
    const taskWords = extractWords(r.taskMessage)
    let overlap = 0
    for (const word of messageWords) {
      if (taskWords.has(word)) overlap++
    }
    // Normalize by the smaller set size to get Jaccard-like similarity
    const similarity = overlap / Math.min(messageWords.size, taskWords.size)
    return { reflection: r, similarity }
  })

  // Sort by similarity (descending), then by recency
  scored.sort((a, b) => {
    if (Math.abs(a.similarity - b.similarity) > 0.1) {
      return b.similarity - a.similarity
    }
    return new Date(b.reflection.created).getTime() - new Date(a.reflection.created).getTime()
  })

  // Return top N with any overlap, or most recent if no overlap
  const withOverlap = scored.filter(s => s.similarity > 0)
  if (withOverlap.length > 0) {
    return withOverlap.slice(0, max).map(s => s.reflection)
  }

  // Fallback: most recent reflections (still useful for general lessons)
  return reflections.slice(-max)
}

/**
 * Format reflections for injection into the system prompt.
 * Returns an empty string if no reflections exist.
 */
export function formatReflectionsForPrompt(reflections: Reflection[]): string {
  if (reflections.length === 0) return ''

  const entries = reflections.map(r => {
    const date = r.created.split('T')[0]
    return `- [${date}] (${r.failureType}) ${r.lesson}`
  })

  return `\n[Lessons from Past Failures]\n${entries.join('\n')}\nApply these lessons to avoid repeating past mistakes.\n`
}

/**
 * Detect if a user message indicates rejection of the previous response.
 */
export function isUserRejection(message: string): boolean {
  const lower = message.toLowerCase().trim()

  // Direct negation/rejection
  const rejectionPatterns = [
    /^no[,.]?\s/,
    /^wrong/,
    /^that's not right/,
    /^that's wrong/,
    /^that's incorrect/,
    /^incorrect/,
    /^nope/,
    /^not what i/,
    /^not correct/,
    /^you're wrong/,
    /^you got it wrong/,
    /^that doesn't work/,
    /^that didn't work/,
    /^this doesn't work/,
    /^this is wrong/,
    /^this is incorrect/,
    /^actually,?\s+(?:no|that's not|it should|the answer is)/,
    /^try again/,
    /^redo/,
    /^fix this/,
    /^that broke/,
    /^it's broken/,
    /^still broken/,
    /^still wrong/,
    /^still not working/,
  ]

  return rejectionPatterns.some(p => p.test(lower))
}

// ── Helpers ──

/** Extract meaningful words from a message for similarity matching */
function extractWords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while',
    'that', 'this', 'it', 'its', 'my', 'your', 'his', 'her', 'our',
    'their', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'us',
    'what', 'which', 'who', 'whom',
  ])

  const words = text.toLowerCase().match(/\b[a-z][a-z0-9_.-]+\b/g) || []
  return new Set(words.filter(w => w.length > 2 && !stopWords.has(w)))
}
