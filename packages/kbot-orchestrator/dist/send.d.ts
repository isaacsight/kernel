export interface SenderConfig {
    /** From-address. Must match the account the App Password belongs to. */
    email: string;
    /** Display name on outgoing mail. */
    name: string;
    /** Keychain service identifier (the `-s` argument to `security`). */
    keychainService: string;
}
export interface SendResult {
    to: string;
    subject: string;
    ok: boolean;
    /** rfc822 Message-ID on success */
    messageId?: string;
    /** First line of SMTP server response on success */
    response?: string;
    /** Error message on failure */
    error?: string;
}
export declare class GmailSender {
    private readonly config;
    private transport;
    constructor(config: SenderConfig);
    /** Read App Password from macOS Keychain. Throws if missing. */
    private readPassword;
    private getTransport;
    sendOne(to: string, subject: string, body: string): Promise<SendResult>;
}
//# sourceMappingURL=send.d.ts.map