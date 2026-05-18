export interface Recipient {
    /** 1-based index within the briefing */
    index: number;
    /** Free-text name from the header line */
    name: string;
    /** Tier label if present (Tier 1 / Tier 2 / Tier 3 / etc.) */
    tier?: string;
    /** Email address from the `**To:**` line */
    to: string;
    /** Subject line from the `**Subject:**` line */
    subject: string;
    /** Body text from the fenced block */
    body: string;
    /** Optional channel note (LinkedIn DM, Bluesky DM, etc.) if email isn't the channel */
    channel?: string;
    /** Already-sent indicator: present if the briefing has a `**Sent:**` line filled */
    sentAt?: string;
    /** Already-sent indicator: msgid recorded */
    msgid?: string;
}
export interface Briefing {
    /** Source path the briefing was read from */
    source: string;
    /** All recipients in document order */
    recipients: Recipient[];
}
export declare function parseBriefing(source: string, text: string): Briefing;
/** Return only recipients that have not yet been sent. */
export declare function pending(briefing: Briefing): Recipient[];
/** Return only recipients with a usable email address (skip LinkedIn-only). */
export declare function emailable(recipients: Recipient[]): Recipient[];
//# sourceMappingURL=briefing.d.ts.map