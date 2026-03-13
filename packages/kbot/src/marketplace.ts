import { existsSync, writeFileSync, readFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import chalk from 'chalk'

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
