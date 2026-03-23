export interface FileTrigger {
    type: 'file';
    patterns: string[];
    events: ('change' | 'create' | 'delete')[];
}
export interface ScheduleTrigger {
    type: 'schedule';
    cron: string;
}
export interface GitTrigger {
    type: 'git';
    events: ('pre-commit' | 'post-commit' | 'pre-push')[];
}
export interface WebhookTrigger {
    type: 'webhook';
    path: string;
    secret?: string;
}
export type AutomationTrigger = FileTrigger | ScheduleTrigger | GitTrigger | WebhookTrigger;
export interface AutomationAction {
    agent: string;
    prompt: string;
    tools?: string[];
}
export interface Automation {
    id: string;
    name: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
    enabled: boolean;
    lastRun?: string;
    runCount: number;
}
export interface AutomationRunResult {
    automationId: string;
    startedAt: string;
    finishedAt: string;
    success: boolean;
    output?: string;
    error?: string;
}
export declare function createAutomation(config: {
    name: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
    enabled?: boolean;
}): Automation;
export declare function listAutomations(): Automation[];
export declare function getAutomation(id: string): Automation | undefined;
export declare function removeAutomation(id: string): boolean;
export declare function toggleAutomation(id: string, enabled: boolean): boolean;
export declare function runAutomation(id: string, context?: {
    filePath?: string;
    gitEvent?: string;
    webhookBody?: unknown;
}): Promise<AutomationRunResult>;
/**
 * Parse simple schedule strings into millisecond intervals.
 *
 * Supported formats:
 *   "every 5m"       → 300_000
 *   "every 1h"       → 3_600_000
 *   "every 30s"      → 30_000
 *   "daily 09:00"    → fires once a day at 09:00 local time
 */
export declare function parseSchedule(cron: string): {
    intervalMs?: number;
    dailyAt?: {
        hour: number;
        minute: number;
    };
};
/**
 * Parse CLI trigger shorthand into a typed trigger:
 *   "file:src/**\/*.ts:change"         → FileTrigger
 *   "file:src/**\/*.ts:change,create"  → FileTrigger
 *   "schedule:every 5m"               → ScheduleTrigger
 *   "git:pre-commit"                  → GitTrigger
 *   "git:pre-commit,post-commit"      → GitTrigger
 *   "webhook:/my-hook"                → WebhookTrigger
 *   "webhook:/my-hook:mysecret"       → WebhookTrigger
 */
export declare function parseTriggerString(input: string): AutomationTrigger;
export declare function handleWebhookTrigger(path: string, body: unknown, providedSecret?: string): Promise<{
    triggered: boolean;
    automationId?: string;
    error?: string;
}>;
export declare function startAutomationDaemon(options?: {
    log?: (msg: string) => void;
}): {
    stop: () => void;
    running: boolean;
};
export declare function formatAutomationList(automations: Automation[]): string;
//# sourceMappingURL=automations.d.ts.map