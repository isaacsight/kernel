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
  getMarket,
  listMarkets,
  decodeOutcomePrices,
  decodeOutcomes,
  POLYMARKET_ADAPTER_VERSION,
  type PolymarketMarket,
} from "../adapters/polymarket/index.js";

/**
 * polymarket_query — the kbot tool entry point.
 *
 * Wires the full architecture for one operation:
 *   1. Build the content-addressed request envelope.
 *   2. Run the regulatory verifier (informational ops still get audited).
 *   3. Log the verifier check.
 *   4. Call the Polymarket Gamma engine adapter.
 *   5. Seal the response into an envelope.
 *   6. Log the engine response.
 *
 * The AI agent calling this tool cannot produce the market price. It can
 * only request one, inside an envelope, with a replayable hash.
 */

const SCHEMA_HASH = sha256(
  canonicalize({
    type: "object",
    fields: {
      mode: { type: "string", enum: ["by_id", "list_active"] },
      market_id: { type: "string", optional: true },
      limit: { type: "number", optional: true },
    },
  } as JsonValue),
);

export interface PolymarketQueryInputs {
  /** "by_id" returns a single market; "list_active" returns top markets. */
  readonly mode: "by_id" | "list_active";
  readonly market_id?: string;
  readonly limit?: number;
  /** ISO 8601 UTC. The agent supplies "as of"; the engine doesn't time-travel today. */
  readonly data_as_of: string;
}

export interface PolymarketQueryValue {
  readonly mode: "by_id" | "list_active";
  readonly markets: ReadonlyArray<NormalizedMarket>;
}

export interface NormalizedMarket {
  readonly id: string | null;
  readonly question: string | null;
  readonly slug: string | null;
  readonly outcomes: ReadonlyArray<string> | null;
  readonly outcome_prices: ReadonlyArray<number> | null;
  readonly last_trade_price: number | null;
  readonly best_bid: number | null;
  readonly best_ask: number | null;
  readonly spread: number | null;
  readonly volume_total: number | null;
  readonly volume_24h: number | null;
  readonly liquidity: number | null;
  readonly active: boolean | null;
  readonly closed: boolean | null;
  readonly end_date: string | null;
  readonly condition_id: string | null;
  readonly uma_resolution_status: string | null;
}

function normalize(m: PolymarketMarket): NormalizedMarket {
  return {
    id: m.id ?? null,
    question: m.question ?? null,
    slug: m.slug ?? null,
    outcomes: decodeOutcomes(m.outcomes),
    outcome_prices: decodeOutcomePrices(m.outcomePrices),
    last_trade_price: m.lastTradePrice ?? null,
    best_bid: m.bestBid ?? null,
    best_ask: m.bestAsk ?? null,
    spread: m.spread ?? null,
    volume_total: m.volumeNum ?? null,
    volume_24h: m.volume24hr ?? null,
    liquidity: m.liquidityNum ?? null,
    active: m.active ?? null,
    closed: m.closed ?? null,
    end_date: m.endDate ?? null,
    condition_id: m.conditionId ?? null,
    uma_resolution_status: m.umaResolutionStatus ?? null,
  };
}

export interface PolymarketQueryDeps {
  readonly auditLog: AppendOnlyAuditLog;
  readonly rules: ReadonlyArray<Rule>;
  readonly verifierContext: VerifierContext;
  /** Override for testing. Defaults to the real Gamma client. */
  readonly engine?: {
    getMarket: typeof getMarket;
    listMarkets: typeof listMarkets;
  };
}

export type PolymarketQueryResult =
  | { readonly ok: true; readonly response: ContentAddressedResponse<PolymarketQueryValue> }
  | { readonly ok: false; readonly stage: "verifier" | "engine"; readonly detail: JsonValue };

export async function polymarketQuery(
  inputs: PolymarketQueryInputs,
  deps: PolymarketQueryDeps,
): Promise<PolymarketQueryResult> {
  const engine = deps.engine ?? { getMarket, listMarkets };

  const request: ContentAddressedRequest = {
    operation: inputs.mode === "by_id" ? "polymarket.get_market" : "polymarket.list_markets",
    engine_version: POLYMARKET_ADAPTER_VERSION,
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

  const sealed = await sealEnvelope<PolymarketQueryValue>(
    request,
    async () => {
      if (inputs.mode === "by_id") {
        if (!inputs.market_id) {
          throw new Error("market_id required for mode=by_id");
        }
        const r = await engine.getMarket(inputs.market_id);
        if (!r.ok) {
          throw new Error(`polymarket.get_market failed: ${r.error.code}: ${r.error.message}`);
        }
        return { mode: "by_id", markets: [normalize(r.value)] };
      } else {
        const r = await engine.listMarkets({
          limit: inputs.limit ?? 10,
          active: true,
          closed: false,
          order: "volume24hr",
        });
        if (!r.ok) {
          throw new Error(`polymarket.list_markets failed: ${r.error.code}: ${r.error.message}`);
        }
        return { mode: "list_active", markets: r.value.map(normalize) };
      }
    },
    // Gamma over HTTPS is not byte-replayable — markets move. The honesty
    // primitive: declare it. A second-pass replay must hit the same `data_as_of`
    // block on an indexer like Goldsky for true determinism. v0.1 does not yet.
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
      // Don't log the full market list at audit-info level; log the count
      // and the hash. Full payload is recoverable via replay.
      market_count: sealed.value.markets.length,
    },
  });

  return { ok: true, response: sealed };
}
