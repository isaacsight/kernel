import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { findIssue } from '../content/issues'
import { IssueCover } from '../components/IssueCover'
import { IssueContents } from '../components/IssueContents'
import { IssueFeature } from '../components/IssueFeature'
import { IssueCredits } from '../components/IssueCredits'
import { IssueColophon } from '../components/IssueColophon'
// Shares the cover/layout grammar with the landing + detail pages;
// LandingPage.css owns the cover variants, PrintIssuePage.css adds the
// page geometry (A5 trim, page breaks, spot-color print fidelity).
import './LandingPage.css'
import './PrintIssuePage.css'

/**
 * PrintIssuePage — the press surface for an issue.
 *
 * Renders the same cover + contents + feature + credits + colophon as
 * the permanent issue URL, but strips every web-only chrome layer (the
 * archive PREV/NEXT nav, scroll affordances) so the page maps cleanly
 * to A5 paper. Consumed by tools/print-issue.ts, which loads this route
 * headless and emits a print-ready PDF.
 *
 * Reachable at #/issues/:number/print.
 */
export function PrintIssuePage() {
  const { number } = useParams<{ number: string }>()

  useEffect(() => {
    document.body.classList.add('ka-print-page')
    return () => { document.body.classList.remove('ka-print-page') }
  }, [])

  if (!number) return <Navigate to="/issues" replace />
  const issue = findIssue(number)
  if (!issue) return <Navigate to="/issues" replace />

  return (
    <div className="pop-print" data-issue={issue.number}>
      <IssueCover issue={issue} />
      <IssueContents issue={issue} />
      {issue.spread && <IssueFeature issue={issue} />}
      {issue.credits && <IssueCredits issue={issue} />}
      <IssueColophon issue={issue} />
    </div>
  )
}
