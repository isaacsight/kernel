/* ──────────────────────────────────────────────────────────────
   kernel.chat — Current issue (back-compat re-export)
   The current cover always tracks the latest issue in the archive.
   For the back catalog and per-issue data, see ./issues/.
   ────────────────────────────────────────────────────────────── */

import { LATEST_ISSUE } from './issues'
import type { IssueRecord } from './issues'

/** Legacy alias — same shape as IssueRecord, points at LATEST_ISSUE. */
export type Issue = IssueRecord

/** The current cover. Always equal to LATEST_ISSUE. */
export const ISSUE: Issue = LATEST_ISSUE

/** Format a page folio, e.g. "PRIVACY · P. 07" */
export function folio(section: string, page?: number): string {
  const n = page === undefined ? '' : ` · P. ${String(page).padStart(2, '0')}`
  return `${section.toUpperCase()}${n}`
}
