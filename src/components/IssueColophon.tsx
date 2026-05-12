import type { IssueRecord } from '../content/issues'
import { MagazineRefusals } from './MagazineRefusals'

interface IssueColophonProps {
  issue: IssueRecord
}

/**
 * IssueColophon — magazine-style footer shared by every surface.
 *
 * Shows the publication wordmark + tagline on the left, the current
 * issue monument on the right, the discovery link row (Back Issues /
 * Privacy / Terms), and a MIT sign-off.
 */
export function IssueColophon({ issue }: IssueColophonProps) {
  return (
    <footer className="pop-colophon pop-stock-ivory">
      <div className="pop-section-inner">
        <hr className="pop-rule" />

        <div className="pop-colophon-row">
          <div className="pop-colophon-masthead">
            <span className="pop-wordmark-sm">kernel<span className="pop-wordmark-dot">.</span>chat</span>
            <span className="pop-folio">MAGAZINE FOR CITY CODERS · 街のコーダーのために</span>
          </div>
          <div className="pop-monument pop-monument--sm">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </div>

        <hr className="pop-rule pop-rule--soft" />

        <MagazineRefusals variant="colophon" />

        <hr className="pop-rule pop-rule--soft" />

        <div className="pop-colophon-links">
          <a href="#/issues">Back Issues</a>
          <a href="#/refusals">The Refusals</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </div>

        <p className="pop-folio pop-colophon-copy">
          MIT · kernel.chat group · Published monthly.
          <br />
          <span className="pop-folio-fine">
            Free because the work it reports on — provenance engineering at <span className="pop-mono">@kernel.chat/kbot-finance</span> — is the thing we sell.
          </span>
        </p>
      </div>
    </footer>
  )
}
