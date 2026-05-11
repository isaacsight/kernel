import { gammaGet } from "./client.js";
import type {
  PolymarketMarket,
  PolymarketEvent,
  PolymarketOutcome,
} from "./types.js";

/**
 * Read-only commands against Polymarket's Gamma API.
 *
 * Trading / signing / order placement intentionally not in v0.1 — read
 * first, governed write second. The pattern is the wedge; the volume
 * comes after the audit primitives are proven.
 */

export async function listMarkets(
  params: { limit?: number; active?: boolean; closed?: boolean; order?: string } = {},
): Promise<PolymarketOutcome<ReadonlyArray<PolymarketMarket>>> {
  return gammaGet<ReadonlyArray<PolymarketMarket>>("/markets", {
    limit: params.limit ?? 10,
    ...(params.active !== undefined ? { active: params.active } : {}),
    ...(params.closed !== undefined ? { closed: params.closed } : {}),
    ...(params.order !== undefined ? { order: params.order } : {}),
  });
}

export async function getMarket(
  id: string,
): Promise<PolymarketOutcome<PolymarketMarket>> {
  return gammaGet<PolymarketMarket>(`/markets/${encodeURIComponent(id)}`);
}

export async function listEvents(
  params: { limit?: number; active?: boolean; closed?: boolean } = {},
): Promise<PolymarketOutcome<ReadonlyArray<PolymarketEvent>>> {
  return gammaGet<ReadonlyArray<PolymarketEvent>>("/events", {
    limit: params.limit ?? 10,
    ...(params.active !== undefined ? { active: params.active } : {}),
    ...(params.closed !== undefined ? { closed: params.closed } : {}),
  });
}

/**
 * Decode the `outcomePrices` string Gamma returns as a JSON-encoded array
 * of stringified numbers, e.g. "[\"0.42\", \"0.58\"]".
 *
 * Returns null on any decode failure — the caller decides whether to treat
 * that as fatal. The adapter never throws across the boundary.
 */
export function decodeOutcomePrices(raw: string | undefined): ReadonlyArray<number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const nums: number[] = [];
    for (const v of parsed) {
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
      if (!Number.isFinite(n)) return null;
      nums.push(n);
    }
    return nums;
  } catch {
    return null;
  }
}

export function decodeOutcomes(raw: string | undefined): ReadonlyArray<string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.every((v) => typeof v === "string") ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}
