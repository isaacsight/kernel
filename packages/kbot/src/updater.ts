// K:BOT Auto-Updater — checks npm for newer version and self-updates
//
// Runs on startup (non-blocking). If a newer version exists:
// 1. Prints a short update message
// 2. Runs `npm install -g @kernel.chat/kbot@latest` in the background
// 3. Caches last-check timestamp to avoid checking every run (max once per hour)

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const KBOT_DIR = join(homedir(), '.kbot')
const UPDATE_CACHE = join(KBOT_DIR, 'update-check.json')
const PACKAGE_NAME = '@kernel.chat/kbot'
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

interface UpdateCache {
  lastCheck: number
  latestVersion: string | null
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

function fetchLatestVersion(): string | null {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 8000,
    })
    return result.trim() || null
  } catch {
    return null
  }
}

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPatch] = latest.split('.').map(Number)
  const [cMaj, cMin, cPatch] = current.split('.').map(Number)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

/** Check for updates and auto-install if available. Returns update message or null. */
export function checkForUpdate(currentVersion: string): string | null {
  // Skip in dev mode
  if (process.env.KBOT_DEV) return null

  const cache = readCache()
  const now = Date.now()

  // Use cached result if fresh enough
  if (cache && (now - cache.lastCheck) < CHECK_INTERVAL_MS) {
    if (cache.latestVersion && isNewer(cache.latestVersion, currentVersion)) {
      // Already know an update exists — try to install
      return doUpdate(cache.latestVersion, currentVersion)
    }
    return null
  }

  // Check npm registry
  const latest = fetchLatestVersion()
  writeCache({ lastCheck: now, latestVersion: latest })

  if (!latest || !isNewer(latest, currentVersion)) return null

  return doUpdate(latest, currentVersion)
}

function doUpdate(latest: string, current: string): string | null {
  try {
    execSync(`npm install -g ${PACKAGE_NAME}@latest 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: 'ignore',
    })
    return `Updated K:BOT ${current} → ${latest}`
  } catch {
    // If global install fails (permissions), try without sudo
    try {
      execSync(`npm install -g ${PACKAGE_NAME}@latest --prefix ~/.kbot/global 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 30000,
        stdio: 'ignore',
      })
      return `Updated K:BOT ${current} → ${latest}`
    } catch {
      return `Update available: ${current} → ${latest}  (run: npm i -g ${PACKAGE_NAME})`
    }
  }
}
