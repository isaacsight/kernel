// Supabase Edge Function: notify-webhook
// Sends Discord webhook notifications for signups, subscriptions, and usage alerts.
//
// Deploy: npx supabase functions deploy notify-webhook --project-ref eoxxpyixdieprsxlpwcs
// Secrets: DISCORD_WEBHOOK_URL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NewUserPayload {
  event_type: 'new_user'
  email: string
  provider: string
  timestamp: string
}

interface NewSubscriberPayload {
  event_type: 'new_subscriber'
  email: string
  plan: string
  stripe_customer_id: string
}

interface UsageAlertPayload {
  event_type: 'usage_alert'
  email: string
  daily_cost_usd: string
  breakdown: string
}

interface ErrorSpikePayload {
  event_type: 'error_spike'
  error_rate: number
  platform_errors: number
  total_errors: number
  refunded_count: number
  breakdown: string
}

type WebhookPayload = NewUserPayload | NewSubscriberPayload | UsageAlertPayload | ErrorSpikePayload

function buildNewUserEmbed(payload: NewUserPayload) {
  return {
    title: 'New User Signup',
    color: 0x7B8CDE, // Kernel accent blue
    fields: [
      { name: 'Email', value: payload.email || 'N/A', inline: true },
      { name: 'Provider', value: payload.provider || 'email', inline: true },
      { name: 'Timestamp', value: payload.timestamp || new Date().toISOString(), inline: false },
    ],
    footer: { text: 'Kernel' },
    timestamp: new Date().toISOString(),
  }
}

function buildNewSubscriberEmbed(payload: NewSubscriberPayload) {
  return {
    title: 'New Subscriber',
    color: 0x4CAF50, // Green for revenue
    fields: [
      { name: 'Email', value: payload.email || 'N/A', inline: true },
      { name: 'Plan', value: payload.plan || 'Pro', inline: true },
      { name: 'Stripe Customer', value: payload.stripe_customer_id || 'N/A', inline: false },
    ],
    footer: { text: 'Kernel' },
    timestamp: new Date().toISOString(),
  }
}

function buildUsageAlertEmbed(payload: UsageAlertPayload) {
  return {
    title: 'Usage Cost Alert',
    color: 0xFF5722, // Orange-red for warning
    fields: [
      { name: 'User', value: payload.email || 'N/A', inline: true },
      { name: 'Daily Spend', value: `$${payload.daily_cost_usd}`, inline: true },
      { name: 'Model Breakdown', value: payload.breakdown ? `\`\`\`\n${payload.breakdown}\n\`\`\`` : 'N/A', inline: false },
    ],
    footer: { text: 'Kernel — threshold: $5/day' },
    timestamp: new Date().toISOString(),
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: require service role key (called internally by claude-proxy) ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!token || !serviceKey || token !== serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: service key required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const discordWebhookUrl = Deno.env.get('DISCORD_INBOX_WEBHOOK_URL') || Deno.env.get('DISCORD_WEBHOOK_URL')
    if (!discordWebhookUrl) {
      console.error('Missing DISCORD_INBOX_WEBHOOK_URL secret')
      return new Response(
        JSON.stringify({ error: 'Missing DISCORD_INBOX_WEBHOOK_URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as WebhookPayload

    if (!payload.event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing event_type in payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    let embed
    switch (payload.event_type) {
      case 'new_user':
        embed = buildNewUserEmbed(payload as NewUserPayload)
        break
      case 'new_subscriber':
        embed = buildNewSubscriberEmbed(payload as NewSubscriberPayload)
        break
      case 'usage_alert':
        embed = buildUsageAlertEmbed(payload as UsageAlertPayload)
        break
      case 'error_spike': {
        const ep = payload as ErrorSpikePayload
        embed = {
          title: 'Platform Error Spike',
          color: 0xE53E3E,
          fields: [
            { name: 'Error Rate', value: `${ep.error_rate}%`, inline: true },
            { name: 'Platform Errors (15min)', value: String(ep.platform_errors), inline: true },
            { name: 'Auto-Refunds', value: String(ep.refunded_count), inline: true },
            { name: 'Total Errors', value: String(ep.total_errors), inline: true },
            { name: 'Provider Breakdown', value: ep.breakdown ? `\`\`\`json\n${ep.breakdown.slice(0, 800)}\n\`\`\`` : 'N/A', inline: false },
          ],
          footer: { text: 'Kernel Health Monitor' },
          timestamp: new Date().toISOString(),
        }
        break
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown event_type: ${payload.event_type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
    }

    const discordBody = {
      username: 'Kernel Notifications',
      embeds: [embed],
    }

    console.log(`Sending Discord notification: ${payload.event_type}`)

    const discordRes = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordBody),
    })

    if (!discordRes.ok) {
      const errText = await discordRes.text()
      console.error('Discord webhook failed:', discordRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'Discord webhook failed', details: errText }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    console.log(`Discord notification sent successfully: ${payload.event_type}`)

    // Audit log
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    logAudit(svc, {
      actorType: 'service', eventType: 'system.notification', action: payload.event_type,
      source: 'notify-webhook', status: 'success', statusCode: 200,
      metadata: { eventType: payload.event_type },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({ success: true, event_type: payload.event_type }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('notify-webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
