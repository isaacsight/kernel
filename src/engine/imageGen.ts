// Image Generation — calls the image-gen edge function (Pro only)

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const IMAGE_GEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/image-gen`

export interface ImageGenResult {
  text: string
  images: { data: string; mimeType: string }[]
  model: string
}

export class ImageGenLimitError extends Error {
  retryAfter: number
  limit: number
  constructor(retryAfter: number, limit: number) {
    super(`Image generation rate limited. Try again in ${Math.ceil(retryAfter / 60)} minutes.`)
    this.name = 'ImageGenLimitError'
    this.retryAfter = retryAfter
    this.limit = limit
  }
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const token = await getAccessToken()

  const res = await fetch(IMAGE_GEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  if (res.status === 403) {
    const body = await res.json().catch(() => ({ error: 'pro_only' }))
    if (body.error === 'pro_only') {
      throw new Error('pro_only')
    }
    throw new Error(body.error || 'Forbidden')
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({ retry_after: 60, limit: 10 }))
    throw new ImageGenLimitError(body.retry_after || 60, body.limit || 10)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Image generation failed' }))
    throw new Error(body.error || `Image generation failed (${res.status})`)
  }

  return res.json()
}
