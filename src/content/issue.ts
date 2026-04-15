/* ──────────────────────────────────────────────────────────────
   kernel.chat — Issue metadata
   Treat every release as a magazine issue. Change these values
   on each version bump and the whole publication updates.
   ────────────────────────────────────────────────────────────── */

export interface Issue {
  /** Issue number, stringified and padded (e.g. "360") */
  number: string
  /** Uppercase month, e.g. "APRIL" */
  month: string
  /** Year, e.g. "2026" */
  year: string
  /** Cover feature headline, uppercase */
  feature: string
  /** Japanese subtitle for the feature */
  featureJp: string
  /** Price tag, e.g. "¥0 · BYOK" */
  price: string
  /** Short tagline shown in the colophon */
  tagline: string
}

export const ISSUE: Issue = {
  number: '361',
  month: 'MAY',
  year: '2026',
  feature: 'THE INDOOR ISSUE: A FIELD GUIDE TO WORKING INSIDE',
  featureJp: '室内派宣言 — 部屋の中で世界を作る',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',
}

/** Format a page folio, e.g. "PRIVACY · P. 07" */
export function folio(section: string, page?: number): string {
  const n = page === undefined ? '' : ` · P. ${String(page).padStart(2, '0')}`
  return `${section.toUpperCase()}${n}`
}
