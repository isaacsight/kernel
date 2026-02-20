// Supabase Edge Function: robot-command
// Relays commands from the Kernel web app to a connected robot.
// Stores robot registrations and provides a proxy for WebSocket-based control.
//
// Deploy: npx supabase functions deploy robot-command --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RobotRegistration {
  robot_id: string
  name: string
  board: string
  host: string
  port: number
  last_seen: string
}

interface CommandPayload {
  robot_id: string
  command: {
    type: 'drive' | 'motor' | 'arm' | 'disarm' | 'stop' | 'servo' | 'query' | 'ping'
    payload?: Record<string, unknown>
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() || ''

    // ── GET /robot-command — List registered robots ────
    if (req.method === 'GET') {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: robots, error } = await serviceClient
        .from('robots')
        .select('*')
        .eq('user_id', user.id)
        .order('last_seen', { ascending: false })

      if (error) {
        // Table may not exist yet — return empty list
        return new Response(
          JSON.stringify({ robots: [], note: 'No robots registered. Run the robot daemon to register.' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      return new Response(
        JSON.stringify({ robots }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── POST /robot-command — Send command or register ──
    if (req.method === 'POST') {
      const body = await req.json()

      // Registration request from the robot daemon
      if (body.action === 'register') {
        const registration: RobotRegistration = {
          robot_id: body.robot_id,
          name: body.name,
          board: body.board,
          host: body.host,
          port: body.port,
          last_seen: new Date().toISOString(),
        }

        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { error } = await serviceClient
          .from('robots')
          .upsert({
            ...registration,
            user_id: user.id,
          }, { onConflict: 'robot_id' })

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to register robot', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          )
        }

        return new Response(
          JSON.stringify({ registered: true, robot_id: registration.robot_id }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      // Command relay — forward to robot via stored connection info
      const { robot_id, command } = body as CommandPayload
      if (!robot_id || !command) {
        return new Response(
          JSON.stringify({ error: 'Missing robot_id or command' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      // Look up robot connection info
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: robot, error: lookupError } = await serviceClient
        .from('robots')
        .select('*')
        .eq('robot_id', robot_id)
        .eq('user_id', user.id)
        .single()

      if (lookupError || !robot) {
        return new Response(
          JSON.stringify({ error: 'Robot not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      // Forward command to robot's HTTP API
      try {
        const robotUrl = `http://${robot.host}:${robot.port}/command`
        const response = await fetch(robotUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
          signal: AbortSignal.timeout(5000),
        })

        const result = await response.json()
        return new Response(
          JSON.stringify({ success: true, result }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      } catch (fetchError) {
        return new Response(
          JSON.stringify({
            error: 'Robot unreachable',
            details: fetchError instanceof Error ? fetchError.message : 'Connection failed',
            robot_id,
            last_seen: robot.last_seen,
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
