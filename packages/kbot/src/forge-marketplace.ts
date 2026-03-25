// kbot Forge Marketplace — Community Tool Discovery & Rating
//
// Enhances the forge registry with marketplace features:
//   - Browse tools sorted by downloads
//   - Rate tools 1-5 stars
//   - Trending tools this week
//   - Project-type-based recommendations
//
// Uses only Node built-ins + fetch. No external dependencies.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const KBOT_DIR = join(homedir(), '.kbot')
const FORGE_DIR = join(KBOT_DIR, 'forge')
const RATINGS_FILE = join(FORGE_DIR, 'forge-ratings.json')

const MARKETPLACE_URL = process.env.KBOT_MARKETPLACE_URL || 'https://kernel.chat/api/forge/marketplace'

// ── Types ──

export interface MarketplaceTool {
  /** Tool name (snake_case) */
  name: string
  /** Human-readable description */
  description: string
  /** Author username or anonymous */
  author: string
  /** Total download/install count */
  downloads: number
  /** Average rating (1-5), 0 if unrated */
  rating: number
  /** Categorization tags */
  tags: string[]
}

interface LocalRating {
  name: string
  rating: number
  ratedAt: string
}

interface LocalRatingsStore {
  ratings: LocalRating[]
  lastSynced: string | null
}

// ── Helpers ──

function ensureForgeDir(): void {
  if (!existsSync(FORGE_DIR)) mkdirSync(FORGE_DIR, { recursive: true })
}

function loadRatingsStore(): LocalRatingsStore {
  ensureForgeDir()
  try {
    if (existsSync(RATINGS_FILE)) {
      return JSON.parse(readFileSync(RATINGS_FILE, 'utf-8'))
    }
  } catch {
    // Corrupt file
  }
  return { ratings: [], lastSynced: null }
}

function saveRatingsStore(store: LocalRatingsStore): void {
  ensureForgeDir()
  writeFileSync(RATINGS_FILE, JSON.stringify(store, null, 2))
}

// ── Project Type Detection ──

/** Map of file patterns to project types */
const PROJECT_INDICATORS: Record<string, string[]> = {
  React: ['package.json:react', 'tsconfig.json', 'src/App.tsx', 'src/App.jsx'],
  'Next.js': ['next.config.js', 'next.config.mjs', 'next.config.ts', 'app/layout.tsx'],
  Vue: ['package.json:vue', 'nuxt.config.ts', 'vite.config.ts:vue'],
  Angular: ['angular.json', 'package.json:@angular/core'],
  Svelte: ['svelte.config.js', 'package.json:svelte'],
  Python: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  Django: ['manage.py', 'settings.py', 'urls.py'],
  Flask: ['app.py:flask', 'requirements.txt:flask'],
  Rust: ['Cargo.toml', 'src/main.rs', 'src/lib.rs'],
  Go: ['go.mod', 'go.sum', 'main.go'],
  Node: ['package.json', 'tsconfig.json', 'index.ts', 'index.js'],
  Express: ['package.json:express', 'app.ts:express', 'app.js:express'],
  Docker: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
  Terraform: ['main.tf', 'terraform.tfvars', 'variables.tf'],
  Kubernetes: ['k8s/', 'deployment.yaml', 'service.yaml'],
}

// ── Core API ──

/** Fetch tools from the marketplace, sorted by downloads.
 *  Falls back to empty array if the marketplace is unreachable. */
export async function listMarketplaceTools(): Promise<MarketplaceTool[]> {
  try {
    const res = await fetch(`${MARKETPLACE_URL}/tools?sort=downloads&order=desc`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (process.env.KBOT_DEBUG) {
        console.error(`[forge-marketplace] list failed: ${res.status}`)
      }
      return []
    }

    const data = await res.json() as { tools?: MarketplaceTool[] }
    if (!Array.isArray(data.tools)) return []

    // Ensure sorted by downloads descending
    return data.tools.sort((a, b) => b.downloads - a.downloads)
  } catch (err) {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] list error:', (err as Error).message)
    }
    return []
  }
}

/** Rate a forged tool (1-5 stars).
 *  Stores locally at ~/.kbot/forge/forge-ratings.json and syncs to marketplace.
 *  Returns true if the rating was accepted by the server (or stored locally on network failure). */
export async function rateForgedTool(name: string, rating: number): Promise<boolean> {
  // Validate rating
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] rating must be an integer 1-5')
    }
    return false
  }

  if (!name || typeof name !== 'string') {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] tool name is required')
    }
    return false
  }

  // Store locally
  const store = loadRatingsStore()
  const existingIdx = store.ratings.findIndex(r => r.name === name)
  const localRating: LocalRating = {
    name,
    rating,
    ratedAt: new Date().toISOString(),
  }

  if (existingIdx >= 0) {
    store.ratings[existingIdx] = localRating
  } else {
    store.ratings.push(localRating)
  }
  saveRatingsStore(store)

  // Sync to marketplace (non-blocking on failure)
  try {
    const res = await fetch(`${MARKETPLACE_URL}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        rating,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (res.ok) {
      store.lastSynced = new Date().toISOString()
      saveRatingsStore(store)
      return true
    }

    if (process.env.KBOT_DEBUG) {
      console.error(`[forge-marketplace] rate sync failed: ${res.status}`)
    }
    // Rating is stored locally even if sync fails
    return true
  } catch (err) {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] rate sync error:', (err as Error).message)
    }
    // Stored locally — will sync later
    return true
  }
}

/** Get the top 10 trending forged tools this week.
 *  Falls back to empty array if marketplace is unreachable. */
export async function trendingTools(): Promise<MarketplaceTool[]> {
  try {
    const res = await fetch(`${MARKETPLACE_URL}/trending?period=week&limit=10`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (process.env.KBOT_DEBUG) {
        console.error(`[forge-marketplace] trending failed: ${res.status}`)
      }
      return []
    }

    const data = await res.json() as { tools?: MarketplaceTool[] }
    return Array.isArray(data.tools) ? data.tools.slice(0, 10) : []
  } catch (err) {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] trending error:', (err as Error).message)
    }
    return []
  }
}

/** Recommend forged tools based on detected project type.
 *  Returns tools that other users of similar projects found useful. */
export async function recommendTools(projectType: string): Promise<MarketplaceTool[]> {
  if (!projectType || typeof projectType !== 'string') return []

  const normalized = projectType.trim()

  try {
    const res = await fetch(
      `${MARKETPLACE_URL}/recommend?project_type=${encodeURIComponent(normalized)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      if (process.env.KBOT_DEBUG) {
        console.error(`[forge-marketplace] recommend failed: ${res.status}`)
      }
      return []
    }

    const data = await res.json() as { tools?: MarketplaceTool[] }
    return Array.isArray(data.tools) ? data.tools : []
  } catch (err) {
    if (process.env.KBOT_DEBUG) {
      console.error('[forge-marketplace] recommend error:', (err as Error).message)
    }
    return []
  }
}

// ── Display Helpers ──

/** Format a marketplace tool list for terminal display */
export function formatToolList(tools: MarketplaceTool[], title: string): string {
  if (tools.length === 0) return `${title}: No tools found.`

  const lines = tools.map((t, i) => {
    const stars = t.rating > 0 ? `${'*'.repeat(Math.round(t.rating))}` : 'unrated'
    const tagStr = t.tags.length > 0 ? t.tags.join(', ') : 'no tags'
    return `  ${i + 1}. ${t.name} — ${t.description}\n     ${t.downloads} downloads · ${stars} · by ${t.author} · ${tagStr}`
  })

  return `${title} (${tools.length} tools):\n\n${lines.join('\n\n')}`
}

/** Get local ratings for display */
export function getLocalRatings(): LocalRating[] {
  return loadRatingsStore().ratings
}

/** Get supported project types for recommendation */
export function getSupportedProjectTypes(): string[] {
  return Object.keys(PROJECT_INDICATORS)
}
