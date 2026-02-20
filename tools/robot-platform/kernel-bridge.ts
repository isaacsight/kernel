/**
 * Kernel Bridge
 *
 * WebSocket + HTTP server that connects the Linux robot to
 * the Kernel web app. Provides real-time telemetry streaming
 * and receives commands from the dashboard.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { RobotConfig } from './config'
import type { SensorManager, SensorReading } from './sensors'
import type { MotorGroup } from './motors'
import { getSystemInfo } from './hardware'

export interface RobotCommand {
  type: 'drive' | 'motor' | 'arm' | 'disarm' | 'stop' | 'servo' | 'query' | 'ping'
  payload?: {
    left?: number
    right?: number
    motorId?: string
    speed?: number
    angle?: number
    query?: string
  }
}

export interface TelemetryPacket {
  type: 'telemetry' | 'sensor' | 'status' | 'pong' | 'error'
  timestamp: number
  data: Record<string, unknown>
}

export interface KernelBridge {
  start(): Promise<void>
  stop(): void
  broadcast(packet: TelemetryPacket): void
  clientCount(): number
}

export function createKernelBridge(
  config: RobotConfig,
  sensors: SensorManager,
  motors: MotorGroup,
): KernelBridge {
  let httpServer: ReturnType<typeof createServer> | null = null
  let wss: WebSocketServer | null = null
  let telemetryInterval: ReturnType<typeof setInterval> | null = null
  const clients = new Set<WebSocket>()

  // --- Command Handler ---

  async function handleCommand(cmd: RobotCommand, ws: WebSocket): Promise<void> {
    try {
      switch (cmd.type) {
        case 'ping':
          send(ws, { type: 'pong', timestamp: Date.now(), data: {} })
          break

        case 'arm':
          motors.armAll()
          send(ws, { type: 'status', timestamp: Date.now(), data: { armed: true } })
          break

        case 'disarm':
          motors.disarmAll()
          await motors.stopAll()
          send(ws, { type: 'status', timestamp: Date.now(), data: { armed: false } })
          break

        case 'stop':
          await motors.stopAll()
          send(ws, { type: 'status', timestamp: Date.now(), data: { stopped: true } })
          break

        case 'drive':
          if (cmd.payload?.left !== undefined && cmd.payload?.right !== undefined) {
            await motors.drive(cmd.payload.left, cmd.payload.right)
            send(ws, { type: 'status', timestamp: Date.now(), data: {
              driving: true, left: cmd.payload.left, right: cmd.payload.right
            }})
          }
          break

        case 'motor':
          if (cmd.payload?.motorId && cmd.payload?.speed !== undefined) {
            const motor = motors.motors.get(cmd.payload.motorId)
            if (motor) {
              await motor.setSpeed(cmd.payload.speed)
              send(ws, { type: 'status', timestamp: Date.now(), data: {
                motorId: cmd.payload.motorId, speed: cmd.payload.speed
              }})
            }
          }
          break

        case 'servo':
          if (cmd.payload?.motorId && cmd.payload?.angle !== undefined) {
            const servo = motors.motors.get(cmd.payload.motorId)
            if (servo) {
              await servo.setSpeed(cmd.payload.angle)
              send(ws, { type: 'status', timestamp: Date.now(), data: {
                motorId: cmd.payload.motorId, angle: cmd.payload.angle
              }})
            }
          }
          break

        case 'query':
          // Forward natural language queries to Kernel AI for processing
          send(ws, { type: 'status', timestamp: Date.now(), data: {
            query: cmd.payload?.query,
            note: 'AI processing routed through Kernel chat'
          }})
          break

        default:
          send(ws, { type: 'error', timestamp: Date.now(), data: { message: `Unknown command: ${cmd.type}` } })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send(ws, { type: 'error', timestamp: Date.now(), data: { message } })
    }
  }

  // --- Helpers ---

  function send(ws: WebSocket, packet: TelemetryPacket): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(packet))
    }
  }

  function broadcast(packet: TelemetryPacket): void {
    const msg = JSON.stringify(packet)
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    }
  }

  // --- HTTP API ---

  function handleHTTP(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    switch (url.pathname) {
      case '/status': {
        getSystemInfo().then(info => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            name: config.name,
            board: config.board,
            system: info,
            sensors: sensors.getAllReadings(),
            motors: Object.fromEntries(
              Array.from(motors.motors.entries()).map(([id, m]) => [id, {
                label: m.label, type: m.type, speed: m.speed, armed: m.armed
              }])
            ),
            clients: clients.size,
            uptime: process.uptime(),
          }))
        })
        break
      }

      case '/sensors': {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(sensors.getAllReadings()))
        break
      }

      case '/health': {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }))
        break
      }

      default: {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    }
  }

  return {
    async start(): Promise<void> {
      // Create HTTP server
      httpServer = createServer(handleHTTP)

      // Create WebSocket server on the same port
      wss = new WebSocketServer({ server: httpServer })

      wss.on('connection', (ws) => {
        clients.add(ws)
        console.log(`[BRIDGE] Client connected (${clients.size} total)`)

        // Send initial status
        send(ws, {
          type: 'status',
          timestamp: Date.now(),
          data: {
            name: config.name,
            board: config.board,
            sensors: Array.from(sensors.sensors.keys()),
            motors: Array.from(motors.motors.keys()),
          },
        })

        ws.on('message', (data) => {
          try {
            const cmd: RobotCommand = JSON.parse(data.toString())
            handleCommand(cmd, ws)
          } catch {
            send(ws, { type: 'error', timestamp: Date.now(), data: { message: 'Invalid command JSON' } })
          }
        })

        ws.on('close', () => {
          clients.delete(ws)
          console.log(`[BRIDGE] Client disconnected (${clients.size} total)`)

          // Safety: if all clients disconnect, stop motors
          if (clients.size === 0) {
            console.log('[BRIDGE] No clients — stopping motors for safety')
            motors.stopAll()
          }
        })
      })

      // Subscribe to sensor data and broadcast
      sensors.subscribe((reading: SensorReading) => {
        broadcast({
          type: 'sensor',
          timestamp: reading.timestamp,
          data: { sensorId: reading.sensorId, type: reading.type, values: reading.values },
        })
      })

      // Periodic system telemetry
      telemetryInterval = setInterval(async () => {
        const info = await getSystemInfo()
        broadcast({
          type: 'telemetry',
          timestamp: Date.now(),
          data: {
            system: info,
            motors: Object.fromEntries(
              Array.from(motors.motors.entries()).map(([id, m]) => [id, { speed: m.speed, armed: m.armed }])
            ),
          },
        })
      }, 1000) // Every second

      // Start listening
      const port = config.network.httpPort
      httpServer.listen(port, () => {
        console.log(`[BRIDGE] Robot server running on port ${port}`)
        console.log(`[BRIDGE] WebSocket: ws://localhost:${port}`)
        console.log(`[BRIDGE] HTTP API:  http://localhost:${port}/status`)
      })
    },

    stop(): void {
      if (telemetryInterval) clearInterval(telemetryInterval)
      for (const client of clients) client.close()
      clients.clear()
      wss?.close()
      httpServer?.close()
      console.log('[BRIDGE] Server stopped')
    },

    broadcast,

    clientCount(): number {
      return clients.size
    },
  }
}
