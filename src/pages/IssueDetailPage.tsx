import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { MagazineFrame } from '../components/MagazineFrame'
import { FashionSpread } from '../components/FashionSpread'
import { IssueCredits } from '../components/IssueCredits'
import { ALL_ISSUES, findIssue } from '../content/issues'
// Share the cover grammar + layout variants with the live cover.
// Direct loads (e.g. /issues/361) wouldn't otherwise get these
// styles because LandingPage is lazy-loaded.
import './LandingPage.css'
import './IssueDetailPage.css'

/**
 * IssueDetailPage — frozen snapshot of one published issue.
 * Renders the cover (monument, headline, feature swash, JP) plus
 * that issue's table of contents, using the same pop-* primitives
 * as the live cover. Once an issue ships, this page is its
 * permanent address. Adds PREV / NEXT navigation between issues.
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

  // Find prev / next based on chronological order in ALL_ISSUES.
  const idx = ALL_ISSUES.findIndex((i) => i.number === issue.number)
  const prev = idx > 0 ? ALL_ISSUES[idx - 1] : undefined
  const next = idx < ALL_ISSUES.length - 1 ? ALL_ISSUES[idx + 1] : undefined

  const stock = issue.coverStock ?? 'cream'
  const layout = issue.coverLayout ?? 'classic'

  return (
    <MagazineFrame
      kicker={`ARCHIVE · ${issue.month}`}
      stock={stock}
      issue={issue}
    >
      <div className={`pop-issue-detail pop-cover--${layout}`}>

        {/* ── Cover snapshot (mirrors landing's cover grammar).
              MagazineFrame masthead already handles the dateline +
              tagline + folio, so the body skips straight to the
              feature lockup + monument. Layout variant is applied
              to the wrapper so each issue's snapshot reads with the
              same composition as its original cover. ─────────── */}
        <section className="pop-issue-cover">
          <div className="pop-feature pop-issue-feature">
            <div className="pop-feature-kicker">
              <span className="pop-kicker pop-kicker--tomato">FEATURE · {issue.number}</span>
            </div>
            <h1 className="pop-display pop-feature-title">
              {issue.headline.prefix} <em>{issue.headline.emphasis}</em><br />
              {issue.headline.suffix}
            </h1>
            <p className="pop-swash pop-feature-swash">
              {issue.headline.swash}
            </p>
            <p className="pop-feature-jp">
              {issue.featureJp}
            </p>
          </div>

          <hr className="pop-rule pop-rule--tomato" />

          <div className="pop-issue-monument-wrap">
            <div className="pop-monument">
              <span>ISSUE</span>
              <strong>{issue.number}</strong>
              <span>{issue.month} {issue.year}</span>
              <span>{issue.price}</span>
            </div>
          </div>
        </section>

        {/* ── Table of contents — what shipped in this issue ── */}
        <section className="pop-issue-contents">
          <header className="pop-section-header">
            <span className="pop-kicker">CONTENTS · 目次</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">In this issue</h2>
          </header>

          <ol className="pop-toc">
            {issue.contents.map((item) => (
              <li key={item.n} className="pop-row">
                <span className="pop-catalog-num">{item.n}.</span>
                <span className="pop-row-label">
                  {item.en}
                  <span className="pop-row-sub">{item.jp}</span>
                </span>
                <span className="pop-banner pop-banner--kraft">{item.tag}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Optional feature spread — issues that ran a long-form
              editorial feature preserve it here in the archive. ── */}
        {issue.spread && <FashionSpread issue={issue} />}

        {/* ── Optional masthead — editorial team credits. ────── */}
        {issue.credits && <IssueCredits issue={issue} />}

        {/* ── PREV / NEXT navigation ─────────────────────────── */}
        <nav className="pop-issue-nav" aria-label="Issue navigation">
          <div className="pop-issue-nav-cell">
            {prev ? (
              <a href={`#/issues/${prev.number}`} className="pop-issue-nav-link">
                <span className="pop-folio">← PREVIOUS</span>
                <span className="pop-issue-nav-issue">
                  ISSUE {prev.number} · {prev.month} {prev.year}
                </span>
                <span className="pop-issue-nav-feature">{prev.feature}</span>
              </a>
            ) : (
              <span className="pop-folio pop-issue-nav-empty">— FIRST ISSUE —</span>
            )}
          </div>

          <div className="pop-issue-nav-cell pop-issue-nav-cell--center">
            <a href="#/issues" className="pop-folio pop-issue-nav-back">
              ALL BACK ISSUES
            </a>
          </div>

          <div className="pop-issue-nav-cell pop-issue-nav-cell--right">
            {next ? (
              <a href={`#/issues/${next.number}`} className="pop-issue-nav-link pop-issue-nav-link--right">
                <span className="pop-folio">NEXT →</span>
                <span className="pop-issue-nav-issue">
                  ISSUE {next.number} · {next.month} {next.year}
                </span>
                <span className="pop-issue-nav-feature">{next.feature}</span>
              </a>
            ) : (
              <span className="pop-folio pop-issue-nav-empty">— CURRENT ISSUE —</span>
            )}
          </div>
        </nav>

      </div>
    </MagazineFrame>
  )
}
