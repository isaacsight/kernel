import { type Briefing, type Recipient } from './briefing.js';
import { type SenderConfig, type SendResult } from './send.js';
export interface OutreachRunOptions {
    briefingPath: string;
    sender: SenderConfig;
    /** When false (default), only report what would be sent without sending. */
    confirm?: boolean;
    /** Optional filter: only send recipients whose tier label matches. */
    tier?: string;
    /** Optional filter: only send recipients whose name matches (case-insensitive substring). */
    nameMatches?: string;
    /** Optional limit: stop after this many sends. */
    limit?: number;
    /** Per-message delay in ms (default 500ms, gentle on Gmail send limits). */
    delayMs?: number;
}
export interface OutreachRunResult {
    briefing: Briefing;
    considered: Recipient[];
    sent: {
        recipient: Recipient;
        result: SendResult;
    }[];
    skipped: {
        recipient: Recipient;
        reason: string;
    }[];
    dryRun: boolean;
}
export declare function runOutreach(opts: OutreachRunOptions): Promise<OutreachRunResult>;
//# sourceMappingURL=outreach.d.ts.map