// kbot Plugin System — Drop-in tool extensions
//
// Users place .ts/.js files in ~/.kbot/plugins/ and they auto-register as tools.
// Each plugin exports a default PluginDefinition or an array of them.
//
// Example plugin (~/.kbot/plugins/hello.js):
//   export default {
//     name: 'hello',
//     description: 'Say hello',
//     parameters: { name: { type: 'string', description: 'Who to greet', required: true } },
//     execute: async (args) => `Hello, ${args.name}!`,
//   }

import { existsSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import chalk from 'chalk'
import { registerTool, type ToolDefinition } from './tools/index.js'
import {
  IntegrityError,
  verifyAllPlugins,
  enforce,
  type VerifyAllResult,
} from './plugins-integrity.js'

const PLUGINS_DIR = join(homedir(), '.kbot', 'plugins')
const PLUGIN_EXTENSIONS = ['.js', '.mjs']

/**
 * Default integrity manifest path. Override with KBOT_PLUGIN_MANIFEST env var
 * or the `manifestPath` option to `loadPlugins`.
 */
const DEFAULT_MANIFEST_PATH = join(homedir(), '.kbot', 'plugins.json')

export interface LoadPluginsOptions {
  /** Override the plugin directory (used by tests). Defaults to ~/.kbot/plugins. */
  pluginsDir?: string
  /** Override the integrity manifest path. Defaults to ~/.kbot/plugins.json. */
  manifestPath?: string
  /**
   * Override the integrity-disabled flag. Defaults to reading
   * `process.env.KBOT_PLUGIN_INTEGRITY === 'off'`.
   */
  integrityDisabled?: boolean
}

export interface PluginDefinition {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
    default?: unknown
  }>
  execute: (args: Record<string, unknown>) => Promise<string>
  tier?: 'free' | 'pro' | 'growth' | 'enterprise'
}

export interface PluginManifest {
  name: string
  file: string
  toolCount: number
  loadedAt: string
  error?: string
}

const loadedPlugins: PluginManifest[] = []

/** Ensure the plugins directory exists */
export function ensurePluginsDir(dir: string = PLUGINS_DIR): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Run the integrity manifest gate before discovery.
 *
 * Behaviour:
 *   - If KBOT_PLUGIN_INTEGRITY=off (or `opts.integrityDisabled === true`):
 *     emit a yellow warning and return `null` (verification skipped, all
 *     discovered plugins will load).
 *   - If the manifest file does not exist: emit a yellow info note and
 *     return `null` (back-compat — manifest is optional today).
 *   - If the manifest exists and verifies: return the `VerifyAllResult` so
 *     the caller can restrict loads to `result.verified`.
 *   - If the manifest exists and any plugin fails: throw `IntegrityError`
 *     (kbot refuses to start).
 */
async function runIntegrityGate(
  manifestPath: string,
  pluginsDir: string,
  integrityDisabled: boolean,
): Promise<VerifyAllResult | null> {
  if (integrityDisabled) {
    console.error(
      chalk.yellow(
        `  ⚠ Plugin integrity verification is DISABLED (KBOT_PLUGIN_INTEGRITY=off). ` +
          `Plugins under ${pluginsDir} will load without hash checking.`,
      ),
    )
    return null
  }

  if (!existsSync(manifestPath)) {
    console.error(
      chalk.yellow(
        `  ⚠ no plugin manifest at ${manifestPath} — plugins are unverified. ` +
          `Create one to pin plugins by SHA-256 (see PLUGINS_INTEGRITY.md).`,
      ),
    )
    return null
  }

  // verifyAllPlugins resolves manifest entry paths against pluginsDir, so the
  // file layout is: <pluginsDir>/<entry.path> matches the hash in the manifest.
  try {
    const result = await verifyAllPlugins(manifestPath, pluginsDir)
    if (result.failed.length > 0) {
      const lines = result.failed
        .map((f) => `    - ${f.name}: ${f.reason}`)
        .join('\n')
      console.error(
        chalk.red(
          `  ✗ Plugin integrity check failed for ${result.failed.length} plugin(s):\n${lines}\n` +
            `    Manifest: ${manifestPath}\n` +
            `    To refresh hashes, recompute SHA-256 for each plugin file and update the manifest. ` +
            `Set KBOT_PLUGIN_INTEGRITY=off ONLY for local dev; never in production.`,
        ),
      )
      enforce(result) // throws IntegrityError
    }
    return result
  } catch (err) {
    if (err instanceof IntegrityError) throw err
    // loadManifest threw (malformed JSON, schema violation, etc.) — fail closed.
    console.error(
      chalk.red(
        `  ✗ Failed to load plugin integrity manifest at ${manifestPath}: ${
          (err as Error).message
        }`,
      ),
    )
    throw err
  }
}

/** Load all plugins from ~/.kbot/plugins/ */
export async function loadPlugins(
  verbose = false,
  opts: LoadPluginsOptions = {},
): Promise<PluginManifest[]> {
  const pluginsDir = opts.pluginsDir ?? PLUGINS_DIR
  const manifestPath =
    opts.manifestPath ?? process.env.KBOT_PLUGIN_MANIFEST ?? DEFAULT_MANIFEST_PATH
  const integrityDisabled =
    opts.integrityDisabled ?? process.env.KBOT_PLUGIN_INTEGRITY === 'off'

  ensurePluginsDir(pluginsDir)

  // Security: reject plugins if directory is world/group-writable
  try {
    const dirStat = statSync(pluginsDir)
    if ((dirStat.mode & 0o022) !== 0) {
      if (verbose) console.error('  ⚠ Plugin directory is writable by others — skipping plugins for security')
      return []
    }
  } catch {
    return []
  }

  // Integrity gate — runs BEFORE any file is imported. Throws IntegrityError
  // on drift unless KBOT_PLUGIN_INTEGRITY=off.
  const integrity = await runIntegrityGate(manifestPath, pluginsDir, integrityDisabled)

  // When a manifest verified successfully, restrict loads to verified names.
  // When the manifest is missing or integrity is disabled, allow every file.
  const verifiedNames: Set<string> | null = integrity
    ? new Set(integrity.verified)
    : null

  // Top-level plugin files
  const topLevel = readdirSync(pluginsDir).filter(f =>
    PLUGIN_EXTENSIONS.some(ext => f.endsWith(ext))
  )
  // Forged subdirectory (created by forge.ts at runtime). v3.99.31 and earlier
  // persisted forged tools here without the loader scanning for them; fixed in v4.0.
  let forgedFiles: string[] = []
  try {
    const forgedDir = join(pluginsDir, 'forged')
    forgedFiles = readdirSync(forgedDir)
      .filter(f => PLUGIN_EXTENSIONS.some(ext => f.endsWith(ext)))
      .map(f => `forged/${f}`)
  } catch {
    // forged/ doesn't exist — nothing to load
  }
  const files = [...topLevel, ...forgedFiles]

  if (files.length === 0) return []

  for (const file of files) {
    const pluginName = file.replace(/\.[^.]+$/, '')

    // When manifest verification ran, only load plugins whose name appears in
    // the verified set. Files not declared in the manifest are silently
    // skipped (they did not pass — and could not have passed — verification).
    if (verifiedNames && !verifiedNames.has(pluginName)) {
      if (verbose) {
        console.error(
          chalk.yellow(`  ⚠ Skipping ${file} — not declared in plugin manifest`),
        )
      }
      continue
    }

    // Security: reject plugin files that are group/world-writable
    try {
      const fileStat = statSync(join(pluginsDir, file))
      if ((fileStat.mode & 0o022) !== 0) {
        loadedPlugins.push({
          name: file.replace(/\.[^.]+$/, ''),
          file,
          toolCount: 0,
          loadedAt: new Date().toISOString(),
          error: 'Skipped: file is writable by others (security)',
        })
        continue
      }
    } catch {
      continue
    }
    const filePath = join(pluginsDir, file)
    const manifest: PluginManifest = {
      name: file.replace(/\.[^.]+$/, ''),
      file,
      toolCount: 0,
      loadedAt: new Date().toISOString(),
    }

    try {
      const fileUrl = pathToFileURL(filePath).href
      const mod = await import(fileUrl)

      const definitions: PluginDefinition[] = []

      if (mod.default) {
        if (Array.isArray(mod.default)) {
          definitions.push(...mod.default)
        } else {
          definitions.push(mod.default)
        }
      }

      if (mod.tools && Array.isArray(mod.tools)) {
        definitions.push(...mod.tools)
      }

      for (const def of definitions) {
        if (!def.name || !def.execute) continue

        const tool: ToolDefinition = {
          name: `plugin_${def.name}`,
          description: `[Plugin] ${def.description || def.name}`,
          parameters: def.parameters || {},
          tier: def.tier || 'free',
          execute: def.execute,
        }

        registerTool(tool)
        manifest.toolCount++
      }
    } catch (err) {
      manifest.error = err instanceof Error ? err.message : String(err)
    }

    loadedPlugins.push(manifest)
  }

  return loadedPlugins
}

/** List loaded plugins */
export function getLoadedPlugins(): PluginManifest[] {
  return loadedPlugins
}

/** Format plugin list for display */
export function formatPluginList(): string {
  if (loadedPlugins.length === 0) {
    return [
      'No plugins loaded.',
      '',
      `Plugin directory: ${PLUGINS_DIR}`,
      '',
      'Create a plugin:',
      `  kbot /plugins create my-tool`,
      '',
      'Or manually create a .js file in the plugins directory.',
    ].join('\n')
  }

  const lines: string[] = [
    `${loadedPlugins.length} plugin(s) loaded from ${PLUGINS_DIR}`,
    '',
  ]

  for (const p of loadedPlugins) {
    const status = p.error ? `  ✗ ${p.name} — ${p.error}` : `  ✓ ${p.name} (${p.toolCount} tools)`
    lines.push(status)
  }

  return lines.join('\n')
}

/** Create a scaffold plugin file */
export function scaffoldPlugin(name: string): string {
  ensurePluginsDir()
  const filePath = join(PLUGINS_DIR, `${name}.js`)

  if (existsSync(filePath)) {
    return `Plugin already exists: ${filePath}`
  }

  const content = `// kbot Plugin: ${name}
// This file is auto-loaded when kbot starts.

export default {
  name: '${name}',
  description: 'Description of what this tool does',
  parameters: {
    input: {
      type: 'string',
      description: 'The input to process',
      required: true,
    },
  },
  async execute(args) {
    const input = String(args.input)
    return \`Processed: \${input}\`
  },
}
`

  writeFileSync(filePath, content, 'utf-8')
  return `Plugin created: ${filePath}`
}
