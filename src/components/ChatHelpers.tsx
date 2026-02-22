import type { EngineState, EngineEvent } from '../engine/AIEngine'
import { getAccessToken } from '../engine/SupabaseClient'

// ─── File type utilities ─────────────────────────────────

export const TEXT_EXTENSIONS = ['.txt', '.csv', '.md']
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
export const ACCEPTED_FILES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.md'

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
}

export function getMediaType(file: File): string {
  if (file.type) return file.type
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return EXT_TO_MIME[ext] || 'application/octet-stream'
}

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ext === '.pdf'
}

// ─── File size validation ─────────────────────────────────

interface FileSizeLimit {
  images: number  // bytes
  pdfs: number    // bytes
  text: number    // bytes
}

// Server payload limit is 5MB for media requests. Base64 adds ~33% overhead,
// so raw file must be under ~3.75MB to stay within the limit.
// Images are compressed client-side so their raw size doesn't matter much.
// PDFs and animated GIFs are sent raw — these limits must account for base64 bloat.
const FREE_LIMITS: FileSizeLimit = { images: 5 * 1024 * 1024, pdfs: 3.5 * 1024 * 1024, text: 5 * 1024 * 1024 }
const PRO_LIMITS: FileSizeLimit = { images: 20 * 1024 * 1024, pdfs: 3.5 * 1024 * 1024, text: 20 * 1024 * 1024 }

export function validateFileSize(file: File, isPro: boolean): string | null {
  const limits = isPro ? PRO_LIMITS : FREE_LIMITS
  if (isImageFile(file) && file.size > limits.images) {
    return `Image too large (${(file.size / 1048576).toFixed(1)}MB). Max ${(limits.images / 1048576).toFixed(0)}MB.`
  }
  if (isPdfFile(file) && file.size > limits.pdfs) {
    return `PDF too large (${(file.size / 1048576).toFixed(1)}MB). Max ${(limits.pdfs / 1048576).toFixed(0)}MB.`
  }
  if (file.size > limits.text) {
    return `File too large (${(file.size / 1048576).toFixed(1)}MB). Max ${(limits.text / 1048576).toFixed(0)}MB.`
  }
  return null
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}

// ─── File export helper ──────────────────────────────────

export const LANG_EXT: Record<string, string> = {
  python: '.py', py: '.py', javascript: '.js', js: '.js', typescript: '.ts', ts: '.ts',
  tsx: '.tsx', jsx: '.jsx', html: '.html', css: '.css', csv: '.csv', json: '.json', sql: '.sql',
  bash: '.sh', sh: '.sh', markdown: '.md', md: '.md', yaml: '.yml', yml: '.yml',
  xml: '.xml', java: '.java', rust: '.rs', go: '.go', c: '.c', cpp: '.cpp',
  'c++': '.cpp', 'c#': '.cs', 'objective-c': '.m', 'f#': '.fs',
  ruby: '.rb', php: '.php', swift: '.swift', kotlin: '.kt', r: '.r',
  toml: '.toml', svg: '.svg', scss: '.scss', sass: '.sass', less: '.less',
}

const DOWNLOAD_MIME: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/typescript',
  '.json': 'application/json', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.csv': 'text/csv',
  '.md': 'text/markdown', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.sh': 'application/x-sh', '.py': 'text/x-python',
}

export function getMimeType(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return DOWNLOAD_MIME[ext] || 'text/plain'
}

export function downloadFile(content: string, filename: string) {
  const mime = getMimeType(filename)
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadAllFiles(files: { filename: string; content: string }[]) {
  // Sequential download with small delays to avoid browser blocking
  files.forEach((file, i) => {
    setTimeout(() => downloadFile(file.content, file.filename), i * 150)
  })
}

// ─── Engine State Serializer ────────────────────────────

export function serializeState(s: EngineState): string {
  const parts: string[] = [
    `## Engine State Snapshot`,
    `Phase: ${s.phase}`,
    `Cycles: ${s.cycleCount} | Turns: ${s.working.turnCount}`,
    `Topic: ${s.working.topic || '(none)'}`,
    `Conviction: ${(s.worldModel.convictions.overall * 100).toFixed(1)}% (${s.worldModel.convictions.trend})`,
  ]

  if (s.worldModel.beliefs.length > 0) {
    parts.push(`\n## Beliefs (${s.worldModel.beliefs.length})`)
    for (const b of s.worldModel.beliefs) {
      parts.push(`- [${(b.confidence * 100).toFixed(0)}%] ${b.content} (${b.source})`)
    }
  }

  if (s.ephemeral.perception) {
    const p = s.ephemeral.perception
    parts.push(`\n## Perception: ${p.intent.type} | urgency ${(p.urgency * 100).toFixed(0)}% | complexity ${(p.complexity * 100).toFixed(0)}%`)
    parts.push(`Implied need: ${p.impliedNeed}`)
  }

  if (s.ephemeral.attention) {
    parts.push(`\n## Attention: ${s.ephemeral.attention.primaryFocus} (${s.ephemeral.attention.depth})`)
  }

  if (s.ephemeral.activeAgent) {
    parts.push(`\n## Active Agent: ${s.ephemeral.activeAgent.name}`)
  }

  const recent = s.lasting.reflections.slice(-2)
  if (recent.length > 0) {
    parts.push(`\n## Recent Reflections`)
    for (const r of recent) {
      parts.push(`- Quality ${(r.quality * 100).toFixed(0)}% (${r.agentUsed}): ${r.lesson}`)
    }
  }

  const perf = Object.entries(s.lasting.agentPerformance)
  if (perf.length > 0) {
    parts.push(`\n## Agent Performance`)
    for (const [id, p] of perf) {
      parts.push(`- ${id}: ${(p.avgQuality * 100).toFixed(0)}% avg, ${p.uses} uses`)
    }
  }

  parts.push(`\n## User Model: goal=${s.worldModel.userModel.apparentGoal}, style=${s.worldModel.userModel.communicationStyle}`)
  parts.push(`Situation: ${s.worldModel.situationSummary}`)

  return parts.join('\n')
}

// ─── Event Feed (compact) ───────────────────────────────

export function EventFeed({ events }: { events: EngineEvent[] }) {
  if (events.length === 0) return null
  return (
    <div className="ka-events">
      {[...events].reverse().slice(0, 5).map((e, i) => (
        <div key={i} className="ka-event">
          <span className="ka-event-time">
            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="ka-event-type">{e.type.replace(/_/g, ' ')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── URL fetch helper ────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const URL_FETCH_ENDPOINT = `${SUPABASE_URL}/functions/v1/url-fetch`

export const LINK_REGEX = /https?:\/\/[^\s)<>]+(?:\([^\s)<>]*\))?[^\s)<>,."'!?\]]*(?=[.,!?\]]*(?:\s|$))|https?:\/\/[^\s)<>]+/g

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const token = await getAccessToken()
    const res = await fetch(URL_FETCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) return ''
    const { text } = await res.json()
    return text || ''
  } catch {
    return ''
  }
}
