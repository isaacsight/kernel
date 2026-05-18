// SMTP send wrapper — Gmail App Password via macOS Keychain.
//
// Mirrors the proven pattern from tools/send-via-gmail.mjs that has now
// sent ~45 messages across multiple outreach batches without leaking
// credentials into config files, .env, or process arguments.
//
// The Keychain lookup is the security primitive: the App Password lives
// only in the OS keyring, is read into memory at send time, and is never
// persisted by this code.

import { execFileSync } from 'node:child_process'
import nodemailer, { type Transporter } from 'nodemailer'

export interface SenderConfig {
  /** From-address. Must match the account the App Password belongs to. */
  email: string
  /** Display name on outgoing mail. */
  name: string
  /** Keychain service identifier (the `-s` argument to `security`). */
  keychainService: string
}

export interface SendResult {
  to: string
  subject: string
  ok: boolean
  /** rfc822 Message-ID on success */
  messageId?: string
  /** First line of SMTP server response on success */
  response?: string
  /** Error message on failure */
  error?: string
}

export class GmailSender {
  private readonly config: SenderConfig
  private transport: Transporter | null = null

  constructor(config: SenderConfig) {
    this.config = config
  }

  /** Read App Password from macOS Keychain. Throws if missing. */
  private readPassword(): string {
    try {
      return execFileSync(
        '/usr/bin/security',
        [
          'find-generic-password',
          '-a', this.config.email,
          '-s', this.config.keychainService,
          '-w',
        ],
        { encoding: 'utf-8' },
      ).trim()
    } catch (err) {
      throw new Error(
        `Failed to read App Password from Keychain (service=${this.config.keychainService}, account=${this.config.email}). ` +
        `One-time setup: security add-generic-password -U -a ${this.config.email} -s ${this.config.keychainService} -w <16-char-password>`,
      )
    }
  }

  private getTransport(): Transporter {
    if (this.transport) return this.transport
    const password = this.readPassword()
    this.transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: this.config.email, pass: password },
    })
    return this.transport
  }

  async sendOne(to: string, subject: string, body: string): Promise<SendResult> {
    try {
      const transport = this.getTransport()
      const info = await transport.sendMail({
        from: `${this.config.name} <${this.config.email}>`,
        to,
        subject,
        text: body,
      })
      const response = (info.response ?? '').toString().split('\n')[0] ?? ''
      const result: SendResult = { to, subject, ok: true }
      if (info.messageId) result.messageId = info.messageId
      if (response) result.response = response
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { to, subject, ok: false, error: message }
    }
  }
}
