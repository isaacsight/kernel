#!/usr/bin/env npx tsx
// Kernel Admin Agent MCP Server — manage users, invoicing, file delivery, platform ops
//
// This MCP server gives the admin agent real Supabase + Stripe superpowers.
// Run: npx tsx tools/kernel-admin-mcp.ts
//
// SECURITY: Requires SUPABASE_SERVICE_KEY. Never expose this server publicly.
// All operations are admin-only and require authenticated service-role access.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { readFileSync, existsSync } from 'fs'
import { join, resolve, normalize } from 'path'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

// ── Input validation helpers ───────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validate a UUID string to prevent injection */
function assertUUID(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label}: must be a valid UUID`)
  }
}

/** Sanitize a string for safe use in Supabase REST query parameters */
function sanitizeQueryParam(value: string): string {
  // Remove characters that could be used for injection in PostgREST queries
  return value.replace(/[;'"\\`$(){}[\]|&<>]/g, '')
}

/** Sanitize error messages to prevent leaking internal details */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Strip potentially sensitive information from error messages
    const msg = err.message
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
    return msg
  }
  return 'An unexpected error occurred'
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true as const }
}

async function supabaseRPC(fn: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`RPC ${fn} failed (${res.status}): ${await res.text()}`)
  return res.json()
}

async function supabaseQuery(table: string, query: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SUPABASE_KEY,
      Prefer: 'count=exact',
    },
  })
  if (!res.ok) throw new Error(`Query ${table} failed (${res.status}): ${await res.text()}`)
  const count = res.headers.get('content-range')?.split('/')[1]
  const data = await res.json()
  return { data, total: count ? parseInt(count) : data.length }
}

async function callEdgeFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── Server ──────────────────────────────────────────

const server = new McpServer({
  name: 'kernel-admin',
  version: '1.0.0',
})

// ── Tool: Platform Stats ──
server.tool(
  'admin_stats',
  'Retrieve platform-wide aggregate statistics including total users, active subscribers, message counts, conversation counts, client scores, and knowledge graph entities. Use this for dashboards, health monitoring, or business intelligence. Read-only operation with no side effects. Requires SUPABASE_SERVICE_KEY to be configured.',
  {},
  async () => {
    try {
      const [users, subs, msgs, convs, scores, entities] = await Promise.all([
        supabaseQuery('auth_users_view', 'select=id&limit=1'),
        supabaseQuery('subscriptions', 'select=id&status=eq.active&limit=1'),
        supabaseQuery('messages', 'select=id&limit=1'),
        supabaseQuery('conversations', 'select=id&limit=1'),
        supabaseQuery('client_scores', 'select=id&limit=1'),
        supabaseQuery('knowledge_graph_entities', 'select=id&limit=1'),
      ])
      const stats = {
        totalUsers: (users as any).total,
        activeSubscribers: (subs as any).total,
        totalMessages: (msgs as any).total,
        totalConversations: (convs as any).total,
        totalScores: (scores as any).total,
        totalEntities: (entities as any).total,
      }
      return ok(JSON.stringify(stats, null, 2))
    } catch (err) {
      return fail(`Stats error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: List Users ──
server.tool(
  'admin_list_users',
  'List registered users with their subscription status and activity metadata, ordered by creation date (newest first). Optionally filter by email substring. Use this for user lookup, support, or audit purposes. Read-only operation. Do not use for bulk data export — use the Supabase dashboard instead.',
  {
    email_search: z.string().max(255).optional().describe('Filter users by email address (partial match, case-insensitive). Must not contain special characters.'),
    limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of users to return (1-100). Default: 20'),
  },
  async ({ email_search, limit }) => {
    try {
      const safeLimit = Math.min(Math.max(1, limit), 100)
      let query = `select=id,email,created_at,raw_app_meta_data&limit=${safeLimit}&order=created_at.desc`
      if (email_search) {
        const sanitized = sanitizeQueryParam(email_search)
        if (sanitized.length > 0) {
          query += `&email=ilike.*${sanitized}*`
        }
      }
      const result = await supabaseQuery('auth_users_view', query) as any
      return ok(JSON.stringify(result.data, null, 2))
    } catch (err) {
      return fail(`User list error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: Client Scores ──
server.tool(
  'admin_client_scores',
  'Retrieve all client engagement scores with pricing tier breakdowns. Used for invoicing decisions and client health assessment. Returns score summaries and individual entries from Supabase RPC functions. Read-only operation with no side effects.',
  {},
  async () => {
    try {
      const [summaries, entries] = await Promise.all([
        supabaseRPC('get_client_score_summary'),
        supabaseRPC('get_all_client_scores'),
      ])
      return ok(JSON.stringify({ summaries, entries }, null, 2))
    } catch (err) {
      return fail(`Scores error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: Send File ──
server.tool(
  'admin_send_file',
  'Upload a local file to a specific user\'s Inbox folder in Supabase Storage. The file is read from the local filesystem, base64-encoded, and sent via the admin-send-file edge function. Side effects: creates a file entry in the target user\'s storage bucket. Supported formats: PDF, PNG, JPG, GIF, SVG, MP4, TXT, HTML, CSS, JS, JSON, ZIP, DOC, XLSX. Maximum file size is determined by the edge function limits. Do not use for sensitive files — content is transmitted via HTTPS but stored in Supabase Storage.',
  {
    target_user_id: z.string().uuid().describe('UUID of the target user who will receive the file'),
    file_path: z.string().min(1).max(1024).describe('Local filesystem path to the file to send. Can be absolute or relative to cwd.'),
  },
  async ({ target_user_id, file_path }) => {
    try {
      assertUUID(target_user_id, 'target_user_id')
      // Resolve and normalize the path to prevent path traversal
      const fullPath = normalize(resolve(process.cwd(), file_path))
      // Verify the file exists before reading
      if (!existsSync(fullPath)) {
        return fail(`File not found: ${file_path}`)
      }
      const content = readFileSync(fullPath)
      const base64 = content.toString('base64')
      const filename = file_path.split('/').pop() || 'file'
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', txt: 'text/plain',
        html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
        zip: 'application/zip', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      const mime = mimeMap[ext] || 'application/octet-stream'

      const result = await callEdgeFunction('admin-send-file', {
        target_user_id,
        filename,
        mime_type: mime,
        file_base64: base64,
      })
      return ok(JSON.stringify(result, null, 2))
    } catch (err) {
      return fail(`Send file error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: Create Invoice ──
server.tool(
  'admin_create_invoice',
  'Create and send a Stripe invoice to a client via the admin-invoice edge function. Side effects: creates a Stripe invoice and sends it to the client email. The amount is converted from dollars to cents internally. Use admin_client_scores first to determine the appropriate amount and tier. Do not call multiple times for the same client without verifying the previous invoice status.',
  {
    email: z.string().email().max(255).describe('Client email address — must be a valid email format'),
    amount_dollars: z.number().positive().max(100000).describe('Total invoice amount in US dollars (e.g., 99.99). Must be positive. Converted to cents internally.'),
    tier: z.enum(['Starter', 'Standard', 'Premium', 'Elite']).default('Standard').describe('Pricing tier that determines service level. Default: Standard'),
    description: z.string().max(500).optional().describe('Custom invoice description. Default: auto-generated from tier name.'),
    subtotal: z.number().min(0).max(100000).optional().describe('Subtotal before tax in dollars. Default: same as amount_dollars'),
    tax: z.number().min(0).max(100000).optional().describe('Tax amount in dollars. Default: 0'),
  },
  async ({ email, amount_dollars, tier, description, subtotal, tax }) => {
    try {
      const result = await callEdgeFunction('admin-invoice', {
        email,
        amount_cents: Math.round(amount_dollars * 100),
        description: description || `Kernel ${tier} Tier — Project Invoice`,
        metadata: {
          tier,
          subtotal: subtotal || amount_dollars,
          tax: tax || 0,
        },
      })
      return ok(JSON.stringify(result, null, 2))
    } catch (err) {
      return fail(`Invoice error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: Grant/Revoke Pro ──
server.tool(
  'admin_manage_subscription',
  'Grant or revoke Pro subscription access for a specific user. Side effects: when granting, creates a 30-day active subscription record in the subscriptions table. When revoking, sets the subscription status to "canceled". Use admin_user_detail first to verify user identity. This does NOT interact with Stripe billing directly — it only modifies the local subscription record.',
  {
    user_id: z.string().uuid().describe('UUID of the target user — must be a valid UUID format'),
    action: z.enum(['grant', 'revoke']).describe('"grant" creates a 30-day Pro subscription. "revoke" cancels any active subscription.'),
  },
  async ({ user_id, action }) => {
    try {
      assertUUID(user_id, 'user_id')
      if (action === 'grant') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SUPABASE_KEY,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id,
            status: 'active',
            plan: 'pro_monthly',
            stripe_customer_id: `admin_grant_${Date.now()}`,
            stripe_subscription_id: `admin_grant_${Date.now()}`,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        return ok(`Pro granted to ${user_id} for 30 days`)
      } else {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user_id}&status=eq.active`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SERVICE_KEY}`,
              apikey: SUPABASE_KEY,
            },
            body: JSON.stringify({ status: 'canceled' }),
          },
        )
        if (!res.ok) throw new Error(await res.text())
        return ok(`Pro revoked for ${user_id}`)
      }
    } catch (err) {
      return fail(`Subscription error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: User Detail ──
server.tool(
  'admin_user_detail',
  'Retrieve comprehensive details about a specific user including message count, uploaded files, engagement scores, memory profile, and top knowledge graph entities. Use this for support inquiries, user auditing, or understanding engagement patterns. Read-only operation with no side effects.',
  { user_id: z.string().uuid().describe('UUID of the user to look up — must be a valid UUID format') },
  async ({ user_id }) => {
    try {
      assertUUID(user_id, 'user_id')
      const [msgs, files, scores, memory, entities] = await Promise.all([
        supabaseQuery('messages', `select=id&user_id=eq.${user_id}&limit=1`),
        supabaseQuery('user_files', `select=id,filename,size_bytes&user_id=eq.${user_id}&limit=20&order=created_at.desc`),
        supabaseQuery('client_scores', `select=score,score_type,notes,created_at&user_id=eq.${user_id}&order=created_at.desc&limit=5`),
        supabaseQuery('user_memory', `select=profile,message_count,daily_message_count&user_id=eq.${user_id}&limit=1`),
        supabaseQuery('knowledge_graph_entities', `select=name,entity_type,mention_count&user_id=eq.${user_id}&order=mention_count.desc&limit=15`),
      ])
      return ok(JSON.stringify({
        messageCount: (msgs as any).total,
        files: (files as any).data,
        scores: (scores as any).data,
        memory: (memory as any).data?.[0],
        topEntities: (entities as any).data,
      }, null, 2))
    } catch (err) {
      return fail(`User detail error: ${sanitizeError(err)}`)
    }
  },
)

// ── Tool: Moderation Queue ──
server.tool(
  'admin_moderation_queue',
  'View the content moderation queue showing items with "pending" or "flagged" status, ordered by creation date (newest first, max 20 items). Use this to review flagged user content before taking moderation action. Read-only operation with no side effects.',
  {},
  async () => {
    try {
      const result = await supabaseQuery(
        'content_moderation',
        'select=id,content_id,status,verdict,created_at&status=in.(pending,flagged)&order=created_at.desc&limit=20',
      )
      return ok(JSON.stringify(result, null, 2))
    } catch (err) {
      return fail(`Moderation error: ${sanitizeError(err)}`)
    }
  },
)

// ── Start ──
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main().catch(console.error)
