import type { IssueRecord } from '../content/issues'
import './IssueArchiveNav.css'

interface IssueArchiveNavProps {
  /** The issue being viewed. */
  issue: IssueRecord
  /** The chronologically previous issue, if one exists. */
  prev?: IssueRecord
  /** The chronologically next issue, if one exists. Omitted on the
   *  latest issue, which renders a "CURRENT ISSUE" sentinel. */
  next?: IssueRecord
  /** Whether this back-catalog URL is actually the current cover.
   *  When true, the nav renders a small "ON STANDS NOW" note so a
   *  reader arriving via the archive knows they're looking at the
   *  live issue. */
  isCurrent?: boolean
}

/**
 * IssueArchiveNav — prev/next navigation for archive pages.
 *
 * Only rendered on /issues/:n, not on the landing. Keeps the
 * "archive browsing" affordance (flip to neighbors, return to the
 * catalog) while the cover above it stays identical to what the
 * landing shows.
 */
export function IssueArchiveNav({ issue, prev, next, isCurrent = false }: IssueArchiveNavProps) {
  return (
    <nav className="pop-archive-nav" aria-label="Issue navigation">
      <div className="pop-archive-nav-inner">

        {/* Top strip: FROM THE ARCHIVE · ISSUE N. Grounds the reader
            in where they are — they came from the catalog, not the
            newsstand. */}
        <div className="pop-archive-nav-head">
          <span className="pop-kicker pop-kicker--tomato">
            {isCurrent ? 'ON STANDS NOW · 最新号' : 'FROM THE ARCHIVE · 過去号'}
          </span>
          <span className="pop-folio pop-archive-nav-folio">
            ISSUE {issue.number} · {issue.month} {issue.year}
          </span>
        </div>

        <hr className="pop-rule pop-rule--tomato" />

        {/* PREV / NEXT row — flipping through bound back catalog. */}
        <div className="pop-archive-nav-row">
          <div className="pop-archive-nav-cell">
            {prev ? (
              <a href={`#/issues/${prev.number}`} className="pop-archive-nav-link">
                <span className="pop-folio">← PREVIOUS</span>
                <span className="pop-archive-nav-issue">
                  ISSUE {prev.number} · {prev.month} {prev.year}
                </span>
                <span className="pop-archive-nav-feature">{prev.feature}</span>
              </a>
            ) : (
              <span className="pop-folio pop-archive-nav-empty">— FIRST ISSUE —</span>
            )}
          </div>

          <div className="pop-archive-nav-cell pop-archive-nav-cell--center">
            <a href="#/issues" className="pop-folio pop-archive-nav-back">
              ALL BACK ISSUES
            </a>
          </div>

          <div className="pop-archive-nav-cell pop-archive-nav-cell--right">
            {next ? (
              <a href={`#/issues/${next.number}`} className="pop-archive-nav-link pop-archive-nav-link--right">
                <span className="pop-folio">NEXT →</span>
                <span className="pop-archive-nav-issue">
                  ISSUE {next.number} · {next.month} {next.year}
                </span>
                <span className="pop-archive-nav-feature">{next.feature}</span>
              </a>
            ) : (
              <span className="pop-folio pop-archive-nav-empty">— CURRENT ISSUE —</span>
            )}
          </div>
        </div>

      </div>
    </nav>
  )
}
