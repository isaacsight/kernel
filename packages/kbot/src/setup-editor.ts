// kbot setup-editor — idempotent installers that wire kbot's MCP server into
// editor settings (Claude Code, Cursor, Zed) and, for Claude Code, copy the
// kbot skill into the project's .claude/skills directory.
//
// All writes are atomic (tmp file + rename). Re-running is a no-op if the
// entries already exist. Existing user config is preserved.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir, platform, tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface SetupOptions {
  force?: boolean
  /** Override $HOME for testing. */
  home?: string
  /** Override cwd for testing. */
  cwd?: string
  /** Override the kbot binary path. */
  kbotBin?: string
  /** Override the kbot-local-mcp script path. */
  kbotLocalMcpPath?: string
  /** Override the bundled skill template path. */
  skillTemplatePath?: string
}

export interface SetupResult {
  configPath: string
  mcpAdded: string[]
  mcpAlreadyPresent: string[]
  skillCopied?: string
  skillAlreadyPresent?: string
}

// ─── helpers ───────────────────────────────────────────────────────────────

function getHome(opts: SetupOptions): string {
  return opts.home ?? homedir()
}

function getCwd(opts: SetupOptions): string {
  return opts.cwd ?? process.cwd()
}

/** Resolve the kbot binary. Prefer process.execPath when run as `kbot`,
 *  fall back to `which kbot`, then to the literal string `kbot`. */
function resolveKbotBin(opts: SetupOptions): string {
  if (opts.kbotBin) return opts.kbotBin
  try {
    const which = execSync('which kbot', { encoding: 'utf8' }).trim()
    if (which) return which
  } catch {
    /* fall through */
  }
  return 'kbot'
}

/** Resolve the local-MCP server path (lives at repo-root/tools/kbot-local-mcp.ts). */
function resolveKbotLocalMcpPath(opts: SetupOptions): string {
  if (opts.kbotLocalMcpPath) return opts.kbotLocalMcpPath
  // From this file: packages/kbot/src/setup-editor.ts → repo root is ../../..
  try {
    const here = fileURLToPath(import.meta.url)
    const repoRoot = resolve(dirname(here), '..', '..', '..')
    const candidate = join(repoRoot, 'tools', 'kbot-local-mcp.ts')
    if (existsSync(candidate)) return candidate
  } catch {
    /* fall through */
  }
  return 'tools/kbot-local-mcp.ts'
}

function resolveSkillTemplatePath(opts: SetupOptions): string {
  if (opts.skillTemplatePath) return opts.skillTemplatePath
  try {
    const here = fileURLToPath(import.meta.url)
    // src/setup-editor.ts → packages/kbot/templates/kbot-skill.md
    const pkgRoot = resolve(dirname(here), '..')
    const candidate = join(pkgRoot, 'templates', 'kbot-skill.md')
    if (existsSync(candidate)) return candidate
    // dist build: dist/setup-editor.js → packages/kbot/templates/kbot-skill.md
    const candidate2 = resolve(dirname(here), '..', 'templates', 'kbot-skill.md')
    if (existsSync(candidate2)) return candidate2
  } catch {
    /* fall through */
  }
  return ''
}

function readJson(p: string): Record<string, unknown> {
  if (!existsSync(p)) return {}
  const txt = readFileSync(p, 'utf8').trim()
  if (!txt) return {}
  try {
    const parsed = JSON.parse(txt)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    // Corrupt config — bail rather than overwrite.
    throw new Error(`Refusing to overwrite invalid JSON at ${p}`)
  }
}

function writeJsonAtomic(p: string, data: unknown): void {
  mkdirSync(dirname(p), { recursive: true })
  const tmp = join(dirname(p), `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  const body = JSON.stringify(data, null, 2) + '\n'
  writeFileSync(tmp, body, 'utf8')
  try {
    renameSync(tmp, p)
  } catch (e) {
    try { unlinkSync(tmp) } catch { /* ignore */ }
    throw e
  }
}

/** Get an object property as a Record (creating it if missing/invalid). */
function getOrCreateObj(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = parent[key]
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>
  }
  const fresh: Record<string, unknown> = {}
  parent[key] = fresh
  return fresh
}

/** MCP server entry shapes. Same shape works for Claude Code and Cursor;
 *  Zed nests under `context_servers` with the same `command`/`args` form. */
function buildMcpEntries(opts: SetupOptions): Record<string, { command: string; args: string[] }> {
  const kbotBin = resolveKbotBin(opts)
  const localMcp = resolveKbotLocalMcpPath(opts)
  return {
    kbot: { command: kbotBin, args: ['ide', 'mcp'] },
    'kbot-local': { command: 'npx', args: ['tsx', localMcp] },
  }
}

/** Merge MCP entries into a target map. Idempotent: if the key already exists,
 *  we leave it alone (user may have customized it). */
function mergeMcp(
  target: Record<string, unknown>,
  entries: Record<string, { command: string; args: string[] }>,
): { added: string[]; alreadyPresent: string[] } {
  const added: string[] = []
  const alreadyPresent: string[] = []
  for (const [name, entry] of Object.entries(entries)) {
    if (name in target) {
      alreadyPresent.push(name)
    } else {
      target[name] = entry
      added.push(name)
    }
  }
  return { added, alreadyPresent }
}

// ─── Claude Code ───────────────────────────────────────────────────────────

export function setupClaudeCode(opts: SetupOptions = {}): SetupResult {
  const home = getHome(opts)
  const cwd = getCwd(opts)
  const configPath = join(home, '.claude', 'settings.json')
  const cfg = readJson(configPath)
  const mcp = getOrCreateObj(cfg, 'mcpServers')
  const { added, alreadyPresent } = mergeMcp(mcp, buildMcpEntries(opts))
  if (added.length > 0) writeJsonAtomic(configPath, cfg)

  // Skill copy
  const skillDir = join(cwd, '.claude', 'skills')
  const skillDest = join(skillDir, 'kbot.md')
  const skillSrc = resolveSkillTemplatePath(opts)
  let skillCopied: string | undefined
  let skillAlreadyPresent: string | undefined
  if (skillSrc && existsSync(skillSrc)) {
    mkdirSync(skillDir, { recursive: true })
    if (existsSync(skillDest) && !opts.force) {
      skillAlreadyPresent = skillDest
    } else {
      copyFileSync(skillSrc, skillDest)
      skillCopied = skillDest
    }
  }
  return {
    configPath,
    mcpAdded: added,
    mcpAlreadyPresent: alreadyPresent,
    skillCopied,
    skillAlreadyPresent,
  }
}

// ─── Cursor ────────────────────────────────────────────────────────────────

function cursorConfigPath(home: string): string {
  if (platform() === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
  }
  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
    return join(appData, 'Cursor', 'User', 'settings.json')
  }
  // linux + everything else
  return join(home, '.config', 'Cursor', 'User', 'settings.json')
}

export function setupCursor(opts: SetupOptions = {}): SetupResult {
  const home = getHome(opts)
  const configPath = cursorConfigPath(home)
  const cfg = readJson(configPath)
  // Cursor's evolving schema: it reads `mcp.servers` (nested) for MCP entries.
  const mcp = getOrCreateObj(cfg, 'mcp')
  const servers = getOrCreateObj(mcp, 'servers')
  const { added, alreadyPresent } = mergeMcp(servers, buildMcpEntries(opts))
  if (added.length > 0) writeJsonAtomic(configPath, cfg)
  return {
    configPath,
    mcpAdded: added,
    mcpAlreadyPresent: alreadyPresent,
  }
}

// ─── Zed ───────────────────────────────────────────────────────────────────

export function setupZed(opts: SetupOptions = {}): SetupResult {
  const home = getHome(opts)
  const configPath = join(home, '.config', 'zed', 'settings.json')
  const cfg = readJson(configPath)
  // Zed's assistant config is in flux. Best-effort shape: `assistant.mcpServers`.
  const assistant = getOrCreateObj(cfg, 'assistant')
  const mcp = getOrCreateObj(assistant, 'mcpServers')
  const { added, alreadyPresent } = mergeMcp(mcp, buildMcpEntries(opts))
  if (added.length > 0) writeJsonAtomic(configPath, cfg)
  return {
    configPath,
    mcpAdded: added,
    mcpAlreadyPresent: alreadyPresent,
  }
}

// ─── tmpdir helper exported for tests ──────────────────────────────────────
export const _testHelpers = { tmpdir }
