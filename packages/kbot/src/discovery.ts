// kbot Discovery Agent — autonomous outreach for any project
//
// Scans HN, GitHub Issues, Reddit for conversations relevant to your project.
// Drafts authentic technical responses. Posts them autonomously.
// Learns what works. Adjusts over time.
//
// Usage:
//   kbot discovery start           # start autonomous discovery loop
//   kbot discovery start --dry-run # find + draft but don't post
//   kbot discovery status          # show what's been found/posted
//   kbot discovery auth            # configure HN/Reddit/GitHub credentials
//   kbot discovery log             # show recent activity
//
// The user teaches kbot once: project name, description, topics of expertise,
// and platform credentials. Then kbot runs autonomously.

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

// ── Types ──

export interface DiscoveryConfig {
  /** Project name (e.g., "kbot", "my-api") */
  projectName: string
  /** One-line description */
  projectDescription: string
  /** Topics kbot should look for (e.g., ["AI agent", "terminal tool", "local LLM"]) */
  topics: string[]
  /** HN username (for posting) */
  hnUsername?: string
  /** HN cookie string (for posting) */
  hnCookie?: string
  /** GitHub token (for commenting on issues) — uses gh CLI if available */
  githubToken?: string
  /** Max posts per cycle */
  maxPostsPerCycle: number
  /** Poll interval in minutes */
  pollIntervalMinutes: number
  /** Dry run — find + draft but don't post */
  dryRun: boolean
  /** Ollama model for analysis */
  ollamaModel: string
  /** Ollama URL */
  ollamaUrl: string
}

export interface Opportunity {
  source: 'hn' | 'github' | 'reddit'
  title: string
  url: string
  snippet: string
  foundAt: string
}

export interface PostRecord {
  timestamp: string
  url: string
  title: string
  comment: string
  platform: string
  success: boolean
  error?: string
}

export interface DiscoveryState {
  totalScans: number
  totalFound: number
  totalPosted: number
  totalSkipped: number
  lastScan: string
  posts: PostRecord[]
}

// ── Paths ──

const DISCOVERY_DIR = join(homedir(), '.kbot', 'discovery')
const CONFIG_FILE = join(DISCOVERY_DIR, 'config.json')
const STATE_FILE = join(DISCOVERY_DIR, 'state.json')
const LOG_FILE = join(DISCOVERY_DIR, 'activity.log')

function ensureDir(): void {
  if (!existsSync(DISCOVERY_DIR)) mkdirSync(DISCOVERY_DIR, { recursive: true })
}

// ── Config ──

export function loadConfig(): DiscoveryConfig | null {
  if (!existsSync(CONFIG_FILE)) return null
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) } catch { return null }
}

export function saveConfig(config: DiscoveryConfig): void {
  ensureDir()
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

function loadState(): DiscoveryState {
  if (!existsSync(STATE_FILE)) return { totalScans: 0, totalFound: 0, totalPosted: 0, totalSkipped: 0, lastScan: '', posts: [] }
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch {
    return { totalScans: 0, totalFound: 0, totalPosted: 0, totalSkipped: 0, lastScan: '', posts: [] }
  }
}

function saveState(state: DiscoveryState): void {
  ensureDir()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function log(msg: string): void {
  ensureDir()
  const line = `[${new Date().toISOString().slice(0, 19)}] ${msg}\n`
  appendFileSync(LOG_FILE, line)
  console.log(msg)
}

// ── Scanning ──

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'kbot-discovery/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function scanHN(topics: string[]): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = []
  const queries = topics.map(t => t.replace(/\s+/g, '+'))

  for (const q of queries.slice(0, 4)) {
    try {
      const data = await fetchJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,show_hn,ask_hn)&hitsPerPage=5`
      ) as { hits: Array<{ objectID: string; title: string; url?: string; points: number }> }

      for (const hit of (data.hits || [])) {
        if (hit.points >= 1) {
          opportunities.push({
            source: 'hn',
            title: hit.title,
            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            snippet: hit.title,
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip failed queries */ }
  }

  // Also search comments for questions/requests
  for (const q of queries.slice(0, 2)) {
    try {
      const data = await fetchJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=comment&hitsPerPage=3`
      ) as { hits: Array<{ objectID: string; story_title: string; comment_text: string }> }

      for (const hit of (data.hits || [])) {
        if (hit.comment_text?.length > 50) {
          opportunities.push({
            source: 'hn',
            title: hit.story_title || 'HN thread',
            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            snippet: hit.comment_text.slice(0, 200),
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip */ }
  }

  return opportunities
}

async function scanGitHub(topics: string[]): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = []

  for (const topic of topics.slice(0, 3)) {
    try {
      const q = encodeURIComponent(`${topic} in:title,body state:open`)
      const data = await fetchJson(
        `https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=5`
      ) as { items: Array<{ html_url: string; title: string; body: string }> }

      for (const item of (data.items || [])) {
        opportunities.push({
          source: 'github',
          title: item.title,
          url: item.html_url,
          snippet: (item.body || '').slice(0, 200),
          foundAt: new Date().toISOString(),
        })
      }
    } catch { /* skip */ }
  }

  return opportunities
}

async function scanReddit(topics: string[]): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = []
  const subs = ['programming', 'commandline', 'artificial', 'LocalLLaMA', 'ChatGPTCoding']

  for (const sub of subs.slice(0, 3)) {
    try {
      const data = await fetchJson(
        `https://www.reddit.com/r/${sub}/new.json?limit=5`
      ) as { data: { children: Array<{ data: { title: string; url: string; selftext: string; permalink: string } }> } }

      for (const post of (data.data?.children || [])) {
        const d = post.data
        const matchesTopic = topics.some(t =>
          d.title.toLowerCase().includes(t.toLowerCase()) ||
          d.selftext.toLowerCase().includes(t.toLowerCase())
        )
        if (matchesTopic) {
          opportunities.push({
            source: 'reddit',
            title: d.title,
            url: `https://www.reddit.com${d.permalink}`,
            snippet: d.selftext.slice(0, 200),
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip */ }
  }

  return opportunities
}

// ── Analysis (Local Ollama) ──

async function analyzeOpportunity(
  opp: Opportunity,
  config: DiscoveryConfig,
): Promise<{ relevant: boolean; draft: string; reasoning: string }> {
  const prompt = `You are evaluating whether to comment on this post. You represent the project "${config.projectName}" — ${config.projectDescription}.

Post title: "${opp.title}"
Post snippet: "${opp.snippet}"
Platform: ${opp.source}

Rules:
- Only respond if you have GENUINE technical insight to add
- Never be promotional — no "check out my tool" or "we built something similar"
- Share specific technical knowledge, ask good questions, or add nuance
- If the post is about medical, legal, financial, or political topics → NOT RELEVANT
- If you can't add real value → NOT RELEVANT

Reply in this EXACT JSON format (no markdown, no explanation):
{"relevant": true/false, "reasoning": "why", "draft": "your comment text"}`

  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
        stream: false,
        options: { num_predict: 500, temperature: 0.7 },
      }),
    })

    if (!res.ok) return { relevant: false, draft: '', reasoning: 'Ollama unavailable' }

    const data = await res.json() as { response?: string }
    const raw = (data.response || '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        relevant: !!parsed.relevant,
        draft: parsed.draft || '',
        reasoning: parsed.reasoning || '',
      }
    }
  } catch { /* analysis failed */ }

  return { relevant: false, draft: '', reasoning: 'Analysis failed' }
}

// ── Posting ──

async function postToHN(url: string, comment: string, config: DiscoveryConfig): Promise<boolean> {
  if (!config.hnCookie) return false

  const idMatch = url.match(/id=(\d+)/)
  if (!idMatch) return false
  const itemId = idMatch[1]

  try {
    // Fetch page for HMAC token
    const pageRes = await fetch(`https://news.ycombinator.com/item?id=${itemId}`, {
      headers: { 'Cookie': config.hnCookie },
    })
    const html = await pageRes.text()

    // Verify logged in
    if (config.hnUsername && !html.includes(config.hnUsername)) {
      log('HN cookie expired — run `kbot discovery auth` to refresh')
      return false
    }

    // Extract HMAC
    const hmacMatch = html.match(/name="hmac"\s+value="([^"]+)"/)
      || html.match(/value="([^"]+)"\s+name="hmac"/)
      || html.match(/hmac.*?value="([a-f0-9]{40,})"/)
    if (!hmacMatch) {
      log('No HMAC found on HN page')
      return false
    }

    // Post comment
    const postRes = await fetch('https://news.ycombinator.com/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': config.hnCookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Origin': 'https://news.ycombinator.com',
        'Referer': `https://news.ycombinator.com/item?id=${itemId}`,
      },
      body: `parent=${itemId}&goto=item%3Fid%3D${itemId}&hmac=${encodeURIComponent(hmacMatch[1])}&text=${encodeURIComponent(comment)}`,
      redirect: 'manual',
    })

    return postRes.status === 302 || postRes.status === 200
  } catch {
    return false
  }
}

async function postToGitHub(url: string, comment: string): Promise<boolean> {
  // Use gh CLI — already authenticated
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/)
  if (!match) return false

  try {
    execSync(`gh issue comment ${match[2]} --repo ${match[1]} --body "${comment.replace(/"/g, '\\"')}"`, {
      timeout: 15000, stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

// ── Main Discovery Loop ──

export async function runDiscoveryCycle(config: DiscoveryConfig): Promise<{
  found: number
  posted: number
  skipped: number
}> {
  const state = loadState()
  state.totalScans++
  state.lastScan = new Date().toISOString()

  log(`Scan #${state.totalScans} — searching ${config.topics.join(', ')}...`)

  // Scan all platforms
  const [hnOpps, ghOpps, redditOpps] = await Promise.allSettled([
    scanHN(config.topics),
    scanGitHub(config.topics),
    scanReddit(config.topics),
  ])

  const allOpps: Opportunity[] = [
    ...(hnOpps.status === 'fulfilled' ? hnOpps.value : []),
    ...(ghOpps.status === 'fulfilled' ? ghOpps.value : []),
    ...(redditOpps.status === 'fulfilled' ? redditOpps.value : []),
  ]

  // Dedup by URL
  const seen = new Set(state.posts.map(p => p.url))
  const fresh = allOpps.filter(o => !seen.has(o.url))

  log(`Found ${allOpps.length} total, ${fresh.length} new`)
  state.totalFound += fresh.length

  let posted = 0
  let skipped = 0

  for (const opp of fresh.slice(0, config.maxPostsPerCycle * 3)) {
    if (posted >= config.maxPostsPerCycle) break

    const analysis = await analyzeOpportunity(opp, config)

    if (!analysis.relevant) {
      log(`  SKIP: ${opp.title.slice(0, 50)} — ${analysis.reasoning.slice(0, 60)}`)
      skipped++
      state.totalSkipped++
      continue
    }

    log(`  RELEVANT: ${opp.title.slice(0, 50)}`)
    log(`  Draft: ${analysis.draft.slice(0, 80)}...`)

    if (config.dryRun) {
      log('  (dry run — not posting)')
      state.posts.push({
        timestamp: new Date().toISOString(),
        url: opp.url, title: opp.title,
        comment: analysis.draft, platform: opp.source,
        success: false, error: 'dry_run',
      })
      continue
    }

    // Post
    let success = false
    let error: string | undefined

    if (opp.source === 'hn') {
      success = await postToHN(opp.url, analysis.draft, config)
      if (!success) error = 'hn_post_failed'
    } else if (opp.source === 'github') {
      success = await postToGitHub(opp.url, analysis.draft)
      if (!success) error = 'github_post_failed'
    } else {
      error = 'platform_unsupported'
    }

    state.posts.push({
      timestamp: new Date().toISOString(),
      url: opp.url, title: opp.title,
      comment: analysis.draft, platform: opp.source,
      success, error,
    })

    if (success) {
      posted++
      state.totalPosted++
      log(`  POSTED to ${opp.source}: ${opp.title.slice(0, 50)}`)
    } else {
      log(`  FAILED: ${error}`)
    }

    // Cooldown between posts (10 seconds)
    if (posted < config.maxPostsPerCycle) {
      await new Promise(r => setTimeout(r, 10000))
    }
  }

  // Keep only last 200 post records
  if (state.posts.length > 200) state.posts = state.posts.slice(-200)

  saveState(state)
  log(`Cycle done: ${fresh.length} found, ${posted} posted, ${skipped} skipped`)

  return { found: fresh.length, posted, skipped }
}

export function getDiscoveryState(): DiscoveryState {
  return loadState()
}

export function getRecentLog(lines = 20): string {
  if (!existsSync(LOG_FILE)) return 'No activity yet.'
  const content = readFileSync(LOG_FILE, 'utf8')
  return content.split('\n').filter(Boolean).slice(-lines).join('\n')
}

// ══════════════════════════════════════════════════════════════════════
// Tool Discovery — find new tools from npm, MCP servers, GitHub
// ══════════════════════════════════════════════════════════════════════

export interface DiscoveredTool {
  name: string
  source: 'npm' | 'github' | 'mcp'
  description: string
  url: string
  relevance: string
  foundAt: string
}

async function discoverTools(config: DiscoveryConfig): Promise<DiscoveredTool[]> {
  const tools: DiscoveredTool[] = []
  const queries = ['mcp server', 'ai agent tool', 'cli tool ai', ...config.topics.map(t => `${t} tool`)]

  // npm search
  for (const q of queries.slice(0, 3)) {
    try {
      const data = await fetchJson(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=5`
      ) as { objects: Array<{ package: { name: string; description: string; links: { npm: string } } }> }

      for (const obj of (data.objects || [])) {
        const pkg = obj.package
        if (pkg.description && pkg.description.length > 10) {
          tools.push({
            name: pkg.name,
            source: 'npm',
            description: pkg.description.slice(0, 200),
            url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
            relevance: q,
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip */ }
  }

  // GitHub repos with "mcp-server" or "ai-agent-tool"
  for (const q of ['mcp-server', 'ai-agent-tools'].slice(0, 2)) {
    try {
      const data = await fetchJson(
        `https://api.github.com/search/repositories?q=${q}+in:name&sort=updated&order=desc&per_page=5`
      ) as { items: Array<{ full_name: string; html_url: string; description: string }> }

      for (const repo of (data.items || [])) {
        if (repo.description) {
          tools.push({
            name: repo.full_name,
            source: 'github',
            description: (repo.description || '').slice(0, 200),
            url: repo.html_url,
            relevance: q,
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip */ }
  }

  return tools
}

// ══════════════════════════════════════════════════════════════════════
// Agent Discovery — propose new specialists based on gaps
// ══════════════════════════════════════════════════════════════════════

export interface ProposedAgent {
  id: string
  name: string
  reason: string
  systemPrompt: string
  proposedAt: string
}

async function discoverAgents(config: DiscoveryConfig): Promise<ProposedAgent[]> {
  const proposals: ProposedAgent[] = []

  // Scan trending topics to find agent gaps
  const trendingQueries = [
    'AI agent specialist 2026',
    'emerging AI use case developer',
    'new programming paradigm tool',
  ]

  for (const q of trendingQueries.slice(0, 2)) {
    try {
      const data = await fetchJson(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=5`
      ) as { hits: Array<{ title: string; objectID: string }> }

      // Use Ollama to analyze if any of these suggest a new agent type
      const titles = (data.hits || []).map(h => h.title).join('\n')
      if (!titles) continue

      try {
        const res = await fetch(`${config.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.ollamaModel,
            prompt: `Given these trending HN posts about AI/tech:\n${titles}\n\nDoes any of these suggest a specialist agent type that doesn't exist yet? Existing agents: kernel, researcher, coder, writer, analyst, aesthete, guardian, curator, strategist, infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter, hacker, operator, dreamer, creative, developer, gamedev, playtester.\n\nIf yes, reply with ONLY this JSON (no markdown):\n{"id": "agent-id", "name": "Agent Name", "reason": "why this agent is needed", "prompt": "system prompt for the agent"}\n\nIf no new agent needed, reply: {"id": "none"}`,
            stream: false,
            options: { num_predict: 400, temperature: 0.7 },
          }),
        })

        if (res.ok) {
          const result = await res.json() as { response?: string }
          const raw = (result.response || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.id && parsed.id !== 'none' && parsed.name) {
              proposals.push({
                id: parsed.id,
                name: parsed.name,
                reason: parsed.reason || '',
                systemPrompt: parsed.prompt || '',
                proposedAt: new Date().toISOString(),
              })
            }
          }
        }
      } catch { /* Ollama unavailable */ }
    } catch { /* search failed */ }
  }

  return proposals
}

// ══════════════════════════════════════════════════════════════════════
// Academic Discovery — track arXiv papers on AI agents & tool use
// ══════════════════════════════════════════════════════════════════════

export interface AcademicPaper {
  title: string
  authors: string
  abstract: string
  url: string
  relevance: string
  publishedAt: string
  foundAt: string
}

async function discoverPapers(): Promise<AcademicPaper[]> {
  const papers: AcademicPaper[] = []
  const queries = [
    'AI agent tool use',
    'autonomous coding agent',
    'cognitive architecture LLM',
    'multi-agent system benchmark',
    'local LLM inference optimization',
  ]

  for (const q of queries.slice(0, 3)) {
    try {
      const encoded = encodeURIComponent(q)
      const res = await fetch(
        `http://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending`,
        { signal: AbortSignal.timeout(10000) },
      )

      if (!res.ok) continue
      const xml = await res.text()

      // Parse Atom XML entries
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
      for (const entry of entries) {
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g, ' ') || ''
        const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\n/g, ' ').slice(0, 300) || ''
        const url = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || ''
        const authors = (entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/g) || [])
          .map(a => a.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() || '')
          .slice(0, 3)
          .join(', ')
        const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || ''

        if (title && url) {
          papers.push({
            title,
            authors,
            abstract,
            url,
            relevance: q,
            publishedAt: published,
            foundAt: new Date().toISOString(),
          })
        }
      }
    } catch { /* skip */ }
  }

  return papers
}

// ══════════════════════════════════════════════════════════════════════
// Extended Discovery Cycle — tools + agents + academia
// ══════════════════════════════════════════════════════════════════════

const TOOLS_FILE = join(DISCOVERY_DIR, 'discovered-tools.json')
const AGENTS_FILE = join(DISCOVERY_DIR, 'proposed-agents.json')
const PAPERS_FILE = join(DISCOVERY_DIR, 'papers.json')

function loadJsonArray<T>(file: string): T[] {
  if (!existsSync(file)) return []
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return [] }
}

function saveJsonArray<T>(file: string, data: T[]): void {
  ensureDir()
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export async function runExtendedDiscovery(config: DiscoveryConfig): Promise<{
  tools: number
  agents: number
  papers: number
}> {
  log('Extended discovery: scanning tools, agents, academia...')

  // Run all three in parallel
  const [toolsResult, agentsResult, papersResult] = await Promise.allSettled([
    discoverTools(config),
    discoverAgents(config),
    discoverPapers(),
  ])

  const newTools = toolsResult.status === 'fulfilled' ? toolsResult.value : []
  const newAgents = agentsResult.status === 'fulfilled' ? agentsResult.value : []
  const newPapers = papersResult.status === 'fulfilled' ? papersResult.value : []

  // Dedup and save tools
  const existingTools = loadJsonArray<DiscoveredTool>(TOOLS_FILE)
  const existingToolNames = new Set(existingTools.map(t => t.name))
  const freshTools = newTools.filter(t => !existingToolNames.has(t.name))
  if (freshTools.length > 0) {
    saveJsonArray(TOOLS_FILE, [...existingTools, ...freshTools].slice(-100))
    log(`  Tools: ${freshTools.length} new (${freshTools.map(t => t.name).slice(0, 3).join(', ')}${freshTools.length > 3 ? '...' : ''})`)
  }

  // Save agent proposals
  const existingAgents = loadJsonArray<ProposedAgent>(AGENTS_FILE)
  const existingAgentIds = new Set(existingAgents.map(a => a.id))
  const freshAgents = newAgents.filter(a => !existingAgentIds.has(a.id))
  if (freshAgents.length > 0) {
    saveJsonArray(AGENTS_FILE, [...existingAgents, ...freshAgents].slice(-50))
    log(`  Agents: ${freshAgents.length} proposed (${freshAgents.map(a => a.name).join(', ')})`)
  }

  // Dedup and save papers
  const existingPapers = loadJsonArray<AcademicPaper>(PAPERS_FILE)
  const existingPaperUrls = new Set(existingPapers.map(p => p.url))
  const freshPapers = newPapers.filter(p => !existingPaperUrls.has(p.url))
  if (freshPapers.length > 0) {
    saveJsonArray(PAPERS_FILE, [...existingPapers, ...freshPapers].slice(-100))
    log(`  Papers: ${freshPapers.length} new (${freshPapers.map(p => p.title.slice(0, 50)).join('; ')}...)`)
  }

  log(`Extended discovery done: ${freshTools.length} tools, ${freshAgents.length} agents, ${freshPapers.length} papers`)

  return { tools: freshTools.length, agents: freshAgents.length, papers: freshPapers.length }
}

export function getDiscoveredTools(): DiscoveredTool[] { return loadJsonArray(TOOLS_FILE) }
export function getProposedAgents(): ProposedAgent[] { return loadJsonArray(AGENTS_FILE) }
export function getDiscoveredPapers(): AcademicPaper[] { return loadJsonArray(PAPERS_FILE) }
