import { z } from 'zod';
import { type SecurityReport } from '../agents/security-agent.js';
export declare const securityAgentScanSchema: z.ZodObject<{
    target: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["scan", "scan-and-fix", "report-only"]>>;
}, "strip", z.ZodTypeAny, {
    target: string;
    mode: "scan" | "scan-and-fix" | "report-only";
}, {
    target: string;
    mode?: "scan" | "scan-and-fix" | "report-only" | undefined;
}>;
export declare const securityAgentReportSchema: z.ZodObject<{
    target: z.ZodString;
}, "strip", z.ZodTypeAny, {
    target: string;
}, {
    target: string;
}>;
export interface SecurityAgentToolDef<TArgs, TResult> {
    name: string;
    description: string;
    schema: z.ZodTypeAny;
    run: (args: TArgs) => Promise<TResult>;
}
export declare const securityAgentScan: SecurityAgentToolDef<z.infer<typeof securityAgentScanSchema>, SecurityReport>;
export declare const securityAgentReport: SecurityAgentToolDef<z.infer<typeof securityAgentReportSchema>, string>;
export declare const SECURITY_AGENT_TOOLS: (SecurityAgentToolDef<{
    target: string;
    mode: "scan" | "scan-and-fix" | "report-only";
}, SecurityReport> | SecurityAgentToolDef<{
    target: string;
}, string>)[];
//# sourceMappingURL=security-agent-tools.d.ts.map