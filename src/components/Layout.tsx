import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { findIssue } from '../content/issues'

const BASE_TITLE = 'kernel.chat — Magazine for City Coders'

/**
 * Per-route browser title, in the magazine's own vocabulary
 * (issue / feature / archive / pressroom / colophon — never
 * dashboard/panel). Issue routes resolve the feature name from
 * the synchronously-imported content index via findIssue(), so the
 * title is rich even before the lazy page chunk loads.
 */
function titleForPath(pathname: string): string {
  const [head, param, sub] = pathname.split('/').filter(Boolean)
  if (!head) return BASE_TITLE

  const issueLabel = (n?: string) => {
    const issue = n ? findIssue(n) : undefined
    return issue ? `Issue ${issue.number} — ${issue.feature}` : `Issue ${n ?? ''}`.trim()
  }

  switch (head) {
    case 'issues':
      if (!param) return 'The Archive · kernel.chat'
      return sub === 'back'
        ? `${issueLabel(param)} · Back Cover · kernel.chat`
        : `${issueLabel(param)} · kernel.chat`
    case 'launch':
      return `${issueLabel(param)} · Launch · kernel.chat`
    case 'refusals': return 'Refusals · kernel.chat'
    case 'pressroom': return 'The Pressroom · kernel.chat'
    case 'about': return 'About · kernel.chat'
    case 'atelier': return 'The Atelier · kernel.chat'
    case 'privacy': return 'Privacy · kernel.chat'
    case 'terms': return 'Terms · kernel.chat'
    default: return BASE_TITLE
  }
}

export function Layout() {
  const location = useLocation()

  useEffect(() => {
    document.title = titleForPath(location.pathname)
  }, [location.pathname])

  return (
    <>
      <a className="pop-skip-link" href="#feature-well">
        Skip to the feature well
      </a>
      <div className="site-wrapper">
        <main className="site-main" id="feature-well" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  )
}
