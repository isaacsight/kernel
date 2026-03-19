// Forge Registry — Shared forged tools across all kbot users
//
// Collective autopoiesis: each kbot installation contributes tools
// that all other installations can discover and use.
//
// Routes:
//   POST /publish    — Publish a forged tool to the registry
//   GET  /search     — Search published tools by query
//   GET  /popular    — List most-downloaded tools
//   GET  /tool/:id   — Get a specific tool's code
//   POST /install    — Record an installation (increment downloads)
//
// Auth: Bearer token (kernel.chat JWT or kn_live_* API key)
// Deploy: npx supabase functions deploy forge-registry --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Security: re-validate code server-side (don't trust client) */
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bAsyncFunction\b/,
  /\bprocess\.exit\b/,
  /\bprocess\.kill\b/,
  /\bprocess\.env\b/,
  /\brequire\s*\(\s*['"`](?:node:)?child_process['"`]\s*\)/,
  /\bimport\s*\(\s*['"`](?:node:)?child_process['"`]\s*\)/,
  /\bexecSync\b/,
  /\bspawnSync\b/,
  /\brequire\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/,
  /\bimport\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/,
  /\bglobalThis\b/,
  /\b__proto__\b/,
  /\bProxy\s*\(/,
  /\bimport\s*\(\s*[^'"`\s]/,
  /\brequire\s*\(\s*[^'"`\s]/,
]

function isCodeSafe(code: string): boolean {
  return !DANGEROUS_PATTERNS.some(p => p.test(code))
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/forge-registry/, '')

  // Auth
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Resolve user from token (optional for search/popular, required for publish)
  let userId: string | null = null
  if (token) {
    try {
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id ?? null
    } catch { /* anonymous access ok for reads */ }
  }

  try {
    // ── POST /publish ──
    if (path === '/publish' && req.method === 'POST') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required to publish' }), {
          status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const { name, description, code, parameters, tags } = body

      if (!name || !description || !code) {
        return new Response(JSON.stringify({ error: 'name, description, and code are required' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      // Server-side security validation
      if (!isCodeSafe(code)) {
        return new Response(JSON.stringify({ error: 'Code contains blocked patterns' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      // Check if tool name already exists for this user
      const { data: existing } = await supabase
        .from('forged_tools')
        .select('id, version')
        .eq('name', name)
        .eq('author_id', userId)
        .maybeSingle()

      const version = existing ? `${parseInt(existing.version?.split('.').pop() || '0') + 1}.0.0` : '1.0.0'

      const toolData = {
        name,
        description,
        code,
        parameters: parameters || {},
        tags: tags || [],
        version,
        author_id: userId,
        downloads: existing?.id ? undefined : 0,
        updated_at: new Date().toISOString(),
      }

      let result
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('forged_tools')
          .update(toolData)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        result = data
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('forged_tools')
          .insert({ ...toolData, created_at: new Date().toISOString() })
          .select()
          .single()
        if (error) throw error
        result = data
      }

      return new Response(JSON.stringify({ ok: true, tool: result }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── GET /search?q=query ──
    if (path === '/search' && req.method === 'GET') {
      const query = url.searchParams.get('q') || ''
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

      let dbQuery = supabase
        .from('forged_tools')
        .select('id, name, description, tags, version, downloads, created_at, updated_at')
        .order('downloads', { ascending: false })
        .limit(limit)

      if (query) {
        dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      }

      const { data, error } = await dbQuery
      if (error) throw error

      return new Response(JSON.stringify({ tools: data || [] }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── GET /popular ──
    if (path === '/popular' && req.method === 'GET') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)

      const { data, error } = await supabase
        .from('forged_tools')
        .select('id, name, description, tags, version, downloads, created_at')
        .order('downloads', { ascending: false })
        .limit(limit)
      if (error) throw error

      return new Response(JSON.stringify({ tools: data || [] }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── GET /tool/:id ──
    const toolMatch = path.match(/^\/tool\/(.+)$/)
    if (toolMatch && req.method === 'GET') {
      const toolId = toolMatch[1]

      const { data, error } = await supabase
        .from('forged_tools')
        .select('*')
        .eq('id', toolId)
        .single()
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Tool not found' }), {
          status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ tool: data }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── POST /install ──
    if (path === '/install' && req.method === 'POST') {
      const { id } = await req.json()
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      // Increment download count
      const { error } = await supabase.rpc('increment_forge_downloads', { tool_id: id })
      if (error) {
        // Fallback: manual increment
        const { data: tool } = await supabase.from('forged_tools').select('downloads').eq('id', id).single()
        if (tool) {
          await supabase.from('forged_tools').update({ downloads: (tool.downloads || 0) + 1 }).eq('id', id)
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
