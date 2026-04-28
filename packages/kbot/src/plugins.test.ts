/**
 * Tests for plugin loader integrity wiring.
 *
 * Covers the four behaviour-contract branches:
 *   1. Manifest missing → no error, plugin still loads.
 *   2. Manifest present + matching hashes → loads only verified names.
 *   3. Manifest present + drift + integrity enforced → throws IntegrityError.
 *   4. Integrity disabled (KBOT_PLUGIN_INTEGRITY=off) + drift → loads anyway,
 *      yellow warning logged.
 *
 * The kbot tool registry is a module-level Map. Tests cannot clear it, so each
 * test uses a unique plugin name (random suffix) to avoid collisions with
 * other tests (and the rest of the kbot tool surface, which never registers
 * `plugin_*`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadPlugins } from './plugins.js'
import { IntegrityError } from './plugins-integrity.js'
import { getTool } from './tools/index.js'

function sha256Base64(s: string): string {
  return `sha256-${createHash('sha256').update(s).digest('base64')}`
}

function uniqueName(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`
}

function hasPluginTool(name: string): boolean {
  return getTool(`plugin_${name}`) !== undefined
}

// Minimal valid plugin source — exports a default PluginDefinition.
function makePluginSource(name: string): string {
  return [
    'export default {',
    `  name: '${name}',`,
    `  description: 'Test plugin ${name}',`,
    '  parameters: {},',
    `  async execute() { return 'ok-${name}' }`,
    '}',
    '',
  ].join('\n')
}

describe('loadPlugins integrity wiring', () => {
  let tmpPluginsDir: string
  let tmpManifestPath: string
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tmpPluginsDir = await mkdtemp(join(tmpdir(), 'kbot-plugins-'))
    tmpManifestPath = join(
      tmpPluginsDir,
      '..',
      `manifest-${randomBytes(6).toString('hex')}.json`,
    )
    // Silence + capture chalk-coloured warnings written via console.error.
    warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await rm(tmpPluginsDir, { recursive: true, force: true })
    await rm(tmpManifestPath, { force: true })
    warnSpy.mockRestore()
  })

  it('manifest missing: emits info, plugin still loads', async () => {
    const name = uniqueName('alpha')
    const pluginBody = makePluginSource(name)
    await writeFile(join(tmpPluginsDir, `${name}.js`), pluginBody, 'utf8')

    const manifests = await loadPlugins(false, {
      pluginsDir: tmpPluginsDir,
      manifestPath: tmpManifestPath, // file does not exist
      integrityDisabled: false,
    })

    // The returned manifests array is module-level and shared across calls;
    // find the one that corresponds to *this* test's plugin file.
    const entry = manifests.find((m) => m.name === name)
    expect(entry).toBeDefined()
    expect(entry?.error).toBeUndefined()
    expect(entry?.toolCount).toBe(1)
    expect(hasPluginTool(name)).toBe(true)

    // Yellow info note about the missing manifest.
    const messages = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(messages.some((m: string) => m.includes('no plugin manifest'))).toBe(true)
  })

  it('manifest present + matching hashes: only verified names load', async () => {
    const verifiedName = uniqueName('verified')
    const undeclaredName = uniqueName('undeclared')
    const verifiedBody = makePluginSource(verifiedName)
    const undeclaredBody = makePluginSource(undeclaredName)
    await writeFile(join(tmpPluginsDir, `${verifiedName}.js`), verifiedBody, 'utf8')
    await writeFile(join(tmpPluginsDir, `${undeclaredName}.js`), undeclaredBody, 'utf8')

    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name: verifiedName,
            version: '1.0.0',
            path: `${verifiedName}.js`,
            integrity: sha256Base64(verifiedBody),
          },
        ],
      }),
      'utf8',
    )

    await loadPlugins(false, {
      pluginsDir: tmpPluginsDir,
      manifestPath: tmpManifestPath,
      integrityDisabled: false,
    })

    expect(hasPluginTool(verifiedName)).toBe(true)
    // The undeclared file on disk was skipped — never declared in the
    // manifest, so it cannot have been verified.
    expect(hasPluginTool(undeclaredName)).toBe(false)
  })

  it('manifest present + drift + integrity enforced: throws IntegrityError', async () => {
    const name = uniqueName('drifted')
    const realBody = makePluginSource(name)
    await writeFile(join(tmpPluginsDir, `${name}.js`), realBody, 'utf8')

    // Manifest hash deliberately points at *different* content.
    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name,
            version: '1.0.0',
            path: `${name}.js`,
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
    expect(hasPluginTool(name)).toBe(false)
  })

  it('integrity disabled: drift is allowed and a yellow warning is logged', async () => {
    const name = uniqueName('bypassed')
    const realBody = makePluginSource(name)
    await writeFile(join(tmpPluginsDir, `${name}.js`), realBody, 'utf8')

    // Manifest hash is wrong, but integrity is off — drift should be ignored.
    await writeFile(
      tmpManifestPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            name,
            version: '1.0.0',
            path: `${name}.js`,
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
    expect(hasPluginTool(name)).toBe(true)

    // Loud warning surfaced.
    const messages = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(
      messages.some((m: string) =>
        m.includes('Plugin integrity verification is DISABLED'),
      ),
    ).toBe(true)
  })
})
