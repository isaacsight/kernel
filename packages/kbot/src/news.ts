// kbot News — AI industry news aggregator
//
// Pulls the latest headlines from free, public feeds (Hacker News, arXiv,
// GitHub Trending) and summarises them using the user's configured provider
// (BYOK) or a local Ollama model. Zero API cost when using local models.
//
// Usage:
//   kbot news                  # Top AI headlines across feeds
//   kbot news --source hn      # Hacker News only
//   kbot news --source arxiv   # arXiv cs.AI only
//   kbot news --source github  # Trending AI repos
//   kbot news --limit 20       # More headlines
//   kbot news --summarize      # Ask the model for a digest
//   kbot news --json           # Machine-readable output

import chalk from 'chalk'

export type NewsSource = 'hn' | 'arxiv' | 'github' | 'all'

export interface NewsItem {
  title: string
  url: string
  source: 'hn' | 'arxiv' | 'github'
  score?: number            // HN points, GH stars today, arXiv N/A
  author?: string
  summary?: string
  publishedAt?: string
}

// ── HN: algolia search API (free, no auth) ──

async function fetchHackerNews(limit: number): Promise<NewsItem[]> {
  // "AI OR LLM OR GPT OR Claude OR Gemini OR Anthropic OR OpenAI" — broad AI filter
  const q = encodeURIComponent('(AI OR LLM OR GPT OR Claude OR Gemini OR Anthropic OR OpenAI)')
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${q}&hitsPerPage=${limit}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json() as { hits?: Array<{ title?: string; url?: string; objectID: string; points?: number; author?: string; created_at?: string }> }
    return (data.hits || [])
      .filter(h => h.title)
      .map(h => ({
        title: h.title!,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: 'hn' as const,
        score: h.points,
        author: h.author,
        publishedAt: h.created_at,
      }))
  } catch {
    return []
  }
}

// ── arXiv: cs.AI + cs.CL + cs.LG recent ──

async function fetchArxiv(limit: number): Promise<NewsItem[]> {
  // arXiv API returns Atom XML. We do a lightweight parse — no external deps.
  const cats = 'cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG'
  const url = `http://export.arxiv.org/api/query?search_query=${cats}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const xml = await res.text()
    const items: NewsItem[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let m: RegExpExecArray | null
    while ((m = entryRegex.exec(xml)) !== null) {
      const entry = m[1]
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ')
      const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim()
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim()
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ')
      const author = entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim()
      if (title && link) {
        items.push({
          title,
          url: link,
          source: 'arxiv',
          author,
          summary: summary?.slice(0, 240),
          publishedAt: published,
        })
      }
    }
    return items.slice(0, limit)
  } catch {
    return []
  }
}

// ── GitHub Trending via search API (free, no auth for public search) ──

async function fetchGithubTrending(limit: number): Promise<NewsItem[]> {
  // Top AI-tagged repos created in the last 30 days, sorted by stars
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const q = encodeURIComponent(`topic:ai OR topic:llm OR topic:artificial-intelligence created:>${since}`)
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'kbot-news/1.0', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json() as { items?: Array<{ full_name: string; html_url: string; description?: string; stargazers_count: number; owner?: { login: string }; created_at: string }> }
    return (data.items || []).map(r => ({
      title: `${r.full_name} — ${r.description || '(no description)'}`,
      url: r.html_url,
      source: 'github' as const,
      score: r.stargazers_count,
      author: r.owner?.login,
      publishedAt: r.created_at,
    }))
  } catch {
    return []
  }
}

// ── Aggregate ──

export async function fetchNews(opts: { source?: NewsSource; limit?: number } = {}): Promise<NewsItem[]> {
  const source = opts.source || 'all'
  const limit = opts.limit ?? 10

  if (source === 'hn') return fetchHackerNews(limit)
  if (source === 'arxiv') return fetchArxiv(limit)
  if (source === 'github') return fetchGithubTrending(limit)

  // all — fan out, slice evenly, interleave
  const perSource = Math.max(3, Math.ceil(limit / 3))
  const [hn, arxiv, gh] = await Promise.all([
    fetchHackerNews(perSource),
    fetchArxiv(perSource),
    fetchGithubTrending(perSource),
  ])

  // Interleave so a single slow source doesn't dominate
  const merged: NewsItem[] = []
  const maxLen = Math.max(hn.length, arxiv.length, gh.length)
  for (let i = 0; i < maxLen && merged.length < limit; i++) {
    if (hn[i]) merged.push(hn[i])
    if (merged.length >= limit) break
    if (arxiv[i]) merged.push(arxiv[i])
    if (merged.length >= limit) break
    if (gh[i]) merged.push(gh[i])
  }
  return merged
}

// ── Pretty printing ──

export function formatNews(items: NewsItem[]): string {
  if (items.length === 0) return chalk.yellow('No news items found. Are you online?')
  const lines: string[] = []
  lines.push('')
  lines.push(chalk.bold.hex('#6B5B95')('  ◉ kbot News — AI Industry Headlines'))
  lines.push(chalk.dim(`  ${items.length} items · HN · arXiv · GitHub`))
  lines.push('')
  for (const item of items) {
    const badge = sourceBadge(item.source)
    const meta = formatMeta(item)
    lines.push(`  ${badge} ${chalk.white(item.title)}`)
    lines.push(`    ${chalk.dim(item.url)}${meta ? chalk.dim(' · ' + meta) : ''}`)
    if (item.summary) lines.push(`    ${chalk.dim(item.summary)}`)
    lines.push('')
  }
  return lines.join('\n')
}

function sourceBadge(source: NewsItem['source']): string {
  switch (source) {
    case 'hn': return chalk.hex('#FF6600')('[HN]    ')
    case 'arxiv': return chalk.hex('#B31B1B')('[arXiv] ')
    case 'github': return chalk.hex('#6E7681')('[GH]    ')
  }
}

function formatMeta(item: NewsItem): string {
  const parts: string[] = []
  if (item.score !== undefined) {
    const label = item.source === 'github' ? '★' : '▲'
    parts.push(`${label} ${item.score}`)
  }
  if (item.author) parts.push(`by ${item.author}`)
  if (item.publishedAt) {
    const d = new Date(item.publishedAt)
    if (!isNaN(d.getTime())) parts.push(d.toISOString().slice(0, 10))
  }
  return parts.join(' · ')
}

// ── Optional LLM digest ──

export async function summarizeNews(
  items: NewsItem[],
  runModel: (prompt: string) => Promise<string>,
): Promise<string> {
  if (items.length === 0) return 'No items to summarize.'
  const bullets = items.slice(0, 25).map((i, idx) =>
    `${idx + 1}. [${i.source}] ${i.title}${i.score !== undefined ? ` (${i.score})` : ''} — ${i.url}`
  ).join('\n')
  const prompt = `You are an AI industry analyst. Below are the latest AI-related headlines from Hacker News, arXiv, and GitHub. Produce a short digest (under 200 words) with:
1. 2-3 sentence "what's new" summary
2. The single most consequential release or paper
3. One signal worth watching

Headlines:
${bullets}`
  return runModel(prompt)
}
