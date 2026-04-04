#!/usr/bin/env npx tsx
// Kernel Comms MCP Server — email announcements, user management, notifications
// Wraps Resend API + Supabase auth admin for direct use from Claude Code.
//
// SECURITY: Requires SUPABASE_SERVICE_KEY and RESEND_API_KEY. The send_announcement
// tool sends to ALL users — use dry_run first. HTML body content is passed through
// to the email template without sanitization; callers must ensure safe HTML.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

function sanitizeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message
            .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
            .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
            .replace(/re_\S+/gi, '[REDACTED]')
            .replace(/https?:\/\/[^\s]+/g, '[URL]')
    }
    return 'An unexpected error occurred'
}

function ok(text: string) {
    return { content: [{ type: 'text' as const, text }] }
}
function fail(text: string) {
    return { content: [{ type: 'text' as const, text }], isError: true as const }
}

// ── Supabase helpers ────────────────────────────────────────

async function supabaseAdmin(path: string, opts: RequestInit = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SUPABASE_KEY,
            ...(opts.headers || {}),
        },
    })
    if (!res.ok) {
        const text = await res.text().catch(() => 'unknown')
        throw new Error(`Supabase ${res.status}: ${text}`)
    }
    return res.json()
}

// ── Resend helpers ──────────────────────────────────────────

async function resendSend(payload: Record<string, unknown>) {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set in .env')
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => 'unknown')
        throw new Error(`Resend ${res.status}: ${text}`)
    }
    return res.json()
}

async function resendBatch(payloads: Record<string, unknown>[]) {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set in .env')
    const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloads),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => 'unknown')
        throw new Error(`Resend batch ${res.status}: ${text}`)
    }
    return res.json()
}

// ── Kernel email template ───────────────────────────────────

function kernelEmailTemplate(title: string, subtitle: string, bodyHtml: string): string {
    return `<div style="font-family: Georgia, 'EB Garamond', serif; max-width: 600px; margin: 0 auto; padding: 2.5rem; color: #1F1E1D; background: #FAF9F6;">
  <div style="text-align: center; margin-bottom: 2rem;">
    <div style="width: 56px; height: 56px; background: #7B8CDE; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 600;">K</div>
  </div>
  <h1 style="font-weight: 400; font-size: 28px; text-align: center; margin-bottom: 0.5rem;">${title}</h1>
  <p style="text-align: center; font-size: 15px; opacity: 0.6; margin-bottom: 2rem;">${subtitle}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1.5rem 0;" />
  ${bodyHtml}
  <div style="text-align: center; margin: 2rem 0;">
    <a href="https://kernel.chat/" style="display: inline-block; padding: 12px 32px; background: #1F1E1D; color: #FAF9F6; text-decoration: none; border-radius: 6px; font-size: 14px; font-family: 'Courier New', monospace;">Open kernel.chat &rarr;</a>
  </div>
  <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 2rem 0 1rem;" />
  <p style="font-size: 11px; opacity: 0.3; font-family: 'Courier New', monospace; text-align: center;">Kernel &mdash; A personal AI by Isaac Hernandez</p>
</div>`
}

// ── MCP Server ──────────────────────────────────────────────
const server = new McpServer({ name: 'kernel-comms', version: '1.0.0' })

// ═══════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

server.tool(
    'list_users',
    'List all registered Kernel platform users with their email, UUID, creation date, and last sign-in timestamp. Fetched from Supabase Auth admin API. Read-only operation with no side effects. Use this before send_announcement to verify the recipient list.',
    {},
    async () => {
        try {
            const data = await supabaseAdmin('/auth/v1/admin/users')
            const users = (data?.users || []).map((u: any) => ({
                id: u.id,
                email: u.email,
                created_at: u.created_at,
                last_sign_in: u.last_sign_in_at,
            }))
            return ok(`${users.length} registered users:\n\n${users.map((u: any) =>
                `- ${u.email} (joined ${u.created_at?.split('T')[0]}, last seen ${u.last_sign_in?.split('T')[0] || 'never'})`
            ).join('\n')}`)
        } catch (err) {
            return fail(`Failed to list users: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  EMAIL — SINGLE
// ═══════════════════════════════════════════════════════════

server.tool(
    'send_email',
    'Send a Kernel-branded email to a single recipient via the Resend API. The email uses the Kernel template with EB Garamond typography, ivory background, and amethyst accent. Side effects: delivers an email to the recipient. Requires RESEND_API_KEY to be configured. Sender is "Kernel <noreply@kernel.chat>". Use preview_email first to verify the rendered HTML before sending.',
    {
        to: z.string().email().max(255).describe('Recipient email address — must be valid email format'),
        subject: z.string().min(1).max(200).describe('Email subject line'),
        title: z.string().min(1).max(200).describe('Header title displayed prominently in the email body'),
        subtitle: z.string().max(300).optional().describe('Subtitle text shown below the title in lighter weight'),
        body_html: z.string().min(1).max(50000).describe('Inner HTML body content — supports paragraphs, lists, links, and inline styles. Wrapped in the Kernel email template.'),
    },
    async ({ to, subject, title, subtitle, body_html }) => {
        try {
            const html = kernelEmailTemplate(title, subtitle || '', body_html)
            const result = await resendSend({
                from: 'Kernel <noreply@kernel.chat>',
                to,
                subject,
                html,
            })
            return ok(`Email sent to ${to}\nResult: ${JSON.stringify(result)}`)
        } catch (err) {
            return fail(`Failed to send email: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  EMAIL — ANNOUNCEMENT (ALL USERS)
// ═══════════════════════════════════════════════════════════

server.tool(
    'send_announcement',
    'Send a Kernel-branded email to ALL registered users via Resend batch API. Side effects: delivers an email to every user with a registered email address. ALWAYS use dry_run=true first to review the recipient list before sending. Use for product updates, new features, service changes, or important announcements. Requires both RESEND_API_KEY and SUPABASE_SERVICE_KEY. Sender is "Kernel <noreply@kernel.chat>". Cannot be undone once sent.',
    {
        subject: z.string().min(1).max(200).describe('Email subject line — be clear and concise'),
        title: z.string().min(1).max(200).describe('Header title displayed in the email body'),
        subtitle: z.string().max(300).optional().describe('Subtitle text below the title'),
        body_html: z.string().min(1).max(50000).describe('Inner HTML body content wrapped in the Kernel email template'),
        dry_run: z.boolean().optional().describe('If true, lists all recipients WITHOUT sending. ALWAYS use dry_run=true first to verify recipients.'),
    },
    async ({ subject, title, subtitle, body_html, dry_run }) => {
        try {
            const data = await supabaseAdmin('/auth/v1/admin/users')
            const emails = (data?.users || [])
                .map((u: any) => u.email)
                .filter((e: string | undefined): e is string => !!e)

            if (emails.length === 0) return fail('No users found')

            if (dry_run) {
                return ok(`DRY RUN — would send to ${emails.length} users:\n${emails.map((e: string) => `  - ${e}`).join('\n')}\n\nSubject: ${subject}\nTitle: ${title}`)
            }

            const html = kernelEmailTemplate(title, subtitle || '', body_html)
            const batch = emails.map((email: string) => ({
                from: 'Kernel <noreply@kernel.chat>',
                to: email,
                subject,
                html,
            }))

            const result = await resendBatch(batch)
            return ok(`Announcement sent to ${emails.length} users!\n\nRecipients:\n${emails.map((e: string) => `  - ${e}`).join('\n')}\n\nResult: ${JSON.stringify(result)}`)
        } catch (err) {
            return fail(`Failed to send announcement: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  EMAIL — PREVIEW
// ═══════════════════════════════════════════════════════════

server.tool(
    'preview_email',
    'Generate a preview of the Kernel email template with the provided content. Returns the full rendered HTML string for inspection before sending. No side effects — no email is sent. Use this to verify formatting, layout, and content before calling send_email or send_announcement.',
    {
        title: z.string().min(1).max(200).describe('Header title to render in the preview'),
        subtitle: z.string().max(300).optional().describe('Subtitle text below the title'),
        body_html: z.string().min(1).max(50000).describe('Inner HTML body content to render'),
    },
    async ({ title, subtitle, body_html }) => {
        const html = kernelEmailTemplate(title, subtitle || '', body_html)
        return ok(`Email preview (${html.length} chars):\n\n${html}`)
    }
)

// ═══════════════════════════════════════════════════════════
//  NOTIFICATIONS — IN-APP
// ═══════════════════════════════════════════════════════════

server.tool(
    'send_notification',
    'Send an in-app notification to a specific user that appears in their notification bell on kernel.chat. Side effects: inserts a row into the notifications table in Supabase. The notification persists until the user reads it. Use this for user-specific alerts, not broadcast messages — use broadcast_notification for those.',
    {
        user_id: z.string().uuid().describe('Target user UUID — must be a valid UUID'),
        title: z.string().min(1).max(200).describe('Notification title shown in the bell dropdown'),
        body: z.string().max(1000).optional().describe('Notification body text with additional details'),
        type: z.enum(['info', 'success', 'warning', 'error']).optional().describe('Visual style: "info" (default/blue), "success" (green), "warning" (yellow), "error" (red)'),
    },
    async ({ user_id, title, body, type }) => {
        try {
            await supabaseAdmin('/rest/v1/notifications', {
                method: 'POST',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify({
                    user_id,
                    title,
                    body: body || '',
                    type: type || 'info',
                }),
            })
            return ok(`Notification sent to ${user_id}: "${title}"`)
        } catch (err) {
            return fail(`Failed to send notification: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  BROADCAST — IN-APP TO ALL USERS
// ═══════════════════════════════════════════════════════════

server.tool(
    'broadcast_notification',
    'Send an in-app notification to ALL registered users at once. Side effects: inserts one notification row per user into the Supabase notifications table. Each user will see it in their notification bell. Use sparingly for important platform-wide announcements. Consider send_notification for user-specific alerts instead.',
    {
        title: z.string().min(1).max(200).describe('Notification title — keep it clear and concise for all users'),
        body: z.string().max(1000).optional().describe('Notification body text with additional details'),
        type: z.enum(['info', 'success', 'warning', 'error']).optional().describe('Visual style: "info" (default/blue), "success" (green), "warning" (yellow), "error" (red)'),
    },
    async ({ title, body, type }) => {
        try {
            const data = await supabaseAdmin('/auth/v1/admin/users')
            const users = (data?.users || []).filter((u: any) => u.email)

            const notifications = users.map((u: any) => ({
                user_id: u.id,
                title,
                body: body || '',
                type: type || 'info',
            }))

            await supabaseAdmin('/rest/v1/notifications', {
                method: 'POST',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify(notifications),
            })

            return ok(`Broadcast sent to ${users.length} users: "${title}"`)
        } catch (err) {
            return fail(`Failed to broadcast: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  RESEND DOMAIN STATUS
// ═══════════════════════════════════════════════════════════

server.tool(
    'check_email_setup',
    'Verify the Resend API key is configured and list verified sending domains. Use this to diagnose email delivery issues or confirm the kernel.chat domain is properly verified. Read-only operation with no side effects. Returns API key status (configured/missing) and domain verification status.',
    {},
    async () => {
        if (!RESEND_API_KEY) {
            return fail('RESEND_API_KEY is not set in .env\n\n1. Sign up at https://resend.com\n2. Create an API key\n3. Add RESEND_API_KEY=re_xxxxx to your .env file\n4. Add and verify kernel.chat domain in Resend dashboard\n5. Restart this MCP server')
        }

        try {
            const res = await fetch('https://api.resend.com/domains', {
                headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            })
            if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
            const { data: domains } = await res.json()

            const lines = [
                `Resend API key: configured`,
                `\nVerified domains:`,
                ...(domains || []).map((d: any) =>
                    `  - ${d.name} (${d.status}) ${d.name === 'kernel.chat' ? '← your sending domain' : ''}`
                ),
            ]

            const hasKernelChat = domains?.some((d: any) => d.name === 'kernel.chat' && d.status === 'verified')
            if (!hasKernelChat) {
                lines.push(`\n⚠ kernel.chat is not verified in Resend. Add it at https://resend.com/domains`)
            }

            return ok(lines.join('\n'))
        } catch (err) {
            return fail(`Resend API check failed: ${sanitizeError(err)}`)
        }
    }
)

// ── Start ───────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
}
main().catch(console.error)
