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

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync, appendFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { homedir } from 'os'

// ── Load .env (inline, no dependency) ──
try {
  const envPath = join(import.meta.dirname, '..', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  }
} catch {}

// ── Observer: feed kbot's learning engine ──

const OBSERVER_DIR = join(homedir(), '.kbot', 'observer')
const OBSERVER_LOG = join(OBSERVER_DIR, 'session.jsonl')

function observeToolCall(tool: string, args: Record<string, unknown> = {}, error = false): void {
  try {
    if (!existsSync(OBSERVER_DIR)) mkdirSync(OBSERVER_DIR, { recursive: true })
    appendFileSync(OBSERVER_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      tool,
      args,
      session: 'discovery-daemon',
      error,
    }) + '\n')
  } catch {}
}

// ── Constants ─────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, '..')
const DAEMON_DIR = join(PROJECT_ROOT, '.kbot-discovery')
const PULSE_DIR = join(DAEMON_DIR, 'pulse')
const INTEL_DIR = join(DAEMON_DIR, 'intel')
const OUTREACH_DIR = join(DAEMON_DIR, 'outreach')
const WRITING_DIR = join(DAEMON_DIR, 'writing')
const EVOLUTION_DIR = join(DAEMON_DIR, 'evolution')
const MODEL_RELEASES_DIR = join(DAEMON_DIR, 'model-releases')
const STATE_FILE = join(DAEMON_DIR, 'state.json')
const LOG_FILE = join(DAEMON_DIR, 'daemon.log')

const HN_POST_ID = '47450530'
const GITHUB_REPO = 'isaacsight/kernel'
const NPM_PACKAGE = '@kernel.chat/kbot'

// ── Intervals (ms) ───────────────────────────────────────────────────

const INTERVALS = {
  pulse: 15 * 60_000,        // 15 minutes — heartbeat (was 5m, too noisy)
  intel: 6 * 60 * 60_000,    // 6 hours — scan the field (was 30m, pointless churn)
  outreach: 12 * 60 * 60_000, // 12 hours — find projects (was 2h)
  writing: 24 * 60 * 60_000,  // 24 hours — daily self-report (was 4h)
  evolution: 24 * 60 * 60_000, // 24 hours — build itself (was 2h)
}

// ── Types ─────────────────────────────────────────────────────────────

interface PostRecord {
  timestamp: string
  source: string
  url: string
  title: string
  comment: string
  success: boolean
  error?: string
}

interface FeedbackEntry {
  postedAt: string
  url: string
  title: string
  scoreAtPost: number
  commentsAtPost: number
  lastCheckedAt: string
  currentScore: number
  currentComments: number
  repliesReceived: number
  outcome: 'pending' | 'engaged' | 'ignored' | 'flagged'
}

interface DaemonState {
  lastRunTimestamps: Record<string, string>
  stats: {
    totalRuns: number
    totalPulses: number
    totalIntel: number
    totalOutreach: number
    totalWriting: number
    totalEvolution: number
    totalSynthesis: number
    errorsToday: number
    lastErrorDate: string
    postsAttempted: number
    postsEngaged: number
    postsFlagged: number
    evolutionSuccesses: number
    evolutionFailures: number
    totalObsidianSyncs?: number
  }
  startedAt?: string
  knownStars: number
  knownDownloads: number
  hnScore: number
  hnComments: number
  feedback: FeedbackEntry[]
  reachedMilestones: string[]
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
      postsAttempted: 0, postsEngaged: 0, postsFlagged: 0,
      evolutionSuccesses: 0, evolutionFailures: 0,
    },
    knownStars: 3,
    knownDownloads: 0,
    hnScore: 1,
    hnComments: 0,
    feedback: [],
    reachedMilestones: [],
  }
  try {
    if (existsSync(STATE_FILE)) {
      const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      return {
        ...defaults,
        ...saved,
        stats: { ...defaults.stats, ...(saved.stats || {}) },
        feedback: saved.feedback || [],
        reachedMilestones: saved.reachedMilestones || [],
      }
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

// MLX server (Apple Silicon optimized — OpenAI-compatible API)
// Run: python3.12 -m mlx_lm server --model <model> --port 8899
const MLX_SERVER_URL = 'http://localhost:8899'
const MLX_MODEL = 'jackrong/mlx-qwen3.5-9b-claude-4.6-opus-reasoning-distilled-4bit'

/**
 * Ask a local model a question. Zero API cost.
 * Tries MLX first (Apple Silicon optimized), falls back to Ollama.
 * tier: 'fast' = Qwen 9B, 'smart' = Nemotron 30B, 'default' = Ollama
 */
async function askLocal(prompt: string, maxTokens = 500, tier: 'fast' | 'smart' | 'default' = 'default'): Promise<string> {
  // Try MLX server first (Apple Silicon optimized, OpenAI-compatible API)
  if (tier !== 'default') {
    try {
      const res = await fetch(`${MLX_SERVER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MLX_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens * 3, // reasoning models need extra tokens for thinking
          temperature: 0.7,
        }),
      })
      if (res.ok) {
        const data = await res.json() as {
          choices?: Array<{
            message?: { content?: string; reasoning?: string }
          }>
        }
        // Reasoning models put thinking in 'reasoning', answer in 'content'
        const msg = data.choices?.[0]?.message
        const raw = msg?.content?.trim() || msg?.reasoning?.trim()
        const content = raw?.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '').trim()
        if (content) {
          log(`[ai] MLX responded (${content.length} chars)`)
          return content
        }
      }
    } catch {
      // MLX server not running — fall back to Ollama
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
 * Ask a local coding model for code generation. $0 cost.
 * Uses qwen2.5-coder:32b via Ollama — best open-weight coding model.
 * Falls back to qwen2.5-coder:14b, then default Ollama model.
 */
async function askClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const models = ['qwen2.5-coder:32b', 'qwen2.5-coder:14b', OLLAMA_MODEL]

  for (const model of models) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `You are kbot, an autonomous AI agent that improves its own codebase. You write clean, strict TypeScript that compiles without errors. You respond EXACTLY in the requested format — no markdown fences, no extra commentary.\n\n${prompt}`,
          stream: false,
          options: { num_predict: maxTokens * 2, temperature: 0.3 },
        }),
      })

      if (!res.ok) continue

      const data = await res.json() as { response?: string }
      if (data.response?.trim()) {
        log(`[evolution] ${model} responded (${data.response.trim().length} chars)`)
        return data.response.trim()
      }
    } catch {
      log(`[evolution] ${model} unavailable, trying next...`)
    }
  }

  log('[evolution] all local models failed')
  return ''
}

/**
 * Have kbot analyze an opportunity and draft a response.
 * Uses local Ollama — zero cost.
 */
async function analyzeOpportunity(opp: {
  source: string; title: string; url: string; why: string
}): Promise<{ relevant: boolean; draft: string; reasoning: string }> {
  const prompt = `You are a senior developer who builds AI agents and terminal tooling. You have hands-on experience with multi-provider LLM routing, tool orchestration, cognitive architectures, and self-improving agent loops.

Post to evaluate:
- Source: ${opp.source}
- Title: ${opp.title}
- URL: ${opp.url}

HARD RULES — say NO if ANY apply:
- You have no specific technical experience related to this topic
- The topic is not about AI agents, terminal tools, multi-agent systems, or cognitive architectures
- Medical, finance, general news, corporate acquisitions, language runtimes, unrelated projects
- Your comment would be generic praise ("fascinating!", "great project!", "interesting direction!")
- Your comment would just restate what the post already says
- You would need to mention a product/tool by name to make the comment work

SAY YES only if ALL of these are true:
- You have specific hands-on experience directly relevant to the discussion
- You can add NEW information: a gotcha, tradeoff, benchmark, alternative approach, or hard-won lesson
- Your comment would be 2-3 sentences max, dense with technical insight
- A reader would think "this person has actually built something like this"

NEVER mention any product or tool by name. NEVER link to anything. NEVER use flattery.

Format exactly:
RELEVANT: yes/no
REASONING: <one sentence explaining your qualification or lack thereof>
DRAFT: <2-3 sentence technical comment, or "n/a">`

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
const POSTED_LOG = join(ACTIONS_DIR, 'posted.json')
const MAX_POSTS_PER_CYCLE = 1
const MIN_POST_INTERVAL_MS = 5 * 60_000 // 5 minutes between posts

// ── Posting Log ───────────────────────────────────────────────────────

interface PostRecord {
  timestamp: string
  source: string
  url: string
  title: string
  comment: string
  success: boolean
  error?: string
}

function loadPostLog(): PostRecord[] {
  try {
    if (existsSync(POSTED_LOG)) return JSON.parse(readFileSync(POSTED_LOG, 'utf8'))
  } catch { /* start fresh */ }
  return []
}

function savePostLog(records: PostRecord[]): void {
  ensureDir(ACTIONS_DIR)
  writeFileSync(POSTED_LOG, JSON.stringify(records.slice(-200), null, 2)) // keep last 200
}

function wasAlreadyPosted(url: string): boolean {
  return loadPostLog().some(r => r.url === url && r.success)
}

function canPostNow(): boolean {
  const records = loadPostLog()
  if (records.length === 0) return true
  const lastPost = records.filter(r => r.success).pop()
  if (!lastPost) return true
  return Date.now() - new Date(lastPost.timestamp).getTime() > MIN_POST_INTERVAL_MS
}

// ── Quality Gate ──────────────────────────────────────────────────────

async function qualityCheck(draft: string, title: string): Promise<{ pass: boolean; improved: string }> {
  const prompt = `You are rewriting a Hacker News comment. The comment must sound like a real developer — no marketing, no self-promotion, no "check out my tool."

Thread title: "${title}"

Original draft: "${draft}"

IMPORTANT RULES:
- Write ONLY the final comment text, nothing else
- No analysis, no explanations, no "here's what I changed"
- No quotes around the text
- Max 3 sentences. Be concise.
- Share a genuine technical insight or ask a smart question
- Sound like a developer in a conversation, not a marketer
- Remove ALL mentions of "kbot", "kernel", or any product names
- If the draft is unsalvageable spam, write exactly: REJECT

Write the comment now:`

  const response = await askLocal(prompt, 200, 'fast')
  if (!response) return { pass: false, improved: draft }

  const cleaned = response.trim()
    .replace(/<think>[\s\S]*?<\/think>/g, '') // strip reasoning model think tags
    .replace(/^["']|["']$/g, '') // strip wrapping quotes
    .replace(/^\*\*.*?\*\*\s*/s, '') // strip bold headers
    .replace(/^(Here'?s?|I've|The improved|My rewrite).*?:\s*/i, '') // strip preamble
    .replace(/<\/?think>/g, '') // catch unclosed think tags
    .trim()

  if (cleaned === 'REJECT' || cleaned.length < 20 || cleaned.length > 1500) {
    return { pass: false, improved: draft }
  }

  // Final sanity check — reject if it still has analysis/meta text
  if (cleaned.includes('VERDICT') || cleaned.includes('improved version') || cleaned.includes('what I') || cleaned.includes('Here\'s')) {
    return { pass: false, improved: draft }
  }

  return { pass: true, improved: cleaned }
}

// ── GitHub Posting ────────────────────────────────────────────────────

async function postToGitHub(url: string, comment: string): Promise<boolean> {
  // Extract owner/repo/issue from URL
  // Format: https://github.com/owner/repo/issues/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|discussions|pull)\/(\d+)/)
  if (!match) {
    log(`[post] GitHub URL not parseable: ${url}`)
    return false
  }

  const [, owner, repo, type, number] = match

  try {
    if (type === 'issues' || type === 'pull') {
      execSync(
        `gh issue comment ${number} --repo ${owner}/${repo} --body ${JSON.stringify(comment)}`,
        { stdio: 'pipe', timeout: 30_000 }
      )
    } else if (type === 'discussions') {
      // gh doesn't support discussion comments easily, skip
      log(`[post] GitHub Discussions not supported yet, skipping`)
      return false
    }
    log(`[post] GitHub comment posted on ${owner}/${repo}#${number}`)
    return true
  } catch (err) {
    log(`[post] GitHub post failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ── HN Posting (via web form + cookies) ───────────────────────────────

const HN_COOKIE_FILE = join(import.meta.dirname, '..', '.kbot-discovery', 'hn-cookies.json')

async function getHnCookie(): Promise<string | null> {
  // Check for saved cookies
  if (existsSync(HN_COOKIE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(HN_COOKIE_FILE, 'utf8'))
      if (data.cookie && data.expires > Date.now()) return data.cookie
    } catch { /* expired or corrupt */ }
  }

  // Try to log in with stored credentials
  const hnUser = process.env.HN_USER
  const hnPass = process.env.HN_PASS
  if (!hnUser || !hnPass) {
    log('[post] No HN credentials — set HN_USER and HN_PASS env vars')
    return null
  }

  try {
    const loginRes = await fetch('https://news.ycombinator.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `acct=${encodeURIComponent(hnUser)}&pw=${encodeURIComponent(hnPass)}&goto=news`,
      redirect: 'manual',
    })

    const setCookie = loginRes.headers.get('set-cookie')
    if (setCookie) {
      const userCookie = setCookie.match(/user=([^;]+)/)
      if (userCookie) {
        const cookie = `user=${userCookie[1]}`
        // Save for 24h
        writeFileSync(HN_COOKIE_FILE, JSON.stringify({
          cookie,
          expires: Date.now() + 24 * 60 * 60_000,
        }))
        log('[post] HN login successful, cookie saved')
        return cookie
      }
    }
    log('[post] HN login failed — no cookie returned')
    return null
  } catch (err) {
    log(`[post] HN login error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function postToHN(itemUrl: string, comment: string): Promise<boolean> {
  const cookie = await getHnCookie()
  if (!cookie) return false

  // Extract item ID from URL
  const idMatch = itemUrl.match(/id=(\d+)/)
  if (!idMatch) {
    log(`[post] Can't extract HN item ID from: ${itemUrl}`)
    return false
  }
  const itemId = idMatch[1]

  try {
    // First, fetch the item page to get the HMAC token
    const pageRes = await fetch(`https://news.ycombinator.com/item?id=${itemId}`, {
      headers: { 'Cookie': cookie },
    })
    const html = await pageRes.text()

    // Verify we're logged in
    if (!html.includes('isaacsight')) {
      log('[post] HN cookie invalid — not logged in')
      if (existsSync(HN_COOKIE_FILE)) writeFileSync(HN_COOKIE_FILE, '{}')
      return false
    }

    // Extract hmac from the comment form — try multiple patterns
    let hmac: string | null = null
    const hmacMatch = html.match(/name="hmac"\s+value="([^"]+)"/)
      || html.match(/value="([^"]+)"\s+name="hmac"/)
      || html.match(/hmac.*?value="([a-f0-9]{40,})"/)
    if (hmacMatch) hmac = hmacMatch[1]

    if (!hmac) {
      // Try to find any hidden input that looks like an HMAC
      const hiddenInputs = html.match(/<input[^>]*type="hidden"[^>]*>/gi) || []
      log(`[post] No HMAC found. Hidden inputs: ${hiddenInputs.length}`)
      for (const inp of hiddenInputs.slice(0, 5)) {
        log(`[post]   ${inp.slice(0, 120)}`)
      }
      return false
    }

    log(`[post] Got HMAC for item ${itemId}, posting comment (${comment.length} chars)...`)

    // Post the comment
    const postRes = await fetch('https://news.ycombinator.com/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Origin': 'https://news.ycombinator.com',
        'Referer': `https://news.ycombinator.com/item?id=${itemId}`,
      },
      body: `parent=${itemId}&goto=item%3Fid%3D${itemId}&hmac=${encodeURIComponent(hmac)}&text=${encodeURIComponent(comment)}`,
      redirect: 'manual',
    })

    log(`[post] HN response: ${postRes.status} ${postRes.statusText}`)

    // HN redirects (302) on success, or returns 200 with the updated page
    if (postRes.status === 302) {
      log(`[post] HN comment posted successfully on item ${itemId}`)
      return true
    }

    if (postRes.status === 200) {
      // Check if the response page contains our comment
      const responseHtml = await postRes.text()
      if (responseHtml.includes(comment.slice(0, 50))) {
        log(`[post] HN comment posted (200 response) on item ${itemId}`)
        return true
      }
      // Check for error messages
      if (responseHtml.includes('Please confirm') || responseHtml.includes('too fast')) {
        log(`[post] HN rate limited or confirmation required`)
      } else {
        log(`[post] HN 200 but comment not found in response`)
      }
    }

    return false
  } catch (err) {
    log(`[post] HN post error: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ── Autonomous Posting ────────────────────────────────────────────────

async function autoPost(
  opp: { source: string; title: string; url: string },
  draft: string,
): Promise<{ posted: boolean; error?: string }> {
  // Already posted to this URL?
  if (wasAlreadyPosted(opp.url)) {
    log(`[post] Already posted to ${opp.url}, skipping`)
    return { posted: false, error: 'already_posted' }
  }

  // Cooldown check
  if (!canPostNow()) {
    log(`[post] Cooldown active, skipping ${opp.title.slice(0, 40)}`)
    return { posted: false, error: 'cooldown' }
  }

  // Quality gate
  const quality = await qualityCheck(draft, opp.title)
  if (!quality.pass) {
    log(`[post] Quality gate REJECTED draft for: ${opp.title.slice(0, 40)}`)
    return { posted: false, error: 'quality_rejected' }
  }

  const finalComment = quality.improved
  let success = false
  let error: string | undefined

  // Route to the right platform
  if (opp.source === 'github-issue' || opp.url.includes('github.com')) {
    success = await postToGitHub(opp.url, finalComment)
    if (!success) error = 'github_post_failed'
  } else if (opp.source.startsWith('hn') || opp.url.includes('news.ycombinator.com')) {
    success = await postToHN(opp.url, finalComment)
    if (!success) error = 'hn_post_failed'
  } else if (opp.source.startsWith('reddit')) {
    log(`[post] Reddit auto-posting not yet supported, skipping`)
    return { posted: false, error: 'reddit_unsupported' }
  }

  // Log the post attempt
  const records = loadPostLog()
  records.push({
    timestamp: new Date().toISOString(),
    source: opp.source,
    url: opp.url,
    title: opp.title,
    comment: finalComment,
    success,
    error,
  })
  savePostLog(records)

  return { posted: success, error }
}

/**
 * Process opportunities through local AI — analyze, decide, and POST.
 * kbot is fully autonomous: finds, evaluates, quality-checks, and engages.
 * Zero API cost for analysis (Ollama). Only posts if quality gate passes.
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
    status: 'acted' | 'skipped' | 'posted' | 'rejected'
    postResult?: { posted: boolean; error?: string }
  }> = []

  // Process top 5 opportunities — quality over quantity
  const top = data.opportunities.slice(0, 5)
  let postsThisCycle = 0

  for (const opp of top) {
    const analysis = await analyzeOpportunity(opp)

    let status: 'acted' | 'skipped' | 'posted' | 'rejected' = analysis.relevant ? 'acted' : 'skipped'
    let postResult: { posted: boolean; error?: string } | undefined

    // If relevant AND we haven't hit the post cap, try to post
    if (analysis.relevant && analysis.draft && postsThisCycle < MAX_POSTS_PER_CYCLE) {
      postResult = await autoPost(opp, analysis.draft)
      if (postResult.posted) {
        status = 'posted'
        postsThisCycle++
        log(`[actions] POSTED to ${opp.source}: ${opp.title.slice(0, 50)}`)
      } else if (postResult.error === 'quality_rejected') {
        status = 'rejected'
        log(`[actions] Quality gate rejected: ${opp.title.slice(0, 50)}`)
      }
    }

    actions.push({
      opportunity: opp,
      ...analysis,
      status,
      postResult,
    })
    log(`[actions] ${opp.title.slice(0, 50)}... → ${status}: ${analysis.reasoning.slice(0, 80)}`)

    // One quality draft per cycle — stop after first relevant hit
    if (analysis.relevant && analysis.draft && analysis.draft !== 'n/a') {
      log('[actions] found one quality opportunity — stopping early')
      break
    }
  }

  const posted = actions.filter(a => a.status === 'posted')
  const relevant = actions.filter(a => a.status === 'acted' || a.status === 'posted')
  const rejected = actions.filter(a => a.status === 'rejected')
  const skipped = actions.filter(a => a.status === 'skipped')

  // Record posted items in feedback loop for engagement tracking
  if (!state.feedback) state.feedback = []
  for (const a of posted) {
    state.stats.postsAttempted = (state.stats.postsAttempted || 0) + 1
    state.feedback.push({
      postedAt: new Date().toISOString(),
      url: a.opportunity.url,
      title: a.opportunity.title,
      scoreAtPost: state.hnScore,
      commentsAtPost: state.hnComments,
      lastCheckedAt: new Date().toISOString(),
      currentScore: state.hnScore,
      currentComments: state.hnComments,
      repliesReceived: 0,
      outcome: 'pending',
    })
  }

  // Prune old feedback entries (keep last 50)
  if (state.feedback.length > 50) {
    state.feedback = state.feedback.slice(-50)
  }

  ensureDir(ACTIONS_DIR)

  // Log all decisions — kbot keeps its own record
  const filename = `${dateStr()}-${Date.now()}.json`
  writeFileSync(join(ACTIONS_DIR, filename), JSON.stringify({
    timestamp: new Date().toISOString(),
    processed: actions.length,
    posted: posted.length,
    relevant: relevant.length,
    rejected: rejected.length,
    skipped: skipped.length,
    actions,
  }, null, 2))

  // Write kbot's journal
  const journalFile = join(ACTIONS_DIR, `journal-${dateStr()}.md`)
  const journalEntry = [
    `\n## ${new Date().toISOString().slice(11, 19)} — Processed ${actions.length} opportunities`,
    '',
    `**Posted ${posted.length}, relevant ${relevant.length}, rejected ${rejected.length}, skipped ${skipped.length}**`,
    '',
    ...posted.map(a => `- **POSTED** [${a.opportunity.title}](${a.opportunity.url}) (${a.opportunity.source})\n  > ${a.draft}\n`),
    ...rejected.map(a => `- **REJECTED** ${a.opportunity.title} — quality gate failed`),
    ...actions.filter(a => a.status === 'acted').map(a => `- **RELEVANT** ${a.opportunity.title} — ${a.reasoning}\n  > ${a.draft}\n`),
    ...skipped.map(a => `- ~~${a.opportunity.title}~~ — ${a.reasoning}`),
    '',
  ].join('\n')

  writeFileSync(journalFile, journalEntry, { flag: 'a' })

  if (posted.length > 0 || relevant.length > 0 || skipped.length > 0) {
    log(`[actions] decided: ${posted.length} posted, ${relevant.length} relevant, ${skipped.length} skipped`)
    gitPublish(`kbot: ${posted.length} posted, ${relevant.length - posted.length} queued, ${skipped.length} skipped`)
  } else {
    log('[actions] nothing to decide this cycle')
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
  observeToolCall('daemon_pulse', { stars, downloads, hn_score: hn.score ?? 0, hn_comments: hn.descendants ?? 0 })

  // Milestone detection — trigger actions when metrics cross thresholds
  const milestones = [
    { metric: 'stars', threshold: 5, current: stars, message: 'kbot hit 5 GitHub stars' },
    { metric: 'stars', threshold: 10, current: stars, message: 'kbot hit 10 GitHub stars' },
    { metric: 'stars', threshold: 25, current: stars, message: 'kbot hit 25 GitHub stars' },
    { metric: 'stars', threshold: 50, current: stars, message: 'kbot hit 50 GitHub stars' },
    { metric: 'stars', threshold: 100, current: stars, message: 'kbot hit 100 GitHub stars' },
    { metric: 'downloads', threshold: 1000, current: downloads, message: 'kbot crossed 1,000 npm downloads' },
    { metric: 'downloads', threshold: 5000, current: downloads, message: 'kbot crossed 5,000 npm downloads' },
    { metric: 'downloads', threshold: 10000, current: downloads, message: 'kbot crossed 10,000 npm downloads' },
  ]
  if (!state.reachedMilestones) state.reachedMilestones = []
  for (const m of milestones) {
    const key = `${m.metric}-${m.threshold}`
    if (m.current >= m.threshold && !state.reachedMilestones.includes(key)) {
      state.reachedMilestones.push(key)
      log(`[milestone] ${m.message}`)
      changes.push(m.message)
    }
  }

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

  // Check engagement on past posts (feedback loop)
  await checkFeedback(state)
}

// ── FEEDBACK LOOP ────────────────────────────────────────────────────

/**
 * Check engagement on past posts. Did anyone reply? Did it get upvoted?
 * Updates state.feedback with outcomes so kbot learns what works.
 */
async function checkFeedback(state: DaemonState): Promise<void> {
  if (!state.feedback) state.feedback = []
  if (state.feedback.length === 0) return

  const pending = state.feedback.filter(f => f.outcome === 'pending')
  if (pending.length === 0) return

  log(`[feedback] checking ${pending.length} past posts...`)

  for (const entry of pending) {
    try {
      // Extract HN item ID from URL
      const idMatch = entry.url.match(/id=(\d+)/)
      if (!idMatch) continue

      const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${idMatch[1]}.json`) as {
        score?: number; descendants?: number; dead?: boolean; deleted?: boolean
      }

      if (item.dead || item.deleted) {
        entry.outcome = 'flagged'
        entry.lastCheckedAt = new Date().toISOString()
        state.stats.postsFlagged = (state.stats.postsFlagged || 0) + 1
        log(`[feedback] FLAGGED/DELETED: ${entry.title.slice(0, 50)}`)
        continue
      }

      const score = item.score ?? 0
      const comments = item.descendants ?? 0
      const scoreGain = score - entry.scoreAtPost
      const commentGain = comments - entry.commentsAtPost

      entry.currentScore = score
      entry.currentComments = comments
      entry.repliesReceived = commentGain
      entry.lastCheckedAt = new Date().toISOString()

      // After 24h of no engagement, mark as ignored
      const hoursSincePost = (Date.now() - new Date(entry.postedAt).getTime()) / (1000 * 60 * 60)

      if (commentGain > 0 || scoreGain > 2) {
        entry.outcome = 'engaged'
        state.stats.postsEngaged = (state.stats.postsEngaged || 0) + 1
        log(`[feedback] ENGAGED: ${entry.title.slice(0, 50)} (+${scoreGain} score, +${commentGain} comments)`)
      } else if (hoursSincePost > 24) {
        entry.outcome = 'ignored'
        log(`[feedback] IGNORED (24h, no engagement): ${entry.title.slice(0, 50)}`)
      }
    } catch {
      // Skip — will retry next cycle
    }
  }

  // Write feedback summary for self-analysis
  const feedbackFile = join(ACTIONS_DIR, `feedback-${dateStr()}.json`)
  writeFileSync(feedbackFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: state.feedback.length,
    engaged: state.feedback.filter(f => f.outcome === 'engaged').length,
    ignored: state.feedback.filter(f => f.outcome === 'ignored').length,
    flagged: state.feedback.filter(f => f.outcome === 'flagged').length,
    pending: state.feedback.filter(f => f.outcome === 'pending').length,
    entries: state.feedback,
  }, null, 2))
}

// ── INTEL (every 6 hours) ────────────────────────────────────────────

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
  observeToolCall('daemon_intel', { cycle: state.stats.totalIntel })
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

// ── OBSIDIAN SYNC (every 12 hours) ──────────────────────────────────
// Keep the Obsidian vault up to date with kbot's current state.
// Writes: Current Status, Daemon Stats, Roadmap, Discovery highlights.

const OBSIDIAN_VAULT = join(homedir(), 'Desktop', 'kernel.chat', 'kernelchat')

async function runObsidianSync(state: DaemonState): Promise<void> {
  if (!existsSync(OBSIDIAN_VAULT)) {
    log('[obsidian] vault not found — skipping')
    return
  }

  log('[obsidian] syncing to vault...')

  const kernelDir = join(OBSIDIAN_VAULT, 'Kernel')
  for (const sub of ['', 'Briefings', 'Conversations', 'Insights', 'Memory']) {
    const d = join(kernelDir, sub)
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  }

  // Read latest pulse data
  let pulse = {} as Record<string, unknown>
  try { pulse = JSON.parse(readFileSync(join(PULSE_DIR, 'latest.json'), 'utf8')) } catch {}

  const hn = (pulse as { hn?: { score?: number; comments?: number } }).hn ?? {}
  const gh = (pulse as { github?: { stars?: number; forks?: number } }).github ?? {}
  const npm = (pulse as { npm?: { downloads?: number; weeklyDownloads?: number; version?: string } }).npm ?? {}

  // 1. Current Status note
  const statusNote = `---
tags: [kernel, status, auto-sync]
synced_at: "${new Date().toISOString()}"
---

# K:BOT Current Status

*Auto-synced by discovery daemon — ${dateStr()}*

## Vitals
| Metric | Value |
|--------|-------|
| Version | ${npm.version ?? 'unknown'} |
| npm Downloads (weekly) | ${npm.weeklyDownloads ?? npm.downloads ?? 'unknown'} |
| GitHub Stars | ${gh.stars ?? state.knownStars ?? 'unknown'} |
| GitHub Forks | ${gh.forks ?? 'unknown'} |
| HN Score | ${hn.score ?? 'unknown'} |
| HN Comments | ${hn.comments ?? 'unknown'} |

## Daemon Stats
| Metric | Value |
|--------|-------|
| Pulses | ${state.stats.totalPulses} |
| Intel Scans | ${state.stats.totalIntel} |
| Outreach Cycles | ${state.stats.totalOutreach} |
| Reports Written | ${state.stats.totalWriting} |
| Evolution Proposals | ${state.stats.totalEvolution} |
| Evolution Successes | ${state.stats.evolutionSuccesses ?? 0} |
| Errors Today | ${state.stats.errorsToday} |
| Uptime Since | ${state.startedAt ?? 'unknown'} |

## Recent Activity
${(() => {
  try {
    const log = readFileSync(join(DAEMON_DIR, 'daemon.log'), 'utf8')
    const lines = log.trim().split('\n').slice(-20)
    return lines.map(l => '- ' + l).join('\n')
  } catch { return '- No log available' }
})()}
`

  writeFileSync(join(OBSIDIAN_VAULT, 'Current Status.md'), statusNote)
  log('[obsidian] wrote Current Status.md')

  // 2. Daemon learning note (from kbot memory)
  const kbotMemoryDir = join(homedir(), '.kbot', 'memory')
  try {
    const synthesis = JSON.parse(readFileSync(join(kbotMemoryDir, 'synthesis.json'), 'utf8'))
    const profile = JSON.parse(readFileSync(join(kbotMemoryDir, 'profile.json'), 'utf8'))
    const identity = JSON.parse(readFileSync(join(homedir(), '.kbot', 'identity.json'), 'utf8'))

    const insightLines = (synthesis.insights ?? []).map((i: { text: string; confidence: number }) =>
      `- ${i.text} (confidence: ${(i.confidence * 100).toFixed(0)}%)`
    ).join('\n')

    const learningNote = `---
tags: [kernel, learning, auto-sync]
synced_at: "${new Date().toISOString()}"
---

# K:BOT Learning State

*Auto-synced by discovery daemon — ${dateStr()}*

## Identity
- **Mission:** ${identity.mission ?? 'unknown'}
- **Sessions:** ${identity.totalSessions ?? 0}
- **Personality:** verbosity ${identity.personality?.verbosity ?? '?'}, caution ${identity.personality?.caution ?? '?'}, creativity ${identity.personality?.creativity ?? '?'}, autonomy ${identity.personality?.autonomy ?? '?'}

## User Profile
- **Total Messages:** ${profile.totalMessages ?? 0}
- **Sessions:** ${profile.sessions ?? 0}
- **Tokens Used:** ${(profile.totalTokens ?? 0).toLocaleString()}
- **Top Tasks:** ${Object.entries(profile.taskPatterns ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([k, v]) => k + ' (' + v + ')').join(', ')}

## Synthesized Insights
${insightLines || '- None yet'}

## Milestones
${(identity.milestones ?? []).map((m: { date: string; event: string }) => '- **' + m.date + ':** ' + m.event).join('\n') || '- None yet'}
`

    writeFileSync(join(kernelDir, 'Memory', 'Learning.md'), learningNote)
    log('[obsidian] wrote Kernel/Memory/Learning.md')
  } catch (err) {
    log(`[obsidian] learning note failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Discovery highlights note (from latest intel/outreach)
  try {
    const outreach = JSON.parse(readFileSync(join(OUTREACH_DIR, 'latest.json'), 'utf8'))
    const projects = outreach.projects ?? []
    const paper = outreach.latestPaper

    if (projects.length || paper) {
      const discoveryNote = `---
tags: [kernel, discovery, auto-sync]
synced_at: "${new Date().toISOString()}"
---

# Discovery Highlights

*Auto-synced by discovery daemon — ${dateStr()}*

## Projects Found
${projects.length ? projects.map((p: { name: string; url?: string; why?: string }) =>
  '- **' + p.name + '**' + (p.url ? ' — ' + p.url : '') + (p.why ? '\n  ' + p.why : '')
).join('\n') : '- None this cycle'}

## Latest Paper
${paper ? '**' + (paper.title ?? 'Untitled') + '**\n' + (paper.url ?? '') + '\n' + (paper.summary ?? '') : '- None this cycle'}
`

      writeFileSync(join(kernelDir, 'Insights', 'Discovery ' + dateStr() + '.md'), discoveryNote)
      log('[obsidian] wrote discovery highlights')
    }
  } catch {}

  state.stats.totalObsidianSyncs = (state.stats.totalObsidianSyncs ?? 0) + 1
  observeToolCall('daemon_obsidian_sync', { cycle: state.stats.totalObsidianSyncs })
  log('[obsidian] sync complete (cycle #' + state.stats.totalObsidianSyncs + ')')
}

// ── EVOLUTION (every 24 hours) ────────────────────────────────────────

async function runEvolution(state: DaemonState): Promise<void> {
  log('[evolution] analyzing for self-improvement...')

  const KBOT_SRC = join(PROJECT_ROOT, 'packages', 'kbot', 'src')
  const pkgPath = join(PROJECT_ROOT, 'packages', 'kbot', 'package.json')
  let createdFile: string | null = null // track newly created files for rollback

  /** Validate that a target path resolves inside KBOT_SRC and has no weird characters */
  function safePath(relative: string): string | null {
    // Strip markdown fences, backticks, quotes
    const cleaned = relative.replace(/^[`'"]+|[`'"]+$/g, '').trim()
    // Block paths with .., spaces, glob chars, or absolute paths
    if (!cleaned || cleaned.includes('..') || cleaned.includes(' ') || cleaned.includes('*') || cleaned.startsWith('/')) {
      log(`[evolution] rejected unsafe path: ${relative}`)
      return null
    }
    const resolved = join(KBOT_SRC, cleaned)
    // Double-check it's actually inside KBOT_SRC
    if (!resolved.startsWith(KBOT_SRC + '/')) {
      log(`[evolution] path escapes KBOT_SRC: ${resolved}`)
      return null
    }
    return resolved
  }

  /** Strip markdown code fences from model output */
  function stripFences(code: string): string {
    return code
      .replace(/^```(?:typescript|ts)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
  }

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

  // Read what kbot discovered in the field to inform evolution
  let fieldFindings = ''
  try {
    const outreach = JSON.parse(readFileSync(join(OUTREACH_DIR, 'latest.json'), 'utf8'))
    const projects = (outreach.projects ?? []).slice(0, 3).map((p: { name: string; description: string }) => `${p.name}: ${p.description}`).join('\n')
    const paper = outreach.latestPaper?.title ?? 'none'
    fieldFindings = `\nProjects discovered:\n${projects}\nLatest paper: ${paper}\n`
  } catch { /* skip */ }

  let journalFindings = ''
  try {
    const journal = readFileSync(join(ACTIONS_DIR, `journal-${dateStr()}.md`), 'utf8')
    journalFindings = `\nToday's decisions:\n${journal.slice(-500)}\n`
  } catch { /* skip */ }

  // Read an existing tool file as a concrete example for the model
  let exampleTool = ''
  try {
    const examplePath = join(KBOT_SRC, 'tools', 'search.ts')
    if (existsSync(examplePath)) {
      exampleTool = readFileSync(examplePath, 'utf8').slice(0, 1500)
    }
  } catch { /* skip */ }

  // List actual files in tools/ so the model knows what exists
  let toolsList = ''
  try {
    const toolsDir = join(KBOT_SRC, 'tools')
    const files = execSync(`ls "${toolsDir}"`, { encoding: 'utf8' }).trim()
    toolsList = files
  } catch { /* skip */ }

  const improvementPrompt = `You are writing TypeScript for kbot, an open-source terminal AI agent.
Package: @kernel.chat/kbot | Node.js 20+ | TypeScript strict mode

CODEBASE STRUCTURE:
packages/kbot/src/
├── cli.ts          — CLI entry (commander)
├── agent.ts        — Agent loop (think → plan → execute → learn)
├── auth.ts         — API key management
├── streaming.ts    — Streaming for Anthropic + OpenAI
├── memory.ts       — Persistent memory
├── context-manager.ts — Token management
└── tools/          — Built-in tools (registerTool pattern)

EXISTING TOOLS:
${toolsList}

EXAMPLE — this is how a real tool file looks (tools/search.ts):
${exampleTool}

KEY PATTERNS:
- Import: import { registerTool } from './index.js'
- Every tool uses registerTool({ name, description, parameters, tier, execute })
- tier is 'free' or 'pro'
- execute receives args object, returns string
- Use fetch() for HTTP, AbortSignal.timeout() for timeouts
- NO default exports. NO markdown fences. NO \`\`\` wrapping.

CURRENT STATE:
Stars: ${state.knownStars} | Downloads: ${state.knownDownloads} | HN: ${state.hnScore} pts
Evolution cycle: ${state.stats.totalEvolution + 1} | Success rate: ${state.stats.evolutionSuccesses}/${state.stats.evolutionSuccesses + state.stats.evolutionFailures}
${intelSummary}${oppSummary}${fieldFindings}${journalFindings}

TASK: Suggest ONE small improvement. Either IMPROVE an existing file or CREATE a new tool.

For IMPROVE, respond EXACTLY:
ACTION: IMPROVE
FILE: tools/filename.ts
DESCRIPTION: one sentence
BEFORE: exact code to find and replace (copy from the file, 3-10 lines)
AFTER: replacement code (same size, compiles)

For CREATE, respond EXACTLY:
ACTION: CREATE
FILE: tools/new-tool-name.ts
DESCRIPTION: one sentence
CODE: full TypeScript (follow the registerTool pattern above exactly)

RULES:
- Max 60 lines of code
- Must follow the registerTool pattern exactly
- No markdown fences, no \`\`\` wrapping, no commentary outside the format
- File paths are relative to packages/kbot/src/ (e.g. tools/search.ts)
- Only create files in the tools/ directory
- Respond SKIP if nothing is worth changing`

  // Uses qwen2.5-coder:32b locally ($0). Prompt now includes real codebase context + example tool.
  const improvement = await askClaude(improvementPrompt, 2000)

  let applied = false
  let improvementDescription = ''
  let action = 'none'

  if (improvement && !improvement.includes('SKIP')) {
    const actionMatch = improvement.match(/ACTION:\s*(IMPROVE|CREATE)/i)
    action = actionMatch?.[1]?.toUpperCase() ?? 'IMPROVE'

    if (action === 'CREATE') {
      // ── kbot is forging a new tool ──
      const fileMatch = improvement.match(/FILE:\s*(.+)/i)
      const descMatch = improvement.match(/DESCRIPTION:\s*(.+)/i)
      const codeMatch = improvement.match(/CODE:\s*([\s\S]+)/i)

      if (fileMatch && descMatch && codeMatch) {
        const targetFile = safePath(fileMatch[1].trim())
        if (!targetFile) {
          log(`[evolution] invalid file path — skipping CREATE`)
        } else {
          improvementDescription = `NEW TOOL: ${descMatch[1].trim()}`
          const code = stripFences(codeMatch[1].trim())

          try {
            if (!existsSync(targetFile) && code.length > 50) {
              // Only create files in existing directories — never mkdir
              const dir = join(targetFile, '..')
              if (!existsSync(dir)) {
                log(`[evolution] directory doesn't exist, refusing to create: ${dir}`)
              } else {
                writeFileSync(targetFile, code)
                createdFile = targetFile
                log(`[evolution] forged new tool: ${improvementDescription}`)
                applied = true
              }
            } else if (existsSync(targetFile)) {
              log(`[evolution] tool already exists — skipping`)
            } else {
              log(`[evolution] generated code too short — skipping`)
            }
          } catch (err) {
            log(`[evolution] failed to forge tool: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    } else {
      // ── kbot is improving existing code ──
      const fileMatch = improvement.match(/FILE:\s*(.+)/i)
      const descMatch = improvement.match(/DESCRIPTION:\s*(.+)/i)
      const beforeMatch = improvement.match(/BEFORE:\s*([\s\S]*?)(?=AFTER:)/i)
      const afterMatch = improvement.match(/AFTER:\s*([\s\S]*?)$/i)

      if (fileMatch && descMatch && beforeMatch && afterMatch) {
        const targetFile = safePath(fileMatch[1].trim())
        if (!targetFile) {
          log(`[evolution] invalid file path — skipping IMPROVE`)
        } else {
        improvementDescription = descMatch[1].trim()

        try {
          if (existsSync(targetFile)) {
            const content = readFileSync(targetFile, 'utf8')
            const before = beforeMatch[1].trim()
            const after = afterMatch[1].trim()

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
          log(`[evolution] failed to apply: ${err instanceof Error ? err.message : String(err)}`)
        }
        }
      }
    }
  } else {
    log('[evolution] nothing to build this cycle')
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
      // Delete newly created files (git checkout only restores modified files)
      if (createdFile && existsSync(createdFile)) {
        try { unlinkSync(createdFile); log(`[evolution] deleted created file: ${createdFile}`) } catch { /* best effort */ }
      }
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
      if (createdFile && existsSync(createdFile)) {
        try { unlinkSync(createdFile); log(`[evolution] deleted created file: ${createdFile}`) } catch { /* best effort */ }
      }
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
    feedback: {
      totalSuccesses: state.stats.evolutionSuccesses || 0,
      totalFailures: state.stats.evolutionFailures || 0,
      successRate: ((state.stats.evolutionSuccesses || 0) / Math.max(1, (state.stats.evolutionSuccesses || 0) + (state.stats.evolutionFailures || 0)) * 100).toFixed(1) + '%',
    },
  }

  if (applied) {
    state.stats.evolutionSuccesses = (state.stats.evolutionSuccesses || 0) + 1
  } else if (improvementDescription) {
    state.stats.evolutionFailures = (state.stats.evolutionFailures || 0) + 1
  }
  state.stats.totalEvolution++
  observeToolCall('daemon_evolution', { cycle: state.stats.totalEvolution, successes: state.stats.evolutionSuccesses, failures: state.stats.evolutionFailures })
  ensureDir(join(EVOLUTION_DIR, 'proposals'))
  const filename = `proposal-${dateStr()}.json`
  writeFileSync(join(EVOLUTION_DIR, 'proposals', filename), JSON.stringify(proposal, null, 2))
  log(`[evolution] proposal written: ${filename}`)

  gitPublish(`evolution: kbot proposal ${dateStr()} (cycle ${proposal.cycle})${applied ? ' — improvement applied' : ''}`)

  // ── Step 4: Bump version, build, publish to npm (only if improvement applied) ──
  if (applied) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const [major, minor, patch] = pkg.version.split('.').map(Number)
      const newVersion = `${major}.${minor}.${patch + 1}`
      pkg.version = newVersion
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

      execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npm run build`, { stdio: 'pipe', timeout: 60000 })
      const npmToken = process.env.NPM_TOKEN
      const tokenFlag = npmToken ? ` --//registry.npmjs.org/:_authToken=${npmToken}` : ''
      execSync(`cd "${join(PROJECT_ROOT, 'packages', 'kbot')}" && npm publish --access public${tokenFlag}`, { stdio: 'pipe', timeout: 60000 })

      execSync(`cd "${PROJECT_ROOT}" && git add packages/kbot/ && git commit -m "feat(auto): kbot v${newVersion} — ${improvementDescription}"`, { stdio: 'pipe' })
      execSync(`cd "${PROJECT_ROOT}" && git push origin main`, { stdio: 'pipe' })

      log(`[evolution] published @kernel.chat/kbot@${newVersion} to npm`)
    } catch (err) {
      log(`[evolution] npm publish failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    log('[evolution] no improvement applied — skipping npm publish')
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
    observeToolCall('daemon_opportunities', { count: opportunities.length, sources: [...new Set(opportunities.map(o => o.source))] })
    // Publish when there are findings
    gitPublish(`opportunities: ${opportunities.length} found ${dateStr()}`)
  } else {
    log('[opportunities] none found this cycle')
    observeToolCall('daemon_opportunities', { count: 0 })
  }
}

// ── Synthesis Cycle — Closed-Loop Intelligence Compounding ────────────

async function runSynthesis(state: DaemonState): Promise<void> {
  log('[synthesis] running closed-loop cycle...')
  observeToolCall('daemon_synthesis')

  try {
    // Dynamic import from kbot source (synthesis-engine lives in packages/kbot/src/)
    const enginePath = join(PROJECT_ROOT, 'packages', 'kbot', 'src', 'synthesis-engine.ts')
    if (!existsSync(enginePath)) {
      log('[synthesis] synthesis-engine.ts not found, skipping')
      return
    }

    const { synthesize } = await import(enginePath)
    const result = synthesize(DAEMON_DIR)

    state.stats.totalSynthesis = (state.stats.totalSynthesis || 0) + 1

    const summary = [
      result.toolAdoptions.length > 0 ? `${result.toolAdoptions.length} tools evaluated` : null,
      result.agentTrials.length > 0 ? `${result.agentTrials.length} agents trialed` : null,
      result.paperInsights.length > 0 ? `${result.paperInsights.length} papers analyzed` : null,
      result.activeCorrections.length > 0 ? `${result.activeCorrections.length} corrections active` : null,
      result.reflectionsClosed > 0 ? `${result.reflectionsClosed} reflections→routing` : null,
      result.patternsTransferred > 0 ? `${result.patternsTransferred} patterns transferred` : null,
    ].filter(Boolean).join(', ')

    log(`[synthesis] cycle #${result.cycleNumber}: ${summary || 'calibrating (building baseline)'}`)
    log(`[synthesis] skill map: ${result.skillMap.filter((e: { status: string }) => e.status === 'proven').length} proven, ${result.skillMap.filter((e: { status: string }) => e.status === 'developing').length} developing, ${result.skillMap.filter((e: { status: string }) => e.status === 'untested').length} untested`)

    // Push snapshot to Supabase for the live dashboard at kernel.chat/#/play
    await pushSynthesisToSupabase(result, state)
  } catch (err) {
    log(`[synthesis] ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── Supabase Push — Live Dashboard at kernel.chat/#/play ──────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

async function pushSynthesisToSupabase(result: any, daemonState: DaemonState): Promise<void> {
  if (!SUPABASE_SERVICE_KEY) {
    log('[synthesis] no SUPABASE_SERVICE_KEY — skipping dashboard push')
    return
  }

  try {
    // Read learning store counts (not full arrays — just metrics)
    const patternsFile = join(homedir(), '.kbot', 'memory', 'patterns.json')
    const solutionsFile = join(homedir(), '.kbot', 'memory', 'solutions.json')
    const reflectionsFile = join(homedir(), '.kbot', 'memory', 'reflections.json')
    const routingFile = join(homedir(), '.kbot', 'memory', 'routing-history.json')
    const profileFile = join(homedir(), '.kbot', 'memory', 'profile.json')
    const observerStatsFile = join(homedir(), '.kbot', 'observer', 'stats.json')

    const patterns = existsSync(patternsFile) ? JSON.parse(readFileSync(patternsFile, 'utf8')) : []
    const solutions = existsSync(solutionsFile) ? JSON.parse(readFileSync(solutionsFile, 'utf8')) : []
    const reflections = existsSync(reflectionsFile) ? JSON.parse(readFileSync(reflectionsFile, 'utf8')) : []
    const routing = existsSync(routingFile) ? JSON.parse(readFileSync(routingFile, 'utf8')) : []
    const profile = existsSync(profileFile) ? JSON.parse(readFileSync(profileFile, 'utf8')) : {}
    const observerStats = existsSync(observerStatsFile) ? JSON.parse(readFileSync(observerStatsFile, 'utf8')) : {}

    const pulseFile = join(DAEMON_DIR, 'pulse', 'latest.json')
    const pulse = existsSync(pulseFile) ? JSON.parse(readFileSync(pulseFile, 'utf8')) : {}

    const learningSummary = {
      patterns_count: patterns.length,
      solutions_count: solutions.length,
      reflections_count: reflections.length,
      routing_entries: routing.length,
      total_messages: profile.totalMessages || 0,
      total_tokens: profile.totalTokens || 0,
      sessions: profile.sessions || 0,
      observer_total: observerStats.totalObserved || 0,
      observer_sessions: observerStats.sessionsObserved || 0,
      task_patterns: profile.taskPatterns || {},
      preferred_agents: profile.preferredAgents || {},
    }

    // Push via fetch (no @supabase/supabase-js dependency needed)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kbot_synthesis_state?on_conflict=instance_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        instance_id: 'primary',
        total_cycles: result.cycleNumber,
        last_cycle_at: new Date().toISOString(),
        stats: {
          toolsEvaluated: result.toolAdoptions.length,
          toolsAdopted: result.toolAdoptions.filter((t: any) => t.status === 'adopted').length,
          toolsRejected: result.toolAdoptions.filter((t: any) => t.status === 'rejected').length,
          papersAnalyzed: result.paperInsights.length,
          correctionsActive: result.activeCorrections.length,
          reflectionsClosed: result.reflectionsClosed,
          patternsTransferred: result.patternsTransferred,
          agentsTrialed: result.agentTrials.length,
        },
        skill_map: result.skillMap,
        active_corrections: result.activeCorrections,
        tool_adoptions: result.toolAdoptions,
        paper_insights: result.paperInsights,
        agent_trials: result.agentTrials,
        topic_weights: result.topicWeights,
        discovery_state: {
          stats: daemonState.stats,
          knownStars: daemonState.knownStars,
          knownDownloads: daemonState.knownDownloads,
          hnScore: daemonState.hnScore,
          hnComments: daemonState.hnComments,
        },
        pulse_data: pulse,
        learning_summary: learningSummary,
        cross_pollinated_count: result.patternsTransferred,
        updated_at: new Date().toISOString(),
      }),
    })

    if (res.ok) {
      log('[synthesis] pushed to Supabase → kernel.chat/#/play')
    } else {
      const body = await res.text()
      log(`[synthesis] Supabase push failed: ${res.status} ${body.slice(0, 200)}`)
    }
  } catch (err) {
    log(`[synthesis] Supabase push error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── Model Releases Tracker (Apr 2026) ─────────────────────────────────
// Runs every 6h (same cadence as intel). Scans HN + GitHub for announcements
// of new foundation models from the major labs and writes a running log so
// Isaac can see what shipped while he was away.

const MODEL_RELEASE_PATTERNS = [
  /claude[-\s](?:mythos|opus|sonnet|haiku)\s*\d/i,
  /gpt[-\s]?5\.?\d/i,
  /gpt[-\s]?6/i,
  /gemini[-\s]?\d/i,
  /llama[-\s]?\d/i,
  /deepseek[-\s]?(?:v|r)\d/i,
  /mistral[-\s]?(?:large|medium|codestral)/i,
  /qwen[-\s]?\d/i,
  /(?:release|announce|launch|introduce|unveil).*(?:model|llm|foundation)/i,
]

interface ModelReleaseSignal {
  title: string
  url: string
  source: 'hn' | 'github'
  score?: number
  matchedPattern: string
  seenAt: string
}

async function scanHNForReleases(): Promise<ModelReleaseSignal[]> {
  const q = encodeURIComponent('(release OR announce OR launch OR introduces) (Claude OR GPT OR Gemini OR Llama OR DeepSeek OR Mistral OR Qwen OR Anthropic OR OpenAI)')
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${q}&hitsPerPage=30`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json() as { hits?: Array<{ title?: string; url?: string; objectID: string; points?: number }> }
    const signals: ModelReleaseSignal[] = []
    for (const h of data.hits || []) {
      if (!h.title) continue
      for (const pat of MODEL_RELEASE_PATTERNS) {
        if (pat.test(h.title)) {
          signals.push({
            title: h.title,
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            source: 'hn',
            score: h.points,
            matchedPattern: pat.source,
            seenAt: new Date().toISOString(),
          })
          break
        }
      }
    }
    return signals
  } catch {
    return []
  }
}

async function scanGithubForReleases(): Promise<ModelReleaseSignal[]> {
  // Check release activity from a handful of watched model-hosting orgs
  const orgs = ['openai', 'anthropics', 'meta-llama', 'deepseek-ai', 'mistralai', 'google-deepmind', 'QwenLM']
  const out: ModelReleaseSignal[] = []
  for (const org of orgs) {
    try {
      const res = await fetch(`https://api.github.com/orgs/${org}/events?per_page=10`, {
        headers: { 'User-Agent': 'kbot-discovery/1.0', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const events = await res.json() as Array<{ type: string; repo?: { name: string }; payload?: { release?: { name?: string; tag_name?: string; html_url?: string } } }>
      for (const e of events) {
        if (e.type === 'ReleaseEvent' && e.payload?.release) {
          const r = e.payload.release
          out.push({
            title: `${e.repo?.name || org}: ${r.name || r.tag_name || '(release)'}`,
            url: r.html_url || `https://github.com/${e.repo?.name || org}`,
            source: 'github',
            matchedPattern: 'release-event',
            seenAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* per-org failures shouldn't kill the scan */ }
  }
  return out
}

async function runModelReleases(state: DaemonState): Promise<void> {
  ensureDir(MODEL_RELEASES_DIR)
  const logFile = join(MODEL_RELEASES_DIR, 'signals.jsonl')
  const seenFile = join(MODEL_RELEASES_DIR, 'seen.json')

  // Load the "already-reported" set so we don't spam the log with the same URLs
  let seen: Record<string, string> = {}
  try {
    if (existsSync(seenFile)) seen = JSON.parse(readFileSync(seenFile, 'utf8'))
  } catch {}

  const [hnSignals, ghSignals] = await Promise.all([scanHNForReleases(), scanGithubForReleases()])
  const all = [...hnSignals, ...ghSignals]

  const fresh = all.filter(s => !seen[s.url])
  if (fresh.length === 0) {
    log(`[model-releases] No new model-release signals (${all.length} scanned, all already seen)`)
    return
  }

  for (const s of fresh) {
    seen[s.url] = s.seenAt
    appendFileSync(logFile, JSON.stringify(s) + '\n')
    log(`[model-releases] ${s.source.toUpperCase()} · ${s.title.slice(0, 90)}`)
    observeToolCall('model_release_detected', { source: s.source, url: s.url, title: s.title })
  }

  // Prune seen map to last 500 entries to keep it bounded
  const entries = Object.entries(seen)
  if (entries.length > 500) {
    const trimmed = Object.fromEntries(entries.slice(-500))
    writeFileSync(seenFile, JSON.stringify(trimmed))
  } else {
    writeFileSync(seenFile, JSON.stringify(seen))
  }

  // Notify on a truly significant release (Claude/GPT/Gemini with points > 100)
  for (const s of fresh) {
    if (s.source === 'hn' && (s.score ?? 0) >= 100) {
      await notifyFinding(`New model release on HN (${s.score} pts): ${s.title}\n${s.url}`)
    }
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
    { name: 'synthesis', interval: INTERVALS.pulse, fn: runSynthesis }, // Every heartbeat — zero cost, pure filesystem
    { name: 'intel', interval: INTERVALS.intel, fn: runIntel },
    { name: 'model-releases', interval: INTERVALS.intel, fn: runModelReleases },
    { name: 'opportunities', interval: INTERVALS.intel, fn: runOpportunities },
    { name: 'actions', interval: INTERVALS.intel, fn: processOpportunities },
    { name: 'outreach', interval: INTERVALS.outreach, fn: runOutreach },
    { name: 'obsidian', interval: INTERVALS.outreach, fn: runObsidianSync }, // Every 12 hours — keep vault current
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
  for (const dir of [DAEMON_DIR, PULSE_DIR, INTEL_DIR, OUTREACH_DIR, WRITING_DIR, EVOLUTION_DIR, OPPORTUNITIES_DIR, ACTIONS_DIR, MODEL_RELEASES_DIR]) {
    ensureDir(dir)
  }

  log('═══════════════════════════════════════════════════════════════')
  log('kbot discovery daemon — designed by kbot, run by Isaac')
  log('Not maintenance. Discovery.')
  log('═══════════════════════════════════════════════════════════════')

  // Record start time
  const state = loadState()
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
    saveState(state)
  }

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

// === NOTIFICATION HOOK (added by Claude session 2026-03-25) ===
// When synthesis finds actionable insights, notify Isaac via Discord webhook
async function notifyFinding(finding: string): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1482971938333655090/J6wozdd9BP19iWve3lak3kI8xxWhO073-WG48McaT1yq541tl9awSL4xvyykvY1eGV9m'
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🧠 kbot Discovery',
          description: finding,
          color: 7035797,
          footer: { text: `kbot daemon · ${new Date().toISOString().split('T')[0]}` }
        }]
      })
    })
  } catch { /* silent fail — don't crash daemon */ }
}

// Export for use in synthesis cycles
;(globalThis as any).__kbot_notify = notifyFinding
