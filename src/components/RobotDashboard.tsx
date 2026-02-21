import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Robot Dashboard — Real-time control panel for Kernel-powered robots.
 *
 * Connects to the robot platform daemon via WebSocket and provides:
 * - Live sensor telemetry
 * - Motor control (drive, servo)
 * - Arm/disarm safety controls
 * - System health monitoring
 */

interface SensorData {
  sensorId: string
  type: string
  values: Record<string, number>
  timestamp: number
}

interface MotorState {
  label: string
  type: string
  speed: number
  armed: boolean
}

interface SystemInfo {
  board: string
  cpuTemp: number
  memoryUsedMb: number
  memoryTotalMb: number
  uptime: number
}

interface RobotStatus {
  connected: boolean
  name: string
  board: string
  sensors: Record<string, SensorData | null>
  motors: Record<string, MotorState>
  system: SystemInfo | null
}

export function RobotDashboard() {
  const [robotUrl, setRobotUrl] = useState('ws://localhost:8080')
  const [status, setStatus] = useState<RobotStatus>({
    connected: false,
    name: '',
    board: '',
    sensors: {},
    motors: {},
    system: null,
  })
  const [armed, setArmed] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // --- WebSocket Connection ---

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    addLog(`Connecting to ${robotUrl}...`)
    const ws = new WebSocket(robotUrl)

    ws.onopen = () => {
      addLog('Connected to robot')
      setStatus(s => ({ ...s, connected: true }))
      ws.send(JSON.stringify({ type: 'ping' }))
    }

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data)

        switch (packet.type) {
          case 'status':
            if (packet.data.name) {
              setStatus(s => ({
                ...s,
                name: packet.data.name || s.name,
                board: packet.data.board || s.board,
              }))
              addLog(`Robot: ${packet.data.name} (${packet.data.board})`)
            }
            if (packet.data.armed !== undefined) {
              setArmed(packet.data.armed)
              addLog(packet.data.armed ? 'Motors ARMED' : 'Motors DISARMED')
            }
            if (packet.data.stopped) addLog('All motors stopped')
            if (packet.data.driving) addLog(`Driving: L=${packet.data.left} R=${packet.data.right}`)
            break

          case 'sensor':
            setStatus(s => ({
              ...s,
              sensors: { ...s.sensors, [packet.data.sensorId]: packet.data },
            }))
            break

          case 'telemetry':
            if (packet.data.system) {
              setStatus(s => ({ ...s, system: packet.data.system }))
            }
            if (packet.data.motors) {
              setStatus(s => ({ ...s, motors: packet.data.motors }))
            }
            break

          case 'pong':
            addLog('Pong received')
            break

          case 'error':
            addLog(`Error: ${packet.data.message}`)
            break
        }
      } catch {
        // Invalid JSON
      }
    }

    ws.onclose = () => {
      addLog('Disconnected')
      setStatus(s => ({ ...s, connected: false }))
      setArmed(false)
    }

    ws.onerror = () => {
      addLog('Connection error')
    }

    wsRef.current = ws
  }, [robotUrl, addLog])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type, payload }))
  }, [])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Cleanup on unmount
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  // --- Drive Controls (keyboard) ---

  useEffect(() => {
    if (!armed) return

    const keys = new Set<string>()
    const speed = 60

    function updateDrive() {
      let left = 0, right = 0

      if (keys.has('ArrowUp') || keys.has('w')) { left += speed; right += speed }
      if (keys.has('ArrowDown') || keys.has('s')) { left -= speed; right -= speed }
      if (keys.has('ArrowLeft') || keys.has('a')) { left -= speed * 0.5; right += speed * 0.5 }
      if (keys.has('ArrowRight') || keys.has('d')) { left += speed * 0.5; right -= speed * 0.5 }

      sendCommand('drive', { left: Math.round(left), right: Math.round(right) })
    }

    function onKeyDown(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault()
        keys.add(e.key)
        updateDrive()
      }
      if (e.key === ' ') {
        e.preventDefault()
        sendCommand('stop')
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key)
      if (keys.size === 0) sendCommand('stop')
      else updateDrive()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [armed, sendCommand])

  return (
    <div className="robot-dashboard">
      <style>{`
        .robot-dashboard {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 16px;
          font-family: 'Courier Prime', monospace;
          color: var(--color-slate, #1F1E1D);
        }
        .robot-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .robot-header h1 {
          font-family: 'EB Garamond', serif;
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 4px;
        }
        .robot-header p {
          opacity: 0.5;
          font-size: 13px;
          margin: 0;
        }
        .robot-connection {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          align-items: center;
        }
        .robot-connection input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          font-family: 'Courier Prime', monospace;
          font-size: 13px;
          background: white;
        }
        .robot-btn {
          padding: 8px 16px;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          font-family: 'Courier Prime', monospace;
          font-size: 13px;
          cursor: pointer;
          background: white;
          transition: all 0.15s;
        }
        .robot-btn:hover { background: #f5f5f5; }
        .robot-btn.danger { background: #EF4444; color: white; border-color: #EF4444; }
        .robot-btn.danger:hover { background: #DC2626; }
        .robot-btn.success { background: #22C55E; color: white; border-color: #22C55E; }
        .robot-btn.success:hover { background: #16A34A; }
        .robot-btn.armed { background: #EF4444; color: white; border-color: #EF4444; animation: pulse-armed 2s infinite; }
        @keyframes pulse-armed {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .robot-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #EF4444;
          flex-shrink: 0;
        }
        .robot-status-dot.connected { background: #22C55E; }
        .robot-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 600px) {
          .robot-grid { grid-template-columns: 1fr; }
        }
        .robot-card {
          background: white;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 10px;
          padding: 16px;
        }
        .robot-card h3 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.5;
          margin: 0 0 12px;
        }
        .sensor-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 13px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .sensor-row:last-child { border: none; }
        .sensor-value { font-weight: 600; }
        .drive-controls {
          display: grid;
          grid-template-areas:
            ". up ."
            "left stop right"
            ". down .";
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          max-width: 200px;
          margin: 0 auto;
        }
        .drive-btn {
          padding: 12px;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
          background: white;
          text-align: center;
          transition: all 0.1s;
          user-select: none;
          touch-action: none;
        }
        .drive-btn:active { background: #f0f0f0; transform: scale(0.95); }
        .drive-btn.stop-btn { background: #FEE2E2; grid-area: stop; }
        .drive-up { grid-area: up; }
        .drive-down { grid-area: down; }
        .drive-left { grid-area: left; }
        .drive-right { grid-area: right; }
        .robot-log {
          background: #1F1E1D;
          color: #22C55E;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 12px;
          max-height: 200px;
          overflow-y: auto;
          line-height: 1.6;
        }
        .robot-log .log-line { opacity: 0.8; }
        .robot-log .log-line:last-child { opacity: 1; }
        .safety-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          justify-content: center;
        }
        .keyboard-hint {
          text-align: center;
          font-size: 11px;
          opacity: 0.4;
          margin-top: 8px;
        }
      `}</style>

      {/* Header */}
      <div className="robot-header">
        <h1>Robot Control</h1>
        <p>Kernel-powered Linux robotics platform</p>
      </div>

      {/* Connection */}
      <div className="robot-connection">
        <div className={`robot-status-dot ${status.connected ? 'connected' : ''}`} />
        <input
          value={robotUrl}
          onChange={e => setRobotUrl(e.target.value)}
          placeholder="ws://robot-ip:8080"
          disabled={status.connected}
        />
        {status.connected ? (
          <button className="robot-btn danger" onClick={disconnect}>Disconnect</button>
        ) : (
          <button className="robot-btn success" onClick={connect}>Connect</button>
        )}
      </div>

      {/* Safety Controls */}
      <div className="safety-bar">
        <button
          className={`robot-btn ${armed ? 'armed' : 'success'}`}
          onClick={() => {
            if (armed) {
              sendCommand('disarm')
              setArmed(false)
            } else {
              sendCommand('arm')
              setArmed(true)
            }
          }}
          disabled={!status.connected}
        >
          {armed ? 'DISARM MOTORS' : 'ARM MOTORS'}
        </button>
        <button
          className="robot-btn danger"
          onClick={() => sendCommand('stop')}
          disabled={!status.connected}
        >
          E-STOP
        </button>
      </div>

      <AnimatePresence>
        {status.connected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="robot-grid">

              {/* Drive Controls */}
              <div className="robot-card">
                <h3>Drive</h3>
                <div className="drive-controls">
                  <button
                    className="drive-btn drive-up"
                    onPointerDown={() => sendCommand('drive', { left: 60, right: 60 })}
                    onPointerUp={() => sendCommand('stop')}
                    onPointerLeave={() => sendCommand('stop')}
                    disabled={!armed}
                  >
                    ↑
                  </button>
                  <button
                    className="drive-btn drive-left"
                    onPointerDown={() => sendCommand('drive', { left: -40, right: 40 })}
                    onPointerUp={() => sendCommand('stop')}
                    onPointerLeave={() => sendCommand('stop')}
                    disabled={!armed}
                  >
                    ←
                  </button>
                  <button
                    className="drive-btn stop-btn"
                    onClick={() => sendCommand('stop')}
                    disabled={!armed}
                  >
                    ■
                  </button>
                  <button
                    className="drive-btn drive-right"
                    onPointerDown={() => sendCommand('drive', { left: 40, right: -40 })}
                    onPointerUp={() => sendCommand('stop')}
                    onPointerLeave={() => sendCommand('stop')}
                    disabled={!armed}
                  >
                    →
                  </button>
                  <button
                    className="drive-btn drive-down"
                    onPointerDown={() => sendCommand('drive', { left: -60, right: -60 })}
                    onPointerUp={() => sendCommand('stop')}
                    onPointerLeave={() => sendCommand('stop')}
                    disabled={!armed}
                  >
                    ↓
                  </button>
                </div>
                <p className="keyboard-hint">
                  {armed ? 'WASD or Arrow keys · Space to stop' : 'Arm motors to enable controls'}
                </p>
              </div>

              {/* Sensors */}
              <div className="robot-card">
                <h3>Sensors</h3>
                {Object.entries(status.sensors).length === 0 ? (
                  <p style={{ opacity: 0.4, fontSize: 13 }}>Waiting for sensor data...</p>
                ) : (
                  Object.entries(status.sensors).map(([id, data]) => (
                    data && (
                      <div key={id}>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, marginBottom: 4 }}>
                          {data.type.toUpperCase()} — {id}
                        </div>
                        {Object.entries(data.values).map(([key, val]) => (
                          <div key={key} className="sensor-row">
                            <span>{key}</span>
                            <span className="sensor-value">
                              {typeof val === 'number' ? val.toFixed(2) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  ))
                )}
              </div>

              {/* Motors */}
              <div className="robot-card">
                <h3>Motors</h3>
                {Object.entries(status.motors).length === 0 ? (
                  <p style={{ opacity: 0.4, fontSize: 13 }}>No motor data yet</p>
                ) : (
                  Object.entries(status.motors).map(([id, motor]) => (
                    <div key={id} className="sensor-row">
                      <span>{id}</span>
                      <span className="sensor-value" style={{
                        color: motor.armed ? '#22C55E' : '#999'
                      }}>
                        {motor.armed ? `${motor.speed}%` : 'disarmed'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* System */}
              <div className="robot-card">
                <h3>System</h3>
                {status.system ? (
                  <>
                    <div className="sensor-row">
                      <span>Board</span>
                      <span className="sensor-value">{status.system.board}</span>
                    </div>
                    <div className="sensor-row">
                      <span>CPU Temp</span>
                      <span className="sensor-value" style={{
                        color: status.system.cpuTemp > 70 ? '#EF4444' : 'inherit'
                      }}>
                        {status.system.cpuTemp.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="sensor-row">
                      <span>Memory</span>
                      <span className="sensor-value">
                        {status.system.memoryUsedMb}/{status.system.memoryTotalMb} MB
                      </span>
                    </div>
                    <div className="sensor-row">
                      <span>Uptime</span>
                      <span className="sensor-value">
                        {Math.floor(status.system.uptime / 60)}m
                      </span>
                    </div>
                  </>
                ) : (
                  <p style={{ opacity: 0.4, fontSize: 13 }}>Waiting for system info...</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log */}
      <div className="robot-log">
        {log.length === 0 ? (
          <div className="log-line" style={{ opacity: 0.4 }}>
            Connect to a robot to begin...
          </div>
        ) : (
          log.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
