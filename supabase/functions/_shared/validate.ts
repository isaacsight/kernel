// Shared input validation utilities
//
// Usage:
//   import { requireContentType, requireJsonBody, requireFields, checkSSRF, requireMaxArrayLength } from '../_shared/validate.ts'
//
//   const ctErr = requireContentType(req)
//   if (ctErr) return ctErr(CORS_HEADERS)
//
//   const { body, error: bodyErr } = await requireJsonBody(req, 512 * 1024)
//   if (bodyErr) return bodyErr(CORS_HEADERS)

/** SSRF blocklist — private/reserved IP ranges */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc/i,
  /^\[?fd/i,
  /^\[?fe80/i,
]

type ErrorFactory = (corsHeaders: Record<string, string>) => Response

function makeError(status: number, error: string): ErrorFactory {
  return (corsHeaders: Record<string, string>) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
}

/**
 * Require Content-Type: application/json.
 * Returns null if valid, or an error factory if invalid.
 */
export function requireContentType(req: Request): ErrorFactory | null {
  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    return makeError(415, 'Content-Type must be application/json')
  }
  return null
}

/**
 * Parse JSON body with size limit.
 * Returns { body } on success or { error } on failure.
 */
export async function requireJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes: number = 256 * 1024
): Promise<{ body: T; error?: undefined } | { body?: undefined; error: ErrorFactory }> {
  // Check Content-Length if available
  const cl = req.headers.get('content-length')
  if (cl && parseInt(cl, 10) > maxBytes) {
    return { error: makeError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`) }
  }

  try {
    const text = await req.text()
    if (text.length > maxBytes) {
      return { error: makeError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`) }
    }
    const body = JSON.parse(text) as T
    return { body }
  } catch {
    return { error: makeError(400, 'Invalid JSON body') }
  }
}

/**
 * Require specific fields are present and non-empty in the body.
 * Returns null if all present, or an error factory listing missing fields.
 */
export function requireFields(
  body: Record<string, unknown>,
  fields: string[]
): ErrorFactory | null {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '')
  if (missing.length > 0) {
    return makeError(400, `Missing required fields: ${missing.join(', ')}`)
  }
  return null
}

/**
 * SSRF check — validates a URL is not targeting private/internal addresses.
 * Returns null if safe, or an error factory if blocked.
 */
export function checkSSRF(url: string): ErrorFactory | null {
  try {
    const parsed = new URL(url)

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return makeError(400, 'Only HTTP/HTTPS URLs are allowed')
    }

    if (BLOCKED_HOSTS.some(re => re.test(parsed.hostname))) {
      return makeError(400, 'URL points to a blocked host')
    }

    return null
  } catch {
    return makeError(400, 'Invalid URL')
  }
}

/**
 * Require array length does not exceed max.
 * Returns null if valid, or an error factory if too long.
 */
export function requireMaxArrayLength(
  arr: unknown[],
  max: number,
  fieldName: string = 'array'
): ErrorFactory | null {
  if (arr.length > max) {
    return makeError(400, `${fieldName} exceeds maximum length of ${max}`)
  }
  return null
}
