/**
 * Robot Platform Configuration
 *
 * Defines hardware pin mappings, sensor configurations, and
 * connection settings for the Linux robot daemon.
 */

export interface PinConfig {
  pin: number
  mode: 'input' | 'output' | 'pwm'
  label: string
  pullUp?: boolean
}

export interface I2CDevice {
  bus: number
  address: number
  label: string
  driver: 'imu' | 'distance' | 'temperature' | 'adc' | 'oled' | 'custom'
}

export interface MotorConfig {
  id: string
  label: string
  type: 'dc' | 'servo' | 'stepper'
  pins: {
    enable?: number
    in1?: number
    in2?: number
    pwm?: number
    step?: number
    dir?: number
  }
  limits: {
    maxSpeed: number      // 0-100 percentage
    minPulseMs?: number   // servo min pulse width
    maxPulseMs?: number   // servo max pulse width
    stepsPerRev?: number  // stepper motor steps
  }
}

export interface SensorConfig {
  id: string
  label: string
  type: 'ultrasonic' | 'ir' | 'imu' | 'temperature' | 'camera' | 'lidar' | 'encoder'
  interface: 'gpio' | 'i2c' | 'spi' | 'usb' | 'csi'
  pollIntervalMs: number
  pins?: { trigger?: number; echo?: number; data?: number }
  i2c?: { bus: number; address: number }
}

export interface RobotConfig {
  name: string
  board: 'raspberry-pi' | 'jetson-nano' | 'jetson-orin' | 'beaglebone' | 'generic-linux'
  kernelUrl: string
  kernelApiKey: string

  gpio: PinConfig[]
  i2cDevices: I2CDevice[]
  motors: MotorConfig[]
  sensors: SensorConfig[]

  safety: {
    emergencyStopPin?: number
    watchdogTimeoutMs: number
    maxMotorRunTimeMs: number
    requireArmBeforeMotors: boolean
  }

  network: {
    websocketPort: number
    httpPort: number
    enableMdns: boolean
    hostname: string
  }
}

/**
 * Default configuration for a Raspberry Pi-based rover
 */
export const DEFAULT_ROVER_CONFIG: RobotConfig = {
  name: 'kernel-rover',
  board: 'raspberry-pi',
  kernelUrl: 'https://kernel.chat',
  kernelApiKey: '',

  gpio: [
    { pin: 17, mode: 'output', label: 'status-led' },
    { pin: 27, mode: 'output', label: 'armed-led' },
    { pin: 22, mode: 'input', label: 'e-stop-button', pullUp: true },
  ],

  i2cDevices: [
    { bus: 1, address: 0x68, label: 'mpu6050-imu', driver: 'imu' },
    { bus: 1, address: 0x29, label: 'vl53l0x-distance', driver: 'distance' },
  ],

  motors: [
    {
      id: 'left-drive',
      label: 'Left Drive Motor',
      type: 'dc',
      pins: { enable: 12, in1: 5, in2: 6 },
      limits: { maxSpeed: 80 },
    },
    {
      id: 'right-drive',
      label: 'Right Drive Motor',
      type: 'dc',
      pins: { enable: 13, in1: 19, in2: 26 },
      limits: { maxSpeed: 80 },
    },
    {
      id: 'camera-pan',
      label: 'Camera Pan Servo',
      type: 'servo',
      pins: { pwm: 18 },
      limits: { maxSpeed: 100, minPulseMs: 0.5, maxPulseMs: 2.5 },
    },
  ],

  sensors: [
    {
      id: 'front-distance',
      label: 'Front Ultrasonic',
      type: 'ultrasonic',
      interface: 'gpio',
      pollIntervalMs: 100,
      pins: { trigger: 23, echo: 24 },
    },
    {
      id: 'imu',
      label: 'IMU (Gyro + Accel)',
      type: 'imu',
      interface: 'i2c',
      pollIntervalMs: 50,
      i2c: { bus: 1, address: 0x68 },
    },
    {
      id: 'camera',
      label: 'Main Camera',
      type: 'camera',
      interface: 'csi',
      pollIntervalMs: 33, // ~30fps
    },
  ],

  safety: {
    emergencyStopPin: 22,
    watchdogTimeoutMs: 5000,
    maxMotorRunTimeMs: 30000,
    requireArmBeforeMotors: true,
  },

  network: {
    websocketPort: 8765,
    httpPort: 8080,
    enableMdns: true,
    hostname: 'kernel-rover',
  },
}
