export interface CompanionMemory {
    name: string;
    email: string;
    firstContact: string;
    interests: string[];
    goals: string[];
    facts: string[];
    preferences: string[];
    history: string[];
    lastTopic: string;
}
export interface EmailAgentConfig {
    supabaseUrl: string;
    supabaseKey: string;
    resendKey: string;
    ollamaUrl: string;
    ollamaModel: string;
    pollInterval: number;
    /** If empty, accepts ALL inbound emails (open mode) */
    agentUsers: string[];
}
export declare function loadCompanionMemory(email: string): CompanionMemory;
export declare function saveCompanionMemory(memory: CompanionMemory): void;
export interface EmailAgentState {
    running: boolean;
    processedCount: number;
    lastCheck: string;
    errors: string[];
}
export declare function getEmailAgentState(): EmailAgentState;
export declare function startEmailAgent(config: EmailAgentConfig): Promise<void>;
export declare function stopEmailAgent(): void;
//# sourceMappingURL=email-agent.d.ts.map