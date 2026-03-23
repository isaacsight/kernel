/** Discriminated union of all browser agent actions */
export type BrowserAction = {
    action: 'click';
    selector: string;
    description?: string;
} | {
    action: 'type';
    selector: string;
    text: string;
    description?: string;
} | {
    action: 'navigate';
    url: string;
    description?: string;
} | {
    action: 'scroll';
    direction: 'up' | 'down';
    amount?: number;
    description?: string;
} | {
    action: 'extract';
    selector: string;
    description?: string;
} | {
    action: 'screenshot';
    description?: string;
} | {
    action: 'done';
    result: string;
};
/** A single step in the agent execution log */
export interface AgentStep {
    step: number;
    action: BrowserAction;
    outcome: string;
    timestamp: string;
}
/** Final result from the browser agent */
export interface BrowserAgentResult {
    success: boolean;
    result: string;
    steps: AgentStep[];
    totalSteps: number;
    url: string;
}
export declare function registerBrowserAgentTools(): void;
//# sourceMappingURL=browser-agent.d.ts.map