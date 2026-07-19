import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const TOKEN_BYTES = 32
const QUOTE_TTL_MS = 5 * 60 * 1000

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
  }
  return value
}

function requestHash(route, body) {
  return createHash('sha256').update(JSON.stringify(stableValue({ route, body }))).digest('base64url')
}

function sameText(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function loadOrCreateEngineToken(path) {
  try {
    const token = (await readFile(path, 'utf8')).trim()
    if (token.length < 32) throw new Error('token is too short')
    return { token, created: false }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error(`Engine token is unreadable: ${error.message}`)
    const token = randomBytes(TOKEN_BYTES).toString('base64url')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${token}\n`, { mode: 0o600, flag: 'wx' })
    return { token, created: true }
  }
}

export function bearerToken(req) {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || ''
}

export function isAuthorized(req, expectedToken) {
  const supplied = bearerToken(req)
  return Boolean(supplied && expectedToken && sameText(supplied, expectedToken))
}

export function createQuote(secret, route, body, cost, now = Date.now()) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error('Cannot quote an unknown cost')
  const payload = {
    v: 1,
    route,
    requestHash: requestHash(route, body),
    cost,
    expiresAt: now + QUOTE_TTL_MS,
    nonce: randomBytes(12).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyQuote(secret, token, route, body, now = Date.now()) {
  if (typeof token !== 'string') throw new Error('A valid estimate quote is required')
  const [encoded, signature, extra] = token.split('.')
  if (!encoded || !signature || extra) throw new Error('A valid estimate quote is required')
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url')
  if (!sameText(signature, expected)) throw new Error('Estimate quote signature is invalid')
  let payload
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { throw new Error('Estimate quote is malformed') }
  if (payload.v !== 1 || payload.route !== route || payload.expiresAt < now) throw new Error('Estimate quote is expired or for another route')
  if (!sameText(payload.requestHash, requestHash(route, body))) throw new Error('Request changed after estimation; request a new quote')
  if (!Number.isFinite(payload.cost) || payload.cost < 0) throw new Error('Estimate quote has an invalid cost')
  return payload.cost
}
