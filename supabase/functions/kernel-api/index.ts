// Kernel Public API — B2B developer access to the Kernel agent system
//
// Endpoints: /chat, /classify, /agents, /usage, /swarm, /knowledge
// Auth: Bearer kn_live_xxx API keys (NOT JWT)
//
// Deploy: npx supabase functions deploy kernel-api --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, SECURITY_HEADERS, OPEN_CORS_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse, type Tier } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { API_AGENT_PROMPTS, CORE_AGENTS, ALL_AGENTS } from '../_shared/agent-prompts.ts'

const CORS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

/** SHA-256 hash a string to hex */
async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Validate API key and return metadata */
async function authenticateApiKey(req: Request): Promise<
  | { error: Response }
  | { key: { key_id: string; key_user_id: string; key_tier: string; swarm_enabled: boolean; all_agents_enabled: boolean; streaming_enabled: boolean; monthly_message_count: number; monthly_message_limit: number; monthly_window_start: string; rate_limit_per_min: number; monthly_token_budget: number; monthly_tokens_used: number; token_limit_exceeded: boolean; overage_enabled: boolean; overage_rate_millicents: number; overage_count: number; max_monthly_spend_cents: number | null; spending_ceiling_hit: boolean }; svc: ReturnType<typeof createClient> }
> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !token.startsWith('kn_live_')) {
    return { error: new Response(JSON.stringify({ error: 'Missing or invalid API key. Use Bearer kn_live_xxx format.' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
    })}
  }

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const keyHash = await hashKey(token)
  const { data: keyData, error: keyErr } = await svc.rpc('validate_api_key', { p_key_hash: keyHash })

  if (keyErr || !keyData || keyData.length === 0) {
    return { error: new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
    })}
  }

  const key = keyData[0]

  // Spending ceiling hit — block even paid tiers
  if (key.spending_ceiling_hit) {
    const spentCents = (key.overage_count * key.overage_rate_millicents) / 10
    return { error: new Response(JSON.stringify({
      error: 'Monthly spending ceiling reached',
      usage: {
        overage_count: key.overage_count,
        spent_cents: Math.round(spentCents),
        ceiling_cents: key.max_monthly_spend_cents,
      },
    }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } })}
  }

  // Monthly limit exceeded — check if overage is allowed
  if (key.monthly_limit_exceeded) {
    if (!key.overage_enabled) {
      // Free tier or overage disabled — hard block
      return { error: new Response(JSON.stringify({
        error: 'Monthly message limit exceeded',
        usage: { count: key.monthly_message_count, limit: key.monthly_message_limit, window_start: key.monthly_window_start },
      }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } })}
    }
    // Overage enabled — allow through (metering happens after response)
  }

  if (key.token_limit_exceeded) {
    return { error: new Response(JSON.stringify({
      error: 'Monthly token budget exceeded',
      usage: { tokens_used: key.monthly_tokens_used, token_budget: key.monthly_token_budget },
    }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } })}
  }

  return { key, svc }
}

/** Map API key tier to rate-limit tier */
function tierToRateLimitTier(apiTier: string): Tier {
  switch (apiTier) {
    case 'enterprise': return 'max'
    case 'growth': return 'pro'
    case 'pro': return 'paid'
    case 'free': return 'free'
    default: return 'paid'
  }
}

/** Get available agents for a tier */
function getAvailableAgents(allAgentsEnabled: boolean): string[] {
  return allAgentsEnabled ? ALL_AGENTS : CORE_AGENTS
}

/** Parse URL path from request */
function getEndpoint(req: Request): string {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  // Edge function path is /kernel-api/endpoint or just /endpoint
  return parts[parts.length - 1] || ''
}

/** Fire-and-forget routing signal log */
function logRoutingSignal(
  svc: ReturnType<typeof createClient>,
  message: string,
  agentId: string,
  confidence: number,
  source: 'api' | 'kbot' | 'web',
) {
  const length = message.length > 500 ? 'long' : message.length > 100 ? 'medium' : 'short'
  hashKey(message).then(hash => {
    svc.rpc('log_routing_signal', {
      p_message_hash: hash,
      p_category: agentId,
      p_length: length,
      p_agent: agentId,
      p_confidence: confidence,
      p_source: source,
    }).catch(() => {})
  }).catch(() => {})
}

/** Check collective knowledge for routing hints before calling Haiku */
async function getCollectiveHints(
  svc: ReturnType<typeof createClient>,
  _message: string,
): Promise<{ agent_id: string; confidence: number } | null> {
  try {
    const { data } = await svc.rpc('get_routing_hints', { p_category: null })
    if (!data || data.length === 0) return null

    // Find the highest-confidence routing rule
    const best = data[0]
    if (best.confidence > 0.85 && best.sample_count > 100) {
      const pattern = best.pattern as { agent?: string; accuracy?: number }
      if (pattern.agent) {
        return { agent_id: pattern.agent, confidence: best.confidence }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Build classification prompt */
function buildClassifyPrompt(available: string[]): string {
  return `Classify this message into one agent: ${available.join(', ')}.
${available.map(id => `- ${id}: ${API_AGENT_PROMPTS[id].role}`).join('\n')}
Respond ONLY with JSON: {"agent_id":"...","confidence":0.0-1.0,"complexity":0.0-1.0}`
}

/** Run Haiku classification */
async function classifyWithHaiku(
  message: string,
  available: string[],
): Promise<{ agent_id: string; confidence: number; complexity: number } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    const classifyRes = await fetch(`${supabaseUrl}/functions/v1/claude-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        model: 'haiku', mode: 'json',
        system: buildClassifyPrompt(available),
        messages: [{ role: 'user', content: message }],
        max_tokens: 128,
      }),
    })
    if (classifyRes.ok) {
      const cd = await classifyRes.json()
      const text = cd.content?.[0]?.text || cd.text || ''
      const parsed = JSON.parse(text)
      if (available.includes(parsed.agent_id)) {
        return { agent_id: parsed.agent_id, confidence: parsed.confidence ?? 0.8, complexity: parsed.complexity ?? 0.5 }
      }
    }
  } catch { /* fall through */ }
  return null
}

/** Detect source from request headers (kbot sends X-Kbot-Version) */
function detectSource(req: Request): 'api' | 'kbot' | 'web' {
  if (req.headers.get('x-kbot-version')) return 'kbot'
  return 'api'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const endpoint = getEndpoint(req)

  try {
    switch (endpoint) {
      // ── GET /agents — list available agents ──
      case 'agents': {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        const available = getAvailableAgents(auth.key.all_agents_enabled)
        const agents = available.map(id => {
          const agent = API_AGENT_PROMPTS[id]
          return { id, name: agent.name, role: agent.role }
        })

        return new Response(JSON.stringify({ agents, tier: auth.key.key_tier }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ── GET /usage — usage stats ──
      case 'usage': {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        // Per-agent breakdown from usage_logs
        const { data: agentBreakdown } = await auth.svc
          .from('usage_logs')
          .select('feature, input_tokens, output_tokens, estimated_cost_usd')
          .eq('api_key_id', auth.key.key_id)
          .gte('created_at', auth.key.monthly_window_start)

        const perAgent: Record<string, { messages: number; input_tokens: number; output_tokens: number; cost_usd: number }> = {}
        if (agentBreakdown) {
          for (const row of agentBreakdown) {
            const agent = row.feature || 'chat'
            if (!perAgent[agent]) perAgent[agent] = { messages: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 }
            perAgent[agent].messages++
            perAgent[agent].input_tokens += row.input_tokens || 0
            perAgent[agent].output_tokens += row.output_tokens || 0
            perAgent[agent].cost_usd += Number(row.estimated_cost_usd) || 0
          }
        }

        const usageResponse: Record<string, unknown> = {
          tier: auth.key.key_tier,
          monthly_messages: { count: auth.key.monthly_message_count, limit: auth.key.monthly_message_limit },
          monthly_window_start: auth.key.monthly_window_start,
          per_agent: perAgent,
        }

        // Add overage section for paid tiers
        if (auth.key.overage_enabled) {
          const overageSpendMillicents = auth.key.overage_count * auth.key.overage_rate_millicents
          usageResponse.overage = {
            enabled: true,
            count: auth.key.overage_count,
            rate_per_message_cents: auth.key.overage_rate_millicents / 10,
            estimated_charges_cents: Math.round(overageSpendMillicents / 10),
            spending_ceiling_cents: auth.key.max_monthly_spend_cents,
            ceiling_hit: auth.key.spending_ceiling_hit,
          }
        }

        return new Response(JSON.stringify(usageResponse), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ── GET /knowledge — collective intelligence query ──
      case 'knowledge': {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        const url = new URL(req.url)
        const category = url.searchParams.get('category') || undefined

        const { data: patterns, error: pErr } = await auth.svc.rpc('get_routing_hints', {
          p_category: category || null,
        })

        if (pErr) {
          return new Response(JSON.stringify({ error: 'Failed to query collective knowledge' }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        return new Response(JSON.stringify({
          patterns: (patterns || []).map((p: any) => ({
            type: p.pattern_type,
            pattern: p.pattern,
            confidence: p.confidence,
            sample_count: p.sample_count,
          })),
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
      }

      // ── POST /classify — intent classification only ──
      case 'classify': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        // Rate limit
        const rl = await checkRateLimit(auth.svc, auth.key.key_id, 'kernel-api', tierToRateLimitTier(auth.key.key_tier))
        if (!rl.allowed) return rateLimitResponse(rl, CORS)

        let body: Record<string, unknown>
        try { body = await req.json() } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }
        const message = typeof body?.message === 'string' ? (body.message as string).trim() : ''
        if (!message) {
          return new Response(JSON.stringify({ error: 'message field is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const available = getAvailableAgents(auth.key.all_agents_enabled)

        // Check collective knowledge first — may skip Haiku entirely
        const hint = await getCollectiveHints(auth.svc, message)
        if (hint && available.includes(hint.agent_id)) {
          return new Response(JSON.stringify({
            agent_id: hint.agent_id,
            confidence: hint.confidence,
            complexity: 0.5,
            reasoning: 'Routed via collective intelligence (high-confidence pattern)',
            source: 'collective',
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
        }

        // Call claude-proxy with Haiku for classification
        const classifyPrompt = `Classify this user message into one of these agent categories: ${available.join(', ')}.

For each agent:
${available.map(id => `- ${id}: ${API_AGENT_PROMPTS[id].role}`).join('\n')}

Respond with ONLY valid JSON: {"agent_id": "...", "confidence": 0.0-1.0, "complexity": 0.0-1.0, "reasoning": "..."}`

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const classifyRes = await fetch(`${supabaseUrl}/functions/v1/claude-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            model: 'haiku',
            mode: 'json',
            system: classifyPrompt,
            messages: [{ role: 'user', content: message }],
            max_tokens: 256,
          }),
        })

        if (!classifyRes.ok) {
          const errText = await classifyRes.text()
          console.error('[kernel-api] classify proxy error:', errText)
          return new Response(JSON.stringify({ error: 'Classification failed' }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const classifyData = await classifyRes.json()
        let classification: { agent_id: string; confidence: number; complexity: number; reasoning: string }

        try {
          const content = classifyData.content?.[0]?.text || classifyData.text || ''
          classification = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content))
          // Validate agent_id is in available list
          if (!available.includes(classification.agent_id)) {
            classification.agent_id = 'kernel'
          }
        } catch {
          classification = { agent_id: 'kernel', confidence: 0.5, complexity: 0.5, reasoning: 'Fallback — classification parse error' }
        }

        return new Response(JSON.stringify(classification), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ── POST /swarm — multi-agent collaboration ──
      case 'swarm': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        // Swarm requires growth+ tier
        if (!auth.key.swarm_enabled) {
          return new Response(JSON.stringify({ error: 'Swarm (multi-agent) requires Growth tier or higher' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const rl = await checkRateLimit(auth.svc, auth.key.key_id, 'kernel-api', tierToRateLimitTier(auth.key.key_tier))
        if (!rl.allowed) return rateLimitResponse(rl, CORS)

        let body: Record<string, unknown>
        try { body = await req.json() } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { message: rawMessage, agents: requestedAgents, synthesis_model = 'sonnet' } = body as {
          message: string
          agents?: string[]
          synthesis_model?: string
        }

        const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
        if (!message) {
          return new Response(JSON.stringify({ error: 'message field is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const available = getAvailableAgents(auth.key.all_agents_enabled)
        const agentIds = (requestedAgents || ['researcher', 'coder', 'analyst']).filter(id => available.includes(id))

        if (agentIds.length < 2) {
          return new Response(JSON.stringify({ error: 'Swarm requires at least 2 valid agents' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        if (agentIds.length > 5) {
          return new Response(JSON.stringify({ error: 'Maximum 5 agents per swarm' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const source = detectSource(req)

        // Step 1: Parallel agent contributions (Haiku for speed)
        const contributions = await Promise.all(
          agentIds.map(async (agentId) => {
            const agentPrompt = API_AGENT_PROMPTS[agentId] || API_AGENT_PROMPTS.kernel
            try {
              const res = await fetch(`${supabaseUrl}/functions/v1/claude-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
                body: JSON.stringify({
                  model: 'haiku', mode: 'json',
                  system: `${agentPrompt.prompt}\n\nYou are contributing to a multi-agent discussion. Be concise and focus on your specialty. 300 words max.`,
                  messages: [{ role: 'user', content: message }],
                  max_tokens: 1024,
                }),
              })
              if (!res.ok) return { agent: agentId, content: '[Agent failed to respond]', error: true }
              const data = await res.json()
              return { agent: agentId, content: data.content?.[0]?.text || data.text || '', error: false }
            } catch {
              return { agent: agentId, content: '[Agent error]', error: true }
            }
          })
        )

        // Step 2: Synthesis with Sonnet
        const synthPrompt = `You are synthesizing contributions from multiple specialist agents into a cohesive response.

The user asked: "${message}"

Agent contributions:
${contributions.map(c => `--- ${c.agent.toUpperCase()} ---\n${c.content}`).join('\n\n')}

Create a unified, well-structured response that:
1. Integrates the best insights from each agent
2. Resolves any contradictions
3. Presents a coherent narrative
4. Credits specific agent perspectives where relevant`

        const synthRes = await fetch(`${supabaseUrl}/functions/v1/claude-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            model: synthesis_model === 'haiku' ? 'haiku' : 'sonnet',
            mode: 'json',
            system: synthPrompt,
            messages: [{ role: 'user', content: 'Synthesize the above contributions.' }],
            max_tokens: 4096,
          }),
        })

        const synthData = synthRes.ok ? await synthRes.json() : null
        const synthesis = synthData?.content?.[0]?.text || synthData?.text || 'Synthesis failed — see individual contributions.'

        // Log routing signal for the primary agent
        logRoutingSignal(auth.svc, message, agentIds[0], 1.0, source)

        // Increment message count (swarm counts as 1 message)
        await auth.svc.rpc('increment_api_message_count', { p_key_id: auth.key.key_id }).catch(() => {})

        await logAudit(auth.svc, {
          actorId: auth.key.key_user_id, eventType: 'edge_function.call', action: 'kernel-api.swarm',
          source: 'kernel-api', status: 'success', statusCode: 200,
          metadata: { agents: agentIds, agent_count: agentIds.length },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        return new Response(JSON.stringify({
          id: crypto.randomUUID(),
          agents: agentIds,
          contributions: contributions.map(c => ({ agent: c.agent, content: c.content })),
          synthesis,
          model: synthesis_model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-6',
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
      }

      // ── POST /chat — main chat endpoint ──
      case 'chat':
      case 'kernel-api': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const auth = await authenticateApiKey(req)
        if ('error' in auth) return auth.error

        // Rate limit
        const rl = await checkRateLimit(auth.svc, auth.key.key_id, 'kernel-api', tierToRateLimitTier(auth.key.key_tier))
        if (!rl.allowed) return rateLimitResponse(rl, CORS)

        let rawBody: Record<string, unknown>
        try { rawBody = await req.json() } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }
        const {
          message: rawMessage,
          agent: requestedAgent,
          mode = 'json',
          system: customSystem,
          max_tokens = 4096,
          previous_messages: rawPrevious = [],
          tools: requestedTools,
          tool_results: toolResults,
        } = rawBody as {
          message: string
          agent?: string
          mode?: 'json' | 'stream'
          system?: string
          max_tokens?: number
          previous_messages?: Array<{ role: string; content: string }>
          tools?: Array<{ name: string; description: string }>
          tool_results?: Array<{ tool_call_id: string; result: string }>
        }

        const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
        if (!message) {
          return new Response(JSON.stringify({ error: 'message field is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Sanitize previous_messages — only allow user/assistant roles
        const previous_messages = Array.isArray(rawPrevious)
          ? rawPrevious.filter(m => m.role === 'user' || m.role === 'assistant')
          : []

        // Custom system prompts: enterprise only
        if (customSystem && auth.key.key_tier !== 'enterprise') {
          return new Response(JSON.stringify({ error: 'Custom system prompts require Enterprise tier' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Streaming: check if enabled
        if (mode === 'stream' && !auth.key.streaming_enabled) {
          return new Response(JSON.stringify({ error: 'Streaming is not enabled for this key' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const available = getAvailableAgents(auth.key.all_agents_enabled)
        const clampedMaxTokens = Math.min(Math.max(max_tokens, 256), 8192)
        const source = detectSource(req)

        // Determine agent — auto-classify if not specified
        let agentId = requestedAgent || ''
        let classification: { agent_id: string; confidence: number; complexity: number } | null = null

        if (agentId && !available.includes(agentId)) {
          return new Response(JSON.stringify({
            error: `Agent '${agentId}' is not available. Available: ${available.join(', ')}`,
          }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
        }

        if (!agentId) {
          // Check collective knowledge first — may skip Haiku entirely
          const hint = await getCollectiveHints(auth.svc, message)
          if (hint && available.includes(hint.agent_id)) {
            agentId = hint.agent_id
            classification = { agent_id: hint.agent_id, confidence: hint.confidence, complexity: 0.5 }
          } else {
            // Auto-classify with Haiku
            classification = await classifyWithHaiku(message, available)
            if (classification) {
              agentId = classification.agent_id
            }
          }

          if (!agentId) agentId = 'kernel'
        }

        // Build system prompt (guard against missing prompt entry)
        const agentPrompt = API_AGENT_PROMPTS[agentId] || API_AGENT_PROMPTS.kernel
        const systemPrompt = customSystem || agentPrompt.prompt

        // Build messages
        const messages: Array<Record<string, unknown>> = [
          ...previous_messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ]

        // If tool results are provided, append them
        if (toolResults && Array.isArray(toolResults)) {
          for (const tr of toolResults) {
            messages.push({
              role: 'user',
              content: `[Tool Result for ${tr.tool_call_id}]: ${tr.result}`,
            })
          }
        }

        // Build Claude tools array if tools requested
        const claudeTools = requestedTools && Array.isArray(requestedTools)
          ? requestedTools.map(t => ({
              name: t.name,
              description: t.description,
              input_schema: { type: 'object' as const, properties: {} },
            }))
          : undefined

        // Call claude-proxy (use service role key — API keys aren't valid Supabase JWTs)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const proxyBody: Record<string, unknown> = {
          model: 'sonnet',
          mode: mode === 'stream' ? 'stream' : 'text',
          system: systemPrompt,
          messages,
          max_tokens: clampedMaxTokens,
          feature: agentId,
        }

        if (claudeTools) {
          proxyBody.tools = claudeTools
        }

        const proxyRes = await fetch(`${supabaseUrl}/functions/v1/claude-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(proxyBody),
        })

        if (!proxyRes.ok) {
          // Pass through error from claude-proxy
          const errBody = await proxyRes.text()
          return new Response(errBody, {
            status: proxyRes.status,
            headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Fire-and-forget routing signal
        logRoutingSignal(auth.svc, message, agentId, classification?.confidence ?? 1.0, source)

        // Stream mode: proxy SSE directly
        if (mode === 'stream') {
          return new Response(proxyRes.body, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              ...CORS,
            },
          })
        }

        // JSON mode: parse response and format
        const proxyData = await proxyRes.json()

        // Check if response contains tool_use blocks
        const contentBlocks = proxyData.content || []
        const toolCalls = Array.isArray(contentBlocks)
          ? contentBlocks.filter((b: any) => b.type === 'tool_use')
          : []
        const textBlocks = Array.isArray(contentBlocks)
          ? contentBlocks.filter((b: any) => b.type === 'text')
          : []

        const content = textBlocks.map((b: any) => b.text).join('') || proxyData.text || ''
        const usage = proxyData.usage || {}

        // Calculate approximate cost (Sonnet pricing)
        const inputTokens = usage.input_tokens || 0
        const outputTokens = usage.output_tokens || 0
        const costUsd = (inputTokens * 3.0 / 1_000_000) + (outputTokens * 15.0 / 1_000_000)

        const response: Record<string, unknown> = {
          id: crypto.randomUUID(),
          agent: agentId,
          model: proxyData.model || 'claude-sonnet-4-6',
          usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Math.round(costUsd * 1_000_000) / 1_000_000 },
        }

        // If tool calls present, return them for the client to execute
        if (toolCalls.length > 0) {
          response.type = 'tool_calls'
          response.tool_calls = toolCalls.map((tc: any) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.input,
          }))
          if (content) response.content = content
        } else {
          response.type = 'text'
          response.content = content
        }

        if (classification) {
          response.classification = classification
        }

        // Track message count + token usage
        const totalTokens = inputTokens + outputTokens
        const [msgResult] = await Promise.all([
          auth.svc.rpc('increment_api_message_count', { p_key_id: auth.key.key_id }).then(r => r.data?.[0] || null).catch(() => null),
          totalTokens > 0 ? auth.svc.rpc('increment_api_token_usage', { p_key_id: auth.key.key_id, p_tokens: totalTokens }).catch(() => {}) : Promise.resolve(),
          logAudit(auth.svc, {
            actorId: auth.key.key_user_id, eventType: 'edge_function.call', action: 'kernel-api.chat',
            source: 'kernel-api', status: 'success', statusCode: 200,
            metadata: { agent: agentId, mode, input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, has_tools: !!claudeTools },
            ip: getClientIP(req), userAgent: getUA(req),
          }),
        ])

        // Add overage info to response when in overage
        if (msgResult && msgResult.is_overage) {
          response.overage = {
            is_overage: true,
            overage_count: msgResult.new_overage_count,
            rate_per_message_cents: auth.key.overage_rate_millicents / 10,
          }
        }

        return new Response(JSON.stringify(response), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      default:
        return new Response(JSON.stringify({
          error: 'Not found',
          available_endpoints: ['POST /chat', 'POST /classify', 'POST /swarm', 'GET /agents', 'GET /usage', 'GET /knowledge'],
        }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } })
    }
  } catch (err) {
    console.error('[kernel-api]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
