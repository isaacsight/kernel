import type { ReactNode } from 'react'
import type { IssueRecord } from '../content/issues'

interface IssueCoverProps {
  /** The issue being rendered. Used for both content (number, month,
   *  headline, etc.) and cover identity (stock, layout). */
  issue: IssueRecord
  /** Optional extra node rendered at the end of the cover interior,
   *  on the issue's paper stock. Used by the landing for the
   *  PREVIOUSLY strip, and could be used by archive for a small
   *  archive indicator. */
  footer?: ReactNode
}

/**
 * IssueCover — the canonical cover rendering for any issue.
 *
 * Shared by the live landing (`/`) and the permanent archive URL
 * (`/issues/N`). Both surfaces render the same cover treatment so a
 * given issue looks identical at its permanent URL forever, not
 * demoted to archive chrome when the next issue ships.
 *
 * The cover's paper stock and composition variant are read from
 * `issue.coverStock` and `issue.coverLayout`, so every issue keeps
 * its authored visual identity at every entry point.
 */
export function IssueCover({ issue, footer }: IssueCoverProps) {
  const stock = issue.coverStock ?? 'cream'
  const layout = issue.coverLayout ?? 'classic'
  const sectionClasses = `pop-cover pop-stock-${stock} pop-cover--${layout}`

  return (
    <section className={sectionClasses}>
      <div className="pop-cover-inner">

        {/* Top dateline — folio style */}
        <div className="pop-cover-dateline">
          <span className="pop-folio">都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。</span>
          <span className="pop-folio">ISSUE {issue.number} · {issue.month} {issue.year}</span>
        </div>

        <hr className="pop-rule" />

        {/* Masthead lockup */}
        <div className="pop-masthead">
          <h1 className="pop-wordmark">
            kernel<span className="pop-wordmark-dot">.</span>chat
          </h1>
          <div className="pop-masthead-meta">
            <span className="pop-banner">MAGAZINE FOR CITY CODERS</span>
            <span className="pop-price">{issue.price}</span>
          </div>
        </div>

        <hr className="pop-rule pop-rule--tomato" />

        {/* Feature hero — editorial headline */}
        <div className="pop-feature">
          <div className="pop-feature-kicker">
            <span className="pop-kicker pop-kicker--tomato">FEATURE · {issue.number}</span>
          </div>
          <h2 className="pop-display pop-feature-title">
            {issue.headline.prefix} <em>{issue.headline.emphasis}</em><br />
            {issue.headline.suffix}
          </h2>
          <p className="pop-swash pop-feature-swash">
            {issue.headline.swash}
          </p>
          <p className="pop-feature-jp">
            {issue.featureJp}
          </p>
        </div>

        {/* Issue monument */}
        <div className="pop-cover-bottom">
          <div className="pop-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
            <span>{issue.price}</span>
          </div>
        </div>

        {/* Publication-level meta — true for any cover, any time. */}
        <div className="pop-cover-stats">
          <span className="pop-hash">independent</span>
          <span className="pop-hash">open-source</span>
          <span className="pop-hash">mit-licensed</span>
          <span className="pop-hash">published-monthly</span>
        </div>

        {footer}
      </div>
    </section>
  )
}
