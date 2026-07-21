import { alpacaGet } from "./client.js";
import type { AlpacaAccount, AlpacaPosition, AlpacaOrder, AlpacaOutcome } from "./types.js";

/**
 * Read-only commands against the Alpaca Trading API.
 *
 * Order placement intentionally not in v0.1 — read first, governed write
 * second, same wedge the Polymarket adapter uses. A brokerage engine is the
 * highest-stakes adapter this package ships; it stays read-only until a
 * material-gate approval flow for order placement exists.
 */

export async function getAccount(): Promise<AlpacaOutcome<AlpacaAccount>> {
  return alpacaGet<AlpacaAccount>("/v2/account");
}

export async function listPositions(): Promise<AlpacaOutcome<ReadonlyArray<AlpacaPosition>>> {
  return alpacaGet<ReadonlyArray<AlpacaPosition>>("/v2/positions");
}

export async function getPosition(symbol: string): Promise<AlpacaOutcome<AlpacaPosition>> {
  return alpacaGet<AlpacaPosition>(`/v2/positions/${encodeURIComponent(symbol)}`);
}

export async function listOrders(
  params: { status?: "open" | "closed" | "all"; limit?: number } = {},
): Promise<AlpacaOutcome<ReadonlyArray<AlpacaOrder>>> {
  return alpacaGet<ReadonlyArray<AlpacaOrder>>("/v2/orders", {
    status: params.status ?? "open",
    limit: params.limit ?? 25,
  });
}

/** Alpaca returns numeric fields as strings. Decode once at the normalization boundary. */
export function decodeNumeric(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
