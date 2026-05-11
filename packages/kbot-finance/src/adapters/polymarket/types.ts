/**
 * Polymarket Gamma API types.
 *
 * Subset calibrated to the public Gamma endpoints used by the v0.1 adapter.
 * Fields are intentionally optional — Gamma's schema evolves, and we treat
 * unknown fields as opaque to keep the adapter resilient.
 *
 * Reference: https://gamma-api.polymarket.com
 */

export interface PolymarketMarket {
  readonly id?: string;
  readonly question?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly active?: boolean;
  readonly closed?: boolean;
  readonly archived?: boolean;
  readonly volumeNum?: number;
  readonly volume24hr?: number;
  readonly liquidityNum?: number;
  readonly outcomes?: string;
  readonly outcomePrices?: string;
  readonly clobTokenIds?: string;
  readonly endDate?: string;
  readonly startDate?: string;
  readonly conditionId?: string;
  readonly lastTradePrice?: number;
  readonly bestBid?: number;
  readonly bestAsk?: number;
  readonly spread?: number;
  readonly umaResolutionStatus?: string;
}

export interface PolymarketEvent {
  readonly id?: string;
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string;
  readonly active?: boolean;
  readonly closed?: boolean;
  readonly markets?: ReadonlyArray<PolymarketMarket>;
}

/** Adapter outcome — discriminated union. Never throws across the boundary. */
export type PolymarketOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PolymarketError };

export interface PolymarketError {
  readonly code: "network" | "http" | "parse" | "not_found" | "rate_limited";
  readonly message: string;
  readonly status?: number;
  readonly body?: string;
}

export const POLYMARKET_GAMMA_BASE = "https://gamma-api.polymarket.com";
export const POLYMARKET_ADAPTER_VERSION = "polymarket-adapter@0.1.0";
