import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, unlinkSync } from 'node:fs'
import chalk from 'chalk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceOptions {
  /** TTS voice name (macOS: Alex, Samantha, etc. / Voxtral: voxtral-default, voxtral-expressive) */
  voice?: string
  /** TTS speech rate (words per minute, default: 200) */
  rate?: number
  /** Enable TTS output (default: true) */
  tts?: boolean
  /** Enable STT input (default: false — requires whisper) */
  stt?: boolean
}

export interface VoiceState {
  enabled: boolean
  ttsProcess?: ChildProcess
  sttAvailable: boolean
  voice: string
  rate: number
}

// ---------------------------------------------------------------------------
// Platform detection helpers
// ---------------------------------------------------------------------------

const platform = process.platform

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function detectTTSEngine(): 'say' | 'espeak' | 'festival' | 'voxtral' | null {
  if (platform === 'darwin') return 'say'
  if (commandExists('voxtral') || process.env.VOXTRAL_API_KEY) return 'voxtral'
  if (commandExists('espeak')) return 'espeak'
  if (commandExists('festival')) return 'festival'
  return null
}

function detectSTT(): boolean {
  return commandExists('whisper') || commandExists('whisper.cpp')
}

function detectRecorder(): 'rec' | 'arecord' | null {
  if (commandExists('rec')) return 'rec'
  if (commandExists('arecord')) return 'arecord'
  return null
}

// ---------------------------------------------------------------------------
// Text sanitization
// ---------------------------------------------------------------------------

/** Strip markdown formatting so TTS reads clean prose. */
function stripMarkdown(text: string): string {
  let cleaned = text

  // Replace code blocks with a spoken description of the language
  cleaned = cleaned.replace(/```(\w+)?\n[\s\S]*?```/g, (_match, lang: string | undefined) => {
    return lang
      ? `Here's a ${lang} snippet.`
      : 'Here\'s a code snippet.'
  })

  // Remove inline code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1')

  // Remove headings markers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')

  // Remove bold / italic markers
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')

  // Remove strikethrough
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1')

  // Remove links — keep the label
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Remove images
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

  // Remove blockquote markers
  cleaned = cleaned.replace(/^>\s+/gm, '')

  // Remove horizontal rules
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '')

  // Remove list markers (unordered)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '')

  // Remove list markers (ordered)
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '')

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  return cleaned.trim()
}

/** Sanitize text for safe shell usage — strip characters that could be interpreted. */
function sanitizeForShell(text: string): string {
  // Remove characters that are dangerous in shell context
  return text.replace(/[;&|`$(){}[\]!#\\]/g, '')
}

// ---------------------------------------------------------------------------
// 1. initVoice
// ---------------------------------------------------------------------------

export function initVoice(options?: VoiceOptions): VoiceState {
  const ttsEngine = detectTTSEngine()
  const sttAvailable = options?.stt ? detectSTT() : false

  const enabled = options?.tts !== false && ttsEngine !== null

  if (!ttsEngine) {
    console.warn(
      chalk.yellow('⚠ No TTS engine found. ') +
      (platform === 'darwin'
        ? 'Expected "say" — this should be available on macOS.'
        : 'Install espeak or festival for TTS support.')
    )
  }

  if (options?.stt && !sttAvailable) {
    console.warn(
      chalk.yellow('⚠ STT requested but whisper not found. ') +
      'Install whisper.cpp or openai-whisper for speech-to-text.'
    )
  }

  const defaultVoice = platform === 'darwin' ? 'Alex' : 'default'

  return {
    enabled,
    sttAvailable,
    voice: options?.voice ?? defaultVoice,
    rate: options?.rate ?? 200,
  }
}

// ---------------------------------------------------------------------------
// 2. speak
// ---------------------------------------------------------------------------

export async function speak(text: string, state: VoiceState): Promise<void> {
  if (!state.enabled) return

  // Kill any in-progress speech first
  stopSpeaking(state)

  const cleaned = sanitizeForShell(stripMarkdown(text))
  if (!cleaned) return

  const ttsEngine = detectTTSEngine()
  if (!ttsEngine) return

  return new Promise<void>((resolve) => {
    let proc: ChildProcess

    switch (ttsEngine) {
      case 'say':
        proc = spawn('say', ['-v', state.voice, '-r', String(state.rate), cleaned], {
          stdio: 'ignore',
        })
        break

      case 'espeak':
        proc = spawn('espeak', [cleaned], {
          stdio: 'ignore',
        })
        break

      case 'festival': {
        proc = spawn('festival', ['--tts'], {
          stdio: ['pipe', 'ignore', 'ignore'],
        })
        proc.stdin?.write(cleaned)
        proc.stdin?.end()
        break
      }

      case 'voxtral': {
        // Voxtral TTS — Mistral's open-weight text-to-speech
        // Supports local binary or API mode via VOXTRAL_API_KEY
        const apiKey = process.env.VOXTRAL_API_KEY
        if (apiKey) {
          // API mode: pipe text to voxtral via Mistral API
          const body = JSON.stringify({ model: 'voxtral-tts-latest', input: cleaned })
          proc = spawn('curl', [
            '-s', '--max-time', '30',
            '-H', 'Content-Type: application/json',
            '-H', `Authorization: Bearer ${apiKey}`,
            '-d', body,
            '--output', join(tmpdir(), `kbot-voxtral-${Date.now()}.mp3`),
            'https://api.mistral.ai/v1/audio/speech',
          ], { stdio: 'ignore' })
        } else {
          // Local mode: voxtral binary
          proc = spawn('voxtral', ['--text', cleaned], { stdio: 'ignore' })
        }
        break
      }

      default:
        resolve()
        return
    }

    state.ttsProcess = proc

    proc.on('close', () => {
      if (state.ttsProcess === proc) {
        state.ttsProcess = undefined
      }
      resolve()
    })

    proc.on('error', () => {
      if (state.ttsProcess === proc) {
        state.ttsProcess = undefined
      }
      resolve()
    })
  })
}

// ---------------------------------------------------------------------------
// 3. stopSpeaking
// ---------------------------------------------------------------------------

export function stopSpeaking(state: VoiceState): void {
  if (state.ttsProcess) {
    state.ttsProcess.kill('SIGTERM')
    state.ttsProcess = undefined
  }
}

// ---------------------------------------------------------------------------
// 4. listen
// ---------------------------------------------------------------------------

export async function listen(state: VoiceState): Promise<string> {
  if (!state.sttAvailable) {
    // Fall back to readline text input
    return readlineInput()
  }

  const recorder = detectRecorder()
  if (!recorder) {
    console.warn(chalk.yellow('⚠ No audio recorder found (rec or arecord). Falling back to text input.'))
    return readlineInput()
  }

  const tempFile = join(tmpdir(), `kbot-voice-${Date.now()}.wav`)

  try {
    // Record audio (up to 10 seconds)
    console.log(chalk.cyan('🎙  Listening... (up to 10s, press Ctrl+C to stop)'))

    await new Promise<void>((resolve, reject) => {
      let proc: ChildProcess

      if (recorder === 'rec') {
        // sox rec: record 16kHz mono WAV, max 10 seconds
        proc = spawn('rec', [
          tempFile,
          'rate', '16k',
          'channels', '1',
          'trim', '0', '10',
        ], {
          stdio: ['ignore', 'ignore', 'ignore'],
        })
      } else {
        // arecord: record 16kHz mono WAV, max 10 seconds
        proc = spawn('arecord', [
          '-f', 'S16_LE',
          '-r', '16000',
          '-c', '1',
          '-d', '10',
          tempFile,
        ], {
          stdio: ['ignore', 'ignore', 'ignore'],
        })
      }

      proc.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve()
        } else {
          reject(new Error(`Recording failed with exit code ${code}`))
        }
      })

      proc.on('error', (err) => reject(err))
    })

    if (!existsSync(tempFile)) {
      console.warn(chalk.yellow('⚠ Recording failed — no audio file produced.'))
      return readlineInput()
    }

    // Transcribe with whisper
    console.log(chalk.dim('Transcribing...'))

    const whisperCmd = commandExists('whisper') ? 'whisper' : 'whisper.cpp'
    const transcription = execSync(
      `${whisperCmd} "${tempFile}" --model base --output_format txt --language en 2>/dev/null`,
      { encoding: 'utf-8', timeout: 30_000 }
    ).trim()

    return transcription || await readlineInput()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(chalk.yellow(`⚠ STT failed: ${message}. Falling back to text input.`))
    return readlineInput()
  } finally {
    // Clean up temp file
    try {
      if (existsSync(tempFile)) unlinkSync(tempFile)
    } catch {
      // ignore cleanup errors
    }
  }
}

/** Readline fallback for text input when STT is unavailable. */
function readlineInput(): Promise<string> {
  return new Promise<string>((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(chalk.cyan('You: '), (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ---------------------------------------------------------------------------
// 5. listVoices
// ---------------------------------------------------------------------------

export function listVoices(): string[] {
  const ttsEngine = detectTTSEngine()
  if (!ttsEngine) return []

  try {
    switch (ttsEngine) {
      case 'say': {
        // macOS: `say -v ?` outputs lines like "Alex  en_US  # Most people recognize me by my voice."
        const output = execSync('say -v ?', { encoding: 'utf-8' })
        return output
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const match = line.match(/^(\S+)/)
            return match ? match[1] : ''
          })
          .filter(Boolean)
      }

      case 'espeak': {
        const output = execSync('espeak --voices', { encoding: 'utf-8' })
        return output
          .split('\n')
          .slice(1) // skip header
          .filter(Boolean)
          .map((line) => {
            const parts = line.trim().split(/\s+/)
            // voice name is typically the 4th column
            return parts[3] ?? ''
          })
          .filter(Boolean)
      }

      case 'festival': {
        try {
          const output = execSync(
            'echo "(voice.list)" | festival --pipe 2>/dev/null',
            { encoding: 'utf-8' }
          )
          const match = output.match(/\(([^)]+)\)/)
          if (match) {
            return match[1].split(/\s+/).filter(Boolean)
          }
        } catch {
          // festival voice listing can be finicky
        }
        return []
      }

      case 'voxtral':
        return ['voxtral-default', 'voxtral-expressive']

      default:
        return []
    }
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 6. formatVoiceStatus
// ---------------------------------------------------------------------------

export function formatVoiceStatus(state: VoiceState): string {
  const lines: string[] = []

  lines.push(chalk.bold('Voice Mode'))
  lines.push('')

  const ttsEngine = detectTTSEngine()

  lines.push(
    `  TTS:      ${state.enabled
      ? chalk.green('enabled') + chalk.dim(` (${ttsEngine ?? 'unknown'})`)
      : chalk.red('disabled')
    }`
  )
  lines.push(`  Voice:    ${chalk.cyan(state.voice)}`)
  lines.push(`  Rate:     ${state.rate} wpm`)
  lines.push(
    `  STT:      ${state.sttAvailable
      ? chalk.green('available') + chalk.dim(' (whisper)')
      : chalk.dim('not available')
    }`
  )
  lines.push(
    `  Speaking: ${state.ttsProcess
      ? chalk.yellow('in progress')
      : chalk.dim('idle')
    }`
  )

  return lines.join('\n')
}
