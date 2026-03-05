// K:BOT Search Tool — Web search via the Kernel API
// This is the one tool that DOES use an API call (counted against message limit)

import { getApiKey, getApiBase } from '../auth.js'
import { registerTool } from './index.js'

export function registerSearchTools(): void {
  registerTool({
    name: 'web_search',
    description: 'Search the web for current information. Uses your Kernel API quota — use sparingly.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
    },
    tier: 'starter',
    async execute(args) {
      const query = String(args.query)
      const apiKey = getApiKey()
      if (!apiKey) return 'Error: No API key configured. Run `kbot auth` first.'

      try {
        const res = await fetch(`${getApiBase()}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Kbot-Version': '1.0.0',
          },
          body: JSON.stringify({
            message: `Search the web for: ${query}\n\nReturn a concise summary of the top results with key facts and sources.`,
            agent: 'researcher',
            mode: 'json',
            max_tokens: 2048,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown' }))
          return `Search failed: ${err.error || `HTTP ${res.status}`}`
        }

        const data = await res.json()
        return data.content || 'No results found'
      } catch (err) {
        return `Search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
