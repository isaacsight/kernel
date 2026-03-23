export declare enum LoopPattern {
    tool_repetition = "tool_repetition",
    output_oscillation = "output_oscillation",
    cost_spiral = "cost_spiral",
    context_exhaustion = "context_exhaustion",
    semantic_stagnation = "semantic_stagnation",
    circular_reasoning = "circular_reasoning"
}
export interface DecidabilityScore {
    decidable: boolean;
    confidence: number;
    pattern?: LoopPattern;
    evidence: string;
    recommendation: 'continue' | 'simplify' | 'handoff' | 'decompose';
    tokensBurned: number;
    costBurned: number;
}
interface Options {
    maxToolRepeats: number;
    maxCostUsd: number;
    maxTokens: number;
    similarityThreshold: number;
}
export declare function jaccardSimilarity(a: string, b: string): number;
export declare function detectOscillation(outputs: string[]): boolean;
export declare class LoopDetector {
    private toolHistory;
    private outputs;
    private totalCost;
    private costHistory;
    private totalTokens;
    private opts;
    constructor(options?: Partial<Options>);
    recordToolCall(toolName: string, args: string, result: string): void;
    recordOutput(output: string): void;
    recordCost(costUsd: number): void;
    recordTokens(tokens: number): void;
    check(): DecidabilityScore;
    reset(): void;
    private checkToolRepetition;
    private checkCostSpiral;
    private checkSemanticStagnation;
    private checkCircularReasoning;
}
export {};
//# sourceMappingURL=godel-limits.d.ts.map