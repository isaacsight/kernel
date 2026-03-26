interface TaskObservation {
    timestamp: string;
    agent: string;
    task: string;
    tools_used: string[];
    success: boolean;
    duration_ms: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
    user_satisfaction?: 'positive' | 'negative' | 'neutral';
    error?: string;
}
interface PerformanceProfile {
    agent: string;
    total_tasks: number;
    success_rate: number;
    avg_duration_ms: number;
    avg_cost: number;
    common_tools: Array<{
        name: string;
        frequency: number;
    }>;
    failure_patterns: string[];
    improvement_potential: 'low' | 'medium' | 'high';
}
interface Improvement {
    id: string;
    timestamp: string;
    target: 'routing' | 'prompt' | 'tool_selection' | 'fallback' | 'agent_config';
    agent: string;
    description: string;
    before: string;
    after: string;
    expected_impact: string;
    measured_impact?: string;
    status: 'proposed' | 'applied' | 'measured' | 'reverted';
}
interface MetaReport {
    timestamp: string;
    observations_analyzed: number;
    profiles: PerformanceProfile[];
    improvements_proposed: Improvement[];
    improvements_applied: Improvement[];
    cycle_number: number;
}
export declare function recordObservation(obs: TaskObservation): void;
export declare function analyzePerformance(): PerformanceProfile[];
export declare function proposeImprovements(profiles: PerformanceProfile[]): Improvement[];
export declare function applyImprovement(improvement: Improvement): boolean;
export declare function measureImpact(improvementId: string): string;
export declare function runMetaAgent(): Promise<MetaReport>;
export declare function getImprovementHistory(): Improvement[];
export declare function getActiveImprovements(): Improvement[];
export declare function getMetaStats(): {
    cycles: number;
    observations: number;
    improvements: number;
    active: number;
};
export {};
//# sourceMappingURL=meta-agent.d.ts.map