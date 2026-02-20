#!/usr/bin/env npx tsx
/**
 * Kernel Robot Platform — Linux Daemon
 *
 * The main entry point for the robot. Run this on your Linux board
 * (Raspberry Pi, Jetson, BeagleBone, etc.) to bring Kernel's AI
 * intelligence into the physical world.
 *
 * Usage:
 *   npx tsx tools/robot-platform/index.ts
 *   npx tsx tools/robot-platform/index.ts --config ./my-robot.json
 *
 * Environment:
 *   KERNEL_URL       — Kernel web app URL (default: https://kernel.chat)
 *   KERNEL_API_KEY   — Supabase JWT for authenticated API calls
 *   ROBOT_PORT       — HTTP/WebSocket port (default: 8080)
 */

import { readFile } from 'node:fs/promises'
import { DEFAULT_ROVER_CONFIG, type RobotConfig } from './config'
import { createMotorGroup } from './motors'
import { createSensorManager } from './sensors'
import { createKernelBridge } from './kernel-bridge'
import { getSystemInfo } from './hardware'

// --- ASCII Banner ---

const BANNER = `
╔══════════════════════════════════════════╗
║     🤖  KERNEL ROBOT PLATFORM  🤖       ║
║                                          ║
║  Linux-native robotics daemon            ║
║  Powered by Kernel AI                    ║
╚══════════════════════════════════════════╝
`

// --- Config Loading ---

async function loadConfig(): Promise<RobotConfig> {
  const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')

  if (configArg) {
    console.log(`[INIT] Loading config from ${configArg}`)
    const raw = await readFile(configArg, 'utf-8')
    return JSON.parse(raw) as RobotConfig
  }

  // Apply environment overrides to default config
  const config = { ...DEFAULT_ROVER_CONFIG }

  if (process.env.KERNEL_URL) config.kernelUrl = process.env.KERNEL_URL
  if (process.env.KERNEL_API_KEY) config.kernelApiKey = process.env.KERNEL_API_KEY
  if (process.env.ROBOT_PORT) config.network.httpPort = parseInt(process.env.ROBOT_PORT, 10)

  return config
}

// --- Main ---

async function main(): Promise<void> {
  console.log(BANNER)

  // Load configuration
  const config = await loadConfig()
  console.log(`[INIT] Robot: ${config.name}`)
  console.log(`[INIT] Board: ${config.board}`)
  console.log(`[INIT] Kernel: ${config.kernelUrl}`)

  // System info
  const sysInfo = await getSystemInfo()
  console.log(`[INIT] Hardware: ${sysInfo.board}`)
  console.log(`[INIT] CPU Temp: ${sysInfo.cpuTemp}°C`)
  console.log(`[INIT] Memory: ${sysInfo.memoryUsedMb}/${sysInfo.memoryTotalMb} MB`)

  // Initialize motor control
  console.log('\n[INIT] Initializing motors...')
  const motors = await createMotorGroup(config.motors)
  for (const [id, motor] of motors.motors) {
    console.log(`  ✓ ${motor.label} (${motor.type}) → ${id}`)
  }

  // Initialize sensors
  console.log('\n[INIT] Initializing sensors...')
  const sensors = await createSensorManager(config.sensors)
  for (const [id, sensor] of sensors.sensors) {
    console.log(`  ✓ ${sensor.label} (${sensor.type}) → ${id}`)
  }

  // Start sensor polling
  await sensors.startAll()

  // Start the Kernel bridge (WebSocket + HTTP server)
  console.log('\n[INIT] Starting Kernel bridge...')
  const bridge = createKernelBridge(config, sensors, motors)
  await bridge.start()

  // Safety: Emergency stop on E-stop button
  if (config.safety.emergencyStopPin) {
    console.log(`[SAFETY] Emergency stop on GPIO ${config.safety.emergencyStopPin}`)
  }
  if (config.safety.requireArmBeforeMotors) {
    console.log('[SAFETY] Motors require explicit arming before use')
  }
  console.log(`[SAFETY] Motor timeout: ${config.safety.maxMotorRunTimeMs / 1000}s`)
  console.log(`[SAFETY] Watchdog: ${config.safety.watchdogTimeoutMs / 1000}s`)

  // Watchdog: if no commands received, disarm motors
  let lastActivity = Date.now()
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > config.safety.watchdogTimeoutMs) {
      if (Array.from(motors.motors.values()).some(m => m.armed)) {
        console.warn('[WATCHDOG] No activity — disarming motors')
        motors.disarmAll()
        motors.stopAll()
      }
    }
  }, 1000)

  console.log('\n════════════════════════════════════')
  console.log('  Robot platform ready.')
  console.log(`  Dashboard: http://localhost:${config.network.httpPort}/status`)
  console.log('  Waiting for Kernel connection...')
  console.log('════════════════════════════════════\n')

  // Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    console.log(`\n[SHUTDOWN] Received ${signal}`)

    clearInterval(watchdog)

    console.log('[SHUTDOWN] Stopping motors...')
    await motors.stopAll()
    await motors.releaseAll()

    console.log('[SHUTDOWN] Stopping sensors...')
    sensors.stopAll()

    console.log('[SHUTDOWN] Stopping bridge...')
    bridge.stop()

    console.log('[SHUTDOWN] Robot platform shut down cleanly.')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Keep the process alive
  process.stdin.resume()
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
