#!/usr/bin/env npx tsx
// Kernel Admin Agent MCP Server — manage users, invoicing, file delivery, platform ops
//
// This MCP server gives the admin agent real Supabase + Stripe superpowers.
// Run: npx tsx tools/kernel-admin-mcp.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

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
  'Get platform-wide stats: users, subscribers, messages, MRR, storage, scores',
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
      return fail(`Stats error: ${err}`)
    }
  },
)

// ── Tool: List Users ──
server.tool(
  'admin_list_users',
  'List users with subscription status and message counts. Optional search by email.',
  { email_search: z.string().optional().describe('Filter users by email (partial match)'), limit: z.number().default(20) },
  async ({ email_search, limit }) => {
    try {
      let query = `select=id,email,created_at,raw_app_meta_data&limit=${limit}&order=created_at.desc`
      if (email_search) query += `&email=ilike.*${email_search}*`
      const result = await supabaseQuery('auth_users_view', query) as any
      return ok(JSON.stringify(result.data, null, 2))
    } catch (err) {
      return fail(`User list error: ${err}`)
    }
  },
)

// ── Tool: Client Scores ──
server.tool(
  'admin_client_scores',
  'Get all client scores with pricing breakdowns for invoicing decisions',
  {},
  async () => {
    try {
      const [summaries, entries] = await Promise.all([
        supabaseRPC('get_client_score_summary'),
        supabaseRPC('get_all_client_scores'),
      ])
      return ok(JSON.stringify({ summaries, entries }, null, 2))
    } catch (err) {
      return fail(`Scores error: ${err}`)
    }
  },
)

// ── Tool: Send File ──
server.tool(
  'admin_send_file',
  'Send a file from a local path into a user\'s Inbox folder',
  {
    target_user_id: z.string().describe('UUID of the target user'),
    file_path: z.string().describe('Local path to the file to send'),
  },
  async ({ target_user_id, file_path }) => {
    try {
      const fullPath = file_path.startsWith('/') ? file_path : join(process.cwd(), file_path)
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
      return fail(`Send file error: ${err}`)
    }
  },
)

// ── Tool: Create Invoice ──
server.tool(
  'admin_create_invoice',
  'Create and send a Stripe invoice to a client based on their score',
  {
    email: z.string().describe('Client email address'),
    amount_dollars: z.number().describe('Total invoice amount in dollars'),
    tier: z.string().default('Standard').describe('Pricing tier (Starter/Standard/Premium/Elite)'),
    description: z.string().optional().describe('Invoice description'),
    subtotal: z.number().optional().describe('Subtotal before tax (dollars)'),
    tax: z.number().optional().describe('Tax amount (dollars)'),
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
      return fail(`Invoice error: ${err}`)
    }
  },
)

// ── Tool: Grant/Revoke Pro ──
server.tool(
  'admin_manage_subscription',
  'Grant or revoke Pro subscription for a user',
  {
    user_id: z.string().describe('UUID of the target user'),
    action: z.enum(['grant', 'revoke']).describe('Grant or revoke Pro access'),
  },
  async ({ user_id, action }) => {
    try {
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
      return fail(`Subscription error: ${err}`)
    }
  },
)

// ── Tool: User Detail ──
server.tool(
  'admin_user_detail',
  'Get detailed info about a specific user: messages, files, scores, memory',
  { user_id: z.string().describe('UUID of the user') },
  async ({ user_id }) => {
    try {
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
      return fail(`User detail error: ${err}`)
    }
  },
)

// ── Tool: Moderation Queue ──
server.tool(
  'admin_moderation_queue',
  'View pending content moderation items',
  {},
  async () => {
    try {
      const result = await supabaseQuery(
        'content_moderation',
        'select=id,content_id,status,verdict,created_at&status=in.(pending,flagged)&order=created_at.desc&limit=20',
      )
      return ok(JSON.stringify(result, null, 2))
    } catch (err) {
      return fail(`Moderation error: ${err}`)
    }
  },
)

// ── Start ──
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main().catch(console.error)
