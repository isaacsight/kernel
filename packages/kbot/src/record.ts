// K:BOT Terminal Recording — Capture sessions as SVG, GIF, or Asciicast
//
// Records terminal sessions with full timing data for animated playback.
// Output formats:
//   - SVG: Animated terminal replay for READMEs (no dependencies)
//   - GIF: Via ImageMagick/ffmpeg if available
//   - Asciicast v2: Compatible with asciinema player
//   - JSON: Raw frame data for custom renderers
//
// Usage:
//   kbot record start                     # Start recording
//   kbot record stop                      # Stop + choose format
//   kbot record start --output demo.svg   # Auto-save as SVG
//   kbot record list                      # Show saved recordings
//   kbot record replay <file>             # Replay in terminal

import { homedir, platform } from 'node:os'
import { join, extname, basename } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, unlinkSync, statSync,
} from 'node:fs'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { Command } from 'commander'

// ── Paths ──

const RECORDINGS_DIR = join(homedir(), '.kbot', 'recordings')
const STATE_FILE = join(RECORDINGS_DIR, '.recording-state.json')

function ensureDir(): void {
  if (!existsSync(RECORDINGS_DIR)) mkdirSync(RECORDINGS_DIR, { recursive: true })
}

// ── Types ──

export interface RecordFrame {
  /** Time offset from recording start, in seconds */
  time: number
  /** Raw terminal output data */
  data: string
}

export interface Recording {
  /** Unique recording ID */
  id: string
  /** Recording title */
  title: string
  /** ISO timestamp of when the recording started */
  startedAt: string
  /** Total duration in seconds */
  duration: number
  /** Terminal columns */
  cols: number
  /** Terminal rows */
  rows: number
  /** Captured frames */
  frames: RecordFrame[]
  /** Environment info */
  env: {
    shell: string
    term: string
    platform: string
  }
}

export interface RecordOptions {
  /** Output file path (determines format from extension) */
  output?: string
  /** Recording title */
  title?: string
  /** Terminal columns override */
  cols?: number
  /** Terminal rows override */
  rows?: number
  /** Shell to spawn (defaults to $SHELL or /bin/bash) */
  shell?: string
}

export interface SVGOptions {
  /** Color theme */
  theme?: 'dark' | 'light' | 'monokai' | 'dracula'
  /** Terminal width in columns */
  cols?: number
  /** Terminal height in rows */
  rows?: number
  /** Font size in pixels */
  fontSize?: number
  /** Window title */
  title?: string
  /** Include terminal chrome (title bar, dots) */
  chrome?: boolean
  /** Playback speed multiplier */
  speed?: number
  /** Loop animation */
  loop?: boolean
}

export interface GIFOptions {
  /** Frames per second */
  fps?: number
  /** Terminal width in columns */
  cols?: number
  /** Terminal height in rows */
  rows?: number
  /** Font size in pixels */
  fontSize?: number
  /** Color theme */
  theme?: 'dark' | 'light' | 'monokai' | 'dracula'
  /** Playback speed multiplier */
  speed?: number
}

interface RecordingState {
  pid: number
  id: string
  startedAt: string
  scriptFile: string
  timingFile: string
  output?: string
  title?: string
  cols: number
  rows: number
  shell: string
}

// ── Theme definitions ──

interface ThemeColors {
  bg: string
  fg: string
  titleBg: string
  titleFg: string
  dotRed: string
  dotYellow: string
  dotGreen: string
  cursor: string
  bold: string
  dim: string
}

const THEMES: Record<string, ThemeColors> = {
  dark: {
    bg: '#1a1a2e',
    fg: '#e0e0e0',
    titleBg: '#16162a',
    titleFg: '#8888aa',
    dotRed: '#ff5f57',
    dotYellow: '#febc2e',
    dotGreen: '#28c840',
    cursor: '#a78bfa',
    bold: '#ffffff',
    dim: '#666680',
  },
  light: {
    bg: '#fafaf8',
    fg: '#2e2e2e',
    titleBg: '#e8e8e4',
    titleFg: '#888888',
    dotRed: '#ff5f57',
    dotYellow: '#febc2e',
    dotGreen: '#28c840',
    cursor: '#6B5B95',
    bold: '#000000',
    dim: '#999999',
  },
  monokai: {
    bg: '#272822',
    fg: '#f8f8f2',
    titleBg: '#1e1f1c',
    titleFg: '#75715e',
    dotRed: '#f92672',
    dotYellow: '#e6db74',
    dotGreen: '#a6e22e',
    cursor: '#fd971f',
    bold: '#ffffff',
    dim: '#75715e',
  },
  dracula: {
    bg: '#282a36',
    fg: '#f8f8f2',
    titleBg: '#21222c',
    titleFg: '#6272a4',
    dotRed: '#ff5555',
    dotYellow: '#f1fa8c',
    dotGreen: '#50fa7b',
    cursor: '#bd93f9',
    bold: '#ffffff',
    dim: '#6272a4',
  },
}

// ── ANSI stripping ──

/** Strip ANSI escape codes from a string for measuring / rendering */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')  // OSC sequences
    .replace(/\x1b\(B/g, '')              // charset selection
    .replace(/\r/g, '')                   // carriage returns
}

/** Escape XML special characters */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Recording ID generation ──

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '')
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  return `rec-${date}-${time}-${rand}`
}

// ── Recording state management ──

function saveState(state: RecordingState): void {
  ensureDir()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

function loadState(): RecordingState | null {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function clearState(): void {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE)
}

function isRecording(): boolean {
  const state = loadState()
  if (!state) return false
  // Check if the process is still alive
  try {
    process.kill(state.pid, 0)
    return true
  } catch {
    // Process is dead — clean up stale state
    clearState()
    return false
  }
}

// ── Start / Stop recording ──

/**
 * Start recording the terminal session.
 *
 * Uses the `script` command (POSIX) to capture all terminal output
 * with timing data. Works on macOS and Linux.
 */
export function startRecording(options: RecordOptions = {}): {
  success: boolean
  message: string
  id?: string
} {
  if (isRecording()) {
    return { success: false, message: 'A recording is already in progress. Run `kbot record stop` first.' }
  }

  ensureDir()

  const id = generateId()
  const cols = options.cols || process.stdout.columns || 80
  const rows = options.rows || process.stdout.rows || 24
  const shell = options.shell || process.env.SHELL || '/bin/bash'
  const title = options.title || `K:BOT Recording ${id}`

  const scriptFile = join(RECORDINGS_DIR, `${id}.script`)
  const timingFile = join(RECORDINGS_DIR, `${id}.timing`)

  // Build the script command based on platform
  let child: ChildProcess

  if (platform() === 'darwin') {
    // macOS: script -q <file> uses a subshell;
    // timing is captured with our own wrapper
    child = spawn('script', ['-q', scriptFile], {
      stdio: 'inherit',
      env: {
        ...process.env,
        KBOT_RECORDING: '1',
        KBOT_RECORDING_ID: id,
        COLUMNS: String(cols),
        LINES: String(rows),
      },
    })
  } else {
    // Linux: script -q --timing=<file> -c <shell> <file>
    child = spawn('script', [
      '-q',
      `--timing=${timingFile}`,
      '-c', shell,
      scriptFile,
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        KBOT_RECORDING: '1',
        KBOT_RECORDING_ID: id,
        COLUMNS: String(cols),
        LINES: String(rows),
      },
    })
  }

  // Write start time for timing reconstruction
  writeFileSync(timingFile, `${Date.now()}\n`, 'utf-8')

  const state: RecordingState = {
    pid: child.pid!,
    id,
    startedAt: new Date().toISOString(),
    scriptFile,
    timingFile,
    output: options.output,
    title: options.title,
    cols,
    rows,
    shell,
  }

  saveState(state)

  // When the child exits, we process the recording
  child.on('exit', () => {
    processRecordingOnExit(state)
  })

  return {
    success: true,
    message: `Recording started (${id}). Type \`exit\` or press Ctrl-D to stop.`,
    id,
  }
}

/**
 * Stop an active recording session.
 */
export function stopRecording(): {
  success: boolean
  message: string
  recording?: Recording
  outputPath?: string
} {
  const state = loadState()
  if (!state) {
    return { success: false, message: 'No active recording found.' }
  }

  // Send SIGHUP to the script process to terminate it
  try {
    process.kill(state.pid, 'SIGHUP')
  } catch {
    // Process may already be dead
  }

  // Wait briefly for the file to be flushed, then process
  const recording = buildRecordingFromScript(state)
  if (!recording) {
    clearState()
    return { success: false, message: 'Failed to read recording data.' }
  }

  // Save the recording JSON
  const jsonPath = join(RECORDINGS_DIR, `${state.id}.json`)
  writeFileSync(jsonPath, JSON.stringify(recording, null, 2), 'utf-8')

  // Determine output format
  let outputPath: string | undefined
  if (state.output) {
    const ext = extname(state.output).toLowerCase()
    switch (ext) {
      case '.svg':
        writeFileSync(state.output, toSVG(recording), 'utf-8')
        outputPath = state.output
        break
      case '.gif':
        outputPath = toGIF(recording, state.output)
        break
      case '.cast':
        writeFileSync(state.output, toAsciicast(recording), 'utf-8')
        outputPath = state.output
        break
      default:
        writeFileSync(state.output, JSON.stringify(recording, null, 2), 'utf-8')
        outputPath = state.output
    }
  }

  // Clean up intermediate files
  cleanupTempFiles(state)
  clearState()

  return {
    success: true,
    message: outputPath
      ? `Recording saved: ${outputPath} (${recording.duration.toFixed(1)}s, ${recording.frames.length} frames)`
      : `Recording saved: ${jsonPath} (${recording.duration.toFixed(1)}s, ${recording.frames.length} frames)`,
    recording,
    outputPath: outputPath || jsonPath,
  }
}

/** Process a recording after the script session exits naturally */
function processRecordingOnExit(state: RecordingState): void {
  try {
    const recording = buildRecordingFromScript(state)
    if (!recording) {
      clearState()
      return
    }

    const jsonPath = join(RECORDINGS_DIR, `${state.id}.json`)
    writeFileSync(jsonPath, JSON.stringify(recording, null, 2), 'utf-8')

    if (state.output) {
      const ext = extname(state.output).toLowerCase()
      switch (ext) {
        case '.svg':
          writeFileSync(state.output, toSVG(recording), 'utf-8')
          break
        case '.gif':
          toGIF(recording, state.output)
          break
        case '.cast':
          writeFileSync(state.output, toAsciicast(recording), 'utf-8')
          break
        default:
          writeFileSync(state.output, JSON.stringify(recording, null, 2), 'utf-8')
      }
    }

    cleanupTempFiles(state)
    clearState()
  } catch {
    clearState()
  }
}

/** Build a Recording from script output + timing data */
function buildRecordingFromScript(state: RecordingState): Recording | null {
  if (!existsSync(state.scriptFile)) return null

  const rawScript = readFileSync(state.scriptFile, 'utf-8')
  const startTime = parseTimingFile(state.timingFile)

  // Split the raw script output into frames
  // Each line break or substantial chunk of output becomes a frame
  const frames = buildFrames(rawScript, startTime)
  const duration = frames.length > 0 ? frames[frames.length - 1].time : 0

  return {
    id: state.id,
    title: state.title || `K:BOT Recording ${state.id}`,
    startedAt: state.startedAt,
    duration,
    cols: state.cols,
    rows: state.rows,
    frames,
    env: {
      shell: state.shell,
      term: process.env.TERM || 'xterm-256color',
      platform: platform(),
    },
  }
}

/** Parse the timing file to get the start timestamp */
function parseTimingFile(timingFile: string): number {
  if (!existsSync(timingFile)) return Date.now()
  try {
    const content = readFileSync(timingFile, 'utf-8').trim()
    const firstLine = content.split('\n')[0]
    const ts = parseInt(firstLine, 10)
    return isNaN(ts) ? Date.now() : ts
  } catch {
    return Date.now()
  }
}

/**
 * Build frame array from raw script output.
 *
 * Splits output into logical frames: each line or burst of output
 * becomes a separate frame with simulated timing based on content length.
 */
function buildFrames(rawOutput: string, _startTime: number): RecordFrame[] {
  const frames: RecordFrame[] = []

  // Split on newlines, preserving the newline in each chunk
  const lines = rawOutput.split('\n')
  let elapsed = 0

  for (const line of lines) {
    if (line.length === 0 && frames.length > 0) {
      // Empty line — small pause
      elapsed += 0.05
      frames.push({ time: elapsed, data: '\n' })
      continue
    }

    // Simulate realistic typing timing:
    //   - Short lines (prompts, commands): 0.03s per char (typing)
    //   - Long lines (output): burst at 0.001s per char
    const stripped = stripAnsi(line)
    const isTyping = stripped.length < 80 && (
      stripped.includes('$') || stripped.includes('>')
      || stripped.includes('#') || stripped.startsWith('kbot')
    )

    if (isTyping) {
      // Character-by-character typing for prompts
      for (const char of line) {
        elapsed += 0.03 + Math.random() * 0.05
        frames.push({ time: elapsed, data: char })
      }
      elapsed += 0.02
      frames.push({ time: elapsed, data: '\n' })
    } else {
      // Burst output
      elapsed += 0.01 + (stripped.length * 0.001)
      frames.push({ time: elapsed, data: line + '\n' })
    }
  }

  return frames
}

/** Clean up intermediate .script and .timing files */
function cleanupTempFiles(state: RecordingState): void {
  try { if (existsSync(state.scriptFile)) unlinkSync(state.scriptFile) } catch { /* ignore */ }
  try { if (existsSync(state.timingFile)) unlinkSync(state.timingFile) } catch { /* ignore */ }
}

// ── SVG Generation ──

/**
 * Convert a recording to an animated SVG.
 *
 * Produces a self-contained SVG with CSS keyframe animations that
 * replays the terminal session. Compatible with GitHub READMEs,
 * browsers, and any SVG viewer.
 */
export function toSVG(recording: Recording, options: SVGOptions = {}): string {
  const theme = THEMES[options.theme || 'dark'] || THEMES.dark
  const cols = options.cols || recording.cols || 80
  const rows = options.rows || recording.rows || 24
  const fontSize = options.fontSize || 14
  const chrome = options.chrome !== false
  const speed = options.speed || 1
  const loop = options.loop !== false
  const title = options.title || recording.title || 'K:BOT Terminal'

  const charWidth = fontSize * 0.6
  const lineHeight = fontSize * 1.4
  const padding = 16
  const chromeHeight = chrome ? 40 : 0

  const width = Math.ceil(cols * charWidth + padding * 2)
  const height = Math.ceil(rows * lineHeight + padding * 2 + chromeHeight)

  // Build screen states from frames
  const screenStates = buildScreenStates(recording.frames, cols, rows, speed)
  const totalDuration = screenStates.length > 0
    ? screenStates[screenStates.length - 1].time + 2
    : 5

  // Generate SVG
  const lines: string[] = []

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`)
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`)
  lines.push(`<defs>`)
  lines.push(`  <style>`)
  lines.push(`    @keyframes cursor-blink {`)
  lines.push(`      0%, 50% { opacity: 1; }`)
  lines.push(`      51%, 100% { opacity: 0; }`)
  lines.push(`    }`)

  // Generate visibility keyframes for each screen state
  for (let i = 0; i < screenStates.length; i++) {
    const startPct = (screenStates[i].time / totalDuration) * 100
    const endPct = i < screenStates.length - 1
      ? (screenStates[i + 1].time / totalDuration) * 100
      : 100

    lines.push(`    @keyframes frame-${i} {`)
    lines.push(`      0%, ${Math.max(0, startPct - 0.01).toFixed(2)}% { visibility: hidden; }`)
    lines.push(`      ${startPct.toFixed(2)}%, ${endPct.toFixed(2)}% { visibility: visible; }`)
    if (endPct < 100) {
      lines.push(`      ${(endPct + 0.01).toFixed(2)}%, 100% { visibility: hidden; }`)
    }
    lines.push(`    }`)
  }

  lines.push(`  </style>`)
  lines.push(`</defs>`)

  // Background
  lines.push(`<rect width="${width}" height="${height}" rx="8" ry="8" fill="${theme.bg}"/>`)

  // Terminal chrome (title bar with traffic light dots)
  if (chrome) {
    lines.push(`<rect width="${width}" height="${chromeHeight}" rx="8" ry="0" fill="${theme.titleBg}"/>`)
    // Clip the bottom corners of the title bar
    lines.push(`<rect x="0" y="${chromeHeight - 8}" width="${width}" height="8" fill="${theme.titleBg}"/>`)

    // Traffic light dots
    const dotY = chromeHeight / 2
    const dotR = 6
    lines.push(`<circle cx="${padding + dotR}" cy="${dotY}" r="${dotR}" fill="${theme.dotRed}"/>`)
    lines.push(`<circle cx="${padding + dotR * 3 + 4}" cy="${dotY}" r="${dotR}" fill="${theme.dotYellow}"/>`)
    lines.push(`<circle cx="${padding + dotR * 5 + 8}" cy="${dotY}" r="${dotR}" fill="${theme.dotGreen}"/>`)

    // Title text
    const titleX = width / 2
    lines.push(`<text x="${titleX}" y="${dotY + 4}" fill="${theme.titleFg}" font-family="monospace" font-size="${fontSize - 2}" text-anchor="middle">${escapeXML(title)}</text>`)
  }

  // Render each screen state as a group with visibility animation
  const contentY = chromeHeight + padding

  for (let i = 0; i < screenStates.length; i++) {
    const state = screenStates[i]
    const animDuration = totalDuration.toFixed(2)
    const iterCount = loop ? 'infinite' : '1'

    lines.push(`<g style="visibility:hidden;animation:frame-${i} ${animDuration}s linear ${iterCount}">`)

    // Render each line of the screen state
    for (let row = 0; row < state.lines.length && row < rows; row++) {
      const line = state.lines[row]
      if (!line || line.trim().length === 0) continue

      const x = padding
      const y = contentY + (row + 1) * lineHeight
      lines.push(`  <text x="${x}" y="${y}" fill="${theme.fg}" font-family="'Courier New',monospace" font-size="${fontSize}" xml:space="preserve">${escapeXML(line)}</text>`)
    }

    // Cursor (blinking block at end of last non-empty line)
    const lastLineIdx = findLastNonEmptyLine(state.lines)
    if (lastLineIdx >= 0) {
      const cursorX = padding + state.lines[lastLineIdx].length * charWidth
      const cursorY = contentY + lastLineIdx * lineHeight + 2
      lines.push(`  <rect x="${cursorX}" y="${cursorY}" width="${charWidth}" height="${lineHeight}" fill="${theme.cursor}" opacity="0.7" style="animation:cursor-blink 1s step-end infinite"/>`)
    }

    lines.push(`</g>`)
  }

  // Watermark
  lines.push(`<text x="${width - padding}" y="${height - 6}" fill="${theme.dim}" font-family="monospace" font-size="10" text-anchor="end" opacity="0.5">recorded with kbot</text>`)

  lines.push(`</svg>`)

  return lines.join('\n')
}

/** Find the last non-empty line index */
function findLastNonEmptyLine(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] && lines[i].trim().length > 0) return i
  }
  return -1
}

/** Build discrete screen states from a frame sequence */
interface ScreenState {
  time: number
  lines: string[]
}

function buildScreenStates(
  frames: RecordFrame[],
  cols: number,
  rows: number,
  speed: number,
): ScreenState[] {
  const states: ScreenState[] = []
  const screen: string[] = new Array(rows).fill('')
  let cursorRow = 0

  // Accumulate frames and snapshot at intervals
  // For SVG, we snapshot every ~0.1 seconds of real content change
  let lastSnapshotTime = -1
  const minInterval = 0.1 / speed
  let pendingData = ''

  for (const frame of frames) {
    pendingData += frame.data
    const adjustedTime = frame.time / speed

    if (adjustedTime - lastSnapshotTime < minInterval) continue

    // Apply pending data to the virtual screen
    const result = applyToScreen(screen, cursorRow, pendingData, cols, rows)
    cursorRow = result.cursorRow
    pendingData = ''

    // Take a snapshot
    states.push({
      time: adjustedTime,
      lines: [...screen],
    })
    lastSnapshotTime = adjustedTime
  }

  // Final state with remaining data
  if (pendingData.length > 0) {
    const result = applyToScreen(screen, cursorRow, pendingData, cols, rows)
    cursorRow = result.cursorRow
    const finalTime = frames.length > 0 ? frames[frames.length - 1].time / speed : 0
    states.push({
      time: finalTime,
      lines: [...screen],
    })
  }

  // Deduplicate identical consecutive states
  const deduped: ScreenState[] = []
  for (const state of states) {
    if (deduped.length === 0) {
      deduped.push(state)
      continue
    }
    const prev = deduped[deduped.length - 1]
    const same = prev.lines.length === state.lines.length
      && prev.lines.every((l, i) => l === state.lines[i])
    if (!same) {
      deduped.push(state)
    }
  }

  // Cap at a reasonable number of frames for SVG size
  const MAX_SVG_FRAMES = 200
  if (deduped.length > MAX_SVG_FRAMES) {
    const step = Math.ceil(deduped.length / MAX_SVG_FRAMES)
    const sampled: ScreenState[] = []
    for (let i = 0; i < deduped.length; i += step) {
      sampled.push(deduped[i])
    }
    // Always include the last frame
    if (sampled[sampled.length - 1] !== deduped[deduped.length - 1]) {
      sampled.push(deduped[deduped.length - 1])
    }
    return sampled
  }

  return deduped
}

/** Apply raw data to a virtual screen buffer, handling newlines and basic ANSI */
function applyToScreen(
  screen: string[],
  cursorRow: number,
  data: string,
  cols: number,
  rows: number,
): { cursorRow: number } {
  const clean = stripAnsi(data)

  for (const char of clean) {
    if (char === '\n') {
      cursorRow++
      if (cursorRow >= rows) {
        // Scroll up
        screen.shift()
        screen.push('')
        cursorRow = rows - 1
      }
      continue
    }

    if (char === '\r') continue  // Ignore carriage returns
    if (char === '\t') {
      // Tab: advance to next 8-col boundary
      const currentLen = screen[cursorRow]?.length || 0
      const spaces = 8 - (currentLen % 8)
      screen[cursorRow] = (screen[cursorRow] || '') + ' '.repeat(spaces)
      continue
    }

    // Printable character
    if (cursorRow >= 0 && cursorRow < rows) {
      const line = screen[cursorRow] || ''
      if (line.length < cols) {
        screen[cursorRow] = line + char
      }
      // If line is at max cols, next char would wrap but we just truncate for SVG
    }
  }

  return { cursorRow }
}

// ── GIF Generation ──

/**
 * Convert a recording to an animated GIF.
 *
 * Shells out to ImageMagick (`convert`) or `ffmpeg` if available.
 * Falls back to SVG if no image tools are installed.
 *
 * @returns The output file path, or undefined if generation failed.
 */
export function toGIF(recording: Recording, outputPath: string, options: GIFOptions = {}): string | undefined {
  const cols = options.cols || recording.cols || 80
  const rows = options.rows || recording.rows || 24
  const fontSize = options.fontSize || 14
  const theme = THEMES[options.theme || 'dark'] || THEMES.dark
  const speed = options.speed || 1
  const fps = options.fps || 10

  // Check which tool is available
  const hasConvert = commandExists('convert')
  const hasFfmpeg = commandExists('ffmpeg')

  if (!hasConvert && !hasFfmpeg) {
    // Fall back to SVG
    const svgPath = outputPath.replace(/\.gif$/i, '.svg')
    writeFileSync(svgPath, toSVG(recording, { theme: options.theme, speed }), 'utf-8')
    return svgPath
  }

  // Build screen states
  const screenStates = buildScreenStates(recording.frames, cols, rows, speed)
  if (screenStates.length === 0) return undefined

  // Create temporary directory for frame PNGs
  const tmpDir = join(RECORDINGS_DIR, '.tmp-gif-' + recording.id)
  mkdirSync(tmpDir, { recursive: true })

  try {
    // Generate SVG frames and convert to PNG
    const charWidth = fontSize * 0.6
    const lineHeight = fontSize * 1.4
    const padding = 16
    const chromeHeight = 40
    const width = Math.ceil(cols * charWidth + padding * 2)
    const height = Math.ceil(rows * lineHeight + padding * 2 + chromeHeight)

    const framePaths: string[] = []

    for (let i = 0; i < screenStates.length; i++) {
      const state = screenStates[i]
      const frameSvg = renderFrameSVG(state, {
        width, height, cols, rows, fontSize, charWidth, lineHeight,
        padding, chromeHeight, theme, title: recording.title,
      })

      const svgPath = join(tmpDir, `frame-${String(i).padStart(5, '0')}.svg`)
      writeFileSync(svgPath, frameSvg, 'utf-8')
      framePaths.push(svgPath)
    }

    // Calculate frame delay (in centiseconds for ImageMagick, ms for ffmpeg)
    const frameDelay = Math.round(100 / fps) // centiseconds

    if (hasConvert) {
      // Use ImageMagick
      try {
        const args = [
          '-delay', String(frameDelay),
          '-loop', '0',
          ...framePaths,
          '-layers', 'Optimize',
          outputPath,
        ]
        execSync(`convert ${args.map(a => `"${a}"`).join(' ')}`, {
          timeout: 60000,
          stdio: 'pipe',
        })
        return outputPath
      } catch {
        // ImageMagick failed — try ffmpeg
      }
    }

    if (hasFfmpeg) {
      try {
        // Convert SVGs to PNGs first with ImageMagick or rsvg-convert
        const hasRsvg = commandExists('rsvg-convert')
        const pngPaths: string[] = []

        for (let i = 0; i < framePaths.length; i++) {
          const pngPath = framePaths[i].replace('.svg', '.png')
          if (hasRsvg) {
            execSync(`rsvg-convert "${framePaths[i]}" -o "${pngPath}"`, {
              timeout: 10000,
              stdio: 'pipe',
            })
          } else if (hasConvert) {
            execSync(`convert "${framePaths[i]}" "${pngPath}"`, {
              timeout: 10000,
              stdio: 'pipe',
            })
          } else {
            // Cannot convert SVG to PNG without rsvg-convert or ImageMagick
            // Fall back to SVG output
            const svgPath = outputPath.replace(/\.gif$/i, '.svg')
            writeFileSync(svgPath, toSVG(recording, { theme: options.theme, speed }), 'utf-8')
            return svgPath
          }
          pngPaths.push(pngPath)
        }

        // Use ffmpeg to create GIF from PNGs
        const inputPattern = join(tmpDir, 'frame-%05d.png')
        execSync(
          `ffmpeg -y -framerate ${fps} -i "${inputPattern}" -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${outputPath}"`,
          { timeout: 60000, stdio: 'pipe' },
        )
        return outputPath
      } catch {
        // ffmpeg failed — fallback to SVG
      }
    }

    // All methods failed — produce SVG fallback
    const svgPath = outputPath.replace(/\.gif$/i, '.svg')
    writeFileSync(svgPath, toSVG(recording, { theme: options.theme, speed }), 'utf-8')
    return svgPath
  } finally {
    // Clean up temp directory
    try {
      const tmpFiles = readdirSync(tmpDir)
      for (const f of tmpFiles) unlinkSync(join(tmpDir, f))
      // Remove the directory itself
      try { execSync(`rmdir "${tmpDir}"`, { stdio: 'pipe' }) } catch { /* ignore */ }
    } catch { /* ignore */ }
  }
}

/** Render a single frame as a complete SVG (for GIF frame generation) */
function renderFrameSVG(
  state: ScreenState,
  opts: {
    width: number; height: number; cols: number; rows: number;
    fontSize: number; charWidth: number; lineHeight: number;
    padding: number; chromeHeight: number; theme: ThemeColors;
    title: string;
  },
): string {
  const { width, height, padding, chromeHeight, lineHeight, fontSize, theme, title } = opts
  const contentY = chromeHeight + padding

  const lines: string[] = []
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`)
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`)

  // Background
  lines.push(`<rect width="${width}" height="${height}" rx="8" ry="8" fill="${theme.bg}"/>`)

  // Chrome
  lines.push(`<rect width="${width}" height="${chromeHeight}" rx="8" ry="0" fill="${theme.titleBg}"/>`)
  lines.push(`<rect x="0" y="${chromeHeight - 8}" width="${width}" height="8" fill="${theme.titleBg}"/>`)

  const dotY = chromeHeight / 2
  const dotR = 6
  lines.push(`<circle cx="${padding + dotR}" cy="${dotY}" r="${dotR}" fill="${theme.dotRed}"/>`)
  lines.push(`<circle cx="${padding + dotR * 3 + 4}" cy="${dotY}" r="${dotR}" fill="${theme.dotYellow}"/>`)
  lines.push(`<circle cx="${padding + dotR * 5 + 8}" cy="${dotY}" r="${dotR}" fill="${theme.dotGreen}"/>`)
  lines.push(`<text x="${width / 2}" y="${dotY + 4}" fill="${theme.titleFg}" font-family="monospace" font-size="${fontSize - 2}" text-anchor="middle">${escapeXML(title)}</text>`)

  // Content
  for (let row = 0; row < state.lines.length; row++) {
    const line = state.lines[row]
    if (!line || line.trim().length === 0) continue
    const x = padding
    const y = contentY + (row + 1) * lineHeight
    lines.push(`<text x="${x}" y="${y}" fill="${theme.fg}" font-family="'Courier New',monospace" font-size="${fontSize}" xml:space="preserve">${escapeXML(line)}</text>`)
  }

  lines.push(`</svg>`)
  return lines.join('\n')
}

/** Check if a command exists on the system */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which "${cmd}"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// ── Asciicast v2 Format ──

/**
 * Convert a recording to asciinema v2 format (.cast).
 *
 * Produces a file compatible with the asciinema player and asciinema.org.
 * Format spec: https://docs.asciinema.org/manual/asciicast/v2/
 */
export function toAsciicast(recording: Recording): string {
  const header = {
    version: 2,
    width: recording.cols || 80,
    height: recording.rows || 24,
    timestamp: Math.floor(new Date(recording.startedAt).getTime() / 1000),
    title: recording.title || 'K:BOT Terminal Recording',
    env: {
      SHELL: recording.env.shell,
      TERM: recording.env.term,
    },
  }

  const lines: string[] = [JSON.stringify(header)]

  for (const frame of recording.frames) {
    // Asciicast v2 event: [time, event_type, data]
    // "o" = output (stdout)
    const event = [
      parseFloat(frame.time.toFixed(6)),
      'o',
      frame.data,
    ]
    lines.push(JSON.stringify(event))
  }

  return lines.join('\n') + '\n'
}

// ── Recording from raw frame data (programmatic) ──

/**
 * Create a recording programmatically from an array of frames.
 * Useful for generating demo recordings without actually running a shell.
 */
export function createRecording(
  frames: RecordFrame[],
  options: {
    title?: string
    cols?: number
    rows?: number
  } = {},
): Recording {
  const id = generateId()
  const cols = options.cols || 80
  const rows = options.rows || 24
  const duration = frames.length > 0 ? frames[frames.length - 1].time : 0

  return {
    id,
    title: options.title || `K:BOT Recording ${id}`,
    startedAt: new Date().toISOString(),
    duration,
    cols,
    rows,
    frames,
    env: {
      shell: process.env.SHELL || '/bin/bash',
      term: process.env.TERM || 'xterm-256color',
      platform: platform(),
    },
  }
}

// ── Load / List / Delete Recordings ──

/**
 * Load a recording by ID or file path.
 */
export function loadRecording(idOrPath: string): Recording | null {
  // Try as direct path first
  if (existsSync(idOrPath)) {
    try {
      const ext = extname(idOrPath).toLowerCase()
      if (ext === '.json') {
        return JSON.parse(readFileSync(idOrPath, 'utf-8'))
      }
      if (ext === '.cast') {
        return parseCastFile(idOrPath)
      }
    } catch {
      return null
    }
  }

  // Try as ID in recordings directory
  ensureDir()
  const jsonPath = join(RECORDINGS_DIR, `${idOrPath}.json`)
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, 'utf-8'))
    } catch {
      return null
    }
  }

  return null
}

/** Parse an asciicast v2 file into a Recording */
function parseCastFile(filePath: string): Recording | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    if (lines.length === 0) return null

    const header = JSON.parse(lines[0])
    const frames: RecordFrame[] = []

    for (let i = 1; i < lines.length; i++) {
      const event = JSON.parse(lines[i])
      if (Array.isArray(event) && event[1] === 'o') {
        frames.push({ time: event[0], data: event[2] })
      }
    }

    return {
      id: basename(filePath, extname(filePath)),
      title: header.title || basename(filePath),
      startedAt: header.timestamp
        ? new Date(header.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      duration: frames.length > 0 ? frames[frames.length - 1].time : 0,
      cols: header.width || 80,
      rows: header.height || 24,
      frames,
      env: {
        shell: header.env?.SHELL || '/bin/bash',
        term: header.env?.TERM || 'xterm-256color',
        platform: platform(),
      },
    }
  } catch {
    return null
  }
}

/**
 * List all saved recordings.
 */
export function listRecordings(): Array<{
  id: string
  title: string
  date: string
  duration: number
  frames: number
  size: string
}> {
  ensureDir()
  const files = readdirSync(RECORDINGS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .reverse()

  const recordings: Array<{
    id: string; title: string; date: string;
    duration: number; frames: number; size: string
  }> = []

  for (const file of files) {
    try {
      const filePath = join(RECORDINGS_DIR, file)
      const stat = statSync(filePath)
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Recording
      recordings.push({
        id: data.id,
        title: data.title,
        date: new Date(data.startedAt).toLocaleDateString(),
        duration: data.duration,
        frames: data.frames.length,
        size: formatSize(stat.size),
      })
    } catch {
      // Skip corrupt files
    }
  }

  return recordings
}

/**
 * Delete a recording by ID.
 */
export function deleteRecording(id: string): boolean {
  ensureDir()
  const jsonPath = join(RECORDINGS_DIR, `${id}.json`)
  if (existsSync(jsonPath)) {
    unlinkSync(jsonPath)
    return true
  }
  return false
}

/** Format byte size to human-readable */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// ── Terminal Replay ──

/**
 * Replay a recording in the terminal with original timing.
 *
 * @param recording The recording to play back
 * @param speed Playback speed multiplier (2 = double speed)
 * @returns A promise that resolves when playback is complete,
 *          and an abort function to stop early.
 */
export function replayInTerminal(
  recording: Recording,
  speed: number = 1,
): { promise: Promise<void>; abort: () => void } {
  let aborted = false
  let currentTimeout: ReturnType<typeof setTimeout> | null = null

  const abort = () => {
    aborted = true
    if (currentTimeout) clearTimeout(currentTimeout)
  }

  const promise = new Promise<void>((resolve) => {
    if (recording.frames.length === 0) {
      resolve()
      return
    }

    // Clear screen
    process.stdout.write('\x1b[2J\x1b[H')

    let frameIdx = 0

    function playNextFrame(): void {
      if (aborted || frameIdx >= recording.frames.length) {
        process.stdout.write('\n')
        resolve()
        return
      }

      const frame = recording.frames[frameIdx]
      process.stdout.write(frame.data)
      frameIdx++

      if (frameIdx < recording.frames.length) {
        const nextFrame = recording.frames[frameIdx]
        const delay = Math.max(1, (nextFrame.time - frame.time) * 1000 / speed)
        currentTimeout = setTimeout(playNextFrame, delay)
      } else {
        process.stdout.write('\n')
        resolve()
      }
    }

    // Start with the first frame
    const firstDelay = Math.max(1, recording.frames[0].time * 1000 / speed)
    currentTimeout = setTimeout(playNextFrame, firstDelay)
  })

  return { promise, abort }
}

// ── Convert existing recording to different format ──

/**
 * Convert a recording file to a different format.
 */
export function convertRecording(
  inputPath: string,
  outputPath: string,
  options: SVGOptions & GIFOptions = {},
): string | undefined {
  const recording = loadRecording(inputPath)
  if (!recording) {
    throw new Error(`Cannot load recording: ${inputPath}`)
  }

  const ext = extname(outputPath).toLowerCase()
  switch (ext) {
    case '.svg':
      writeFileSync(outputPath, toSVG(recording, options), 'utf-8')
      return outputPath
    case '.gif':
      return toGIF(recording, outputPath, options)
    case '.cast':
      writeFileSync(outputPath, toAsciicast(recording), 'utf-8')
      return outputPath
    case '.json':
      writeFileSync(outputPath, JSON.stringify(recording, null, 2), 'utf-8')
      return outputPath
    default:
      throw new Error(`Unsupported output format: ${ext}`)
  }
}

// ── CLI Integration ──

/**
 * Register the `kbot record` command group with the CLI.
 *
 * Subcommands:
 *   kbot record start [--output <file>] [--title <title>]
 *   kbot record stop
 *   kbot record list
 *   kbot record replay <file> [--speed <multiplier>]
 *   kbot record convert <input> <output> [--theme <theme>]
 *   kbot record delete <id>
 */
export function registerRecordCommand(program: Command): void {
  const recordCmd = program
    .command('record')
    .description('Record terminal sessions as SVG, GIF, or asciicast for demos')

  // ── start ──

  recordCmd
    .command('start')
    .description('Start recording the terminal session')
    .option('-o, --output <file>', 'Output file (extension sets format: .svg, .gif, .cast, .json)')
    .option('-t, --title <title>', 'Recording title')
    .option('--cols <cols>', 'Terminal columns', String(process.stdout.columns || 80))
    .option('--rows <rows>', 'Terminal rows', String(process.stdout.rows || 24))
    .option('--shell <shell>', 'Shell to use')
    .action((opts: {
      output?: string; title?: string;
      cols?: string; rows?: string; shell?: string
    }) => {
      const result = startRecording({
        output: opts.output,
        title: opts.title,
        cols: opts.cols ? parseInt(opts.cols, 10) : undefined,
        rows: opts.rows ? parseInt(opts.rows, 10) : undefined,
        shell: opts.shell,
      })

      if (result.success) {
        console.log(`\x1b[32m  \u2713 ${result.message}\x1b[0m`)
      } else {
        console.error(`\x1b[31m  \u2717 ${result.message}\x1b[0m`)
        process.exit(1)
      }
    })

  // ── stop ──

  recordCmd
    .command('stop')
    .description('Stop the active recording and save it')
    .action(() => {
      const result = stopRecording()
      if (result.success) {
        console.log(`\x1b[32m  \u2713 ${result.message}\x1b[0m`)
        if (result.outputPath) {
          console.log(`  Output: ${result.outputPath}`)
        }
      } else {
        console.error(`\x1b[31m  \u2717 ${result.message}\x1b[0m`)
        process.exit(1)
      }
    })

  // ── list ──

  recordCmd
    .command('list')
    .description('List all saved recordings')
    .action(() => {
      const recordings = listRecordings()
      if (recordings.length === 0) {
        console.log('  No recordings found. Run `kbot record start` to create one.')
        return
      }

      console.log()
      console.log('  \x1b[1mSaved Recordings\x1b[0m')
      console.log('  \x1b[2m' + '\u2500'.repeat(60) + '\x1b[0m')

      for (const rec of recordings) {
        const dur = rec.duration < 60
          ? `${rec.duration.toFixed(1)}s`
          : `${Math.floor(rec.duration / 60)}m${Math.round(rec.duration % 60)}s`
        console.log(`  \x1b[36m${rec.id}\x1b[0m  ${rec.title}`)
        console.log(`  \x1b[2m${rec.date}  |  ${dur}  |  ${rec.frames} frames  |  ${rec.size}\x1b[0m`)
        console.log()
      }
    })

  // ── replay ──

  recordCmd
    .command('replay <file>')
    .description('Replay a recording in the terminal')
    .option('-s, --speed <speed>', 'Playback speed multiplier', '1')
    .action(async (file: string, opts: { speed?: string }) => {
      const recording = loadRecording(file)
      if (!recording) {
        console.error(`\x1b[31m  \u2717 Cannot load recording: ${file}\x1b[0m`)
        process.exit(1)
      }

      const speed = opts.speed ? parseFloat(opts.speed) : 1
      const dur = recording.duration < 60
        ? `${recording.duration.toFixed(1)}s`
        : `${Math.floor(recording.duration / 60)}m${Math.round(recording.duration % 60)}s`

      console.log(`\x1b[2m  Replaying: ${recording.title} (${dur} at ${speed}x)\x1b[0m`)
      console.log(`\x1b[2m  Press Ctrl-C to stop.\x1b[0m`)
      console.log()

      const { promise, abort } = replayInTerminal(recording, speed)

      // Handle Ctrl-C gracefully
      const handler = () => {
        abort()
        process.stdout.write('\x1b[0m\n')
        console.log('\x1b[2m  Playback stopped.\x1b[0m')
        process.removeListener('SIGINT', handler)
      }
      process.on('SIGINT', handler)

      await promise
      process.removeListener('SIGINT', handler)
      console.log('\x1b[2m  Playback complete.\x1b[0m')
    })

  // ── convert ──

  recordCmd
    .command('convert <input> <output>')
    .description('Convert a recording to a different format')
    .option('--theme <theme>', 'SVG/GIF theme: dark, light, monokai, dracula', 'dark')
    .option('--speed <speed>', 'Playback speed multiplier', '1')
    .option('--fps <fps>', 'GIF frames per second', '10')
    .option('--font-size <size>', 'Font size in pixels', '14')
    .action((input: string, output: string, opts: {
      theme?: string; speed?: string; fps?: string; fontSize?: string
    }) => {
      try {
        const result = convertRecording(input, output, {
          theme: (opts.theme || 'dark') as SVGOptions['theme'],
          speed: opts.speed ? parseFloat(opts.speed) : 1,
          fps: opts.fps ? parseInt(opts.fps, 10) : 10,
          fontSize: opts.fontSize ? parseInt(opts.fontSize, 10) : 14,
        })
        if (result) {
          console.log(`\x1b[32m  \u2713 Converted: ${result}\x1b[0m`)
        } else {
          console.error('\x1b[31m  \u2717 Conversion failed.\x1b[0m')
          process.exit(1)
        }
      } catch (err) {
        console.error(`\x1b[31m  \u2717 ${err instanceof Error ? err.message : String(err)}\x1b[0m`)
        process.exit(1)
      }
    })

  // ── delete ──

  recordCmd
    .command('delete <id>')
    .description('Delete a saved recording')
    .action((id: string) => {
      if (deleteRecording(id)) {
        console.log(`\x1b[32m  \u2713 Deleted recording: ${id}\x1b[0m`)
      } else {
        console.error(`\x1b[31m  \u2717 Recording not found: ${id}\x1b[0m`)
        process.exit(1)
      }
    })
}
