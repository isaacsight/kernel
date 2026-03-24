export interface AgentPolicy {
    /** Agent ID this policy applies to */
    agentId: string;
    /** Tools this agent is allowed to use (empty = all allowed) */
    allowedTools: string[];
    /** Tools explicitly blocked */
    blockedTools: string[];
    /** File paths the agent can access (glob patterns) */
    allowedPaths: string[];
    /** File paths the agent cannot access */
    blockedPaths: string[];
    /** Max execution time in seconds per tool call */
    maxExecutionTime: number;
    /** Whether the agent can make network requests */
    networkAccess: boolean;
    /** Whether the agent can execute shell commands */
    shellAccess: boolean;
    /** Max file size the agent can write (bytes) */
    maxFileSize: number;
    /** Whether the agent can install packages */
    canInstallPackages: boolean;
}
declare const DEFAULT_POLICY: Omit<AgentPolicy, 'agentId'>;
/** Strict policy for untrusted/new agents */
declare const STRICT_POLICY: Omit<AgentPolicy, 'agentId'>;
/** Built-in policies for known agents */
declare const BUILTIN_POLICIES: Record<string, Partial<AgentPolicy>>;
/** Load a specific agent's policy from file, falling back to builtins then defaults */
export declare function loadAgentPolicy(agentId: string): AgentPolicy;
export interface PolicyCheckResult {
    allowed: boolean;
    reason?: string;
}
/** Check if an agent is allowed to use a specific tool */
export declare function checkToolAccess(agentId: string, toolName: string, policy?: AgentPolicy): PolicyCheckResult;
/** Check if an agent can access a file path */
export declare function checkPathAccess(agentId: string, filePath: string, policy?: AgentPolicy): PolicyCheckResult;
/** List all agent policies (builtin + user-defined) */
export declare function listPolicies(): Array<{
    agentId: string;
    source: 'builtin' | 'user';
    policy: AgentPolicy;
}>;
/** Write a policy file for an agent */
export declare function writeAgentPolicy(agentId: string, policy: AgentPolicy): void;
export { DEFAULT_POLICY, STRICT_POLICY, BUILTIN_POLICIES };
//# sourceMappingURL=sandbox-policy.d.ts.map