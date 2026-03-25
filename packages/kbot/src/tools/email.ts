// kbot Email Tools — Self-Distribution + Communication
//
// kbot can now: send its own install link, onboard users, send digests,
// broadcast releases, alert on security events, and distribute itself.
//
// Uses nodemailer with Gmail. Configured via ~/.kbot/config.json or env vars.

import { registerTool } from './index.js'

const NODEMAILER_AVAILABLE = (() => {
  try { require.resolve('nodemailer'); return true } catch { return false }
})()

async function sendViaGmail(to: string, subject: string, body: string, html?: string): Promise<string> {
  if (!NODEMAILER_AVAILABLE) {
    // Fallback: use the system mail command or OpenClaw
    const { execSync } = await import('node:child_process')
    try {
      execSync(`echo ${JSON.stringify(body)} | mail -s ${JSON.stringify(subject)} ${to}`, { timeout: 10000 })
      return `Sent via system mail to ${to}`
    } catch {
      return `Email requires nodemailer: npm install nodemailer. Or use openclaw_send with email platform.`
    }
  }

  const nodemailer = await import('nodemailer')
  const { readFileSync, existsSync } = await import('node:fs')
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')

  let user = process.env.KBOT_EMAIL_USER || 'kernel.chat@gmail.com'
  let pass = process.env.KBOT_EMAIL_PASS || ''

  if (!pass) {
    const configPath = join(homedir(), '.kbot', 'config.json')
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { email?: { user?: string; pass?: string } }
        if (config.email?.pass) { user = config.email.user || user; pass = config.email.pass }
      } catch { /* ignore */ }
    }
  }

  if (!pass) {
    return 'Gmail not configured. Set KBOT_EMAIL_PASS or add to ~/.kbot/config.json: { "email": { "pass": "app-password" } }'
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })

  const result = await transport.sendMail({
    from: `kbot <${user}>`,
    to,
    subject,
    text: body,
    html: html || undefined,
  })

  return `Sent to ${to} (${result.messageId})`
}

export function registerEmailTools(): void {

  // ── email_send: General purpose email ──
  registerTool({
    name: 'email_send',
    description: 'Send an email from kbot (kernel.chat@gmail.com). For any outbound communication: replies, notifications, announcements.',
    parameters: {
      to: { type: 'string', description: 'Recipient email address', required: true },
      subject: { type: 'string', description: 'Email subject line', required: true },
      body: { type: 'string', description: 'Email body text', required: true },
    },
    tier: 'free',
    async execute(args) {
      return sendViaGmail(String(args.to), String(args.subject), String(args.body))
    },
  })

  // ── email_distribute: Send kbot's install link to someone ──
  registerTool({
    name: 'email_distribute',
    description: 'Distribute kbot to a new user by email. Sends the install command, getting started guide, and what makes kbot different. This is how kbot spreads itself.',
    parameters: {
      to: { type: 'string', description: 'Email address to send to', required: true },
      message: { type: 'string', description: 'Optional personal message to include' },
    },
    tier: 'free',
    async execute(args) {
      const personal = args.message ? `\n${args.message}\n` : ''
      const body = `Hey — check out kbot.
${personal}
It's a free, open source AI agent that learns from every session you use it. 374+ tools, 41 specialist agents, runs fully offline.

Install in one command:
  npm install -g @kernel.chat/kbot

Then try:
  kbot init          — detects your project, configures everything
  kbot "hello"       — ask anything
  kbot pair          — AI pair programming
  kbot dashboard     — see what it's learned

What makes it different:
  - Learns your patterns (gets smarter over time)
  - Forges new tools at runtime when it hits a gap
  - Self-defense system (HMAC integrity, injection detection)
  - 19 local models, $0, fully offline
  - OpenClaw integration — works across WhatsApp, Slack, Discord, and more

MIT licensed. Free forever. kernel.chat

GitHub: https://github.com/isaacsight/kernel
npm: https://www.npmjs.com/package/@kernel.chat/kbot
Discord: https://discord.gg/kdMauM9abG`

      const html = `
<div style="font-family: 'Courier Prime', Courier, monospace; max-width: 560px; margin: 0 auto; background: #0d0d0d; color: #e8e6e3; padding: 32px; border-radius: 12px;">
  <h1 style="color: #FAF9F6; font-size: 28px; margin: 0 0 8px;">kbot</h1>
  <p style="color: #6B5B95; margin: 0 0 20px;">The AI that gets smarter every time anyone uses it.</p>
  ${personal ? `<p style="color: #aaa;">${personal}</p>` : ''}
  <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
    <code style="color: #28c840; font-size: 15px;">$ npm install -g @kernel.chat/kbot</code>
  </div>
  <p style="color: #aaa; font-size: 14px; line-height: 1.7;">374+ tools · 41 agents · learns from you · runs offline · $0 · MIT licensed</p>
  <div style="margin-top: 24px;">
    <a href="https://github.com/isaacsight/kernel" style="color: #6B5B95; text-decoration: none; margin-right: 16px;">GitHub</a>
    <a href="https://www.npmjs.com/package/@kernel.chat/kbot" style="color: #6B5B95; text-decoration: none; margin-right: 16px;">npm</a>
    <a href="https://discord.gg/kdMauM9abG" style="color: #6B5B95; text-decoration: none; margin-right: 16px;">Discord</a>
    <a href="https://kernel.chat" style="color: #6B5B95; text-decoration: none;">kernel.chat</a>
  </div>
  <p style="color: #444; font-size: 11px; margin-top: 24px;">Sent by kbot · kernel.chat group · MIT Licensed</p>
</div>`

      return sendViaGmail(String(args.to), 'Check out kbot — free AI agent that learns from you', body, html)
    },
  })

  // ── email_digest: Send weekly learning report ──
  registerTool({
    name: 'email_digest',
    description: 'Send the weekly kbot digest to a user. Shows learning progress, patterns extracted, tools used, growth metrics.',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      digest: { type: 'string', description: 'Digest content (from kbot digest command)', required: true },
    },
    tier: 'free',
    async execute(args) {
      return sendViaGmail(
        String(args.to),
        'Your kbot Weekly Digest',
        String(args.digest),
        `<pre style="font-family: 'Courier Prime', monospace; background: #0d0d0d; color: #e8e6e3; padding: 24px; border-radius: 10px; max-width: 560px;">${String(args.digest).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
      )
    },
  })

  // ── email_announce: Send release announcement ──
  registerTool({
    name: 'email_announce',
    description: 'Send a release announcement email for a new kbot version. Includes version, changelog, and install command.',
    parameters: {
      to: { type: 'string', description: 'Recipient(s) — comma-separated for multiple', required: true },
      version: { type: 'string', description: 'Version number (e.g., "3.35.0")', required: true },
      changelog: { type: 'string', description: 'What changed in this release', required: true },
    },
    tier: 'free',
    async execute(args) {
      const body = `kbot v${args.version} released.\n\nnpm install -g @kernel.chat/kbot\n\n${args.changelog}\n\nkernel.chat · MIT Licensed`
      return sendViaGmail(String(args.to), `kbot v${args.version} released`, body)
    },
  })

  // ── email_security_alert: Send security notification ──
  registerTool({
    name: 'email_security_alert',
    description: 'Send a security alert email from kbot\'s self-defense system. Used when anomalies, tampering, or injection attempts are detected.',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      alert: { type: 'string', description: 'Security alert details', required: true },
    },
    tier: 'free',
    async execute(args) {
      return sendViaGmail(
        String(args.to),
        '🔐 kbot Security Alert',
        String(args.alert),
        `<pre style="font-family: 'Courier Prime', monospace; background: #1a0a0a; color: #ff6b6b; padding: 24px; border: 1px solid #e11d48; border-radius: 10px;">${String(args.alert).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
      )
    },
  })
}
