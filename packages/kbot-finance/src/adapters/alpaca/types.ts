/**
 * Alpaca Trading API types.
 *
 * Read-only subset calibrated to the account/positions/orders endpoints.
 * Alpaca's paper-trading environment is free to sign up for and is the
 * default base URL here — a brokerage adapter that defaults to live
 * order-eligible credentials would be the wrong failure mode.
 *
 * Reference: https://docs.alpaca.markets/reference/getaccount
 */

export interface AlpacaAccount {
  readonly id?: string;
  readonly account_number?: string;
  readonly status?: string;
  readonly currency?: string;
  readonly cash?: string;
  readonly portfolio_value?: string;
  readonly equity?: string;
  readonly last_equity?: string;
  readonly buying_power?: string;
  readonly regt_buying_power?: string;
  readonly daytrading_buying_power?: string;
  readonly pattern_day_trader?: boolean;
  readonly trading_blocked?: boolean;
  readonly account_blocked?: boolean;
  readonly created_at?: string;
}

export interface AlpacaPosition {
  readonly asset_id?: string;
  readonly symbol?: string;
  readonly exchange?: string;
  readonly asset_class?: string;
  readonly side?: string;
  readonly qty?: string;
  readonly avg_entry_price?: string;
  readonly current_price?: string;
  readonly market_value?: string;
  readonly cost_basis?: string;
  readonly unrealized_pl?: string;
  readonly unrealized_plpc?: string;
  readonly change_today?: string;
}

export interface AlpacaOrder {
  readonly id?: string;
  readonly client_order_id?: string;
  readonly symbol?: string;
  readonly asset_class?: string;
  readonly side?: string;
  readonly type?: string;
  readonly qty?: string;
  readonly filled_qty?: string;
  readonly filled_avg_price?: string;
  readonly status?: string;
  readonly submitted_at?: string;
  readonly filled_at?: string;
  readonly canceled_at?: string;
}

/** Adapter outcome — discriminated union. Never throws across the boundary. */
export type AlpacaOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AlpacaError };

export interface AlpacaError {
  readonly code:
    | "network"
    | "http"
    | "parse"
    | "not_found"
    | "rate_limited"
    | "unauthorized"
    | "missing_credentials";
  readonly message: string;
  readonly status?: number;
  readonly body?: string;
}

/**
 * Paper trading is the default base — a brokerage adapter must not silently
 * default to a live-order-eligible endpoint. Set KBOT_FINANCE_ALPACA_BASE
 * to switch to https://api.alpaca.markets once a compliance officer has
 * signed off on live use, per the read-only-unless-signed-off pattern this
 * package follows for every brokerage/pricing engine adapter.
 */
export const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";
export const ALPACA_LIVE_BASE = "https://api.alpaca.markets";
export const ALPACA_ADAPTER_VERSION = "alpaca-adapter@0.1.0";

export function getAlpacaBase(): string {
  return process.env["KBOT_FINANCE_ALPACA_BASE"] ?? ALPACA_PAPER_BASE;
}

/**
 * Alpaca credentials. Namespaced KBOT_FINANCE_ALPACA_* first; falls back to
 * the APCA_API_KEY_ID / APCA_API_SECRET_KEY convention Alpaca's own SDKs and
 * CLI use, so operators who already have Alpaca configured don't have to
 * duplicate keys.
 */
export function getAlpacaCredentials(): { keyId: string; secretKey: string } | null {
  const keyId =
    process.env["KBOT_FINANCE_ALPACA_KEY_ID"] ?? process.env["APCA_API_KEY_ID"];
  const secretKey =
    process.env["KBOT_FINANCE_ALPACA_SECRET_KEY"] ?? process.env["APCA_API_SECRET_KEY"];
  if (!keyId || !secretKey) return null;
  return { keyId, secretKey };
}
