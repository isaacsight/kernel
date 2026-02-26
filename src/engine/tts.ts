// Text-to-Speech — calls the TTS edge function and manages audio playback

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const TTS_ENDPOINT = `${SUPABASE_URL}/functions/v1/tts`

export type TTSVoice = 'alloy' | 'nova' | 'echo' | 'onyx' | 'shimmer'
export const TTS_VOICES: { id: TTSVoice; label: string }[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'nova', label: 'Nova' },
  { id: 'echo', label: 'Echo' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'shimmer', label: 'Shimmer' },
]

// ─── State ──────────────────────────────────────────────
let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null
let _isPlaying = false

// ─── API ────────────────────────────────────────────────

/**
 * Synthesize speech from text via the TTS edge function.
 * Returns an audio Blob (audio/mpeg).
 */
export async function synthesizeSpeech(text: string, voice?: TTSVoice): Promise<Blob> {
  const token = await getAccessToken()

  const res = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ text, voice: voice || 'alloy' }),
  })

  if (!res.ok) {
    let errorMsg = `TTS failed (${res.status})`
    try {
      const body = await res.json()
      errorMsg = body.error || body.message || errorMsg
    } catch { /* non-JSON response */ }
    throw new Error(errorMsg)
  }

  return res.blob()
}

/**
 * Play an audio blob. Returns a promise that resolves when playback ends.
 */
export function playAudio(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stop any current playback
    stopAudio()

    const url = URL.createObjectURL(blob)
    currentObjectUrl = url
    const audio = new Audio(url)
    currentAudio = audio
    _isPlaying = true

    audio.onended = () => {
      cleanup()
      resolve()
    }

    audio.onerror = () => {
      cleanup()
      reject(new Error('Audio playback failed'))
    }

    audio.play().catch((err) => {
      cleanup()
      reject(err)
    })
  })
}

/**
 * Stop any currently playing audio.
 */
export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  _isPlaying = false
}

/**
 * Check if audio is currently playing.
 */
export function isPlaying(): boolean {
  return _isPlaying
}

/**
 * Clean up text for TTS — remove code blocks, links, markdown syntax.
 */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [code block] ')
    .replace(/`[^`]+`/g, (match) => match.slice(1, -1)) // inline code: keep the text
    .replace(/https?:\/\/[^\s]+/g, ' [link] ')
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/__([^_]+)__/g, '$1')     // bold
    .replace(/_([^_]+)_/g, '$1')       // italic
    .replace(/^#{1,6}\s*/gm, '')       // headings
    .replace(/^\s*[-*+]\s/gm, '')      // list markers
    .replace(/^\s*\d+\.\s/gm, '')      // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
    .replace(/\n{3,}/g, '\n\n')        // collapse whitespace
    .trim()
}

// ─── Internal ───────────────────────────────────────────

function cleanup() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  currentAudio = null
  _isPlaying = false
}
