/**
 * SEC EDGAR public data API types.
 *
 * EDGAR is the canonical primary source for US public-company filings.
 * Every filing has a stable accession number — content-addressing is
 * essentially built into the substrate. This adapter is read-only.
 *
 * Reference: https://www.sec.gov/edgar/sec-api-documentation
 * User-Agent: SEC requires identifying contact info per fair-use policy.
 */

export interface EdgarSubmission {
  readonly accessionNumber?: ReadonlyArray<string>;
  readonly filingDate?: ReadonlyArray<string>;
  readonly reportDate?: ReadonlyArray<string>;
  readonly form?: ReadonlyArray<string>;
  readonly primaryDocument?: ReadonlyArray<string>;
  readonly primaryDocDescription?: ReadonlyArray<string>;
  readonly size?: ReadonlyArray<number>;
  readonly isXBRL?: ReadonlyArray<number>;
}

export interface EdgarSubmissionsResponse {
  readonly cik?: string;
  readonly entityType?: string;
  readonly name?: string;
  readonly tickers?: ReadonlyArray<string>;
  readonly exchanges?: ReadonlyArray<string>;
  readonly filings?: { readonly recent?: EdgarSubmission };
}

export interface EdgarCompanyFact {
  readonly label?: string;
  readonly description?: string;
  readonly units?: Record<string, ReadonlyArray<{
    readonly end?: string;
    readonly val?: number;
    readonly accn?: string;
    readonly fy?: number;
    readonly fp?: string;
    readonly form?: string;
    readonly filed?: string;
  }>>;
}

export interface EdgarCompanyFactsResponse {
  readonly cik?: number;
  readonly entityName?: string;
  readonly facts?: {
    readonly "us-gaap"?: Record<string, EdgarCompanyFact>;
    readonly dei?: Record<string, EdgarCompanyFact>;
  };
}

export type EdgarOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EdgarError };

export interface EdgarError {
  readonly code: "network" | "http" | "parse" | "not_found" | "rate_limited" | "missing_user_agent";
  readonly message: string;
  readonly status?: number;
}

export const EDGAR_SUBMISSIONS_BASE = "https://data.sec.gov";
export const EDGAR_ADAPTER_VERSION = "edgar-adapter@0.1.0";

/** SEC requires a descriptive User-Agent. Set via KBOT_FINANCE_SEC_UA. */
export function getUserAgent(): string {
  return (
    process.env["KBOT_FINANCE_SEC_UA"] ??
    "kbot-finance kernel.chat@gmail.com"
  );
}

/** Pad a CIK to the 10-digit form EDGAR's submissions endpoint requires. */
export function padCik(cik: string | number): string {
  const s = typeof cik === "number" ? String(cik) : cik.replace(/^CIK0*/i, "");
  return s.padStart(10, "0");
}
