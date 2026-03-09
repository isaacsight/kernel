// K:BOT Fetch Tool — URL content fetching with SSRF protection
// Fetches web content and strips HTML → plain text.

import { registerTool } from './index.js'

/** Private/reserved IP patterns — block SSRF */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^169\.254\.\d+\.\d+$/,
  /\.local$/i,
]

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some(p => p.test(hostname))
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

      if (isBlockedHost(parsed.hostname)) {
        return `Error: Blocked host (private/reserved IP range)`
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
