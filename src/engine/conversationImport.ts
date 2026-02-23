// Conversation Import — detect platform URLs and import structured conversations

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const IMPORT_ENDPOINT = `${SUPABASE_URL}/functions/v1/import-conversation`

export type Platform = 'chatgpt' | 'claude' | 'gemini'

export interface ImportResult {
  platform: Platform | 'unknown'
  title: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  message_count: number
}

const PLATFORM_PATTERNS: [Platform, RegExp][] = [
  ['chatgpt', /^https?:\/\/(www\.)?(chatgpt\.com|chat\.openai\.com)\/share\//],
  ['claude', /^https?:\/\/(www\.)?claude\.ai\/share\//],
  ['gemini', /^https?:\/\/(www\.)?gemini\.google\.com\/share\//],
]

export function detectPlatformUrl(url: string): Platform | null {
  for (const [platform, pattern] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform
  }
  return null
}

export function isPlatformShareLink(url: string): boolean {
  return detectPlatformUrl(url) !== null
}

export async function importConversation(url: string): Promise<ImportResult> {
  const token = await getAccessToken()
  const res = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Import failed' }))
    throw new Error(body.error || `Import failed (${res.status})`)
  }

  return res.json()
}

export async function importConversationFromText(text: string): Promise<ImportResult> {
  const token = await getAccessToken()
  const res = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Parse failed' }))
    throw new Error(body.error || `Parse failed (${res.status})`)
  }

  return res.json()
}

export function formatImportedContext(result: ImportResult, userMessage: string): string {
  const platformName = result.platform === 'chatgpt' ? 'ChatGPT'
    : result.platform === 'claude' ? 'Claude'
    : result.platform === 'gemini' ? 'Gemini'
    : 'another AI'

  const header = `[Imported conversation from ${platformName}: "${result.title}"]`
  const turns = result.messages
    .slice(0, 30) // Limit context size
    .map(m => `**${m.role === 'user' ? 'User' : 'Assistant'}**: ${m.content.slice(0, 500)}`)
    .join('\n\n')

  return `${header}\n\n${turns}\n\n---\n${userMessage}`
}

export function convertToKernelMessages(
  result: ImportResult
): { role: string; content: string; agentName?: string; timestamp: number }[] {
  const now = Date.now()
  return result.messages.map((m, i) => ({
    role: m.role === 'user' ? 'user' : 'kernel',
    content: m.content,
    agentName: m.role === 'assistant' ? 'Kernel' : undefined,
    timestamp: now - (result.messages.length - i) * 1000,
  }))
}
