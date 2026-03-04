// Supabase Edge Function: workspace-invite
// Manages workspace invitations: invite, accept, revoke
//
// Deploy: npx supabase functions deploy workspace-invite --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS }

  try {
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
      case 'invite': {
        const { workspace_id, email, role } = body as { workspace_id: string; email: string; role?: string }
        if (!workspace_id || !email) {
          return new Response(JSON.stringify({ error: 'Missing workspace_id or email' }), { status: 400, headers: jsonHeaders })
        }

        // Verify caller is admin/owner
        const { data: membership } = await svc.from('workspace_members')
          .select('role')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .is('removed_at', null)
          .maybeSingle()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          return new Response(JSON.stringify({ error: 'Only admins can invite' }), { status: 403, headers: jsonHeaders })
        }

        // Check member limit
        const { data: workspace } = await svc.from('workspaces')
          .select('max_members')
          .eq('id', workspace_id)
          .single()

        const { count: memberCount } = await svc.from('workspace_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('workspace_id', workspace_id)
          .is('removed_at', null)

        if (workspace && memberCount && memberCount >= workspace.max_members) {
          return new Response(JSON.stringify({ error: 'Workspace is at member limit' }), { status: 429, headers: jsonHeaders })
        }

        // Check for existing pending invitation
        const { data: existing } = await svc.from('workspace_invitations')
          .select('id, invite_code')
          .eq('workspace_id', workspace_id)
          .eq('email', email.toLowerCase())
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (existing) {
          return new Response(JSON.stringify({ invitation: existing }), { status: 200, headers: jsonHeaders })
        }

        // Create invitation
        const { data: invitation, error: invErr } = await svc.from('workspace_invitations').insert({
          workspace_id,
          email: email.toLowerCase(),
          role: role || 'member',
          invited_by: user.id,
        }).select('id, invite_code, email, role, expires_at').single()

        if (invErr) throw invErr

        // TODO: Send email via Resend (future enhancement)

        return new Response(JSON.stringify({ invitation }), { status: 201, headers: jsonHeaders })
      }

      case 'accept': {
        const { invite_code } = body as { invite_code: string }
        if (!invite_code) {
          return new Response(JSON.stringify({ error: 'Missing invite_code' }), { status: 400, headers: jsonHeaders })
        }

        const { data: invitation } = await svc.from('workspace_invitations')
          .select('id, workspace_id, email, role, expires_at, accepted_at')
          .eq('invite_code', invite_code.trim())
          .maybeSingle()

        if (!invitation) {
          return new Response(JSON.stringify({ error: 'Invalid invitation code' }), { status: 404, headers: jsonHeaders })
        }

        if (invitation.accepted_at) {
          return new Response(JSON.stringify({ error: 'Invitation already used' }), { status: 410, headers: jsonHeaders })
        }

        if (new Date(invitation.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: 'Invitation expired' }), { status: 410, headers: jsonHeaders })
        }

        // Verify email matches
        if (invitation.email !== user.email?.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Invitation is for a different email address' }), { status: 403, headers: jsonHeaders })
        }

        // Add as member
        await svc.from('workspace_members').upsert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role || 'member',
          accepted_at: new Date().toISOString(),
          removed_at: null,
        }, { onConflict: 'workspace_id,user_id' })

        // Mark invitation as accepted
        await svc.from('workspace_invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)

        return new Response(JSON.stringify({ workspace_id: invitation.workspace_id }), { status: 200, headers: jsonHeaders })
      }

      case 'revoke': {
        const { invitation_id, workspace_id } = body as { invitation_id: string; workspace_id: string }
        if (!invitation_id || !workspace_id) {
          return new Response(JSON.stringify({ error: 'Missing invitation_id or workspace_id' }), { status: 400, headers: jsonHeaders })
        }

        // Verify caller is admin/owner
        const { data: membership } = await svc.from('workspace_members')
          .select('role')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .is('removed_at', null)
          .maybeSingle()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          return new Response(JSON.stringify({ error: 'Only admins can revoke' }), { status: 403, headers: jsonHeaders })
        }

        await svc.from('workspace_invitations').delete().eq('id', invitation_id)

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
      }

      case 'list': {
        const { workspace_id } = body as { workspace_id: string }
        if (!workspace_id) {
          return new Response(JSON.stringify({ error: 'Missing workspace_id' }), { status: 400, headers: jsonHeaders })
        }

        const { data: invitations } = await svc.from('workspace_invitations')
          .select('id, email, role, invite_code, expires_at, accepted_at')
          .eq('workspace_id', workspace_id)
          .order('expires_at', { ascending: false })

        return new Response(JSON.stringify({ invitations: invitations || [] }), { status: 200, headers: jsonHeaders })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: jsonHeaders })
    }
  } catch (error) {
    console.error('workspace-invite error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
