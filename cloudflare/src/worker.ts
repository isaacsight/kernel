// ─── Kernel OG Proxy ──────────────────────────────────────
//
// Cloudflare Worker that intercepts /s/{uuid} requests.
// Crawlers receive HTML with dynamic OG meta tags.
// Humans get a 302 redirect to the SPA hash route.
// All other paths pass through to the GitHub Pages origin.

interface Env {
  SITE_URL: string
  SUPABASE_URL: string
  OG_IMAGE_URL: string
}

const UUID_RE = /^\/s\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

const CRAWLER_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|redditbot|Mastodon|Googlebot|Bingbot|applebot|preview/i

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(UUID_RE)

    if (!match) {
      // Not a share link — pass through to origin (GitHub Pages)
      return fetch(request)
    }

    const shareId = match[1]
    const ua = request.headers.get('user-agent') || ''

    if (!CRAWLER_UA_RE.test(ua)) {
      // Human visitor — redirect to the SPA hash route
      return Response.redirect(`${env.SITE_URL}/#/shared/${shareId}`, 302)
    }

    // Crawler — fetch conversation data and return OG-enriched HTML
    try {
      const apiUrl = `${env.SUPABASE_URL}/functions/v1/shared-conversation?id=${encodeURIComponent(shareId)}`
      const apiRes = await fetch(apiUrl, {
        cf: { cacheTtl: 300, cacheEverything: true },
      })

      if (!apiRes.ok) {
        return fallbackHtml(env, shareId)
      }

      const data = await apiRes.json() as {
        title: string
        messages: { role: string; content: string }[]
      }

      const title = escapeHtml(data.title || 'Kernel Conversation')
      const description = escapeHtml(extractDescription(data.messages))
      const shareUrl = `${env.SITE_URL}/s/${shareId}`

      return new Response(ogHtml(title, description, shareUrl, env.OG_IMAGE_URL), {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': 'public, max-age=300',
        },
      })
    } catch {
      return fallbackHtml(env, shareId)
    }
  },
}

function extractDescription(messages: { role: string; content: string }[]): string {
  const first = messages.find(m => m.role === 'assistant')
  if (!first?.content) return 'A conversation on Kernel — AI that learns you.'
  const text = first.content.replace(/[#*_`~\[\]]/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 200 ? text.slice(0, 197) + '...' : text
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function ogHtml(title: string, description: string, url: string, image: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — Kernel</title>
<meta name="description" content="${description}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:site_name" content="Kernel">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${url}">View on Kernel</a></p>
</body>
</html>`
}

function fallbackHtml(env: Env, shareId: string): Response {
  const url = `${env.SITE_URL}/s/${shareId}`
  return new Response(
    ogHtml(
      'Kernel Conversation',
      'A conversation on Kernel — AI that learns you.',
      url,
      env.OG_IMAGE_URL,
    ),
    {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=60',
      },
    },
  )
}
