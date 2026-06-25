import { useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { findIssue } from '../content/issues'
import { IssueCover } from '../components/IssueCover'
import { IssueContents } from '../components/IssueContents'
import { IssueColophon } from '../components/IssueColophon'
import './LandingPage.css'
import './LaunchPage.css'

/**
 * LaunchPage — per-issue launch poster.
 *
 * A promotional surface for a single issue: masthead, cover plate,
 * the stakes (contents doing promo duty), one pull quote, and a CTA
 * to the real reading route. One issue, one scroll, one action — a
 * poster, not a publication.
 *
 * Editorial surface: CSS-only motion, token-pure (no raw hex), reuses
 * the real IssueCover / IssueContents / IssueColophon so it stays
 * pixel-true to the issue and drifts from nothing. Spec:
 * docs/issue-launch-microsite.md (Path A — native route).
 */
export function LaunchPage() {
  const { number } = useParams<{ number: string }>()

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  if (!number) return <Navigate to="/issues" replace />
  const issue = findIssue(number)
  if (!issue) return <Navigate to="/issues" replace />

  // The spread is a discriminated union; only some formats carry a
  // pull quote. Narrow with `in` so the poster shows one when present.
  const pullQuote =
    issue.spread && 'pullQuote' in issue.spread ? issue.spread.pullQuote : undefined

  return (
    <div className="pop-landing pop-launch">

      {/* IssueCover already renders the masthead + feature lockup +
          swash; the poster trusts it rather than repeating the title.
          The launch surface's job is the pulled-forward quote and the
          CTA — the promotional cut of the issue. */}
      <IssueCover issue={issue} />

      <IssueContents issue={issue} />

      {pullQuote && (
        <blockquote className="pop-launch__quote">
          <p className="pop-launch__quote-text">{pullQuote.text}</p>
          <cite className="pop-launch__quote-cite">{pullQuote.attribution}</cite>
        </blockquote>
      )}

      <div className="pop-launch__cta-wrap">
        <Link className="pop-launch__cta" to={`/issues/${issue.number}`}>
          Read the issue
          <span className="pop-launch__cta-arrow" aria-hidden="true"> →</span>
        </Link>
      </div>

      <IssueColophon issue={issue} />

    </div>
  )
}
