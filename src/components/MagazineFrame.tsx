import type { ReactNode } from 'react'
import { ISSUE } from '../content/issue'
import type { IssueRecord } from '../content/issues'
import './MagazineFrame.css'

interface MagazineFrameProps {
  /** Section kicker, e.g. "PRIVACY", "TERMS", "SECURITY" */
  kicker: string
  /**
   * Display title for this inner page. When omitted, the big editorial
   * head block is skipped — useful for pages that already render their
   * own hero (e.g. SecurityPage, BenchPage).
   */
  title?: string
  /** Japanese subtitle for bilingual lockup */
  titleJp?: string
  /** Optional page number in the issue (shown as folio) */
  page?: number
  /** Optional deck / standfirst paragraph */
  deck?: string
  /** Paper stock for the masthead strip */
  stock?: 'ivory' | 'cream' | 'butter' | 'kraft' | 'ink'
  /** Render on ink ground (for dark inner pages) */
  dark?: boolean
  /**
   * Optional issue override for the masthead. Use on per-issue
   * detail routes (/issues/:n) so the masthead shows the issue
   * being viewed rather than always falling through to LATEST_ISSUE.
   */
  issue?: IssueRecord
  /** Page body */
  children: ReactNode
}

/**
 * MagazineFrame
 * Wraps any inner page with a masthead strip, bilingual section head,
 * and colophon folio — so every route reads like a spread of the same
 * publication as the landing page.
 */
export function MagazineFrame({
  kicker,
  title,
  titleJp,
  page,
  deck,
  stock = 'ivory',
  dark = false,
  issue: issueOverride,
  children,
}: MagazineFrameProps) {
  const stockClass = `pop-stock-${stock}`
  const issue = issueOverride ?? ISSUE
  const folio = page === undefined ? kicker : `${kicker} · P. ${String(page).padStart(2, '0')}`

  const goHome = () => {
    window.location.hash = '#/'
  }

  return (
    <div className={`pop-frame${dark ? ' pop-frame--dark' : ''}`}>
      {/* ── Masthead strip ───────────────────────────────── */}
      <header className={`pop-frame-masthead ${stockClass}`}>
        <div className="pop-frame-inner">
          <div className="pop-frame-row">
            <button
              type="button"
              className="pop-frame-brand"
              onClick={goHome}
              aria-label="Return to cover"
            >
              <span className="pop-wordmark-sm">
                kernel<span className="pop-wordmark-dot">.</span>chat
              </span>
              <span className="pop-folio">{issue.tagline}</span>
            </button>
            <div className="pop-frame-issue">
              <span className="pop-folio">
                ISSUE {issue.number} · {issue.month} {issue.year}
              </span>
              <span className="pop-folio pop-frame-folio">{folio}</span>
            </div>
          </div>

          <hr className="pop-rule pop-rule--tomato" />

          {title && (
            <div className="pop-frame-head">
              <span className="pop-kicker pop-kicker--tomato">{kicker} · 目次</span>
              <h1 className="pop-display pop-frame-title">{title}</h1>
              {titleJp && <p className="pop-frame-title-jp">{titleJp}</p>}
              {deck && <p className="pop-swash pop-frame-deck">{deck}</p>}
            </div>
          )}
        </div>
      </header>

      {/* ── Page body ────────────────────────────────────── */}
      <div className="pop-frame-body">
        {children}
      </div>

      {/* ── Folio footer ─────────────────────────────────── */}
      <footer className="pop-frame-footer">
        <div className="pop-frame-inner">
          <hr className="pop-rule pop-rule--soft" />
          <div className="pop-frame-row pop-frame-footer-row">
            <span className="pop-folio">
              {ISSUE.tagline}
            </span>
            <div className="pop-frame-footer-actions">
              <button
                type="button"
                className="pop-folio pop-frame-back"
                onClick={goHome}
              >
                ← BACK TO COVER
              </button>
              <a href="#/issues" className="pop-folio pop-frame-back pop-frame-back--alt">
                ISSUES →
              </a>
            </div>
            <span className="pop-folio">
              ISSUE {ISSUE.number} · {ISSUE.month} {ISSUE.year}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
