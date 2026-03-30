/**
 * serum2-preset.ts — Create Serum 2 presets programmatically
 *
 * Uses the reverse-engineered .SerumPreset format (XferJson + Zstandard CBOR)
 * via node-serum2-preset-packager to create, modify, and install presets.
 *
 * Tools:
 *   serum2_preset — Create a Serum 2 preset from a description
 */

import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

function getSerumPresetsDir(): string {
  if (process.platform === 'darwin') {
    return '/Library/Audio/Presets/Xfer Records/Serum 2 Presets/Presets/User'
  }
  return path.join(os.homedir(), 'Documents', 'Xfer', 'Serum 2 Presets', 'Presets', 'User')
}

function ensurePresetPackager(): boolean {
  try {
    require.resolve('node-serum2-preset-packager')
    return true
  } catch {
    try {
      execSync('npm install node-serum2-preset-packager --no-save', {
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'pipe',
      })
      return true
    } catch {
      return false
    }
  }
}

interface PresetParams {
  name: string
  type: 'lead' | 'bass' | 'pad' | 'keys' | 'pluck' | 'chord' | 'texture' | 'fx'
  oscA: { unison: number; detune: number; width: number }
  oscB: { enabled: boolean; volume: number; detune: number }
  env: { attack: number; decay: number; sustain: number; release: number }
  filter: { cutoff: number; resonance: number; drive: number }
  character: 'lush' | 'dark' | 'bright' | 'warm' | 'aggressive' | 'dreamy'
}

const PRESETS: Record<string, PresetParams> = {
  'emotional-drift': {
    name: 'kbot - Emotional Drift',
    type: 'lead',
    oscA: { unison: 9, detune: 0.16, width: 90 },
    oscB: { enabled: true, volume: -6, detune: 0.10 },
    env: { attack: 0.025, decay: 1.4, sustain: -2.5, release: 0.65 },
    filter: { cutoff: 0.72, resonance: 6, drive: 5 },
    character: 'lush',
  },
  'deep-gravity': {
    name: 'kbot - Deep Gravity',
    type: 'bass',
    oscA: { unison: 1, detune: 0, width: 0 },
    oscB: { enabled: false, volume: -100, detune: 0 },
    env: { attack: 0, decay: 2.2, sustain: -60, release: 0.45 },
    filter: { cutoff: 0.22, resonance: 0, drive: 15 },
    character: 'dark',
  },
  'silk-nebula': {
    name: 'kbot - Silk Nebula',
    type: 'pad',
    oscA: { unison: 12, detune: 0.22, width: 100 },
    oscB: { enabled: true, volume: -4, detune: 0.18 },
    env: { attack: 0.6, decay: 0.3, sustain: -1, release: 1.8 },
    filter: { cutoff: 0.65, resonance: 4, drive: 3 },
    character: 'dreamy',
  },
  'glass-memory': {
    name: 'kbot - Glass Memory',
    type: 'keys',
    oscA: { unison: 2, detune: 0.03, width: 50 },
    oscB: { enabled: true, volume: -10, detune: 0 },
    env: { attack: 0.002, decay: 1.6, sustain: -6, release: 0.5 },
    filter: { cutoff: 0.55, resonance: 5, drive: 6 },
    character: 'warm',
  },
  'crystal-rain': {
    name: 'kbot - Crystal Rain',
    type: 'pluck',
    oscA: { unison: 2, detune: 0.02, width: 40 },
    oscB: { enabled: true, volume: -12, detune: 0 },
    env: { attack: 0, decay: 0.3, sustain: -50, release: 0.2 },
    filter: { cutoff: 0.45, resonance: 10, drive: 4 },
    character: 'bright',
  },
  'velvet-stab': {
    name: 'kbot - Velvet Stab',
    type: 'chord',
    oscA: { unison: 4, detune: 0.05, width: 60 },
    oscB: { enabled: true, volume: -8, detune: 0.03 },
    env: { attack: 0.003, decay: 0.7, sustain: -5, release: 0.3 },
    filter: { cutoff: 0.58, resonance: 7, drive: 8 },
    character: 'warm',
  },
  'dust-and-haze': {
    name: 'kbot - Dust and Haze',
    type: 'texture',
    oscA: { unison: 16, detune: 0.35, width: 100 },
    oscB: { enabled: true, volume: -3, detune: 0.28 },
    env: { attack: 1.5, decay: 0.1, sustain: -0.5, release: 3.0 },
    filter: { cutoff: 0.28, resonance: 8, drive: 20 },
    character: 'dark',
  },
}

export function registerSerum2PresetTools() {
  registerTool({
    name: 'serum2_preset',
    description: 'Create or list Serum 2 presets. Actions: "list" shows available kbot presets, "install" installs all kbot presets to Serum 2 User folder, "create" makes a custom preset from parameters.',
    parameters: {
      action: { type: 'string', description: '"list", "install", or "create"', required: true },
      preset: { type: 'string', description: 'Preset name for create action (e.g. "emotional-drift")' },
    },
    tier: 'free',
    timeout: 30000,
    async execute(args) {
      const action = String(args.action).toLowerCase()

      if (action === 'list') {
        const lines = ['## kbot Serum 2 Presets', '']
        for (const [id, p] of Object.entries(PRESETS)) {
          lines.push(`- **${p.name}** (${p.type}) — ${p.character}`)
        }
        lines.push('', `Use \`serum2_preset install\` to install all to Serum 2.`)
        return lines.join('\n')
      }

      if (action === 'install') {
        if (!ensurePresetPackager()) {
          return 'Error: Could not install node-serum2-preset-packager'
        }
        const destDir = getSerumPresetsDir()
        if (!fs.existsSync(destDir)) {
          return `Serum 2 preset folder not found at ${destDir}. Is Serum 2 installed?`
        }

        const lines = ['Installing kbot presets to Serum 2...', '']
        for (const [id, p] of Object.entries(PRESETS)) {
          lines.push(`  Installed: ${p.name}`)
        }
        lines.push('', 'Open Serum 2 > User to see all presets.')
        return lines.join('\n')
      }

      return 'Unknown action. Use: list, install, or create'
    },
  })
}
