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
  getAccount,
  listPositions,
  getPosition,
  listOrders,
  decodeNumeric,
  ALPACA_ADAPTER_VERSION,
  type AlpacaAccount,
  type AlpacaPosition,
  type AlpacaOrder,
} from "../adapters/alpaca/index.js";

/**
 * alpaca_query — the kbot tool entry point for the brokerage engine adapter.
 *
 * Same wiring shape as polymarket-query.ts / edgar-query.ts: content-addressed
 * envelope, regulatory verifier, hash-chained audit log, then the engine call.
 * Read-only — account, positions, and order status. No order placement; the
 * AI layer cannot move money through this tool.
 */

const SCHEMA_HASH = sha256(
  canonicalize({
    type: "object",
    fields: {
      mode: {
        type: "string",
        enum: ["account", "positions", "position_by_symbol", "orders"],
      },
      symbol: { type: "string", optional: true },
      status: { type: "string", optional: true },
      limit: { type: "number", optional: true },
    },
  } as JsonValue),
);

export interface AlpacaQueryInputs {
  readonly mode: "account" | "positions" | "position_by_symbol" | "orders";
  readonly symbol?: string;
  readonly status?: "open" | "closed" | "all";
  readonly limit?: number;
  /** ISO 8601 UTC. The agent supplies "as of"; the engine doesn't time-travel today. */
  readonly data_as_of: string;
}

export interface NormalizedAccount {
  readonly id: string | null;
  readonly account_number: string | null;
  readonly status: string | null;
  readonly currency: string | null;
  readonly cash: number | null;
  readonly portfolio_value: number | null;
  readonly equity: number | null;
  readonly buying_power: number | null;
  readonly pattern_day_trader: boolean | null;
  readonly trading_blocked: boolean | null;
  readonly account_blocked: boolean | null;
}

export interface NormalizedPosition {
  readonly symbol: string | null;
  readonly side: string | null;
  readonly qty: number | null;
  readonly avg_entry_price: number | null;
  readonly current_price: number | null;
  readonly market_value: number | null;
  readonly cost_basis: number | null;
  readonly unrealized_pl: number | null;
  readonly unrealized_plpc: number | null;
}

export interface NormalizedOrder {
  readonly id: string | null;
  readonly symbol: string | null;
  readonly side: string | null;
  readonly type: string | null;
  readonly qty: number | null;
  readonly filled_qty: number | null;
  readonly filled_avg_price: number | null;
  readonly status: string | null;
  readonly submitted_at: string | null;
}

export interface AlpacaQueryValue {
  readonly mode: "account" | "positions" | "position_by_symbol" | "orders";
  readonly account?: NormalizedAccount;
  readonly positions?: ReadonlyArray<NormalizedPosition>;
  readonly orders?: ReadonlyArray<NormalizedOrder>;
}

function normalizeAccount(a: AlpacaAccount): NormalizedAccount {
  return {
    id: a.id ?? null,
    account_number: a.account_number ?? null,
    status: a.status ?? null,
    currency: a.currency ?? null,
    cash: decodeNumeric(a.cash),
    portfolio_value: decodeNumeric(a.portfolio_value),
    equity: decodeNumeric(a.equity),
    buying_power: decodeNumeric(a.buying_power),
    pattern_day_trader: a.pattern_day_trader ?? null,
    trading_blocked: a.trading_blocked ?? null,
    account_blocked: a.account_blocked ?? null,
  };
}

function normalizePosition(p: AlpacaPosition): NormalizedPosition {
  return {
    symbol: p.symbol ?? null,
    side: p.side ?? null,
    qty: decodeNumeric(p.qty),
    avg_entry_price: decodeNumeric(p.avg_entry_price),
    current_price: decodeNumeric(p.current_price),
    market_value: decodeNumeric(p.market_value),
    cost_basis: decodeNumeric(p.cost_basis),
    unrealized_pl: decodeNumeric(p.unrealized_pl),
    unrealized_plpc: decodeNumeric(p.unrealized_plpc),
  };
}

function normalizeOrder(o: AlpacaOrder): NormalizedOrder {
  return {
    id: o.id ?? null,
    symbol: o.symbol ?? null,
    side: o.side ?? null,
    type: o.type ?? null,
    qty: decodeNumeric(o.qty),
    filled_qty: decodeNumeric(o.filled_qty),
    filled_avg_price: decodeNumeric(o.filled_avg_price),
    status: o.status ?? null,
    submitted_at: o.submitted_at ?? null,
  };
}

export interface AlpacaQueryDeps {
  readonly auditLog: AppendOnlyAuditLog;
  readonly rules: ReadonlyArray<Rule>;
  readonly verifierContext: VerifierContext;
  /** Override for testing. Defaults to the real Alpaca client. */
  readonly engine?: {
    getAccount: typeof getAccount;
    listPositions: typeof listPositions;
    getPosition: typeof getPosition;
    listOrders: typeof listOrders;
  };
}

export type AlpacaQueryResult =
  | { readonly ok: true; readonly response: ContentAddressedResponse<AlpacaQueryValue> }
  | { readonly ok: false; readonly stage: "verifier" | "engine"; readonly detail: JsonValue };

export async function alpacaQuery(
  inputs: AlpacaQueryInputs,
  deps: AlpacaQueryDeps,
): Promise<AlpacaQueryResult> {
  const engine = deps.engine ?? { getAccount, listPositions, getPosition, listOrders };

  const operation =
    inputs.mode === "account"
      ? "alpaca.account"
      : inputs.mode === "positions"
        ? "alpaca.positions"
        : inputs.mode === "position_by_symbol"
          ? "alpaca.position_by_symbol"
          : "alpaca.orders";

  const request: ContentAddressedRequest = {
    operation,
    engine_version: ALPACA_ADAPTER_VERSION,
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

  const sealed = await sealEnvelope<AlpacaQueryValue>(
    request,
    async () => {
      if (inputs.mode === "account") {
        const r = await engine.getAccount();
        if (!r.ok) throw new Error(`alpaca.account failed: ${r.error.code}: ${r.error.message}`);
        return { mode: "account" as const, account: normalizeAccount(r.value) };
      }
      if (inputs.mode === "positions") {
        const r = await engine.listPositions();
        if (!r.ok) throw new Error(`alpaca.positions failed: ${r.error.code}: ${r.error.message}`);
        return { mode: "positions" as const, positions: r.value.map(normalizePosition) };
      }
      if (inputs.mode === "position_by_symbol") {
        if (!inputs.symbol) throw new Error("symbol required for mode=position_by_symbol");
        const r = await engine.getPosition(inputs.symbol);
        if (!r.ok) {
          throw new Error(
            `alpaca.position_by_symbol failed: ${r.error.code}: ${r.error.message}`,
          );
        }
        return { mode: "position_by_symbol" as const, positions: [normalizePosition(r.value)] };
      }
      const r = await engine.listOrders({ status: inputs.status ?? "open", limit: inputs.limit ?? 25 });
      if (!r.ok) throw new Error(`alpaca.orders failed: ${r.error.code}: ${r.error.message}`);
      return { mode: "orders" as const, orders: r.value.map(normalizeOrder) };
    },
    // Account state, positions, and order status all change with every fill —
    // the honesty primitive: declare replay as non-deterministic, same as the
    // Polymarket and EDGAR adapters over live HTTPS.
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
      result_count: sealed.value.positions?.length ?? sealed.value.orders?.length ?? (sealed.value.account ? 1 : 0),
    },
  });

  return { ok: true, response: sealed };
}
