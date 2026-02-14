// Supabase Edge Function: web-search
// Searches the web via Perplexity's online models and returns grounded results.
// The Kernel Agent calls this before Claude to get live web context.
//
// Deploy: npx supabase functions deploy web-search --project-ref eoxxpyixdieprsxlpwcs
// Secrets needed: PERPLEXITY_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchPayload {
  query: string
  max_tokens?: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ error: 'Missing PERPLEXITY_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as SearchPayload
    const { query, max_tokens = 800 } = payload

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a web research assistant. Return factual, sourced information with URLs when available. Be concise and cite your sources. Focus on the most recent and relevant results.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens,
        temperature: 0.1,
        return_citations: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Perplexity API error:', response.status, errText)
      return new Response(
        JSON.stringify({ error: 'Search API error', details: errText }),
        { status: response.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const citations = data.citations || []

    return new Response(
      JSON.stringify({ text, citations }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('web-search error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
