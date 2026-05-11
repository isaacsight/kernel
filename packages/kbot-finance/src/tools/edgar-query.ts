import {
  sealEnvelope,
  sha256,
  canonicalize,
  type ContentAddressedRequest,
  type ContentAddressedResponse,
  type JsonValue,
} from "../envelope.js";
import { AppendOnlyAuditLog } from "../audit-log.js";
import { runVerifier, type Rule, type VerifierContext } from "../verifier/index.js";
import {
  getSubmissions,
  getCompanyFacts,
  normalizeRecentFilings,
  EDGAR_ADAPTER_VERSION,
  type NormalizedFiling,
} from "../adapters/edgar/index.js";

/**
 * edgar_query — read-only access to SEC EDGAR via the full kbot-finance
 * audit substrate. Same wiring shape as polymarket-query.ts.
 *
 * Filings are immutable by SEC policy: an accession number resolves to a
 * specific filing forever. This is the cleanest content-addressing story
 * available for US public-company data and is why EDGAR is a natural
 * second adapter — it proves the substrate works for both prediction
 * markets and official securities filings.
 */

const SCHEMA_HASH = sha256(
  canonicalize({
    type: "object",
    fields: {
      mode: { type: "string", enum: ["submissions", "company_facts"] },
      cik: { type: "string" },
      limit: { type: "number", optional: true },
    },
  } as JsonValue),
);

export interface EdgarQueryInputs {
  readonly mode: "submissions" | "company_facts";
  readonly cik: string;
  readonly limit?: number;
  readonly data_as_of: string;
}

export interface EdgarQueryValue {
  readonly mode: "submissions" | "company_facts";
  readonly entity_name: string | null;
  readonly cik: string;
  readonly filings?: ReadonlyArray<NormalizedFiling>;
  readonly facts_keys?: ReadonlyArray<string>;
}

export interface EdgarQueryDeps {
  readonly auditLog: AppendOnlyAuditLog;
  readonly rules: ReadonlyArray<Rule>;
  readonly verifierContext: VerifierContext;
  readonly engine?: {
    getSubmissions: typeof getSubmissions;
    getCompanyFacts: typeof getCompanyFacts;
  };
}

export type EdgarQueryResult =
  | { readonly ok: true; readonly response: ContentAddressedResponse<EdgarQueryValue> }
  | { readonly ok: false; readonly stage: "verifier" | "engine"; readonly detail: JsonValue };

export async function edgarQuery(
  inputs: EdgarQueryInputs,
  deps: EdgarQueryDeps,
): Promise<EdgarQueryResult> {
  const engine = deps.engine ?? { getSubmissions, getCompanyFacts };

  const request: ContentAddressedRequest = {
    operation: inputs.mode === "submissions" ? "edgar.submissions" : "edgar.company_facts",
    engine_version: EDGAR_ADAPTER_VERSION,
    schema_hash: SCHEMA_HASH,
    inputs: inputs as unknown as JsonValue,
    data_as_of: inputs.data_as_of,
  };

  const verifier_report = runVerifier(
    deps.rules,
    {
      operation: request.operation,
      inputs: request.inputs,
      materiality: "informational",
    },
    deps.verifierContext,
  );

  await deps.auditLog.append({
    action: "verifier_check",
    subject: request.operation,
    session_id: deps.verifierContext.session_id,
    payload: verifier_report as unknown as JsonValue,
  });

  if (!verifier_report.ok) {
    return { ok: false, stage: "verifier", detail: verifier_report as unknown as JsonValue };
  }

  await deps.auditLog.append({
    action: "engine_request",
    subject: request.operation,
    session_id: deps.verifierContext.session_id,
    payload: request as unknown as JsonValue,
  });

  const sealed = await sealEnvelope<EdgarQueryValue>(
    request,
    async () => {
      if (inputs.mode === "submissions") {
        const r = await engine.getSubmissions(inputs.cik);
        if (!r.ok) {
          throw new Error(`edgar.submissions failed: ${r.error.code}: ${r.error.message}`);
        }
        const filings = normalizeRecentFilings(r.value, inputs.cik, inputs.limit ?? 25);
        return {
          mode: "submissions" as const,
          entity_name: r.value.name ?? null,
          cik: inputs.cik,
          filings,
        };
      } else {
        const r = await engine.getCompanyFacts(inputs.cik);
        if (!r.ok) {
          throw new Error(`edgar.company_facts failed: ${r.error.code}: ${r.error.message}`);
        }
        const usGaap = r.value.facts?.["us-gaap"] ?? {};
        const facts_keys = Object.keys(usGaap).slice(0, inputs.limit ?? 50);
        return {
          mode: "company_facts" as const,
          entity_name: r.value.entityName ?? null,
          cik: inputs.cik,
          facts_keys,
        };
      }
    },
    // EDGAR filings are immutable by accession number, so for a given CIK
    // + as-of date the result is byte-stable if pinned to a snapshot.
    // The live API is byte-stable for closed filings but the `recent`
    // table grows; we mark replay as conditional, not guaranteed.
    { byte_identical_replayable: false },
  ).catch((e: Error) => ({ error: e.message }) as const);

  if ("error" in sealed) {
    await deps.auditLog.append({
      action: "incident",
      subject: request.operation,
      session_id: deps.verifierContext.session_id,
      payload: { error: sealed.error },
    });
    return { ok: false, stage: "engine", detail: { error: sealed.error } };
  }

  await deps.auditLog.append({
    action: "engine_response",
    subject: request.operation,
    session_id: deps.verifierContext.session_id,
    payload: {
      request_hash: sealed.request_hash,
      produced_at: sealed.produced_at,
      byte_identical_replayable: sealed.byte_identical_replayable,
      entity_name: sealed.value.entity_name,
      result_count:
        sealed.value.filings?.length ?? sealed.value.facts_keys?.length ?? 0,
    },
  });

  return { ok: true, response: sealed };
}
