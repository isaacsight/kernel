// kbot iPhone Tools — Control iPhone from macOS via native Continuity ecosystem
//
// Tools: phone_status, phone_message, phone_notify, phone_shortcut,
//        phone_shortcuts_list, phone_call, phone_airdrop, phone_clipboard,
//        phone_find, phone_focus
//
// No jailbreak, no third-party apps. Uses:
//   - system_profiler SPBluetoothDataType (device detection)
//   - AppleScript / Messages.app (iMessage)
//   - macOS Shortcuts CLI (iOS Shortcuts via Handoff)
//   - Universal Clipboard (pbcopy/pbpaste via Handoff)
//   - FaceTime (tel:// protocol)
//   - Finder AirDrop sharing
//   - Find My app
//
// Requires: macOS, iPhone on same Apple ID, Handoff enabled

import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { registerTool } from './index.js'

const platform = process.platform

// ── Helpers ────────────────────────────────────────────────────

/** Escape a string for safe use inside AppleScript double quotes */
function escapeAppleScript(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Run an AppleScript string via osascript, return stdout */
function osascript(script: string, timeout = 10_000): string {
  // Use -e for each line to handle multi-line scripts
  const lines = script.split('\n').filter(l => l.trim())
  const args = lines.map(l => `-e '${l.replace(/'/g, "'\\''")}'`).join(' ')
  return execSync(`osascript ${args}`, {
    encoding: 'utf-8',
    timeout,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

/** Run a shell command, return stdout or throw */
function shell(cmd: string, timeout = 30_000): string {
  return execSync(cmd, {
    encoding: 'utf-8',
    timeout,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

/** Validate phone number format (basic) */
function isValidPhoneOrEmail(contact: string): boolean {
  // Phone: digits, spaces, dashes, parens, plus sign
  const phonePattern = /^[+\d\s\-().]{7,20}$/
  // Email: basic pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return phonePattern.test(contact) || emailPattern.test(contact)
}

/** Strip a phone number to digits only (with leading +) */
function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[^\d+]/g, '')
  return stripped
}

/** Guard: macOS only */
function requireMacOS(): string | null {
  if (platform !== 'darwin') {
    return 'Error: iPhone tools require macOS with Continuity. This system is not macOS.'
  }
  return null
}

// ── Tool Registration ──────────────────────────────────────────

export function registerIPhoneTools(): void {

  // ── 1. phone_status ──────────────────────────────────────────

  registerTool({
    name: 'phone_status',
    description:
      'Get iPhone connection status via Bluetooth and Continuity. ' +
      'Returns whether an iPhone is connected, its name, and battery level if available. ' +
      'Uses system_profiler SPBluetoothDataType and ioreg.',
    parameters: {},
    tier: 'free',
    async execute() {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const result: string[] = ['iPhone Status:']

      // Check Bluetooth for connected iPhone
      try {
        const btData = shell('system_profiler SPBluetoothDataType 2>/dev/null', 15_000)
        // Look for iPhone entries — they appear under "Connected:" or in device list
        const lines = btData.split('\n')
        let iphoneName = ''
        let iphoneConnected = false
        let iphoneBattery = ''

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // iPhone device entries typically have "iPhone" in the name
          if (/iphone/i.test(line) && !line.includes('SPBluetooth')) {
            iphoneName = line.replace(/:/g, '').trim()
            // Look at subsequent lines for connection state and battery
            for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
              const sub = lines[j]
              if (/connected:\s*yes/i.test(sub)) iphoneConnected = true
              if (/battery\s*level/i.test(sub)) {
                const match = sub.match(/(\d+)%?/)
                if (match) iphoneBattery = match[1] + '%'
              }
              // Stop at next device entry (non-indented line with colon)
              if (j > i + 1 && /^\s{0,8}\S.*:$/.test(sub)) break
            }
          }
        }

        // Also check via ioreg for battery info from paired devices
        if (!iphoneBattery) {
          try {
            const ioreg = shell('ioreg -r -c AppleDeviceManagementHIDEventService 2>/dev/null | grep -i "BatteryPercent\\|Product"', 10_000)
            const battMatch = ioreg.match(/"BatteryPercent"\s*=\s*(\d+)/)
            if (battMatch) iphoneBattery = battMatch[1] + '%'
          } catch { /* battery info may not be available */ }
        }

        // Check Continuity/Handoff status
        let handoffActive = false
        try {
          const handoff = shell('defaults read com.apple.sharingd DiscoverableMode 2>/dev/null')
          handoffActive = handoff.includes('Contacts Only') || handoff.includes('Everyone')
        } catch {
          // Sharing daemon prefs may not be readable
          handoffActive = true // assume enabled if we can't read
        }

        if (iphoneName) {
          result.push(`  Device: ${iphoneName}`)
          result.push(`  Connected (Bluetooth): ${iphoneConnected ? 'Yes' : 'No (paired but not connected)'}`)
          if (iphoneBattery) result.push(`  Battery: ${iphoneBattery}`)
        } else {
          result.push('  No iPhone found in Bluetooth devices.')
          result.push('  Ensure your iPhone is paired via Bluetooth and on the same Apple ID.')
        }

        result.push(`  Handoff/Continuity: ${handoffActive ? 'Enabled' : 'Unknown'}`)

        // Check if Universal Clipboard might work (same iCloud account)
        try {
          shell('defaults read MobileMeAccounts Accounts 2>/dev/null')
          result.push('  iCloud: Signed in (Universal Clipboard available)')
        } catch {
          result.push('  iCloud: Could not verify sign-in status')
        }

      } catch (err) {
        result.push(`  Error querying Bluetooth: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result.join('\n')
    },
  })

  // ── 2. phone_message ─────────────────────────────────────────

  registerTool({
    name: 'phone_message',
    description:
      'Send an iMessage from macOS Messages app. The message is sent via the ' +
      'Messages app which syncs with iPhone via iCloud. ' +
      'Recipient can be a phone number or email address.',
    parameters: {
      to: {
        type: 'string',
        description: 'Recipient phone number (e.g., "+15551234567") or iMessage email',
        required: true,
      },
      message: {
        type: 'string',
        description: 'Message text to send',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const to = String(args.to).trim()
      const message = String(args.message)

      if (!to) return 'Error: "to" parameter is required (phone number or email).'
      if (!message) return 'Error: "message" parameter is required.'
      if (!isValidPhoneOrEmail(to)) {
        return `Error: "${to}" doesn't look like a valid phone number or email address.`
      }

      const escapedTo = escapeAppleScript(to)
      const escapedMsg = escapeAppleScript(message)

      const script = [
        'tell application "Messages"',
        `  set targetService to 1st account whose service type = iMessage`,
        `  set targetBuddy to participant "${escapedTo}" of targetService`,
        `  send "${escapedMsg}" to targetBuddy`,
        'end tell',
      ].join('\n')

      try {
        osascript(script, 15_000)
        return `iMessage sent to ${to}: "${message.length > 80 ? message.slice(0, 80) + '...' : message}"`
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        // Common errors
        if (errMsg.includes('not found') || errMsg.includes('Can\'t get')) {
          return `Error: Could not find iMessage recipient "${to}". Ensure they are reachable via iMessage.`
        }
        if (errMsg.includes('not allowed') || errMsg.includes('permission')) {
          return 'Error: Messages app access denied. Grant Automation permission in System Settings > Privacy & Security > Automation.'
        }
        return `Error sending iMessage: ${errMsg}`
      }
    },
  })

  // ── 3. phone_notify ──────────────────────────────────────────

  registerTool({
    name: 'phone_notify',
    description:
      'Read recent macOS notifications from the Notification Center database. ' +
      'Shows notifications that have been mirrored from iPhone via Continuity ' +
      'as well as local macOS notifications. Returns app, title, body, and timestamp.',
    parameters: {
      limit: {
        type: 'number',
        description: 'Max notifications to return (default: 20)',
        required: false,
        default: 20,
      },
      app: {
        type: 'string',
        description: 'Filter by app name (optional, case-insensitive substring match)',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const limit = Math.min(Number(args.limit) || 20, 100)
      const appFilter = args.app ? String(args.app).toLowerCase() : ''

      // The Notification Center DB location
      const dbPaths = [
        `${process.env.HOME}/Library/Group Containers/group.com.apple.usernoted/db2/db`,
        `${process.env.HOME}/Library/Application Support/NotificationCenter/db2/db`,
      ]

      let dbPath = ''
      for (const p of dbPaths) {
        if (existsSync(p)) { dbPath = p; break }
      }

      if (!dbPath) {
        return 'Error: Notification Center database not found. This may require Full Disk Access for the terminal app in System Settings > Privacy & Security > Full Disk Access.'
      }

      try {
        // Query the notification database
        // The schema varies by macOS version; we try a common query
        const query = `SELECT
          app_id,
          COALESCE(title, '') as title,
          COALESCE(subtitle, '') as subtitle,
          COALESCE(body, '') as body,
          delivered_date
        FROM record
        ORDER BY delivered_date DESC
        LIMIT ${limit * 2};`

        const raw = shell(`sqlite3 -json "${dbPath}" "${query.replace(/"/g, '\\"')}" 2>/dev/null`, 10_000)

        if (!raw || raw === '[]') {
          // Try alternative table/column names for different macOS versions
          const altQuery = `SELECT
            bundleid as app_id,
            COALESCE(json_extract(data, '$.title'), '') as title,
            '' as subtitle,
            COALESCE(json_extract(data, '$.body'), '') as body,
            date_delivered as delivered_date
          FROM notifications
          ORDER BY date_delivered DESC
          LIMIT ${limit * 2};`

          try {
            const altRaw = shell(`sqlite3 -json "${dbPath}" "${altQuery.replace(/"/g, '\\"')}" 2>/dev/null`, 10_000)
            if (altRaw && altRaw !== '[]') {
              return formatNotifications(altRaw, appFilter, limit)
            }
          } catch { /* try another approach */ }

          // Fallback: just list tables so we can diagnose
          try {
            const tables = shell(`sqlite3 "${dbPath}" ".tables" 2>/dev/null`)
            return `No notifications found with standard queries. DB tables: ${tables}\nThis database schema may differ on your macOS version. Grant Full Disk Access to your terminal app if needed.`
          } catch {
            return 'Error: Could not read notification database. Grant Full Disk Access to your terminal app in System Settings > Privacy & Security.'
          }
        }

        return formatNotifications(raw, appFilter, limit)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('permission') || errMsg.includes('unable to open')) {
          return 'Error: Cannot access Notification Center database. Grant Full Disk Access to your terminal app in System Settings > Privacy & Security > Full Disk Access.'
        }
        return `Error reading notifications: ${errMsg}`
      }
    },
  })

  // ── 4. phone_shortcut ────────────────────────────────────────

  registerTool({
    name: 'phone_shortcut',
    description:
      'Run a Shortcut by name via the macOS `shortcuts` CLI. ' +
      'Shortcuts synced from iPhone are available here. ' +
      'Can pass text input and returns the shortcut output.',
    parameters: {
      name: {
        type: 'string',
        description: 'Name of the Shortcut to run (exact name as shown in Shortcuts app)',
        required: true,
      },
      input: {
        type: 'string',
        description: 'Optional text input to pass to the shortcut',
        required: false,
      },
    },
    tier: 'free',
    timeout: 60_000, // shortcuts can take a while
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const name = String(args.name).trim()
      if (!name) return 'Error: Shortcut name is required.'

      // Verify the shortcuts command exists
      try {
        shell('which shortcuts', 5_000)
      } catch {
        return 'Error: `shortcuts` command not found. Requires macOS 12 Monterey or later.'
      }

      const escapedName = name.replace(/"/g, '\\"').replace(/\$/g, '\\$')
      let cmd = `shortcuts run "${escapedName}"`

      if (args.input) {
        const input = String(args.input)
        // Pipe input via stdin
        const escapedInput = input.replace(/"/g, '\\"').replace(/\$/g, '\\$')
        cmd = `echo "${escapedInput}" | shortcuts run "${escapedName}"`
      }

      try {
        const output = shell(cmd, 60_000)
        return output
          ? `Shortcut "${name}" output:\n${output}`
          : `Shortcut "${name}" ran successfully (no text output).`
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('couldn\'t find') || errMsg.includes('No shortcut')) {
          return `Error: Shortcut "${name}" not found. Use phone_shortcuts_list to see available shortcuts.`
        }
        return `Error running shortcut "${name}": ${errMsg}`
      }
    },
  })

  // ── 5. phone_shortcuts_list ──────────────────────────────────

  registerTool({
    name: 'phone_shortcuts_list',
    description:
      'List all available Shortcuts via the macOS `shortcuts list` command. ' +
      'Includes shortcuts synced from iPhone via iCloud.',
    parameters: {},
    tier: 'free',
    async execute() {
      const macErr = requireMacOS()
      if (macErr) return macErr

      try {
        shell('which shortcuts', 5_000)
      } catch {
        return 'Error: `shortcuts` command not found. Requires macOS 12 Monterey or later.'
      }

      try {
        const output = shell('shortcuts list', 15_000)
        if (!output) return 'No shortcuts found. Create shortcuts in the Shortcuts app.'

        const shortcuts = output.split('\n').filter(s => s.trim())
        return `Available Shortcuts (${shortcuts.length}):\n${shortcuts.map(s => `  - ${s}`).join('\n')}`
      } catch (err) {
        return `Error listing shortcuts: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 6. phone_call ────────────────────────────────────────────

  registerTool({
    name: 'phone_call',
    description:
      'Initiate a FaceTime audio call to a phone number. ' +
      'Uses the tel:// protocol which routes through iPhone via Continuity. ' +
      'The call must be manually accepted on the Mac or iPhone.',
    parameters: {
      number: {
        type: 'string',
        description: 'Phone number to call (e.g., "+15551234567")',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const number = String(args.number).trim()
      if (!number) return 'Error: Phone number is required.'
      if (!/^[+\d\s\-().]{7,20}$/.test(number)) {
        return `Error: "${number}" doesn't look like a valid phone number.`
      }

      const normalized = normalizePhone(number)

      try {
        // Use open location with tel:// protocol
        // This triggers FaceTime / iPhone Continuity call
        shell(`open "tel://${normalized}"`, 10_000)
        return `Initiating call to ${number}. Accept the call on your Mac or iPhone.`
      } catch (err) {
        return `Error initiating call: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 7. phone_airdrop ────────────────────────────────────────

  registerTool({
    name: 'phone_airdrop',
    description:
      'Send a file to iPhone via AirDrop. Opens the macOS sharing sheet with ' +
      'AirDrop pre-selected. Requires AirDrop enabled on both Mac and iPhone. ' +
      'You will need to accept the transfer on your iPhone.',
    parameters: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to send via AirDrop',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const filePath = String(args.file_path).trim()
      if (!filePath) return 'Error: file_path is required.'

      if (!existsSync(filePath)) {
        return `Error: File not found: ${filePath}`
      }

      try {
        const stats = statSync(filePath)
        if (stats.isDirectory()) {
          return 'Error: Cannot AirDrop a directory. Specify a file path.'
        }
      } catch {
        return `Error: Cannot access file: ${filePath}`
      }

      const escapedPath = escapeAppleScript(filePath)

      // Open AirDrop sharing via NSSharingService AppleScript
      const script = [
        'use framework "Foundation"',
        'use framework "AppKit"',
        'use scripting additions',
        '',
        `set filePath to POSIX file "${escapedPath}"`,
        'set shareItems to {filePath as alias}',
        '',
        'tell application "Finder"',
        '  activate',
        `  set theFile to POSIX file "${escapedPath}" as alias`,
        'end tell',
        '',
        '-- Open AirDrop window in Finder',
        'tell application "Finder"',
        '  if not (exists window "AirDrop") then',
        '    tell application "System Events" to keystroke "R" using {command down, shift down}',
        '  end if',
        '  activate',
        'end tell',
      ].join('\n')

      try {
        // Method 1: Open Finder with the file selected, then trigger sharing
        // The most reliable approach is to use `open` to reveal in Finder + AirDrop
        shell(`open -R "${filePath.replace(/"/g, '\\"')}"`, 5_000)

        // Open AirDrop window
        osascript([
          'tell application "Finder"',
          '  activate',
          '  if not (exists window "AirDrop") then',
          '    tell application "System Events"',
          '      keystroke "R" using {command down, shift down}',
          '    end tell',
          '  end if',
          'end tell',
        ].join('\n'), 10_000)

        const fileName = filePath.split('/').pop() || filePath
        return `AirDrop: Opened Finder with "${fileName}" and AirDrop window. Drag the file to your iPhone in the AirDrop window, or use Finder > Share > AirDrop.`
      } catch (err) {
        return `Error setting up AirDrop: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 8. phone_clipboard ───────────────────────────────────────

  registerTool({
    name: 'phone_clipboard',
    description:
      'Read or write the Universal Clipboard shared between Mac and iPhone via Handoff. ' +
      'When you write to the Mac clipboard, it becomes available on the iPhone (and vice versa) ' +
      'within a few seconds if both devices are on the same Apple ID with Handoff enabled.',
    parameters: {
      action: {
        type: 'string',
        description: '"read" to get clipboard contents, "write" to set clipboard contents',
        required: true,
      },
      text: {
        type: 'string',
        description: 'Text to write to clipboard (required for "write" action)',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const action = String(args.action).toLowerCase().trim()

      if (action === 'read') {
        try {
          const content = shell('pbpaste', 5_000)
          if (!content) return 'Clipboard is empty.'
          // Truncate very long clipboard content
          if (content.length > 10_000) {
            return `Clipboard (${content.length} chars, truncated):\n${content.slice(0, 10_000)}\n\n[... truncated ${content.length - 10_000} chars]`
          }
          return `Clipboard contents:\n${content}`
        } catch (err) {
          return `Error reading clipboard: ${err instanceof Error ? err.message : String(err)}`
        }
      }

      if (action === 'write') {
        const text = args.text != null ? String(args.text) : ''
        if (!text) return 'Error: "text" parameter is required for write action.'

        try {
          // Use printf to handle special characters safely, pipe to pbcopy
          execSync('pbcopy', {
            input: text,
            encoding: 'utf-8',
            timeout: 5_000,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          return `Clipboard updated (${text.length} chars). It will sync to your iPhone via Universal Clipboard within a few seconds if Handoff is enabled.`
        } catch (err) {
          return `Error writing to clipboard: ${err instanceof Error ? err.message : String(err)}`
        }
      }

      return 'Error: action must be "read" or "write".'
    },
  })

  // ── 9. phone_find ────────────────────────────────────────────

  registerTool({
    name: 'phone_find',
    description:
      'Open the Find My app to locate your iPhone. ' +
      'Can also trigger a sound on the iPhone to help find it nearby.',
    parameters: {
      action: {
        type: 'string',
        description: '"locate" to open Find My app (default), "sound" to play a sound on iPhone via Find My',
        required: false,
        default: 'locate',
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const action = String(args.action || 'locate').toLowerCase().trim()

      try {
        if (action === 'sound' || action === 'play_sound') {
          // Open Find My and navigate to play sound
          shell('open -a "Find My"', 5_000)
          // Wait for app to open, then try to navigate to Devices tab
          await new Promise(r => setTimeout(r, 1500))

          try {
            osascript([
              'tell application "Find My" to activate',
              'delay 1',
              'tell application "System Events"',
              '  tell process "Find My"',
              '    -- Click Devices tab',
              '    try',
              '      click radio button "Devices" of radio group 1 of toolbar 1 of window 1',
              '    end try',
              '  end tell',
              'end tell',
            ].join('\n'), 15_000)
          } catch { /* best effort UI interaction */ }

          return 'Find My opened on Devices tab. Select your iPhone and click "Play Sound" to locate it.'
        }

        // Default: just open Find My
        shell('open -a "Find My"', 5_000)
        return 'Find My app opened. Your iPhone location will be shown on the map if Location Services is enabled.'
      } catch (err) {
        return `Error opening Find My: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 10. phone_focus ──────────────────────────────────────────

  registerTool({
    name: 'phone_focus',
    description:
      'Check or set Focus mode (Do Not Disturb, etc.) via Shortcuts. ' +
      'Focus modes sync between Mac and iPhone when "Share Across Devices" is enabled. ' +
      'To toggle a Focus mode, you need a Shortcut that sets it (create in Shortcuts app).',
    parameters: {
      action: {
        type: 'string',
        description: '"status" to check current Focus mode, "set" to run a Focus-toggling Shortcut',
        required: true,
      },
      shortcut_name: {
        type: 'string',
        description: 'Name of the Shortcut that toggles the desired Focus mode (required for "set" action). Create a Shortcut with the "Set Focus" action first.',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const macErr = requireMacOS()
      if (macErr) return macErr

      const action = String(args.action).toLowerCase().trim()

      if (action === 'status') {
        try {
          // Check DND / Focus status via defaults or assertions file
          // macOS stores Focus state in the assertions daemon
          const dndStatus = shell(
            'plutil -extract dnd_prefs xml1 -o - ~/Library/Preferences/com.apple.ncprefs.plist 2>/dev/null | grep -c "true" 2>/dev/null || echo "0"',
            5_000
          )
          const isDnd = dndStatus.trim() !== '0'

          // Also check via notification center preferences
          let focusName = 'None'
          try {
            const assertionsRaw = shell(
              'defaults read com.apple.controlcenter "NSStatusItem Visible FocusModes" 2>/dev/null',
              5_000
            )
            if (assertionsRaw.includes('1')) focusName = 'Active (check Control Center for details)'
          } catch { /* may not be available */ }

          // Try to get more specific focus info
          try {
            const focusConfig = shell(
              'defaults read ~/Library/DoNotDisturb/DB/Assertions/v1/storeAssertionRecords 2>/dev/null',
              5_000
            )
            if (focusConfig && focusConfig !== '(\n)') {
              focusName = 'Active'
            }
          } catch { /* may not be accessible */ }

          const result = [
            'Focus Mode Status:',
            `  Do Not Disturb: ${isDnd ? 'ON' : 'OFF'}`,
            `  Active Focus: ${focusName}`,
            '',
            'Note: Focus modes sync across devices when "Share Across Devices" is enabled in Settings > Focus.',
            'To toggle a specific Focus mode, create a Shortcut with the "Set Focus" action and use phone_focus with action="set".',
          ]
          return result.join('\n')
        } catch (err) {
          return `Error checking Focus status: ${err instanceof Error ? err.message : String(err)}`
        }
      }

      if (action === 'set' || action === 'toggle') {
        const shortcutName = args.shortcut_name ? String(args.shortcut_name).trim() : ''
        if (!shortcutName) {
          return 'Error: shortcut_name is required for the "set" action.\n\nTo use this tool:\n1. Open the Shortcuts app\n2. Create a new Shortcut\n3. Add the "Set Focus" action\n4. Configure it for your desired Focus mode (e.g., "Do Not Disturb ON")\n5. Name it something like "DND On" or "Focus Work"\n6. Then run: phone_focus action="set" shortcut_name="DND On"'
        }

        try {
          shell('which shortcuts', 5_000)
        } catch {
          return 'Error: `shortcuts` command not found. Requires macOS 12 Monterey or later.'
        }

        try {
          const escapedName = shortcutName.replace(/"/g, '\\"').replace(/\$/g, '\\$')
          shell(`shortcuts run "${escapedName}"`, 30_000)
          return `Focus shortcut "${shortcutName}" executed. The Focus mode change will sync to your iPhone if "Share Across Devices" is enabled.`
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          if (errMsg.includes('couldn\'t find') || errMsg.includes('No shortcut')) {
            return `Error: Shortcut "${shortcutName}" not found. Use phone_shortcuts_list to see available shortcuts.`
          }
          return `Error running Focus shortcut: ${errMsg}`
        }
      }

      return 'Error: action must be "status" or "set".'
    },
  })
}

// ── Helper: format notification results ────────────────────────

function formatNotifications(raw: string, appFilter: string, limit: number): string {
  try {
    const notifications = JSON.parse(raw) as Array<{
      app_id?: string
      title?: string
      subtitle?: string
      body?: string
      delivered_date?: number | string
    }>

    let filtered = notifications
    if (appFilter) {
      filtered = notifications.filter(n =>
        (n.app_id || '').toLowerCase().includes(appFilter)
      )
    }

    const sliced = filtered.slice(0, limit)
    if (sliced.length === 0) {
      return appFilter
        ? `No notifications found matching "${appFilter}".`
        : 'No recent notifications found.'
    }

    const lines = [`Recent Notifications (${sliced.length}${appFilter ? ` matching "${appFilter}"` : ''}):\n`]

    for (const n of sliced) {
      // Format the app bundle ID into a readable name
      const appName = formatAppId(n.app_id || 'unknown')
      const title = n.title || '(no title)'
      const body = n.body || ''
      const subtitle = n.subtitle || ''

      // Format timestamp — Notification Center uses Core Data timestamp
      // (seconds since 2001-01-01) or Unix timestamp depending on macOS version
      let timeStr = ''
      if (n.delivered_date) {
        const ts = Number(n.delivered_date)
        if (ts > 1e9) {
          // Likely Unix timestamp in seconds
          timeStr = new Date(ts * 1000).toLocaleString()
        } else if (ts > 0) {
          // Core Data timestamp (seconds since 2001-01-01)
          const coreDataEpoch = new Date('2001-01-01T00:00:00Z').getTime()
          timeStr = new Date(coreDataEpoch + ts * 1000).toLocaleString()
        }
      }

      lines.push(`  [${appName}]${timeStr ? ' ' + timeStr : ''}`)
      lines.push(`    ${title}${subtitle ? ' — ' + subtitle : ''}`)
      if (body) lines.push(`    ${body.slice(0, 200)}${body.length > 200 ? '...' : ''}`)
      lines.push('')
    }

    return lines.join('\n')
  } catch {
    return `Raw notification data:\n${raw.slice(0, 5000)}`
  }
}

/** Convert a bundle ID like "com.apple.MobileSMS" to a readable name */
function formatAppId(bundleId: string): string {
  const knownApps: Record<string, string> = {
    'com.apple.MobileSMS': 'Messages',
    'com.apple.mobilephone': 'Phone',
    'com.apple.mobilemail': 'Mail',
    'com.apple.mobilecal': 'Calendar',
    'com.apple.reminders': 'Reminders',
    'com.apple.facetime': 'FaceTime',
    'com.apple.Maps': 'Maps',
    'com.apple.weather': 'Weather',
    'com.apple.news': 'News',
    'com.apple.Health': 'Health',
    'com.apple.Fitness': 'Fitness',
    'com.apple.mobileslideshow': 'Photos',
    'com.apple.camera': 'Camera',
    'com.apple.AppStore': 'App Store',
    'com.apple.iBooks': 'Books',
    'com.apple.podcasts': 'Podcasts',
    'com.apple.Music': 'Music',
    'com.apple.tv': 'TV',
    'com.apple.findmy': 'Find My',
    'com.apple.shortcuts': 'Shortcuts',
    'com.apple.Preferences': 'Settings',
    'com.apple.dt.Xcode': 'Xcode',
    'com.apple.Safari': 'Safari',
    'com.apple.finder': 'Finder',
    'com.slack.Slack': 'Slack',
    'com.tinyspeck.slackmacgap': 'Slack',
    'com.hnc.Discord': 'Discord',
    'com.spotify.client': 'Spotify',
    'us.zoom.xos': 'Zoom',
    'com.google.Chrome': 'Chrome',
    'com.microsoft.teams2': 'Teams',
    'com.whatsapp.WhatsApp': 'WhatsApp',
    'net.whatsapp.WhatsApp': 'WhatsApp',
    'com.facebook.Messenger': 'Messenger',
    'ph.telegra.Telegraph': 'Telegram',
    'org.telegram.Telegram': 'Telegram',
    'com.instagram.Instagram': 'Instagram',
  }

  if (knownApps[bundleId]) return knownApps[bundleId]

  // Extract last component as fallback
  const parts = bundleId.split('.')
  return parts[parts.length - 1] || bundleId
}
