// kbot Stream VOD — Auto-record, highlight detection, clip system, YouTube upload
// Tools: vod_start, vod_stop, vod_status, vod_clip, vod_highlights, vod_upload
// Output: ~/.kbot/vods/ | Auth: ~/.kbot/youtube-auth.json (optional)

import { registerTool } from './index.js'
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'

// ─── Paths ───────────────────────────────────────────────────
const KBOT_DIR = join(homedir(), '.kbot')
const VOD_DIR = join(KBOT_DIR, 'vods')
const CLIPS_DIR = join(VOD_DIR, 'clips')
const HIGHLIGHTS_FILE = join(VOD_DIR, 'highlights.json')
const VOD_STATE_FILE = join(VOD_DIR, 'vod-state.json')
const YOUTUBE_AUTH_FILE = join(KBOT_DIR, 'youtube-auth.json')

function ensureDirs(): void {
  for (const dir of [KBOT_DIR, VOD_DIR, CLIPS_DIR])
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ─── Types ───────────────────────────────────────────────────
export interface Highlight {
  timestamp: number        // seconds from recording start
  absoluteTime: string     // ISO 8601
  type: string
  description: string
  chatRate: number         // messages per 30s window
}

export interface RecordingInfo {
  recording: boolean
  filePath: string | null
  startedAt: string | null
  durationSec: number
  fileSizeMB: number
  resolution: string
  highlights: number
}

export interface RecordingResult {
  filePath: string
  durationSec: number
  fileSizeMB: number
  highlights: Highlight[]
}

export interface TimelineEvent {
  timeSec: number
  type: 'chat' | 'highlight' | 'viewer_count' | 'marker'
  data: Record<string, unknown>
}

export interface StreamTimeline {
  date: string
  durationSec: number
  events: TimelineEvent[]
  highlights: Highlight[]
  peakChatRate: number
  totalMessages: number
}

interface VODState {
  recording: boolean
  filePath: string | null
  startedAt: string | null
  resolution: string
  pid: number | null
  highlights: Highlight[]
  timelineEvents: TimelineEvent[]
  chatTimestamps: number[]
  totalChatMessages: number
}

// ─── Helpers ─────────────────────────────────────────────────
function loadVODState(): VODState {
  try { if (existsSync(VOD_STATE_FILE)) return JSON.parse(readFileSync(VOD_STATE_FILE, 'utf-8')) } catch {}
  return {
    recording: false, filePath: null, startedAt: null, resolution: '1280x720',
    pid: null, highlights: [], timelineEvents: [], chatTimestamps: [], totalChatMessages: 0,
  }
}

function saveVODState(s: VODState): void { ensureDirs(); writeFileSync(VOD_STATE_FILE, JSON.stringify(s, null, 2)) }
function checkFfmpeg(): Promise<boolean> { return new Promise(r => { execFile('ffmpeg', ['-version'], { timeout: 5000 }, e => r(!e)) }) }
function elapsedSec(t: string): number { return Math.round((Date.now() - new Date(t).getTime()) / 1000) }
function fileSizeMB(p: string): number { try { return Math.round(statSync(p).size / 1048576 * 100) / 100 } catch { return 0 } }

function formatTimestamp(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`
}

function formatSec(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`
}

// ─── StreamVOD Class ─────────────────────────────────────────
export class StreamVOD {
  private process: ChildProcess | null = null
  private state: VODState

  constructor() { ensureDirs(); this.state = loadVODState() }

  startRecording(inputPipe?: string): void {
    if (this.state.recording) throw new Error('Already recording. Stop the current recording first.')
    const outputFile = join(VOD_DIR, `${formatTimestamp()}.mp4`)
    const resolution = '1280x720'
    const inputArgs: string[] = inputPipe
      ? ['-i', inputPipe]
      : ['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100']
    const args = [
      ...inputArgs, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-s', resolution, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-ar', '44100', '-movflags', '+faststart',
      ...(inputPipe ? [] : ['-map', '0:v', '-map', '1:a']), '-y', outputFile,
    ]
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'], detached: true })
    this.process = proc
    proc.unref()
    this.state = {
      recording: true, filePath: outputFile, startedAt: new Date().toISOString(),
      resolution, pid: proc.pid ?? null, highlights: [], timelineEvents: [],
      chatTimestamps: [], totalChatMessages: 0,
    }
    saveVODState(this.state)
  }

  stopRecording(): RecordingResult {
    if (!this.state.recording || !this.state.filePath) throw new Error('Not currently recording.')
    if (this.process && !this.process.killed) {
      try { this.process.stdin?.write('q') } catch {}
      setTimeout(() => { try { this.process?.kill('SIGINT') } catch {} }, 2000)
    } else if (this.state.pid) {
      try { process.kill(this.state.pid, 'SIGINT') } catch {}
    }
    this.process = null
    const filePath = this.state.filePath
    const durationSec = this.state.startedAt ? elapsedSec(this.state.startedAt) : 0
    const highlights = [...this.state.highlights]
    this.generateTimeline()
    this._persistHighlights()
    const result: RecordingResult = { filePath, durationSec, fileSizeMB: fileSizeMB(filePath), highlights }
    this.state.recording = false
    this.state.pid = null
    saveVODState(this.state)
    return result
  }

  isRecording(): boolean {
    if (!this.state.recording) return false
    if (this.state.pid) { try { process.kill(this.state.pid, 0); return true } catch {} }
    if (this.process && !this.process.killed) return true
    this.state.recording = false
    saveVODState(this.state)
    return false
  }

  getRecordingInfo(): RecordingInfo {
    return {
      recording: this.isRecording(),
      filePath: this.state.filePath,
      startedAt: this.state.startedAt,
      durationSec: this.state.startedAt ? elapsedSec(this.state.startedAt) : 0,
      fileSizeMB: this.state.filePath ? fileSizeMB(this.state.filePath) : 0,
      resolution: this.state.resolution,
      highlights: this.state.highlights.length,
    }
  }

  addHighlight(type: string, description: string): void {
    const timeSec = this.state.startedAt ? elapsedSec(this.state.startedAt) : 0
    const highlight: Highlight = {
      timestamp: timeSec, absoluteTime: new Date().toISOString(),
      type, description, chatRate: this._chatRate(),
    }
    this.state.highlights.push(highlight)
    this.state.timelineEvents.push({ timeSec, type: 'highlight', data: { highlightType: type, description } })
    saveVODState(this.state)
  }

  getHighlights(): Highlight[] { return [...this.state.highlights] }

  /** Feed chat messages for spike detection */
  onChatMessage(username?: string): void {
    const now = Date.now()
    this.state.chatTimestamps.push(now)
    this.state.totalChatMessages++
    this.state.chatTimestamps = this.state.chatTimestamps.filter(t => t >= now - 60_000)
    if (this.state.recording) {
      const timeSec = this.state.startedAt ? elapsedSec(this.state.startedAt) : 0
      this.state.timelineEvents.push({ timeSec, type: 'chat', data: { username: username || 'unknown' } })
    }
    // Chat spike: >10 messages in 30 seconds, debounce 60s
    const recentCount = this.state.chatTimestamps.filter(t => t >= now - 30_000).length
    if (recentCount > 10) {
      const lastSpike = this.state.highlights.filter(h => h.type === 'chat_spike').pop()
      const lastTime = lastSpike ? new Date(lastSpike.absoluteTime).getTime() : 0
      if (now - lastTime > 60_000)
        this.addHighlight('chat_spike', `Chat spike: ${recentCount} messages in 30s`)
    }
    saveVODState(this.state)
  }

  /** Auto-detect highlights from stream events */
  onStreamEvent(event: string, detail?: string): void {
    const auto: Record<string, string> = {
      achievement: 'Achievement unlocked', boss_fight_start: 'Boss fight started',
      boss_fight_end: 'Boss fight ended', raid: 'Raid received',
      viewer_milestone: 'Viewer milestone reached', ship: 'Proposal shipped (!ship)',
      sub_bomb: 'Sub bomb', hype_train: 'Hype train started',
    }
    const desc = detail || auto[event] || event
    if (auto[event] || event === 'custom') this.addHighlight(event, desc)
    if (this.state.recording) {
      const timeSec = this.state.startedAt ? elapsedSec(this.state.startedAt) : 0
      this.state.timelineEvents.push({ timeSec, type: 'marker', data: { event, detail: desc } })
      saveVODState(this.state)
    }
  }

  async clip(startSec: number, endSec: number, name?: string): Promise<string> {
    if (!this.state.filePath || !existsSync(this.state.filePath))
      throw new Error('No recording file found. Start and stop a recording first.')
    if (!(await checkFfmpeg())) throw new Error('ffmpeg not found. Install: brew install ffmpeg')
    const duration = endSec - startSec
    if (duration <= 0) throw new Error('endSec must be greater than startSec')
    if (duration > 600) throw new Error('Maximum clip duration is 10 minutes')
    const safeName = (name || `clip_${Math.round(startSec)}-${Math.round(endSec)}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    const outputPath = join(CLIPS_DIR, `${safeName}.mp4`)

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-ss', String(startSec), '-i', this.state.filePath!,
        '-t', String(duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', outputPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      proc.stderr?.on('data', (c: Buffer) => { stderr += c.toString() })
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-300)}`)))
      proc.on('error', reject)
    })

    // Thumbnail from middle frame (best-effort)
    const thumbPath = join(CLIPS_DIR, `${safeName}_thumb.jpg`)
    await new Promise<void>(r => {
      const p = spawn('ffmpeg', ['-ss', String(startSec + duration / 2), '-i', this.state.filePath!, '-frames:v', '1', '-q:v', '3', '-y', thumbPath], { stdio: ['ignore', 'pipe', 'pipe'] })
      p.on('close', () => r()); p.on('error', () => r())
    })
    return outputPath
  }

  async clipHighlight(index: number): Promise<string> {
    if (index < 0 || index >= this.state.highlights.length)
      throw new Error(`Highlight index ${index} out of range (0-${this.state.highlights.length - 1})`)
    const h = this.state.highlights[index]
    return this.clip(Math.max(0, h.timestamp - 10), h.timestamp + 10, `highlight_${index}_${h.type}`)
  }

  generateTimeline(): StreamTimeline {
    const durationSec = this.state.startedAt ? elapsedSec(this.state.startedAt) : 0
    let peakChatRate = 0
    for (const h of this.state.highlights) if (h.chatRate > peakChatRate) peakChatRate = h.chatRate
    const timeline: StreamTimeline = {
      date: this.state.startedAt || new Date().toISOString(), durationSec,
      events: [...this.state.timelineEvents], highlights: [...this.state.highlights],
      peakChatRate, totalMessages: this.state.totalChatMessages,
    }
    const dateStr = (this.state.startedAt ? new Date(this.state.startedAt) : new Date()).toISOString().slice(0, 10)
    writeFileSync(join(VOD_DIR, `${dateStr}_timeline.json`), JSON.stringify(timeline, null, 2))
    return timeline
  }

  async uploadToYouTube(filePath: string, title: string, description: string): Promise<string> {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
    if (!existsSync(YOUTUBE_AUTH_FILE))
      throw new Error('YouTube auth not configured. Create ~/.kbot/youtube-auth.json with client_id, client_secret, refresh_token.\nGet credentials at console.cloud.google.com, enable YouTube Data API v3.')
    let auth: { client_id: string; client_secret: string; refresh_token: string }
    try { auth = JSON.parse(readFileSync(YOUTUBE_AUTH_FILE, 'utf-8')) } catch { throw new Error('Failed to parse ~/.kbot/youtube-auth.json') }
    if (!auth.client_id || !auth.client_secret || !auth.refresh_token)
      throw new Error('youtube-auth.json missing required fields')

    // Token exchange
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: auth.client_id, client_secret: auth.client_secret, refresh_token: auth.refresh_token, grant_type: 'refresh_token' }),
    })
    if (!tokenRes.ok) throw new Error(`YouTube token refresh failed: ${await tokenRes.text()}`)
    const { access_token: accessToken } = await tokenRes.json() as { access_token: string }

    const { readFile } = await import('node:fs/promises')
    const fileBuffer = await readFile(filePath)

    // Initiate resumable upload
    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(fileBuffer.byteLength), 'X-Upload-Content-Type': 'video/mp4' },
      body: JSON.stringify({ snippet: { title, description, tags: ['kbot', 'livestream', 'kernel.chat', 'AI'], categoryId: '20' }, status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false } }),
    })
    if (!initRes.ok) throw new Error(`YouTube upload init failed (${initRes.status}): ${await initRes.text()}`)
    const uploadUrl = initRes.headers.get('Location')
    if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')

    // Upload file
    const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Length': String(fileBuffer.byteLength), 'Content-Type': 'video/mp4' }, body: fileBuffer })
    if (!uploadRes.ok) throw new Error(`YouTube upload failed (${uploadRes.status}): ${await uploadRes.text()}`)
    const result = await uploadRes.json() as { id: string }
    return `https://youtu.be/${result.id}`
  }

  saveState(): void { saveVODState(this.state) }
  loadState(): void { this.state = loadVODState() }

  private _chatRate(): number { return this.state.chatTimestamps.filter(t => t >= Date.now() - 30_000).length }

  private _persistHighlights(): void {
    let existing: Highlight[] = []
    try { if (existsSync(HIGHLIGHTS_FILE)) existing = JSON.parse(readFileSync(HIGHLIGHTS_FILE, 'utf-8')) } catch {}
    writeFileSync(HIGHLIGHTS_FILE, JSON.stringify([...existing, ...this.state.highlights].slice(-500), null, 2))
  }
}

// ─── Singleton ───────────────────────────────────────────────
let vodInstance: StreamVOD | null = null
function getVOD(): StreamVOD { if (!vodInstance) vodInstance = new StreamVOD(); return vodInstance }

// ─── Tool Registration ───────────────────────────────────────
export function registerStreamVODTools(): void {

  registerTool({
    name: 'vod_start',
    description: 'Start recording the livestream locally as h264+aac MP4 to ~/.kbot/vods/. Pass an RTMP URL, file path, or omit for test pattern.',
    parameters: {
      input: { type: 'string', description: 'Input source: RTMP URL, file path, or omit for test pattern.' },
    },
    tier: 'free',
    timeout: 600_000,
    execute: async (args) => {
      if (!(await checkFfmpeg())) return 'Error: ffmpeg not found. Install: brew install ffmpeg'
      const vod = getVOD()
      if (vod.isRecording()) {
        const i = vod.getRecordingInfo()
        return `Already recording: ${i.filePath}\nDuration: ${i.durationSec}s | Size: ${i.fileSizeMB}MB\nRun vod_stop first.`
      }
      try {
        vod.startRecording(args.input ? String(args.input) : undefined)
        const i = vod.getRecordingInfo()
        return `VOD recording started.\n\nFile: ${i.filePath}\nResolution: ${i.resolution}\nFormat: h264+aac MP4\n\nUse vod_stop to end, vod_status to check.`
      } catch (e: any) { return `Error: ${e.message}` }
    },
  })

  registerTool({
    name: 'vod_stop',
    description: 'Stop VOD recording. Saves file, persists highlights, exports timeline.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const vod = getVOD()
      if (!vod.isRecording()) return 'No active VOD recording.'
      try {
        const r = vod.stopRecording()
        const hl = r.highlights.length > 0
          ? `\n\nHighlights (${r.highlights.length}):\n` + r.highlights.map((h, i) => `  ${i}. [${formatSec(h.timestamp)}] ${h.type}: ${h.description}`).join('\n')
          : '\n\nNo highlights detected.'
        return `VOD stopped.\n\nFile: ${r.filePath}\nDuration: ${formatSec(r.durationSec)}\nSize: ${r.fileSizeMB} MB${hl}\n\nUse vod_clip to extract clips.`
      } catch (e: any) { return `Error: ${e.message}` }
    },
  })

  registerTool({
    name: 'vod_status',
    description: 'Check VOD recording status, file size, duration, and highlight count.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const vod = getVOD()
      const i = vod.getRecordingInfo()
      if (!i.recording) {
        if (i.filePath && existsSync(i.filePath))
          return `Not recording.\n\nLast: ${i.filePath}\nSize: ${i.fileSizeMB} MB | Highlights: ${i.highlights}`
        return 'Not recording. Use vod_start to begin.'
      }
      return `Recording.\n\nFile: ${i.filePath}\nDuration: ${formatSec(i.durationSec)} | Size: ${i.fileSizeMB} MB\nResolution: ${i.resolution} | Highlights: ${i.highlights}`
    },
  })

  registerTool({
    name: 'vod_clip',
    description: 'Extract a clip from the VOD by start/end seconds or highlight index (10s padding). Generates thumbnail.',
    parameters: {
      start: { type: 'number', description: 'Start seconds. Ignored if highlight_index set.' },
      end: { type: 'number', description: 'End seconds. Ignored if highlight_index set.' },
      name: { type: 'string', description: 'Clip name (no extension). Default: auto.' },
      highlight_index: { type: 'number', description: 'Highlight index to auto-clip around.' },
    },
    tier: 'free',
    timeout: 120_000,
    execute: async (args) => {
      const vod = getVOD()
      try {
        if (args.highlight_index !== undefined && args.highlight_index !== null) {
          const idx = Number(args.highlight_index)
          const path = await vod.clipHighlight(idx)
          const h = vod.getHighlights()[idx]
          return `Clip from highlight #${idx} (${h.type}).\n\nFile: ${path}\nThumb: ${path.replace('.mp4', '_thumb.jpg')}`
        }
        const start = Number(args.start ?? 0), end = Number(args.end ?? 20)
        const path = await vod.clip(start, end, args.name ? String(args.name) : undefined)
        return `Clip created.\n\nFile: ${path}\nRange: ${formatSec(start)} - ${formatSec(end)}\nThumb: ${path.replace('.mp4', '_thumb.jpg')}`
      } catch (e: any) { return `Error: ${e.message}` }
    },
  })

  registerTool({
    name: 'vod_highlights',
    description: 'List detected highlights with timestamps, types, and chat rates. Set all=true for full history.',
    parameters: {
      all: { type: 'string', description: 'Set "true" to show all persisted highlights across sessions.' },
    },
    tier: 'free',
    execute: async (args) => {
      const vod = getVOD()
      let highlights: Highlight[]
      if (String(args.all) === 'true') {
        try { highlights = existsSync(HIGHLIGHTS_FILE) ? JSON.parse(readFileSync(HIGHLIGHTS_FILE, 'utf-8')) : [] }
        catch { return 'Error reading highlights file.' }
      } else { highlights = vod.getHighlights() }
      if (!highlights.length)
        return 'No highlights yet. Auto-detected from: chat spikes (>10/30s), achievements, raids, milestones, !mark, !ship.'
      const lines = highlights.map((h, i) => `  ${i}. [${formatSec(h.timestamp)}] ${h.type} — ${h.description} (${h.chatRate}/30s)`)
      return `Highlights (${highlights.length}):\n${lines.join('\n')}\n\nUse vod_clip with highlight_index to extract.`
    },
  })

  registerTool({
    name: 'vod_upload',
    description: 'Upload VOD/clip to YouTube (unlisted). Requires OAuth2 in ~/.kbot/youtube-auth.json.',
    parameters: {
      file: { type: 'string', description: 'Video file path. Default: most recent recording.', required: true },
      title: { type: 'string', description: 'Video title. Default: from filename.' },
      description: { type: 'string', description: 'Video description.' },
    },
    tier: 'free',
    timeout: 600_000,
    execute: async (args) => {
      const vod = getVOD()
      const fp = String(args.file || vod.getRecordingInfo().filePath || '')
      if (!fp || !existsSync(fp)) return `Error: File not found: ${fp || '(none)'}`
      const title = String(args.title || fp.split('/').pop()?.replace('.mp4', '') || 'kbot stream')
      const desc = String(args.description || 'Recorded with kbot — https://kernel.chat')
      if (!existsSync(YOUTUBE_AUTH_FILE))
        return `YouTube not configured. Save OAuth2 credentials to ~/.kbot/youtube-auth.json.\nFile ready: ${fp} (${fileSizeMB(fp)} MB)`
      try {
        const url = await vod.uploadToYouTube(fp, title, desc)
        return `Uploaded (unlisted).\n\nURL: ${url}\nTitle: ${title}\nSize: ${fileSizeMB(fp)} MB`
      } catch (e: any) { return `Upload failed: ${e.message}\n\nFile ready: ${fp} (${fileSizeMB(fp)} MB)` }
    },
  })
}
