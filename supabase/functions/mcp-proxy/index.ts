// MCP Proxy Edge Function
// Acts as a secure gateway for the Kernel frontend to communicate with external MCP servers.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { corsHeaders } from "../_shared/cors.ts"
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, checkSSRF } from '../_shared/validate.ts'

serve(async (req: Request) => {
    const CORS_HEADERS = corsHeaders(req)

    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS })
    }

    // 1b. Require Content-Type: application/json
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    try {
        // 2. Authenticate User
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Server misconfiguration: Missing Supabase credentials')
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
        }

        // 3. Enforce Rate Limiting (Postgres RPC — fail-open)
        const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const rlCheck = await checkRateLimit(svc, user.id, 'mcp-proxy')
        if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

        // 4. Parse Request
        const body = await req.json()
        const { serverUrl, toolName, args } = body

        if (!serverUrl || !toolName) {
            return new Response(JSON.stringify({ error: 'Missing required parameters: serverUrl or toolName' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
        }

        // 5. SSRF protection — block all private/reserved IP ranges
        const ssrfErr = checkSSRF(serverUrl)
        if (ssrfErr) return ssrfErr(CORS_HEADERS)

        console.log(`Proxying MCP call for tool "${toolName}" to ${serverUrl}`);

        // 6. Forward to actual MCP Server
        // (Assuming HTTP MCP server protocol: POST to /mcp containing JSON-RPC 2.0)
        // Note: If your MCP servers use SSE, this proxy would need to handle the SSE lifecycle
        // and upgrade strategy. For simple single-turn HTTP tools, standard fetch works.
        const urlObj = new URL(serverUrl);
        const mcpPayload = {
            jsonrpc: "2.0",
            id: crypto.randomUUID(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args || {}
            }
        };

        const targetUrl = new URL(urlObj.pathname === '/' ? '/mcp' : urlObj.pathname, urlObj.origin).toString();

        const mcpResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(mcpPayload),
            // 10 second timeout for external MCP calls
            signal: AbortSignal.timeout(10000)
        });

        if (!mcpResponse.ok) {
            const errText = await mcpResponse.text();
            throw new Error(`Upstream MCP Server Error (${mcpResponse.status}): ${errText}`);
        }

        const mcpResult = await mcpResponse.json();

        // 7. Audit log (fire-and-forget)
        logAudit(svc, {
            actorId: user.id,
            eventType: 'edge_function.call',
            action: 'mcp-proxy',
            source: 'mcp-proxy',
            status: 'success',
            statusCode: 200,
            metadata: { toolName, serverUrl: new URL(serverUrl).origin },
            ip: getClientIP(req),
            userAgent: getUA(req),
        })

        // Return the JSON-RPC result to the client
        return new Response(JSON.stringify(mcpResult), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('MCP Proxy Error:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error
            }),
            {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            }
        )
    }
})
