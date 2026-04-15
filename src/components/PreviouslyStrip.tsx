import type { IssueRecord } from '../content/issues'

interface PreviouslyStripProps {
  previous: IssueRecord
}

/**
 * PreviouslyStrip — the tomato-ruled "PREVIOUSLY" cover strip.
 *
 * Rendered only on the live landing (`/`) as the closing gesture
 * of the cover — points backward in time to the issue that just
 * finished its run. Not rendered on archive pages; those use the
 * IssueArchiveNav PREV/NEXT pair instead.
 */
export function PreviouslyStrip({ previous }: PreviouslyStripProps) {
  return (
    <a href="#/issues" className="pop-previously">
      <span className="pop-folio">PREVIOUSLY</span>
      <span className="pop-previously-body">
        ISSUE {previous.number} · {previous.month} {previous.year}
        <span className="pop-previously-feature"> · {previous.feature}</span>
      </span>
      <span className="pop-folio pop-previously-arrow">SEE BACK CATALOG →</span>
    </a>
  )
}
