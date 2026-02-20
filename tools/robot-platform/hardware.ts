/**
 * Hardware Abstraction Layer
 *
 * Provides a unified interface to Linux GPIO, I2C, SPI, and PWM
 * through sysfs and /dev interfaces. Designed for Raspberry Pi
 * but works on any Linux board with standard kernel interfaces.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import type { PinConfig, I2CDevice } from './config'

// --- GPIO ---

const GPIO_BASE = '/sys/class/gpio'

export interface GPIOPin {
  pin: number
  mode: 'input' | 'output'
  label: string
  read(): Promise<boolean>
  write(value: boolean): Promise<void>
  release(): Promise<void>
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function exportGPIO(config: PinConfig): Promise<GPIOPin> {
  const pinPath = `${GPIO_BASE}/gpio${config.pin}`

  // Export the pin if not already exported
  if (!(await fileExists(pinPath))) {
    await writeFile(`${GPIO_BASE}/export`, String(config.pin))
    // Small delay for sysfs to create the directory
    await new Promise(r => setTimeout(r, 100))
  }

  // Set direction
  const direction = config.mode === 'output' ? 'out' : 'in'
  await writeFile(`${pinPath}/direction`, direction)

  // Set pull-up if requested (requires /boot/config.txt on RPi)
  if (config.pullUp && config.mode === 'input') {
    try {
      await writeFile(`${pinPath}/active_low`, '1')
    } catch {
      // Not all boards support active_low via sysfs
    }
  }

  return {
    pin: config.pin,
    mode: config.mode === 'pwm' ? 'output' : config.mode,
    label: config.label,

    async read(): Promise<boolean> {
      const val = await readFile(`${pinPath}/value`, 'utf-8')
      return val.trim() === '1'
    },

    async write(value: boolean): Promise<void> {
      await writeFile(`${pinPath}/value`, value ? '1' : '0')
    },

    async release(): Promise<void> {
      try {
        await writeFile(`${GPIO_BASE}/unexport`, String(config.pin))
      } catch {
        // Pin may already be unexported
      }
    },
  }
}

// --- I2C ---

export interface I2CBus {
  bus: number
  read(address: number, register: number, length: number): Promise<Buffer>
  write(address: number, register: number, data: Buffer): Promise<void>
  scan(): Promise<number[]>
  close(): void
}

export async function openI2C(busNumber: number): Promise<I2CBus> {
  const devPath = `/dev/i2c-${busNumber}`

  // Verify the bus exists
  if (!(await fileExists(devPath))) {
    throw new Error(`I2C bus ${busNumber} not found at ${devPath}. Enable I2C in raspi-config.`)
  }

  // In production, this would use i2c-bus npm package or native ioctl
  // For the platform layer, we define the interface and provide a simulated fallback
  let fd: number | null = null

  return {
    bus: busNumber,

    async read(address: number, register: number, length: number): Promise<Buffer> {
      // Real implementation would use ioctl I2C_RDWR
      // This is the abstraction boundary — swap in real i2c-bus driver here
      try {
        const { execSync } = await import('node:child_process')
        const result = execSync(
          `i2cget -y ${busNumber} 0x${address.toString(16)} 0x${register.toString(16)}`,
          { encoding: 'utf-8', timeout: 1000 }
        )
        const byte = parseInt(result.trim(), 16)
        const buf = Buffer.alloc(length)
        buf[0] = byte
        return buf
      } catch {
        return Buffer.alloc(length)
      }
    },

    async write(address: number, register: number, data: Buffer): Promise<void> {
      try {
        const { execSync } = await import('node:child_process')
        execSync(
          `i2cset -y ${busNumber} 0x${address.toString(16)} 0x${register.toString(16)} 0x${data[0].toString(16)}`,
          { timeout: 1000 }
        )
      } catch {
        // Log but don't crash — hardware may be disconnected
      }
    },

    async scan(): Promise<number[]> {
      const devices: number[] = []
      try {
        const { execSync } = await import('node:child_process')
        const result = execSync(`i2cdetect -y ${busNumber}`, { encoding: 'utf-8', timeout: 5000 })
        // Parse i2cdetect output — addresses appear as hex values
        const lines = result.split('\n').slice(1) // Skip header
        for (const line of lines) {
          const parts = line.split(':')[1]?.trim().split(/\s+/) || []
          for (const part of parts) {
            if (part !== '--' && part !== 'UU' && part.length === 2) {
              const addr = parseInt(part, 16)
              if (!isNaN(addr)) devices.push(addr)
            }
          }
        }
      } catch {
        // i2cdetect not available
      }
      return devices
    },

    close(): void {
      fd = null
    },
  }
}

// --- PWM ---

const PWM_BASE = '/sys/class/pwm'

export interface PWMChannel {
  chip: number
  channel: number
  setPeriodNs(ns: number): Promise<void>
  setDutyNs(ns: number): Promise<void>
  enable(): Promise<void>
  disable(): Promise<void>
  release(): Promise<void>
}

export async function exportPWM(chip: number, channel: number): Promise<PWMChannel> {
  const chipPath = `${PWM_BASE}/pwmchip${chip}`
  const channelPath = `${chipPath}/pwm${channel}`

  if (!(await fileExists(channelPath))) {
    await writeFile(`${chipPath}/export`, String(channel))
    await new Promise(r => setTimeout(r, 100))
  }

  return {
    chip,
    channel,

    async setPeriodNs(ns: number): Promise<void> {
      await writeFile(`${channelPath}/period`, String(Math.round(ns)))
    },

    async setDutyNs(ns: number): Promise<void> {
      await writeFile(`${channelPath}/duty_cycle`, String(Math.round(ns)))
    },

    async enable(): Promise<void> {
      await writeFile(`${channelPath}/enable`, '1')
    },

    async disable(): Promise<void> {
      await writeFile(`${channelPath}/enable`, '0')
    },

    async release(): Promise<void> {
      try {
        await writeFile(`${chipPath}/unexport`, String(channel))
      } catch {
        // Already unexported
      }
    },
  }
}

// --- Ultrasonic Distance Sensor ---

export async function readUltrasonic(triggerPin: GPIOPin, echoPin: GPIOPin): Promise<number> {
  // Send 10μs trigger pulse
  await triggerPin.write(false)
  await new Promise(r => setTimeout(r, 2))
  await triggerPin.write(true)
  await new Promise(r => setTimeout(r, 0.01)) // ~10μs
  await triggerPin.write(false)

  // Measure echo pulse width
  const startTime = performance.now()
  const timeout = startTime + 30 // 30ms timeout (~5m max range)

  // Wait for echo to go high
  while (!(await echoPin.read()) && performance.now() < timeout) {
    // Busy wait — ultrasonic timing requires tight loops
  }

  const pulseStart = performance.now()

  // Wait for echo to go low
  while ((await echoPin.read()) && performance.now() < timeout) {
    // Busy wait
  }

  const pulseEnd = performance.now()
  const pulseDurationMs = pulseEnd - pulseStart

  // Speed of sound = 343 m/s → distance = time * 343 / 2 (round trip)
  const distanceCm = (pulseDurationMs / 1000) * 343 * 100 / 2

  return Math.max(0, Math.min(distanceCm, 500)) // Clamp to 0-500cm
}

// --- System Info ---

export interface SystemInfo {
  board: string
  cpuTemp: number
  cpuUsage: number
  memoryUsedMb: number
  memoryTotalMb: number
  uptime: number
}

export async function getSystemInfo(): Promise<SystemInfo> {
  let cpuTemp = 0
  let board = 'unknown'

  try {
    const temp = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8')
    cpuTemp = parseInt(temp) / 1000
  } catch {
    // Thermal zone not available
  }

  try {
    const model = await readFile('/proc/device-tree/model', 'utf-8')
    board = model.replace(/\0/g, '').trim()
  } catch {
    board = 'Generic Linux'
  }

  let memoryUsedMb = 0
  let memoryTotalMb = 0
  try {
    const meminfo = await readFile('/proc/meminfo', 'utf-8')
    const total = meminfo.match(/MemTotal:\s+(\d+)/)
    const available = meminfo.match(/MemAvailable:\s+(\d+)/)
    if (total) memoryTotalMb = parseInt(total[1]) / 1024
    if (available) memoryUsedMb = memoryTotalMb - parseInt(available![1]) / 1024
  } catch {
    // /proc/meminfo not available
  }

  return {
    board,
    cpuTemp,
    cpuUsage: 0, // Would need /proc/stat sampling over time
    memoryUsedMb: Math.round(memoryUsedMb),
    memoryTotalMb: Math.round(memoryTotalMb),
    uptime: process.uptime(),
  }
}
