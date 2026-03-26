// kbot Email Service — kernel.chat@gmail.com
//
// Sends and reads email programmatically via Gmail API.
// Used by: digest, forge notifications, onboarding, security alerts.
//
// Setup: requires Gmail App Password (not OAuth — simpler for service accounts)
// Store in ~/.kbot/config.json as { "email": { "user": "kernel.chat@gmail.com", "pass": "app-password" } }
// Or set env vars: KBOT_EMAIL_USER, KBOT_EMAIL_PASS

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createTransport, type Transporter } from 'nodemailer'

const KBOT_DIR = join(homedir(), '.kbot')

interface EmailConfig {
  user: string
  pass: string
  smtp?: string
  port?: number
}

function loadEmailConfig(): EmailConfig {
  // Env vars first
  if (process.env.KBOT_EMAIL_USER && process.env.KBOT_EMAIL_PASS) {
    return {
      user: process.env.KBOT_EMAIL_USER,
      pass: process.env.KBOT_EMAIL_PASS,
    }
  }

  // Fall back to config file
  const configPath = join(KBOT_DIR, 'config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { email?: EmailConfig }
      if (config.email?.user && config.email?.pass) return config.email
    } catch { /* ignore */ }
  }

  return { user: 'kernel.chat@gmail.com', pass: '' }
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const config = loadEmailConfig()

  if (!config.pass) {
    throw new Error(
      'Email not configured. Set up a Gmail App Password:\n' +
      '1. Go to https://myaccount.google.com/apppasswords\n' +
      '2. Generate an app password for "kbot"\n' +
      '3. Save to ~/.kbot/config.json: { "email": { "user": "kernel.chat@gmail.com", "pass": "your-app-password" } }\n' +
      '   Or set KBOT_EMAIL_USER and KBOT_EMAIL_PASS environment variables'
    )
  }

  transporter = createTransport({
    host: config.smtp || 'smtp.gmail.com',
    port: config.port || 587,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  return transporter
}

export interface EmailMessage {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  from?: string
  replyTo?: string
}

export async function sendEmail(msg: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = loadEmailConfig()
    const transport = getTransporter()

    const result = await transport.sendMail({
      from: msg.from || `kbot <${config.user}>`,
      to: Array.isArray(msg.to) ? msg.to.join(', ') : msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo || config.user,
    })

    return { success: true, messageId: result.messageId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendDigestEmail(to: string | string[], digest: string, version: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `kbot Weekly Digest — v${version}`,
    text: digest,
    html: `<pre style="font-family: 'Courier Prime', Courier, monospace; background: #0d0d0d; color: #e8e6e3; padding: 24px; border-radius: 10px; max-width: 600px;">${digest.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
  })
}

export async function sendWelcomeEmail(to: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: 'Welcome to kbot — The AI that learns from you',
    html: `
<div style="font-family: 'EB Garamond', Georgia, serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #e8e6e3; padding: 40px;">
  <h1 style="font-family: 'Courier Prime', monospace; color: #FAF9F6; font-size: 32px;">kbot</h1>
  <p style="color: #888; font-size: 16px;">The AI that gets smarter every time anyone uses it.</p>

  <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <code style="font-family: 'Courier Prime', monospace; color: #28c840;">$ npm install -g @kernel.chat/kbot</code>
  </div>

  <h2 style="font-family: 'Courier Prime', monospace; color: #6B5B95; font-size: 18px;">Quick Start</h2>
  <ul style="color: #aaa; line-height: 1.8;">
    <li><code>kbot init</code> — detect your project and configure tools</li>
    <li><code>kbot "explain this codebase"</code> — ask anything</li>
    <li><code>kbot --agent coder "fix the auth bug"</code> — use a specialist</li>
    <li><code>kbot pair</code> — AI pair programming watch mode</li>
    <li><code>kbot dashboard</code> — see what kbot has learned</li>
    <li><code>kbot local</code> — run fully offline, $0</li>
  </ul>

  <h2 style="font-family: 'Courier Prime', monospace; color: #6B5B95; font-size: 18px;">What Makes kbot Different</h2>
  <ul style="color: #aaa; line-height: 1.8;">
    <li>374+ tools, 41 specialist agents</li>
    <li>Learns from every session — gets smarter over time</li>
    <li>Forges new tools at runtime when it encounters gaps</li>
    <li>Self-defense: HMAC integrity, prompt injection detection</li>
    <li>19 local models, runs fully offline</li>
    <li>MIT licensed, open source, free forever</li>
  </ul>

  <div style="border-top: 1px solid #333; margin-top: 32px; padding-top: 16px;">
    <p style="color: #666; font-size: 13px; font-family: 'Courier Prime', monospace;">
      MIT · <a href="https://kernel.chat" style="color: #6B5B95;">kernel.chat</a> ·
      <a href="https://github.com/isaacsight/kernel" style="color: #6B5B95;">GitHub</a> ·
      <a href="https://discord.gg/kdMauM9abG" style="color: #6B5B95;">Discord</a>
    </p>
  </div>
</div>`,
  })
}

export async function sendSecurityAlert(to: string, alert: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: '🔐 kbot Security Alert',
    text: alert,
    html: `<pre style="font-family: 'Courier Prime', monospace; background: #1a0a0a; color: #ff6b6b; padding: 24px; border: 1px solid #e11d48; border-radius: 10px;">${alert.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
  })
}

export async function sendForgeNotification(to: string, toolName: string, description: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `🔧 New forged tool: ${toolName}`,
    text: `A new tool was forged and published to the kbot Forge Registry.\n\n${toolName} — ${description}\n\nInstall: kbot forge install ${toolName}`,
  })
}

export async function sendReleaseAnnouncement(to: string | string[], version: string, changelog: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `kbot v${version} released`,
    text: `kbot v${version} is now available.\n\nnpm install -g @kernel.chat/kbot\n\n${changelog}`,
    html: `
<div style="font-family: 'Courier Prime', monospace; max-width: 600px; background: #0d0d0d; color: #e8e6e3; padding: 32px;">
  <h1 style="color: #6B5B95;">kbot v${version}</h1>
  <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <code style="color: #28c840;">$ npm install -g @kernel.chat/kbot</code>
  </div>
  <pre style="color: #aaa; white-space: pre-wrap;">${changelog.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <p style="color: #666; font-size: 12px; margin-top: 24px;">kernel.chat · MIT Licensed</p>
</div>`,
  })
}
