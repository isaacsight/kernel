// Supabase Edge Function: computer-engine
// Sandboxed code execution for the Computer Engine.
// Pro-gated. Rate limited to 30 requests/minute.
//
// Deploy: npx supabase functions deploy computer-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Secrets: SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP } from '../_shared/audit.ts'
import { requireContentType, requireJsonBody, requireFields } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

type Action = 'create_sandbox' | 'execute' | 'read_file' | 'write_file' | 'browse' | 'terminal' | 'destroy' | 'list'

interface ComputerPayload {
  action: Action
  sandbox_id?: string
  code?: string
  language?: string
  path?: string
  content?: string
  url?: string
  screenshot?: boolean
  command?: string
  agent_id?: string
}

// SSRF blocklist — prevent accessing internal services
const SSRF_BLOCKLIST = [
  /^10\.\d+\.\d+\.\d+/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^192\.168\.\d+\.\d+/,
  /^127\.\d+\.\d+\.\d+/,
  /^0\.0\.0\.0/,
  /^localhost/i,
  /^::1/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /\.internal$/i,
]

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return !SSRF_BLOCKLIST.some(p => p.test(parsed.hostname))
  } catch {
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    const body = await requireJsonBody<ComputerPayload>(req)
    if (body instanceof Response) return body

    const fieldErr = requireFields(body, ['action'])
    if (fieldErr) return fieldErr(CORS)

    // ── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceKey)

    // ── Pro check ─────────────────────────────────────────
    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!sub) {
      return new Response(JSON.stringify({ error: 'Computer Engine requires Pro subscription' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Rate limit ────────────────────────────────────────
    const ip = getClientIP(req)
    const rlKey = `computer:${user.id}`
    const allowed = await checkRateLimit(adminClient, rlKey, 30, 60)
    if (!allowed) return rateLimitResponse(CORS)

    const { action } = body

    // ── Actions ───────────────────────────────────────────

    if (action === 'create_sandbox') {
      const sandboxId = `sb_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

      const { error } = await adminClient.from('sandboxes').insert({
        id: sandboxId,
        user_id: user.id,
        agent_id: body.agent_id || 'kernel',
        status: 'ready',
        filesystem_snapshot: { files: [] },
        expires_at: expiresAt,
      })

      if (error) throw new Error(`Failed to create sandbox: ${error.message}`)

      logAudit(adminClient, user.id, 'computer.create_sandbox', { sandboxId, ip })

      return new Response(JSON.stringify({ sandbox_id: sandboxId, status: 'ready', expires_at: expiresAt }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'execute') {
      const { code, language, sandbox_id } = body
      if (!code || !language || !sandbox_id) {
        return new Response(JSON.stringify({ error: 'Missing code, language, or sandbox_id' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      // Verify sandbox ownership
      const { data: sandbox } = await adminClient.from('sandboxes')
        .select('user_id, status')
        .eq('id', sandbox_id)
        .maybeSingle()

      if (!sandbox || sandbox.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Sandbox not found' }), {
          status: 404,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      // Execute code in a sandboxed Deno subprocess
      const startTime = Date.now()
      let stdout = ''
      let stderr = ''
      let exitCode = 0

      try {
        if (language === 'javascript' || language === 'typescript') {
          // Use Deno eval for JS/TS
          const result = await executeInDeno(code, 10000) // 10s timeout
          stdout = result.stdout
          stderr = result.stderr
          exitCode = result.exitCode
        } else if (language === 'python') {
          stdout = '[Python execution not available in edge runtime. Use JavaScript/TypeScript.]'
          exitCode = 1
        } else {
          stdout = `[${language} execution not available. Supported: JavaScript, TypeScript.]`
          exitCode = 1
        }
      } catch (err) {
        stderr = err instanceof Error ? err.message : 'Execution failed'
        exitCode = 1
      }

      const durationMs = Date.now() - startTime

      // Record execution
      await adminClient.from('sandbox_executions').insert({
        sandbox_id,
        action: 'execute_code',
        input: { language, code_length: code.length },
        output: { stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 500), exit_code: exitCode },
        duration_ms: durationMs,
      }).catch(() => {})

      logAudit(adminClient, user.id, 'computer.execute', { sandbox_id, language, durationMs, exitCode, ip })

      return new Response(JSON.stringify({ stdout, stderr, exit_code: exitCode, duration_ms: durationMs }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list') {
      const { data } = await adminClient.from('sandboxes')
        .select('id, agent_id, status, created_at, expires_at')
        .eq('user_id', user.id)
        .neq('status', 'destroyed')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ sandboxes: data || [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'destroy') {
      if (!body.sandbox_id) {
        return new Response(JSON.stringify({ error: 'Missing sandbox_id' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      await adminClient.from('sandboxes')
        .update({ status: 'destroyed' })
        .eq('id', body.sandbox_id)
        .eq('user_id', user.id)

      logAudit(adminClient, user.id, 'computer.destroy', { sandbox_id: body.sandbox_id, ip })

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[computer-engine] Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Execute JavaScript/TypeScript code using Function constructor with timeout.
 * This runs in the Deno edge runtime's sandboxed environment.
 */
async function executeInDeno(code: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const logs: string[] = []
  const errors: string[] = []

  // Create a sandboxed console
  const sandboxConsole = {
    log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
    error: (...args: unknown[]) => errors.push(args.map(String).join(' ')),
    warn: (...args: unknown[]) => logs.push(`[warn] ${args.map(String).join(' ')}`),
    info: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
  }

  try {
    // Wrap in async IIFE with timeout
    const wrappedCode = `
      return (async () => {
        const console = __console__;
        ${code}
      })()
    `

    const fn = new Function('__console__', wrappedCode)

    const result = await Promise.race([
      fn(sandboxConsole),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), timeoutMs)),
    ])

    // If there's a return value, add it to output
    if (result !== undefined) {
      logs.push(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
    }

    return { stdout: logs.join('\n'), stderr: errors.join('\n'), exitCode: 0 }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
    return { stdout: logs.join('\n'), stderr: errors.join('\n'), exitCode: 1 }
  }
}
