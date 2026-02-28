import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export interface ImageGenResult {
  image: string  // base64
  mimeType: string
  credits_remaining: number
  image_url?: string  // persistent storage URL
  auto_reloaded?: boolean
  reloaded_pack?: string
  reloaded_credits?: number
}

export interface AutoReloadSettings {
  enabled: boolean
  pack: string | null
  threshold: number
  has_payment_method: boolean
}

export class ImageCreditError extends Error {
  credits: number
  constructor(credits: number) {
    super('No image credits')
    this.name = 'ImageCreditError'
    this.credits = credits
  }
}

export class ImageGenLimitError extends Error {
  used: number
  limit: number
  constructor(used: number, limit: number) {
    super('Image generation rate limited')
    this.name = 'ImageGenLimitError'
    this.used = used
    this.limit = limit
  }
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const token = await getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ prompt }),
  })

  if (res.status === 403) {
    const data = await res.json().catch(() => ({ credits: 0 }))
    throw new ImageCreditError(data.credits ?? 0)
  }

  if (res.status === 429) {
    const data = await res.json().catch(() => ({ current_count: 0, limit: 10 }))
    throw new ImageGenLimitError(data.current_count ?? 0, data.limit ?? 10)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(data.error || `Image generation failed (${res.status})`)
  }

  return res.json()
}

export async function getAutoReload(): Promise<AutoReloadSettings> {
  const token = await getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action: 'get_auto_reload' }),
  })
  if (!res.ok) return { enabled: false, pack: null, threshold: 5, has_payment_method: false }
  return res.json()
}

export async function setAutoReload(pack: string | null, threshold = 5): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action: 'set_auto_reload', pack, threshold }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(data.error || 'Failed to update auto-reload settings')
  }
}

export async function getImageCredits(): Promise<number> {
  const token = await getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action: 'check_credits' }),
  })
  if (!res.ok) return 0
  const data = await res.json()
  return data.credits ?? 0
}
