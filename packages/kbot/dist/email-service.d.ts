export interface EmailMessage {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    replyTo?: string;
}
export declare function sendEmail(msg: EmailMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
export declare function sendDigestEmail(to: string | string[], digest: string, version: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendWelcomeEmail(to: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendSecurityAlert(to: string, alert: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendForgeNotification(to: string, toolName: string, description: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendReleaseAnnouncement(to: string | string[], version: string, changelog: string): Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=email-service.d.ts.map