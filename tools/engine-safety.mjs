const PARAM_KEY = /^[a-z][a-z0-9_]{0,40}$/i
const RESERVED_PARAMS = new Set(['prompt', 'image_url'])
const MAX_PARAM_STRING = 2_000

export function cleanParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const out = {}
  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_KEY.test(key) || RESERVED_PARAMS.has(key)) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    if (typeof value === 'string' && value.length <= MAX_PARAM_STRING) out[key] = value
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

export function isFalQueueUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'queue.fal.run' && !url.username && !url.password
  } catch {
    return false
  }
}

export function isAllowedArtifactUrl(value, extraHosts = '') {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const configured = String(extraHosts).split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
    const hostname = url.hostname.toLowerCase()
    return hostname === 'fal.media' || hostname.endsWith('.fal.media') || configured.includes(hostname)
  } catch {
    return false
  }
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
