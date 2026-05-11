import { edgarGet } from "./client.js";
import { padCik, type EdgarOutcome, type EdgarSubmissionsResponse, type EdgarCompanyFactsResponse } from "./types.js";

/**
 * Read-only commands against SEC EDGAR.
 *
 * Filings are immutable by SEC policy — every filing has a stable accession
 * number — so content-addressing is essentially native. The adapter returns
 * raw responses; the kbot tool layer computes envelopes over them.
 */

export async function getSubmissions(
  cik: string | number,
): Promise<EdgarOutcome<EdgarSubmissionsResponse>> {
  const padded = padCik(cik);
  return edgarGet<EdgarSubmissionsResponse>(`/submissions/CIK${padded}.json`);
}

export async function getCompanyFacts(
  cik: string | number,
): Promise<EdgarOutcome<EdgarCompanyFactsResponse>> {
  const padded = padCik(cik);
  return edgarGet<EdgarCompanyFactsResponse>(`/api/xbrl/companyfacts/CIK${padded}.json`);
}

export interface NormalizedFiling {
  readonly accession_number: string;
  readonly filing_date: string | null;
  readonly report_date: string | null;
  readonly form: string;
  readonly primary_document: string | null;
  readonly description: string | null;
  readonly is_xbrl: boolean;
  readonly archive_url: string;
}

/**
 * Flatten EDGAR's column-oriented `recent` table into rows. Filings are
 * presented oldest-last in EDGAR's response; we preserve that order so the
 * caller can pick recent N consistently.
 */
export function normalizeRecentFilings(
  response: EdgarSubmissionsResponse,
  cik: string | number,
  limit = 25,
): ReadonlyArray<NormalizedFiling> {
  const recent = response.filings?.recent;
  if (!recent) return [];
  const accs = recent.accessionNumber ?? [];
  const dates = recent.filingDate ?? [];
  const reports = recent.reportDate ?? [];
  const forms = recent.form ?? [];
  const docs = recent.primaryDocument ?? [];
  const descs = recent.primaryDocDescription ?? [];
  const xbrl = recent.isXBRL ?? [];
  const cikStr = padCik(cik).replace(/^0+/, "");
  const out: NormalizedFiling[] = [];
  const count = Math.min(accs.length, limit);
  for (let i = 0; i < count; i++) {
    const acc = accs[i];
    if (!acc) continue;
    const accNoDashes = acc.replace(/-/g, "");
    const doc = docs[i] ?? "";
    out.push({
      accession_number: acc,
      filing_date: dates[i] ?? null,
      report_date: reports[i] ?? null,
      form: forms[i] ?? "",
      primary_document: doc.length > 0 ? doc : null,
      description: descs[i] ?? null,
      is_xbrl: (xbrl[i] ?? 0) === 1,
      archive_url: `https://www.sec.gov/Archives/edgar/data/${cikStr}/${accNoDashes}/${doc}`,
    });
  }
  return out;
}
