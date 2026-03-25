interface DigestData {
    patterns: number;
    solutions: number;
    sessions: number;
    topTools: Array<{
        name: string;
        count: number;
    }>;
    topAgents: Array<{
        name: string;
        count: number;
    }>;
    growthPercent: number;
}
export declare function gatherDigestData(): DigestData;
export declare function formatDigest(data: DigestData, version: string): string;
export declare function runDigest(): Promise<void>;
export {};
//# sourceMappingURL=digest.d.ts.map