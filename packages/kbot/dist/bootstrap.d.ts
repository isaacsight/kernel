export type SectionStatus = 'pass' | 'warn' | 'fail';
export interface BootstrapSection {
    name: string;
    score: number;
    maxScore: number;
    findings: string[];
    status: SectionStatus;
    /** The single highest-impact fix for this section */
    fix?: string;
}
export interface BootstrapReport {
    project: string;
    score: number;
    maxScore: number;
    grade: string;
    sections: BootstrapSection[];
    topFix: string;
    summary: string;
    timestamp: string;
}
export declare function runBootstrap(): Promise<BootstrapReport>;
export declare function formatBootstrapReport(report: BootstrapReport): string;
export declare function formatBootstrapMarkdown(report: BootstrapReport): string;
export interface AutotelicCycle {
    report: BootstrapReport;
    action: string;
    result: 'acted' | 'deferred' | 'no-action-needed';
    reason: string;
    timestamp: string;
}
/**
 * Run one autotelic cycle: sense → score → decide → act → measure → log.
 * Returns the cycle result. Safe actions are executed automatically.
 * Destructive or ambiguous actions are deferred with instructions.
 *
 * Autotelic (Greek: auto + telos = self + purpose):
 * A system that generates its own goals and relentlessly achieves them.
 * Bootstrap provides self-purpose. Limitless Execution provides self-agency.
 * Together: the agent that knows what to do AND does it.
 */
export declare function runAutotelic(): Promise<AutotelicCycle>;
export declare function formatAutotelicCycle(cycle: AutotelicCycle): string;
//# sourceMappingURL=bootstrap.d.ts.map