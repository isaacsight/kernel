// K:BOT Plugin System — Drop-in tool extensions
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

import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { registerTool, type ToolDefinition } from './tools/index.js'

const PLUGINS_DIR = join(homedir(), '.kbot', 'plugins')
const PLUGIN_EXTENSIONS = ['.js', '.mjs']

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
export function ensurePluginsDir(): string {
  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true })
  }
  return PLUGINS_DIR
}

/** Load all plugins from ~/.kbot/plugins/ */
export async function loadPlugins(verbose = false): Promise<PluginManifest[]> {
  ensurePluginsDir()

  const files = readdirSync(PLUGINS_DIR).filter(f =>
    PLUGIN_EXTENSIONS.some(ext => f.endsWith(ext))
  )

  if (files.length === 0) return []

  for (const file of files) {
    const filePath = join(PLUGINS_DIR, file)
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

  const content = `// K:BOT Plugin: ${name}
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
