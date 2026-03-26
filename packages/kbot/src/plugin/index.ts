// kbot Claude Code Plugin — Entry point
//
// Bridges kbot's full cognitive engine into Claude Code as a plugin.
// Starts the MCP server, registers tools, sets up the Channel for
// two-way communication, and exports skills that map to kbot commands.
//
// Usage:
//   As a Claude Code plugin, this module is loaded automatically when
//   the plugin manifest is registered. It can also be imported directly:
//
//     import { activate, deactivate, skills } from './plugin/index.js'
//     await activate({ cwd: process.cwd() })

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMcpServer } from '../ide/mcp-server.js'
import { initBridge, getStatus, type BridgeConfig, type BridgeStatus } from '../ide/bridge.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PluginContext {
  /** Working directory for kbot to operate in */
  cwd?: string
  /** Default agent to use */
  agent?: string
  /** API tier override */
  tier?: string
  /** Skip starting the MCP server (e.g., if already running) */
  skipMcp?: boolean
}

export interface SkillDefinition {
  /** Skill name (matches manifest) */
  name: string
  /** Human-readable description */
  description: string
  /** Path to the skill markdown file */
  file: string
  /** The kbot CLI command this skill maps to */
  command: string
}

export interface PluginManifest {
  name: string
  version: string
  description: string
  homepage: string
  repository: string
  license: string
  mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>
  channels: Record<string, { command: string; args: string[] }>
  skills: Array<{ name: string; description: string; file: string }>
}

// ── State ───────────────────────────────────────────────────────────────────

let activated = false

// ── Manifest ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Load and return the plugin manifest.
 */
export function getManifest(): PluginManifest {
  const manifestPath = join(__dirname, 'manifest.json')
  if (!existsSync(manifestPath)) {
    // Fallback for compiled output where manifest.json may be at a different relative path
    const altPath = join(__dirname, '..', 'plugin', 'manifest.json')
    if (existsSync(altPath)) {
      return JSON.parse(readFileSync(altPath, 'utf-8')) as PluginManifest
    }
    throw new Error(`kbot plugin manifest not found at ${manifestPath}`)
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
}

// ── Skills ──────────────────────────────────────────────────────────────────

/**
 * Skill definitions mapping Claude Code slash commands to kbot CLI commands.
 */
export const skills: SkillDefinition[] = [
  {
    name: 'dream',
    description: 'Run kbot dream mode — memory consolidation, meta-agent cycle, forge speculation, and self-benchmarking',
    file: 'skills/dream.md',
    command: 'kbot dream',
  },
  {
    name: 'dashboard',
    description: "Show kbot's live learning dashboard — tool usage, agent routing, growth metrics",
    file: 'skills/dashboard.md',
    command: 'kbot dashboard',
  },
  {
    name: 'pair',
    description: 'Start pair programming mode — file watcher with real-time AI suggestions and auto-fix',
    file: 'skills/pair.md',
    command: 'kbot pair',
  },
  {
    name: 'guardian',
    description: 'Run codebase guardian — detect duplicates, co-change patterns, and complexity hotspots',
    file: 'skills/guardian.md',
    command: 'kbot guardian',
  },
  {
    name: 'meta',
    description: 'Run meta-agent cycle — analyze task agent performance, propose and apply improvements',
    file: 'skills/meta.md',
    command: 'kbot meta',
  },
]

/**
 * Load the markdown content of a skill file.
 */
export function loadSkillContent(skillName: string): string | null {
  const skill = skills.find(s => s.name === skillName)
  if (!skill) return null

  const skillPath = join(__dirname, skill.file)
  if (existsSync(skillPath)) {
    return readFileSync(skillPath, 'utf-8')
  }

  // Fallback for compiled output
  const altPath = join(__dirname, '..', 'plugin', skill.file)
  if (existsSync(altPath)) {
    return readFileSync(altPath, 'utf-8')
  }

  return null
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Activate the kbot plugin.
 *
 * Initializes the IDE bridge (registers tools, gathers project context)
 * and optionally starts the MCP server for tool communication.
 */
export async function activate(context: PluginContext = {}): Promise<BridgeStatus> {
  if (activated) {
    return getStatus()
  }

  const bridgeConfig: BridgeConfig = {
    cwd: context.cwd,
    agent: context.agent,
    tier: context.tier,
  }

  // Initialize the bridge — registers all tools and gathers project context
  await initBridge(bridgeConfig)

  // Start MCP server unless explicitly skipped
  if (!context.skipMcp) {
    // Start in background — the MCP server runs on stdio and blocks,
    // so we only start it if this is the main plugin entry point
    startMcpServer(bridgeConfig).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[kbot plugin] MCP server error: ${message}`)
    })
  }

  activated = true
  return getStatus()
}

/**
 * Deactivate the kbot plugin. Cleans up resources.
 */
export function deactivate(): void {
  activated = false
}

/**
 * Check if the plugin is currently activated.
 */
export function isActivated(): boolean {
  return activated
}
