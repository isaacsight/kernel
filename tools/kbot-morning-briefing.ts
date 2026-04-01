#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// K:BOT Morning Briefing — Daily summary email
// Gathers overnight data from npm, GitHub, Supabase, dream engine,
// discovery daemon, and service health. Summarizes via local Ollama,
// then emails Isaac via Resend.
//
// Usage:
//   npx tsx tools/kbot-morning-briefing.ts          # Run once
//   npx tsx tools/kbot-morning-briefing.ts --dry-run # Preview without sending
//
// Also runs as a daemon task (24h interval, same as dailyDigest).
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(PROJECT_ROOT, '.env'), 'utf8')
function getEnv(key: string): string {
  const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return match?.[1]?.trim() ?? ''
}

const RESEND_KEY = getEnv('RESEND_API_KEY')
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_KEY')
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'kernel:latest'
const RECIPIENT = 'isaacsight@gmail.com'
const DRY_RUN = process.argv.includes('--dry-run')

const DISCOVERY_PULSE = join(PROJECT_ROOT, '.kbot-discovery', 'pulse', 'latest.json')
const DREAM_STATE = join(homedir(), '.kbot', 'memory', 'dreams', 'state.json')
const DREAM_JOURNAL = join(homedir(), '.kbot', 'memory', 'dreams', 'journal.json')
const REPORTS_DIR = join(PROJECT_ROOT, 'tools', 'daemon-reports')
const BRIEFING_DIR = join(REPORTS_DIR, 'morning-briefing')

// ── Observer: feed kbot's learning engine ──

const OBSERVER_DIR = join(homedir(), '.kbot', 'observer')
const OBSERVER_LOG = join(OBSERVER_DIR, 'session.jsonl')

function observeToolCall(tool: string, args: Record<string, unknown> = {}, error = false): void {
  try {
    if (!existsSync(OBSERVER_DIR)) mkdirSync(OBSERVER_DIR, { recursive: true })
    const entry = {
      ts: new Date().toISOString(),
      tool,
      args,
      session: 'morning-briefing',
      error,
    }
    appendFileSync(OBSERVER_LOG, JSON.stringify(entry) + '\n')
  } catch { /* observer is non-critical */ }
}

// ── Supabase client ──

const svc = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Logging ──

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${timestamp}] [morning-briefing] ${msg}`
  console.log(line)
}

// ── Date helpers ──

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function readSafe(path: string): string {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

function jsonSafe<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  } catch { /* corrupted */ }
  return fallback
}

// ═══════════════════════════════════════════════════════════════════════
// DATA GATHERERS
// ═══════════════════════════════════════════════════════════════════════

interface BriefingData {
  npm: { yesterday: number; dayBefore: number; weekly: number }
  github: { stars: number; openIssues: number; openPRs: number; newIssues: string[]; newPRs: string[] }
  emails: { count: number; senders: string[] }
  dreams: { cycles: number; totalInsights: number; activeInsights: number; topInsight: string }
  services: Array<{ name: string; status: 'running' | 'stopped' | 'unknown' }>
  discovery: { npm: number; stars: number; starsDelta: number; hn: { score: number; comments: number } }
  git: { commits24h: string; filesChanged: string }
  daemonHealth: { lastRun: string; errorsToday: number; ollamaStatus: string; totalTokens: number }
}

async function gatherNpmData(): Promise<BriefingData['npm']> {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date()
    dayBefore.setDate(dayBefore.getDate() - 2)

    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const [yRes, dbRes, wRes] = await Promise.all([
      fetch(`https://api.npmjs.org/downloads/point/${fmt(yesterday)}/${fmt(yesterday)}/@kernel.chat/kbot`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`https://api.npmjs.org/downloads/point/${fmt(dayBefore)}/${fmt(dayBefore)}/@kernel.chat/kbot`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot`, {
        signal: AbortSignal.timeout(10_000),
      }),
    ])

    const yData = yRes.ok ? await yRes.json() as { downloads?: number } : { downloads: 0 }
    const dbData = dbRes.ok ? await dbRes.json() as { downloads?: number } : { downloads: 0 }
    const wData = wRes.ok ? await wRes.json() as { downloads?: number } : { downloads: 0 }

    return {
      yesterday: yData.downloads ?? 0,
      dayBefore: dbData.downloads ?? 0,
      weekly: wData.downloads ?? 0,
    }
  } catch (err) {
    log(`npm data fetch failed: ${(err as Error).message}`)
    return { yesterday: 0, dayBefore: 0, weekly: 0 }
  }
}

async function gatherGitHubData(): Promise<BriefingData['github']> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'kbot-morning-briefing',
      'Accept': 'application/vnd.github.v3+json',
    }
    const ghToken = getEnv('GITHUB_TOKEN') || getEnv('GH_TOKEN')
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`

    const [repoRes, issuesRes, prsRes] = await Promise.all([
      fetch('https://api.github.com/repos/isaacsight/kernel', {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
      fetch('https://api.github.com/repos/isaacsight/kernel/issues?state=open&per_page=5&sort=created&direction=desc', {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
      fetch('https://api.github.com/repos/isaacsight/kernel/pulls?state=open&per_page=5&sort=created&direction=desc', {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
    ])

    const repo = repoRes.ok ? await repoRes.json() as { stargazers_count?: number; open_issues_count?: number } : {}
    const issues = issuesRes.ok ? await issuesRes.json() as Array<{ title?: string; pull_request?: unknown; created_at?: string }> : []
    const prs = prsRes.ok ? await prsRes.json() as Array<{ title?: string; created_at?: string }> : []

    // Filter issues (GitHub API includes PRs in issues endpoint)
    const realIssues = Array.isArray(issues) ? issues.filter(i => !i.pull_request) : []

    // Only show issues/PRs created in the last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
    const newIssues = realIssues
      .filter(i => (i.created_at ?? '') > cutoff)
      .map(i => i.title ?? 'Untitled')
    const newPRs = (Array.isArray(prs) ? prs : [])
      .filter(p => (p.created_at ?? '') > cutoff)
      .map(p => p.title ?? 'Untitled')

    return {
      stars: (repo as Record<string, number>).stargazers_count ?? 0,
      openIssues: realIssues.length,
      openPRs: Array.isArray(prs) ? prs.length : 0,
      newIssues,
      newPRs,
    }
  } catch (err) {
    log(`GitHub data fetch failed: ${(err as Error).message}`)
    return { stars: 0, openIssues: 0, openPRs: 0, newIssues: [], newPRs: [] }
  }
}

async function gatherEmailData(): Promise<BriefingData['emails']> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
    const { data, error } = await svc
      .from('contact_messages')
      .select('from_email, from_name')
      .gte('received_at', cutoff)
      .order('received_at', { ascending: false })

    if (error || !data) return { count: 0, senders: [] }

    // Deduplicate senders
    const senders = [...new Set(
      data
        .filter(m => !m.from_email?.endsWith('@kernel.chat'))
        .map(m => m.from_name || m.from_email?.split('@')[0] || 'Unknown')
    )]

    return {
      count: data.filter(m => !m.from_email?.endsWith('@kernel.chat')).length,
      senders,
    }
  } catch (err) {
    log(`Email data fetch failed: ${(err as Error).message}`)
    return { count: 0, senders: [] }
  }
}

function gatherDreamData(): BriefingData['dreams'] {
  const state = jsonSafe<Record<string, number>>(DREAM_STATE, {})
  const journal = jsonSafe<Array<{ content?: string; relevance?: number; category?: string }>>(DREAM_JOURNAL, [])

  // Find the top insight by relevance
  const sorted = [...journal].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
  const topInsight = sorted[0]?.content?.slice(0, 200) ?? 'No insights yet'

  return {
    cycles: state.cycles ?? 0,
    totalInsights: state.totalInsights ?? 0,
    activeInsights: state.activeInsights ?? 0,
    topInsight,
  }
}

function gatherServiceHealth(): BriefingData['services'] {
  const services = [
    { label: 'kbot-daemon', plist: 'com.kernel.openclaw-daemon' },
    { label: 'discovery-daemon', plist: 'com.kernel.kbot-discovery' },
    { label: 'email-agent', plist: 'com.kernel.email-agent' },
    { label: 'discord-bot', plist: 'com.kernel.discord-bot' },
    { label: 'kbot-serve', plist: 'com.kernel.kbot-serve' },
    { label: 'collective-sync', plist: 'com.kernel.kbot-collective-sync' },
    { label: 'mlx-server', plist: 'com.kernel.mlx-server' },
  ]

  return services.map(s => {
    try {
      const output = execSync(`launchctl list 2>/dev/null | grep "${s.plist}" || true`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim()
      if (!output) return { name: s.label, status: 'stopped' as const }
      // launchctl list format: PID  Status  Label
      // PID of "-" means not running, "0" status means OK
      const parts = output.split(/\s+/)
      const pid = parts[0]
      return {
        name: s.label,
        status: (pid && pid !== '-') ? 'running' as const : 'stopped' as const,
      }
    } catch {
      return { name: s.label, status: 'unknown' as const }
    }
  })
}

function gatherDiscoveryData(): BriefingData['discovery'] {
  const pulse = jsonSafe<{
    npm?: { downloads?: number }
    github?: { stars?: number; delta?: number }
    hn?: { score?: number; comments?: number }
  }>(DISCOVERY_PULSE, {})

  return {
    npm: pulse.npm?.downloads ?? 0,
    stars: pulse.github?.stars ?? 0,
    starsDelta: pulse.github?.delta ?? 0,
    hn: {
      score: pulse.hn?.score ?? 0,
      comments: pulse.hn?.comments ?? 0,
    },
  }
}

function gatherGitActivity(): BriefingData['git'] {
  try {
    const commits = execSync('git log --since="24 hours ago" --format="%h %s" --no-merges', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim()
    const stats = execSync('git diff --stat HEAD~5..HEAD 2>/dev/null || echo "no recent changes"', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim()
    return { commits24h: commits || 'No commits in the last 24h', filesChanged: stats }
  } catch {
    return { commits24h: 'Unable to read git log', filesChanged: '' }
  }
}

function gatherDaemonHealth(): BriefingData['daemonHealth'] {
  const stateFile = join(REPORTS_DIR, 'state.json')
  const state = jsonSafe<{
    lastRunTimestamps?: Record<string, string>
    stats?: { errorsToday?: number; lastOllamaStatus?: string; totalTokens?: number }
  }>(stateFile, {})

  // Find the most recent task run
  const timestamps = Object.values(state.lastRunTimestamps ?? {})
  const lastRun = timestamps.length > 0
    ? timestamps.sort().reverse()[0]
    : 'Never'

  return {
    lastRun,
    errorsToday: state.stats?.errorsToday ?? 0,
    ollamaStatus: state.stats?.lastOllamaStatus ?? 'unknown',
    totalTokens: state.stats?.totalTokens ?? 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// OLLAMA BRIEFING GENERATION
// ═══════════════════════════════════════════════════════════════════════

async function generateBriefing(data: BriefingData): Promise<string> {
  const npmDelta = data.npm.yesterday - data.npm.dayBefore
  const npmDirection = npmDelta > 0 ? `up ${npmDelta}` : npmDelta < 0 ? `down ${Math.abs(npmDelta)}` : 'flat'

  const runningServices = data.services.filter(s => s.status === 'running').map(s => s.name)
  const stoppedServices = data.services.filter(s => s.status !== 'running').map(s => s.name)

  const dataBlob = `
NPM DOWNLOADS:
- Yesterday: ${data.npm.yesterday} (${npmDirection} from day before: ${data.npm.dayBefore})
- Weekly total: ${data.npm.weekly}

GITHUB:
- Stars: ${data.github.stars}
- Open issues: ${data.github.openIssues}, Open PRs: ${data.github.openPRs}
- New issues (24h): ${data.github.newIssues.length > 0 ? data.github.newIssues.join(', ') : 'None'}
- New PRs (24h): ${data.github.newPRs.length > 0 ? data.github.newPRs.join(', ') : 'None'}

INBOUND EMAILS (24h):
- Count: ${data.emails.count}
- Senders: ${data.emails.senders.length > 0 ? data.emails.senders.join(', ') : 'None'}

DREAM ENGINE:
- Total cycles: ${data.dreams.cycles}
- Active insights: ${data.dreams.activeInsights}
- Top insight: ${data.dreams.topInsight}

SERVICES:
- Running: ${runningServices.length > 0 ? runningServices.join(', ') : 'None'}
- Stopped: ${stoppedServices.length > 0 ? stoppedServices.join(', ') : 'None'}

DISCOVERY DAEMON (latest pulse):
- npm downloads tracked: ${data.discovery.npm}
- GitHub stars: ${data.discovery.stars} (delta: ${data.discovery.starsDelta})
- HN post: score ${data.discovery.hn.score}, ${data.discovery.hn.comments} comments

GIT ACTIVITY (24h):
${data.git.commits24h}

DAEMON HEALTH:
- Last task run: ${data.daemonHealth.lastRun}
- Errors today: ${data.daemonHealth.errorsToday}
- Ollama: ${data.daemonHealth.ollamaStatus}
- Lifetime tokens: ${data.daemonHealth.totalTokens.toLocaleString()}
`.trim()

  // Try Ollama for a conversational summary
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are writing a morning briefing email for Isaac, the solo developer of kbot (an open-source terminal AI agent). Write in a conversational, concise tone — like a trusted chief of staff giving a quick morning update. Not a data dump. Not robotic. A warm, smart summary.

Rules:
- 3-5 short paragraphs max
- Bold key numbers using **number** markdown syntax
- Lead with the most interesting or actionable thing
- If something is down or broken, say so clearly
- End with a one-liner on what to focus on today
- Do NOT use bullet points or headers — flowing prose only
- Do NOT start with "Good morning" or similar greetings — just dive in`,
          },
          {
            role: 'user',
            content: `Here's everything from overnight. Summarize it as my morning briefing:\n\n${dataBlob}`,
          },
        ],
        stream: false,
        options: { num_predict: 800, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (res.ok) {
      const data = await res.json() as { message?: { content?: string } }
      let content = data.message?.content?.trim() ?? ''
      // Strip think tags from reasoning models
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '').trim()
      if (content.length > 50) return content
    }
  } catch (err) {
    log(`Ollama generation failed: ${(err as Error).message}`)
  }

  // Fallback: structured summary if Ollama is down
  log('Falling back to structured briefing (Ollama unavailable)')
  const parts: string[] = []

  parts.push(`kbot saw **${data.npm.yesterday}** npm downloads yesterday (${npmDirection} from ${data.npm.dayBefore} the day before), bringing the weekly total to **${data.npm.weekly}**. The repo sits at **${data.github.stars}** GitHub stars.`)

  if (data.github.newIssues.length > 0 || data.github.newPRs.length > 0) {
    const items: string[] = []
    if (data.github.newIssues.length > 0) items.push(`${data.github.newIssues.length} new issue(s)`)
    if (data.github.newPRs.length > 0) items.push(`${data.github.newPRs.length} new PR(s)`)
    parts.push(`On GitHub: ${items.join(' and ')}. ${data.github.openIssues} open issues and ${data.github.openPRs} open PRs total.`)
  }

  if (data.emails.count > 0) {
    parts.push(`**${data.emails.count}** inbound email(s) overnight from: ${data.emails.senders.join(', ')}.`)
  }

  parts.push(`The dream engine has run **${data.dreams.cycles}** cycles with **${data.dreams.activeInsights}** active insights. Top insight: "${data.dreams.topInsight.slice(0, 150)}..."`)

  const stopped = data.services.filter(s => s.status !== 'running')
  if (stopped.length > 0) {
    parts.push(`Heads up: ${stopped.map(s => s.name).join(', ')} ${stopped.length === 1 ? 'is' : 'are'} not running.`)
  } else {
    parts.push('All services are running normally.')
  }

  return parts.join('\n\n')
}

// ═══════════════════════════════════════════════════════════════════════
// EMAIL SENDER
// ═══════════════════════════════════════════════════════════════════════

async function sendBriefingEmail(briefingText: string): Promise<boolean> {
  const dateStr = formatDate(new Date())

  // Convert markdown bold to HTML bold, paragraphs to <p> tags
  const bodyHtml = briefingText
    .split('\n\n')
    .map(para => {
      let html = para
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #6B5B95;">$1</strong>')
        .replace(/\n/g, '<br>')
      return `<p style="margin: 0 0 16px 0;">${html}</p>`
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background-color: #f5f0eb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px; font-family: 'Georgia', 'EB Garamond', serif; color: #1a1a2e; line-height: 1.7;">
    <div style="border-bottom: 2px solid #6B5B95; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; font-size: 18px; font-family: 'Courier New', 'Courier Prime', monospace; color: #6B5B95; letter-spacing: 2px; text-transform: uppercase;">Morning Briefing</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #888; font-family: 'Courier New', monospace;">${dateStr} &middot; kbot &middot; kernel.chat</p>
    </div>
    <div style="font-size: 15px;">
      ${bodyHtml}
    </div>
    <hr style="border: none; border-top: 1px solid #e0d8cf; margin: 32px 0 16px;" />
    <p style="font-size: 11px; color: #999; font-family: 'Courier New', monospace; text-align: center;">
      Generated by kbot daemon &middot; local Ollama &middot; $0 cost<br>
      <a href="https://kernel.chat" style="color: #6B5B95; text-decoration: none;">kernel.chat</a> &middot; <a href="https://github.com/isaacsight/kernel" style="color: #6B5B95; text-decoration: none;">GitHub</a> &middot; <a href="https://www.npmjs.com/package/@kernel.chat/kbot" style="color: #6B5B95; text-decoration: none;">npm</a>
    </p>
  </div>
</body>
</html>`.trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Kernel Agent <support@kernel.chat>',
        to: RECIPIENT,
        subject: `kbot morning briefing — ${dateStr}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      log(`Resend error ${res.status}: ${err.slice(0, 200)}`)
      return false
    }
    return true
  } catch (err) {
    log(`Email send failed: ${(err as Error).message}`)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  log('Starting morning briefing...')
  observeToolCall('morning_briefing_start')

  // Gather all data in parallel
  const [npm, github, emails] = await Promise.all([
    gatherNpmData(),
    gatherGitHubData(),
    gatherEmailData(),
  ])

  const dreams = gatherDreamData()
  const services = gatherServiceHealth()
  const discovery = gatherDiscoveryData()
  const git = gatherGitActivity()
  const daemonHealth = gatherDaemonHealth()

  const data: BriefingData = { npm, github, emails, dreams, services, discovery, git, daemonHealth }

  log(`Data gathered: npm=${npm.yesterday} downloads, github=${github.stars} stars, emails=${emails.count}, dreams=${dreams.cycles} cycles, services=${services.filter(s => s.status === 'running').length}/${services.length} running`)
  observeToolCall('morning_briefing_data', {
    npm_downloads: npm.yesterday,
    github_stars: github.stars,
    emails: emails.count,
    dream_cycles: dreams.cycles,
  })

  // Generate the briefing
  const briefingText = await generateBriefing(data)
  log(`Briefing generated: ${briefingText.length} chars`)

  // Save a copy
  if (!existsSync(BRIEFING_DIR)) mkdirSync(BRIEFING_DIR, { recursive: true })
  const briefingPath = join(BRIEFING_DIR, `${today()}.md`)
  const { writeFileSync } = await import('fs')
  writeFileSync(briefingPath, `# Morning Briefing — ${formatDate(new Date())}\n\n${briefingText}\n\n---\n*Generated ${new Date().toISOString()} via ${OLLAMA_MODEL} (local, $0)*\n`)
  log(`Briefing saved to ${briefingPath}`)

  if (DRY_RUN) {
    console.log('\n═══ DRY RUN — Email Preview ═══\n')
    console.log(`To: ${RECIPIENT}`)
    console.log(`Subject: kbot morning briefing — ${formatDate(new Date())}`)
    console.log(`From: Kernel Agent <support@kernel.chat>\n`)
    console.log(briefingText)
    console.log('\n═══ End Preview ═══')
    observeToolCall('morning_briefing_dry_run')
    return
  }

  // Send email
  const sent = await sendBriefingEmail(briefingText)
  if (sent) {
    log(`Briefing emailed to ${RECIPIENT}`)
    observeToolCall('morning_briefing_sent', { to: RECIPIENT })
  } else {
    log('Failed to send briefing email')
    observeToolCall('morning_briefing_sent', { to: RECIPIENT }, true)
  }
}

// ── Export for daemon integration ──

export async function runMorningBriefing(): Promise<number> {
  await main()
  return 0 // Ollama token tracking happens inside generateBriefing
}

// ── Entry point ──

main().catch(err => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`)
  observeToolCall('morning_briefing_fatal', { error: String(err) }, true)
  process.exit(1)
})
