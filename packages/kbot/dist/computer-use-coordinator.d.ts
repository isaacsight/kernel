export interface AgentRegistration {
    apps: string[];
    windowIds?: string[];
}
export interface LockRecord {
    agentId: string;
    pid: number;
    ts: number;
    windowIds?: string[];
}
export interface ClaimResult {
    granted: boolean;
    app: string;
    heldBy?: string;
    since?: number;
}
export interface CoordinatorStatus {
    apps: Record<string, {
        heldBy: string;
        since: number;
    } | null>;
    agents: Array<{
        id: string;
        apps: string[];
        claimed: string[];
    }>;
}
export declare class Coordinator {
    private root;
    private agents;
    /** in-memory mirror of which apps this coordinator instance has claimed */
    private claimed;
    constructor(root?: string);
    private lockPath;
    private readLock;
    private isStale;
    register(agentId: string, reg: AgentRegistration): void;
    claim(agentId: string, app: string): ClaimResult;
    release(agentId: string, app: string): boolean;
    unregister(agentId: string): string[];
    status(): CoordinatorStatus;
}
export declare function createCoordinator(root?: string): Coordinator;
//# sourceMappingURL=computer-use-coordinator.d.ts.map