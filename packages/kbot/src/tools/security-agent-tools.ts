// kbot tool definitions for the unified security agent.
// NOT registered in tools/index.ts — wire them in deliberately when promoting
// the security agent surface (see guardian/hacker integration notes).

import { z } from 'zod'
import { runSecurityAgent, type SecurityReport } from '../agents/security-agent.js'

export const securityAgentScanSchema = z.object({
  target: z.string().describe('Absolute or relative directory to scan'),
  mode: z.enum(['scan', 'scan-and-fix', 'report-only']).default('scan'),
})

export const securityAgentReportSchema = z.object({
  target: z.string().describe('Directory to scan and produce a Markdown report for'),
})

export interface SecurityAgentToolDef<TArgs, TResult> {
  name: string
  description: string
  schema: z.ZodTypeAny
  run: (args: TArgs) => Promise<TResult>
}

export const securityAgentScan: SecurityAgentToolDef<
  z.infer<typeof securityAgentScanSchema>,
  SecurityReport
> = {
  name: 'security_agent_scan',
  description:
    'Run the kbot security agent over a directory. Modes: scan | scan-and-fix | report-only. ' +
    'Returns the full structured SecurityReport.',
  schema: securityAgentScanSchema,
  run: async (args) =>
    runSecurityAgent({ target: args.target, mode: args.mode }),
}

export const securityAgentReport: SecurityAgentToolDef<
  z.infer<typeof securityAgentReportSchema>,
  string
> = {
  name: 'security_agent_report',
  description:
    'Run the kbot security agent in read-only mode and return only the Markdown summary.',
  schema: securityAgentReportSchema,
  run: async (args) => {
    const report = await runSecurityAgent({ target: args.target, mode: 'report-only' })
    return report.summary
  },
}

export const SECURITY_AGENT_TOOLS = [securityAgentScan, securityAgentReport]
