# Kernel Robot Platform — Engineer Build Guide

> A Linux-native robotics daemon powered by the Kernel AI engine.
> This document covers everything needed to build, wire, and deploy a Kernel-controlled robot.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                  KERNEL WEB APP                       │
│  kernel.chat/#/robot  →  Robot Dashboard UI           │
│  WebSocket client  →  real-time telemetry + commands  │
└──────────────┬───────────────────────────────────────┘
               │ WebSocket (ws://robot-ip:8080)
               ▼
┌──────────────────────────────────────────────────────┐
│              LINUX ROBOT DAEMON                       │
│  tools/robot-platform/index.ts                        │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Kernel Bridge│  │ Motor Control│  │Sensor Manager│ │
│  │  (WebSocket) │  │  (GPIO/PWM)  │  │ (I2C/GPIO)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                  │         │
│         ▼                ▼                  ▼         │
│  ┌─────────────────────────────────────────────────┐ │
│  │            Hardware Abstraction Layer            │ │
│  │  GPIO (sysfs)  │  I2C (/dev)  │  PWM (sysfs)   │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              PHYSICAL HARDWARE                        │
│  Motors (H-bridge)  │  Sensors (ultrasonic, IMU)      │
│  Servos (PWM)       │  Camera (CSI/USB)               │
└──────────────────────────────────────────────────────┘
```

## 2. Hardware Requirements

### Recommended Board
- **Raspberry Pi 4B** (4GB+ RAM) — best documented, widest library support
- Alternative: Jetson Nano (if you need GPU for vision), BeagleBone Black

### Bill of Materials (Basic Rover)

| Component | Qty | Purpose | Notes |
|-----------|-----|---------|-------|
| Raspberry Pi 4B | 1 | Main controller | 4GB RAM minimum |
| L298N Motor Driver | 1 | H-bridge for DC motors | Handles 2 motors |
| DC Geared Motors | 2 | Drive motors | 6V, with encoder preferred |
| Robot chassis + wheels | 1 | Physical frame | 2WD or 4WD kit |
| HC-SR04 Ultrasonic | 1 | Front distance sensor | 3.3V logic level! |
| MPU6050 (GY-521) | 1 | IMU (gyro + accelerometer) | I2C, 3.3V |
| SG90 Micro Servo | 1 | Camera pan | PWM control |
| Pi Camera v2 or USB webcam | 1 | Vision | CSI preferred |
| 18650 Battery pack (2S) | 1 | Power | 7.4V for motors |
| 5V Buck converter | 1 | Power the Pi from battery | 3A output minimum |
| Breadboard + jumper wires | 1 set | Prototyping | M-F and M-M |
| Level shifter (3.3V-5V) | 1 | For ultrasonic echo pin | Bidirectional |

### Wiring Diagram (Default Pin Config)

```
Raspberry Pi GPIO → L298N Motor Driver
──────────────────────────────────────
GPIO 12 (PWM0) → ENA (left motor enable)
GPIO 5        → IN1 (left motor forward)
GPIO 6        → IN2 (left motor reverse)
GPIO 13 (PWM1)→ ENB (right motor enable)
GPIO 19       → IN3 (right motor forward)
GPIO 26       → IN4 (right motor reverse)

Raspberry Pi → HC-SR04 Ultrasonic
─────────────────────────────────
GPIO 23       → TRIG
GPIO 24       → ECHO (through 3.3V level shifter!)

Raspberry Pi → MPU6050 IMU
─────────────────────────────
GPIO 2 (SDA1) → SDA
GPIO 3 (SCL1) → SCL
3.3V          → VCC
GND           → GND

Raspberry Pi → SG90 Servo
─────────────────────────────
GPIO 18 (PWM0)→ Signal (orange wire)
5V            → VCC (red wire)
GND           → GND (brown wire)

Status LEDs
─────────────────────────────
GPIO 17       → Status LED (green) + 330Ω resistor
GPIO 27       → Armed LED (red) + 330Ω resistor

Emergency Stop
─────────────────────────────
GPIO 22       → Normally-closed push button → GND
```

**CRITICAL: The HC-SR04 echo pin outputs 5V. Use a voltage divider (1kΩ + 2kΩ) or level shifter to protect the Pi's 3.3V GPIO.**

## 3. Software Setup

### Prerequisites

```bash
# On the Raspberry Pi:
sudo apt update && sudo apt install -y \
  nodejs npm \
  i2c-tools \
  python3-smbus \
  libgpiod-dev

# Enable I2C and SPI
sudo raspi-config
# → Interface Options → I2C → Enable
# → Interface Options → SPI → Enable
# → Reboot

# Verify I2C
i2cdetect -y 1
# Should show 0x68 (MPU6050) and any other I2C devices

# Install Node.js 20+ (if default is too old)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Clone & Install

```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel
npm install

# Install robot-specific dependencies
npm install ws
```

### Configuration

Edit `tools/robot-platform/config.ts` or create a custom JSON config:

```json
{
  "name": "my-robot",
  "board": "raspberry-pi",
  "kernelUrl": "https://kernel.chat",
  "kernelApiKey": "YOUR_SUPABASE_JWT",
  "network": {
    "httpPort": 8080,
    "websocketPort": 8765,
    "enableMdns": true,
    "hostname": "kernel-rover"
  }
}
```

### Run the Daemon

```bash
# With default config
npx tsx tools/robot-platform/index.ts

# With custom config
npx tsx tools/robot-platform/index.ts --config ./my-robot.json

# With environment overrides
KERNEL_URL=https://kernel.chat ROBOT_PORT=8080 npx tsx tools/robot-platform/index.ts
```

### Run as a Systemd Service (auto-start on boot)

```bash
sudo tee /etc/systemd/system/kernel-robot.service << 'EOF'
[Unit]
Description=Kernel Robot Platform
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/kernel
ExecStart=/usr/bin/npx tsx tools/robot-platform/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable kernel-robot
sudo systemctl start kernel-robot
sudo journalctl -u kernel-robot -f  # Watch logs
```

## 4. Control Interface

### Web Dashboard

Navigate to `https://kernel.chat/#/robot` (or `localhost:5173/#/robot` in dev).

1. Enter the robot's WebSocket URL: `ws://<robot-ip>:8080`
2. Click **Connect**
3. Click **ARM MOTORS** (safety gate)
4. Use arrow keys (WASD) or touch buttons to drive
5. Press **Space** or **E-STOP** to emergency stop

### Keyboard Controls (when armed)

| Key | Action |
|-----|--------|
| W / ↑ | Forward |
| S / ↓ | Reverse |
| A / ← | Turn left |
| D / → | Turn right |
| Space | Emergency stop |

### HTTP API (on the robot)

```bash
# Check robot status
curl http://robot-ip:8080/status

# Health check
curl http://robot-ip:8080/health

# Sensor readings
curl http://robot-ip:8080/sensors
```

### WebSocket Commands (JSON)

```json
{"type": "ping"}
{"type": "arm"}
{"type": "disarm"}
{"type": "stop"}
{"type": "drive", "payload": {"left": 60, "right": 60}}
{"type": "motor", "payload": {"motorId": "left-drive", "speed": 50}}
{"type": "servo", "payload": {"motorId": "camera-pan", "angle": 45}}
```

## 5. Safety Checklist

Before first power-on:

- [ ] Double-check all wiring against the pin diagram above
- [ ] Verify the 5V→3.3V level shifter on the ultrasonic echo pin
- [ ] Ensure motor power supply is separate from Pi power (avoid brownouts)
- [ ] Test motors at LOW speed first (set maxSpeed to 30 in config)
- [ ] Verify emergency stop button is wired and responsive
- [ ] Keep the robot on a stand/elevated for initial motor tests
- [ ] Have a way to kill power quickly (switch on the battery)

### Safety Features Built In

1. **Arm/Disarm gate** — motors won't spin until explicitly armed
2. **Auto-stop timeout** — motors stop after 30 seconds of continuous run
3. **Watchdog timer** — if no commands received for 5 seconds, motors disarm
4. **Client disconnect** — if all WebSocket clients disconnect, motors stop
5. **Graceful shutdown** — SIGINT/SIGTERM cleanly releases all GPIO pins

## 6. File Map

```
tools/robot-platform/
├── index.ts          # Main daemon entry point
├── config.ts         # Hardware configuration & pin mappings
├── hardware.ts       # GPIO, I2C, PWM abstraction layer
├── motors.ts         # Motor control (DC, servo, stepper)
├── sensors.ts        # Sensor polling & data streaming
├── kernel-bridge.ts  # WebSocket server + HTTP API
└── ENGINEER-GUIDE.md # This document

src/agents/robot.ts             # Robot AI specialist personality
src/components/RobotDashboard.tsx # Web control dashboard
src/pages/RobotPage.tsx          # Robot page route

supabase/functions/robot-command/ # Edge function for cloud relay
```

## 7. Extending the Platform

### Adding a New Sensor

1. Add the sensor config to `config.ts` (SensorConfig type)
2. Create a driver in `sensors.ts` (implement `SensorDriver` interface)
3. Register it in the `createDriver()` factory function
4. The SensorManager will automatically poll and broadcast readings

### Adding a New Motor Type

1. Add the motor config to `config.ts` (MotorConfig type)
2. Create a motor controller in `motors.ts` (implement `Motor` interface)
3. Register it in the `createMotor()` factory function

### Adding Computer Vision

```bash
# Install OpenCV for Node.js
npm install opencv4nodejs-prebuilt

# Or use Python bridge:
pip3 install opencv-python
```

The camera driver in `sensors.ts` is a placeholder — swap in real OpenCV frame capture for object detection, line following, etc.

### ROS Integration

For full ROS support, install ROS 2 Humble on the Pi and bridge via rclnodejs:

```bash
# ROS 2 setup (Ubuntu 22.04 on Pi)
sudo apt install ros-humble-ros-base
npm install rclnodejs
```

---

**Questions?** Ask the Robot specialist in Kernel chat — it knows this entire system.
