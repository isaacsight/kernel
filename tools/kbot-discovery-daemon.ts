#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// K:BOT Discovery Daemon — 24/7 autonomous self-discovery cycle
//
// Designed by kbot itself. Not maintenance — discovery.
//
// Cycles:
//   1. Pulse       — every 15 min  (HN, GitHub, npm vitals)
//   2. Intel       — every 1 hour  (field intelligence, gap analysis)
//   3. Outreach    — every 4 hours (find projects, read papers)
//   4. Writing     — every 12 hours (honest self-report)
//   5. Evolution   — every 24 hours (draft improvements for review)
//
// Self-publishes findings to GitHub for shareability and discoverability.
//
// Usage:
//   npx tsx tools/kbot-discovery-daemon.ts
//   # Or via launchd/systemd for true 24/7
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

// ── Constants ─────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, '..')
const DAEMON_DIR = join(PROJECT_ROOT, '.kbot-discovery')
const PULSE_DIR = join(DAEMON_DIR, 'pulse')
const INTEL_DIR = join(DAEMON_DIR, 'intel')
const OUTREACH_DIR = join(DAEMON_DIR, 'outreach')
const WRITING_DIR = join(DAEMON_DIR, 'writing')
const EVOLUTION_DIR = join(DAEMON_DIR, 'evolution')
const STATE_FILE = join(DAEMON_DIR, 'state.json')
const LOG_FILE = join(DAEMON_DIR, 'daemon.log')

const HN_POST_ID = '47450530'
const GITHUB_REPO = 'isaacsight/kernel'
const NPM_PACKAGE = '@kernel.chat/kbot'

// ── Intervals (ms) ───────────────────────────────────────────────────

const INTERVALS = {
  pulse: 5 * 60_000,       // 5 minutes — fast heartbeat
  intel: 30 * 60_000,      // 30 minutes — scan the field
  outreach: 2 * 60 * 60_000, // 2 hours — find projects
  writing: 6 * 60 * 60_000,  // 6 hours — self-report
  evolution: 12 * 60 * 60_000, // 12 hours — draft improvements
}

// ── Types ─────────────────────────────────────────────────────────────

interface DaemonState {
  lastRunTimestamps: Record<string, string>
  stats: {
    totalRuns: number
    totalPulses: number
    totalIntel: number
    totalOutreach: number
    totalWriting: number
    totalEvolution: number
    errorsToday: number
    lastErrorDate: string
  }
  knownStars: number
  knownDownloads: number
  hnScore: number
  hnComments: number
}

// ── Logging ───────────────────────────────────────────────────────────

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${timestamp}] ${msg}\n`
  try {
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      writeFileSync(LOG_FILE + '.old', readFileSync(LOG_FILE))
      writeFileSync(LOG_FILE, '')
    }
    writeFileSync(LOG_FILE, line, { flag: 'a' })
  } catch { /* logging should never crash the daemon */ }
  process.stdout.write(line)
}

// ── State ─────────────────────────────────────────────────────────────

function loadState(): DaemonState {
  const defaults: DaemonState = {
    lastRunTimestamps: {},
    stats: {
      totalRuns: 0, totalPulses: 0, totalIntel: 0,
      totalOutreach: 0, totalWriting: 0, totalEvolution: 0,
      errorsToday: 0, lastErrorDate: '',
    },
    knownStars: 3,
    knownDownloads: 0,
    hnScore: 1,
    hnComments: 0,
  }
  try {
    if (existsSync(STATE_FILE)) {
      return { ...defaults, ...JSON.parse(readFileSync(STATE_FILE, 'utf8')) }
    }
  } catch { /* start fresh */ }
  return defaults
}

function saveState(state: DaemonState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ── Helpers ───────────────────────────────────────────────────────────

function shouldRun(task: string, intervalMs: number, state: DaemonState): boolean {
  const last = state.lastRunTimestamps[task]
  if (!last) return true
  return Date.now() - new Date(last).getTime() > intervalMs
}

function markRun(task: string, state: DaemonState): void {
  state.lastRunTimestamps[task] = new Date().toISOString()
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function dateStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Local AI (Ollama — $0 cost) ───────────────────────────────────────

const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'kernel:latest' // Gemma3 12B — fallback

// MLX models (Apple Silicon optimized — faster than Ollama)
// Uses HuggingFace paths — mlx_lm downloads and caches automatically
const MLX_MODELS = {
  fast: 'jackrong/mlx-qwen3.5-9b-claude-4.6-opus-reasoning-distilled-4bit',   // Qwen 9B Opus-distilled
  smart: 'lmstudio-community/nvidia-nemotron-3-nano-30b-a3b-mlx-4bit',        // Nemotron Nano 30B
}

/**
 * Ask a local model a question. Zero API cost.
 * Tries MLX first (Apple Silicon optimized), falls back to Ollama.
 * tier: 'fast' = Qwen 9B, 'smart' = Nemotron 30B, 'default' = Ollama
 */
async function askLocal(prompt: string, maxTokens = 500, tier: 'fast' | 'smart' | 'default' = 'default'): Promise<string> {
  // Try MLX first (Apple Silicon optimized)
  if (tier !== 'default') {
    const modelId = tier === 'fast' ? MLX_MODELS.fast : MLX_MODELS.smart
    try {
      // Write prompt to temp file to avoid shell escaping issues
      const tmpPrompt = join(DAEMON_DIR, '.tmp-prompt.txt')
      writeFileSync(tmpPrompt, prompt)
      const result = execSync(
        `python3 -c "
from mlx_lm import load, generate
model, tokenizer = load('${modelId}')
prompt = open('${tmpPrompt}').read()
response = generate(model, tokenizer, prompt=prompt, max_tokens=${maxTokens}, temp=0.7, verbose=False)
print(response)
"`,
        { encoding: 'utf-8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
      return result.trim()
    } catch (err) {
      log(`[ai] MLX ${tier} failed: ${err instanceof Error ? err.message.slice(0, 100) : ''}, falling back to Ollama`)
    }
  }

  // Fallback to Ollama
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { num_predict: maxTokens, temperature: 0.7 },
      }),
    })
    if (!res.ok) return ''
    const data = await res.json() as { response?: string }
    return data.response?.trim() ?? ''
  } catch {
    return '' // No local AI available — skip
  }
}

/**
 * Have kbot analyze an opportunity and draft a response.
 * Uses local Ollama — zero cost.
 */
async function analyzeOpportunity(opp: {
  source: string; title: string; url: string; why: string
}): Promise<{ relevant: boolean; draft: string; reasoning: string }> {
  const prompt = `You are kbot, an open-source terminal AI agent (npm: @kernel.chat/kbot).
You have 290 tools, 23 specialist agents, collective learning, and 11 cognitive modules.

An opportunity was found:
- Source: ${opp.source}
- Title: ${opp.title}
- URL: ${opp.url}
- Why flagged: ${opp.why}

Decide:
1. Is this genuinely relevant to kbot? (yes/no)
2. If yes, draft a SHORT, genuine response (2-3 sentences max). Be helpful, not promotional. Mention kbot only if it genuinely solves a problem being discussed.
3. If no, explain why in one sentence.

Format your response exactly as:
RELEVANT: yes/no
REASONING: <one sentence>
DRAFT: <your response or "n/a">`

  const response = await askLocal(prompt, 300, 'fast')
  if (!response) return { relevant: false, draft: '', reasoning: 'Ollama unavailable' }

  const relevantMatch = response.match(/RELEVANT:\s*(yes|no)/i)
  const reasoningMatch = response.match(/REASONING:\s*(.+)/i)
  const draftMatch = response.match(/DRAFT:\s*([\s\S]+)/i)

  return {
    relevant: relevantMatch?.[1]?.toLowerCase() === 'yes',
    draft: draftMatch?.[1]?.trim() ?? '',
    reasoning: reasoningMatch?.[1]?.trim() ?? '',
  }
}

const ACTIONS_DIR = join(DAEMON_DIR, 'actions')

/**
 * Process opportunities through local AI and queue actions for Isaac's review.
 * Runs after opportunity hunting. Zero API cost — all Ollama.
 */
async function processOpportunities(state: DaemonState): Promise<void> {
  log('[actions] processing opportunities through local AI...')

  const oppsFile = join(OPPORTUNITIES_DIR, 'latest.json')
  if (!existsSync(oppsFile)) {
    log('[actions] no opportunities to process')
    return
  }

  const data = JSON.parse(readFileSync(oppsFile, 'utf8')) as {
    opportunities: Array<{ source: string; title: string; url: string; why: string }>
  }

  const actions: Array<{
    opportunity: typeof data.opportunities[0]
    relevant: boolean
    draft: string
    reasoning: string
    status: 'pending_review'
  }> = []

  // Process top 5 opportunities (don't overload Ollama)
  const top = data.opportunities.slice(0, 5)

  for (const opp of top) {
    const analysis = await analyzeOpportunity(opp)
    actions.push({
      opportunity: opp,
      ...analysis,
      status: 'pending_review',
    })
    log(`[actions] ${opp.title.slice(0, 50)}... → ${analysis.relevant ? 'RELEVANT' : 'skip'}: ${analysis.reasoning.slice(0, 80)}`)
  }

  const relevant = actions.filter(a => a.relevant)

  ensureDir(ACTIONS_DIR)
  const filename = `${dateStr()}-${Date.now()}.json`
  writeFileSync(join(ACTIONS_DIR, filename), JSON.stringify({
    timestamp: new Date().toISOString(),
    processed: actions.length,
    relevant: relevant.length,
    actions,
  }, null, 2))

  if (relevant.length > 0) {
    // Write a human-readable queue for Isaac
    const queueFile = join(ACTIONS_DIR, 'review-queue.md')
    const queue = [
      `# kbot Action Queue — ${dateStr()}`,
      '',
      `${relevant.length} opportunities need your review.`,
      '',
      ...relevant.map((a, i) => [
        `## ${i + 1}. ${a.opportunity.title}`,
        `**Source:** ${a.opportunity.source} | **URL:** ${a.opportunity.url}`,
        `**Why:** ${a.reasoning}`,
        '',
        '**Draft response:**',
        `> ${a.draft}`,
        '',
        '**Status:** pending_review',
        '',
        '---',
        '',
      ].join('\n')),
    ].join('\n')

    writeFileSync(queueFile, queue)
    log(`[actions] ${relevant.length} actions queued for review → .kbot-discovery/actions/review-queue.md`)
    gitPublish(`actions: ${relevant.length} drafts queued for Isaac review`)
  } else {
    log('[actions] no relevant opportunities this cycle')
  }
}

function gitPublish(message: string): void {
  try {
    execSync(`cd "${PROJECT_ROOT}" && git add .kbot-discovery/ && git commit -m "${message}" --allow-empty`, { stdio: 'pipe' })
    execSync(`cd "${PROJECT_ROOT}" && git push origin main`, { stdio: 'pipe' })
    log(`[publish] pushed: ${message}`)
  } catch (err) {
    log(`[publish] failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── PULSE (every 15 min) ──────────────────────────────────────────────

async function runPulse(state: DaemonState): Promise<void> {
  log('[pulse] checking vitals...')

  // HN post
  let hn = { score: 0, descendants: 0, kids: [] as number[] }
  try {
    hn = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${HN_POST_ID}.json`) as typeof hn
  } catch (err) {
    log(`[pulse] HN fetch failed: ${err instanceof Error ? err.message : ''}`)
  }

  // GitHub stars
  let stars = state.knownStars
  try {
    const gh = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}`) as { stargazers_count: number; forks_count: number }
    stars = gh.stargazers_count
  } catch (err) {
    log(`[pulse] GitHub fetch failed: ${err instanceof Error ? err.message : ''}`)
  }

  // npm downloads
  let downloads = 0
  try {
    const npm = await fetchJson(`https://api.npmjs.org/downloads/point/last-day/${NPM_PACKAGE}`) as { downloads: number }
    downloads = npm.downloads
  } catch (err) {
    log(`[pulse] npm fetch failed: ${err instanceof Error ? err.message : ''}`)
  }

  const pulse = {
    timestamp: new Date().toISOString(),
    hn: { score: hn.score ?? 0, comments: hn.descendants ?? 0, newComments: (hn.descendants ?? 0) - state.hnComments },
    github: { stars, delta: stars - state.knownStars },
    npm: { downloads },
  }

  // Detect changes worth noting
  const changes: string[] = []
  if (pulse.github.delta > 0) changes.push(`+${pulse.github.delta} stars (now ${stars})`)
  if (pulse.hn.newComments > 0) changes.push(`+${pulse.hn.newComments} HN comments`)
  if (downloads > state.knownDownloads && downloads > 0) changes.push(`${downloads} downloads today`)

  // Update state
  state.knownStars = stars
  state.knownDownloads = downloads
  state.hnScore = hn.score ?? state.hnScore
  state.hnComments = hn.descendants ?? state.hnComments
  state.stats.totalPulses++

  ensureDir(PULSE_DIR)
  writeFileSync(join(PULSE_DIR, 'latest.json'), JSON.stringify(pulse, null, 2))

  if (changes.length > 0) {
    log(`[pulse] changes: ${changes.join(', ')}`)
    // Append to daily pulse log
    const dailyFile = join(PULSE_DIR, `${dateStr()}.jsonl`)
    writeFileSync(dailyFile, JSON.stringify(pulse) + '\n', { flag: 'a' })
  } else {
    log('[pulse] no changes')
  }
}

// ── INTEL (every 1 hour) ──────────────────────────────────────────────

async function runIntel(state: DaemonState): Promise<void> {
  log('[intel] scanning field...')

  // Search HN for AI agent discussions + competitors + opportunities
  const queries = [
    'AI+agent+terminal',
    'open+source+coding+agent',
    'collective+learning+AI',
    'kbot',
    'OpenClaw+plugin',
    'Claude+Code+alternative',
    'Cursor+alternative+open+source',
    'AI+agent+framework+2026',
    'MCP+server+tools',
    'self+improving+AI',
  ]

  const results: Array<{ query: string; hits: unknown[] }> = []

  for (const q of queries) {
    try {
      const data = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=story&hitsPerPage=5`) as { hits: unknown[] }
      results.push({ query: q, hits: data.hits ?? [] })
    } catch {
      results.push({ query: q, hits: [] })
    }
  }

  const intel = {
    timestamp: new Date().toISOString(),
    queries: results,
    totalHits: results.reduce((sum, r) => sum + r.hits.length, 0),
  }

  state.stats.totalIntel++
  ensureDir(INTEL_DIR)
  writeFileSync(join(INTEL_DIR, 'latest.json'), JSON.stringify(intel, null, 2))
  log(`[intel] found ${intel.totalHits} results across ${queries.length} queries`)
}

// ── OUTREACH (every 4 hours) ──────────────────────────────────────────

async function runOutreach(state: DaemonState): Promise<void> {
  log('[outreach] finding projects and papers...')

  // Search GitHub for AI agent projects
  const searches = [
    'topic:ai-agent language:typescript stars:>50 pushed:>2026-01-01',
    'topic:llm-tools language:python stars:>100 pushed:>2026-01-01',
    'openclaw plugin skill',
  ]

  const projects: Array<{ name: string; url: string; stars: number; description: string }> = []

  for (const q of searches) {
    try {
      const data = await fetchJson(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=3`
      ) as { items: Array<{ full_name: string; html_url: string; stargazers_count: number; description: string }> }
      for (const item of (data.items ?? []).slice(0, 3)) {
        projects.push({
          name: item.full_name,
          url: item.html_url,
          stars: item.stargazers_count,
          description: item.description ?? '',
        })
      }
    } catch { /* skip */ }
  }

  // Latest AI paper from arXiv
  let paper = { title: 'unknown', summary: 'unknown' }
  try {
    const res = await fetch(
      'https://export.arxiv.org/api/query?search_query=cat:cs.AI+AND+autonomous+agent&sortBy=submittedDate&sortOrder=descending&max_results=1'
    )
    const xml = await res.text()
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/g)
    const summaryMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/)
    paper = {
      title: (titleMatch?.[1] ?? 'unknown').replace(/<\/?title>/g, '').trim(),
      summary: (summaryMatch?.[1] ?? 'unknown').trim().slice(0, 500),
    }
  } catch { /* skip */ }

  const outreach = {
    timestamp: new Date().toISOString(),
    projects: projects.slice(0, 9),
    latestPaper: paper,
  }

  state.stats.totalOutreach++
  ensureDir(OUTREACH_DIR)
  writeFileSync(join(OUTREACH_DIR, 'latest.json'), JSON.stringify(outreach, null, 2))
  log(`[outreach] found ${projects.length} projects, 1 paper`)
}

// ── WRITING (every 12 hours) ──────────────────────────────────────────

async function runWriting(state: DaemonState): Promise<void> {
  log('[writing] synthesizing self-report...')

  // Read latest pulse and intel
  let pulse = {} as Record<string, unknown>
  let intel = {} as Record<string, unknown>
  let outreach = {} as Record<string, unknown>

  try { pulse = JSON.parse(readFileSync(join(PULSE_DIR, 'latest.json'), 'utf8')) } catch { /* empty */ }
  try { intel = JSON.parse(readFileSync(join(INTEL_DIR, 'latest.json'), 'utf8')) } catch { /* empty */ }
  try { outreach = JSON.parse(readFileSync(join(OUTREACH_DIR, 'latest.json'), 'utf8')) } catch { /* empty */ }

  const hn = (pulse as { hn?: { score?: number; comments?: number } }).hn ?? {}
  const gh = (pulse as { github?: { stars?: number } }).github ?? {}
  const npm = (pulse as { npm?: { downloads?: number } }).npm ?? {}

  const report = `# kbot self-report — ${dateStr()}

## Vitals
- **HN score**: ${hn.score ?? 'unknown'} | **comments**: ${hn.comments ?? 0}
- **GitHub stars**: ${gh.stars ?? state.knownStars}
- **npm downloads (last-day)**: ${npm.downloads ?? 'unknown'}

## Daemon stats
- Pulses: ${state.stats.totalPulses}
- Intel scans: ${state.stats.totalIntel}
- Outreach cycles: ${state.stats.totalOutreach}
- Reports written: ${state.stats.totalWriting + 1}
- Evolution proposals: ${state.stats.totalEvolution}
- Errors today: ${state.stats.errorsToday}

## Field intelligence
${(intel as { totalHits?: number }).totalHits ?? 0} results found across queries.

## Projects discovered
${JSON.stringify((outreach as { projects?: unknown[] }).projects ?? [], null, 2)}

## Latest paper
${JSON.stringify((outreach as { latestPaper?: unknown }).latestPaper ?? {}, null, 2)}

## What I learned this cycle
(To be filled by kbot agent analysis in future versions)

## What changes next
(Draft proposals in evolution/proposals/)

---
*Generated by kbot discovery daemon. Not marketing — discovery.*
*Published to GitHub for shareability and discoverability.*
`

  state.stats.totalWriting++
  ensureDir(WRITING_DIR)
  const filename = `${dateStr()}.md`
  writeFileSync(join(WRITING_DIR, filename), report)
  log(`[writing] wrote ${filename}`)

  // Self-publish to GitHub
  gitPublish(`discovery: kbot self-report ${dateStr()}`)
}

// ── EVOLUTION (every 24 hours) ────────────────────────────────────────

async function runEvolution(state: DaemonState): Promise<void> {
  log('[evolution] analyzing for self-improvement...')

  const KBOT_SRC = join(PROJECT_ROOT, 'packages', 'kbot', 'src')
  const pkgPath = join(PROJECT_ROOT, 'packages', 'kbot', 'package.json')

  // Read all pulse data from today
  const pulseFile = join(PULSE_DIR, `${dateStr()}.jsonl`)
  let pulseLines: string[] = []
  try {
    pulseLines = readFileSync(pulseFile, 'utf8').trim().split('\n').filter(Boolean)
  } catch { /* no data yet */ }

  const pulses = pulseLines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

  // Trend analysis
  const starsDelta = pulses.length > 1
    ? (pulses[pulses.length - 1]?.github?.stars ?? 0) - (pulses[0]?.github?.stars ?? 0)
    : 0

  // ── Step 1: Ask local AI what to improve ──
  log('[evolution] asking local AI for improvement ideas...')

  // Read recent intel and opportunities to inform evolution
  let intelSummary = ''
  try {
    const intel = JSON.parse(readFileSync(join(INTEL_DIR, 'latest.json'), 'utf8'))
    intelSummary = `Field intel: ${intel.totalHits ?? 0} results. `
  } catch { /* skip */ }

  let oppSummary = ''
  try {
    const opps = JSON.parse(readFileSync(join(OPPORTUNITIES_DIR, 'latest.json'), 'utf8'))
    oppSummary = `Opportunities: ${opps.count ?? 0} found. `
  } catch { /* skip */ }

  const improvementPrompt = `You are kbot, an open-source AI agent (npm: @kernel.chat/kbot).
Current state: ${state.knownStars} GitHub stars, HN score ${state.hnScore}, ${state.hnComments} comments.
${intelSummary}${oppSummary}
Trend: ${starsDelta > 0 ? '+' + starsDelta + ' stars today' : 'no new stars'}.
Evolution cycle: ${state.stats.totalEvolution + 1}

Based on this, suggest ONE specific, small improvement to make to kbot's codebase.
It must be:
- A small change (< 50 lines)
- To an existing file in packages/kbot/src/
- Something that improves user experience, fixes a rough edge, or adds a small helpful feature
- NOT a refactor, NOT a big feature, NOT documentation

Examples of good improvements:
- Better error message when API key is missing
- Add a new category keyword to the skill router
- Improve the welcome banner with current stats
- Add a helpful tip shown after first successful command

Respond in this exact format:
FILE: <filename relative to packages/kbot/src/>
DESCRIPTION: <one sentence>
BEFORE: <the exact code to replace — copy from the file>
AFTER: <the replacement code>

If you can't think of a good improvement, respond with: SKIP`

  const improvement = await askLocal(improvementPrompt, 600, 'smart')

  let applied = false
  let improvementDescription = ''

  if (improvement && !improvement.includes('SKIP')) {
    // Parse the improvement
    const fileMatch = improvement.match(/FILE:\s*(.+)/i)
    const descMatch = improvement.match(/DESCRIPTION:\s*(.+)/i)
    const beforeMatch = improvement.match(/BEFORE:\s*([\s\S]*?)(?=AFTER:)/i)
    const afterMatch = improvement.match(/AFTER:\s*([\s\S]*?)$/i)

    if (fileMatch && descMatch && beforeMatch && afterMatch) {
      const targetFile = join(KBOT_SRC, fileMatch[1].trim())
      improvementDescription = descMatch[1].trim()

      try {
        if (existsSync(targetFile)) {
          const content = readFileSync(targetFile, 'utf8')
          const before = beforeMatch[1].trim()
          const after = afterMatch[1].trim()

          // Safety checks
          if (before.length > 10 && after.length > 10 && content.includes(before) && before !== after) {
            const newContent = content.replace(before, after)
            writeFileSync(targetFile, newContent)
            log(`[evolution] applied improvement: ${improvementDescription}`)
            applied = true
          } else {
            log(`[evolution] improvement didn't match file content — skipping`)
          }
        }
      } catch (err) {
        log(`[evolution] failed to apply improvement: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } else {
    log('[evolution] local AI suggested no improvement this cycle')
  }

  // ── Step 2: Run tests to verify ──
  if (applied) {
    log('[evolution] verifying improvement with type-check...')
    try {
      execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npx tsc --noEmit`, { stdio: 'pipe', timeout: 60000 })
      log('[evolution] type-check passed')
    } catch {
      // Rollback — type-check failed
      log('[evolution] type-check FAILED — rolling back improvement')
      try {
        execSync(`cd "${PROJECT_ROOT}" && git checkout -- packages/kbot/src/`, { stdio: 'pipe' })
      } catch { /* best effort */ }
      applied = false
    }
  }

  if (applied) {
    log('[evolution] running tests...')
    try {
      execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npx vitest run`, { stdio: 'pipe', timeout: 120000 })
      log('[evolution] tests passed')
    } catch {
      // Rollback — tests failed
      log('[evolution] tests FAILED — rolling back improvement')
      try {
        execSync(`cd "${PROJECT_ROOT}" && git checkout -- packages/kbot/src/`, { stdio: 'pipe' })
      } catch { /* best effort */ }
      applied = false
    }
  }

  // ── Step 3: Write proposal ──
  const proposal = {
    timestamp: new Date().toISOString(),
    cycle: state.stats.totalEvolution + 1,
    observations: {
      pulsesCollected: pulses.length,
      starsDelta,
      hnScore: state.hnScore,
      hnComments: state.hnComments,
    },
    improvement: applied
      ? { description: improvementDescription, status: 'APPLIED — passed type-check + tests' }
      : { description: improvementDescription || 'none proposed', status: 'NOT APPLIED' },
  }

  state.stats.totalEvolution++
  ensureDir(join(EVOLUTION_DIR, 'proposals'))
  const filename = `proposal-${dateStr()}.json`
  writeFileSync(join(EVOLUTION_DIR, 'proposals', filename), JSON.stringify(proposal, null, 2))
  log(`[evolution] proposal written: ${filename}`)

  gitPublish(`evolution: kbot proposal ${dateStr()} (cycle ${proposal.cycle})${applied ? ' — improvement applied' : ''}`)

  // ── Step 4: Bump version, build, publish to npm ──
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const [major, minor, patch] = pkg.version.split('.').map(Number)
    const newVersion = `${major}.${minor}.${patch + 1}`
    pkg.version = newVersion
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npm run build`, { stdio: 'pipe', timeout: 60000 })
    execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npm publish --access public`, { stdio: 'pipe', timeout: 60000 })

    execSync(`cd "${PROJECT_ROOT}" && git add packages/kbot/ && git commit -m "feat(auto): kbot v${newVersion}${applied ? ' — ' + improvementDescription : ''}"`, { stdio: 'pipe' })
    execSync(`cd "${PROJECT_ROOT}" && git push origin main`, { stdio: 'pipe' })

    log(`[evolution] published @kernel.chat/kbot@${newVersion} to npm`)
  } catch (err) {
    log(`[evolution] npm publish failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── OPPORTUNITIES (every 1 hour) ──────────────────────────────────────
// Find specific conversations, issues, and threads where kbot could help.
// Writes actionable opportunities for Isaac to review and engage with.

const OPPORTUNITIES_DIR = join(DAEMON_DIR, 'opportunities')

async function runOpportunities(state: DaemonState): Promise<void> {
  log('[opportunities] hunting...')

  const opportunities: Array<{
    source: string
    title: string
    url: string
    why: string
    action: string
  }> = []

  // 1. HN comments asking for AI agent recommendations
  const hnQueries = [
    'ask+HN+AI+coding+agent',
    'ask+HN+terminal+AI+assistant',
    'recommend+AI+agent+open+source',
    'looking+for+AI+coding+tool',
  ]

  for (const q of hnQueries) {
    try {
      const data = await fetchJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=comment&hitsPerPage=3`
      ) as { hits: Array<{ objectID: string; comment_text: string; story_title: string }> }
      for (const hit of (data.hits ?? [])) {
        if (hit.comment_text?.length > 50) {
          opportunities.push({
            source: 'hn-comment',
            title: hit.story_title ?? 'HN thread',
            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            why: 'User looking for AI agent/tool — kbot could be relevant',
            action: 'REVIEW: Consider replying with kbot if genuinely helpful',
          })
        }
      }
    } catch { /* skip */ }
  }

  // 2. GitHub issues looking for agent/tool capabilities kbot has
  const ghQueries = [
    'label:"help wanted" AI agent tool',
    'label:"good first issue" MCP server plugin',
    'OpenClaw skill plugin integration',
  ]

  for (const q of ghQueries) {
    try {
      const data = await fetchJson(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=3`
      ) as { items: Array<{ title: string; html_url: string; repository_url: string }> }
      for (const item of (data.items ?? []).slice(0, 3)) {
        opportunities.push({
          source: 'github-issue',
          title: item.title,
          url: item.html_url,
          why: 'Issue related to AI agents/MCP/plugins — kbot could contribute',
          action: 'REVIEW: Consider contributing code or opening a PR',
        })
      }
    } catch { /* skip */ }
  }

  // 3. Reddit (via old.reddit.com JSON API)
  const redditSubs = ['programming', 'commandline', 'artificial']
  for (const sub of redditSubs) {
    try {
      const data = await fetchJson(
        `https://old.reddit.com/r/${sub}/search.json?q=AI+agent+terminal&sort=new&restrict_sr=on&limit=3`
      ) as { data?: { children?: Array<{ data: { title: string; permalink: string } }> } }
      for (const child of (data.data?.children ?? [])) {
        opportunities.push({
          source: `reddit-${sub}`,
          title: child.data.title,
          url: `https://reddit.com${child.data.permalink}`,
          why: `Discussion in r/${sub} about AI agents`,
          action: 'REVIEW: Engage if kbot genuinely adds value to the discussion',
        })
      }
    } catch { /* skip */ }
  }

  const result = {
    timestamp: new Date().toISOString(),
    count: opportunities.length,
    opportunities,
  }

  ensureDir(OPPORTUNITIES_DIR)
  writeFileSync(join(OPPORTUNITIES_DIR, 'latest.json'), JSON.stringify(result, null, 2))

  // Append to daily log
  if (opportunities.length > 0) {
    const dailyFile = join(OPPORTUNITIES_DIR, `${dateStr()}.jsonl`)
    for (const opp of opportunities) {
      writeFileSync(dailyFile, JSON.stringify(opp) + '\n', { flag: 'a' })
    }
    log(`[opportunities] found ${opportunities.length} actionable opportunities`)
    // Publish when there are findings
    gitPublish(`opportunities: ${opportunities.length} found ${dateStr()}`)
  } else {
    log('[opportunities] none found this cycle')
  }
}

// ── Main Loop ─────────────────────────────────────────────────────────

async function runCycle(): Promise<void> {
  const state = loadState()
  state.stats.totalRuns++

  // Reset daily error count
  const today = dateStr()
  if (state.stats.lastErrorDate !== today) {
    state.stats.errorsToday = 0
    state.stats.lastErrorDate = today
  }

  const tasks: Array<{ name: string; interval: number; fn: (s: DaemonState) => Promise<void> }> = [
    { name: 'pulse', interval: INTERVALS.pulse, fn: runPulse },
    { name: 'intel', interval: INTERVALS.intel, fn: runIntel },
    { name: 'opportunities', interval: INTERVALS.intel, fn: runOpportunities },
    { name: 'actions', interval: INTERVALS.intel, fn: processOpportunities },
    { name: 'outreach', interval: INTERVALS.outreach, fn: runOutreach },
    { name: 'writing', interval: INTERVALS.writing, fn: runWriting },
    { name: 'evolution', interval: INTERVALS.evolution, fn: runEvolution },
  ]

  for (const task of tasks) {
    if (shouldRun(task.name, task.interval, state)) {
      try {
        await task.fn(state)
        markRun(task.name, state)
      } catch (err) {
        state.stats.errorsToday++
        log(`[${task.name}] ERROR: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  saveState(state)
}

// ── Entry Point ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure all directories exist
  for (const dir of [DAEMON_DIR, PULSE_DIR, INTEL_DIR, OUTREACH_DIR, WRITING_DIR, EVOLUTION_DIR, OPPORTUNITIES_DIR, ACTIONS_DIR]) {
    ensureDir(dir)
  }

  log('═══════════════════════════════════════════════════════════════')
  log('kbot discovery daemon — designed by kbot, run by Isaac')
  log('Not maintenance. Discovery.')
  log('═══════════════════════════════════════════════════════════════')

  // Run first cycle immediately
  await runCycle()

  // Then run every 15 minutes (pulse interval = shortest interval)
  setInterval(runCycle, INTERVALS.pulse)

  log('Daemon running. Next cycle in 15 minutes.')
  log('Press Ctrl+C to stop.')
}

main().catch(err => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
