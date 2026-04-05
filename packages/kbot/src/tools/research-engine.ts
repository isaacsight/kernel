/**
 * research-engine.ts — Autonomous Web Research Pipeline
 *
 * kbot discovers new techniques, knowledge, and information from the internet
 * using its own built-in browser. No Chrome, no Playwright — pure HTML.
 *
 * Architecture:
 *   1. Research Queue — tasks from evolution, brain, narrative, user, or autonomous
 *   2. Web Search — kbot_search via DuckDuckGo (built-in browser)
 *   3. Page Reading — kbot_browse for full content extraction
 *   4. Summarization — local Ollama (kernel:latest) for zero-cost summaries
 *   5. Result Storage — ~/.kbot/research-results.json (persists across sessions)
 *   6. Engine Integration — results tagged by applicable engine for routing
 *
 * Tools: research_queue, research_results, research_now
 *
 * Tick-based: tickResearch() called from the frame loop processes one task
 * per interval (default 3600 frames = ~10 min at 6 fps).
 */

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// ─── Constants ──────────────────────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const RESULTS_FILE = join(KBOT_DIR, 'research-results.json')
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'kernel:latest'
const OLLAMA_TIMEOUT = 90_000
const MAX_COMPLETED = 200       // keep last N results in memory
const MAX_PERSISTED = 500       // keep last N results on disk
const MAX_LINKS_TO_READ = 3     // read top N links per search
const DEFAULT_RESEARCH_INTERVAL = 3600  // frames between research tasks (~10 min at 6fps)

// ─── Interfaces ─────────────────────────────────────────────────

export interface ResearchEngine {
  queue: ResearchTask[]
  completed: ResearchResult[]
  activeTask: ResearchTask | null
  lastResearchFrame: number
  researchInterval: number
  topicsOfInterest: string[]
}

export interface ResearchTask {
  id: string
  query: string
  purpose: string
  source: 'evolution' | 'brain' | 'narrative' | 'user' | 'autonomous'
  status: 'queued' | 'searching' | 'reading' | 'summarizing' | 'complete' | 'failed'
  startedAt: number
}

export interface ResearchResult {
  taskId: string
  query: string
  summary: string
  sources: string[]
  keyFindings: string[]
  applicableTo: string[]
  timestamp: number
}

export interface ResearchAction {
  type: 'start_research' | 'search_complete' | 'read_complete' | 'summarize_complete' | 'failed'
  task: ResearchTask
  result?: ResearchResult
  speech?: string
}

// ─── Module State ───────────────────────────────────────────────

let engineState: ResearchEngine | null = null

// ─── Persistence ────────────────────────────────────────────────

function loadResults(): ResearchResult[] {
  try {
    if (existsSync(RESULTS_FILE)) {
      const raw = readFileSync(RESULTS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.slice(-MAX_PERSISTED)
    }
  } catch { /* corrupt file — start fresh */ }
  return []
}

function saveResults(results: ResearchResult[]): void {
  try {
    if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
    const trimmed = results.slice(-MAX_PERSISTED)
    writeFileSync(RESULTS_FILE, JSON.stringify(trimmed, null, 2))
  } catch { /* disk error — non-fatal */ }
}

// ─── Ollama Integration ─────────────────────────────────────────

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function ollamaGenerate(prompt: string, model = OLLAMA_MODEL): Promise<string | null> {
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
        options: { temperature: 0.3, num_predict: 2048 },
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

// ─── Link Extraction ────────────────────────────────────────────

/**
 * Extract URLs from kbot_search / kbot_browse output.
 * The browser format is: `[N] link text` with URLs on the page,
 * plus inline `URL: https://...` lines in the content.
 */
function extractLinks(searchOutput: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  // Match URLs in the output (DuckDuckGo results include them in content)
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(searchOutput)) !== null) {
    const url = match[0].replace(/[.,;:!?]+$/, '')  // trim trailing punctuation
    if (!seen.has(url) && !url.includes('duckduckgo.com') && !url.includes('127.0.0.1')) {
      seen.add(url)
      urls.push(url)
    }
  }

  return urls
}

// ─── Key Findings Extraction ────────────────────────────────────

function extractKeyFindings(summary: string): string[] {
  const findings: string[] = []
  const lines = summary.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Bullet points, numbered items, or lines starting with key phrases
    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const clean = trimmed.replace(/^[-*\d.)\s]+/, '').trim()
      if (clean.length > 15 && clean.length < 300) {
        findings.push(clean)
      }
    }
  }

  // If no structured findings, split summary into sentence-level findings
  if (findings.length === 0) {
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 20)
    for (const s of sentences.slice(0, 5)) {
      findings.push(s.trim())
    }
  }

  return findings.slice(0, 10)
}

// ─── Engine Applicability Detection ─────────────────────────────

const ENGINE_KEYWORDS: Record<string, string[]> = {
  evolution:  ['rendering', 'pixel', 'canvas', 'shader', 'graphics', 'animation', 'parallax', 'palette', 'lighting', 'visual', 'sprite', 'tile', 'effect'],
  narrative:  ['story', 'narrative', 'dialogue', 'character', 'quest', 'lore', 'writing', 'plot', 'world-building', 'fiction'],
  audio:      ['audio', 'sound', 'music', 'synthesizer', 'frequency', 'waveform', 'oscillator', 'reverb', 'filter', 'beat'],
  social:     ['community', 'engagement', 'viewer', 'follower', 'chat', 'moderation', 'streaming', 'audience'],
  brain:      ['ai', 'machine learning', 'neural', 'llm', 'model', 'training', 'inference', 'optimization', 'algorithm'],
  tile:       ['tile', 'map', 'biome', 'terrain', 'procedural generation', 'world', 'dungeon', 'level design'],
  security:   ['security', 'vulnerability', 'exploit', 'cve', 'owasp', 'penetration', 'hardening', 'encryption'],
  research:   ['paper', 'arxiv', 'study', 'methodology', 'experiment', 'hypothesis', 'data', 'analysis'],
}

function detectApplicableEngines(query: string): string[] {
  const lower = query.toLowerCase()
  const applicable: string[] = []

  for (const [engine, keywords] of Object.entries(ENGINE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        applicable.push(engine)
        break
      }
    }
  }

  // Always include 'general' as a catch-all
  if (applicable.length === 0) applicable.push('general')
  return applicable
}

// ─── Summarize with Ollama ──────────────────────────────────────

async function summarizeWithOllama(query: string, content: string): Promise<string> {
  const available = await isOllamaAvailable()
  if (!available) {
    // Fallback: extract first ~500 chars as basic summary
    return content.slice(0, 500).trim() + (content.length > 500 ? '...' : '')
  }

  const truncatedContent = content.slice(0, 8000)  // keep prompt under token limit
  const prompt = [
    'You are a research assistant. Summarize the following web content in relation to the research query.',
    'Extract key findings as bullet points. Be concise and factual.',
    '',
    `Research query: "${query}"`,
    '',
    'Web content:',
    truncatedContent,
    '',
    'Provide:',
    '1. A 2-3 sentence summary',
    '2. Key findings as bullet points (prefix with -)',
    '3. Any actionable techniques or insights',
  ].join('\n')

  const result = await ollamaGenerate(prompt)
  return result || content.slice(0, 500).trim() + (content.length > 500 ? '...' : '')
}

// ─── Autonomous Topic Generation ────────────────────────────────

const AUTONOMOUS_TOPIC_TEMPLATES = [
  'Canvas 2D {technique} optimization',
  '{biome} pixel art reference techniques',
  'ROM hack {technique} implementation',
  'procedural {feature} generation algorithms',
  'indie game {effect} techniques 2026',
  'retro game {style} rendering methods',
  'lo-fi aesthetic {element} techniques',
  'web audio API {feature} tutorial',
  'terminal UI {technique} best practices',
  'AI agent {capability} implementation',
  'real-time {effect} in JavaScript',
  'pixel art {style} color palettes',
]

const TOPIC_FILLS: Record<string, string[]> = {
  technique: ['parallax scrolling', 'palette cycling', 'dithering', 'scanline effects', 'sprite animation', 'tile blending', 'water reflection', 'particle systems'],
  biome: ['forest', 'ocean', 'desert', 'mountain', 'cave', 'tundra', 'swamp', 'volcanic'],
  feature: ['terrain', 'vegetation', 'weather', 'rivers', 'clouds', 'fire', 'fog', 'snow'],
  effect: ['lighting', 'shadow', 'bloom', 'chromatic aberration', 'CRT filter', 'vignette', 'glow', 'distortion'],
  style: ['SNES', 'GBA', 'NES', 'Amiga', 'PC-98', 'C64', 'MSX', 'Genesis'],
  element: ['grain', 'noise', 'halftone', 'dot matrix', 'glitch', 'static', 'tape hiss'],
  capability: ['tool use', 'memory', 'planning', 'self-evaluation', 'context management', 'learning'],
}

export function autonomousResearchTopics(): string[] {
  const topics: string[] = []
  const now = Date.now()

  for (const template of AUTONOMOUS_TOPIC_TEMPLATES) {
    let topic = template
    const placeholders = template.match(/\{(\w+)\}/g) || []
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/[{}]/g, '')
      const options = TOPIC_FILLS[key]
      if (options) {
        // Deterministic-ish pick based on time + template hash
        const hash = template.length + key.length + (now % 10000)
        const pick = options[hash % options.length]
        topic = topic.replace(placeholder, pick)
      }
    }
    topics.push(topic)
  }

  return topics
}

// ─── Core Engine Functions ──────────────────────────────────────

export function initResearchEngine(): ResearchEngine {
  const completed = loadResults()

  const engine: ResearchEngine = {
    queue: [],
    completed,
    activeTask: null,
    lastResearchFrame: 0,
    researchInterval: DEFAULT_RESEARCH_INTERVAL,
    topicsOfInterest: autonomousResearchTopics().slice(0, 5),
  }

  engineState = engine
  return engine
}

export function getResearchEngine(): ResearchEngine {
  if (!engineState) return initResearchEngine()
  return engineState
}

export function queueResearch(
  engine: ResearchEngine,
  query: string,
  purpose: string,
  source: ResearchTask['source'],
): ResearchTask {
  const task: ResearchTask = {
    id: randomUUID().slice(0, 8),
    query,
    purpose,
    source,
    status: 'queued',
    startedAt: 0,
  }
  engine.queue.push(task)
  return task
}

export function getResearchForEngine(engine: ResearchEngine, engineName: string): ResearchResult[] {
  return engine.completed.filter(r => r.applicableTo.includes(engineName))
}

// ─── Research Execution ─────────────────────────────────────────

async function executeResearch(task: ResearchTask): Promise<ResearchResult> {
  const { ensureLazyToolsLoaded, executeTool } = await import('./index.js')
  await ensureLazyToolsLoaded()

  // Search
  task.status = 'searching'
  task.startedAt = Date.now()

  const searchResult = await executeTool({
    id: `research_search_${task.id}`,
    name: 'kbot_search',
    arguments: { query: task.query },
  })

  // Extract links from search results
  const links = extractLinks(searchResult.result)

  // Read top results
  task.status = 'reading'
  let content = searchResult.result  // use search results as baseline

  const readContents: string[] = []
  for (const url of links.slice(0, MAX_LINKS_TO_READ)) {
    try {
      const readResult = await executeTool({
        id: `research_read_${task.id}_${readContents.length}`,
        name: 'kbot_browse',
        arguments: { url },
      })
      if (!readResult.error) {
        readContents.push(readResult.result)
      }
    } catch {
      // Skip failed reads — non-fatal
    }
  }

  if (readContents.length > 0) {
    // Combine: search overview + page content (trimmed)
    content = [
      '## Search Results Overview',
      searchResult.result.slice(0, 2000),
      '',
      ...readContents.map((c, i) => [
        `## Source ${i + 1}`,
        c.slice(0, 4000),
      ].join('\n')),
    ].join('\n')
  }

  // Summarize using local Ollama
  task.status = 'summarizing'
  const summary = await summarizeWithOllama(task.query, content)

  task.status = 'complete'

  return {
    taskId: task.id,
    query: task.query,
    summary,
    sources: links.slice(0, 5),
    keyFindings: extractKeyFindings(summary),
    applicableTo: detectApplicableEngines(task.query),
    timestamp: Date.now(),
  }
}

// ─── Tick (Frame Loop Integration) ──────────────────────────────

export async function tickResearch(engine: ResearchEngine, frame: number): Promise<ResearchAction | null> {
  // Not time yet
  if (frame - engine.lastResearchFrame < engine.researchInterval) return null

  // Already working on something
  if (engine.activeTask) return null

  // Auto-queue autonomous topics if queue is empty
  if (engine.queue.length === 0) {
    const topics = autonomousResearchTopics()
    if (topics.length > 0) {
      // Pick one topic we haven't researched recently
      const recentQueries = new Set(engine.completed.slice(-20).map(r => r.query))
      const fresh = topics.find(t => !recentQueries.has(t))
      if (fresh) {
        queueResearch(engine, fresh, 'Autonomous discovery of new techniques', 'autonomous')
      }
    }
  }

  // Nothing to do
  if (engine.queue.length === 0) return null

  // Pick next task
  const task = engine.queue.shift()!
  engine.activeTask = task
  engine.lastResearchFrame = frame

  try {
    const result = await executeResearch(task)

    // Store result
    engine.completed.push(result)
    if (engine.completed.length > MAX_COMPLETED) {
      engine.completed = engine.completed.slice(-MAX_COMPLETED)
    }
    saveResults(engine.completed)

    engine.activeTask = null

    return {
      type: 'summarize_complete',
      task,
      result,
      speech: `Research complete: "${task.query}" — found ${result.keyFindings.length} key findings.`,
    }
  } catch (err) {
    task.status = 'failed'
    engine.activeTask = null

    return {
      type: 'failed',
      task,
      speech: `Research failed for "${task.query}": ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── Tool Registration ──────────────────────────────────────────

export function registerResearchEngineTools(): void {

  // ── research_queue ──────────────────────────────────────────
  registerTool({
    name: 'research_queue',
    description: 'Queue a web research task for the Research Engine. The engine will search the web, read relevant pages, and summarize findings using local Ollama. Results are persisted to ~/.kbot/research-results.json.',
    parameters: {
      query: { type: 'string', description: 'Search query / research topic', required: true },
      purpose: { type: 'string', description: 'Why this research is needed (guides summarization)' },
      source: { type: 'string', description: 'Source of the request: evolution | brain | narrative | user | autonomous (default: user)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const purpose = String(args.purpose || 'User-requested research')
      const source = (String(args.source || 'user')) as ResearchTask['source']
      const validSources = ['evolution', 'brain', 'narrative', 'user', 'autonomous'] as const
      const safeSource = validSources.includes(source as typeof validSources[number]) ? source : 'user'

      const engine = getResearchEngine()
      const task = queueResearch(engine, query, purpose, safeSource)

      const queuePos = engine.queue.length
      const ollamaUp = await isOllamaAvailable()

      return [
        `# Research Queued`,
        ``,
        `**Task ID**: ${task.id}`,
        `**Query**: ${task.query}`,
        `**Purpose**: ${purpose}`,
        `**Source**: ${safeSource}`,
        `**Queue position**: ${queuePos}`,
        `**Ollama**: ${ollamaUp ? 'available (will summarize with ' + OLLAMA_MODEL + ')' : 'unavailable (will use raw extraction)'}`,
        ``,
        engine.activeTask
          ? `Currently researching: "${engine.activeTask.query}" (${engine.activeTask.status})`
          : 'No active research — will start on next tick.',
        ``,
        `Completed research: ${engine.completed.length} results on file.`,
      ].join('\n')
    },
  })

  // ── research_results ────────────────────────────────────────
  registerTool({
    name: 'research_results',
    description: 'View completed research results. Filter by engine, query, or show all. Results are persisted across sessions in ~/.kbot/research-results.json.',
    parameters: {
      engine: { type: 'string', description: 'Filter results applicable to a specific engine (evolution, narrative, audio, social, brain, tile, security, research, general)' },
      query: { type: 'string', description: 'Filter results by query substring' },
      limit: { type: 'number', description: 'Max results to return (default 10)' },
    },
    tier: 'free',
    async execute(args) {
      const engineFilter = args.engine ? String(args.engine).toLowerCase() : undefined
      const queryFilter = args.query ? String(args.query).toLowerCase() : undefined
      const limit = Number(args.limit) || 10

      const engine = getResearchEngine()
      let results = engine.completed

      if (engineFilter) {
        results = results.filter(r => r.applicableTo.includes(engineFilter))
      }
      if (queryFilter) {
        results = results.filter(r => r.query.toLowerCase().includes(queryFilter))
      }

      results = results.slice(-limit)

      if (results.length === 0) {
        return [
          '# Research Results',
          '',
          'No research results found.',
          engineFilter ? `Filter: engine=${engineFilter}` : '',
          queryFilter ? `Filter: query contains "${queryFilter}"` : '',
          '',
          `Total results on file: ${engine.completed.length}`,
          `Queue: ${engine.queue.length} tasks pending`,
          engine.activeTask ? `Active: "${engine.activeTask.query}" (${engine.activeTask.status})` : 'No active research.',
        ].filter(Boolean).join('\n')
      }

      const lines: string[] = ['# Research Results', '']

      for (const r of results) {
        lines.push(`## ${r.query}`)
        lines.push(`*${new Date(r.timestamp).toISOString().slice(0, 16)}* | Sources: ${r.sources.length} | Engines: ${r.applicableTo.join(', ')}`)
        lines.push('')
        lines.push(r.summary.slice(0, 800))
        if (r.keyFindings.length > 0) {
          lines.push('')
          lines.push('**Key findings:**')
          for (const f of r.keyFindings.slice(0, 5)) {
            lines.push(`- ${f}`)
          }
        }
        if (r.sources.length > 0) {
          lines.push('')
          lines.push('**Sources:**')
          for (const s of r.sources.slice(0, 3)) {
            lines.push(`- ${s}`)
          }
        }
        lines.push('')
        lines.push('---')
        lines.push('')
      }

      lines.push(`Showing ${results.length} of ${engine.completed.length} total results.`)
      lines.push(`Queue: ${engine.queue.length} pending | Active: ${engine.activeTask ? `"${engine.activeTask.query}"` : 'none'}`)

      return lines.join('\n')
    },
  })

  // ── research_now ────────────────────────────────────────────
  registerTool({
    name: 'research_now',
    description: 'Execute a research task immediately (bypasses the queue). Searches the web, reads top results, summarizes with Ollama, and returns findings. Use for urgent research needs.',
    parameters: {
      query: { type: 'string', description: 'Search query / research topic', required: true },
      purpose: { type: 'string', description: 'Why this research is needed' },
    },
    tier: 'free',
    timeout: 120_000,  // 2 min — research involves multiple web requests + Ollama
    async execute(args) {
      const query = String(args.query)
      const purpose = String(args.purpose || 'Immediate research request')

      const engine = getResearchEngine()

      const task: ResearchTask = {
        id: randomUUID().slice(0, 8),
        query,
        purpose,
        source: 'user',
        status: 'queued',
        startedAt: 0,
      }

      try {
        const result = await executeResearch(task)

        // Store result
        engine.completed.push(result)
        if (engine.completed.length > MAX_COMPLETED) {
          engine.completed = engine.completed.slice(-MAX_COMPLETED)
        }
        saveResults(engine.completed)

        const lines: string[] = [
          '# Research Complete',
          '',
          `**Query**: ${result.query}`,
          `**Sources found**: ${result.sources.length}`,
          `**Applicable engines**: ${result.applicableTo.join(', ')}`,
          '',
          '## Summary',
          '',
          result.summary,
          '',
        ]

        if (result.keyFindings.length > 0) {
          lines.push('## Key Findings', '')
          for (const f of result.keyFindings) {
            lines.push(`- ${f}`)
          }
          lines.push('')
        }

        if (result.sources.length > 0) {
          lines.push('## Sources', '')
          for (const s of result.sources) {
            lines.push(`- ${s}`)
          }
          lines.push('')
        }

        lines.push(`*Task ${task.id} completed in ${((Date.now() - task.startedAt) / 1000).toFixed(1)}s*`)

        return lines.join('\n')
      } catch (err) {
        return `Research failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
