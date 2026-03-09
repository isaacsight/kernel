// Admin Send File — upload files into any user's account
//
// Deploy: npx supabase functions deploy admin-send-file --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

const INBOX_FOLDER_NAME = 'Inbox'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    // ── Auth: verify caller is admin ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'No auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify JWT and check admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    if (user.app_metadata?.is_admin !== true) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Parse request body ──
    const body = await req.json()
    const { target_user_id, filename, mime_type, file_base64 } = body

    if (!target_user_id || !filename || !file_base64) {
      return new Response(JSON.stringify({ error: 'Missing required fields: target_user_id, filename, file_base64' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Admin client (bypasses RLS) ──
    const admin = createClient(supabaseUrl, serviceKey)

    // Verify target user exists
    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(target_user_id)
    if (targetErr || !targetUser?.user) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Ensure Inbox folder exists for target user ──
    const { data: existingFolder } = await admin
      .from('user_file_folders')
      .select('id')
      .eq('user_id', target_user_id)
      .eq('name', INBOX_FOLDER_NAME)
      .is('parent_id', null)
      .maybeSingle()

    let inboxFolderId: string
    if (existingFolder) {
      inboxFolderId = existingFolder.id
    } else {
      const { data: newFolder, error: folderErr } = await admin
        .from('user_file_folders')
        .insert({ user_id: target_user_id, name: INBOX_FOLDER_NAME, parent_id: null })
        .select('id')
        .single()
      if (folderErr || !newFolder) {
        return new Response(JSON.stringify({ error: 'Failed to create Inbox folder', detail: folderErr?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      inboxFolderId = newFolder.id
    }

    // ── Upload file to storage ──
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
    const storagePath = `${target_user_id}/${crypto.randomUUID()}.${ext}`

    // Decode base64 to bytes
    const binaryStr = atob(file_base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const { error: uploadErr } = await admin.storage
      .from('user-files')
      .upload(storagePath, bytes.buffer, {
        contentType: mime_type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      return new Response(JSON.stringify({ error: 'Storage upload failed', detail: uploadErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Insert file metadata ──
    const { data: fileRow, error: insertErr } = await admin
      .from('user_files')
      .insert({
        user_id: target_user_id,
        folder_id: inboxFolderId,
        filename,
        mime_type: mime_type || 'application/octet-stream',
        size_bytes: bytes.length,
        storage_path: storagePath,
      })
      .select('id, filename, size_bytes')
      .single()

    if (insertErr) {
      // Clean up uploaded file
      await admin.storage.from('user-files').remove([storagePath])
      return new Response(JSON.stringify({ error: 'Failed to save file record', detail: insertErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      file: fileRow,
      folder: INBOX_FOLDER_NAME,
      target_email: targetUser.user.email,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
