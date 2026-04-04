export interface StreamBrain {
    /** Cross-domain knowledge graph */
    domainGraph: Record<string, DomainNode>;
    /** Tool names currently "loaded" in the brain's focus */
    activeCapabilities: string[];
    /** Currently suggested/executing tool action */
    pendingAction: BrainToolAction | null;
    /** History of executed tool actions */
    actionHistory: BrainToolAction[];
    /** Anticipation engine predictions */
    predictions: Prediction[];
    /** Per-user interest model: username -> likely interests */
    userIntentModel: Record<string, string[]>;
    /** Cross-domain insights generated when 2+ domains overlap */
    insights: CrossDomainInsight[];
    /** Total cross-domain connections made */
    connectionsMade: number;
    /** Frame counter for last suggestion */
    lastSuggestionFrame: number;
    /** Frame counter for last insight */
    lastInsightFrame: number;
    /** Frame counter for last relevance decay */
    lastDecayFrame: number;
    /** Whether a tool is currently executing */
    executing: boolean;
}
export interface DomainNode {
    name: string;
    tools: string[];
    relevance: number;
    lastUsed: number;
    facts: string[];
    color: string;
}
export interface BrainToolAction {
    tool: string;
    args: Record<string, unknown>;
    trigger: 'chat' | 'autonomous' | 'brain';
    status: 'pending' | 'executing' | 'complete' | 'failed';
    result: string;
    displayLines: string[];
    startFrame: number;
}
export interface Prediction {
    text: string;
    confidence: number;
    suggestedTool: string;
    basedOn: string;
}
export interface CrossDomainInsight {
    domains: string[];
    insight: string;
    frame: number;
}
export interface BrainAction {
    type: 'none' | 'suggest' | 'insight' | 'speech' | 'mood';
    speech?: string;
    mood?: string;
    duration?: number;
    suggestion?: BrainToolAction;
    insight?: CrossDomainInsight;
}
export declare function initStreamBrain(): StreamBrain;
export declare function analyzeChatForDomains(brain: StreamBrain, username: string, text: string): void;
export declare function suggestToolAction(brain: StreamBrain): BrainToolAction | null;
export declare function executeToolAction(brain: StreamBrain, action: BrainToolAction): Promise<string>;
export declare function tickStreamBrain(brain: StreamBrain, frame: number): BrainAction | null;
export declare function handleBrainCommand(text: string, username: string, brain: StreamBrain): string | null;
export declare function drawBrainActivity(ctx: CanvasRenderingContext2D, brain: StreamBrain, x: number, y: number, width: number, height: number): void;
//# sourceMappingURL=stream-brain.d.ts.map