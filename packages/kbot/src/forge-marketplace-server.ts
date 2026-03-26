// kbot Forge Marketplace Server — Local-first HTTP server for tool sharing
//
// Run on one machine for personal use or deploy for the community.
// Other kbot instances can publish tools and download from this server.
//
// Routes:
//   POST /api/forge/publish     — publish a forged tool
//   GET  /api/forge/marketplace — list all tools sorted by downloads
//   GET  /api/forge/tools/:name — get a specific tool
//   POST /api/forge/rate        — rate a tool (1-5)
//   GET  /api/forge/trending    — top 10 by downloads this week
//   GET  /api/forge/recommend   — recommend tools for a project type
//
// Stores everything in ~/.kbot/forge-server/ as JSON files.
// Uses only Node built-ins. No external dependencies.

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs'
import type { Server } from 'node:http'

const KBOT_DIR = join(homedir(), '.kbot')
const SERVER_DIR = join(KBOT_DIR, 'forge-server')
const TOOLS_DIR = join(SERVER_DIR, 'tools')
const RATINGS_FILE = join(SERVER_DIR, 'ratings.json')
const DOWNLOADS_FILE = join(SERVER_DIR, 'downloads.json')

const DEFAULT_PORT = 7439

// ── Types ──

export interface ForgeServerTool {
  /** Tool name (snake_case) */
  name: string
  /** Human-readable description */
  description: string
  /** Tool implementation code */
  code: string
  /** Author username or anonymous */
  author: string
  /** Semver version */
  version: string
  /** ISO timestamp of creation */
  created: string
  /** ISO timestamp of last update */
  updated: string
  /** Categorization tags */
  tags: string[]
}

interface ToolRating {
  name: string
  ratings: number[]
  average: number
  count: number
}

interface DownloadRecord {
  name: string
  total: number
  /** Weekly download counts keyed by ISO week (YYYY-Www) */
  weekly: Record<string, number>
}

interface RatingsStore {
  tools: Record<string, ToolRating>
}

interface DownloadsStore {
  tools: Record<string, DownloadRecord>
}

interface PublishBody {
  name?: string
  description?: string
  code?: string
  author?: string
  version?: string
  tags?: string[]
}

interface RateBody {
  name?: string
  rating?: number
}

// ── Project type to tag mapping for recommendations ──

const PROJECT_TAG_MAP: Record<string, string[]> = {
  react: ['react', 'frontend', 'component', 'jsx', 'tsx', 'ui'],
  nextjs: ['nextjs', 'react', 'ssr', 'fullstack', 'api'],
  vue: ['vue', 'frontend', 'component', 'ui'],
  angular: ['angular', 'frontend', 'component', 'typescript'],
  svelte: ['svelte', 'frontend', 'component', 'ui'],
  python: ['python', 'pip', 'backend', 'script'],
  django: ['django', 'python', 'backend', 'api', 'orm'],
  flask: ['flask', 'python', 'backend', 'api'],
  rust: ['rust', 'cargo', 'systems', 'cli'],
  go: ['go', 'golang', 'backend', 'cli', 'api'],
  node: ['node', 'npm', 'typescript', 'javascript', 'backend'],
  express: ['express', 'node', 'api', 'backend', 'middleware'],
  docker: ['docker', 'container', 'devops', 'deploy'],
  terraform: ['terraform', 'iac', 'devops', 'cloud'],
  kubernetes: ['kubernetes', 'k8s', 'devops', 'container', 'deploy'],
}

// ── Helpers ──

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'))
    }
  } catch {
    // Corrupt file
  }
  return fallback
}

function saveJSON(path: string, data: unknown): void {
  const parentDir = join(path, '..')
  ensureDir(parentDir)
  writeFileSync(path, JSON.stringify(data, null, 2))
}

function loadRatings(): RatingsStore {
  return loadJSON<RatingsStore>(RATINGS_FILE, { tools: {} })
}

function saveRatings(store: RatingsStore): void {
  saveJSON(RATINGS_FILE, store)
}

function loadDownloads(): DownloadsStore {
  return loadJSON<DownloadsStore>(DOWNLOADS_FILE, { tools: {} })
}

function saveDownloads(store: DownloadsStore): void {
  saveJSON(DOWNLOADS_FILE, store)
}

/** Get the ISO week string for a date (YYYY-Www) */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Record a download event for a tool */
function recordDownload(name: string): void {
  const store = loadDownloads()
  if (!store.tools[name]) {
    store.tools[name] = { name, total: 0, weekly: {} }
  }
  store.tools[name].total++
  const week = getISOWeek(new Date())
  store.tools[name].weekly[week] = (store.tools[name].weekly[week] || 0) + 1
  saveDownloads(store)
}

/** Load a tool from disk */
function loadTool(name: string): ForgeServerTool | null {
  const toolPath = join(TOOLS_DIR, `${name}.json`)
  return loadJSON<ForgeServerTool | null>(toolPath, null)
}

/** List all tools on disk */
function listAllTools(): ForgeServerTool[] {
  ensureDir(TOOLS_DIR)
  const files = readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json'))
  const tools: ForgeServerTool[] = []
  for (const file of files) {
    try {
      const tool = JSON.parse(readFileSync(join(TOOLS_DIR, file), 'utf-8')) as ForgeServerTool
      tools.push(tool)
    } catch {
      // Skip corrupt files
    }
  }
  return tools
}

/** Parse JSON body from request */
function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const MAX_BODY = 5 * 1024 * 1024 // 5MB

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })

    req.on('error', reject)
  })
}

/** Send JSON response */
function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

/** Parse URL query parameters */
function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  const idx = url.indexOf('?')
  if (idx === -1) return params
  const query = url.slice(idx + 1)
  for (const pair of query.split('&')) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) {
      params[decodeURIComponent(pair)] = ''
    } else {
      params[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1))
    }
  }
  return params
}

/** Extract path without query string */
function getPath(url: string): string {
  const idx = url.indexOf('?')
  return idx === -1 ? url : url.slice(0, idx)
}

// ── Route Handlers ──

/** POST /api/forge/publish — accepts a forged tool JSON, saves to disk */
async function handlePublish(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req) as PublishBody

  if (!body.name || typeof body.name !== 'string') {
    sendJSON(res, 400, { error: 'Missing required field: name' })
    return
  }
  if (!body.description || typeof body.description !== 'string') {
    sendJSON(res, 400, { error: 'Missing required field: description' })
    return
  }
  if (!body.code || typeof body.code !== 'string') {
    sendJSON(res, 400, { error: 'Missing required field: code' })
    return
  }

  // Sanitize name to safe filesystem characters
  const safeName = body.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()

  const now = new Date().toISOString()
  const existing = loadTool(safeName)

  const tool: ForgeServerTool = {
    name: safeName,
    description: body.description,
    code: body.code,
    author: typeof body.author === 'string' ? body.author : 'anonymous',
    version: typeof body.version === 'string' ? body.version : '1.0.0',
    created: existing?.created || now,
    updated: now,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [],
  }

  ensureDir(TOOLS_DIR)
  saveJSON(join(TOOLS_DIR, `${safeName}.json`), tool)

  sendJSON(res, 200, {
    success: true,
    name: safeName,
    message: `Tool "${safeName}" published successfully.`,
  })
}

/** GET /api/forge/marketplace — returns all published tools sorted by downloads */
function handleMarketplace(_req: IncomingMessage, res: ServerResponse): void {
  const tools = listAllTools()
  const downloads = loadDownloads()
  const ratings = loadRatings()

  const enriched = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    author: tool.author,
    version: tool.version,
    created: tool.created,
    updated: tool.updated,
    tags: tool.tags,
    downloads: downloads.tools[tool.name]?.total || 0,
    rating: ratings.tools[tool.name]?.average || 0,
    rating_count: ratings.tools[tool.name]?.count || 0,
  }))

  // Sort by downloads descending
  enriched.sort((a, b) => b.downloads - a.downloads)

  sendJSON(res, 200, { tools: enriched, total: enriched.length })
}

/** GET /api/forge/tools/:name — returns a specific tool, records download */
function handleGetTool(name: string, res: ServerResponse): void {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  const tool = loadTool(safeName)

  if (!tool) {
    sendJSON(res, 404, { error: `Tool "${safeName}" not found.` })
    return
  }

  // Record download
  recordDownload(safeName)

  const downloads = loadDownloads()
  const ratings = loadRatings()

  sendJSON(res, 200, {
    ...tool,
    downloads: downloads.tools[safeName]?.total || 0,
    rating: ratings.tools[safeName]?.average || 0,
    rating_count: ratings.tools[safeName]?.count || 0,
  })
}

/** POST /api/forge/rate — accepts name + rating (1-5) */
async function handleRate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req) as RateBody

  if (!body.name || typeof body.name !== 'string') {
    sendJSON(res, 400, { error: 'Missing required field: name' })
    return
  }
  if (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    sendJSON(res, 400, { error: 'Rating must be an integer between 1 and 5.' })
    return
  }

  const safeName = body.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()

  // Verify tool exists
  const tool = loadTool(safeName)
  if (!tool) {
    sendJSON(res, 404, { error: `Tool "${safeName}" not found.` })
    return
  }

  const store = loadRatings()
  if (!store.tools[safeName]) {
    store.tools[safeName] = { name: safeName, ratings: [], average: 0, count: 0 }
  }

  const toolRating = store.tools[safeName]
  toolRating.ratings.push(body.rating)

  // Cap stored ratings at 1000 to avoid unbounded growth
  if (toolRating.ratings.length > 1000) {
    toolRating.ratings = toolRating.ratings.slice(-1000)
  }

  toolRating.count = toolRating.ratings.length
  toolRating.average = Math.round(
    (toolRating.ratings.reduce((sum, r) => sum + r, 0) / toolRating.count) * 100,
  ) / 100

  saveRatings(store)

  sendJSON(res, 200, {
    success: true,
    name: safeName,
    average: toolRating.average,
    count: toolRating.count,
  })
}

/** GET /api/forge/trending — top 10 by downloads this week */
function handleTrending(_req: IncomingMessage, res: ServerResponse): void {
  const tools = listAllTools()
  const downloads = loadDownloads()
  const ratings = loadRatings()
  const currentWeek = getISOWeek(new Date())

  const enriched = tools.map(tool => {
    const dl = downloads.tools[tool.name]
    return {
      name: tool.name,
      description: tool.description,
      author: tool.author,
      version: tool.version,
      tags: tool.tags,
      downloads_total: dl?.total || 0,
      downloads_this_week: dl?.weekly[currentWeek] || 0,
      rating: ratings.tools[tool.name]?.average || 0,
      rating_count: ratings.tools[tool.name]?.count || 0,
    }
  })

  // Sort by weekly downloads descending, then total as tiebreaker
  enriched.sort((a, b) => {
    const weekDiff = b.downloads_this_week - a.downloads_this_week
    return weekDiff !== 0 ? weekDiff : b.downloads_total - a.downloads_total
  })

  sendJSON(res, 200, { tools: enriched.slice(0, 10), week: currentWeek })
}

/** GET /api/forge/recommend?type=react — recommend tools for project type */
function handleRecommend(req: IncomingMessage, res: ServerResponse): void {
  const query = parseQuery(req.url || '')
  const projectType = (query.type || '').toLowerCase().trim()

  if (!projectType) {
    sendJSON(res, 400, {
      error: 'Missing query parameter: type',
      supported_types: Object.keys(PROJECT_TAG_MAP),
    })
    return
  }

  const relevantTags = PROJECT_TAG_MAP[projectType] || [projectType]
  const tagSet = new Set(relevantTags)

  const tools = listAllTools()
  const downloads = loadDownloads()
  const ratings = loadRatings()

  // Score each tool by tag overlap + downloads + rating
  const scored = tools.map(tool => {
    const tagOverlap = tool.tags.filter(t => tagSet.has(t.toLowerCase())).length
    const dl = downloads.tools[tool.name]?.total || 0
    const rating = ratings.tools[tool.name]?.average || 0

    // Weighted relevance score
    const score = (tagOverlap * 10) + (rating * 2) + Math.log2(dl + 1)

    return {
      name: tool.name,
      description: tool.description,
      author: tool.author,
      version: tool.version,
      tags: tool.tags,
      downloads: dl,
      rating,
      rating_count: ratings.tools[tool.name]?.count || 0,
      relevance_score: Math.round(score * 100) / 100,
    }
  }).filter(t => {
    // Must have at least one matching tag or the project type in name/description
    const hasTagMatch = t.tags.some(tag => tagSet.has(tag.toLowerCase()))
    const hasNameMatch = t.name.includes(projectType)
    const hasDescMatch = t.description.toLowerCase().includes(projectType)
    return hasTagMatch || hasNameMatch || hasDescMatch
  })

  // Sort by relevance score descending
  scored.sort((a, b) => b.relevance_score - a.relevance_score)

  sendJSON(res, 200, {
    tools: scored.slice(0, 20),
    project_type: projectType,
    matched_tags: relevantTags,
  })
}

// ── Server ──

/** Start the Forge Marketplace HTTP server.
 *  Returns the running server instance. */
export function startForgeServer(port?: number): Server {
  const listenPort = port ?? DEFAULT_PORT

  // Ensure storage directories exist
  ensureDir(SERVER_DIR)
  ensureDir(TOOLS_DIR)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    const method = req.method || 'GET'
    const path = getPath(req.url || '/')

    try {
      // POST /api/forge/publish
      if (method === 'POST' && path === '/api/forge/publish') {
        await handlePublish(req, res)
        return
      }

      // GET /api/forge/marketplace
      if (method === 'GET' && path === '/api/forge/marketplace') {
        handleMarketplace(req, res)
        return
      }

      // GET /api/forge/tools/:name
      if (method === 'GET' && path.startsWith('/api/forge/tools/')) {
        const name = path.slice('/api/forge/tools/'.length)
        if (!name) {
          sendJSON(res, 400, { error: 'Tool name is required.' })
          return
        }
        handleGetTool(decodeURIComponent(name), res)
        return
      }

      // POST /api/forge/rate
      if (method === 'POST' && path === '/api/forge/rate') {
        await handleRate(req, res)
        return
      }

      // GET /api/forge/trending
      if (method === 'GET' && path === '/api/forge/trending') {
        handleTrending(req, res)
        return
      }

      // GET /api/forge/recommend
      if (method === 'GET' && path === '/api/forge/recommend') {
        handleRecommend(req, res)
        return
      }

      // Health check
      if (method === 'GET' && (path === '/' || path === '/health')) {
        const toolCount = listAllTools().length
        sendJSON(res, 200, {
          status: 'ok',
          service: 'kbot-forge-marketplace',
          tools: toolCount,
          uptime: process.uptime(),
        })
        return
      }

      // 404
      sendJSON(res, 404, { error: 'Not found', path })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      if (process.env.KBOT_DEBUG) {
        console.error(`[forge-server] ${method} ${path} error:`, message)
      }
      sendJSON(res, 500, { error: message })
    }
  })

  server.listen(listenPort, () => {
    if (process.env.KBOT_DEBUG || !process.env.KBOT_QUIET) {
      console.log(`[forge-server] Marketplace running on http://localhost:${listenPort}`)
      console.log(`[forge-server] Storage: ${SERVER_DIR}`)
    }
  })

  return server
}
