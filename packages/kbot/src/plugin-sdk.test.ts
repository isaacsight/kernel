/**
 * Tests for plugin-sdk loader integrity wiring.
 *
 * Mirrors `plugins.test.ts`'s four behaviour-contract branches against the
 * SDK loader (which handles directory-style packaged plugins, vs. the
 * drop-in `.js` files plugins.ts handles):
 *   1. Manifest missing → no error, plugin still loads.
 *   2. Manifest present + matching hashes → loads only verified names.
 *   3. Manifest present + drift + integrity enforced → throws IntegrityError.
 *   4. Integrity disabled (KBOT_PLUGIN_INTEGRITY=off) + drift → loads anyway,
 *      yellow warning logged.
 *
 * The SDK loader also reads a per-plugin enable/disable list from
 * `~/.kbot/plugins.json` (PLUGINS_CONFIG). That path collides with the
 * default integrity manifest path, so each test passes an explicit
 * `manifestPath` outside the plugins directory and accepts the SDK's
 * "default-enabled when not in disabled list" behaviour.
 *
 * The kbot tool registry is a module-level Map. Tests cannot clear it, so
 * each test uses a unique plugin name (random suffix).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadPlugins } from './plugin-sdk.js'
import { IntegrityError } from './plugins-integrity.js'
import { getTool } from './tools/index.js'

function sha256Base64(s: string): string {
  return `sha256-${createHash('sha256').update(s).digest('base64')}`
}

function uniqueName(prefix: string): string {
  // Hyphen-free suffix — plugin names propagate into tool names which use
  // underscore separators, and the SDK validates `plugin.name` only as a
  // string (no charset rules at load time).
  return `${prefix}_${randomBytes(4).toString('hex')}`
}

/**
 * SDK plugins register tools as `plugin_<pluginName>_<toolName>`. The body
 * builder below uses `do_thing` as the tool name for every test plugin.
 */
function hasSDKPluginTool(pluginName: string): boolean {
  return getTool(`plugin_${pluginName}_do_thing`) !== undefined
}

/**
 * Build a minimal valid SDK plugin module body. Exports a default
 * `KBotPlugin` with a single tool. Written as a `.js` ESM file so the SDK
 * loader does not need to invoke esbuild/tsx during tests.
 */
function makeSDKPluginSource(name: string): string {
  return [
    'export default {',
    `  name: '${name}',`,
    "  version: '1.0.0',",
    `  description: 'Test SDK plugin ${name}',`,
    '  tools: [{',
    "    name: 'do_thing',",
    "    description: 'do a thing',",
    "    input_schema: { type: 'object', properties: {}, required: [] },",
    `    execute: async () => 'ok-${name}',`,
    '  }],',
    '}',
    '',
  ].join('\n')
}

describe('plugin-sdk loadPlugins integrity wiring', () => {
  let tmpRoot: string
  let tmpPluginsDir: string
  let tmpManifestPath: string
  let warnSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    // Use a parent tmpRoot so the manifest can sit beside the plugins dir
    // (avoiding the SDK's `~/.kbot/plugins.json` path collision in tests).
    tmpRoot = await mkdtemp(join(tmpdir(), 'kbot-sdk-'))
    tmpPluginsDir = join(tmpRoot, 'plugins')
    await mkdir(tmpPluginsDir, { recursive: true })
    tmpManifestPath = join(tmpRoot, `manifest-${randomBytes(6).toString('hex')}.json`)

    // Silence + capture chalk-coloured warnings written via console.error.
    warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  /**
   * Helper: write a packaged SDK plugin at `<pluginsDir>/<name>/index.js`.
   * Returns the file body so callers can hash it for the manifest.
   */
  async function writePackagedPlugin(name: string): Promise<string> {
    const dir = join(tmpPluginsDir, name)
    await mkdir(dir, { recursive: true })
    const body = makeSDKPluginSource(name)
    await writeFile(join(dir, 'index.js'), body, 'utf8')
    return body
  }

  it('manifest missing: emits info, plugin still loads', async () => {
    const name = uniqueName('alpha')
    await writePackagedPlugin(name)

    const manifests = await loadPlugins(false, {
      pluginsDir: tmpPluginsDir,
      manifestPath: tmpManifestPath, // file does not exist
      integrityDisabled: false,
    })

    const entry = manifests.find((m) => m.name === name)
    expect(entry).toBeDefined()
    expect(entry?.error).toBeUndefined()
    expect(entry?.loaded).toBe(true)
    expect(entry?.toolCount).toBe(1)
    expect(hasSDKPluginTool(name)).toBe(true)

    // Yellow info note about the missing manifest.
    const messages = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(messages.some((m: string) => m.includes('no plugin manifest'))).toBe(true)
  })

  it('manifest present + matching hashes: only verified names load', async () => {
    const verifiedName = uniqueName('verified')
    const undeclaredName = uniqueName('undeclared')
    const verifiedBody = await writePackagedPlugin(verifiedName)
    await writePackagedPlugin(undeclaredName)

    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name: verifiedName,
            version: '1.0.0',
            // Path is relative to pluginsDir; SDK packaged plugin lives at
            // <pluginsDir>/<name>/index.js.
            path: `${verifiedName}/index.js`,
            integrity: sha256Base64(verifiedBody),
          },
        ],
      }),
      'utf8',
    )

    const manifests = await loadPlugins(false, {
      pluginsDir: tmpPluginsDir,
      manifestPath: tmpManifestPath,
      integrityDisabled: false,
    })

    expect(hasSDKPluginTool(verifiedName)).toBe(true)
    // The undeclared plugin on disk was skipped — never declared in the
    // manifest, so it cannot have been verified.
    expect(hasSDKPluginTool(undeclaredName)).toBe(false)

    const undeclaredEntry = manifests.find((m) => m.name === undeclaredName)
    expect(undeclaredEntry?.loaded).toBe(false)
    expect(undeclaredEntry?.error).toBe('not declared in plugin integrity manifest')
  })

  it('manifest present + drift + integrity enforced: throws IntegrityError', async () => {
    const name = uniqueName('drifted')
    await writePackagedPlugin(name)

    // Manifest hash deliberately points at *different* content.
    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name,
            version: '1.0.0',
            path: `${name}/index.js`,
            integrity: sha256Base64('this is not the file body'),
          },
        ],
      }),
      'utf8',
    )

    let caught: unknown
    try {
      await loadPlugins(false, {
        pluginsDir: tmpPluginsDir,
        manifestPath: tmpManifestPath,
        integrityDisabled: false,
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(IntegrityError)
    expect((caught as IntegrityError).failed).toHaveLength(1)
    expect((caught as IntegrityError).failed[0].name).toBe(name)
    expect((caught as IntegrityError).failed[0].reason).toBe('integrity drift')
    // The drifted plugin was never imported.
    expect(hasSDKPluginTool(name)).toBe(false)
  })

  it('integrity disabled: drift is allowed and a yellow warning is logged', async () => {
    const name = uniqueName('bypassed')
    await writePackagedPlugin(name)

    // Manifest hash is wrong, but integrity is off — drift should be ignored.
    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name,
            version: '1.0.0',
            path: `${name}/index.js`,
            integrity: sha256Base64('mismatched'),
          },
        ],
      }),
      'utf8',
    )

    await expect(
      loadPlugins(false, {
        pluginsDir: tmpPluginsDir,
        manifestPath: tmpManifestPath,
        integrityDisabled: true,
      }),
    ).resolves.toBeDefined()

    // Plugin loaded despite the drift.
    expect(hasSDKPluginTool(name)).toBe(true)

    // Loud warning surfaced.
    const messages = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(
      messages.some((m: string) =>
        m.includes('KBOT_PLUGIN_INTEGRITY=off'),
      ),
    ).toBe(true)
  })
})
