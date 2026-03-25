export interface AgentCreateArgs {
    name?: string;
    specialty?: string;
    tone?: string;
    model?: string;
}
export declare function runAgentCreate(args?: AgentCreateArgs): Promise<void>;
/** List all custom agents in ~/.kbot/agents/ */
export declare function listCustomAgents(): {
    id: string;
    name: string;
    specialty: string;
}[];
//# sourceMappingURL=agent-create.d.ts.map