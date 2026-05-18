// SMTP send wrapper — Gmail App Password via macOS Keychain.
//
// Mirrors the proven pattern from tools/send-via-gmail.mjs that has now
// sent ~45 messages across multiple outreach batches without leaking
// credentials into config files, .env, or process arguments.
//
// The Keychain lookup is the security primitive: the App Password lives
// only in the OS keyring, is read into memory at send time, and is never
// persisted by this code.
import { execFileSync } from 'node:child_process';
import nodemailer from 'nodemailer';
export class GmailSender {
    config;
    transport = null;
    constructor(config) {
        this.config = config;
    }
    /** Read App Password from macOS Keychain. Throws if missing. */
    readPassword() {
        try {
            return execFileSync('/usr/bin/security', [
                'find-generic-password',
                '-a', this.config.email,
                '-s', this.config.keychainService,
                '-w',
            ], { encoding: 'utf-8' }).trim();
        }
        catch (err) {
            throw new Error(`Failed to read App Password from Keychain (service=${this.config.keychainService}, account=${this.config.email}). ` +
                `One-time setup: security add-generic-password -U -a ${this.config.email} -s ${this.config.keychainService} -w <16-char-password>`);
        }
    }
    getTransport() {
        if (this.transport)
            return this.transport;
        const password = this.readPassword();
        this.transport = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: this.config.email, pass: password },
        });
        return this.transport;
    }
    async sendOne(to, subject, body) {
        try {
            const transport = this.getTransport();
            const info = await transport.sendMail({
                from: `${this.config.name} <${this.config.email}>`,
                to,
                subject,
                text: body,
            });
            const response = (info.response ?? '').toString().split('\n')[0] ?? '';
            const result = { to, subject, ok: true };
            if (info.messageId)
                result.messageId = info.messageId;
            if (response)
                result.response = response;
            return result;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { to, subject, ok: false, error: message };
        }
    }
}
//# sourceMappingURL=send.js.map