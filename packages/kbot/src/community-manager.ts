// kbot Community Manager — Autonomous community management system
//
// Monitors GitHub issues/PRs, generates daily digests, welcomes new
// contributors, and answers FAQs from a local knowledge base.
//
// Usage:
//   import { runCommunityManager } from './community-manager.js'
//   await runCommunityManager({ discord_webhook, github_repo, email_list })
//
// FAQ entries live in ~/.kbot/community-faq.json as an array of
// { question, answer, keywords } objects.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

// ── Types ──

export interface CommunityConfig {
  /** Discord webhook URL for posting digests/notifications */
  discord_webhook?: string
  /** GitHub repo in "owner/repo" format */
  github_repo: string
  /** Email addresses for digest distribution */
  email_list?: string[]
}

export interface FAQEntry {
  question: string
  answer: string
  keywords: string[]
}

interface GitHubIssue {
  number: number
  title: string
  html_url: string
  state: string
  user: { login: string }
  labels: Array<{ name: string }>
  created_at: string
  pull_request?: { html_url: string }
}

interface GitHubPR {
  number: number
  title: string
  html_url: string
  state: string
  user: { login: string }
  created_at: string
  merged_at: string | null
  draft: boolean
}

interface NpmDownloads {
  downloads: number
  start: string
  end: string
  package: string
}

export interface TriageResult {
  issue: number
  title: string
  label: string
  response: string
  url: string
}

export interface CommunityDigest {
  generatedAt: string
  repo: string
  openIssues: number
  openPRs: number
  newIssuesThisWeek: number
  newPRsThisWeek: number
  mergedPRsThisWeek: number
  stargazers: number
  npmDownloadsWeekly: number
  newContributors: string[]
  markdown: string
}

// ── Paths ──

const COMMUNITY_DIR = join(homedir(), '.kbot', 'community')
const FAQ_PATH = join(homedir(), '.kbot', 'community-faq.json')
const HISTORY_PATH = join(COMMUNITY_DIR, 'history.json')
const LOG_PATH = join(COMMUNITY_DIR, 'activity.log')

function ensureDir(): void {
  if (!existsSync(COMMUNITY_DIR)) mkdirSync(COMMUNITY_DIR, { recursive: true })
}

function log(msg: string): void {
  ensureDir()
  const line = `[${new Date().toISOString().slice(0, 19)}] ${msg}\n`
  appendFileSync(LOG_PATH, line)
  console.log(msg)
}

// ── JSON helpers ──

function loadJsonSafe<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function saveJson(path: string, data: unknown): void {
  ensureDir()
  const dir = path.replace(/\/[^/]+$/, '')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

// ── GitHub API helpers ──

async function ghFetch<T>(endpoint: string, repo: string): Promise<T | null> {
  const url = `https://api.github.com/repos/${repo}${endpoint}`
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'kbot-community-manager/1.0',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

/** Use gh CLI if available (already authenticated) */
function ghCliAvailable(): boolean {
  try {
    execSync('gh auth status', { timeout: 5000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function ghCliComment(repo: string, issueNumber: number, body: string): boolean {
  try {
    execSync(
      `gh issue comment ${issueNumber} --repo ${repo} --body ${JSON.stringify(body)}`,
      { timeout: 15000, stdio: 'pipe' },
    )
    return true
  } catch {
    return false
  }
}

// ── Triage ──

function triageIssue(issue: GitHubIssue): { label: string; response: string } {
  const title = issue.title.toLowerCase()
  const hasLabels = issue.labels.length > 0

  // Skip if already labeled
  if (hasLabels) {
    return { label: '', response: '' }
  }

  // Bug report patterns
  if (title.includes('bug') || title.includes('error') || title.includes('crash') ||
      title.includes('broken') || title.includes('fix') || title.includes('fail')) {
    return {
      label: 'bug',
      response: `Thanks for reporting this, @${issue.user.login}! We'll investigate. Could you share:\n\n- Steps to reproduce\n- Expected vs actual behavior\n- Your environment (OS, Node version, kbot version)\n\nThis helps us track it down faster.`,
    }
  }

  // Feature request patterns
  if (title.includes('feature') || title.includes('request') || title.includes('add') ||
      title.includes('support') || title.includes('would be nice') || title.includes('enhancement')) {
    return {
      label: 'enhancement',
      response: `Thanks for the suggestion, @${issue.user.login}! We'll review this for our roadmap. If others find this useful, please upvote with a thumbs-up reaction.`,
    }
  }

  // Question patterns
  if (title.includes('how') || title.includes('?') || title.includes('help') ||
      title.includes('question') || title.includes('docs')) {
    return {
      label: 'question',
      response: `Hi @${issue.user.login}! This looks like a question. Let me see if I can help. Have you checked the docs at https://kernel.chat? If this is still unresolved, we'll get back to you soon.`,
    }
  }

  // Default: needs triage
  return {
    label: 'needs-triage',
    response: `Thanks for opening this, @${issue.user.login}! We'll take a look shortly.`,
  }
}

// ── FAQ ──

function loadFAQ(): FAQEntry[] {
  return loadJsonSafe<FAQEntry[]>(FAQ_PATH, [])
}

/**
 * Fuzzy-match a question against the FAQ knowledge base.
 * Returns the best matching answer or a polite fallback.
 */
export function answerFAQ(question: string): string {
  const faq = loadFAQ()
  if (faq.length === 0) {
    return "I don't have a FAQ knowledge base yet. Add entries to ~/.kbot/community-faq.json to get started."
  }

  const questionLower = question.toLowerCase()
  const questionWords = questionLower.split(/\s+/).filter(w => w.length > 2)

  let bestMatch: FAQEntry | null = null
  let bestScore = 0

  for (const entry of faq) {
    let score = 0

    // Keyword matching (highest weight)
    for (const kw of entry.keywords) {
      if (questionLower.includes(kw.toLowerCase())) {
        score += 3
      }
    }

    // Word overlap with the FAQ question
    const entryWords = entry.question.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    for (const word of questionWords) {
      if (entryWords.includes(word)) {
        score += 2
      }
      // Partial match (substring)
      if (entryWords.some(ew => ew.includes(word) || word.includes(ew))) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  // Threshold: need at least some relevance
  if (bestMatch && bestScore >= 3) {
    return bestMatch.answer
  }

  return "I don't know, let me find someone who does."
}

// ── Welcome ──

/**
 * Generate a personalized welcome message for a new contributor.
 */
export function welcomeContributor(username: string, platform: 'github' | 'discord' | 'email'): string {
  const greetings: Record<string, string> = {
    github: `Welcome to the project, @${username}! We're glad to have you here.\n\nHere are some ways to get started:\n- Check out issues labeled \`good first issue\` for beginner-friendly tasks\n- Read the CLAUDE.md for project architecture and conventions\n- Join our community discussions if you have questions\n\nDon't hesitate to ask for help — we value every contribution, no matter how small.`,
    discord: `Welcome, ${username}! Great to see you in the community.\n\nFeel free to introduce yourself and let us know what brought you here. Check the pinned messages for useful links and resources.`,
    email: `Hi ${username},\n\nWelcome to the project! We're excited to have you as part of the community.\n\nHere are some useful links:\n- GitHub: https://github.com/isaacsight/kernel\n- Docs: https://kernel.chat\n\nLet us know if you have any questions.\n\nBest,\nkbot Community Manager`,
  }

  return greetings[platform] || greetings.github
}

// ── Digest ──

/**
 * Generate a formatted community digest from GitHub and npm data.
 */
export async function generateDigest(repo?: string): Promise<string> {
  const targetRepo = repo || 'isaacsight/kernel'
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoISO = weekAgo.toISOString()

  log(`Generating community digest for ${targetRepo}...`)

  // Fetch repo info
  const repoInfo = await ghFetch<{
    stargazers_count: number
    open_issues_count: number
  }>('', targetRepo)

  // Fetch recent issues (last 30 sorted by created)
  const issues = await ghFetch<GitHubIssue[]>(
    '/issues?state=all&sort=created&direction=desc&per_page=30',
    targetRepo,
  ) || []

  // Fetch recent PRs
  const prs = await ghFetch<GitHubPR[]>(
    '/pulls?state=all&sort=created&direction=desc&per_page=30',
    targetRepo,
  ) || []

  // Separate issues from PRs (GitHub API returns PRs in issues endpoint too)
  const pureIssues = issues.filter(i => !i.pull_request)

  const newIssues = pureIssues.filter(i => i.created_at >= weekAgoISO)
  const newPRs = prs.filter(p => p.created_at >= weekAgoISO)
  const mergedPRs = prs.filter(p => p.merged_at && p.merged_at >= weekAgoISO)
  const openIssues = pureIssues.filter(i => i.state === 'open')
  const openPRs = prs.filter(p => p.state === 'open' && !p.draft)

  // Find new contributors (first-time issue/PR authors this week)
  const history = loadJsonSafe<{ knownContributors: string[] }>(HISTORY_PATH, { knownContributors: [] })
  const knownSet = new Set(history.knownContributors)
  const newContributors: string[] = []

  for (const item of [...newIssues, ...newPRs]) {
    const login = item.user.login
    if (!knownSet.has(login)) {
      knownSet.add(login)
      newContributors.push(login)
    }
  }

  // Update known contributors
  history.knownContributors = Array.from(knownSet)
  saveJson(HISTORY_PATH, history)

  // npm downloads (last week)
  let npmDownloads = 0
  try {
    const npmRes = await fetch(
      'https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot',
      { signal: AbortSignal.timeout(5000) },
    )
    if (npmRes.ok) {
      const npmData = await npmRes.json() as NpmDownloads
      npmDownloads = npmData.downloads || 0
    }
  } catch { /* npm API unavailable */ }

  // Format the digest
  const stars = repoInfo?.stargazers_count ?? 0

  const lines: string[] = [
    `# Community Digest — ${targetRepo}`,
    `> Generated ${now.toISOString().split('T')[0]}`,
    '',
    '## This Week',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| New Issues | ${newIssues.length} |`,
    `| New PRs | ${newPRs.length} |`,
    `| Merged PRs | ${mergedPRs.length} |`,
    `| Open Issues | ${openIssues.length} |`,
    `| Open PRs | ${openPRs.length} |`,
    `| Stars | ${stars} |`,
    `| npm Downloads (week) | ${npmDownloads.toLocaleString()} |`,
    '',
  ]

  if (newContributors.length > 0) {
    lines.push('## New Contributors')
    lines.push('')
    for (const c of newContributors) {
      lines.push(`- @${c}`)
    }
    lines.push('')
  }

  if (mergedPRs.length > 0) {
    lines.push('## Recently Merged')
    lines.push('')
    for (const pr of mergedPRs.slice(0, 10)) {
      lines.push(`- [#${pr.number}](${pr.html_url}) ${pr.title} (@${pr.user.login})`)
    }
    lines.push('')
  }

  if (newIssues.length > 0) {
    lines.push('## Recent Issues')
    lines.push('')
    for (const issue of newIssues.slice(0, 10)) {
      const labels = issue.labels.map(l => l.name).join(', ')
      const labelTag = labels ? ` [${labels}]` : ''
      lines.push(`- [#${issue.number}](${issue.html_url}) ${issue.title}${labelTag}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('*Generated by kbot Community Manager*')

  const markdown = lines.join('\n')

  log(`Digest generated: ${newIssues.length} issues, ${newPRs.length} PRs, ${mergedPRs.length} merged, ${newContributors.length} new contributors`)

  return markdown
}

// ── Discord webhook ──

async function postToDiscord(webhookUrl: string, content: string): Promise<boolean> {
  try {
    // Discord has a 2000 char limit per message — truncate if needed
    const truncated = content.length > 1900
      ? content.slice(0, 1900) + '\n\n... (truncated)'
      : content

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: truncated }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Main orchestrator ──

/**
 * Run the community manager cycle.
 *
 * - Checks GitHub for new issues/PRs and triages them
 * - Generates a daily community digest
 * - Welcomes new contributors
 * - Answers common questions from FAQ
 */
export async function runCommunityManager(config: CommunityConfig): Promise<{
  triaged: TriageResult[]
  digest: string
  welcomed: string[]
}> {
  const { github_repo, discord_webhook } = config

  log(`Community manager starting for ${github_repo}`)

  // ── 1. Triage new issues ──

  const triaged: TriageResult[] = []
  const useGhCli = ghCliAvailable()

  const recentIssues = await ghFetch<GitHubIssue[]>(
    '/issues?state=open&sort=created&direction=desc&per_page=15',
    github_repo,
  ) || []

  // Filter to pure issues (not PRs)
  const pureIssues = recentIssues.filter(i => !i.pull_request)

  // Only triage issues from the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const freshIssues = pureIssues.filter(i => i.created_at >= oneDayAgo)

  for (const issue of freshIssues) {
    const { label, response } = triageIssue(issue)
    if (!label || !response) continue

    triaged.push({
      issue: issue.number,
      title: issue.title,
      label,
      response,
      url: issue.html_url,
    })

    // Post the triage response via gh CLI if available
    if (useGhCli) {
      const posted = ghCliComment(github_repo, issue.number, response)
      if (posted) {
        log(`  Triaged #${issue.number} as ${label}: ${issue.title.slice(0, 50)}`)
      } else {
        log(`  Triage draft for #${issue.number} (could not post): ${issue.title.slice(0, 50)}`)
      }
    } else {
      log(`  Triage draft for #${issue.number} (gh CLI not available): ${issue.title.slice(0, 50)}`)
    }
  }

  // ── 2. Generate digest ──

  const digest = await generateDigest(github_repo)

  // Post digest to Discord if configured
  if (discord_webhook) {
    const posted = await postToDiscord(discord_webhook, digest)
    log(posted ? 'Digest posted to Discord' : 'Failed to post digest to Discord')
  }

  // ── 3. Welcome new contributors ──

  const welcomed: string[] = []
  const history = loadJsonSafe<{ knownContributors: string[]; welcomed: string[] }>(HISTORY_PATH, {
    knownContributors: [],
    welcomed: [],
  })
  const welcomedSet = new Set(history.welcomed || [])

  // Check recent PR authors and issue authors
  const allAuthors = [...freshIssues.map(i => i.user.login)]
  const recentPRs = await ghFetch<GitHubPR[]>(
    '/pulls?state=all&sort=created&direction=desc&per_page=10',
    github_repo,
  ) || []
  const freshPRs = recentPRs.filter(p => p.created_at >= oneDayAgo)
  allAuthors.push(...freshPRs.map(p => p.user.login))

  for (const author of allAuthors) {
    if (welcomedSet.has(author)) continue

    // Check if this is their first contribution (only 1 issue/PR)
    const authorIssues = pureIssues.filter(i => i.user.login === author)
    const authorPRs = recentPRs.filter(p => p.user.login === author)
    const totalContributions = authorIssues.length + authorPRs.length

    if (totalContributions <= 1) {
      const welcomeMsg = welcomeContributor(author, 'github')
      welcomed.push(author)
      welcomedSet.add(author)

      // Post welcome via gh CLI
      if (useGhCli) {
        // Find their issue or PR to comment on
        const target = authorIssues[0] || authorPRs[0]
        if (target) {
          const targetNumber = 'number' in target ? target.number : 0
          if (targetNumber > 0) {
            ghCliComment(github_repo, targetNumber, welcomeMsg)
            log(`  Welcomed new contributor: @${author}`)
          }
        }
      } else {
        log(`  Welcome draft for @${author} (gh CLI not available)`)
      }
    }
  }

  // Persist welcomed list
  history.welcomed = Array.from(welcomedSet)
  saveJson(HISTORY_PATH, history)

  log(`Community manager done: ${triaged.length} triaged, ${welcomed.length} welcomed`)

  return { triaged, digest, welcomed }
}
