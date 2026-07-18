const PARAM_KEY = /^[a-z][a-z0-9_]{0,40}$/i
const RESERVED_PARAMS = new Set(['prompt', 'image_url'])

export function cleanParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const out = {}
  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_KEY.test(key) || RESERVED_PARAMS.has(key)) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = value
  }
  return out
}

export function positiveSeconds(value, fallback = 5) {
  if (value === undefined || value === null || value === '') return fallback
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function catalogSeconds(body, fallback = 5) {
  return positiveSeconds(body?.params?.duration ?? body?.durationSeconds, fallback)
}

export function isAllowedOrigin(origin, extraOrigins = '') {
  if (!origin) return true // curl, agents, and other non-browser HTTP clients
  try {
    const url = new URL(origin)
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return false
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') return true
  } catch {
    return false
  }
  return String(extraOrigins).split(',').map(value => value.trim()).filter(Boolean).includes(origin)
}
