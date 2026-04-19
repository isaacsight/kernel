interface GrowthSummary {
    betterPct: number;
    days: number;
    sessions: number;
    toolCalls: number;
    successRate: number;
    routingAccuracy: number;
    newPatterns: number;
}
interface GrowthResult {
    summary: GrowthSummary;
    metrics: Array<{
        label: string;
        current: number;
        prior: number;
        delta: number;
    }>;
    deltas: Array<{
        tool: string;
        current: number;
        prior: number;
        delta: number;
    }>;
    agents: Array<{
        agent: string;
        accuracy: number;
        samples: number;
    }>;
}
export declare function runGrowth(opts?: {
    json?: boolean;
    days?: number;
    dataDir?: string;
    now?: number;
}): GrowthResult | null;
export {};
//# sourceMappingURL=growth.d.ts.map