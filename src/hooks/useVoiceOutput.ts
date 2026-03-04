import { useState, useRef, useCallback, useEffect } from 'react'
import { getAccessToken } from '../engine/SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const TTS_ENDPOINT = `${SUPABASE_URL}/functions/v1/tts`

export type TTSVoice = 'alloy' | 'nova' | 'echo' | 'onyx' | 'shimmer'

interface UseVoiceOutputReturn {
  isSpeaking: boolean
  speak: (text: string) => Promise<void>
  stop: () => void
  voice: TTSVoice
  setVoice: (v: TTSVoice) => void
  error: string | null
}

/** Strip markdown artifacts and URLs before sending to TTS */
function preprocessForTTS(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, 'code block omitted')
    // Remove inline code
    .replace(/`[^`]+`/g, '')
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove markdown image/link syntax
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Text-to-speech output.
 * - Pro users: OpenAI TTS via edge function (high quality)
 * - Free users: browser-native speechSynthesis (lower quality, no API cost)
 */
export function useVoiceOutput(isPro: boolean): UseVoiceOutputReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voice, setVoice] = useState<TTSVoice>('nova')
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      abortRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    setIsSpeaking(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
    window.speechSynthesis?.cancel()
  }, [])

  const speakWithTTS = useCallback(async (text: string) => {
    const processed = preprocessForTTS(text)
    if (!processed) return

    // Truncate to 4096 chars (TTS API limit)
    const truncated = processed.slice(0, 4096)

    abortRef.current = new AbortController()
    const token = await getAccessToken()

    const res = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: truncated, voice }),
      signal: abortRef.current.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'TTS failed' }))
      throw new Error(body.error || `TTS failed (${res.status})`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio

    audio.onended = () => {
      setIsSpeaking(false)
      URL.revokeObjectURL(url)
      audioRef.current = null
    }

    audio.onerror = () => {
      setIsSpeaking(false)
      URL.revokeObjectURL(url)
      audioRef.current = null
    }

    await audio.play()
  }, [voice])

  const speakWithBrowser = useCallback((text: string) => {
    const processed = preprocessForTTS(text)
    if (!processed) return

    const synth = window.speechSynthesis
    if (!synth) throw new Error('Speech synthesis not supported')

    const utterance = new SpeechSynthesisUtterance(processed.slice(0, 2000))
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.lang = navigator.language || 'en-US'

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synth.speak(utterance)
  }, [])

  const speak = useCallback(async (text: string) => {
    stop()
    setError(null)
    setIsSpeaking(true)

    try {
      if (isPro) {
        await speakWithTTS(text)
      } else {
        speakWithBrowser(text)
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Speech failed')
      setIsSpeaking(false)
    }
  }, [isPro, speakWithTTS, speakWithBrowser, stop])

  return { isSpeaking, speak, stop, voice, setVoice, error }
}
