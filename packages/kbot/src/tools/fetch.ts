// kbot Fetch Tool — URL content fetching with SSRF protection
// Fetches web content and strips HTML → plain text.
// DNS rebinding defense: resolves hostname → IP before fetching, then checks the IP.

import { lookup } from 'node:dns/promises'
import { registerTool } from './index.js'

/** Private/reserved IP patterns — block SSRF (applied to resolved IPs, not just hostnames) */
const BLOCKED_IP_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^169\.254\.\d+\.\d+$/,
]

const BLOCKED_HOSTNAMES = [
  /^localhost$/i,
  /\.local$/i,
]

function isBlockedIP(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some(p => p.test(ip))
}

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTNAMES.some(p => p.test(hostname))
}

/** Resolve hostname to IP and check against blocked ranges (DNS rebinding defense) */
async function checkHostSSRF(hostname: string): Promise<string | null> {
  // Check hostname patterns first (localhost, .local)
  if (isBlockedHost(hostname)) return 'Blocked host (private/reserved)'

  // If it's already an IP literal, check directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
    if (isBlockedIP(hostname)) return 'Blocked host (private/reserved IP range)'
    return null
  }

  // Resolve DNS and check the actual IP
  try {
    const { address } = await lookup(hostname)
    if (isBlockedIP(address)) return `Blocked: ${hostname} resolves to private IP ${address}`
  } catch {
    // DNS resolution failed — let fetch handle it (could be a valid host we can't resolve locally)
  }
  return null
}

/** Strip HTML tags and decode entities → plain text */
function htmlToText(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Convert block elements to newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|pre|hr)[^>]*>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function registerFetchTools(): void {
  registerTool({
    name: 'url_fetch',
    description: 'Fetch the content of a URL and return it as plain text. Strips HTML. Useful for reading documentation, APIs, or web pages.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch', required: true },
      max_length: { type: 'number', description: 'Maximum characters to return (default: 20000)' },
    },
    tier: 'free',
    async execute(args) {
      const urlStr = String(args.url)
      const maxLength = typeof args.max_length === 'number' ? args.max_length : 20000

      let parsed: URL
      try {
        parsed = new URL(urlStr)
      } catch {
        return `Error: Invalid URL: ${urlStr}`
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return `Error: Only http/https URLs are supported`
      }

      const ssrfBlock = await checkHostSSRF(parsed.hostname)
      if (ssrfBlock) {
        return `Error: ${ssrfBlock}`
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        const res = await fetch(urlStr, {
          headers: {
            'User-Agent': 'KBot/1.2 (URL Fetch Tool)',
            'Accept': 'text/html,application/json,text/plain,*/*',
          },
          signal: controller.signal,
          redirect: 'follow',
        })

        clearTimeout(timeout)

        if (!res.ok) {
          return `Error: HTTP ${res.status} ${res.statusText}`
        }

        const contentType = res.headers.get('content-type') || ''
        const rawText = await res.text()

        let text: string
        if (contentType.includes('text/html')) {
          text = htmlToText(rawText)
        } else {
          text = rawText
        }

        if (text.length > maxLength) {
          text = text.slice(0, maxLength) + `\n\n... (truncated at ${maxLength} chars, total: ${rawText.length})`
        }

        return text || '(empty response)'
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'Error: Request timed out (15s)'
        }
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
