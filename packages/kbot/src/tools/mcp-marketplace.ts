// K:BOT MCP Marketplace — Discover, install, and manage MCP servers
//
// Lets users browse an MCP server registry, install servers (npm or git),
// and manage their ~/.kbot/mcp-config.json configuration.
//
// Flow:
//   1. mcp_search     — Search the MCP registry for servers by keyword
//   2. mcp_install    — Install an MCP server (npm package or git repo)
//   3. mcp_uninstall  — Remove an installed MCP server
//   4. mcp_list       — List installed MCP servers with status
//   5. mcp_update     — Update an installed MCP server

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { registerTool } from './index.js'

// ── Paths ────────────────────────────────────────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const MCP_CONFIG_PATH = join(KBOT_DIR, 'mcp-config.json')
const MCP_REGISTRY_CACHE_PATH = join(KBOT_DIR, 'mcp-registry.json')
const MCP_SERVERS_DIR = join(KBOT_DIR, 'mcp-servers')

const REGISTRY_SOURCE_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── Types ────────────────────────────────────────────────────────────────────

interface McpServerEntry {
  name: string
  package: string
  description: string
  source: 'official' | 'community'
  /** npm package name or github repo (user/repo) */
  install: string
  /** How to invoke — 'npx' for npm packages, 'node' for git repos */
  transport: 'stdio'
}

interface McpServerConfig {
  command: string
  args: string[]
  env: Record<string, string>
}

interface McpConfigFile {
  servers: Record<string, McpServerConfig>
}

interface RegistryCache {
  servers: McpServerEntry[]
  fetchedAt: number
}

// ── Bundled servers (fallback when registry unavailable) ─────────────────────

const BUNDLED_SERVERS: McpServerEntry[] = [
  // Official servers
  {
    name: 'filesystem',
    package: '@modelcontextprotocol/server-filesystem',
    description: 'Secure file system access with configurable allowed directories. Read, write, search, and manage files and directories.',
    source: 'official',
    install: '@modelcontextprotocol/server-filesystem',
    transport: 'stdio',
  },
  {
    name: 'github',
    package: '@modelcontextprotocol/server-github',
    description: 'GitHub API integration for repository management, file operations, issues, pull requests, branches, and search.',
    source: 'official',
    install: '@modelcontextprotocol/server-github',
    transport: 'stdio',
  },
  {
    name: 'postgres',
    package: '@modelcontextprotocol/server-postgres',
    description: 'PostgreSQL database integration with read-only query access and schema inspection.',
    source: 'official',
    install: '@modelcontextprotocol/server-postgres',
    transport: 'stdio',
  },
  {
    name: 'sqlite',
    package: '@modelcontextprotocol/server-sqlite',
    description: 'SQLite database operations including querying, analysis, schema inspection, and business intelligence.',
    source: 'official',
    install: '@modelcontextprotocol/server-sqlite',
    transport: 'stdio',
  },
  {
    name: 'brave-search',
    package: '@modelcontextprotocol/server-brave-search',
    description: 'Web and local search using the Brave Search API. Supports both web and local business searches.',
    source: 'official',
    install: '@modelcontextprotocol/server-brave-search',
    transport: 'stdio',
  },
  {
    name: 'puppeteer',
    package: '@modelcontextprotocol/server-puppeteer',
    description: 'Browser automation via Puppeteer. Navigate pages, take screenshots, click elements, fill forms, and execute JavaScript.',
    source: 'official',
    install: '@modelcontextprotocol/server-puppeteer',
    transport: 'stdio',
  },
  {
    name: 'slack',
    package: '@modelcontextprotocol/server-slack',
    description: 'Slack workspace integration for channel management, messaging, user lookup, and thread replies.',
    source: 'official',
    install: '@modelcontextprotocol/server-slack',
    transport: 'stdio',
  },
  {
    name: 'google-maps',
    package: '@modelcontextprotocol/server-google-maps',
    description: 'Google Maps Platform integration for geocoding, directions, elevation, and place search.',
    source: 'official',
    install: '@modelcontextprotocol/server-google-maps',
    transport: 'stdio',
  },
  {
    name: 'memory',
    package: '@modelcontextprotocol/server-memory',
    description: 'Knowledge graph-based persistent memory system. Store and retrieve entities, relations, and observations.',
    source: 'official',
    install: '@modelcontextprotocol/server-memory',
    transport: 'stdio',
  },
  {
    name: 'sequential-thinking',
    package: '@modelcontextprotocol/server-sequential-thinking',
    description: 'Dynamic chain-of-thought reasoning. Break down complex problems with branching, revision, and hypothesis tracking.',
    source: 'official',
    install: '@modelcontextprotocol/server-sequential-thinking',
    transport: 'stdio',
  },
  // Community servers
  {
    name: 'everything',
    package: '@modelcontextprotocol/server-everything',
    description: 'Reference/test MCP server that exercises all MCP features: tools, resources, prompts, sampling, and more.',
    source: 'community',
    install: '@modelcontextprotocol/server-everything',
    transport: 'stdio',
  },
  {
    name: 'fetch',
    package: '@modelcontextprotocol/server-fetch',
    description: 'Fetch web content and convert HTML to markdown for LM-friendly consumption. Supports robots.txt.',
    source: 'official',
    install: '@modelcontextprotocol/server-fetch',
    transport: 'stdio',
  },
  {
    name: 'git',
    package: '@modelcontextprotocol/server-git',
    description: 'Git repository operations including reading, searching, and analyzing local Git repositories.',
    source: 'official',
    install: '@modelcontextprotocol/server-git',
    transport: 'stdio',
  },
  {
    name: 'playwright',
    package: '@playwright/mcp',
    description: 'Browser automation with Playwright. Snapshot-based interactions, navigation, screenshots, and form filling.',
    source: 'community',
    install: '@playwright/mcp',
    transport: 'stdio',
  },
  {
    name: 'redis',
    package: '@modelcontextprotocol/server-redis',
    description: 'Redis database integration with key-value operations, pub/sub, and data structure manipulation.',
    source: 'community',
    install: '@modelcontextprotocol/server-redis',
    transport: 'stdio',
  },
  {
    name: 'linear',
    package: '@jlowin/linear-mcp',
    description: 'Linear project management integration. Manage issues, projects, teams, and comments.',
    source: 'community',
    install: '@jlowin/linear-mcp',
    transport: 'stdio',
  },
  {
    name: 'notion',
    package: '@notionhq/notion-mcp-server',
    description: 'Notion workspace integration. Search, read, and create pages, databases, and comments.',
    source: 'community',
    install: '@notionhq/notion-mcp-server',
    transport: 'stdio',
  },
  {
    name: 'supabase',
    package: '@supabase/mcp-server',
    description: 'Supabase platform management. Database queries, storage, auth, edge functions, and project configuration.',
    source: 'community',
    install: '@supabase/mcp-server',
    transport: 'stdio',
  },
  {
    name: 'sentry',
    package: '@sentry/mcp-server',
    description: 'Sentry error tracking integration. Search, view, and resolve issues and events across projects.',
    source: 'community',
    install: '@sentry/mcp-server',
    transport: 'stdio',
  },
  {
    name: 'cloudflare',
    package: '@cloudflare/mcp-server-cloudflare',
    description: 'Cloudflare platform management. Workers, KV, R2, D1, and zone configuration.',
    source: 'community',
    install: '@cloudflare/mcp-server-cloudflare',
    transport: 'stdio',
  },
]

// ── Shell helper ─────────────────────────────────────────────────────────────

function shell(cmd: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve((stdout || stderr).trim())
    })
  })
}

// ── Ensure directories ───────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ── MCP Config (mcp-config.json) ─────────────────────────────────────────────

function readMcpConfig(): McpConfigFile {
  if (!existsSync(MCP_CONFIG_PATH)) {
    return { servers: {} }
  }
  try {
    const raw = readFileSync(MCP_CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as McpConfigFile
    if (!parsed.servers || typeof parsed.servers !== 'object') {
      return { servers: {} }
    }
    return parsed
  } catch {
    return { servers: {} }
  }
}

function writeMcpConfig(config: McpConfigFile): void {
  ensureDir(KBOT_DIR)
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

function addServerToConfig(name: string, entry: McpServerConfig): void {
  const config = readMcpConfig()
  config.servers[name] = entry
  writeMcpConfig(config)
}

function removeServerFromConfig(name: string): boolean {
  const config = readMcpConfig()
  if (!(name in config.servers)) return false
  delete config.servers[name]
  writeMcpConfig(config)
  return true
}

// ── Registry cache ───────────────────────────────────────────────────────────

function readRegistryCache(): RegistryCache | null {
  if (!existsSync(MCP_REGISTRY_CACHE_PATH)) return null
  try {
    const raw = readFileSync(MCP_REGISTRY_CACHE_PATH, 'utf-8')
    return JSON.parse(raw) as RegistryCache
  } catch {
    return null
  }
}

function writeRegistryCache(servers: McpServerEntry[]): void {
  ensureDir(KBOT_DIR)
  const cache: RegistryCache = { servers, fetchedAt: Date.now() }
  writeFileSync(MCP_REGISTRY_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8')
}

function isCacheValid(cache: RegistryCache): boolean {
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

// ── Parse servers from MCP README ────────────────────────────────────────────

function parseServersFromReadme(markdown: string): McpServerEntry[] {
  const servers: McpServerEntry[] = []
  const lines = markdown.split('\n')

  // The README has markdown tables or bullet lists with server names and links.
  // We look for lines like:
  //   - [@modelcontextprotocol/server-xxx](link) - Description
  //   | [name](link) | description |
  // Or markdown list entries referencing npm packages / GitHub repos.

  let currentSource: 'official' | 'community' = 'official'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section headers to classify official vs community
    if (/^#{1,3}\s/.test(trimmed)) {
      const headerLower = trimmed.toLowerCase()
      if (headerLower.includes('community') || headerLower.includes('third-party') || headerLower.includes('partner')) {
        currentSource = 'community'
      } else if (headerLower.includes('reference') || headerLower.includes('official')) {
        currentSource = 'official'
      }
    }

    // Match bullet list items with npm package patterns:
    //   - [Package Name](url) - Description text
    //   - **Package Name** - Description text
    // Look for npm-style package names: @scope/name or simple-name
    const bulletMatch = trimmed.match(
      /^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—:]\s*(.+)$/
    )
    if (bulletMatch) {
      const linkText = bulletMatch[1]
      const url = bulletMatch[2]
      const desc = bulletMatch[3].trim()

      // Try to extract npm package name from link text or URL
      let pkg = ''
      let name = ''

      // Check if link text looks like an npm package
      const npmMatch = linkText.match(/^(@[a-z0-9-]+\/[a-z0-9._-]+|[a-z0-9._-]+)$/i)
      if (npmMatch) {
        pkg = npmMatch[1]
        // Derive a short name from the package
        name = pkg.replace(/^@[^/]+\//, '').replace(/^server-/, '').replace(/^mcp-server-?/, '').replace(/^mcp-/, '')
      } else {
        // Use link text as name, try to extract package from URL
        name = linkText.toLowerCase().replace(/\s+/g, '-')
        const npmUrlMatch = url.match(/npmjs\.com\/package\/([^/\s]+(?:\/[^/\s]+)?)/)
        if (npmUrlMatch) {
          pkg = npmUrlMatch[1]
        } else {
          // GitHub URL — use as the install source
          const ghMatch = url.match(/github\.com\/([^/]+\/[^/\s#]+)/)
          if (ghMatch) {
            pkg = ghMatch[1].replace(/\.git$/, '')
          }
        }
      }

      if (pkg && name && desc) {
        // Skip if we already have this server from bundled list
        const alreadyKnown = servers.some(s => s.package === pkg || s.name === name)
        if (!alreadyKnown) {
          servers.push({
            name,
            package: pkg,
            description: desc.slice(0, 200),
            source: currentSource,
            install: pkg,
            transport: 'stdio',
          })
        }
      }
    }

    // Also match markdown table rows: | [name](url) | desc |
    const tableMatch = trimmed.match(
      /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|?$/
    )
    if (tableMatch) {
      const linkText = tableMatch[1]
      const url = tableMatch[2]
      const desc = tableMatch[3].replace(/\s*\|$/, '').trim()

      let pkg = ''
      let name = ''

      const npmMatch2 = linkText.match(/^(@[a-z0-9-]+\/[a-z0-9._-]+|[a-z0-9._-]+)$/i)
      if (npmMatch2) {
        pkg = npmMatch2[1]
        name = pkg.replace(/^@[^/]+\//, '').replace(/^server-/, '').replace(/^mcp-server-?/, '').replace(/^mcp-/, '')
      } else {
        name = linkText.toLowerCase().replace(/\s+/g, '-')
        const ghMatch = url.match(/github\.com\/([^/]+\/[^/\s#]+)/)
        if (ghMatch) {
          pkg = ghMatch[1].replace(/\.git$/, '')
        }
      }

      if (pkg && name && desc && !desc.startsWith('---')) {
        const alreadyKnown = servers.some(s => s.package === pkg || s.name === name)
        if (!alreadyKnown) {
          servers.push({
            name,
            package: pkg,
            description: desc.slice(0, 200),
            source: currentSource,
            install: pkg,
            transport: 'stdio',
          })
        }
      }
    }
  }

  return servers
}

// ── Fetch registry ───────────────────────────────────────────────────────────

async function fetchRegistry(): Promise<McpServerEntry[]> {
  // Check cache first
  const cached = readRegistryCache()
  if (cached && isCacheValid(cached)) {
    return cached.servers
  }

  // Fetch from GitHub
  try {
    const res = await fetch(REGISTRY_SOURCE_URL, {
      headers: { 'User-Agent': 'KBot/2.14' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`)
    }

    const markdown = await res.text()
    const parsed = parseServersFromReadme(markdown)

    // Merge bundled servers with parsed ones — bundled take priority for known entries
    const merged = [...BUNDLED_SERVERS]
    for (const server of parsed) {
      const exists = merged.some(s => s.package === server.package || s.name === server.name)
      if (!exists) {
        merged.push(server)
      }
    }

    writeRegistryCache(merged)
    return merged
  } catch {
    // Fall back to stale cache if available
    if (cached) {
      return cached.servers
    }

    // Fall back to bundled list
    return [...BUNDLED_SERVERS]
  }
}

// ── Determine if an install target is git-based ──────────────────────────────

function isGitSource(target: string): boolean {
  return (
    target.includes('github.com') ||
    target.includes('gitlab.com') ||
    target.includes('bitbucket.org') ||
    target.endsWith('.git') ||
    // user/repo pattern without @ scope
    (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(target) && !target.startsWith('@'))
  )
}

// ── Derive a short server name ───────────────────────────────────────────────

function deriveServerName(target: string): string {
  // npm package: @scope/server-foo → foo
  const scopedMatch = target.match(/@[^/]+\/(?:server-|mcp-server-?|mcp-)?(.+)$/)
  if (scopedMatch) return scopedMatch[1]

  // Unscoped npm: server-foo → foo
  const unscopedMatch = target.match(/^(?:server-|mcp-server-?|mcp-)?(.+)$/)
  if (unscopedMatch) return unscopedMatch[1]

  // Git URL: extract repo name
  const urlMatch = target.match(/\/([^/]+?)(?:\.git)?$/)
  if (urlMatch) {
    return urlMatch[1].replace(/^server-/, '').replace(/^mcp-server-?/, '').replace(/^mcp-/, '')
  }

  return target.replace(/[^a-zA-Z0-9-]/g, '-')
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerMcpMarketplaceTools(): void {

  // ── mcp_search ─────────────────────────────────────────────────────────────

  registerTool({
    name: 'mcp_search',
    description: 'Search the MCP server registry for available servers by keyword. Returns matching MCP servers with name, package, description, and source (official/community). Fetches from the official MCP servers repository and caches results for 24 hours.',
    parameters: {
      query: { type: 'string', description: 'Search keyword — matches server name, package, and description. Leave empty to list all known servers.', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query || '').toLowerCase().trim()

      try {
        const servers = await fetchRegistry()

        const results = query
          ? servers.filter(s => {
              return (
                s.name.toLowerCase().includes(query) ||
                s.package.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.source.toLowerCase().includes(query)
              )
            })
          : servers

        if (results.length === 0) {
          return `No MCP servers found for "${query}". Try a broader search or leave the query empty to list all ${servers.length} known servers.`
        }

        // Check which are already installed
        const config = readMcpConfig()
        const installedNames = new Set(Object.keys(config.servers))

        const lines: string[] = [
          `Found ${results.length} MCP server${results.length === 1 ? '' : 's'}:`,
          '',
        ]

        for (const server of results) {
          const installed = installedNames.has(server.name) ? ' [installed]' : ''
          const badge = server.source === 'official' ? '[official]' : '[community]'
          lines.push(
            `  ${server.name} ${badge}${installed}`,
            `  Package: ${server.package}`,
            `  ${server.description}`,
            `  Install: mcp_install { "target": "${server.install}" }`,
            '',
          )
        }

        return lines.join('\n')
      } catch (err) {
        return `Error searching MCP registry: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── mcp_install ────────────────────────────────────────────────────────────

  registerTool({
    name: 'mcp_install',
    description: 'Install an MCP server from npm or a git repository. For npm packages, installs globally. For git repos, clones to ~/.kbot/mcp-servers/<name>/ and runs npm install. After install, auto-adds to ~/.kbot/mcp-config.json so it can be connected via mcp_connect.',
    parameters: {
      target: { type: 'string', description: 'npm package name (e.g., "@modelcontextprotocol/server-github") or git repo URL / user/repo shorthand', required: true },
      name: { type: 'string', description: 'Override the server name in config (default: derived from package name)' },
      env: { type: 'object', description: 'Environment variables the server needs (e.g., {"GITHUB_TOKEN": "..."})', properties: {}, },
    },
    tier: 'free',
    timeout: 180_000,
    async execute(args) {
      const target = String(args.target).trim()
      if (!target) {
        return 'Error: target is required. Provide an npm package name or git repository URL.'
      }

      const serverName = args.name ? String(args.name) : deriveServerName(target)
      const envVars = (args.env as Record<string, string>) || {}

      // Check if already installed
      const config = readMcpConfig()
      if (config.servers[serverName]) {
        return `MCP server "${serverName}" is already installed. Use mcp_update to update it, or mcp_uninstall first to reinstall.`
      }

      if (isGitSource(target)) {
        // ── Git-based install ──
        const cloneUrl = target.includes('://') ? target : `https://github.com/${target}.git`
        const serverDir = join(MCP_SERVERS_DIR, serverName)

        ensureDir(MCP_SERVERS_DIR)

        // Remove existing directory if present
        if (existsSync(serverDir)) {
          rmSync(serverDir, { recursive: true, force: true })
        }

        try {
          await shell('git', ['clone', '--depth', '1', cloneUrl, serverDir], 120_000)
        } catch (err) {
          return `Error cloning ${cloneUrl}: ${err instanceof Error ? err.message : String(err)}`
        }

        // Install dependencies if package.json exists
        const pkgJsonPath = join(serverDir, 'package.json')
        if (existsSync(pkgJsonPath)) {
          try {
            await shell('npm', ['install', '--prefix', serverDir], 120_000)
          } catch (err) {
            return `Cloned ${target} but npm install failed: ${err instanceof Error ? err.message : String(err)}. Server may not work correctly.`
          }
        }

        // Determine the entry point
        let entryPoint = 'index.js'
        if (existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
            if (pkg.main) entryPoint = pkg.main
            else if (pkg.bin) {
              const bins = typeof pkg.bin === 'string' ? { default: pkg.bin } : pkg.bin
              const firstBin = Object.values(bins)[0]
              if (typeof firstBin === 'string') entryPoint = firstBin
            }
          } catch {
            // keep default
          }
        }

        // Add to config
        const serverConfig: McpServerConfig = {
          command: 'node',
          args: [join(serverDir, entryPoint)],
          env: envVars,
        }
        addServerToConfig(serverName, serverConfig)

        return [
          `Installed MCP server "${serverName}" from git.`,
          `Location: ${serverDir}`,
          `Config added to ${MCP_CONFIG_PATH}`,
          `Connect with: mcp_connect { "name": "${serverName}", "command": "${serverConfig.command} ${serverConfig.args.join(' ')}" }`,
        ].join('\n')
      } else {
        // ── npm-based install ──
        try {
          await shell('npm', ['install', '-g', target], 120_000)
        } catch (err) {
          return `Error installing ${target} from npm: ${err instanceof Error ? err.message : String(err)}`
        }

        // Add to config using npx -y for reliable invocation
        const serverConfig: McpServerConfig = {
          command: 'npx',
          args: ['-y', target],
          env: envVars,
        }
        addServerToConfig(serverName, serverConfig)

        return [
          `Installed MCP server "${serverName}" from npm (${target}).`,
          `Config added to ${MCP_CONFIG_PATH}`,
          `Connect with: mcp_connect { "name": "${serverName}", "command": "npx -y ${target}" }`,
        ].join('\n')
      }
    },
  })

  // ── mcp_uninstall ──────────────────────────────────────────────────────────

  registerTool({
    name: 'mcp_uninstall',
    description: 'Remove an installed MCP server. Removes it from ~/.kbot/mcp-config.json and optionally uninstalls the npm global package or deletes the cloned git repo.',
    parameters: {
      name: { type: 'string', description: 'The server name to uninstall (as shown in mcp_list)', required: true },
      keep_package: { type: 'boolean', description: 'If true, only remove from config without uninstalling the npm package or deleting the repo (default: false)' },
    },
    tier: 'free',
    async execute(args) {
      const name = String(args.name).trim()
      if (!name) {
        return 'Error: name is required. Use mcp_list to see installed servers.'
      }

      const config = readMcpConfig()
      const serverConfig = config.servers[name]
      if (!serverConfig) {
        return `MCP server "${name}" is not installed. Use mcp_list to see installed servers.`
      }

      const keepPackage = Boolean(args.keep_package)
      const messages: string[] = []

      // Remove from config first
      removeServerFromConfig(name)
      messages.push(`Removed "${name}" from ${MCP_CONFIG_PATH}`)

      if (!keepPackage) {
        // Determine if this was npm-based or git-based
        const gitServerDir = join(MCP_SERVERS_DIR, name)

        if (existsSync(gitServerDir)) {
          // Git-based: remove the cloned directory
          try {
            rmSync(gitServerDir, { recursive: true, force: true })
            messages.push(`Deleted cloned repo at ${gitServerDir}`)
          } catch (err) {
            messages.push(`Warning: could not delete ${gitServerDir}: ${err instanceof Error ? err.message : String(err)}`)
          }
        } else if (serverConfig.command === 'npx' && serverConfig.args.length >= 2) {
          // npm-based: try to uninstall the global package
          const pkg = serverConfig.args[serverConfig.args.length - 1]
          try {
            await shell('npm', ['uninstall', '-g', pkg], 60_000)
            messages.push(`Uninstalled global npm package: ${pkg}`)
          } catch (err) {
            messages.push(`Warning: npm uninstall -g ${pkg} failed: ${err instanceof Error ? err.message : String(err)}. Package may still be installed globally.`)
          }
        }
      }

      return messages.join('\n')
    },
  })

  // ── mcp_list ───────────────────────────────────────────────────────────────

  registerTool({
    name: 'mcp_list',
    description: 'List all installed MCP servers from ~/.kbot/mcp-config.json. Shows each server\'s name, command, arguments, and environment variables.',
    parameters: {},
    tier: 'free',
    async execute() {
      const config = readMcpConfig()
      const names = Object.keys(config.servers)

      if (names.length === 0) {
        return [
          'No MCP servers installed.',
          '',
          'Use mcp_search to discover available servers, then mcp_install to add them.',
          'Example: mcp_search { "query": "github" }',
        ].join('\n')
      }

      const lines: string[] = [
        `${names.length} MCP server${names.length === 1 ? '' : 's'} installed:`,
        '',
      ]

      for (const name of names) {
        const server = config.servers[name]
        const fullCommand = [server.command, ...server.args].join(' ')
        const envKeys = Object.keys(server.env || {})
        const envInfo = envKeys.length > 0
          ? `Env: ${envKeys.map(k => `${k}=${server.env[k] ? '***' : '(empty)'}`).join(', ')}`
          : 'Env: (none)'

        // Check if the server binary/directory is accessible
        let status = 'ready'
        if (server.command === 'node' && server.args.length > 0) {
          const entryPath = server.args[0]
          if (!existsSync(entryPath)) {
            status = 'missing — entry point not found'
          }
        }

        lines.push(
          `  ${name} [${status}]`,
          `  Command: ${fullCommand}`,
          `  ${envInfo}`,
          '',
        )
      }

      lines.push(`Config: ${MCP_CONFIG_PATH}`)
      return lines.join('\n')
    },
  })

  // ── mcp_update ─────────────────────────────────────────────────────────────

  registerTool({
    name: 'mcp_update',
    description: 'Update an installed MCP server. For npm packages, runs npm update -g. For git repos, pulls latest changes and reinstalls dependencies.',
    parameters: {
      name: { type: 'string', description: 'The server name to update (as shown in mcp_list)', required: true },
    },
    tier: 'free',
    timeout: 180_000,
    async execute(args) {
      const name = String(args.name).trim()
      if (!name) {
        return 'Error: name is required. Use mcp_list to see installed servers.'
      }

      const config = readMcpConfig()
      const serverConfig = config.servers[name]
      if (!serverConfig) {
        return `MCP server "${name}" is not installed. Use mcp_list to see installed servers.`
      }

      const gitServerDir = join(MCP_SERVERS_DIR, name)

      if (existsSync(gitServerDir)) {
        // Git-based: pull latest and reinstall
        try {
          const pullOutput = await shell('git', ['-C', gitServerDir, 'pull', '--ff-only'], 60_000)

          // Reinstall dependencies
          const pkgJsonPath = join(gitServerDir, 'package.json')
          if (existsSync(pkgJsonPath)) {
            try {
              await shell('npm', ['install', '--prefix', gitServerDir], 120_000)
            } catch (err) {
              return `Pulled latest for "${name}" but npm install failed: ${err instanceof Error ? err.message : String(err)}`
            }
          }

          // Read new version if available
          let version = 'unknown'
          const pkgPath = join(gitServerDir, 'package.json')
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
              version = pkg.version || 'unknown'
            } catch {
              // keep unknown
            }
          }

          return [
            `Updated MCP server "${name}" (git).`,
            `Version: ${version}`,
            pullOutput.includes('Already up to date') ? 'Already up to date.' : `Changes pulled: ${pullOutput.split('\n')[0]}`,
          ].join('\n')
        } catch (err) {
          return `Error updating "${name}": ${err instanceof Error ? err.message : String(err)}`
        }
      } else if (serverConfig.command === 'npx' && serverConfig.args.length >= 2) {
        // npm-based: update the global package
        const pkg = serverConfig.args[serverConfig.args.length - 1]
        try {
          const output = await shell('npm', ['update', '-g', pkg], 120_000)

          // Get the new version
          let version = 'unknown'
          try {
            const viewOutput = await shell('npm', ['view', pkg, 'version'], 15_000)
            version = viewOutput.trim()
          } catch {
            // keep unknown
          }

          return [
            `Updated MCP server "${name}" (npm: ${pkg}).`,
            `Latest version: ${version}`,
            output || 'Update complete.',
          ].join('\n')
        } catch (err) {
          return `Error updating "${name}": ${err instanceof Error ? err.message : String(err)}`
        }
      } else {
        return `Cannot determine update method for "${name}". Command: ${serverConfig.command} ${serverConfig.args.join(' ')}. Try mcp_uninstall and mcp_install to reinstall.`
      }
    },
  })
}
