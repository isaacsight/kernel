import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { ALL_ISSUES, findIssue, LATEST_ISSUE } from '../content/issues'
import { IssueCover } from '../components/IssueCover'
import { IssueContents } from '../components/IssueContents'
import { IssueFeature } from '../components/IssueFeature'
import { IssueCredits } from '../components/IssueCredits'
import { IssueColophon } from '../components/IssueColophon'
import { IssueArchiveNav } from '../components/IssueArchiveNav'
// IssueDetailPage shares the cover grammar with the landing. Both
// imports are needed: LandingPage.css owns the cover/layout-variant
// rules; IssueDetailPage.css owns the archive-specific overrides.
import './LandingPage.css'
import './IssueDetailPage.css'

/**
 * IssueDetailPage — permanent URL for any issue, including the
 * current one.
 *
 * Renders the same cover + contents + feature + credits as the
 * landing so the issue's visual identity is preserved at its
 * permanent URL forever. The only difference from the landing is
 * the navigation layer: PREV/NEXT nav at the bottom instead of
 * the landing's PREVIOUSLY strip.
 *
 * When the URL requested IS the latest issue, the archive nav
 * says "ON STANDS NOW" rather than "FROM THE ARCHIVE" so a
 * reader who came in via the back catalog knows they're looking
 * at the live issue.
 */
export function IssueDetailPage() {
  const { number } = useParams<{ number: string }>()

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  if (!number) return <Navigate to="/issues" replace />
  const issue = findIssue(number)
  if (!issue) return <Navigate to="/issues" replace />

  const idx = ALL_ISSUES.findIndex((i) => i.number === issue.number)
  const prev = idx > 0 ? ALL_ISSUES[idx - 1] : undefined
  const next = idx < ALL_ISSUES.length - 1 ? ALL_ISSUES[idx + 1] : undefined
  const isCurrent = issue.number === LATEST_ISSUE.number

  return (
    <div className="pop-landing">

      <IssueCover issue={issue} />

      <IssueContents issue={issue} />

      {issue.spread && <IssueFeature issue={issue} />}

      {issue.credits && <IssueCredits issue={issue} />}

      <IssueArchiveNav issue={issue} prev={prev} next={next} isCurrent={isCurrent} />

      <IssueColophon issue={issue} />

    </div>
  )
}
