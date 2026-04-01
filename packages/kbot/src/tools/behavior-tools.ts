// kbot Behavior Tools — Agent-accessible desktop behavior observation
//
// Exposes the user behavior system to kbot's tool system so agents can:
//   - Capture a behavior snapshot (what apps are open now)
//   - View behavior patterns from recent history
//
// macOS only. Privacy-conscious — app names and window titles only.
// No window contents, no screenshots, no keylogging.

import { registerTool } from './index.js'
import { captureUserBehavior, getBehaviorSummary } from '../user-behavior.js'

export function registerBehaviorTools(): void {

// ── behavior_snapshot ──
// Capture current desktop state

registerTool({
  name: 'behavior_snapshot',
  description: 'Capture a snapshot of the user\'s current desktop state: which apps are visible, which app is active (frontmost), the active window title, screen count, and whether Ollama is running. macOS only. Privacy-conscious — captures app names and window titles only, never window contents.',
  parameters: {},
  tier: 'free',
  timeout: 10_000, // 10s — osascript can be slow
  execute: async () => {
    const snapshot = captureUserBehavior()
    if (!snapshot) {
      return 'Behavior capture unavailable (macOS only, or osascript failed).'
    }

    const lines = [
      'Behavior Snapshot',
      `Time: ${snapshot.timestamp} (${snapshot.hour}:00, ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][snapshot.dayOfWeek]})`,
      `Active app: ${snapshot.activeApp || '(none)'}`,
      `Active window: ${snapshot.activeWindowTitle || '(none)'}`,
      `Screens: ${snapshot.screenCount}`,
      `Ollama running: ${snapshot.ollamaRunning ? 'yes' : 'no'}`,
      '',
      `Visible apps (${snapshot.visibleApps.length}):`,
      ...snapshot.visibleApps.map(a => `  - ${a}`),
    ]

    return lines.join('\n')
  },
})

// ── behavior_summary ──
// Show behavior patterns from recent history

registerTool({
  name: 'behavior_summary',
  description: 'Show user behavior patterns from recent history: most-used apps, active hours, app switching patterns, app combinations frequently seen together. Reads from stored snapshots. Use this to understand the user\'s workflow habits and desktop patterns.',
  parameters: {
    hours: {
      type: 'number',
      description: 'How many hours of history to analyze (default: 24, max: 168)',
      required: false,
      default: 24,
    },
  },
  tier: 'free',
  execute: async (args) => {
    const hours = Math.min((args.hours as number) || 24, 168)
    const summary = getBehaviorSummary(hours)

    if (!summary) {
      return 'No behavior data available yet. Snapshots are captured at the start of each kbot session. Use behavior_snapshot to capture one now.'
    }

    return summary.text
  },
})

} // end registerBehaviorTools
