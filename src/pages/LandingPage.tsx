import { useEffect } from 'react'
import { ISSUE } from '../content/issue'
import { ALL_ISSUES } from '../content/issues'
import { IssueCover } from '../components/IssueCover'
import { IssueContents } from '../components/IssueContents'
import { IssueFeature } from '../components/IssueFeature'
import { IssueCredits } from '../components/IssueCredits'
import { IssueColophon } from '../components/IssueColophon'
import { PreviouslyStrip } from '../components/PreviouslyStrip'
import './LandingPage.css'

/** The most recent issue before the current one — drives the
 *  PREVIOUSLY cover strip. */
const PREVIOUS_ISSUE = ALL_ISSUES[ALL_ISSUES.length - 2]

/* ──────────────────────────────────────────────
   kernel.chat — "A Magazine for City Coders"
   Editorial landing page. Design language is an
   homage to POPEYE Magazine (see docs/design-
   language.md). The site itself never names the
   inspiration.

   The landing shares IssueCover + IssueContents +
   IssueFeature + IssueCredits + IssueColophon
   with /issues/<latest>, so the current issue
   reads identically at its permanent URL. Only
   the nav differs: PreviouslyStrip here,
   IssueArchiveNav over there.
   ────────────────────────────────────────────── */

export function LandingPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  // Canonical URL: the permanent address of the current issue is
  // /issues/<number>. The landing is a convenience alias. Point
  // search engines at the durable URL.
  useEffect(() => {
    const href = `https://kernel.chat/#/issues/${ISSUE.number}`
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    const previousHref = link.href
    link.href = href
    return () => { link!.href = previousHref }
  }, [])

  return (
    <div className="pop-landing">

      <IssueCover
        issue={ISSUE}
        footer={PREVIOUS_ISSUE && <PreviouslyStrip previous={PREVIOUS_ISSUE} />}
      />

      <IssueContents issue={ISSUE} />

      {ISSUE.spread && <IssueFeature issue={ISSUE} />}

      {ISSUE.credits && <IssueCredits issue={ISSUE} />}

      <IssueColophon issue={ISSUE} />

    </div>
  )
}
