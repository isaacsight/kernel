export interface Handoff {
    id: string;
    from: string;
    to: string;
    reason: string;
    context: string;
    artifacts: string[];
    priority: 'low' | 'normal' | 'high' | 'critical';
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
    result?: string;
    rejectionReason?: string;
    created: string;
    updated: string;
}
/** Create a handoff request from one agent to another */
export declare function createHandoff(from: string, to: string, reason: string, context: string, artifacts?: string[], priority?: Handoff['priority']): Handoff;
/** Accept a pending handoff */
export declare function acceptHandoff(id: string): Handoff;
/** Reject a pending handoff with a reason */
export declare function rejectHandoff(id: string, reason: string): Handoff;
/** Mark a handoff as completed with a result */
export declare function completeHandoff(id: string, result: string): Handoff;
/** Get all pending handoffs, optionally filtered by target agent */
export declare function getActiveHandoffs(agentId?: string): Handoff[];
/** Get full handoff history for analysis */
export declare function getHandoffHistory(): Handoff[];
export interface BlackboardEntry {
    key: string;
    value: unknown;
    author: string;
    type: 'fact' | 'hypothesis' | 'decision' | 'artifact' | 'question';
    confidence: number;
    timestamp: string;
    subscribers: string[];
}
export interface Blackboard {
    entries: Map<string, BlackboardEntry>;
}
type SubscriptionCallback = (entry: BlackboardEntry) => void;
/** Write an entry to the shared blackboard */
export declare function blackboardWrite(key: string, value: unknown, author: string, type: BlackboardEntry['type'], confidence?: number): BlackboardEntry;
/** Read an entry from the blackboard */
export declare function blackboardRead(key: string): BlackboardEntry | undefined;
/** Query all entries, optionally filtered by type */
export declare function blackboardQuery(type?: BlackboardEntry['type']): BlackboardEntry[];
/** Subscribe an agent to changes on a blackboard key */
export declare function blackboardSubscribe(key: string, agentId: string, callback?: SubscriptionCallback): void;
/** Get all decision-type entries (consensus view) */
export declare function blackboardGetDecisions(): BlackboardEntry[];
/** Clear the entire blackboard for a new task */
export declare function blackboardClear(): void;
export interface Proposal {
    id: string;
    author: string;
    description: string;
    rationale: string;
    votes: Map<string, {
        vote: 'agree' | 'disagree' | 'abstain';
        reason?: string;
    }>;
    status: 'open' | 'accepted' | 'rejected' | 'compromised';
    resolution?: string;
    created: string;
}
/** Propose an approach for multi-agent negotiation */
export declare function propose(author: string, description: string, rationale: string): Proposal;
/** Cast a vote on a proposal */
export declare function vote(proposalId: string, agentId: string, v: 'agree' | 'disagree' | 'abstain', reason?: string): Proposal;
/** Resolve a proposal: majority wins, trust-weighted tiebreaking */
export declare function resolveProposal(proposalId: string): Proposal;
/** Get consensus state of all proposals */
export declare function getConsensus(): Proposal[];
export interface TrustProfile {
    agentId: string;
    domains: Map<string, number>;
    overall: number;
    history: {
        task: string;
        success: boolean;
        domain: string;
        timestamp: string;
    }[];
}
/** Get trust score for an agent, optionally in a specific domain */
export declare function getTrust(agentId: string, domain?: string): number;
/** Update trust for an agent after task completion */
export declare function updateTrust(agentId: string, domain: string, success: boolean): void;
/** Get the most trusted agent for a specific domain */
export declare function getMostTrusted(domain: string): {
    agentId: string;
    trust: number;
} | null;
/** Get the full trust matrix for all agents */
export declare function getTrustReport(): string;
export declare function registerAgentProtocolTools(): void;
export {};
//# sourceMappingURL=agent-protocol.d.ts.map