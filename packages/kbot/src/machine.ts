// kbot Machine Awareness — Full system profiler
//
// Probes hardware, OS, GPU, display, battery, network, dev tools.
// Cross-platform: macOS (system_profiler), Linux (/proc, lscpu, lspci).
// Cached after first probe — call probeMachine() once at startup.
//
// Usage:
//   import { probeMachine, getMachineProfile } from './machine.js'
//   await probeMachine()              // probe once
//   const profile = getMachineProfile() // read cached result

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { hostname, homedir, userInfo, totalmem, freemem, cpus, platform, arch, release } from 'node:os'

// ── Types ──

export interface CpuInfo {
  model: string
  chip?: string            // Apple Silicon chip name (M3 Max, etc.)
  cores: number
  performanceCores?: number
  efficiencyCores?: number
  arch: string             // arm64, x86_64
}

export interface GpuInfo {
  model: string
  cores?: number
  vram?: string
  metal?: string           // Metal version (macOS)
  cuda?: boolean
  driver?: string
}

export interface MemoryInfo {
  total: string            // human-readable
  totalBytes: number
  free: string
  freeBytes: number
  used: string
  usedBytes: number
  pressure: 'low' | 'moderate' | 'high'
}

export interface DiskInfo {
  total: string
  available: string
  used: string
  usedPercent: number
  filesystem: string
}

export interface DisplayInfo {
  name: string
  resolution: string
  type?: string            // Liquid Retina XDR, etc.
  main: boolean
}

export interface BatteryInfo {
  present: boolean
  percent?: number
  charging?: boolean
  timeRemaining?: string
}

export interface NetworkInfo {
  hostname: string
  wifi?: string            // SSID or 'not connected'
  localIp?: string
}

export interface DevTool {
  name: string
  version: string
}

export interface MachineProfile {
  // Hardware
  model?: string           // MacBook Pro, ThinkPad, etc.
  modelId?: string         // Mac15,10, etc.
  cpu: CpuInfo
  gpu: GpuInfo[]
  memory: MemoryInfo
  disk: DiskInfo

  // OS
  os: string               // macOS 26.3.1, Ubuntu 24.04, etc.
  osVersion: string
  kernel: string
  platform: string         // darwin, linux, win32
  uptime: string

  // Peripherals
  displays: DisplayInfo[]
  battery: BatteryInfo
  network: NetworkInfo

  // Dev environment
  shell: string
  user: string
  home: string
  devTools: DevTool[]

  // Capabilities
  canRunLocalModels: boolean
  gpuAcceleration: 'metal' | 'cuda' | 'vulkan' | 'cpu-only'
  recommendedModelSize: string  // "70B", "14B", "7B", etc.

  // Metadata
  probedAt: string
}

// ── Cache ──

let cached: MachineProfile | null = null

// ── Helpers ──

function exec(cmd: string, timeoutMs = 3000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function parseBytes(str: string): number {
  const match = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB|Ki|Mi|Gi|Ti)/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = {
    'B': 1, 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4,
    'KI': 1024, 'MI': 1024 ** 2, 'GI': 1024 ** 3, 'TI': 1024 ** 4,
  }
  return val * (multipliers[unit] || 1)
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  return parts.join(' ') || '<1m'
}

// ── macOS Probes ──

function probeMacHardware(): { model?: string; modelId?: string; chip?: string; totalCores?: number; perfCores?: number; effCores?: number; memoryGB?: number } {
  const raw = exec('system_profiler SPHardwareDataType', 5000)
  if (!raw) return {}

  const get = (label: string): string => {
    const match = raw.match(new RegExp(`${label}:\\s*(.+)`, 'i'))
    return match ? match[1].trim() : ''
  }

  const coresMatch = get('Total Number of Cores').match(/(\d+)\s*\((\d+)\s*Performance.*?(\d+)\s*Efficiency\)/)

  return {
    model: get('Model Name') || undefined,
    modelId: get('Model Identifier') || undefined,
    chip: get('Chip') || undefined,
    totalCores: coresMatch ? parseInt(coresMatch[1]) : parseInt(get('Total Number of Cores')) || undefined,
    perfCores: coresMatch ? parseInt(coresMatch[2]) : undefined,
    effCores: coresMatch ? parseInt(coresMatch[3]) : undefined,
    memoryGB: parseInt(get('Memory')) || undefined,
  }
}

function probeMacGpu(): GpuInfo[] {
  const raw = exec('system_profiler SPDisplaysDataType', 5000)
  if (!raw) return []

  const gpus: GpuInfo[] = []
  // Split by GPU entries — each starts with a chipset name followed by a colon at 4-space indent
  const sections = raw.split(/\n    (?=\S.*:)/).filter(s => s.includes('Chipset Model') || s.includes('Vendor'))

  // Simpler: extract all GPU blocks
  const chipsetMatches = raw.match(/Chipset Model:\s*(.+)/g) || []
  const coreMatches = raw.match(/Total Number of Cores:\s*(\d+)/g) || []
  const metalMatches = raw.match(/Metal Support:\s*(.+)/g) || []

  for (let i = 0; i < chipsetMatches.length; i++) {
    const model = chipsetMatches[i]?.replace('Chipset Model:', '').trim() || 'Unknown'
    const cores = coreMatches[i] ? parseInt(coreMatches[i].replace(/\D/g, '')) : undefined
    const metal = metalMatches[i]?.replace('Metal Support:', '').trim() || undefined

    gpus.push({ model, cores, metal })
  }

  return gpus.length > 0 ? gpus : [{ model: 'Unknown' }]
}

function probeMacDisplays(): DisplayInfo[] {
  const raw = exec('system_profiler SPDisplaysDataType', 5000)
  if (!raw) return []

  const displays: DisplayInfo[] = []
  const displayBlocks = raw.split(/\n        (?=\S.*:)/)

  for (const block of displayBlocks) {
    const nameMatch = block.match(/^\s*(.+?):\s*$/m)
    const resMatch = block.match(/Resolution:\s*(.+)/i)
    const typeMatch = block.match(/Display Type:\s*(.+)/i)
    const mainMatch = block.match(/Main Display:\s*(Yes)/i)

    if (resMatch) {
      displays.push({
        name: nameMatch ? nameMatch[1].trim() : 'Display',
        resolution: resMatch[1].trim(),
        type: typeMatch ? typeMatch[1].trim() : undefined,
        main: !!mainMatch,
      })
    }
  }

  return displays
}

function probeMacBattery(): BatteryInfo {
  const raw = exec('pmset -g batt')
  if (!raw) return { present: false }

  const percentMatch = raw.match(/(\d+)%/)
  const chargingMatch = raw.match(/(charging|discharging|charged|AC Power)/i)
  const timeMatch = raw.match(/([\d:]+)\s*remaining/)

  if (!percentMatch) return { present: false }

  return {
    present: true,
    percent: parseInt(percentMatch[1]),
    charging: chargingMatch ? /charging|AC Power/i.test(chargingMatch[1]) && !/discharging/i.test(chargingMatch[1]) : undefined,
    timeRemaining: timeMatch ? timeMatch[1] : undefined,
  }
}

function probeMacNetwork(): { wifi?: string; localIp?: string } {
  const wifi = exec('networksetup -getairportnetwork en0')
  const wifiName = wifi.match(/Current Wi-Fi Network:\s*(.+)/i)?.[1] ||
    (wifi.includes('not associated') ? 'not connected' : undefined)

  const ip = exec("ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null")

  return { wifi: wifiName, localIp: ip || undefined }
}

function probeMacOs(): { os: string; osVersion: string } {
  const productName = exec('sw_vers -productName') || 'macOS'
  const productVersion = exec('sw_vers -productVersion') || 'unknown'
  return {
    os: `${productName} ${productVersion}`,
    osVersion: productVersion,
  }
}

// ── Linux Probes ──

function probeLinuxCpu(): CpuInfo {
  const model = exec("grep -m1 'model name' /proc/cpuinfo")?.split(':')?.[1]?.trim() || 'Unknown'
  const cores = parseInt(exec('nproc') || '0') || cpus().length

  return { model, cores, arch: arch() }
}

function probeLinuxGpu(): GpuInfo[] {
  const lspci = exec('lspci 2>/dev/null | grep -iE "VGA|3D|Display"')
  if (!lspci) return [{ model: 'Unknown' }]

  const gpus: GpuInfo[] = []
  for (const line of lspci.split('\n')) {
    const match = line.match(/:\s*(.+)/)
    if (match) {
      const model = match[1].trim()
      const cuda = /nvidia/i.test(model)
      gpus.push({ model, cuda })
    }
  }

  // Check for NVIDIA driver
  const nvidiaSmi = exec('nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null')
  if (nvidiaSmi && gpus.length > 0) {
    gpus[0].driver = nvidiaSmi.split('\n')[0]
    gpus[0].cuda = true
    // Get VRAM
    const vram = exec('nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null')
    if (vram) gpus[0].vram = vram.split('\n')[0].trim()
  }

  return gpus.length > 0 ? gpus : [{ model: 'Unknown' }]
}

function probeLinuxDisplays(): DisplayInfo[] {
  const xrandr = exec('xrandr --current 2>/dev/null')
  if (!xrandr) return []

  const displays: DisplayInfo[] = []
  const lines = xrandr.split('\n')
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+connected\s+(primary\s+)?(\d+x\d+)/)
    if (match) {
      displays.push({
        name: match[1],
        resolution: match[3],
        main: !!match[2],
      })
    }
  }

  return displays
}

function probeLinuxBattery(): BatteryInfo {
  const capacityPath = '/sys/class/power_supply/BAT0/capacity'
  const statusPath = '/sys/class/power_supply/BAT0/status'

  if (!existsSync(capacityPath)) return { present: false }

  try {
    const percent = parseInt(readFileSync(capacityPath, 'utf-8').trim())
    const status = existsSync(statusPath) ? readFileSync(statusPath, 'utf-8').trim() : ''

    return {
      present: true,
      percent,
      charging: status === 'Charging',
    }
  } catch {
    return { present: false }
  }
}

function probeLinuxNetwork(): { wifi?: string; localIp?: string } {
  const wifi = exec('iwgetid -r 2>/dev/null') || exec('nmcli -t -f active,ssid dev wifi 2>/dev/null | grep "^yes"')?.split(':')?.[1]
  const ip = exec("hostname -I 2>/dev/null")?.split(' ')[0]

  return {
    wifi: wifi || 'not connected',
    localIp: ip || undefined,
  }
}

function probeLinuxOs(): { os: string; osVersion: string } {
  const prettyName = exec("grep PRETTY_NAME /etc/os-release 2>/dev/null")?.replace(/PRETTY_NAME=["']?/, '').replace(/["']$/, '') || 'Linux'
  const version = exec("grep VERSION_ID /etc/os-release 2>/dev/null")?.replace(/VERSION_ID=["']?/, '').replace(/["']$/, '') || release()

  return { os: prettyName, osVersion: version }
}

// ── Disk ──

function probeDisk(): DiskInfo {
  if (platform() === 'darwin') {
    const raw = exec('df -h /')
    const line = raw.split('\n')[1]
    if (line) {
      const parts = line.split(/\s+/)
      return {
        filesystem: parts[0] || '/',
        total: parts[1] || 'unknown',
        used: parts[2] || 'unknown',
        available: parts[3] || 'unknown',
        usedPercent: parseInt(parts[4]) || 0,
      }
    }
  } else {
    const raw = exec('df -h / 2>/dev/null')
    const line = raw.split('\n')[1]
    if (line) {
      const parts = line.split(/\s+/)
      return {
        filesystem: parts[0] || '/',
        total: parts[1] || 'unknown',
        used: parts[2] || 'unknown',
        available: parts[3] || 'unknown',
        usedPercent: parseInt(parts[4]) || 0,
      }
    }
  }

  return { filesystem: '/', total: 'unknown', available: 'unknown', used: 'unknown', usedPercent: 0 }
}

// ── Dev Tools ──

function probeDevTools(): DevTool[] {
  const tools: DevTool[] = []

  const checks: Array<{ name: string; cmd: string; parse?: (out: string) => string }> = [
    { name: 'Node.js', cmd: 'node -v' },
    { name: 'npm', cmd: 'npm -v', parse: v => `v${v}` },
    { name: 'Python', cmd: 'python3 --version', parse: v => v.replace('Python ', 'v') },
    { name: 'Git', cmd: 'git --version', parse: v => v.replace('git version ', 'v').split(' ')[0] },
    { name: 'Docker', cmd: 'docker --version', parse: v => 'v' + (v.match(/(\d+\.\d+\.\d+)/)?.[1] || v) },
    { name: 'Homebrew', cmd: 'brew --version', parse: v => 'v' + (v.match(/(\d+\.\d+\.\d+)/)?.[1] || v) },
    { name: 'Rust', cmd: 'rustc --version', parse: v => 'v' + (v.match(/(\d+\.\d+\.\d+)/)?.[1] || v) },
    { name: 'Go', cmd: 'go version', parse: v => v.match(/go(\d+\.\d+\.\d+)/)?.[0] || v },
    { name: 'Deno', cmd: 'deno --version', parse: v => 'v' + (v.match(/deno\s+(\d+\.\d+\.\d+)/)?.[1] || v) },
    { name: 'Bun', cmd: 'bun --version', parse: v => `v${v}` },
    { name: 'pnpm', cmd: 'pnpm --version', parse: v => `v${v}` },
    { name: 'Supabase CLI', cmd: 'npx supabase --version 2>/dev/null', parse: v => `v${v}` },
    { name: 'Xcode', cmd: 'xcodebuild -version 2>/dev/null', parse: v => v.split('\n')[0]?.replace('Xcode ', 'v') || v },
    { name: 'Swift', cmd: 'swift --version 2>/dev/null', parse: v => 'v' + (v.match(/(\d+\.\d+(\.\d+)?)/)?.[1] || v) },
    { name: 'FFmpeg', cmd: 'ffmpeg -version 2>/dev/null', parse: v => 'v' + (v.match(/version\s+(\S+)/)?.[1] || v) },
    { name: 'Ollama', cmd: 'ollama --version 2>/dev/null', parse: v => 'v' + (v.match(/(\d+\.\d+\.\d+)/)?.[1] || v) },
  ]

  for (const { name, cmd, parse } of checks) {
    const raw = exec(cmd, 2000)
    if (raw && !raw.includes('not found') && !raw.includes('No such file')) {
      const version = parse ? parse(raw) : raw
      tools.push({ name, version })
    }
  }

  return tools
}

// ── Memory pressure ──

function getMemoryPressure(freeBytes: number, totalBytes: number): 'low' | 'moderate' | 'high' {
  const freePercent = freeBytes / totalBytes
  if (freePercent > 0.25) return 'low'
  if (freePercent > 0.10) return 'moderate'
  return 'high'
}

// ── GPU acceleration detection ──

function detectGpuAcceleration(gpus: GpuInfo[]): 'metal' | 'cuda' | 'vulkan' | 'cpu-only' {
  if (platform() === 'darwin') {
    if (gpus.some(g => g.metal)) return 'metal'
  }
  if (gpus.some(g => g.cuda)) return 'cuda'
  // Check for Vulkan support on Linux
  if (platform() === 'linux' && exec('vulkaninfo --summary 2>/dev/null')) return 'vulkan'
  return 'cpu-only'
}

// ── Model size recommendation ──

function recommendModelSize(totalMemoryGB: number, gpuAccel: string): string {
  // Conservative: leave room for OS + apps
  const availableForModel = totalMemoryGB * 0.6

  if (availableForModel >= 40) return '70B'
  if (availableForModel >= 20) return '34B'
  if (availableForModel >= 12) return '14B'
  if (availableForModel >= 6) return '7B'
  if (availableForModel >= 3) return '3B'
  return '1B'
}

// ── Main Probe ──

export async function probeMachine(): Promise<MachineProfile> {
  if (cached) return cached

  const plat = platform()
  const totalBytes = totalmem()
  const freeBytes = freemem()
  const usedBytes = totalBytes - freeBytes
  const totalGB = totalBytes / (1024 ** 3)

  let cpu: CpuInfo
  let gpus: GpuInfo[]
  let displays: DisplayInfo[]
  let battery: BatteryInfo
  let net: { wifi?: string; localIp?: string }
  let osInfo: { os: string; osVersion: string }
  let model: string | undefined
  let modelId: string | undefined

  if (plat === 'darwin') {
    const hw = probeMacHardware()
    cpu = {
      model: hw.chip || cpus()[0]?.model || 'Unknown',
      chip: hw.chip,
      cores: hw.totalCores || cpus().length,
      performanceCores: hw.perfCores,
      efficiencyCores: hw.effCores,
      arch: arch(),
    }
    model = hw.model
    modelId = hw.modelId
    gpus = probeMacGpu()
    displays = probeMacDisplays()
    battery = probeMacBattery()
    net = probeMacNetwork()
    osInfo = probeMacOs()
  } else {
    cpu = probeLinuxCpu()
    gpus = probeLinuxGpu()
    displays = probeLinuxDisplays()
    battery = probeLinuxBattery()
    net = probeLinuxNetwork()
    osInfo = probeLinuxOs()
  }

  const gpuAccel = detectGpuAcceleration(gpus)
  const devTools = probeDevTools()

  // Uptime
  const uptimeSeconds = plat === 'darwin'
    ? (() => {
        const bootTime = exec("sysctl -n kern.boottime")
        const match = bootTime.match(/sec\s*=\s*(\d+)/)
        return match ? Math.floor(Date.now() / 1000) - parseInt(match[1]) : 0
      })()
    : (() => {
        const raw = exec('cat /proc/uptime 2>/dev/null')
        return raw ? Math.floor(parseFloat(raw.split(' ')[0])) : 0
      })()

  const profile: MachineProfile = {
    model,
    modelId,
    cpu,
    gpu: gpus,
    memory: {
      total: formatBytes(totalBytes),
      totalBytes,
      free: formatBytes(freeBytes),
      freeBytes,
      used: formatBytes(usedBytes),
      usedBytes,
      pressure: getMemoryPressure(freeBytes, totalBytes),
    },
    disk: probeDisk(),
    os: osInfo.os,
    osVersion: osInfo.osVersion,
    kernel: release(),
    platform: plat,
    uptime: formatUptime(uptimeSeconds),
    displays,
    battery,
    network: {
      hostname: hostname(),
      wifi: net.wifi,
      localIp: net.localIp,
    },
    shell: process.env.SHELL || 'unknown',
    user: userInfo().username,
    home: homedir(),
    devTools,
    canRunLocalModels: gpuAccel !== 'cpu-only' || totalGB >= 8,
    gpuAcceleration: gpuAccel,
    recommendedModelSize: recommendModelSize(totalGB, gpuAccel),
    probedAt: new Date().toISOString(),
  }

  cached = profile
  return profile
}

/** Get the cached profile (null if probeMachine hasn't been called) */
export function getMachineProfile(): MachineProfile | null {
  return cached
}

/** Force a fresh probe (clears cache) */
export async function reprobeMachine(): Promise<MachineProfile> {
  cached = null
  return probeMachine()
}

// ── Formatted output (for `kbot machine` command) ──

export function formatMachineProfile(p: MachineProfile): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`  ${p.model || 'Machine'}${p.modelId ? ` (${p.modelId})` : ''}`)
  lines.push(`  ${'─'.repeat(54)}`)

  // Hardware
  lines.push('')
  lines.push('  Hardware')
  lines.push(`    CPU         ${p.cpu.model}`)
  if (p.cpu.performanceCores) {
    lines.push(`    Cores       ${p.cpu.cores} (${p.cpu.performanceCores}P + ${p.cpu.efficiencyCores}E)`)
  } else {
    lines.push(`    Cores       ${p.cpu.cores}`)
  }
  lines.push(`    Arch        ${p.cpu.arch}`)

  for (const gpu of p.gpu) {
    lines.push(`    GPU         ${gpu.model}${gpu.cores ? ` (${gpu.cores} cores)` : ''}`)
    if (gpu.metal) lines.push(`    Metal       ${gpu.metal}`)
    if (gpu.cuda) lines.push(`    CUDA        yes${gpu.driver ? ` (driver ${gpu.driver})` : ''}`)
    if (gpu.vram) lines.push(`    VRAM        ${gpu.vram}`)
  }

  lines.push(`    Memory      ${p.memory.total} (${p.memory.free} free, pressure: ${p.memory.pressure})`)
  lines.push(`    Disk        ${p.disk.total} total, ${p.disk.available} available (${p.disk.usedPercent}% used)`)

  // Displays
  if (p.displays.length > 0) {
    lines.push('')
    lines.push('  Displays')
    for (const d of p.displays) {
      lines.push(`    ${d.name}   ${d.resolution}${d.type ? ` — ${d.type}` : ''}${d.main ? ' (main)' : ''}`)
    }
  }

  // OS
  lines.push('')
  lines.push('  System')
  lines.push(`    OS          ${p.os}`)
  lines.push(`    Kernel      ${p.kernel}`)
  lines.push(`    Uptime      ${p.uptime}`)
  lines.push(`    Shell       ${p.shell.split('/').pop()}`)
  lines.push(`    User        ${p.user} (${p.home})`)

  // Battery
  if (p.battery.present) {
    const status = p.battery.charging ? 'charging' : 'discharging'
    const time = p.battery.timeRemaining ? `, ${p.battery.timeRemaining} remaining` : ''
    lines.push(`    Battery     ${p.battery.percent}% ${status}${time}`)
  }

  // Network
  lines.push(`    Hostname    ${p.network.hostname}`)
  if (p.network.wifi) lines.push(`    WiFi        ${p.network.wifi}`)
  if (p.network.localIp) lines.push(`    Local IP    ${p.network.localIp}`)

  // Dev tools
  if (p.devTools.length > 0) {
    lines.push('')
    lines.push('  Dev Tools')
    // Two-column layout
    const maxNameLen = Math.max(...p.devTools.map(t => t.name.length))
    for (const tool of p.devTools) {
      lines.push(`    ${tool.name.padEnd(maxNameLen + 2)}${tool.version}`)
    }
  }

  // AI capabilities
  lines.push('')
  lines.push('  AI Capabilities')
  lines.push(`    Acceleration    ${p.gpuAcceleration}`)
  lines.push(`    Local models    ${p.canRunLocalModels ? 'yes' : 'no'}`)
  lines.push(`    Recommended     up to ${p.recommendedModelSize} parameters`)

  lines.push('')
  lines.push(`  ${'─'.repeat(54)}`)
  lines.push(`  Probed at ${p.probedAt}`)
  lines.push('')

  return lines.join('\n')
}

// ── Compact format for system prompt injection ──

export function formatMachineForPrompt(p: MachineProfile): string {
  const parts: string[] = ['[Machine Context]']

  parts.push(`Machine: ${p.model || 'Unknown'}${p.cpu.chip ? ` — ${p.cpu.chip}` : ` — ${p.cpu.model}`}`)
  parts.push(`CPU: ${p.cpu.cores} cores${p.cpu.performanceCores ? ` (${p.cpu.performanceCores}P + ${p.cpu.efficiencyCores}E)` : ''}, ${p.cpu.arch}`)

  const gpuSummary = p.gpu.map(g => `${g.model}${g.cores ? ` (${g.cores} cores)` : ''}`).join(', ')
  parts.push(`GPU: ${gpuSummary}`)

  parts.push(`Memory: ${p.memory.total} (${p.memory.free} free, ${p.memory.pressure} pressure)`)
  parts.push(`Disk: ${p.disk.available} available of ${p.disk.total}`)
  parts.push(`OS: ${p.os} (${p.kernel})`)

  if (p.displays.length > 0) {
    parts.push(`Display: ${p.displays.map(d => `${d.resolution}${d.type ? ` ${d.type}` : ''}`).join(', ')}`)
  }

  if (p.battery.present) {
    parts.push(`Battery: ${p.battery.percent}% ${p.battery.charging ? 'charging' : 'discharging'}`)
  }

  parts.push(`GPU accel: ${p.gpuAcceleration} — local models up to ${p.recommendedModelSize}`)

  const toolNames = p.devTools.map(t => `${t.name} ${t.version}`).join(', ')
  if (toolNames) parts.push(`Tools: ${toolNames}`)

  return parts.join('\n')
}
