// Audio Transcription — sends audio files to the transcribe edge function

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const TRANSCRIBE_ENDPOINT = `${SUPABASE_URL}/functions/v1/transcribe`

export interface TranscribeResult {
  text: string
  duration_seconds: number | null
  language: string | null
}

export async function transcribeAudio(file: File): Promise<TranscribeResult> {
  const token = await getAccessToken()
  const formData = new FormData()
  formData.append('file', file, file.name)

  const res = await fetch(TRANSCRIBE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Transcription failed' }))
    throw new Error(body.error || `Transcription failed (${res.status})`)
  }

  return res.json()
}
