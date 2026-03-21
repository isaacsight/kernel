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
  pulse: 15 * 60_000,      // 15 minutes
  intel: 60 * 60_000,      // 1 hour
  outreach: 4 * 60 * 60_000, // 4 hours
  writing: 12 * 60 * 60_000, // 12 hours
  evolution: 24 * 60 * 60_000, // 24 hours
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

  // Search HN for AI agent discussions
  const queries = [
    'AI+agent+terminal',
    'open+source+coding+agent',
    'collective+learning+AI',
    'kbot',
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
  log('[evolution] analyzing for improvements...')

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

  const proposal = {
    timestamp: new Date().toISOString(),
    cycle: state.stats.totalEvolution + 1,
    observations: {
      pulsesCollected: pulses.length,
      starsDelta,
      hnScore: state.hnScore,
      hnComments: state.hnComments,
    },
    promptEvolution: {
      candidate: '(to be generated by kbot agent in future versions)',
      rationale: '(based on usage patterns)',
      status: 'DRAFT — awaiting Isaac review',
    },
    toolProposal: {
      name: '(to be identified from field intelligence gaps)',
      description: '(what it does)',
      rationale: '(what users asked for that kbot could not do)',
      status: 'DRAFT — awaiting Isaac review',
    },
  }

  state.stats.totalEvolution++
  ensureDir(join(EVOLUTION_DIR, 'proposals'))
  const filename = `proposal-${dateStr()}.json`
  writeFileSync(join(EVOLUTION_DIR, 'proposals', filename), JSON.stringify(proposal, null, 2))
  log(`[evolution] proposal written: ${filename}`)

  // Self-publish evolution proposals
  gitPublish(`evolution: kbot proposal ${dateStr()} (cycle ${proposal.cycle})`)
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
  for (const dir of [DAEMON_DIR, PULSE_DIR, INTEL_DIR, OUTREACH_DIR, WRITING_DIR, EVOLUTION_DIR]) {
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
