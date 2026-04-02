/**
 * install-remote-script.ts — Install KBotBridge Remote Script into Ableton Live
 *
 * Copies the KBotBridge Python Remote Script to Ableton's User Library,
 * enabling the Browser API bridge on TCP port 9998.
 *
 * The Remote Script exposes Ableton's browser.load_item() API, which is
 * ONLY available from Python Remote Scripts (not from Max for Live).
 * This lets kbot programmatically load any native device (Saturator,
 * EQ Eight, Compressor, etc.) onto any track.
 *
 * Usage:
 *   npx tsx packages/kbot/src/integrations/install-remote-script.ts
 *   kbot ableton install-bridge
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const SCRIPT_NAME = 'KBotBridge'

const SOURCE_FILES = [
  '__init__.py',
  'kbot_control_surface.py',
  'tcp_server.py',
]

function getRemoteScriptsDir(): string {
  const home = os.homedir()
  return path.join(home, 'Music', 'Ableton', 'User Library', 'Remote Scripts')
}

function getDestDir(): string {
  return path.join(getRemoteScriptsDir(), SCRIPT_NAME)
}

function getSourceDir(): string {
  // Source files live alongside this installer in the integrations directory
  return path.join(__dirname, SCRIPT_NAME)
}

export async function installKBotBridge(): Promise<string> {
  const lines: string[] = []
  const log = (msg: string) => { lines.push(msg); console.log(msg) }

  log('Installing KBotBridge Remote Script...')
  log('')

  const sourceDir = getSourceDir()
  const destDir = getDestDir()
  const remoteScriptsDir = getRemoteScriptsDir()

  // Verify source files exist
  for (const file of SOURCE_FILES) {
    const srcPath = path.join(sourceDir, file)
    if (!fs.existsSync(srcPath)) {
      log(`  ERROR: Source file missing: ${srcPath}`)
      log('  Run from the kbot package directory.')
      return lines.join('\n')
    }
  }

  // Create Remote Scripts directory if it doesn't exist
  if (!fs.existsSync(remoteScriptsDir)) {
    fs.mkdirSync(remoteScriptsDir, { recursive: true })
    log(`  Created: ${remoteScriptsDir}`)
  }

  // Remove old installation if present
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true })
    log('  Removed previous KBotBridge installation')
  }

  // Copy files
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of SOURCE_FILES) {
    const src = path.join(sourceDir, file)
    const dst = path.join(destDir, file)
    fs.copyFileSync(src, dst)
    log(`  Copied: ${file}`)
  }

  // Create logs directory (the script will log here)
  const logsDir = path.join(destDir, 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  log('')
  log(`KBotBridge installed to: ${destDir}`)
  log('')
  log('To activate:')
  log('  1. Open Ableton Live (or restart if already running)')
  log('  2. Preferences (Cmd+,) > Link, Tempo & MIDI')
  log('  3. Set a Control Surface slot to "KBotBridge"')
  log('  4. Input/Output can be left as "None"')
  log('  5. Close Preferences')
  log('')
  log('Verify:')
  log('  - Ableton status bar shows "KBotBridge: Listening on port 9998"')
  log('  - Run: echo \'{"id":1,"action":"ping"}\\n\' | nc localhost 9998')
  log('')
  log('KBotBridge runs alongside AbletonOSC — they use different ports:')
  log('  - KBotBridge: TCP 9998 (Browser API, device loading)')
  log('  - M4L Bridge: TCP 9999 (LOM access, clips, mixing)')
  log('  - AbletonOSC: UDP 11000/11001 (OSC, legacy)')

  return lines.join('\n')
}

export function isKBotBridgeInstalled(): boolean {
  const destDir = getDestDir()
  return fs.existsSync(path.join(destDir, '__init__.py'))
    && fs.existsSync(path.join(destDir, 'kbot_control_surface.py'))
    && fs.existsSync(path.join(destDir, 'tcp_server.py'))
}

export function uninstallKBotBridge(): string {
  const destDir = getDestDir()
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true })
    return `KBotBridge removed from ${destDir}`
  }
  return 'KBotBridge was not installed.'
}

/**
 * Get the path to the KBotBridge log file inside Ableton's Remote Scripts.
 */
export function getKBotBridgeLogPath(): string | null {
  const logPath = path.join(getDestDir(), 'logs', 'kbot_bridge.log')
  return fs.existsSync(logPath) ? logPath : null
}

// ── CLI entrypoint ──────────────────────────────────────────────────

if (require.main === module || process.argv[1]?.includes('install-remote-script')) {
  installKBotBridge().catch(console.error)
}
