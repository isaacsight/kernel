// K:BOT Computer Use Tool — Screenshot, click, type on the desktop
// Requires explicit opt-in via --computer-use flag.
// Uses native OS commands (screencapture on macOS, etc.)

import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, unlinkSync } from 'node:fs'
import { registerTool } from './index.js'

const platform = process.platform

export function registerComputerTools(): void {
  registerTool({
    name: 'screenshot',
    description: 'Capture a screenshot of the entire screen. Returns base64-encoded PNG. Requires --computer-use flag.',
    parameters: {},
    tier: 'free',
    async execute() {
      const tmpPath = join(tmpdir(), `kbot-screenshot-${Date.now()}.png`)

      try {
        if (platform === 'darwin') {
          execSync(`screencapture -x ${tmpPath}`, { timeout: 10_000 })
        } else if (platform === 'linux') {
          // Try various screenshot tools
          try {
            execSync(`import -window root ${tmpPath}`, { timeout: 10_000 })
          } catch {
            execSync(`gnome-screenshot -f ${tmpPath}`, { timeout: 10_000 })
          }
        } else {
          return 'Error: Computer use not supported on this platform'
        }

        const buffer = readFileSync(tmpPath)
        unlinkSync(tmpPath)
        return `Screenshot captured (${buffer.length} bytes). Base64 preview: ${buffer.toString('base64').slice(0, 100)}...`
      } catch (err) {
        return `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'mouse_click',
    description: 'Click at specific screen coordinates. Requires --computer-use flag.',
    parameters: {
      x: { type: 'number', description: 'X coordinate', required: true },
      y: { type: 'number', description: 'Y coordinate', required: true },
      button: { type: 'string', description: 'Mouse button: left, right, middle (default: left)' },
    },
    tier: 'free',
    async execute(args) {
      const x = Number(args.x)
      const y = Number(args.y)
      const button = args.button === 'right' ? 2 : 1

      if (platform === 'darwin') {
        // Use AppleScript for mouse control on macOS
        const script = button === 1
          ? `tell application "System Events" to click at {${x}, ${y}}`
          : `tell application "System Events" to click at {${x}, ${y}} using control down`
        try {
          execSync(`osascript -e '${script}'`, { timeout: 5_000 })
          return `Clicked at (${x}, ${y})`
        } catch {
          // Fallback to cliclick if available
          try {
            execSync(`cliclick c:${x},${y}`, { timeout: 5_000 })
            return `Clicked at (${x}, ${y})`
          } catch {
            return 'Error: Mouse click requires cliclick (brew install cliclick) or accessibility permissions'
          }
        }
      } else if (platform === 'linux') {
        try {
          execSync(`xdotool mousemove ${x} ${y} click ${button}`, { timeout: 5_000 })
          return `Clicked at (${x}, ${y})`
        } catch {
          return 'Error: Mouse click requires xdotool (apt install xdotool)'
        }
      }
      return 'Error: Computer use not supported on this platform'
    },
  })

  registerTool({
    name: 'keyboard_type',
    description: 'Type text using the keyboard. Requires --computer-use flag.',
    parameters: {
      text: { type: 'string', description: 'Text to type', required: true },
    },
    tier: 'free',
    async execute(args) {
      const text = String(args.text)

      if (platform === 'darwin') {
        // Escape for AppleScript — strip control chars, escape backslashes and quotes
        const escaped = text.replace(/[\x00-\x1f\x7f]/g, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "'\\''")
        try {
          execSync(`osascript -e 'tell application "System Events" to keystroke "` + escaped + `"'`, { timeout: 10_000 })
          return `Typed: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`
        } catch {
          return 'Error: Typing requires accessibility permissions'
        }
      } else if (platform === 'linux') {
        try {
          execSync(`xdotool type -- "${text.replace(/"/g, '\\"')}"`, { timeout: 10_000 })
          return `Typed: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`
        } catch {
          return 'Error: Typing requires xdotool'
        }
      }
      return 'Error: Computer use not supported on this platform'
    },
  })

  registerTool({
    name: 'keyboard_key',
    description: 'Press a specific key or key combination. Requires --computer-use flag.',
    parameters: {
      key: { type: 'string', description: 'Key name: enter, tab, escape, space, backspace, cmd+c, ctrl+v, etc.', required: true },
    },
    tier: 'free',
    async execute(args) {
      const key = String(args.key).toLowerCase()

      if (platform === 'darwin') {
        // Map common keys to AppleScript key codes
        const keyMap: Record<string, string> = {
          enter: 'return', tab: 'tab', escape: 'escape 53',
          space: 'space', backspace: 'delete', delete: 'forward delete',
        }
        const mapped = keyMap[key] || key

        try {
          if (key.includes('+')) {
            // Key combination: cmd+c → keystroke "c" using command down
            const parts = key.split('+')
            const mainKey = parts.pop()!
            const modifiers = parts.map(m => {
              if (m === 'cmd' || m === 'command') return 'command down'
              if (m === 'ctrl' || m === 'control') return 'control down'
              if (m === 'alt' || m === 'option') return 'option down'
              if (m === 'shift') return 'shift down'
              return ''
            }).filter(Boolean).join(', ')
            execSync(`osascript -e 'tell application "System Events" to keystroke "${mainKey}" using {${modifiers}}'`, { timeout: 5_000 })
          } else {
            execSync(`osascript -e 'tell application "System Events" to key code ${mapped}'`, { timeout: 5_000 })
          }
          return `Pressed: ${key}`
        } catch {
          return 'Error: Key press requires accessibility permissions'
        }
      } else if (platform === 'linux') {
        try {
          execSync(`xdotool key ${key.replace('+', '+')}`, { timeout: 5_000 })
          return `Pressed: ${key}`
        } catch {
          return 'Error: Key press requires xdotool'
        }
      }
      return 'Error: Computer use not supported on this platform'
    },
  })
}
