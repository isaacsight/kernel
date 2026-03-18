// kbot Plugin SDK — One-file plugin authoring for kbot
//
// Extends the existing plugins.ts drop-in system with a full SDK:
//   - Structured plugin interface (tools, hooks, commands, lifecycle)
//   - Plugin discovery from ~/.kbot/plugins/<name>/ directories and npm packages
//   - Scaffold, enable, disable, install, uninstall management
//   - TypeScript compilation on-the-fly via tsx/esbuild
//
// Usage:
//   import type { KBotPlugin } from '@kernel.chat/kbot'
//
//   const plugin: KBotPlugin = {
//     name: 'my-tool',
//     version: '1.0.0',
//     description: 'Does something',
//     tools: [{ name: 'my_tool', ... }],
//   }
//   export default plugin

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { execSync, execFile } from 'node:child_process'
import { registerTool, type ToolDefinition } from './tools/index.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface KBotPluginTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<string>
}

export interface KBotPluginHooks {
  beforeMessage?: (message: string) => string | Promise<string>
  afterResponse?: (response: string) => string | Promise<string>
  beforeToolCall?: (tool: string, args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
  afterToolCall?: (tool: string, result: string) => string | Promise<string>
}

export interface KBotPluginCommand {
  name: string
  description: string
  execute: (args: string) => Promise<string>
}

export interface KBotPlugin {
  name: string
  version: string
  description: string
  author?: string

  /** Tools this plugin provides */
  tools?: KBotPluginTool[]

  /** Hooks into the agent lifecycle */
  hooks?: KBotPluginHooks

  /** Custom slash commands (e.g., "my-command" -> user types /my-command) */
  commands?: KBotPluginCommand[]

  /** Called when the plugin is loaded */
  activate?: () => Promise<void>

  /** Called when the plugin is unloaded */
  deactivate?: () => Promise<void>
}

export interface PluginConfig {
  enabled: string[]
  disabled: string[]
}

export interface SDKPluginManifest {
  name: string
  version: string
  description: string
  author?: string
  source: 'local' | 'npm'
  path: string
  enabled: boolean
  loaded: boolean
  toolCount: number
  commandCount: number
  hasHooks: boolean
  error?: string
  loadedAt?: string
}

// ── Constants ────────────────────────────────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const PLUGINS_DIR = join(KBOT_DIR, 'plugins')
const PLUGINS_CONFIG = join(KBOT_DIR, 'plugins.json')

// ── State ────────────────────────────────────────────────────────────────

const loadedSDKPlugins: Map<string, { plugin: KBotPlugin; manifest: SDKPluginManifest }> = new Map()
const registeredCommands: Map<string, KBotPluginCommand & { pluginName: string }> = new Map()
const registeredHooks: Array<{ pluginName: string; hooks: KBotPluginHooks }> = []

// ── Config ───────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readPluginConfig(): PluginConfig {
  if (!existsSync(PLUGINS_CONFIG)) {
    return { enabled: [], disabled: [] }
  }
  try {
    return JSON.parse(readFileSync(PLUGINS_CONFIG, 'utf-8'))
  } catch {
    return { enabled: [], disabled: [] }
  }
}

function writePluginConfig(config: PluginConfig): void {
  ensureDir(KBOT_DIR)
  writeFileSync(PLUGINS_CONFIG, JSON.stringify(config, null, 2), 'utf-8')
}

function isPluginEnabled(name: string): boolean {
  const config = readPluginConfig()
  // If explicitly disabled, it's disabled
  if (config.disabled.includes(name)) return false
  // If explicitly enabled or config is empty (auto-enable), it's enabled
  if (config.enabled.includes(name)) return true
  // Default: enabled unless explicitly disabled
  return !config.disabled.includes(name)
}

// ── TypeScript Compilation ───────────────────────────────────────────────

/**
 * Compile a TypeScript plugin file on-the-fly.
 * Tries tsx first (already a dev dependency), falls back to esbuild, then tsc.
 * Returns the path to the compiled JS file.
 */
function compileTypeScript(tsPath: string): string {
  const dir = join(tsPath, '..')
  const jsPath = tsPath.replace(/\.ts$/, '.js')

  // If a compiled .js already exists and is newer than .ts, reuse it
  if (existsSync(jsPath)) {
    try {
      const tsStat = statSync(tsPath)
      const jsStat = statSync(jsPath)
      if (jsStat.mtimeMs >= tsStat.mtimeMs) {
        return jsPath
      }
    } catch {
      // Fall through to recompile
    }
  }

  // Strategy 1: esbuild (fastest, single-file transform)
  try {
    execSync(
      `npx --yes esbuild "${tsPath}" --outfile="${jsPath}" --format=esm --platform=node --target=node20 2>/dev/null`,
      { cwd: dir, timeout: 30_000, stdio: 'pipe' }
    )
    if (existsSync(jsPath)) return jsPath
  } catch {
    // Fall through
  }

  // Strategy 2: tsx register — we can import .ts files directly if tsx is available
  // tsx supports ESM .ts imports natively; check if it's loadable
  try {
    execSync('npx --yes tsx --version', { timeout: 10_000, stdio: 'pipe' })
    // tsx is available — return the .ts path directly and let the loader handle it
    return tsPath
  } catch {
    // Fall through
  }

  // Strategy 3: tsc single-file compilation
  try {
    execSync(
      `npx tsc "${tsPath}" --outDir "${dir}" --module nodenext --moduleResolution nodenext --target es2022 --esModuleInterop --skipLibCheck 2>/dev/null`,
      { cwd: dir, timeout: 30_000, stdio: 'pipe' }
    )
    if (existsSync(jsPath)) return jsPath
  } catch {
    // Fall through
  }

  throw new Error(`Failed to compile TypeScript plugin: ${tsPath}. Install esbuild or tsx.`)
}

// ── Plugin Loading ───────────────────────────────────────────────────────

/**
 * Import a plugin module from a file path.
 * Handles both .ts and .js files.
 */
async function importPlugin(entryPath: string): Promise<KBotPlugin> {
  let loadPath = entryPath

  if (entryPath.endsWith('.ts')) {
    loadPath = compileTypeScript(entryPath)
  }

  const fileUrl = pathToFileURL(resolve(loadPath)).href
  const mod = await import(fileUrl)
  const plugin: KBotPlugin = mod.default || mod

  // Validate required fields
  if (!plugin.name || typeof plugin.name !== 'string') {
    throw new Error('Plugin must export a "name" string')
  }
  if (!plugin.version || typeof plugin.version !== 'string') {
    throw new Error('Plugin must export a "version" string')
  }
  if (!plugin.description || typeof plugin.description !== 'string') {
    throw new Error('Plugin must export a "description" string')
  }

  return plugin
}

/**
 * Register a KBotPlugin's tools into the kbot tool registry.
 * Converts the SDK input_schema format to the ToolDefinition parameters format.
 */
function registerPluginTools(plugin: KBotPlugin): number {
  if (!plugin.tools || plugin.tools.length === 0) return 0

  let count = 0
  for (const tool of plugin.tools) {
    if (!tool.name || !tool.execute) continue

    // Convert input_schema to ToolDefinition parameters
    const parameters: ToolDefinition['parameters'] = {}
    const schema = tool.input_schema || {}
    const properties = (schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>> | undefined
    const required = ((schema as Record<string, unknown>).required || []) as string[]

    if (properties) {
      for (const [key, prop] of Object.entries(properties)) {
        parameters[key] = {
          type: String(prop.type || 'string'),
          description: String(prop.description || key),
          required: required.includes(key),
        }
        if (prop.default !== undefined) {
          parameters[key].default = prop.default
        }
        if (prop.items) {
          parameters[key].items = prop.items as Record<string, unknown>
        }
        if (prop.properties) {
          parameters[key].properties = prop.properties as Record<string, unknown>
        }
      }
    }

    const toolDef: ToolDefinition = {
      name: `plugin_${plugin.name}_${tool.name}`,
      description: `[Plugin: ${plugin.name}] ${tool.description}`,
      parameters,
      tier: 'free',
      execute: tool.execute,
    }

    registerTool(toolDef)
    count++
  }

  return count
}

/**
 * Register a plugin's slash commands.
 */
function registerPluginCommands(plugin: KBotPlugin): number {
  if (!plugin.commands || plugin.commands.length === 0) return 0

  let count = 0
  for (const cmd of plugin.commands) {
    if (!cmd.name || !cmd.execute) continue
    registeredCommands.set(cmd.name, { ...cmd, pluginName: plugin.name })
    count++
  }

  return count
}

/**
 * Register a plugin's hooks into the agent lifecycle.
 */
function registerPluginHooks(plugin: KBotPlugin): boolean {
  if (!plugin.hooks) return false

  const hasAnyHook = !!(
    plugin.hooks.beforeMessage ||
    plugin.hooks.afterResponse ||
    plugin.hooks.beforeToolCall ||
    plugin.hooks.afterToolCall
  )

  if (hasAnyHook) {
    registeredHooks.push({ pluginName: plugin.name, hooks: plugin.hooks })
  }

  return hasAnyHook
}

// ── Discovery ────────────────────────────────────────────────────────────

/**
 * Discover local plugins in ~/.kbot/plugins/<name>/ directories.
 * Each directory should contain an index.ts or index.js file.
 */
function discoverLocalPlugins(): Array<{ name: string; entryPath: string }> {
  ensureDir(PLUGINS_DIR)
  const results: Array<{ name: string; entryPath: string }> = []

  let entries: string[]
  try {
    entries = readdirSync(PLUGINS_DIR)
  } catch {
    return results
  }

  for (const entry of entries) {
    const dirPath = join(PLUGINS_DIR, entry)
    try {
      const stat = statSync(dirPath)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    // Security: reject directories writable by others
    try {
      const dirStat = statSync(dirPath)
      if ((dirStat.mode & 0o022) !== 0) continue
    } catch {
      continue
    }

    // Look for entry point: index.ts, index.js, or main from package.json
    let entryPath: string | null = null

    // Check package.json for custom main field
    const pkgPath = join(dirPath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.main) {
          const mainPath = join(dirPath, pkg.main)
          if (existsSync(mainPath)) {
            entryPath = mainPath
          }
        }
      } catch {
        // Fall through to default entry points
      }
    }

    if (!entryPath) {
      for (const candidate of ['index.ts', 'index.js', 'index.mjs']) {
        const candidatePath = join(dirPath, candidate)
        if (existsSync(candidatePath)) {
          entryPath = candidatePath
          break
        }
      }
    }

    if (entryPath) {
      results.push({ name: entry, entryPath })
    }
  }

  return results
}

/**
 * Discover npm-installed plugins (packages starting with kbot-plugin-).
 * Scans both local node_modules and global node_modules.
 */
function discoverNpmPlugins(): Array<{ name: string; entryPath: string }> {
  const results: Array<{ name: string; entryPath: string }> = []

  // Find global node_modules path
  let globalPrefix: string
  try {
    globalPrefix = execSync('npm root -g', { encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return results
  }

  if (!existsSync(globalPrefix)) return results

  let entries: string[]
  try {
    entries = readdirSync(globalPrefix)
  } catch {
    return results
  }

  for (const entry of entries) {
    if (!entry.startsWith('kbot-plugin-')) continue

    const pkgDir = join(globalPrefix, entry)
    const pkgPath = join(pkgDir, 'package.json')

    if (!existsSync(pkgPath)) continue

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const main = pkg.main || 'index.js'
      const entryPath = join(pkgDir, main)
      if (existsSync(entryPath)) {
        // Extract plugin name: kbot-plugin-foo -> foo
        const pluginName = entry.replace(/^kbot-plugin-/, '')
        results.push({ name: pluginName, entryPath })
      }
    } catch {
      continue
    }
  }

  return results
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Load all installed and enabled SDK plugins.
 * Called at startup after the legacy plugins.ts loadPlugins() runs.
 */
export async function loadPlugins(verbose = false): Promise<SDKPluginManifest[]> {
  const manifests: SDKPluginManifest[] = []

  // Discover from both sources
  const localPlugins = discoverLocalPlugins()
  const npmPlugins = discoverNpmPlugins()

  const allDiscovered = [
    ...localPlugins.map(p => ({ ...p, source: 'local' as const })),
    ...npmPlugins.map(p => ({ ...p, source: 'npm' as const })),
  ]

  for (const { name, entryPath, source } of allDiscovered) {
    const manifest: SDKPluginManifest = {
      name,
      version: '0.0.0',
      description: '',
      source,
      path: entryPath,
      enabled: isPluginEnabled(name),
      loaded: false,
      toolCount: 0,
      commandCount: 0,
      hasHooks: false,
    }

    if (!manifest.enabled) {
      if (verbose) console.log(`  [SDK] Skipping disabled plugin: ${name}`)
      manifests.push(manifest)
      continue
    }

    try {
      const plugin = await importPlugin(entryPath)

      manifest.version = plugin.version
      manifest.description = plugin.description
      manifest.author = plugin.author

      // Activate lifecycle hook
      if (plugin.activate) {
        await plugin.activate()
      }

      // Register tools, commands, hooks
      manifest.toolCount = registerPluginTools(plugin)
      manifest.commandCount = registerPluginCommands(plugin)
      manifest.hasHooks = registerPluginHooks(plugin)
      manifest.loaded = true
      manifest.loadedAt = new Date().toISOString()

      loadedSDKPlugins.set(name, { plugin, manifest })

      if (verbose) {
        console.log(`  [SDK] Loaded plugin: ${name} v${plugin.version} (${manifest.toolCount} tools, ${manifest.commandCount} commands)`)
      }
    } catch (err) {
      manifest.error = err instanceof Error ? err.message : String(err)
      if (verbose) {
        console.error(`  [SDK] Failed to load plugin ${name}: ${manifest.error}`)
      }
    }

    manifests.push(manifest)
  }

  return manifests
}

/**
 * Scaffold a new plugin with a full project structure.
 * Creates ~/.kbot/plugins/<name>/ with index.ts and package.json.
 */
export function createPlugin(name: string): string {
  // Validate name
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return `Invalid plugin name: "${name}". Use lowercase letters, numbers, and hyphens only.`
  }

  const pluginDir = join(PLUGINS_DIR, name)

  if (existsSync(pluginDir)) {
    return `Plugin already exists: ${pluginDir}\nEdit ${join(pluginDir, 'index.ts')} to modify it.`
  }

  ensureDir(pluginDir)

  // Generate index.ts from template
  const indexContent = `import type { KBotPlugin } from '@kernel.chat/kbot'

const plugin: KBotPlugin = {
  name: '${name}',
  version: '1.0.0',
  description: 'A custom kbot plugin',

  tools: [{
    name: '${name.replace(/-/g, '_')}',
    description: 'Does something useful',
    input_schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input' }
      },
      required: ['input']
    },
    execute: async (args) => {
      return \`Processed: \${args.input}\`
    }
  }],

  commands: [{
    name: '${name}',
    description: 'Run the ${name} plugin',
    execute: async (args) => {
      return \`${name} command executed with: \${args}\`
    }
  }],

  activate: async () => {
    console.log('${name} plugin activated')
  },

  deactivate: async () => {
    console.log('${name} plugin deactivated')
  }
}

export default plugin
`

  // Generate package.json
  const packageContent = {
    name: `kbot-plugin-${name}`,
    version: '1.0.0',
    description: `kbot plugin: ${name}`,
    type: 'module',
    main: 'index.ts',
    keywords: ['kbot-plugin', 'kbot', 'ai-agent', 'plugin'],
    license: 'MIT',
    peerDependencies: {
      '@kernel.chat/kbot': '>=2.0.0',
    },
  }

  writeFileSync(join(pluginDir, 'index.ts'), indexContent, 'utf-8')
  writeFileSync(join(pluginDir, 'package.json'), JSON.stringify(packageContent, null, 2), 'utf-8')

  // Auto-enable the new plugin
  const config = readPluginConfig()
  if (!config.enabled.includes(name)) {
    config.enabled.push(name)
  }
  // Remove from disabled if it was there
  config.disabled = config.disabled.filter(d => d !== name)
  writePluginConfig(config)

  return [
    `Plugin created: ${pluginDir}`,
    '',
    'Files:',
    `  ${join(pluginDir, 'index.ts')}   — plugin code`,
    `  ${join(pluginDir, 'package.json')} — metadata`,
    '',
    'Next steps:',
    `  1. Edit ${join(pluginDir, 'index.ts')} to add your tools, commands, and hooks`,
    '  2. Restart kbot to load the plugin',
    '  3. Your tools will appear as plugin_<name>_<tool_name>',
    `  4. Your commands will be available as /${name}`,
    '',
    'To publish to npm:',
    `  cd ${pluginDir}`,
    '  npm publish --access public',
    '',
    'Others can install it with:',
    `  kbot plugin install ${name}`,
  ].join('\n')
}

/**
 * Enable a plugin by name.
 */
export function enablePlugin(name: string): string {
  const config = readPluginConfig()
  config.disabled = config.disabled.filter(d => d !== name)
  if (!config.enabled.includes(name)) {
    config.enabled.push(name)
  }
  writePluginConfig(config)
  return `Plugin "${name}" enabled. Restart kbot to load it.`
}

/**
 * Disable a plugin by name. Calls deactivate() if loaded.
 */
export async function disablePlugin(name: string): Promise<string> {
  const config = readPluginConfig()
  config.enabled = config.enabled.filter(e => e !== name)
  if (!config.disabled.includes(name)) {
    config.disabled.push(name)
  }
  writePluginConfig(config)

  // Deactivate if currently loaded
  const loaded = loadedSDKPlugins.get(name)
  if (loaded) {
    try {
      if (loaded.plugin.deactivate) {
        await loaded.plugin.deactivate()
      }
    } catch {
      // Best effort
    }
    loadedSDKPlugins.delete(name)
  }

  return `Plugin "${name}" disabled.`
}

/**
 * Install a plugin from npm or a git URL.
 */
export function installPlugin(source: string): string {
  // Determine if it's an npm package name or git URL
  const isGitUrl = source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@')
  const isNpmPackage = !isGitUrl

  if (isNpmPackage) {
    // Normalize: if user says "foo", install "kbot-plugin-foo"
    const npmName = source.startsWith('kbot-plugin-') ? source : `kbot-plugin-${source}`
    const pluginName = source.startsWith('kbot-plugin-') ? source.replace(/^kbot-plugin-/, '') : source

    try {
      execSync(`npm install -g ${npmName}`, {
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: 'pipe',
      })

      // Auto-enable
      const config = readPluginConfig()
      if (!config.enabled.includes(pluginName)) {
        config.enabled.push(pluginName)
      }
      config.disabled = config.disabled.filter(d => d !== pluginName)
      writePluginConfig(config)

      return [
        `Installed npm plugin: ${npmName}`,
        `Plugin name: ${pluginName}`,
        '',
        'Restart kbot to load the plugin.',
      ].join('\n')
    } catch (err) {
      return `Failed to install ${npmName}: ${err instanceof Error ? err.message : String(err)}`
    }
  } else {
    // Git URL: clone into plugins directory
    const repoName = basename(source, '.git').replace(/^kbot-plugin-/, '')
    const pluginDir = join(PLUGINS_DIR, repoName)

    if (existsSync(pluginDir)) {
      return `Plugin directory already exists: ${pluginDir}. Remove it first or use a different name.`
    }

    ensureDir(PLUGINS_DIR)

    try {
      execSync(`git clone "${source}" "${pluginDir}"`, {
        encoding: 'utf-8',
        timeout: 60_000,
        stdio: 'pipe',
      })

      // Install dependencies if package.json exists
      const pkgPath = join(pluginDir, 'package.json')
      if (existsSync(pkgPath)) {
        try {
          execSync('npm install --production', {
            cwd: pluginDir,
            encoding: 'utf-8',
            timeout: 60_000,
            stdio: 'pipe',
          })
        } catch {
          // Non-fatal — plugin may not have dependencies
        }
      }

      // Auto-enable
      const config = readPluginConfig()
      if (!config.enabled.includes(repoName)) {
        config.enabled.push(repoName)
      }
      config.disabled = config.disabled.filter(d => d !== repoName)
      writePluginConfig(config)

      return [
        `Cloned plugin from: ${source}`,
        `Plugin name: ${repoName}`,
        `Location: ${pluginDir}`,
        '',
        'Restart kbot to load the plugin.',
      ].join('\n')
    } catch (err) {
      return `Failed to clone ${source}: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * Uninstall a plugin by name.
 */
export async function uninstallPlugin(name: string): Promise<string> {
  // Deactivate first
  const loaded = loadedSDKPlugins.get(name)
  if (loaded) {
    try {
      if (loaded.plugin.deactivate) {
        await loaded.plugin.deactivate()
      }
    } catch {
      // Best effort
    }
    loadedSDKPlugins.delete(name)
  }

  const lines: string[] = []

  // Remove local plugin directory
  const pluginDir = join(PLUGINS_DIR, name)
  if (existsSync(pluginDir)) {
    try {
      rmSync(pluginDir, { recursive: true, force: true })
      lines.push(`Removed local plugin: ${pluginDir}`)
    } catch (err) {
      lines.push(`Failed to remove ${pluginDir}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Try to uninstall npm package
  const npmName = `kbot-plugin-${name}`
  try {
    execSync(`npm uninstall -g ${npmName}`, {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: 'pipe',
    })
    lines.push(`Uninstalled npm package: ${npmName}`)
  } catch {
    // Not an npm plugin — that's fine
  }

  // Remove from config
  const config = readPluginConfig()
  config.enabled = config.enabled.filter(e => e !== name)
  config.disabled = config.disabled.filter(d => d !== name)
  writePluginConfig(config)

  if (lines.length === 0) {
    return `Plugin "${name}" not found locally or in npm global packages.`
  }

  lines.push('', `Plugin "${name}" uninstalled.`)
  return lines.join('\n')
}

/**
 * List all discovered plugins with their status.
 */
export function listPlugins(): string {
  const localPlugins = discoverLocalPlugins()
  const npmPlugins = discoverNpmPlugins()
  const config = readPluginConfig()

  const allPlugins = [
    ...localPlugins.map(p => ({ ...p, source: 'local' as const })),
    ...npmPlugins.map(p => ({ ...p, source: 'npm' as const })),
  ]

  if (allPlugins.length === 0 && config.enabled.length === 0) {
    return [
      'No plugins installed.',
      '',
      `Plugin directory: ${PLUGINS_DIR}`,
      '',
      'Create a plugin:',
      '  kbot plugin create my-tool',
      '',
      'Install from npm:',
      '  kbot plugin install <name>',
    ].join('\n')
  }

  const lines: string[] = [
    `Plugins (${allPlugins.length} discovered)`,
    '',
  ]

  for (const { name, entryPath, source } of allPlugins) {
    const enabled = isPluginEnabled(name)
    const loaded = loadedSDKPlugins.get(name)
    const status = loaded?.manifest.error
      ? `ERROR: ${loaded.manifest.error}`
      : loaded?.manifest.loaded
        ? `loaded (${loaded.manifest.toolCount} tools, ${loaded.manifest.commandCount} commands)`
        : enabled
          ? 'enabled (not yet loaded)'
          : 'disabled'

    const icon = loaded?.manifest.loaded ? '+' : loaded?.manifest.error ? '!' : enabled ? '-' : 'x'
    lines.push(`  [${icon}] ${name} (${source}) — ${status}`)

    if (loaded?.manifest.loaded) {
      lines.push(`      v${loaded.manifest.version}: ${loaded.manifest.description}`)
    }
    lines.push(`      ${entryPath}`)
  }

  lines.push('')
  lines.push(`Config: ${PLUGINS_CONFIG}`)

  return lines.join('\n')
}

// ── Hook Execution API ───────────────────────────────────────────────────

/**
 * Run all registered beforeMessage hooks in sequence.
 * Returns the (possibly transformed) message.
 */
export async function runBeforeMessageHooks(message: string): Promise<string> {
  let result = message
  for (const { hooks } of registeredHooks) {
    if (hooks.beforeMessage) {
      try {
        result = await hooks.beforeMessage(result)
      } catch {
        // Non-fatal: skip this hook
      }
    }
  }
  return result
}

/**
 * Run all registered afterResponse hooks in sequence.
 * Returns the (possibly transformed) response.
 */
export async function runAfterResponseHooks(response: string): Promise<string> {
  let result = response
  for (const { hooks } of registeredHooks) {
    if (hooks.afterResponse) {
      try {
        result = await hooks.afterResponse(result)
      } catch {
        // Non-fatal
      }
    }
  }
  return result
}

/**
 * Run all registered beforeToolCall hooks in sequence.
 * Returns the (possibly modified) args.
 */
export async function runBeforeToolCallHooks(tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  let result = args
  for (const { hooks } of registeredHooks) {
    if (hooks.beforeToolCall) {
      try {
        result = await hooks.beforeToolCall(tool, result)
      } catch {
        // Non-fatal
      }
    }
  }
  return result
}

/**
 * Run all registered afterToolCall hooks in sequence.
 * Returns the (possibly transformed) result.
 */
export async function runAfterToolCallHooks(tool: string, result: string): Promise<string> {
  let current = result
  for (const { hooks } of registeredHooks) {
    if (hooks.afterToolCall) {
      try {
        current = await hooks.afterToolCall(tool, current)
      } catch {
        // Non-fatal
      }
    }
  }
  return current
}

// ── Command Execution API ────────────────────────────────────────────────

/**
 * Check if a slash command is provided by a plugin.
 */
export function hasPluginCommand(commandName: string): boolean {
  return registeredCommands.has(commandName)
}

/**
 * Execute a plugin slash command.
 */
export async function executePluginCommand(commandName: string, args: string): Promise<string> {
  const cmd = registeredCommands.get(commandName)
  if (!cmd) {
    return `Unknown plugin command: /${commandName}`
  }
  try {
    return await cmd.execute(args)
  } catch (err) {
    return `Plugin command error (/${commandName}): ${err instanceof Error ? err.message : String(err)}`
  }
}

/**
 * Get all registered plugin commands.
 */
export function getPluginCommands(): Array<{ name: string; description: string; pluginName: string }> {
  return Array.from(registeredCommands.values()).map(cmd => ({
    name: cmd.name,
    description: cmd.description,
    pluginName: cmd.pluginName,
  }))
}

// ── Loaded Plugin Access ─────────────────────────────────────────────────

/**
 * Get a loaded plugin by name.
 */
export function getLoadedPlugin(name: string): KBotPlugin | undefined {
  return loadedSDKPlugins.get(name)?.plugin
}

/**
 * Get all loaded SDK plugins.
 */
export function getLoadedSDKPlugins(): SDKPluginManifest[] {
  return Array.from(loadedSDKPlugins.values()).map(p => p.manifest)
}

/**
 * Deactivate all loaded plugins (called on shutdown).
 */
export async function deactivateAll(): Promise<void> {
  for (const [, { plugin }] of Array.from(loadedSDKPlugins.entries())) {
    try {
      if (plugin.deactivate) {
        await plugin.deactivate()
      }
    } catch {
      // Best effort on shutdown
    }
  }
  loadedSDKPlugins.clear()
  registeredCommands.clear()
  registeredHooks.length = 0
}

// ── Tool Registration ────────────────────────────────────────────────────

/**
 * Register plugin management tools into the kbot tool registry.
 * These tools let the user manage plugins via natural language.
 */
export function registerPluginSDKTools(): void {
  registerTool({
    name: 'plugin_create',
    description: 'Scaffold a new kbot plugin with index.ts and package.json. Creates a ready-to-edit plugin directory in ~/.kbot/plugins/.',
    parameters: {
      name: {
        type: 'string',
        description: 'Plugin name (lowercase, hyphens allowed, e.g., "my-tool")',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const name = String(args.name).toLowerCase().trim()
      return createPlugin(name)
    },
  })

  registerTool({
    name: 'plugin_list',
    description: 'List all installed kbot plugins with their status (enabled/disabled/loaded/error).',
    parameters: {},
    tier: 'free',
    async execute() {
      return listPlugins()
    },
  })

  registerTool({
    name: 'plugin_enable',
    description: 'Enable a disabled kbot plugin. The plugin will be loaded on next startup.',
    parameters: {
      name: {
        type: 'string',
        description: 'Plugin name to enable',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      return enablePlugin(String(args.name).trim())
    },
  })

  registerTool({
    name: 'plugin_disable',
    description: 'Disable an active kbot plugin. Deactivates it immediately if loaded.',
    parameters: {
      name: {
        type: 'string',
        description: 'Plugin name to disable',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      return disablePlugin(String(args.name).trim())
    },
  })

  registerTool({
    name: 'plugin_install',
    description: 'Install a kbot plugin from npm (kbot-plugin-<name>) or a git URL. Automatically enables the plugin.',
    parameters: {
      source: {
        type: 'string',
        description: 'npm package name (e.g., "my-tool" or "kbot-plugin-my-tool") or git URL',
        required: true,
      },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      return installPlugin(String(args.source).trim())
    },
  })

  registerTool({
    name: 'plugin_uninstall',
    description: 'Remove a kbot plugin completely. Removes local files and/or npm global package.',
    parameters: {
      name: {
        type: 'string',
        description: 'Plugin name to uninstall',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      return uninstallPlugin(String(args.name).trim())
    },
  })
}
