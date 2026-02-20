/**
 * Sensor Manager
 *
 * Manages all sensor polling loops and provides a unified
 * real-time data stream from all attached sensors.
 */

import type { SensorConfig } from './config'
import { exportGPIO, readUltrasonic, openI2C, type GPIOPin, type I2CBus } from './hardware'

export interface SensorReading {
  sensorId: string
  type: string
  timestamp: number
  values: Record<string, number>
  raw?: Buffer
}

export interface SensorDriver {
  id: string
  label: string
  type: string
  lastReading: SensorReading | null
  start(): Promise<void>
  stop(): void
  read(): Promise<SensorReading>
}

type SensorListener = (reading: SensorReading) => void

// --- Ultrasonic Sensor Driver ---

async function createUltrasonicDriver(config: SensorConfig): Promise<SensorDriver> {
  if (!config.pins?.trigger || !config.pins?.echo) {
    throw new Error(`Ultrasonic sensor ${config.id} requires trigger and echo pins`)
  }

  const trigger = await exportGPIO({ pin: config.pins.trigger, mode: 'output', label: `${config.id}-trigger` })
  const echo = await exportGPIO({ pin: config.pins.echo, mode: 'input', label: `${config.id}-echo` })

  let interval: ReturnType<typeof setInterval> | null = null
  let lastReading: SensorReading | null = null

  return {
    id: config.id,
    label: config.label,
    type: 'ultrasonic',
    get lastReading() { return lastReading },

    async start(): Promise<void> {
      // Initial read
      lastReading = await this.read()
    },

    stop(): void {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    },

    async read(): Promise<SensorReading> {
      const distanceCm = await readUltrasonic(trigger, echo)
      lastReading = {
        sensorId: config.id,
        type: 'ultrasonic',
        timestamp: Date.now(),
        values: { distanceCm },
      }
      return lastReading
    },
  }
}

// --- IMU Driver (MPU6050 / similar) ---

async function createIMUDriver(config: SensorConfig): Promise<SensorDriver> {
  if (!config.i2c) {
    throw new Error(`IMU sensor ${config.id} requires I2C configuration`)
  }

  const bus = await openI2C(config.i2c.bus)
  const addr = config.i2c.address
  let interval: ReturnType<typeof setInterval> | null = null
  let lastReading: SensorReading | null = null

  // MPU6050 registers
  const ACCEL_XOUT_H = 0x3B
  const GYRO_XOUT_H = 0x43
  const PWR_MGMT_1 = 0x6B

  return {
    id: config.id,
    label: config.label,
    type: 'imu',
    get lastReading() { return lastReading },

    async start(): Promise<void> {
      // Wake up MPU6050 (clear sleep bit)
      await bus.write(addr, PWR_MGMT_1, Buffer.from([0x00]))
      await new Promise(r => setTimeout(r, 100))
    },

    stop(): void {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
      bus.close()
    },

    async read(): Promise<SensorReading> {
      // Read accelerometer (6 bytes: XH, XL, YH, YL, ZH, ZL)
      const accelRaw = await bus.read(addr, ACCEL_XOUT_H, 6)
      const accelX = (accelRaw[0] << 8 | accelRaw[1]) / 16384.0 // ±2g scale
      const accelY = (accelRaw[2] << 8 | accelRaw[3]) / 16384.0
      const accelZ = (accelRaw[4] << 8 | accelRaw[5]) / 16384.0

      // Read gyroscope (6 bytes)
      const gyroRaw = await bus.read(addr, GYRO_XOUT_H, 6)
      const gyroX = (gyroRaw[0] << 8 | gyroRaw[1]) / 131.0 // ±250°/s scale
      const gyroY = (gyroRaw[2] << 8 | gyroRaw[3]) / 131.0
      const gyroZ = (gyroRaw[4] << 8 | gyroRaw[5]) / 131.0

      lastReading = {
        sensorId: config.id,
        type: 'imu',
        timestamp: Date.now(),
        values: { accelX, accelY, accelZ, gyroX, gyroY, gyroZ },
        raw: Buffer.concat([accelRaw, gyroRaw]),
      }
      return lastReading
    },
  }
}

// --- Camera Driver (placeholder for OpenCV/v4l2) ---

async function createCameraDriver(config: SensorConfig): Promise<SensorDriver> {
  let lastReading: SensorReading | null = null

  return {
    id: config.id,
    label: config.label,
    type: 'camera',
    get lastReading() { return lastReading },

    async start(): Promise<void> {
      // In production, would open /dev/video0 via v4l2 or OpenCV
      console.log(`[CAMERA] ${config.label} initialized (CSI/USB)`)
    },

    stop(): void {
      console.log(`[CAMERA] ${config.label} stopped`)
    },

    async read(): Promise<SensorReading> {
      // Camera "readings" are frame metadata — actual frames go through a separate stream
      lastReading = {
        sensorId: config.id,
        type: 'camera',
        timestamp: Date.now(),
        values: {
          fps: 30,
          width: 640,
          height: 480,
          frameCount: 0,
        },
      }
      return lastReading
    },
  }
}

// --- Sensor Factory ---

async function createDriver(config: SensorConfig): Promise<SensorDriver> {
  switch (config.type) {
    case 'ultrasonic': return createUltrasonicDriver(config)
    case 'imu': return createIMUDriver(config)
    case 'camera': return createCameraDriver(config)
    default:
      throw new Error(`Unsupported sensor type: ${config.type}`)
  }
}

// --- Sensor Manager ---

export interface SensorManager {
  sensors: Map<string, SensorDriver>
  subscribe(listener: SensorListener): () => void
  getReading(sensorId: string): SensorReading | null
  getAllReadings(): Record<string, SensorReading | null>
  startAll(): Promise<void>
  stopAll(): void
}

export async function createSensorManager(configs: SensorConfig[]): Promise<SensorManager> {
  const sensors = new Map<string, SensorDriver>()
  const listeners = new Set<SensorListener>()
  const pollIntervals = new Map<string, ReturnType<typeof setInterval>>()

  for (const config of configs) {
    try {
      const driver = await createDriver(config)
      sensors.set(config.id, driver)
    } catch (err) {
      console.error(`[SENSORS] Failed to create ${config.id}: ${err}`)
    }
  }

  function emit(reading: SensorReading) {
    for (const listener of listeners) {
      try { listener(reading) } catch { /* listener error */ }
    }
  }

  return {
    sensors,

    subscribe(listener: SensorListener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    getReading(sensorId: string): SensorReading | null {
      return sensors.get(sensorId)?.lastReading ?? null
    },

    getAllReadings(): Record<string, SensorReading | null> {
      const readings: Record<string, SensorReading | null> = {}
      for (const [id, driver] of sensors) {
        readings[id] = driver.lastReading
      }
      return readings
    },

    async startAll(): Promise<void> {
      for (const [id, driver] of sensors) {
        try {
          await driver.start()

          // Find the config to get poll interval
          const config = configs.find(c => c.id === id)
          if (config) {
            const interval = setInterval(async () => {
              try {
                const reading = await driver.read()
                emit(reading)
              } catch {
                // Sensor read failed — continue polling
              }
            }, config.pollIntervalMs)
            pollIntervals.set(id, interval)
          }

          console.log(`[SENSORS] ${driver.label} started`)
        } catch (err) {
          console.error(`[SENSORS] Failed to start ${id}: ${err}`)
        }
      }
    },

    stopAll(): void {
      for (const [id, interval] of pollIntervals) {
        clearInterval(interval)
      }
      pollIntervals.clear()

      for (const driver of sensors.values()) {
        driver.stop()
      }
      console.log('[SENSORS] All sensors stopped')
    },
  }
}
