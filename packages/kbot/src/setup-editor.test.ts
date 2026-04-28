// kbot setup-editor tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, platform } from 'node:os'
import { setupClaudeCode, setupCursor, setupZed } from './setup-editor.js'

let home: string
let cwd: string
let skillTemplate: string

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'kbot-setup-test-'))
  home = join(root, 'home')
  cwd = join(root, 'project')
  mkdirSync(home, { recursive: true })
  mkdirSync(cwd, { recursive: true })
  // Fake skill template so we don't depend on the real templates dir layout.
  skillTemplate = join(root, 'kbot-skill.md')
  writeFileSync(skillTemplate, '# kbot skill (fake)\n', 'utf8')
})

afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }) } catch { /* ignore */ }
})

const baseOpts = () => ({
  home,
  cwd,
  kbotBin: '/fake/bin/kbot',
  kbotLocalMcpPath: '/fake/tools/kbot-local-mcp.ts',
  skillTemplatePath: skillTemplate,
})

describe('setupClaudeCode', () => {
  it('creates settings.json with both MCP servers on a fresh install', () => {
    const r = setupClaudeCode(baseOpts())
    expect(r.mcpAdded.sort()).toEqual(['kbot', 'kbot-local'])
    expect(existsSync(r.configPath)).toBe(true)
    const cfg = JSON.parse(readFileSync(r.configPath, 'utf8'))
    expect(cfg.mcpServers.kbot.command).toBe('/fake/bin/kbot')
    expect(cfg.mcpServers.kbot.args).toEqual(['ide', 'mcp'])
    expect(cfg.mcpServers['kbot-local'].command).toBe('npx')
    expect(cfg.mcpServers['kbot-local'].args).toEqual(['tsx', '/fake/tools/kbot-local-mcp.ts'])
  })

  it('is idempotent: re-running does not duplicate entries', () => {
    setupClaudeCode(baseOpts())
    const r2 = setupClaudeCode(baseOpts())
    expect(r2.mcpAdded).toEqual([])
    expect(r2.mcpAlreadyPresent.sort()).toEqual(['kbot', 'kbot-local'])
    const cfg = JSON.parse(readFileSync(r2.configPath, 'utf8'))
    // Only one entry per key.
    expect(Object.keys(cfg.mcpServers).sort()).toEqual(['kbot', 'kbot-local'])
  })

  it('preserves existing mcpServers entries from other tools', () => {
    const cfgPath = join(home, '.claude', 'settings.json')
    mkdirSync(join(home, '.claude'), { recursive: true })
    writeFileSync(
      cfgPath,
      JSON.stringify({
        theme: 'dark',
        mcpServers: { 'other-tool': { command: 'foo', args: ['bar'] } },
      }),
      'utf8',
    )
    const r = setupClaudeCode(baseOpts())
    const cfg = JSON.parse(readFileSync(r.configPath, 'utf8'))
    expect(cfg.theme).toBe('dark')
    expect(cfg.mcpServers['other-tool']).toEqual({ command: 'foo', args: ['bar'] })
    expect(cfg.mcpServers.kbot).toBeDefined()
    expect(cfg.mcpServers['kbot-local']).toBeDefined()
  })

  it('copies the skill into <cwd>/.claude/skills/kbot.md', () => {
    const r = setupClaudeCode(baseOpts())
    const skill = join(cwd, '.claude', 'skills', 'kbot.md')
    expect(r.skillCopied).toBe(skill)
    expect(existsSync(skill)).toBe(true)
    expect(readFileSync(skill, 'utf8')).toContain('kbot skill')
  })

  it('does not overwrite an existing skill without --force', () => {
    const skillDir = join(cwd, '.claude', 'skills')
    mkdirSync(skillDir, { recursive: true })
    const skill = join(skillDir, 'kbot.md')
    writeFileSync(skill, '# user customization', 'utf8')
    const r = setupClaudeCode(baseOpts())
    expect(r.skillCopied).toBeUndefined()
    expect(r.skillAlreadyPresent).toBe(skill)
    expect(readFileSync(skill, 'utf8')).toBe('# user customization')
  })

  it('--force overwrites an existing skill', () => {
    const skillDir = join(cwd, '.claude', 'skills')
    mkdirSync(skillDir, { recursive: true })
    const skill = join(skillDir, 'kbot.md')
    writeFileSync(skill, '# user customization', 'utf8')
    const r = setupClaudeCode({ ...baseOpts(), force: true })
    expect(r.skillCopied).toBe(skill)
    expect(readFileSync(skill, 'utf8')).toContain('kbot skill')
  })
})

describe('setupCursor', () => {
  it('writes mcp.servers entries to the platform-correct path', () => {
    const r = setupCursor(baseOpts())
    if (platform() === 'darwin') {
      expect(r.configPath).toContain('Library/Application Support/Cursor/User/settings.json')
    } else if (platform() !== 'win32') {
      expect(r.configPath).toContain('.config/Cursor/User/settings.json')
    }
    const cfg = JSON.parse(readFileSync(r.configPath, 'utf8'))
    expect(cfg.mcp.servers.kbot.command).toBe('/fake/bin/kbot')
    expect(cfg.mcp.servers['kbot-local'].command).toBe('npx')
  })

  it('is idempotent', () => {
    setupCursor(baseOpts())
    const r2 = setupCursor(baseOpts())
    expect(r2.mcpAdded).toEqual([])
    expect(r2.mcpAlreadyPresent.sort()).toEqual(['kbot', 'kbot-local'])
  })
})

describe('setupZed', () => {
  it('writes assistant.mcpServers entries to ~/.config/zed/settings.json', () => {
    const r = setupZed(baseOpts())
    expect(r.configPath).toBe(join(home, '.config', 'zed', 'settings.json'))
    const cfg = JSON.parse(readFileSync(r.configPath, 'utf8'))
    expect(cfg.assistant.mcpServers.kbot.command).toBe('/fake/bin/kbot')
    expect(cfg.assistant.mcpServers['kbot-local'].command).toBe('npx')
  })

  it('is idempotent and preserves unrelated assistant config', () => {
    const cfgPath = join(home, '.config', 'zed', 'settings.json')
    mkdirSync(join(home, '.config', 'zed'), { recursive: true })
    writeFileSync(cfgPath, JSON.stringify({ assistant: { default_model: 'gpt-4' } }), 'utf8')
    setupZed(baseOpts())
    const r2 = setupZed(baseOpts())
    expect(r2.mcpAdded).toEqual([])
    const cfg = JSON.parse(readFileSync(r2.configPath, 'utf8'))
    expect(cfg.assistant.default_model).toBe('gpt-4')
    expect(cfg.assistant.mcpServers.kbot).toBeDefined()
  })
})
