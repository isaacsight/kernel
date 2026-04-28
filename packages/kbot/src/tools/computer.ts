// kbot Computer Use — Full desktop control with safety guardrails
//
// Capabilities: screenshot, click, type, scroll, drag, key combos,
//   app launch/focus, window management (list/resize/move/minimize)
//
// Safety: per-app sub-locks via the Coordinator (parallel multi-agent),
//   per-app session approval, terminal excluded from screenshots,
//   permission check flow.
//
// Requires explicit opt-in via --computer-use flag.
// macOS: AppleScript + screencapture + cliclick fallback
// Linux: xdotool + import/gnome-screenshot

import { execSync, exec } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { registerTool } from './index.js'
import { Coordinator } from '../computer-use-coordinator.js'

const platform = process.platform
const LOCK_DIR = join(homedir(), '.kbot')
// Legacy single-session lock path. Retained as a constant for back-compat
// with any callers that referenced it; the actual locking is now performed
// per-app via the Coordinator.
const LOCK_FILE = join(LOCK_DIR, 'computer-use.lock')

// ── Session state ──────────────────────────────────────────────────

/** Apps approved for this session */
const approvedApps = new Set<string>()

/** Whether permissions have been verified this session */
let permissionsVerified = false

/** Legacy single-session "lock held" flag — kept so computer_check / screen_info
 *  can still report something meaningful. The real locking is the Coordinator. */
let lockHeld = false

// ── Coordinator (per-app sub-locks) ────────────────────────────────

/** Stable agent id for this kbot process. Override with KBOT_COMPUTER_USE_AGENT_ID
 *  for deterministic tests / multi-process coordination. */
const AGENT_ID: string = process.env.KBOT_COMPUTER_USE_AGENT_ID || randomUUID()

/** Module-scoped coordinator. Lock files live on disk under
 *  ~/.kbot/computer-use/<app>.lock, so even if other processes have their own
 *  Coordinator instance, they'll see each other's locks. */
const coordinator = new Coordinator()

/** Format a Coordinator denial as a single error string. */
function formatDenied(app: string, heldBy: string | undefined, since: number | undefined): string {
  const sinceStr = since ? new Date(since).toISOString() : 'unknown'
  return `computer_use: app '${app}' is held by ${heldBy ?? 'unknown'} since ${sinceStr} — wait or unregister that agent.`
}

/** Acquire a per-app claim. Returns an error string on denial, or null on success.
 *  When `app` is undefined (legacy callers that didn't specify an app), falls
 *  back to the single-session legacy behaviour: just mark `lockHeld = true` and
 *  let any prior global lock file get cleaned up.
 *
 *  App names are normalised to lowercase for the Coordinator so that
 *  `Ableton` and `ableton` collide on the same lock file. */
function claimApp(app: string | undefined): string | null {
  if (!app) {
    // Legacy single-lock fallback — don't break existing scripts that call a
    // tool without specifying an app. We still set lockHeld so screen_info /
    // computer_check report sane state.
    if (!existsSync(LOCK_DIR)) mkdirSync(LOCK_DIR, { recursive: true })
    lockHeld = true
    return null
  }

  const key = app.toLowerCase()

  // Make sure this agent is registered for the app before claiming.
  if (!approvedApps.has(key)) {
    return `Error: ${app} is not approved. Call app_approve first.`
  }
  // Re-register so the coordinator knows about the (possibly new) app.
  coordinator.register(AGENT_ID, { apps: [...approvedApps] })

  const result = coordinator.claim(AGENT_ID, key)
  if (!result.granted) {
    return formatDenied(app, result.heldBy, result.since)
  }
  lockHeld = true
  return null
}

/** Release a per-app claim. Safe to call when nothing was claimed. */
function releaseApp(app: string | undefined): void {
  if (!app) return
  try { coordinator.release(AGENT_ID, app.toLowerCase()) } catch { /* best effort */ }
}

// Clean up any locks held by this process on exit.
const cleanupOnExit = () => {
  try { coordinator.unregister(AGENT_ID) } catch { /* best effort */ }
  try { if (existsSync(LOCK_FILE)) rmSync(LOCK_FILE) } catch { /* best effort */ }
}
process.on('exit', cleanupOnExit)
process.on('SIGINT', cleanupOnExit)
process.on('SIGTERM', cleanupOnExit)

// ── Legacy lock helpers (kept as no-op stubs for back-compat) ──────

/** @deprecated kept for back-compat — Coordinator handles locking now. */
function acquireLock(): string | null {
  if (!existsSync(LOCK_DIR)) mkdirSync(LOCK_DIR, { recursive: true })
  lockHeld = true
  return null
}

/** @deprecated kept for back-compat — Coordinator handles locking now. */
function releaseLock(): void {
  if (lockHeld) {
    try { if (existsSync(LOCK_FILE)) rmSync(LOCK_FILE) } catch { /* best effort */ }
    lockHeld = false
  }
}

// ── macOS permission checks ────────────────────────────────────────

function checkMacOSPermissions(): { accessibility: boolean; screenRecording: boolean } {
  if (platform !== 'darwin') return { accessibility: true, screenRecording: true }

  let accessibility = false
  let screenRecording = false

  // Check Accessibility — try a benign System Events query
  try {
    execSync(`osascript -e 'tell application "System Events" to get name of first process'`, {
      timeout: 5_000, stdio: 'pipe',
    })
    accessibility = true
  } catch { /* not granted */ }

  // Check Screen Recording — try a screencapture and check if it's blocked
  try {
    const testPath = join(tmpdir(), `kbot-perm-test-${Date.now()}.png`)
    execSync(`screencapture -x ${testPath}`, { timeout: 5_000, stdio: 'pipe' })
    if (existsSync(testPath)) {
      const size = readFileSync(testPath).length
      unlinkSync(testPath)
      // A very small file (< 1KB) usually means screen recording was denied
      screenRecording = size > 1000
    }
  } catch { /* not granted */ }

  return { accessibility, screenRecording }
}

function formatPermissionGuide(perms: { accessibility: boolean; screenRecording: boolean }): string {
  const lines: string[] = ['macOS permissions needed for computer use:\n']

  if (!perms.accessibility) {
    lines.push('  Accessibility (required for click, type, scroll):')
    lines.push('    System Settings > Privacy & Security > Accessibility')
    lines.push('    Add your terminal app (Terminal, iTerm2, Warp, etc.)\n')
  }

  if (!perms.screenRecording) {
    lines.push('  Screen Recording (required for screenshots):')
    lines.push('    System Settings > Privacy & Security > Screen Recording')
    lines.push('    Add your terminal app\n')
  }

  lines.push('After granting permissions, restart kbot.')
  return lines.join('\n')
}

/** Verify permissions once per session */
function ensurePermissions(): string | null {
  if (permissionsVerified) return null

  if (platform === 'darwin') {
    const perms = checkMacOSPermissions()
    if (!perms.accessibility || !perms.screenRecording) {
      return `Error: ${formatPermissionGuide(perms)}`
    }
  } else if (platform === 'linux') {
    // Check for xdotool
    try {
      execSync('which xdotool', { stdio: 'pipe' })
    } catch {
      return 'Error: Computer use on Linux requires xdotool. Install with: sudo apt install xdotool'
    }
  } else {
    return 'Error: Computer use is only supported on macOS and Linux.'
  }

  permissionsVerified = true
  return null
}

/** Ensure base lock dir exists. Per-app claims are handled by claimApp(). */
function ensureLock(): string | null {
  if (!existsSync(LOCK_DIR)) mkdirSync(LOCK_DIR, { recursive: true })
  lockHeld = true
  return null
}

// ── App approval system ────────────────────────────────────────────

/** Apps with elevated access warnings */
const SENSITIVE_APPS: Record<string, string> = {
  'Terminal': 'Equivalent to shell access',
  'iTerm2': 'Equivalent to shell access',
  'iTerm': 'Equivalent to shell access',
  'Warp': 'Equivalent to shell access',
  'Visual Studio Code': 'Equivalent to shell access',
  'Code': 'Equivalent to shell access',
  'Cursor': 'Equivalent to shell access',
  'Finder': 'Can read or write any file',
  'System Settings': 'Can change system settings',
  'System Preferences': 'Can change system settings',
}

function isAppApproved(appName: string): boolean {
  return approvedApps.has(appName.toLowerCase())
}

function approveApp(appName: string): void {
  approvedApps.add(appName.toLowerCase())
}

function getApprovedApps(): string[] {
  return [...approvedApps]
}

// ── AppleScript helpers ────────────────────────────────────────────

/** Escape a string for safe use inside AppleScript double quotes */
function escapeAppleScript(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Run an AppleScript one-liner, return stdout */
function osascript(script: string, timeout = 5_000): string {
  return execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
    encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

/** Get the frontmost app name */
function getFrontmostApp(): string {
  if (platform === 'darwin') {
    try {
      return osascript('tell application "System Events" to get name of first application process whose frontmost is true')
    } catch { return 'unknown' }
  }
  if (platform === 'linux') {
    try {
      const wid = execSync('xdotool getactivewindow', { encoding: 'utf-8', stdio: 'pipe' }).trim()
      return execSync(`xdotool getwindowname ${wid}`, { encoding: 'utf-8', stdio: 'pipe' }).trim()
    } catch { return 'unknown' }
  }
  return 'unknown'
}

// ── Tool registration ──────────────────────────────────────────────

export function registerComputerTools(): void {
  // ── Permission & lock check ──

  registerTool({
    name: 'computer_check',
    deprecated: true,
    description: 'Check computer use permissions and acquire the session lock. Call this before any other computer use tool. Returns permission status and any required setup steps.',
    parameters: {},
    tier: 'free',
    async execute() {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const permErr = ensurePermissions()
      if (permErr) return permErr

      const approvedList = getApprovedApps()
      const coordStatus = coordinator.status()
      return [
        'Computer use ready.',
        `Platform: ${platform}`,
        `Agent ID: ${AGENT_ID}`,
        `Approved apps: ${approvedList.length > 0 ? approvedList.join(', ') : 'none yet (use app_approve to approve apps)'}`,
        `Coordinator: ${JSON.stringify(coordStatus)}`,
      ].join('\n')
    },
  })

  // ── App approval ──

  registerTool({
    name: 'app_approve',
    deprecated: true,
    description: 'Approve an app for computer use in this session. Must be called before interacting with an app. Shows a warning for sensitive apps (terminals, Finder, System Settings).',
    parameters: {
      app: { type: 'string', description: 'App name (e.g., "Safari", "Finder", "Xcode")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const app = String(args.app)
      if (isAppApproved(app)) return `${app} is already approved for this session.`

      const warning = SENSITIVE_APPS[app]
      let result = ''
      if (warning) {
        result += `Warning: ${app} — ${warning}\n`
      }

      approveApp(app)
      // Re-register with the coordinator so it knows this agent intends to
      // drive the newly-approved app.
      try {
        coordinator.register(AGENT_ID, { apps: [...approvedApps] })
      } catch (err) {
        return `${result}Approved ${app} but coordinator registration failed: ${err instanceof Error ? err.message : String(err)}`
      }
      result += `Approved ${app} for this session.`
      return result
    },
  })

  registerTool({
    name: 'app_list_approved',
    description: 'List all apps approved for computer use in this session.',
    parameters: {},
    tier: 'free',
    async execute() {
      const apps = getApprovedApps()
      if (apps.length === 0) return 'No apps approved yet. Use app_approve to approve apps.'
      return `Approved apps:\n${apps.map(a => `  - ${a}`).join('\n')}`
    },
  })

  // ── App launch & focus ──

  registerTool({
    name: 'app_launch',
    description: 'Launch or focus a macOS/Linux application. Brings the app to the foreground. App must be approved first.',
    parameters: {
      app: { type: 'string', description: 'App name (e.g., "Safari", "Xcode", "Ableton Live")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const app = String(args.app)
      if (!isAppApproved(app)) {
        return `Error: ${app} is not approved. Call app_approve first.`
      }

      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
        if (platform === 'darwin') {
          try {
            osascript(`tell application "${escapeAppleScript(app)}" to activate`)
            // Wait a beat for the app to come forward
            await new Promise(r => setTimeout(r, 500))
            return `Launched/focused: ${app}`
          } catch (err) {
            return `Error launching ${app}: ${err instanceof Error ? err.message : String(err)}`
          }
        } else if (platform === 'linux') {
          try {
            execSync(`wmctrl -a "${app}" 2>/dev/null || xdg-open "${app}" 2>/dev/null`, {
              timeout: 10_000, stdio: 'pipe',
            })
            return `Launched/focused: ${app}`
          } catch {
            return `Error: Could not launch ${app}. Ensure it's installed.`
          }
        }
        return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Screenshot ──

  registerTool({
    name: 'screenshot',
    description: 'Capture a screenshot of the screen or a specific app window. Returns base64-encoded PNG image data. The terminal window is excluded on macOS.',
    parameters: {
      window: { type: 'string', description: 'Window title to capture (optional — captures full screen if omitted)' },
      region: { type: 'string', description: 'Capture region as "x,y,w,h" (optional)' },
      // Optional `app` enables Coordinator per-app locking. When omitted we
      // fall back to the legacy single-lock path so existing scripts work.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      const tmpPath = join(tmpdir(), `kbot-screenshot-${Date.now()}.png`)

      try {
        if (platform === 'darwin') {
          if (args.region) {
            // Capture a specific region
            const [x, y, w, h] = String(args.region).split(',').map(Number)
            if ([x, y, w, h].some(isNaN)) return 'Error: region must be "x,y,w,h" (numbers)'
            execSync(`screencapture -x -R${x},${y},${w},${h} ${tmpPath}`, { timeout: 10_000 })
          } else if (args.window) {
            // Capture a specific window by title
            const windowTitle = String(args.window)
            try {
              // Get the window ID via AppleScript
              const windowId = osascript(
                `tell application "System Events" to get id of first window of process "${escapeAppleScript(windowTitle)}" whose name contains "${escapeAppleScript(windowTitle)}"`,
                5000,
              )
              execSync(`screencapture -x -l${windowId} ${tmpPath}`, { timeout: 10_000 })
            } catch {
              // Fallback: full screen capture
              execSync(`screencapture -x ${tmpPath}`, { timeout: 10_000 })
            }
          } else {
            execSync(`screencapture -x ${tmpPath}`, { timeout: 10_000 })
          }
        } else if (platform === 'linux') {
          if (args.window) {
            try {
              execSync(`import -window "${String(args.window)}" ${tmpPath}`, { timeout: 10_000 })
            } catch {
              execSync(`gnome-screenshot -f ${tmpPath}`, { timeout: 10_000 })
            }
          } else {
            try {
              execSync(`import -window root ${tmpPath}`, { timeout: 10_000 })
            } catch {
              execSync(`gnome-screenshot -f ${tmpPath}`, { timeout: 10_000 })
            }
          }
        } else {
          return 'Error: Computer use not supported on this platform'
        }

        if (!existsSync(tmpPath)) return 'Error: Screenshot failed — no file produced'

        const buffer = readFileSync(tmpPath)
        unlinkSync(tmpPath)

        if (buffer.length < 500) return 'Error: Screenshot appears to be blank. Check Screen Recording permissions.'

        const base64 = buffer.toString('base64')
        return JSON.stringify({
          type: 'image',
          format: 'png',
          size_bytes: buffer.length,
          width_hint: 'full screen',
          base64,
        })
      } catch (err) {
        return `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Mouse click ──

  registerTool({
    name: 'mouse_click',
    deprecated: true,
    description: 'Click at specific screen coordinates.',
    parameters: {
      x: { type: 'number', description: 'X coordinate', required: true },
      y: { type: 'number', description: 'Y coordinate', required: true },
      button: { type: 'string', description: 'Mouse button: left, right, double (default: left)' },
      // Optional `app` enables per-app coordination so multiple agents can
      // drive different apps in parallel. Omit for legacy single-lock fallback.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      const x = Math.round(Number(args.x))
      const y = Math.round(Number(args.y))
      const button = String(args.button || 'left').toLowerCase()

      if (isNaN(x) || isNaN(y)) {
        releaseApp(app)
        return 'Error: x and y must be numbers'
      }

      try {

      if (platform === 'darwin') {
        try {
          if (button === 'double') {
            // Double click
            try {
              execSync(`cliclick dc:${x},${y}`, { timeout: 5_000, stdio: 'pipe' })
            } catch {
              osascript(`tell application "System Events" to click at {${x}, ${y}}`)
              await new Promise(r => setTimeout(r, 100))
              osascript(`tell application "System Events" to click at {${x}, ${y}}`)
            }
          } else if (button === 'right') {
            try {
              execSync(`cliclick rc:${x},${y}`, { timeout: 5_000, stdio: 'pipe' })
            } catch {
              osascript(`tell application "System Events" to click at {${x}, ${y}} using control down`)
            }
          } else {
            try {
              execSync(`cliclick c:${x},${y}`, { timeout: 5_000, stdio: 'pipe' })
            } catch {
              osascript(`tell application "System Events" to click at {${x}, ${y}}`)
            }
          }
          return `Clicked ${button} at (${x}, ${y})`
        } catch (err) {
          return `Click failed: ${err instanceof Error ? err.message : String(err)}`
        }
      } else if (platform === 'linux') {
        try {
          const btn = button === 'right' ? 3 : button === 'double' ? '--repeat 2 1' : '1'
          execSync(`xdotool mousemove ${x} ${y} click ${btn}`, { timeout: 5_000 })
          return `Clicked ${button} at (${x}, ${y})`
        } catch {
          return 'Error: Click requires xdotool (apt install xdotool)'
        }
      }
      return 'Error: Unsupported platform'

      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Mouse scroll ──

  registerTool({
    name: 'mouse_scroll',
    description: 'Scroll the mouse wheel at current position or specific coordinates.',
    parameters: {
      direction: { type: 'string', description: 'Scroll direction: up, down, left, right', required: true },
      amount: { type: 'number', description: 'Scroll amount in clicks (default: 3)' },
      x: { type: 'number', description: 'X coordinate to scroll at (optional — uses current position)' },
      y: { type: 'number', description: 'Y coordinate to scroll at (optional)' },
      // Optional `app` enables Coordinator per-app locking. Omit for legacy fallback.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
      const direction = String(args.direction).toLowerCase()
      const amount = Math.round(Number(args.amount) || 3)

      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        return 'Error: direction must be up, down, left, or right'
      }

      // Move mouse first if coordinates given
      if (args.x !== undefined && args.y !== undefined) {
        const x = Math.round(Number(args.x))
        const y = Math.round(Number(args.y))
        if (platform === 'darwin') {
          try { execSync(`cliclick m:${x},${y}`, { timeout: 3_000, stdio: 'pipe' }) }
          catch { /* best effort move */ }
        } else if (platform === 'linux') {
          try { execSync(`xdotool mousemove ${x} ${y}`, { timeout: 3_000, stdio: 'pipe' }) }
          catch { /* best effort move */ }
        }
      }

      if (platform === 'darwin') {
        try {
          // cliclick scroll: positive = up, negative = down
          const scrollDir = direction === 'up' ? amount : direction === 'down' ? -amount : 0
          if (direction === 'up' || direction === 'down') {
            try {
              execSync(`cliclick "ku:${scrollDir > 0 ? `+${scrollDir}` : scrollDir}"`, { timeout: 5_000, stdio: 'pipe' })
            } catch {
              // Fallback to AppleScript scroll
              const scrollAmount = direction === 'up' ? -amount : amount
              osascript(`tell application "System Events" to scroll area 1 by ${scrollAmount}`)
            }
          } else {
            // Horizontal scroll via AppleScript
            const horiz = direction === 'left' ? -amount : amount
            osascript(`tell application "System Events" to scroll area 1 by ${horiz}`)
          }
          return `Scrolled ${direction} by ${amount}`
        } catch (err) {
          return `Scroll failed: ${err instanceof Error ? err.message : String(err)}`
        }
      } else if (platform === 'linux') {
        try {
          // xdotool: button 4=up, 5=down, 6=left, 7=right
          const buttonMap: Record<string, number> = { up: 4, down: 5, left: 6, right: 7 }
          const btn = buttonMap[direction]
          execSync(`xdotool click --repeat ${amount} ${btn}`, { timeout: 5_000 })
          return `Scrolled ${direction} by ${amount}`
        } catch {
          return 'Error: Scroll requires xdotool'
        }
      }
      return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Mouse drag ──

  registerTool({
    name: 'mouse_drag',
    description: 'Drag from one screen position to another (click and hold, move, release).',
    parameters: {
      from_x: { type: 'number', description: 'Start X coordinate', required: true },
      from_y: { type: 'number', description: 'Start Y coordinate', required: true },
      to_x: { type: 'number', description: 'End X coordinate', required: true },
      to_y: { type: 'number', description: 'End Y coordinate', required: true },
      duration_ms: { type: 'number', description: 'Drag duration in milliseconds (default: 500)' },
      // Optional `app` enables Coordinator per-app locking. Omit for legacy fallback.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
      const fx = Math.round(Number(args.from_x))
      const fy = Math.round(Number(args.from_y))
      const tx = Math.round(Number(args.to_x))
      const ty = Math.round(Number(args.to_y))

      if ([fx, fy, tx, ty].some(isNaN)) return 'Error: All coordinates must be numbers'

      if (platform === 'darwin') {
        try {
          try {
            execSync(`cliclick dd:${fx},${fy} du:${tx},${ty}`, { timeout: 10_000, stdio: 'pipe' })
          } catch {
            // Fallback: AppleScript mouse down, move, mouse up
            osascript(`
              tell application "System Events"
                set mouseLocation to {${fx}, ${fy}}
                click at mouseLocation
              end tell
            `.trim(), 10_000)
          }
          return `Dragged from (${fx},${fy}) to (${tx},${ty})`
        } catch (err) {
          return `Drag failed: ${err instanceof Error ? err.message : String(err)}`
        }
      } else if (platform === 'linux') {
        try {
          execSync(
            `xdotool mousemove ${fx} ${fy} mousedown 1 mousemove --sync ${tx} ${ty} mouseup 1`,
            { timeout: 10_000 },
          )
          return `Dragged from (${fx},${fy}) to (${tx},${ty})`
        } catch {
          return 'Error: Drag requires xdotool'
        }
      }
      return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Keyboard type ──

  registerTool({
    name: 'keyboard_type',
    description: 'Type text using the keyboard. Types each character as if pressed by the user.',
    parameters: {
      text: { type: 'string', description: 'Text to type', required: true },
      // Optional `app` enables Coordinator per-app locking. Omit for legacy fallback.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
        const text = String(args.text)
        if (!text) return 'Error: text is required'

        if (platform === 'darwin') {
          const escaped = escapeAppleScript(text)
          try {
            osascript(`tell application "System Events" to keystroke "${escaped}"`, 10_000)
            return `Typed: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`
          } catch {
            return 'Error: Typing requires Accessibility permissions'
          }
        } else if (platform === 'linux') {
          try {
            execSync(`xdotool type -- "${text.replace(/"/g, '\\"')}"`, { timeout: 10_000 })
            return `Typed: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`
          } catch {
            return 'Error: Typing requires xdotool'
          }
        }
        return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Keyboard key ──

  registerTool({
    name: 'keyboard_key',
    description: 'Press a key or key combination. Supports modifiers: cmd/ctrl/alt/shift + key.',
    parameters: {
      key: { type: 'string', description: 'Key: enter, tab, escape, space, backspace, delete, up, down, left, right, cmd+c, ctrl+v, cmd+shift+s, etc.', required: true },
      // Optional `app` enables Coordinator per-app locking. Omit for legacy fallback.
      app: { type: 'string', description: 'App being targeted, for parallel-agent coordination (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const lockErr = ensureLock()
      if (lockErr) return `Error: ${lockErr}`

      const app = args.app ? String(args.app) : undefined
      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
      const key = String(args.key).toLowerCase()

      if (platform === 'darwin') {
        // Key code map for non-character keys
        const keyCodeMap: Record<string, number> = {
          enter: 36, return: 36, tab: 48, escape: 53, space: 49,
          backspace: 51, delete: 117, up: 126, down: 125, left: 123, right: 124,
          home: 115, end: 119, pageup: 116, pagedown: 121,
          f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
          f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
        }

        try {
          if (key.includes('+')) {
            const parts = key.split('+')
            const mainKey = parts.pop()!
            const modifiers = parts.map(m => {
              if (m === 'cmd' || m === 'command') return 'command down'
              if (m === 'ctrl' || m === 'control') return 'control down'
              if (m === 'alt' || m === 'option') return 'option down'
              if (m === 'shift') return 'shift down'
              return ''
            }).filter(Boolean).join(', ')

            const code = keyCodeMap[mainKey]
            if (code !== undefined) {
              osascript(`tell application "System Events" to key code ${code} using {${modifiers}}`)
            } else {
              osascript(`tell application "System Events" to keystroke "${escapeAppleScript(mainKey)}" using {${modifiers}}`)
            }
          } else {
            const code = keyCodeMap[key]
            if (code !== undefined) {
              osascript(`tell application "System Events" to key code ${code}`)
            } else {
              osascript(`tell application "System Events" to keystroke "${escapeAppleScript(key)}"`)
            }
          }
          return `Pressed: ${key}`
        } catch {
          return 'Error: Key press requires Accessibility permissions'
        }
      } else if (platform === 'linux') {
        try {
          // xdotool uses + for combos: ctrl+c, super+l, etc.
          const xdoKey = key.replace('cmd', 'super').replace('command', 'super')
          execSync(`xdotool key ${xdoKey}`, { timeout: 5_000 })
          return `Pressed: ${key}`
        } catch {
          return 'Error: Key press requires xdotool'
        }
      }
      return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Window management ──

  registerTool({
    name: 'window_list',
    description: 'List all visible windows with their titles, apps, positions, and sizes.',
    parameters: {},
    tier: 'free',
    async execute() {
      if (platform === 'darwin') {
        try {
          const script = `
            set output to ""
            tell application "System Events"
              set allProcs to every application process whose visible is true
              repeat with proc in allProcs
                set procName to name of proc
                try
                  set wins to every window of proc
                  repeat with win in wins
                    set winName to name of win
                    set {px, py} to position of win
                    set {sx, sy} to size of win
                    set output to output & procName & " | " & winName & " | pos:" & px & "," & py & " | size:" & sx & "x" & sy & linefeed
                  end repeat
                end try
              end repeat
            end tell
            return output
          `.trim().replace(/\n/g, '\n')
          const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
          }).trim()
          if (!result) return 'No visible windows found.'
          return `Windows:\n${result}`
        } catch (err) {
          return `Error listing windows: ${err instanceof Error ? err.message : String(err)}`
        }
      } else if (platform === 'linux') {
        try {
          const result = execSync('wmctrl -l -G', { encoding: 'utf-8', timeout: 5_000 }).trim()
          return result || 'No windows found. Requires wmctrl (apt install wmctrl).'
        } catch {
          return 'Error: Requires wmctrl (apt install wmctrl)'
        }
      }
      return 'Error: Unsupported platform'
    },
  })

  registerTool({
    name: 'window_resize',
    deprecated: true,
    description: 'Resize a window of a specific app.',
    parameters: {
      app: { type: 'string', description: 'App name', required: true },
      width: { type: 'number', description: 'New width in pixels', required: true },
      height: { type: 'number', description: 'New height in pixels', required: true },
    },
    tier: 'free',
    async execute(args) {
      const app = String(args.app)
      const w = Math.round(Number(args.width))
      const h = Math.round(Number(args.height))

      if (!isAppApproved(app)) return `Error: ${app} not approved. Call app_approve first.`
      if (isNaN(w) || isNaN(h)) return 'Error: width and height must be numbers'

      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
        if (platform === 'darwin') {
          try {
            osascript(`tell application "${escapeAppleScript(app)}" to set bounds of front window to {0, 0, ${w}, ${h}}`, 5_000)
            return `Resized ${app} to ${w}x${h}`
          } catch {
            // Fallback via System Events
            try {
              osascript(`tell application "System Events" to tell process "${escapeAppleScript(app)}" to set size of front window to {${w}, ${h}}`)
              return `Resized ${app} to ${w}x${h}`
            } catch (err) {
              return `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          }
        } else if (platform === 'linux') {
          try {
            execSync(`wmctrl -r "${app}" -e 0,-1,-1,${w},${h}`, { timeout: 5_000 })
            return `Resized ${app} to ${w}x${h}`
          } catch {
            return 'Error: Requires wmctrl'
          }
        }
        return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  registerTool({
    name: 'window_move',
    deprecated: true,
    description: 'Move a window to specific screen coordinates.',
    parameters: {
      app: { type: 'string', description: 'App name', required: true },
      x: { type: 'number', description: 'X position', required: true },
      y: { type: 'number', description: 'Y position', required: true },
    },
    tier: 'free',
    async execute(args) {
      const app = String(args.app)
      const x = Math.round(Number(args.x))
      const y = Math.round(Number(args.y))

      if (!isAppApproved(app)) return `Error: ${app} not approved. Call app_approve first.`

      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
        if (platform === 'darwin') {
          try {
            osascript(`tell application "System Events" to tell process "${escapeAppleScript(app)}" to set position of front window to {${x}, ${y}}`)
            return `Moved ${app} to (${x}, ${y})`
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        } else if (platform === 'linux') {
          try {
            execSync(`wmctrl -r "${app}" -e 0,${x},${y},-1,-1`, { timeout: 5_000 })
            return `Moved ${app} to (${x}, ${y})`
          } catch {
            return 'Error: Requires wmctrl'
          }
        }
        return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  registerTool({
    name: 'window_minimize',
    description: 'Minimize or restore a window.',
    parameters: {
      app: { type: 'string', description: 'App name', required: true },
      action: { type: 'string', description: 'minimize or restore (default: minimize)' },
    },
    tier: 'free',
    async execute(args) {
      const app = String(args.app)
      const action = String(args.action || 'minimize').toLowerCase()

      if (!isAppApproved(app)) return `Error: ${app} not approved. Call app_approve first.`

      const claimErr = claimApp(app)
      if (claimErr) return `Error: ${claimErr}`

      try {
        if (platform === 'darwin') {
          try {
            if (action === 'restore') {
              osascript(`tell application "${escapeAppleScript(app)}" to activate`)
            } else {
              osascript(`tell application "System Events" to tell process "${escapeAppleScript(app)}" to set miniaturized of front window to true`)
            }
            return `${action === 'restore' ? 'Restored' : 'Minimized'} ${app}`
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        } else if (platform === 'linux') {
          try {
            if (action === 'restore') {
              execSync(`wmctrl -r "${app}" -b remove,hidden`, { timeout: 5_000 })
            } else {
              execSync(`xdotool search --name "${app}" windowminimize`, { timeout: 5_000 })
            }
            return `${action === 'restore' ? 'Restored' : 'Minimized'} ${app}`
          } catch {
            return 'Error: Requires wmctrl/xdotool'
          }
        }
        return 'Error: Unsupported platform'
      } finally {
        releaseApp(app)
      }
    },
  })

  // ── Screen info ──

  registerTool({
    name: 'screen_info',
    description: 'Get screen resolution, mouse position, and frontmost app.',
    parameters: {},
    tier: 'free',
    async execute() {
      const info: string[] = []

      if (platform === 'darwin') {
        try {
          const resolution = execSync(`system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution | head -1`, {
            encoding: 'utf-8', timeout: 5_000,
          }).trim()
          info.push(`Display: ${resolution || 'unknown'}`)
        } catch { info.push('Display: unknown') }

        try {
          const mousePos = osascript('tell application "System Events" to get position of mouse')
          info.push(`Mouse: ${mousePos}`)
        } catch {
          // cliclick fallback
          try {
            const pos = execSync('cliclick p', { encoding: 'utf-8', timeout: 3_000, stdio: 'pipe' }).trim()
            info.push(`Mouse: ${pos}`)
          } catch { info.push('Mouse: unknown') }
        }

        info.push(`Frontmost: ${getFrontmostApp()}`)
      } else if (platform === 'linux') {
        try {
          const res = execSync('xdpyinfo | grep dimensions | head -1', { encoding: 'utf-8', timeout: 5_000 }).trim()
          info.push(`Display: ${res}`)
        } catch { info.push('Display: unknown') }

        try {
          const pos = execSync('xdotool getmouselocation', { encoding: 'utf-8', timeout: 3_000 }).trim()
          info.push(`Mouse: ${pos}`)
        } catch { info.push('Mouse: unknown') }

        info.push(`Frontmost: ${getFrontmostApp()}`)
      }

      info.push(`Platform: ${platform}`)
      info.push(`Lock: ${lockHeld ? 'held' : 'not held'}`)
      info.push(`Approved apps: ${getApprovedApps().join(', ') || 'none'}`)

      return info.join('\n')
    },
  })

  // ── Release lock ──

  registerTool({
    name: 'computer_release',
    deprecated: true,
    description: 'Release the computer use lock and end the session. Call when done with computer use.',
    parameters: {},
    tier: 'free',
    async execute() {
      let released: string[] = []
      try {
        released = coordinator.unregister(AGENT_ID)
      } catch { /* best effort */ }
      releaseLock()
      approvedApps.clear()
      permissionsVerified = false
      const releasedNote = released.length > 0
        ? ` Released app locks: ${released.join(', ')}.`
        : ''
      return `Computer use session ended.${releasedNote}`
    },
  })
}
