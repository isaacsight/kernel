import { readFile } from "node:fs/promises";
import { AppendOnlyAuditLog, type AuditEntry } from "../audit-log.js";

/**
 * EU AI Act Annex IV technical documentation exporter.
 *
 * Walks the kbot-finance audit log and emits a markdown bundle aligned to
 * the structure required by EU AI Act Article 11 / Annex IV. The same
 * bundle satisfies Fed SR 26-02 technical documentation requirements
 * because both regimes converge on the same artifact set.
 *
 * v0.1 emits a single markdown document. v0.2 will emit a structured
 * directory (model card, training-data manifest, evaluation logs,
 * deployment config, prompt templates, drift reports, incident records)
 * matching the AI Act's Annex IV sections 1-9 verbatim.
 *
 * This is the artifact compliance teams buy from the platform; the
 * audit log is the raw material, the exporter is the user-visible
 * deliverable.
 */

export interface AnnexIvBundle {
  readonly format: "markdown";
  readonly content: string;
  readonly meta: {
    readonly generated_at: string;
    readonly audit_log_path: string;
    readonly audit_log_intact: boolean;
    readonly entry_count: number;
    readonly first_seq: number | null;
    readonly last_seq: number | null;
  };
}

interface Aggregated {
  entries: AuditEntry[];
  operations: Map<string, number>;
  rule_failures: Map<string, number>;
  incidents: AuditEntry[];
  engine_versions: Set<string>;
  jurisdictions: Set<string>;
  sessions: Set<string>;
}

function aggregate(entries: ReadonlyArray<AuditEntry>): Aggregated {
  const operations = new Map<string, number>();
  const rule_failures = new Map<string, number>();
  const incidents: AuditEntry[] = [];
  const engine_versions = new Set<string>();
  const jurisdictions = new Set<string>();
  const sessions = new Set<string>();
  for (const e of entries) {
    operations.set(e.subject, (operations.get(e.subject) ?? 0) + 1);
    if (e.action === "incident") incidents.push(e);
    if (e.action === "verifier_check") {
      const p = e.payload as { ok?: boolean; checks?: ReadonlyArray<{ rule_id: string; result: { pass: boolean; reason?: { code: string } } }> };
      if (p.checks) {
        for (const c of p.checks) {
          if (!c.result.pass) {
            const key = `${c.rule_id}/${c.result.reason?.code ?? "unknown"}`;
            rule_failures.set(key, (rule_failures.get(key) ?? 0) + 1);
          }
        }
      }
    }
    if (e.action === "engine_response") {
      const p = e.payload as { engine_version?: string };
      if (typeof p.engine_version === "string") engine_versions.add(p.engine_version);
    }
    sessions.add(e.session_id);
  }
  return {
    entries: entries.slice(),
    operations,
    rule_failures,
    incidents,
    engine_versions,
    jurisdictions,
    sessions,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body}\n`;
}

/**
 * Read a JSONL audit log and emit an Annex IV-shaped markdown bundle.
 * Returns the rendered string plus a small metadata block — caller writes
 * the bundle to disk, e-mails it, or uploads to a regulator portal.
 */
export async function exportAnnexIv(
  audit_log_path: string,
  options: {
    system_name?: string;
    deployer?: string;
    jurisdiction?: "EU" | "US" | "UK" | "SG" | "HK" | "UAE" | "GLOBAL";
  } = {},
): Promise<AnnexIvBundle> {
  const integrity = await AppendOnlyAuditLog.verify(audit_log_path);
  const raw = await readFile(audit_log_path, "utf8").catch(() => "");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const entries = lines.map((l) => JSON.parse(l) as AuditEntry);
  const agg = aggregate(entries);

  const first = entries[0];
  const last = entries[entries.length - 1];
  const system_name = options.system_name ?? "kbot-finance AI Intelligence Layer";
  const deployer = options.deployer ?? "(deployer not specified)";
  const jurisdiction = options.jurisdiction ?? "EU";

  const header = `# Annex IV Technical Documentation Pack

**System name:** ${system_name}
**Deployer:** ${deployer}
**Jurisdiction filed under:** ${jurisdiction}
**Generated:** ${new Date().toISOString()}
**Audit log:** ${audit_log_path}
**Hash chain integrity:** ${integrity.ok ? "INTACT" : `BROKEN at seq=${integrity.ok ? "" : integrity.broken_at_seq}`}
**Period covered:** ${first?.timestamp ?? "(empty)"} → ${last?.timestamp ?? "(empty)"}
**Entries:** ${formatNumber(entries.length)}
`;

  const sec1 = section(
    "1. General description of the AI system",
    `An AI-orchestration ("Intelligence") layer that issues content-addressed engine requests on behalf of authenticated callers. The system **never produces a financial number itself** — numbers are produced by deterministic engine adapters wrapped in SHA-256-hashed request envelopes. Each response carries a \`request_hash\` that uniquely identifies the call and is reproducible from the canonicalized inputs.

The system operates in the seconds-to-minutes latency band; sub-millisecond execution paths are explicitly out of scope.

Engine adapters wired into this deployment:
${[...agg.engine_versions].sort().map((v) => `- ${v}`).join("\n") || "- (none recorded)"}
`,
  );

  const opLines = [...agg.operations.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([op, n]) => `- ${op}: ${formatNumber(n)} entries`)
    .join("\n");
  const sec2 = section(
    "2. Detailed description of elements and process of development",
    `Engine adapters expose typed read/write operations; the AI orchestration layer composes them through a content-addressed envelope. Every operation is governed by a regulatory verifier that evaluates jurisdiction-aware rules-as-code before the engine is invoked. Operation traffic in the audited period:

${opLines || "- (no operations recorded)"}
`,
  );

  const sec3 = section(
    "3. Detailed description of monitoring, functioning and control",
    `Every request and response is logged into a hash-chained append-only audit log (\`AppendOnlyAuditLog\`). Each entry includes \`prev_hash\`, \`self_hash\`, and a strictly monotonic \`seq\`. The chain is verifiable by walking the log and recomputing entry hashes (\`AppendOnlyAuditLog.verify\`). Drift, hallucination, and incident reports flow into the same log under action codes \`incident\`, \`replay_mismatch\`.

Hash chain integrity at time of export: **${integrity.ok ? "INTACT" : "BROKEN"}**.
`,
  );

  const ruleLines = [...agg.rule_failures.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `- ${k}: ${formatNumber(n)} occurrences`)
    .join("\n");
  const sec4 = section(
    "4. Risk management system",
    `A pre-action regulatory verifier evaluates rules-as-code before any engine call. Failures emit adverse-action-style reason codes patterned on ECOA. The verifier never short-circuits — every applicable rule runs so the audit log records the full evaluation, not just the first failure.

Verifier rejections during the audited period:

${ruleLines || "- (no verifier rejections recorded)"}

Material-gate approval tokens (HMAC-SHA256-signed; Ed25519 in v0.2) bind every approver decision to the exact \`request_hash\` they signed off on. Tokens cannot be replayed across requests, sessions, or materiality classes.
`,
  );

  const sec5 = section(
    "5. Description of any changes to the system through its lifecycle",
    `Engine adapters and verifier rules are versioned independently. The audit log records every engine_version observed during the audited period (see §1). Adapter upgrades are non-breaking when they preserve the same \`engine_version\` namespace; breaking upgrades produce a new version string and therefore a new \`request_hash\` for any otherwise-identical request.

No retraining cycles occur within the kbot-finance substrate itself; AI model versions are external dependencies whose lineage is captured in \`model_version\` fields on each request envelope (enforced by \`rule.model_version_pinned\`).
`,
  );

  const sec6 = section(
    "6. List of harmonised standards / common specifications applied",
    `- IEEE 754-2019 floating-point arithmetic (numerical determinism preconditions)
- RFC 8785 JSON Canonicalization Scheme (canonical input hashing)
- SHA-256 (content addressing, audit-log chain)
- HMAC-SHA256 (approval token signing, v0.1)
- ISO 8601 UTC timestamps
- FINOS AI Governance Framework v2.0 risk catalog
- Mapped to: EU AI Act Art. 11-15, Fed SR 26-02, ESMA MiFID II RTS 6 (Article 9 self-assessment), FINRA 2026 ROR GenAI section, FCA SS1/23.
`,
  );

  const incidentLines = agg.incidents.length === 0
    ? "- (no incidents recorded)"
    : agg.incidents.map((i) => `- ${i.timestamp} seq=${i.seq} subject=${i.subject} payload=${JSON.stringify(i.payload).slice(0, 200)}`).join("\n");
  const sec7 = section(
    "7. EU declaration of conformity / serious-incident records",
    `Serious-incident reports flow through the same audit log under action=\`incident\`. The reportable surface satisfies Reg S-P 72-hour notification timelines and AI Act Art. 73 serious-incident reporting through the same plumbing — incidents are not parallel records, they are entries in the chain.

Incidents observed during the audited period:

${incidentLines}
`,
  );

  const sec8 = section(
    "8. Records of post-market monitoring",
    `Drift, hallucination, and verifier-rejection rates are computable from this log directly (see §4). Long-term retention is configured to the longest applicable bar: 10 years post-decommission for high-risk AI Act systems (Art. 19); 6 years for Exchange Act 17a-4 records; 5 years for Advisers Act 204-2 / MiFID II.
`,
  );

  const content =
    header +
    "\n---\n\n" +
    sec1 +
    sec2 +
    sec3 +
    sec4 +
    sec5 +
    sec6 +
    sec7 +
    sec8 +
    "\n---\n\n" +
    `*Generated by @kernel.chat/kbot-finance Annex IV exporter. Audit log integrity verifiable via \`AppendOnlyAuditLog.verify("${audit_log_path}")\`.*\n`;

  return {
    format: "markdown",
    content,
    meta: {
      generated_at: new Date().toISOString(),
      audit_log_path,
      audit_log_intact: integrity.ok,
      entry_count: entries.length,
      first_seq: first?.seq ?? null,
      last_seq: last?.seq ?? null,
    },
  };
}
