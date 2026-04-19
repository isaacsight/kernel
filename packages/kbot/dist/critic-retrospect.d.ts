/**
 * Critic Retrospect — retroactive judgement of past session tool calls.
 *
 * Reads ~/.kbot/observer/session.jsonl, replays tool calls through
 * gateToolResult (critic-gate.ts), and reports:
 *   - overall accept/reject ratio
 *   - tools with highest reject rate (args-validation candidates)
 *   - rejects that were later retried successfully (critic false positives)
 *   - sessions ranked by "retries saved" score
 *   - suggested strictness setting from precision/recall tradeoff
 *
 * NB: the observer only logs {ts, tool, args, session} — no results.
 * We synthesize a *result proxy* from retry behaviour: a call whose exact
 * (tool, args-hash) recurs inside the same session within RETRY_WINDOW_MS
 * is treated as having implicitly failed the first time. The critic is
 * passed this synthesized signal so it can judge on intent + shape.
 *
 * Cache: ~/.kbot/critic-cache.json — keyed by (tool, argsHash, resultHash).
 *
 * CLI wiring: cli.ts was modified in parallel; leaving subcommand wiring
 * as a TODO. Invoke via `node -e "import('./dist/critic-retrospect.js').then(m => m.run())"`.
 */
export interface RetrospectOpts {
    sessions?: number;
    strictness?: number;
    jsonOut?: string;
    maxCallsPerSession?: number;
    /** Injectable for tests. */
    llmClient?: (userPrompt: string) => Promise<string>;
}
export interface RetrospectReport {
    totalCalls: number;
    sessionsScanned: number;
    sessionsAvailable: number;
    accepts: number;
    rejects: number;
    byTool: Record<string, {
        total: number;
        accepts: number;
        rejects: number;
    }>;
    topRejectRate: Array<{
        tool: string;
        total: number;
        rejectRate: number;
    }>;
    likelyFalsePositives: Array<{
        tool: string;
        session: string;
        retryGap: number;
        reason?: string;
    }>;
    sessionsRanked: Array<{
        session: string;
        calls: number;
        retriesSaved: number;
        score: number;
    }>;
    suggestedStrictness: number;
    precision: number;
    recall: number;
}
export declare function run(opts?: RetrospectOpts): Promise<RetrospectReport>;
//# sourceMappingURL=critic-retrospect.d.ts.map