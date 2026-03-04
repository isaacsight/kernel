// Project Files — server-side artifact persistence for Pro users
//
// Routes:
//   POST /save    — save file content to Storage + upsert metadata
//   POST /list    — list files in a conversation
//   POST /load    — get file content from Storage

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { resolvePlanId, PLAN_LIMITS, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const headers = { 'Content-Type': 'application/json', ...CORS }

  const ctErr = requireContentType(req)
  if (ctErr) return ctErr(CORS)

  try {
    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Subscription check (before rate limit so we can pass the tier)
    const { data: sub } = await svc
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()

    const planId = resolvePlanId(sub)
    const limits = PLAN_LIMITS[planId]

    if (limits.filesPerMonth === 0) {
      return new Response(JSON.stringify({ error: 'Project file sync requires a Pro subscription' }), { status: 403, headers })
    }

    // Rate limit
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'project-files', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // Parse body
    const body = await req.json()
    const action = body.action as string

    if (action === 'save') {
      return await handleSave(svc, user.id, body, limits.filesPerMonth, headers, req)
    } else if (action === 'list') {
      return await handleList(svc, user.id, body, headers)
    } else if (action === 'load') {
      return await handleLoad(svc, user.id, body, headers)
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers })
    }
  } catch (error) {
    console.error('project-files error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers })
  }
})

async function handleSave(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
  filesPerMonth: number,
  headers: Record<string, string>,
  req: Request
): Promise<Response> {
  const { conversation_id, filename, language, content, version } = body as {
    conversation_id: string
    filename: string
    language: string
    content: string
    version: number
  }

  if (!conversation_id || !filename || content === undefined) {
    return new Response(JSON.stringify({ error: 'Missing required fields: conversation_id, filename, content' }), { status: 400, headers })
  }

  // Check file size
  const sizeBytes = new TextEncoder().encode(content).length
  if (sizeBytes > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }), { status: 413, headers })
  }

  // Check monthly file count (only count distinct new files, not updates)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await svc
    .from('project_files')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)

  // Check if this is an update to an existing file (doesn't count against limit)
  const { data: existing } = await svc
    .from('project_files')
    .select('id')
    .eq('user_id', userId)
    .eq('conversation_id', conversation_id)
    .eq('filename', filename)
    .maybeSingle()

  if (!existing && (count ?? 0) >= filesPerMonth) {
    return new Response(JSON.stringify({ error: 'Monthly file limit reached', limit: filesPerMonth }), { status: 429, headers })
  }

  // Upload to Storage
  const storagePath = `${userId}/${conversation_id}/${filename}`
  const { error: uploadError } = await svc.storage
    .from('project-files')
    .upload(storagePath, content, {
      contentType: 'text/plain',
      upsert: true,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return new Response(JSON.stringify({ error: 'Failed to save file content' }), { status: 500, headers })
  }

  // Upsert metadata
  const { error: dbError } = await svc
    .from('project_files')
    .upsert({
      user_id: userId,
      conversation_id,
      filename,
      language: language || 'text',
      storage_path: storagePath,
      size_bytes: sizeBytes,
      version: version || 1,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,conversation_id,filename',
    })

  if (dbError) {
    console.error('DB upsert error:', dbError)
    return new Response(JSON.stringify({ error: 'Failed to save file metadata' }), { status: 500, headers })
  }

  logAudit(svc, {
    actorId: userId, eventType: 'edge_function.call', action: 'project-files.save',
    source: 'project-files', status: 'success', statusCode: 200,
    metadata: { conversation_id, filename, size_bytes: sizeBytes, version },
    ip: getClientIP(req), userAgent: getUA(req),
  })

  return new Response(JSON.stringify({ ok: true, storage_path: storagePath }), { headers })
}

async function handleList(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<Response> {
  const conversationId = body.conversation_id as string
  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'Missing conversation_id' }), { status: 400, headers })
  }

  const { data, error } = await svc
    .from('project_files')
    .select('filename, language, size_bytes, version, created_at, updated_at')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('DB list error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list files' }), { status: 500, headers })
  }

  return new Response(JSON.stringify({ files: data }), { headers })
}

async function handleLoad(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<Response> {
  const conversationId = body.conversation_id as string
  const filename = body.filename as string | undefined

  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'Missing conversation_id' }), { status: 400, headers })
  }

  // If filename specified, load a single file. Otherwise load all files in conversation.
  const query = svc
    .from('project_files')
    .select('filename, language, storage_path, version, size_bytes')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)

  if (filename) {
    query.eq('filename', filename)
  }

  const { data: fileMetas, error } = await query
  if (error) {
    console.error('DB load error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load file metadata' }), { status: 500, headers })
  }

  if (!fileMetas || fileMetas.length === 0) {
    return new Response(JSON.stringify({ files: [] }), { headers })
  }

  // Download content from Storage for each file
  const files = await Promise.all(
    fileMetas.map(async (meta) => {
      const { data: blob, error: dlError } = await svc.storage
        .from('project-files')
        .download(meta.storage_path)

      if (dlError || !blob) {
        console.warn(`Failed to download ${meta.storage_path}:`, dlError)
        return { ...meta, content: null }
      }

      const content = await blob.text()
      return {
        filename: meta.filename,
        language: meta.language,
        content,
        version: meta.version,
        size_bytes: meta.size_bytes,
      }
    })
  )

  return new Response(JSON.stringify({ files }), { headers })
}
