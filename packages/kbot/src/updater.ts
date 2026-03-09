// K:BOT Auto-Updater — silent automatic updates
//
// On every startup:
// 1. Check npm for newer version (non-blocking, cached 4h)
// 2. If update found, install silently in background
// 3. Next launch uses new version — zero user action required
//
// Users never have to reinstall. Updates just happen.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { exec, execSync, spawn } from 'node:child_process'

const KBOT_DIR = join(homedir(), '.kbot')
const UPDATE_CACHE = join(KBOT_DIR, 'update-check.json')
const PACKAGE_NAME = '@kernel.chat/kbot'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

interface UpdateCache {
  lastCheck: number
  latestVersion: string | null
  autoUpdated?: string    // Version we last auto-updated to
  updatePending?: boolean // True if update installed, waiting for restart
}

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(UPDATE_CACHE)) return null
    return JSON.parse(readFileSync(UPDATE_CACHE, 'utf-8'))
  } catch {
    return null
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
    writeFileSync(UPDATE_CACHE, JSON.stringify(cache))
  } catch {
    // Non-critical — skip
  }
}

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPatch] = latest.split('.').map(Number)
  const [cMaj, cMin, cPatch] = current.split('.').map(Number)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

/**
 * Check for updates and auto-install silently.
 * Returns a status message or null.
 * - If update was installed in background since last run: "Updated to X.Y.Z"
 * - If update is installing now: null (silent)
 * - If already current: null
 */
export function checkForUpdate(currentVersion: string): string | null {
  // Skip in dev mode
  if (process.env.KBOT_DEV) return null

  const cache = readCache()
  const now = Date.now()

  // If we auto-updated last time and user restarted, confirm it
  if (cache?.updatePending && cache.autoUpdated) {
    if (!isNewer(cache.autoUpdated, currentVersion)) {
      // User is now running the new version — clear the pending flag
      writeCache({ ...cache, updatePending: false })
      return `Auto-updated to ${currentVersion}`
    }
  }

  // Use cached result if fresh enough
  if (cache && (now - cache.lastCheck) < CHECK_INTERVAL_MS) {
    if (cache.latestVersion && isNewer(cache.latestVersion, currentVersion)) {
      // We know there's an update — trigger silent install if not already pending
      if (!cache.updatePending) {
        silentAutoUpdate(cache.latestVersion)
      }
      return null // Don't bother user — it's installing silently
    }
    return null
  }

  // Check npm registry + auto-update in BACKGROUND — don't block startup
  exec(`npm view ${PACKAGE_NAME} version 2>/dev/null`, { timeout: 10000 }, (_err, stdout) => {
    const latest = stdout?.trim() || null
    const newCache: UpdateCache = {
      lastCheck: Date.now(),
      latestVersion: latest,
      autoUpdated: cache?.autoUpdated,
      updatePending: cache?.updatePending,
    }
    writeCache(newCache)

    // If newer version found, install it silently in background
    if (latest && isNewer(latest, currentVersion)) {
      silentAutoUpdate(latest)
    }
  })

  return null
}

/**
 * Install update silently in background.
 * Spawns a detached child process so it doesn't block the current session.
 * Next time the user runs `kbot`, they'll get the new version automatically.
 */
function silentAutoUpdate(version: string): void {
  try {
    // Spawn detached npm install — runs independently of this process
    const child = spawn(
      'npm',
      ['install', '-g', `${PACKAGE_NAME}@${version}`],
      {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      }
    )
    child.unref() // Don't keep kbot alive waiting for this

    // Mark as pending so we can confirm on next startup
    const cache = readCache() || { lastCheck: Date.now(), latestVersion: version }
    writeCache({
      ...cache,
      autoUpdated: version,
      updatePending: true,
    })
  } catch {
    // Silent fail — will retry next check
  }
}

/** Get latest version from npm registry (blocking — used by explicit update command) */
export function getLatestVersion(): string | null {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version 2>/dev/null`, {
      timeout: 15000,
      encoding: 'utf-8',
    })
    return result.trim() || null
  } catch {
    return null
  }
}

/** Explicit self-update (for `kbot update` command). Blocking with status output. */
export function selfUpdate(currentVersion: string, onStatus: (msg: string) => void): boolean {
  const latest = getLatestVersion()

  if (!latest) {
    onStatus('Could not reach npm registry. Check your connection.')
    return false
  }

  if (!isNewer(latest, currentVersion)) {
    onStatus(`Already on latest version (${currentVersion}).`)
    return true
  }

  onStatus(`Updating ${currentVersion} → ${latest}...`)

  try {
    execSync(`npm install -g ${PACKAGE_NAME}@${latest}`, { timeout: 120_000, stdio: 'pipe' })
    writeCache({ lastCheck: Date.now(), latestVersion: latest, autoUpdated: latest, updatePending: false })
    onStatus(`Updated to ${latest}. Restart kbot to use the new version.`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('EACCES') || msg.includes('permission')) {
      onStatus(`Permission denied. Try: sudo npm install -g ${PACKAGE_NAME}`)
    } else {
      onStatus(`Update failed: ${msg.slice(0, 120)}`)
    }
    return false
  }
}
