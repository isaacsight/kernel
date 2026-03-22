// kbot Search & Research Tools — Web knowledge expansion
// These tools connect kbot to the internet for real-time knowledge.

import { registerTool } from './index.js'

export function registerSearchTools(): void {
  registerTool({
    name: 'web_search',
    description: 'Search the web for current information, documentation, tutorials, APIs, or any knowledge. Free — no API key required. Use freely whenever you need information beyond your training data.',
    parameters: {
      query: { type: 'string', description: 'Search query — be specific for best results', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)

      // Multi-source free search
      const parts: string[] = []

      // Source 1: DuckDuckGo instant answer API
      try {
        const encoded = encodeURIComponent(query)
        const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, {
          headers: { 'User-Agent': 'KBot/2.0 (Web Search)' },
          signal: AbortSignal.timeout(8000),
        })
        const data = await res.json()
        if (data.AbstractText) parts.push(`**${data.AbstractSource}**: ${data.AbstractText}`)
        if (data.Answer) parts.push(`**Answer**: ${data.Answer}`)
        if (data.RelatedTopics?.length > 0) {
          parts.push('**Related:**')
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text) parts.push(`- ${topic.Text}`)
          }
        }
      } catch { /* continue to next source */ }

      // Source 2: Wikipedia for factual queries
      try {
        const encoded = encodeURIComponent(query.split(' ').slice(0, 3).join(' '))
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
          headers: { 'User-Agent': 'KBot/2.0 (Web Search)' },
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.extract && data.extract.length > 50) {
            parts.push(`**Wikipedia**: ${data.extract}`)
          }
        }
      } catch { /* skip */ }

      // Source 3: StackOverflow/StackExchange for programming queries
      if (/\b(code|error|bug|how to|function|api|library|framework|install|configure|setup|npm|pip|cargo|docker)\b/i.test(query)) {
        try {
          const encoded = encodeURIComponent(query)
          const res = await fetch(`https://api.stackexchange.com/2.3/search/excerpts?order=desc&sort=relevance&q=${encoded}&site=stackoverflow&pagesize=3`, {
            signal: AbortSignal.timeout(5000),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.items?.length > 0) {
              parts.push('**Stack Overflow:**')
              for (const item of data.items.slice(0, 3)) {
                const title = item.title?.replace(/<[^>]+>/g, '') || ''
                const body = (item.excerpt || item.body || '').replace(/<[^>]+>/g, '').slice(0, 200)
                parts.push(`- **${title}**: ${body}...`)
              }
            }
          }
        } catch { /* skip */ }
      }

      if (parts.length > 0) {
        return parts.join('\n\n')
      }
      return `No instant results for "${query}". Try:\n- url_fetch with a specific documentation URL\n- research tool for deeper investigation`
    },
  })

  registerTool({
    name: 'research',
    description: 'Deep research — searches the web, fetches multiple URLs, and synthesizes a comprehensive answer. Use for complex questions that need multiple sources.',
    parameters: {
      topic: { type: 'string', description: 'The topic or question to research thoroughly', required: true },
      urls: { type: 'array', description: 'Optional: specific URLs to include in the research', items: { type: 'string' } },
    },
    tier: 'free',
    async execute(args) {
      const topic = String(args.topic)
      const urls = (args.urls as string[] | undefined) || []

      const results: string[] = []

      // Fetch any provided URLs
      for (const url of urls.slice(0, 5)) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 10000)
          const res = await fetch(String(url), {
            headers: { 'User-Agent': 'KBot/1.3 (Research Tool)', 'Accept': 'text/html,application/json,text/plain,*/*' },
            signal: controller.signal,
            redirect: 'follow',
          })
          clearTimeout(timeout)
          if (res.ok) {
            const text = await res.text()
            const clean = text
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 5000)
            results.push(`**Source: ${url}**\n${clean}`)
          }
        } catch { /* skip failed URLs */ }
      }

      // DuckDuckGo instant answers
      try {
        const encoded = encodeURIComponent(topic)
        const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, {
          headers: { 'User-Agent': 'KBot/1.3 (Research)' },
        })
        const data = await res.json()
        if (data.AbstractText) results.push(`**${data.AbstractSource}**: ${data.AbstractText}`)
        if (data.RelatedTopics?.length > 0) {
          for (const t of data.RelatedTopics.slice(0, 3)) {
            if (t.Text) results.push(`- ${t.Text}`)
          }
        }
      } catch { /* skip */ }

      // Also try Wikipedia API for factual grounding
      try {
        const encoded = encodeURIComponent(topic)
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
          headers: { 'User-Agent': 'KBot/1.3 (Research)' },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.extract) results.push(`**Wikipedia**: ${data.extract}`)
        }
      } catch { /* skip */ }

      if (results.length === 0) {
        return `No research results found for "${topic}". Try breaking down the topic or providing specific URLs.`
      }

      return `Research results for: ${topic}\n\n${results.join('\n\n')}`
    },
  })
}
