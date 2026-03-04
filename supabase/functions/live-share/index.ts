// Supabase Edge Function: live-share
// Manages live collaborative conversation sessions.
//
// Routes: create, join, kick, revoke, status
//
// Deploy: npx supabase functions deploy live-share --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS }

  try {
    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: jsonHeaders })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await req.json().catch(() => ({}))
    const { action } = body as { action?: string }

    switch (action) {
      case 'create': {
        const { conversation_id } = body as { conversation_id: string }
        if (!conversation_id) {
          return new Response(JSON.stringify({ error: 'Missing conversation_id' }), { status: 400, headers: jsonHeaders })
        }

        // Verify user owns the conversation
        const { data: conv } = await svc.from('conversations').select('user_id').eq('id', conversation_id).maybeSingle()
        if (!conv || conv.user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Not your conversation' }), { status: 403, headers: jsonHeaders })
        }

        // Check for existing active share
        const { data: existing } = await svc.from('live_shares')
          .select('id, access_code')
          .eq('conversation_id', conversation_id)
          .eq('is_active', true)
          .maybeSingle()

        if (existing) {
          return new Response(JSON.stringify({ share: existing }), { status: 200, headers: jsonHeaders })
        }

        // Create new share
        const { data: share, error: createErr } = await svc.from('live_shares').insert({
          conversation_id,
          owner_id: user.id,
        }).select('id, access_code').single()

        if (createErr) throw createErr

        // Add owner as participant
        await svc.from('live_share_participants').insert({
          live_share_id: share.id,
          user_id: user.id,
          role: 'owner',
        })

        return new Response(JSON.stringify({ share }), { status: 201, headers: jsonHeaders })
      }

      case 'join': {
        const { access_code } = body as { access_code: string }
        if (!access_code) {
          return new Response(JSON.stringify({ error: 'Missing access_code' }), { status: 400, headers: jsonHeaders })
        }

        // Find active share by code
        const { data: share } = await svc.from('live_shares')
          .select('id, conversation_id, max_participants, is_active, expires_at')
          .eq('access_code', access_code.trim().toLowerCase())
          .eq('is_active', true)
          .maybeSingle()

        if (!share) {
          return new Response(JSON.stringify({ error: 'Invalid or expired share code' }), { status: 404, headers: jsonHeaders })
        }

        // Check expiration
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: 'Share has expired' }), { status: 410, headers: jsonHeaders })
        }

        // Check participant count
        const { count } = await svc.from('live_share_participants')
          .select('id', { count: 'exact', head: true })
          .eq('live_share_id', share.id)
          .is('kicked_at', null)

        if (count && count >= share.max_participants) {
          return new Response(JSON.stringify({ error: 'Share is full' }), { status: 429, headers: jsonHeaders })
        }

        // Check if previously kicked
        const { data: existingParticipant } = await svc.from('live_share_participants')
          .select('id, kicked_at')
          .eq('live_share_id', share.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingParticipant?.kicked_at) {
          return new Response(JSON.stringify({ error: 'You were removed from this share' }), { status: 403, headers: jsonHeaders })
        }

        // Upsert participant
        if (!existingParticipant) {
          await svc.from('live_share_participants').insert({
            live_share_id: share.id,
            user_id: user.id,
            role: 'viewer',
          })
        }

        return new Response(JSON.stringify({
          share_id: share.id,
          conversation_id: share.conversation_id,
        }), { status: 200, headers: jsonHeaders })
      }

      case 'kick': {
        const { share_id, user_id: targetUserId } = body as { share_id: string; user_id: string }
        if (!share_id || !targetUserId) {
          return new Response(JSON.stringify({ error: 'Missing share_id or user_id' }), { status: 400, headers: jsonHeaders })
        }

        // Verify caller is the owner
        const { data: share } = await svc.from('live_shares')
          .select('owner_id')
          .eq('id', share_id)
          .maybeSingle()

        if (!share || share.owner_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Only the owner can kick participants' }), { status: 403, headers: jsonHeaders })
        }

        await svc.from('live_share_participants')
          .update({ kicked_at: new Date().toISOString() })
          .eq('live_share_id', share_id)
          .eq('user_id', targetUserId)

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
      }

      case 'revoke': {
        const { share_id } = body as { share_id: string }
        if (!share_id) {
          return new Response(JSON.stringify({ error: 'Missing share_id' }), { status: 400, headers: jsonHeaders })
        }

        // Verify caller is the owner
        const { data: share } = await svc.from('live_shares')
          .select('owner_id')
          .eq('id', share_id)
          .maybeSingle()

        if (!share || share.owner_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Only the owner can revoke' }), { status: 403, headers: jsonHeaders })
        }

        await svc.from('live_shares')
          .update({ is_active: false })
          .eq('id', share_id)

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
      }

      case 'status': {
        const { share_id } = body as { share_id: string }
        if (!share_id) {
          return new Response(JSON.stringify({ error: 'Missing share_id' }), { status: 400, headers: jsonHeaders })
        }

        const { data: share } = await svc.from('live_shares')
          .select('id, conversation_id, access_code, is_active, max_participants, created_at, expires_at')
          .eq('id', share_id)
          .maybeSingle()

        if (!share) {
          return new Response(JSON.stringify({ error: 'Share not found' }), { status: 404, headers: jsonHeaders })
        }

        const { data: participants } = await svc.from('live_share_participants')
          .select('user_id, role, joined_at, kicked_at')
          .eq('live_share_id', share_id)
          .is('kicked_at', null)

        return new Response(JSON.stringify({ share, participants: participants || [] }), { status: 200, headers: jsonHeaders })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: jsonHeaders })
    }
  } catch (error) {
    console.error('live-share error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
