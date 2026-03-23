export interface MatrixAgent {
    id: string;
    name: string;
    icon: string;
    color: string;
    systemPrompt: string;
    createdAt: Date;
    invocations: number;
}
/** Create a new agent in the matrix */
export declare function createAgent(name: string, systemPrompt: string, icon?: string, color?: string): MatrixAgent;
/** Get an agent by ID */
export declare function getAgent(id: string): MatrixAgent | undefined;
/** Remove an agent */
export declare function removeAgent(id: string): boolean;
/** List all agents in the matrix */
export declare function listAgents(): MatrixAgent[];
/** Get system prompt override if a matrix agent is active */
export declare function getMatrixSystemPrompt(agentId: string): string | null;
/** Get matrix agent IDs for tool hints */
export declare function getMatrixAgentIds(): string[];
/** Format agent list for display */
export declare function formatAgentList(): string;
/** Format a single agent detail */
export declare function formatAgentDetail(agent: MatrixAgent): string;
export declare const PRESETS: Record<string, {
    name: string;
    prompt: string;
}>;
export interface MimicProfile {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    icon: string;
    color: string;
    /** Code conventions to enforce */
    conventions?: string[];
    /** Example patterns to follow */
    examples?: string[];
}
export declare const MIMIC_PROFILES: Record<string, MimicProfile>;
/** Activate a mimic profile — creates a matrix agent with the mimic's conventions */
export declare function activateMimic(profileId: string): MatrixAgent | null;
/** Register built-in agents so they're always available via --agent flag */
export declare function registerBuiltinAgents(): void;
/** Format built-in agents for display */
export declare function formatBuiltinAgentList(): string;
/** Format a single built-in agent detail */
export declare function formatBuiltinAgentDetail(id: string): string | null;
/** List all available mimic profiles */
export declare function listMimicProfiles(): MimicProfile[];
/** Get mimic profile by ID */
export declare function getMimicProfile(id: string): MimicProfile | undefined;
//# sourceMappingURL=matrix.d.ts.map