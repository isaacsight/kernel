// K:BOT Engine — Cloud backend for kbot CLI
//
// Provides cloud-powered features to kbot terminal users:
//   /sync    — Persist memory, patterns, and profile across machines
//   /proxy   — Multi-provider LLM proxy (for users without direct API keys)
//   /route   — Agent classification & routing (Haiku-fast)
//   /usage   — Usage tracking & cost attribution
//   /health  — Provider health scores for smart routing
//   /models  — List available models per provider
//
// Auth: Bearer token — either Supabase JWT or kn_live_* API key
// Deploy: npx supabase functions deploy kbot-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, SECURITY_HEADERS, OPEN_CORS_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse, type Tier } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const CORS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

// ── Provider configs ──

interface ProviderDef {
  apiUrl: string
  apiStyle: 'anthropic' | 'openai' | 'google'
  defaultModel: string
  fastModel: string
  envKey: string
  models: string[]
}

const PROVIDERS: Record<string, ProviderDef> = {
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiStyle: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    fastModel: 'claude-haiku-4-5-20251001',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'gpt-4.1',
    fastModel: 'gpt-4.1-mini',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini'],
  },
  google: {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiStyle: 'google',
    defaultModel: 'gemini-2.5-pro',
    fastModel: 'gemini-2.5-flash',
    envKey: 'GOOGLE_API_KEY',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  groq: {
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b'],
  },
}

// ── Auth ──

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface AuthResult {
  userId: string
  tier: Tier
  isApiKey: boolean
  svc: ReturnType<typeof createClient>
}

async function authenticate(req: Request): Promise<AuthResult | Response> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // API key auth (kn_live_*)
  if (token.startsWith('kn_live_')) {
    const keyHash = await hashKey(token)
    const { data, error } = await svc.rpc('validate_api_key', { p_key_hash: keyHash })
    if (error || !data?.length) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    const key = data[0]
    const tier: Tier = key.key_tier === 'max' ? 'max' : key.key_tier === 'pro' ? 'pro' : key.key_tier === 'paid' ? 'paid' : 'free'
    return { userId: key.key_user_id, tier, isApiKey: true, svc }
  }

  // JWT auth
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Resolve subscription tier
  const { data: sub } = await svc.from('subscriptions')
    .select('status, plan')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  const tier: Tier = sub?.plan?.includes('max') ? 'max' : sub?.plan?.includes('pro') ? 'pro' : sub ? 'paid' : 'free'
  return { userId: user.id, tier, isApiKey: false, svc }
}

// ── Routes ──

async function handleProxy(auth: AuthResult, body: Record<string, unknown>): Promise<Response> {
  const provider = String(body.provider || 'anthropic')
  const prov = PROVIDERS[provider]
  if (!prov) {
    return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const apiKey = Deno.env.get(prov.envKey)
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `Provider ${provider} not configured` }), {
      status: 503, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Rate limit
  const rl = await checkRateLimit(auth.svc, auth.userId, 'kbot-engine', auth.tier)
  if (!rl.allowed) return rateLimitResponse(rl, CORS)

  const model = String(body.model || (auth.tier === 'free' ? prov.fastModel : prov.defaultModel))
  const messages = body.messages as Array<{ role: string; content: string }>
  const systemPrompt = String(body.system || '')
  const maxTokens = Math.min(Number(body.max_tokens) || 4096, 8192)
  const stream = body.stream === true

  let upstream: Response

  if (prov.apiStyle === 'anthropic') {
    upstream = await fetch(prov.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt || undefined,
        messages,
        stream,
      }),
    })
  } else if (prov.apiStyle === 'google') {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const url = `${prov.apiUrl}/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })
  } else {
    // OpenAI-compatible (openai, groq)
    const msgs = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages
    upstream = await fetch(prov.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: msgs, stream }),
    })
  }

  if (!upstream.ok) {
    const errBody = await upstream.text()
    return new Response(JSON.stringify({ error: 'Provider error', status: upstream.status, detail: errBody.slice(0, 500) }), {
      status: upstream.status >= 500 ? 502 : upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Streaming: passthrough
  if (stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS },
    })
  }

  // Non-streaming: parse and normalize
  const result = await upstream.json()

  // Log usage
  logAudit(auth.svc, {
    actorId: auth.userId,
    actorType: auth.isApiKey ? 'service' : 'user',
    eventType: 'kbot.proxy',
    action: `${provider}/${model}`,
    source: 'kbot-engine',
    status: 'success',
    metadata: { provider, model, stream },
  }).catch(() => {})

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function handleSync(auth: AuthResult, body: Record<string, unknown>): Promise<Response> {
  const action = String(body.action || 'get')

  if (action === 'get') {
    // Fetch user's kbot memory from DB
    const { data, error } = await auth.svc
      .from('kbot_memory')
      .select('patterns, solutions, profile, knowledge, updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch memory' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(JSON.stringify({ memory: data || null }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  if (action === 'push') {
    // Upsert user's kbot memory
    const memory = {
      user_id: auth.userId,
      patterns: body.patterns || {},
      solutions: body.solutions || {},
      profile: body.profile || {},
      knowledge: body.knowledge || {},
      updated_at: new Date().toISOString(),
    }

    const { error } = await auth.svc
      .from('kbot_memory')
      .upsert(memory, { onConflict: 'user_id' })

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to sync memory' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(JSON.stringify({ synced: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify({ error: `Unknown sync action: ${action}` }), {
    status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function handleRoute(auth: AuthResult, body: Record<string, unknown>): Promise<Response> {
  // Fast agent classification using Groq (cheap, fast)
  const message = String(body.message || '')
  if (!message) {
    return new Response(JSON.stringify({ error: 'Missing message' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) {
    // Fallback: return default agent
    return new Response(JSON.stringify({
      agentId: 'kernel', confidence: 0.5, complexity: 0.5,
      needsSwarm: false, needsResearch: false, isMultiStep: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  const classifyPrompt = `Classify this user message for an AI terminal agent. Return JSON only.

Message: "${message.slice(0, 500)}"

Return: {"agentId": "kernel|researcher|coder|writer|analyst", "confidence": 0.0-1.0, "complexity": 0.0-1.0, "needsSwarm": bool, "needsResearch": bool, "isMultiStep": bool}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 200,
        messages: [{ role: 'user', content: classifyPrompt }],
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) throw new Error(`Groq ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || '{}'
    const classification = JSON.parse(text)

    return new Response(JSON.stringify(classification), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch {
    return new Response(JSON.stringify({
      agentId: 'kernel', confidence: 0.5, complexity: 0.5,
      needsSwarm: false, needsResearch: false, isMultiStep: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
}

async function handleUsage(auth: AuthResult): Promise<Response> {
  // Return user's kbot usage stats
  const { data, error } = await auth.svc.rpc('get_account_usage', { p_user_id: auth.userId })

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch usage' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify({ usage: data }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function handleHealth(): Response {
  // Return available providers and their status
  const providers: Record<string, { available: boolean; models: string[] }> = {}
  for (const [name, prov] of Object.entries(PROVIDERS)) {
    providers[name] = {
      available: !!Deno.env.get(prov.envKey),
      models: prov.models,
    }
  }

  return new Response(JSON.stringify({ status: 'ok', providers }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function handleModels(): Response {
  const models: Record<string, string[]> = {}
  for (const [name, prov] of Object.entries(PROVIDERS)) {
    models[name] = prov.models
  }
  // Add local providers (no cloud-side config needed)
  models.ollama = ['Auto-detected from local Ollama install']
  models.openclaw = ['openclaw:main']

  return new Response(JSON.stringify({ models }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// ── Collective Learning (no auth required — anonymized signals) ──

async function handleCollective(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({}))
  const action = body.action || ''

  switch (action) {
    case 'signal': {
      // Ingest an anonymized routing signal
      const { error } = await svc.rpc('log_routing_signal', {
        p_message_hash: body.message_hash || '',
        p_message_category: body.message_category || 'general',
        p_message_length: body.message_length || 0,
        p_routed_agent: body.routed_agent || 'kernel',
        p_classifier_confidence: body.classifier_confidence || 0,
        p_source: 'kbot',
      })
      if (error) {
        // Fallback: insert directly
        await svc.from('routing_signals').insert({
          message_hash: body.message_hash || '',
          message_category: body.message_category || 'general',
          message_length: body.message_length || 0,
          routed_agent: body.routed_agent || 'kernel',
          classifier_confidence: body.classifier_confidence || 0,
          was_rerouted: body.was_rerouted || false,
          response_quality: body.response_quality || 0.5,
          source: 'kbot',
        })
      }

      // Also store tool_sequence and strategy in collective_knowledge if useful
      if (body.tool_sequence?.length > 0 && body.response_quality > 0.6) {
        await svc.from('collective_knowledge').upsert({
          type: 'tool_sequence',
          pattern: {
            category: body.message_category,
            tools: body.tool_sequence,
            agent: body.routed_agent,
            strategy: body.strategy,
          },
          confidence: body.response_quality,
          sample_count: 1,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'type',
          ignoreDuplicates: true,
        }).then(() => {}).catch(() => {})
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    case 'hints': {
      // Return proven routing hints (patterns with high confidence + sample count)
      const { data } = await svc.rpc('get_routing_hints')
      return new Response(JSON.stringify({ hints: data || [] }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    case 'patterns': {
      // Return collective patterns (tool sequences, strategies)
      const { data } = await svc.from('collective_knowledge')
        .select('type, pattern, confidence, sample_count, last_updated')
        .gte('confidence', 0.7)
        .gte('sample_count', 10)
        .order('confidence', { ascending: false })
        .limit(100)
      return new Response(JSON.stringify({ patterns: data || [] }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    default:
      return new Response(JSON.stringify({
        error: 'Unknown action',
        actions: ['signal', 'hints', 'patterns'],
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
}

// ── Main handler ──

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || ''

  // Public endpoints (no auth)
  if (path === 'health') return handleHealth()
  if (path === 'models') return handleModels()
  if (path === 'collective') return await handleCollective(req)

  // Authenticated endpoints
  const authResult = await authenticate(req)
  if (authResult instanceof Response) return authResult
  const auth = authResult

  try {
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {}

    switch (path) {
      case 'proxy': return await handleProxy(auth, body)
      case 'sync': return await handleSync(auth, body)
      case 'route': return await handleRoute(auth, body)
      case 'usage': return await handleUsage(auth)
      default:
        return new Response(JSON.stringify({
          error: 'Unknown endpoint',
          endpoints: ['proxy', 'sync', 'route', 'usage', 'health', 'models'],
        }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logAudit(auth.svc, {
      actorId: auth.userId,
      eventType: 'kbot.error',
      action: path,
      source: 'kbot-engine',
      status: 'error',
      metadata: { error: msg.slice(0, 200) },
      ip: getClientIP(req),
      userAgent: getUA(req),
    }).catch(() => {})

    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
