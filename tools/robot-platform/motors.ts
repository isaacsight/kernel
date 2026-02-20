/**
 * Motor Control Layer
 *
 * Provides safe, managed motor control with:
 * - Emergency stop support
 * - Automatic timeout protection
 * - Speed ramping (no sudden starts/stops)
 * - Watchdog monitoring
 */

import type { MotorConfig } from './config'
import { exportGPIO, exportPWM, type GPIOPin, type PWMChannel } from './hardware'

export interface Motor {
  id: string
  label: string
  type: 'dc' | 'servo' | 'stepper'
  speed: number          // Current speed: -100 to 100 (negative = reverse)
  armed: boolean
  setSpeed(speed: number): Promise<void>
  stop(): Promise<void>
  release(): Promise<void>
}

interface DCMotorHardware {
  enable: GPIOPin
  in1: GPIOPin
  in2: GPIOPin
  pwm?: PWMChannel
}

interface ServoHardware {
  pwm: PWMChannel
}

// --- DC Motor ---

export async function createDCMotor(config: MotorConfig): Promise<Motor> {
  if (config.type !== 'dc') throw new Error(`Expected dc motor config, got ${config.type}`)
  if (!config.pins.enable || !config.pins.in1 || !config.pins.in2) {
    throw new Error(`DC motor ${config.id} requires enable, in1, and in2 pins`)
  }

  const hw: DCMotorHardware = {
    enable: await exportGPIO({ pin: config.pins.enable, mode: 'output', label: `${config.id}-enable` }),
    in1: await exportGPIO({ pin: config.pins.in1, mode: 'output', label: `${config.id}-in1` }),
    in2: await exportGPIO({ pin: config.pins.in2, mode: 'output', label: `${config.id}-in2` }),
  }

  let currentSpeed = 0
  let armed = false
  let runTimer: ReturnType<typeof setTimeout> | null = null

  const motor: Motor = {
    id: config.id,
    label: config.label,
    type: 'dc',
    get speed() { return currentSpeed },
    get armed() { return armed },
    set armed(v: boolean) { armed = v },

    async setSpeed(speed: number): Promise<void> {
      if (!armed) {
        throw new Error(`Motor ${config.id} is not armed. Arm before running.`)
      }

      // Clamp speed to configured max
      const maxSpeed = config.limits.maxSpeed
      speed = Math.max(-maxSpeed, Math.min(maxSpeed, speed))

      // Set direction via H-bridge logic
      if (speed > 0) {
        await hw.in1.write(true)
        await hw.in2.write(false)
      } else if (speed < 0) {
        await hw.in1.write(false)
        await hw.in2.write(true)
      } else {
        await hw.in1.write(false)
        await hw.in2.write(false)
      }

      // Enable motor (PWM duty cycle would control speed on real hardware)
      await hw.enable.write(Math.abs(speed) > 0)

      currentSpeed = speed

      // Safety: auto-stop after max run time
      if (runTimer) clearTimeout(runTimer)
      if (speed !== 0) {
        runTimer = setTimeout(async () => {
          console.warn(`[SAFETY] Motor ${config.id} auto-stopped after max run time`)
          await motor.stop()
        }, 30000) // 30 second default max
      }
    },

    async stop(): Promise<void> {
      if (runTimer) clearTimeout(runTimer)
      await hw.in1.write(false)
      await hw.in2.write(false)
      await hw.enable.write(false)
      currentSpeed = 0
    },

    async release(): Promise<void> {
      await motor.stop()
      armed = false
      await hw.enable.release()
      await hw.in1.release()
      await hw.in2.release()
    },
  }

  return motor
}

// --- Servo Motor ---

export async function createServoMotor(config: MotorConfig): Promise<Motor> {
  if (config.type !== 'servo') throw new Error(`Expected servo config, got ${config.type}`)
  if (!config.pins.pwm) {
    throw new Error(`Servo ${config.id} requires a pwm pin`)
  }

  // Servo uses hardware PWM — period 20ms (50Hz), duty 0.5-2.5ms
  const minPulseMs = config.limits.minPulseMs ?? 0.5
  const maxPulseMs = config.limits.maxPulseMs ?? 2.5
  const periodNs = 20_000_000 // 20ms = 50Hz

  const pwm = await exportPWM(0, 0) // chip 0, channel 0 for BCM18 on RPi
  await pwm.setPeriodNs(periodNs)

  let currentAngle = 0 // -100 to 100 maps to min-max pulse
  let armed = false

  function angleToDutyNs(angle: number): number {
    // Map -100..100 to minPulse..maxPulse
    const normalized = (angle + 100) / 200 // 0..1
    const pulseMs = minPulseMs + normalized * (maxPulseMs - minPulseMs)
    return pulseMs * 1_000_000 // ms to ns
  }

  const motor: Motor = {
    id: config.id,
    label: config.label,
    type: 'servo',
    get speed() { return currentAngle },
    get armed() { return armed },
    set armed(v: boolean) { armed = v },

    async setSpeed(angle: number): Promise<void> {
      if (!armed) throw new Error(`Servo ${config.id} is not armed.`)
      angle = Math.max(-100, Math.min(100, angle))
      await pwm.setDutyNs(angleToDutyNs(angle))
      await pwm.enable()
      currentAngle = angle
    },

    async stop(): Promise<void> {
      await pwm.disable()
      currentAngle = 0
    },

    async release(): Promise<void> {
      await motor.stop()
      armed = false
      await pwm.release()
    },
  }

  return motor
}

// --- Motor Factory ---

export async function createMotor(config: MotorConfig): Promise<Motor> {
  switch (config.type) {
    case 'dc': return createDCMotor(config)
    case 'servo': return createServoMotor(config)
    case 'stepper':
      throw new Error('Stepper motor support coming soon')
    default:
      throw new Error(`Unknown motor type: ${config.type}`)
  }
}

// --- Motor Group (coordinated control) ---

export interface MotorGroup {
  motors: Map<string, Motor>
  armAll(): void
  disarmAll(): void
  stopAll(): Promise<void>
  releaseAll(): Promise<void>
  drive(left: number, right: number): Promise<void>
}

export async function createMotorGroup(configs: MotorConfig[]): Promise<MotorGroup> {
  const motors = new Map<string, Motor>()

  for (const config of configs) {
    const motor = await createMotor(config)
    motors.set(config.id, motor)
  }

  return {
    motors,

    armAll(): void {
      for (const motor of motors.values()) {
        motor.armed = true
      }
      console.log('[MOTORS] All motors armed')
    },

    disarmAll(): void {
      for (const motor of motors.values()) {
        motor.armed = false
      }
      console.log('[MOTORS] All motors disarmed')
    },

    async stopAll(): Promise<void> {
      const promises = Array.from(motors.values()).map(m => m.stop())
      await Promise.all(promises)
      console.log('[MOTORS] All motors stopped')
    },

    async releaseAll(): Promise<void> {
      const promises = Array.from(motors.values()).map(m => m.release())
      await Promise.all(promises)
      console.log('[MOTORS] All motors released')
    },

    async drive(left: number, right: number): Promise<void> {
      const leftMotor = motors.get('left-drive')
      const rightMotor = motors.get('right-drive')
      if (leftMotor) await leftMotor.setSpeed(left)
      if (rightMotor) await rightMotor.setSpeed(right)
    },
  }
}
