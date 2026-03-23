export interface IMessageAgentConfig {
    ollamaUrl: string;
    ollamaModel: string;
    pollInterval: number;
    numbers: string[];
    supabaseUrl?: string;
    supabaseKey?: string;
}
export interface IMessageAgentState {
    running: boolean;
    messagesProcessed: number;
    lastCheck: string;
    errors: string[];
}
declare const DEFAULT_OLLAMA_URL = "http://localhost:11434";
declare const DEFAULT_MODEL = "qwen2.5-coder:32b";
declare const DEFAULT_POLL_INTERVAL = 10000;
export declare function sendIMessage(phoneNumber: string, text: string): boolean;
export declare function getRecentMessages(phoneNumber: string, count?: number): Array<{
    text: string;
    isFromMe: boolean;
    date: string;
}>;
export declare function getIMessageAgentState(): IMessageAgentState;
export declare function startIMessageAgent(config: IMessageAgentConfig): Promise<void>;
export declare function stopIMessageAgent(): void;
export { DEFAULT_OLLAMA_URL, DEFAULT_MODEL, DEFAULT_POLL_INTERVAL };
//# sourceMappingURL=imessage-agent.d.ts.map