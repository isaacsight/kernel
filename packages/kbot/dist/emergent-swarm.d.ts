export interface SwarmRole {
    id: string;
    name: string;
    description: string;
    strengths: string[];
    emergenceScore: number;
    taskHistory: string[];
}
export interface SwarmState {
    roles: SwarmRole[];
    iteration: number;
    consensusHistory: string[];
    adaptations: number;
}
export interface TaskRequirements {
    capabilities: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedAgents: number;
}
export interface SwarmResult {
    synthesis: string;
    roleContributions: Map<string, string>;
    adaptations: number;
    iterations: number;
}
export declare function analyzeTaskRequirements(task: string): Promise<TaskRequirements>;
export declare function discoverRoles(task: string, requirements: TaskRequirements): SwarmRole[];
export declare class EmergentSwarm {
    private task;
    private maxAgents;
    private state;
    private contributions;
    constructor(task: string, maxAgents?: number);
    initialize(): Promise<void>;
    execute(): Promise<SwarmResult>;
    adapt(feedback: string): Promise<void>;
    getState(): SwarmState;
    private adaptRoles;
    private synthesize;
}
//# sourceMappingURL=emergent-swarm.d.ts.map