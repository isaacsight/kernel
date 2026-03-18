import { existsSync, writeFileSync, readFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import chalk from 'chalk'
import { createAgent, getAgent, removeAgent, type MatrixAgent } from './matrix.js'
import { registerTool } from './tools/index.js'

const PLUGINS_DIR = join(homedir(), '.kbot', 'plugins')
const REGISTRY_URL = 'https://raw.githubusercontent.com/isaacsight/kbot-plugins/main/registry.json'
const INSTALLED_MANIFEST = join(homedir(), '.kbot', 'plugins', '.installed.json')

export interface RegistryEntry {
  name: string
  description: string
  version: string
  author: string
  npm?: string
  github?: string
  tags: string[]
  downloads?: number
}

export interface InstalledPlugin {
  name: string
  version: string
  source: 'npm' | 'github' | 'local'
  installedAt: string
  path: string
}

function ensurePluginsDir(): void {
  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true })
  }
}

function readManifest(): InstalledPlugin[] {
  if (!existsSync(INSTALLED_MANIFEST)) {
    return []
  }
  try {
    const raw = readFileSync(INSTALLED_MANIFEST, 'utf-8')
    return JSON.parse(raw) as InstalledPlugin[]
  } catch {
    return []
  }
}

function writeManifest(plugins: InstalledPlugin[]): void {
  ensurePluginsDir()
  writeFileSync(INSTALLED_MANIFEST, JSON.stringify(plugins, null, 2), 'utf-8')
}

function addToManifest(plugin: InstalledPlugin): void {
  const plugins = readManifest()
  const idx = plugins.findIndex(p => p.name === plugin.name)
  if (idx >= 0) {
    plugins[idx] = plugin
  } else {
    plugins.push(plugin)
  }
  writeManifest(plugins)
}

function removeFromManifest(name: string): boolean {
  const plugins = readManifest()
  const idx = plugins.findIndex(p => p.name === name)
  if (idx < 0) return false
  plugins.splice(idx, 1)
  writeManifest(plugins)
  return true
}

export async function searchPlugins(query: string): Promise<RegistryEntry[]> {
  try {
    const res = await fetch(REGISTRY_URL)
    if (!res.ok) {
      console.error(chalk.yellow(`Registry returned ${res.status}. The plugin registry may be temporarily unavailable.`))
      return []
    }
    const registry = (await res.json()) as RegistryEntry[]
    const q = query.toLowerCase()
    return registry.filter(entry => {
      const nameMatch = entry.name.toLowerCase().includes(q)
      const descMatch = entry.description.toLowerCase().includes(q)
      const tagMatch = entry.tags.some(tag => tag.toLowerCase().includes(q))
      return nameMatch || descMatch || tagMatch
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(chalk.yellow(`Could not reach plugin registry: ${message}`))
    console.error(chalk.dim('Check your network connection or try again later.'))
    return []
  }
}

export async function installPlugin(nameOrUrl: string): Promise<InstalledPlugin> {
  ensurePluginsDir()

  const isNpm = nameOrUrl.startsWith('@') || !nameOrUrl.includes('/')
  const isGitHub = nameOrUrl.includes('github.com') || (!isNpm && nameOrUrl.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/))

  if (isGitHub) {
    return installFromGitHub(nameOrUrl)
  }
  return installFromNpm(nameOrUrl)
}

async function installFromNpm(packageName: string): Promise<InstalledPlugin> {
  console.log(chalk.dim(`Installing ${packageName} from npm...`))
  try {
    execSync(`npm install --prefix "${PLUGINS_DIR}" ${packageName}`, {
      stdio: 'pipe',
      timeout: 120_000,
    })

    const cleanName = packageName.replace(/@[^/]*$/, '') // strip version specifier if any
    const pkgDir = join(PLUGINS_DIR, 'node_modules', cleanName)
    let version = 'unknown'

    const pkgJsonPath = join(pkgDir, 'package.json')
    if (existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        version = pkgJson.version || 'unknown'
      } catch {
        // version stays unknown
      }
    }

    const plugin: InstalledPlugin = {
      name: cleanName,
      version,
      source: 'npm',
      installedAt: new Date().toISOString(),
      path: pkgDir,
    }

    addToManifest(plugin)
    console.log(chalk.green(`Installed ${cleanName}@${version} from npm`))
    return plugin
  } catch (err) {
    const message = err instanceof Error ? (err as any).stderr?.toString() || err.message : String(err)
    throw new Error(`Failed to install ${packageName} from npm:\n${message}`)
  }
}

async function installFromGitHub(repoRef: string): Promise<InstalledPlugin> {
  let repo = repoRef
  // Extract user/repo from full URL
  const urlMatch = repoRef.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/)
  if (urlMatch) {
    repo = urlMatch[1]
  }

  const repoName = repo.split('/')[1] || repo
  const cloneDir = join(PLUGINS_DIR, repoName)

  console.log(chalk.dim(`Installing ${repo} from GitHub...`))

  // Remove existing clone if present
  if (existsSync(cloneDir)) {
    rmSync(cloneDir, { recursive: true, force: true })
  }

  try {
    const cloneUrl = repoRef.includes('github.com') ? repoRef : `https://github.com/${repo}.git`
    execSync(`git clone --depth 1 "${cloneUrl}" "${cloneDir}"`, {
      stdio: 'pipe',
      timeout: 120_000,
    })

    let version = 'unknown'
    const pkgJsonPath = join(cloneDir, 'package.json')
    if (existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        version = pkgJson.version || 'unknown'
      } catch {
        // version stays unknown
      }

      // Install dependencies if package.json exists
      try {
        execSync(`npm install --prefix "${cloneDir}"`, {
          stdio: 'pipe',
          timeout: 120_000,
        })
      } catch {
        console.warn(chalk.yellow(`Warning: npm install failed for ${repoName}. Plugin may not work correctly.`))
      }
    }

    const plugin: InstalledPlugin = {
      name: repoName,
      version,
      source: 'github',
      installedAt: new Date().toISOString(),
      path: cloneDir,
    }

    addToManifest(plugin)
    console.log(chalk.green(`Installed ${repoName}@${version} from GitHub (${repo})`))
    return plugin
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to clone ${repo} from GitHub:\n${message}`)
  }
}

export function uninstallPlugin(name: string): boolean {
  const plugins = readManifest()
  const plugin = plugins.find(p => p.name === name)

  if (!plugin) {
    console.error(chalk.yellow(`Plugin "${name}" is not installed via marketplace.`))
    return false
  }

  // Remove files
  if (existsSync(plugin.path)) {
    try {
      if (plugin.source === 'npm') {
        execSync(`npm uninstall --prefix "${PLUGINS_DIR}" ${plugin.name}`, {
          stdio: 'pipe',
          timeout: 60_000,
        })
      } else {
        rmSync(plugin.path, { recursive: true, force: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(chalk.yellow(`Warning: Could not fully clean up files for ${name}: ${message}`))
    }
  }

  removeFromManifest(name)
  console.log(chalk.green(`Uninstalled ${name}`))
  return true
}

export function listInstalled(): InstalledPlugin[] {
  return readManifest()
}

export async function updatePlugin(name: string): Promise<InstalledPlugin | null> {
  const plugins = readManifest()
  const plugin = plugins.find(p => p.name === name)

  if (!plugin) {
    console.error(chalk.yellow(`Plugin "${name}" is not installed via marketplace.`))
    return null
  }

  if (plugin.source === 'npm') {
    console.log(chalk.dim(`Updating ${name} from npm...`))
    try {
      execSync(`npm update --prefix "${PLUGINS_DIR}" ${plugin.name}`, {
        stdio: 'pipe',
        timeout: 120_000,
      })

      let version = plugin.version
      const pkgJsonPath = join(plugin.path, 'package.json')
      if (existsSync(pkgJsonPath)) {
        try {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
          version = pkgJson.version || version
        } catch {
          // keep existing version
        }
      }

      const updated: InstalledPlugin = {
        ...plugin,
        version,
        installedAt: new Date().toISOString(),
      }
      addToManifest(updated)
      console.log(chalk.green(`Updated ${name} to ${version}`))
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(chalk.red(`Failed to update ${name}: ${message}`))
      return null
    }
  }

  if (plugin.source === 'github') {
    console.log(chalk.dim(`Updating ${name} from GitHub...`))
    try {
      execSync(`git -C "${plugin.path}" pull --ff-only`, {
        stdio: 'pipe',
        timeout: 60_000,
      })

      // Reinstall dependencies
      const pkgJsonPath = join(plugin.path, 'package.json')
      let version = plugin.version
      if (existsSync(pkgJsonPath)) {
        try {
          execSync(`npm install --prefix "${plugin.path}"`, {
            stdio: 'pipe',
            timeout: 120_000,
          })
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
          version = pkgJson.version || version
        } catch {
          console.warn(chalk.yellow(`Warning: npm install failed after update for ${name}.`))
        }
      }

      const updated: InstalledPlugin = {
        ...plugin,
        version,
        installedAt: new Date().toISOString(),
      }
      addToManifest(updated)
      console.log(chalk.green(`Updated ${name} to ${version}`))
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(chalk.red(`Failed to update ${name}: ${message}`))
      return null
    }
  }

  console.error(chalk.yellow(`Cannot update locally-installed plugin "${name}". Remove and reinstall manually.`))
  return null
}

export function formatRegistryResults(entries: RegistryEntry[]): string {
  if (entries.length === 0) {
    return chalk.dim('No plugins found.')
  }

  const lines: string[] = [
    chalk.bold('Plugin Registry Results'),
    chalk.dim('─'.repeat(60)),
  ]

  for (const entry of entries) {
    const source = entry.npm ? chalk.cyan('npm') : entry.github ? chalk.magenta('github') : chalk.dim('unknown')
    const downloads = entry.downloads != null ? chalk.dim(` (${entry.downloads.toLocaleString()} downloads)`) : ''
    lines.push(
      `  ${chalk.bold(entry.name)} ${chalk.dim(`v${entry.version}`)} ${source}${downloads}`,
      `  ${entry.description}`,
      `  ${chalk.dim(`by ${entry.author}`)}  ${entry.tags.map(t => chalk.dim(`#${t}`)).join(' ')}`,
      '',
    )
  }

  lines.push(chalk.dim(`${entries.length} plugin${entries.length === 1 ? '' : 's'} found`))
  return lines.join('\n')
}

export function formatInstalledList(plugins: InstalledPlugin[]): string {
  if (plugins.length === 0) {
    return chalk.dim('No plugins installed via marketplace.')
  }

  const lines: string[] = [
    chalk.bold('Installed Plugins'),
    chalk.dim('─'.repeat(60)),
  ]

  for (const plugin of plugins) {
    const sourceLabel =
      plugin.source === 'npm' ? chalk.cyan('npm') :
      plugin.source === 'github' ? chalk.magenta('github') :
      chalk.dim('local')

    const installedDate = new Date(plugin.installedAt)
    const dateStr = installedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    lines.push(
      `  ${chalk.bold(plugin.name)} ${chalk.dim(`v${plugin.version}`)} ${sourceLabel}`,
      `  ${chalk.dim(`installed ${dateStr}`)}  ${chalk.dim(plugin.path)}`,
      '',
    )
  }

  lines.push(chalk.dim(`${plugins.length} plugin${plugins.length === 1 ? '' : 's'} installed`))
  return lines.join('\n')
}


// ══════════════════════════════════════════════════════════════════════════════
// AGENT MARKETPLACE
// ══════════════════════════════════════════════════════════════════════════════
// A community-driven marketplace for sharing and discovering matrix agents.
// Agents are stored as JSON in a GitHub-backed registry, cached locally,
// and installed into the local matrix system.

// ── Data Model ──────────────────────────────────────────────────────────────

export interface MarketplaceAgentConfig {
  name: string
  icon: string
  color: string
  systemPrompt: string
}

export interface MarketplaceAgent {
  id: string
  name: string
  description: string
  author: string
  version: string
  downloads: number
  rating: number
  tags: string[]
  agentConfig: MarketplaceAgentConfig
  createdAt: string
  updatedAt: string
}

export interface MarketplaceManifest {
  agents: MarketplaceAgent[]
  lastUpdated: string
}

// ── Installed Agent Tracking ────────────────────────────────────────────────

export interface InstalledMarketplaceAgent {
  id: string
  name: string
  version: string
  author: string
  installedAt: string
}

const KBOT_DIR = join(homedir(), '.kbot')
const AGENT_MARKETPLACE_DIR = join(KBOT_DIR, 'marketplace')
const MARKETPLACE_CACHE_PATH = join(AGENT_MARKETPLACE_DIR, 'marketplace-cache.json')
const INSTALLED_AGENTS_PATH = join(AGENT_MARKETPLACE_DIR, 'installed-agents.json')

const AGENT_REGISTRY_URL = 'https://raw.githubusercontent.com/isaacsight/kernel/main/packages/kbot/registry/agents.json'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ── Cache ───────────────────────────────────────────────────────────────────

interface CachedManifest {
  manifest: MarketplaceManifest
  fetchedAt: number
}

function ensureMarketplaceDir(): void {
  if (!existsSync(AGENT_MARKETPLACE_DIR)) {
    mkdirSync(AGENT_MARKETPLACE_DIR, { recursive: true })
  }
}

function readCachedManifest(): CachedManifest | null {
  if (!existsSync(MARKETPLACE_CACHE_PATH)) return null
  try {
    const raw = readFileSync(MARKETPLACE_CACHE_PATH, 'utf-8')
    return JSON.parse(raw) as CachedManifest
  } catch {
    return null
  }
}

function writeCachedManifest(manifest: MarketplaceManifest): void {
  ensureMarketplaceDir()
  const cached: CachedManifest = { manifest, fetchedAt: Date.now() }
  writeFileSync(MARKETPLACE_CACHE_PATH, JSON.stringify(cached, null, 2), 'utf-8')
}

function isCacheValid(cached: CachedManifest): boolean {
  return Date.now() - cached.fetchedAt < CACHE_TTL_MS
}

// ── Installed Agents Persistence ────────────────────────────────────────────

function readInstalledAgents(): InstalledMarketplaceAgent[] {
  if (!existsSync(INSTALLED_AGENTS_PATH)) return []
  try {
    const raw = readFileSync(INSTALLED_AGENTS_PATH, 'utf-8')
    return JSON.parse(raw) as InstalledMarketplaceAgent[]
  } catch {
    return []
  }
}

function writeInstalledAgents(agents: InstalledMarketplaceAgent[]): void {
  ensureMarketplaceDir()
  writeFileSync(INSTALLED_AGENTS_PATH, JSON.stringify(agents, null, 2), 'utf-8')
}

function addInstalledAgent(entry: InstalledMarketplaceAgent): void {
  const agents = readInstalledAgents()
  const idx = agents.findIndex(a => a.id === entry.id)
  if (idx >= 0) {
    agents[idx] = entry
  } else {
    agents.push(entry)
  }
  writeInstalledAgents(agents)
}

function removeInstalledAgent(id: string): boolean {
  const agents = readInstalledAgents()
  const idx = agents.findIndex(a => a.id === id)
  if (idx < 0) return false
  agents.splice(idx, 1)
  writeInstalledAgents(agents)
  return true
}

// ── Bundled Starter Agents ──────────────────────────────────────────────────

const BUNDLED_AGENTS: MarketplaceAgent[] = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews PRs and code changes with a security-first mindset. Analyzes correctness, edge cases, error handling, performance, and adherence to project conventions.',
    author: 'kernel.chat',
    version: '1.0.0',
    downloads: 0,
    rating: 4.8,
    tags: ['code-review', 'security', 'quality', 'pr'],
    agentConfig: {
      name: 'Code Reviewer',
      icon: '⊕',
      color: '#4682B4',
      systemPrompt: `You are a senior staff engineer performing a thorough code review. Your process:

1. **Correctness** — Does the code do what it claims? Are there off-by-one errors, null checks, race conditions?
2. **Security** — Injection, XSS, auth bypass, secrets exposure, insecure dependencies. Cite OWASP categories.
3. **Error handling** — Are all failure modes handled? Are errors propagated correctly? Do error messages help debugging?
4. **Performance** — Unnecessary allocations, N+1 queries, missing indexes, unbounded loops, memory leaks.
5. **Maintainability** — Naming clarity, single responsibility, dead code, unnecessary complexity.
6. **Testing** — Are edge cases covered? Would a test catch a regression here?

For each finding:
- Reference the specific file and line
- Explain WHY it's an issue, not just WHAT
- Provide a concrete fix
- Rate severity: Critical / High / Medium / Low / Nitpick

End with a summary: approve, request changes, or comment.`,
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'doc-writer',
    name: 'Doc Writer',
    description: 'Generates clear, comprehensive documentation from code. Produces READMEs, API docs, architecture guides, and inline comments.',
    author: 'kernel.chat',
    version: '1.0.0',
    downloads: 0,
    rating: 4.7,
    tags: ['documentation', 'readme', 'api-docs', 'technical-writing'],
    agentConfig: {
      name: 'Doc Writer',
      icon: '◈',
      color: '#228B22',
      systemPrompt: `You are a technical documentation specialist. When given code, you produce clear, actionable documentation.

Your documentation principles:
- **Active voice**, short sentences, scannable structure
- **Code examples** for every public API — show, don't just describe
- **Progressive disclosure** — start with the 80% use case, then cover edge cases
- **Structure**: Overview > Quick Start > API Reference > Examples > Troubleshooting
- **Audience**: experienced developers who are new to this codebase

Documentation types you produce:
1. **README** — project overview, install, quick start, contributing
2. **API Reference** — every public function/class with params, return types, examples
3. **Architecture Guide** — system design, data flow, key decisions and trade-offs
4. **Migration Guide** — step-by-step for version upgrades with breaking changes
5. **Inline Comments** — explain WHY, not WHAT; focus on non-obvious logic

Always infer the correct format (Markdown, JSDoc, docstrings, etc.) from the language and project.`,
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'test-generator',
    name: 'Test Generator',
    description: 'Creates comprehensive test suites for any codebase. Generates unit, integration, and edge-case tests with proper mocking.',
    author: 'kernel.chat',
    version: '1.0.0',
    downloads: 0,
    rating: 4.6,
    tags: ['testing', 'unit-tests', 'tdd', 'quality', 'coverage'],
    agentConfig: {
      name: 'Test Generator',
      icon: '✦',
      color: '#DAA520',
      systemPrompt: `You are a test engineering specialist. Given code, you generate comprehensive test suites.

Your testing philosophy:
- **Test behavior, not implementation** — tests should survive refactors
- **Arrange-Act-Assert** pattern for every test
- **One assertion per test** when possible (clear failure messages)
- **Descriptive names**: "should return empty array when user has no posts" not "test1"

Test categories you generate:
1. **Happy path** — normal inputs, expected outputs
2. **Edge cases** — empty inputs, boundary values, max/min, unicode, special characters
3. **Error cases** — invalid inputs, network failures, timeouts, permission denied
4. **Integration** — component interactions, API contracts, database queries
5. **Regression** — tests that would have caught known bugs

Framework detection:
- JavaScript/TypeScript: Vitest or Jest (prefer Vitest)
- Python: pytest
- Go: testing package + testify
- Rust: built-in #[test] + proptest for property-based
- Other: match project conventions

Always mock external dependencies (APIs, databases, file system). Never call real services in tests.`,
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'migrator',
    name: 'Migrator',
    description: 'Handles framework and language migrations. Plans and executes incremental migration strategies with rollback safety.',
    author: 'kernel.chat',
    version: '1.0.0',
    downloads: 0,
    rating: 4.5,
    tags: ['migration', 'refactor', 'upgrade', 'framework', 'codemods'],
    agentConfig: {
      name: 'Migrator',
      icon: '⟳',
      color: '#9370DB',
      systemPrompt: `You are a migration specialist. You plan and execute framework, library, and language migrations safely.

Your migration process:
1. **Audit** — Inventory what uses the old API/framework. Count affected files, lines, patterns.
2. **Plan** — Break the migration into atomic, independently-deployable steps. Each step should leave the codebase in a working state.
3. **Compatibility layer** — When possible, create an adapter/shim so old and new code coexist during migration.
4. **Execute** — Transform code systematically. Use codemods for mechanical changes, manual review for semantic changes.
5. **Verify** — Run tests after each step. Highlight what needs manual testing.
6. **Clean up** — Remove compatibility layers, dead code, and old dependencies after migration completes.

Key principles:
- **Incremental** — never a big-bang rewrite. Ship in stages.
- **Reversible** — every step should be easy to roll back
- **Test-gated** — don't proceed to step N+1 until step N passes tests
- **Document breaking changes** — track what moved, what renamed, what was removed

Common migrations you handle:
- React class components to hooks
- JavaScript to TypeScript
- REST to GraphQL
- Express to Fastify/Hono
- Webpack to Vite
- Any major version upgrade with breaking changes`,
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'debugger',
    name: 'Debugger',
    description: 'Systematic debugging with binary search, hypothesis testing, and root cause analysis. Finds bugs methodically.',
    author: 'kernel.chat',
    version: '1.0.0',
    downloads: 0,
    rating: 4.9,
    tags: ['debugging', 'troubleshooting', 'root-cause', 'bisect'],
    agentConfig: {
      name: 'Debugger',
      icon: '◉',
      color: '#DB7093',
      systemPrompt: `You are a systematic debugger. You find bugs through methodical investigation, not guesswork.

Your debugging process:
1. **Reproduce** — Establish exact steps to trigger the bug. If you can't reproduce it, you can't fix it.
2. **Hypothesize** — Form 2-3 hypotheses about the root cause based on symptoms.
3. **Bisect** — Narrow down the cause using binary search:
   - git bisect for regressions
   - Comment out code halves to isolate
   - Add strategic logging at decision points
4. **Verify** — Test each hypothesis with minimal, targeted experiments.
5. **Root cause** — Identify the actual root cause, not just the symptom.
6. **Fix** — Implement the minimal fix that addresses the root cause.
7. **Prevent** — Add a test that would have caught this bug. Consider if similar bugs lurk elsewhere.

Key techniques:
- **Rubber duck**: Explain the expected vs actual behavior step by step
- **Binary search**: Halve the search space with each test
- **Trace backward**: Start from the error and trace data flow backward to the source
- **Check assumptions**: Log the value of every variable you assume is correct
- **Minimal repro**: Strip away everything unrelated until you have the smallest failing case

Always state your current hypothesis before investigating. Update it as evidence comes in.`,
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
]

// ── Registry ────────────────────────────────────────────────────────────────

/** Fetch the agent marketplace registry. Uses cached version if within TTL, falls back to bundled agents. */
export async function fetchRegistry(): Promise<MarketplaceManifest> {
  // Check cache first
  const cached = readCachedManifest()
  if (cached && isCacheValid(cached)) {
    return cached.manifest
  }

  // Fetch from GitHub
  try {
    const res = await fetch(AGENT_REGISTRY_URL)
    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`)
    }
    const manifest = (await res.json()) as MarketplaceManifest
    writeCachedManifest(manifest)
    return manifest
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(chalk.yellow(`Could not fetch agent registry: ${message}`))
    console.error(chalk.dim('Falling back to bundled agents.'))

    // Fall back to stale cache if available
    if (cached) {
      return cached.manifest
    }

    // Fall back to bundled agents
    const bundled: MarketplaceManifest = {
      agents: BUNDLED_AGENTS,
      lastUpdated: new Date().toISOString(),
    }
    return bundled
  }
}

// ── Core Functions ──────────────────────────────────────────────────────────

/** Search marketplace agents by name, description, or tags. */
export async function searchMarketplace(query: string): Promise<MarketplaceAgent[]> {
  const manifest = await fetchRegistry()
  const q = query.toLowerCase().trim()

  if (!q) return manifest.agents

  return manifest.agents.filter(agent => {
    const nameMatch = agent.name.toLowerCase().includes(q)
    const descMatch = agent.description.toLowerCase().includes(q)
    const tagMatch = agent.tags.some(tag => tag.toLowerCase().includes(q))
    const authorMatch = agent.author.toLowerCase().includes(q)
    const idMatch = agent.id.toLowerCase().includes(q)
    return nameMatch || descMatch || tagMatch || authorMatch || idMatch
  })
}

/** Install a marketplace agent into the local matrix. */
export async function installAgent(agentId: string): Promise<MatrixAgent> {
  const manifest = await fetchRegistry()
  const marketplaceAgent = manifest.agents.find(a => a.id === agentId)

  if (!marketplaceAgent) {
    throw new Error(`Agent "${agentId}" not found in the marketplace. Run marketplace search to see available agents.`)
  }

  // Check if already installed
  const installed = readInstalledAgents()
  const existing = installed.find(a => a.id === agentId)
  if (existing) {
    // Update version if newer
    if (existing.version === marketplaceAgent.version) {
      // Still create in matrix for this session
      const config = marketplaceAgent.agentConfig
      try {
        return createAgent(config.name, config.systemPrompt, config.icon, config.color)
      } catch {
        // Already in matrix — return existing
        const matrixAgent = getAgent(agentId)
        if (matrixAgent) return matrixAgent
        throw new Error(`Agent "${agentId}" is already installed and active.`)
      }
    }
  }

  // Create the agent in the matrix
  const config = marketplaceAgent.agentConfig
  let matrixAgent: MatrixAgent
  try {
    matrixAgent = createAgent(config.name, config.systemPrompt, config.icon, config.color)
  } catch {
    // Already exists in matrix — remove and re-create
    removeAgent(agentId)
    matrixAgent = createAgent(config.name, config.systemPrompt, config.icon, config.color)
  }

  // Track as installed
  addInstalledAgent({
    id: marketplaceAgent.id,
    name: marketplaceAgent.name,
    version: marketplaceAgent.version,
    author: marketplaceAgent.author,
    installedAt: new Date().toISOString(),
  })

  console.log(chalk.green(`Installed marketplace agent "${marketplaceAgent.name}" v${marketplaceAgent.version}`))
  return matrixAgent
}

/** Package a local matrix agent for publishing to the marketplace. Outputs JSON for the user to submit as a PR. */
export function publishAgent(agent: MatrixAgent, opts: {
  description: string
  author: string
  version?: string
  tags?: string[]
}): { json: string; filePath: string } {
  const now = new Date().toISOString()
  const marketplaceAgent: MarketplaceAgent = {
    id: agent.id,
    name: agent.name,
    description: opts.description,
    author: opts.author,
    version: opts.version || '1.0.0',
    downloads: 0,
    rating: 0,
    tags: opts.tags || [],
    agentConfig: {
      name: agent.name,
      icon: agent.icon,
      color: agent.color,
      systemPrompt: agent.systemPrompt,
    },
    createdAt: now,
    updatedAt: now,
  }

  const json = JSON.stringify(marketplaceAgent, null, 2)

  // Write to a local file for the user to submit
  ensureMarketplaceDir()
  const filePath = join(AGENT_MARKETPLACE_DIR, `${agent.id}.agent.json`)
  writeFileSync(filePath, json, 'utf-8')

  console.log(chalk.green(`Agent "${agent.name}" packaged for publishing.`))
  console.log(chalk.dim(`File saved to: ${filePath}`))
  console.log(chalk.dim(`Submit this file as a PR to the registry repo to publish.`))

  return { json, filePath }
}

/** List all marketplace agents installed locally. */
export function listInstalledAgents(): InstalledMarketplaceAgent[] {
  return readInstalledAgents()
}

/** Uninstall a marketplace agent. Removes from local tracking and the matrix. */
export function uninstallAgent(agentId: string): boolean {
  const removed = removeInstalledAgent(agentId)
  if (!removed) {
    console.error(chalk.yellow(`Marketplace agent "${agentId}" is not installed.`))
    return false
  }

  // Also remove from the in-memory matrix
  removeAgent(agentId)

  console.log(chalk.green(`Uninstalled marketplace agent "${agentId}"`))
  return true
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatMarketplaceResults(agents: MarketplaceAgent[]): string {
  if (agents.length === 0) {
    return chalk.dim('No agents found in the marketplace.')
  }

  const installed = new Set(readInstalledAgents().map(a => a.id))

  const lines: string[] = [
    chalk.bold('Agent Marketplace'),
    chalk.dim('─'.repeat(60)),
  ]

  for (const agent of agents) {
    const stars = '★'.repeat(Math.round(agent.rating)) + '☆'.repeat(5 - Math.round(agent.rating))
    const installedBadge = installed.has(agent.id) ? chalk.green(' [installed]') : ''
    const downloads = agent.downloads > 0 ? chalk.dim(` ${agent.downloads.toLocaleString()} downloads`) : ''

    lines.push(
      `  ${chalk.bold(agent.agentConfig.icon)} ${chalk.bold(agent.name)} ${chalk.dim(`v${agent.version}`)}${installedBadge}`,
      `  ${agent.description}`,
      `  ${chalk.dim(`by ${agent.author}`)}  ${chalk.yellow(stars)}${downloads}`,
      `  ${agent.tags.map(t => chalk.dim(`#${t}`)).join(' ')}`,
      `  ${chalk.dim(`Install: kbot marketplace install ${agent.id}`)}`,
      '',
    )
  }

  lines.push(chalk.dim(`${agents.length} agent${agents.length === 1 ? '' : 's'} found`))
  return lines.join('\n')
}

export function formatInstalledAgentsList(agents: InstalledMarketplaceAgent[]): string {
  if (agents.length === 0) {
    return chalk.dim('No marketplace agents installed. Run "kbot marketplace search" to discover agents.')
  }

  const lines: string[] = [
    chalk.bold('Installed Marketplace Agents'),
    chalk.dim('─'.repeat(60)),
  ]

  for (const agent of agents) {
    const installedDate = new Date(agent.installedAt)
    const dateStr = installedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    lines.push(
      `  ${chalk.bold(agent.name)} ${chalk.dim(`v${agent.version}`)}`,
      `  ${chalk.dim(`by ${agent.author}`)}  ${chalk.dim(`installed ${dateStr}`)}`,
      `  ${chalk.dim(`Uninstall: kbot marketplace uninstall ${agent.id}`)}`,
      '',
    )
  }

  lines.push(chalk.dim(`${agents.length} agent${agents.length === 1 ? '' : 's'} installed`))
  return lines.join('\n')
}

// ── Tool Integration ────────────────────────────────────────────────────────

/** Register marketplace tools so the agent can search and install marketplace agents during conversations. */
export function registerMarketplaceTools(): void {
  registerTool({
    name: 'marketplace_search',
    description: 'Search the kbot agent marketplace for community-built agents. Search by name, description, tags, or author. Returns a list of available agents with their descriptions, ratings, and install commands.',
    parameters: {
      query: { type: 'string', description: 'Search query — matches agent name, description, tags, and author. Leave empty to list all.', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const query = String(args.query || '')
      try {
        const results = await searchMarketplace(query)
        if (results.length === 0) {
          return `No marketplace agents found for "${query}". Try a broader search or browse all with an empty query.`
        }
        return results.map(a => {
          const stars = '★'.repeat(Math.round(a.rating)) + '☆'.repeat(5 - Math.round(a.rating))
          return [
            `${a.agentConfig.icon} ${a.name} (${a.id}) v${a.version}`,
            `  ${a.description}`,
            `  by ${a.author} | ${stars} | ${a.downloads} downloads`,
            `  Tags: ${a.tags.join(', ')}`,
          ].join('\n')
        }).join('\n\n')
      } catch (err) {
        return `Error searching marketplace: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'marketplace_install',
    description: 'Install an agent from the kbot marketplace into the local matrix. The agent becomes immediately available for use in the current session and persists across sessions.',
    parameters: {
      agent_id: { type: 'string', description: 'The marketplace agent ID to install (e.g., "code-reviewer", "debugger")', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const agentId = String(args.agent_id || '')
      if (!agentId) {
        return 'Error: agent_id is required. Use marketplace_search to find available agents.'
      }
      try {
        const agent = await installAgent(agentId)
        return [
          `Successfully installed "${agent.name}" from the marketplace.`,
          `ID: ${agent.id}`,
          `Icon: ${agent.icon}`,
          `The user can switch to this agent with: /agent ${agent.id}`,
          `Or invoke it directly in conversation.`,
        ].join('\n')
      } catch (err) {
        return `Error installing agent: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
