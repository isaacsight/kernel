export interface ViewerMemory {
    username: string;
    firstSeen: string;
    totalMessages: number;
    topics: string[];
    personality_notes: string;
    lastInteraction: string;
}
export interface ChatAIStats {
    totalMessages: number;
    totalResponses: number;
    uniqueViewers: number;
    currentMode: string;
    currentTopic: string;
    uptime: number;
    modelInUse: string;
    queueDepth: number;
}
export declare class StreamChatAI {
    private mode;
    private viewers;
    private contextHistory;
    private currentTopic;
    private topicHistory;
    private lastResponseTime;
    private messagesSinceResponse;
    private totalMessages;
    private totalResponses;
    private startTime;
    private modelInUse;
    private queue;
    private activeTriviaQuestion;
    private processing;
    constructor();
    processMessage(username: string, message: string, platform: string): Promise<string | null>;
    private shouldRespond;
    private processQueue;
    private generateChatResponse;
    private handleGreeting;
    private handleCompliment;
    handleCommand(cmd: string, args: string, username: string): Promise<string>;
    private handleAsk;
    private handleJoke;
    private handleTrivia;
    private touchViewer;
    private isNewOrReturning;
    setMode(mode: 'reactive' | 'conversational' | 'entertainer' | 'quiet'): void;
    getMode(): string;
    getViewerMemory(username: string): ViewerMemory | null;
    getTopicSummary(): string;
    getStats(): ChatAIStats;
    saveMemory(): void;
    loadMemory(): void;
}
export declare function registerStreamChatAITools(): void;
//# sourceMappingURL=stream-chat-ai.d.ts.map