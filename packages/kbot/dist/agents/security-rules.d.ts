export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface RuleContext {
    file: string;
    line: string;
    lineNumber: number;
    fullText: string;
}
export interface RuleHit {
    id: string;
    severity: Severity;
    category: string;
    description: string;
    recommendation: string;
    /** Auto-fix descriptor — only present when a rule supports a safe fix. */
    fix?: {
        find: string;
        replace: string;
        label: string;
    };
}
export interface Rule {
    id: string;
    category: string;
    severity: Severity;
    description: string;
    recommendation: string;
    appliesTo?: (file: string) => boolean;
    test: (ctx: RuleContext) => RuleHit | RuleHit[] | null;
}
export declare const RULES: Rule[];
export declare const RULES_BY_ID: Record<string, Rule>;
export declare const SEVERITY_RANK: Record<Severity, number>;
export declare const SCANNABLE_EXT: RegExp;
export declare function shouldScan(file: string): boolean;
//# sourceMappingURL=security-rules.d.ts.map