import { useEffect } from 'react'
import { ISSUE } from '../content/issue'
import { ALL_ISSUES } from '../content/issues'
import { FashionSpread } from '../components/FashionSpread'
import { IssueCredits } from '../components/IssueCredits'
import './LandingPage.css'

/** The most recent issue before the current one — drives the
 *  "PREVIOUSLY" cover strip and helps readers discover the archive. */
const PREVIOUS_ISSUE = ALL_ISSUES[ALL_ISSUES.length - 2]

/* ──────────────────────────────────────────────
   kernel.chat — "A Magazine for City Coders"
   Editorial landing page. Design language is an
   homage to POPEYE Magazine (Tokyo, Magazine
   House) — issue-number monument, bracketed
   categories, numbered catalog, bilingual JP
   lockups, tomato spot color, warm paper stocks.
   See docs/design-language.md for the full spec.
   The site itself never names the inspiration.
   The site is pure editorial — no product
   marketing; no CLI references; no install
   pills. Every visit is the current issue.
   ────────────────────────────────────────────── */

const CONTENTS = ISSUE.contents

export function LandingPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  return (
    <div className="pop-landing">

      {/* ═══════════════════════════════════════════════
          COVER — the Print Object. Loud, warm, editorial.
          Paper stock + layout variant are per-issue so every
          cover reads as its own visual object.
          ═══════════════════════════════════════════════ */}
      <section
        className={`pop-cover pop-stock-${ISSUE.coverStock ?? 'cream'} pop-cover--${ISSUE.coverLayout ?? 'classic'}`}
      >
        <div className="pop-cover-inner">

          {/* Top dateline — folio style */}
          <div className="pop-cover-dateline">
            <span className="pop-folio">都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。</span>
            <span className="pop-folio">ISSUE {ISSUE.number} · {ISSUE.month} {ISSUE.year}</span>
          </div>

          <hr className="pop-rule" />

          {/* Masthead lockup */}
          <div className="pop-masthead">
            <h1 className="pop-wordmark">
              kernel<span className="pop-wordmark-dot">.</span>chat
            </h1>
            <div className="pop-masthead-meta">
              <span className="pop-banner">MAGAZINE FOR CITY CODERS</span>
              <span className="pop-price">{ISSUE.price}</span>
            </div>
          </div>

          <hr className="pop-rule pop-rule--tomato" />

          {/* Feature hero — editorial headline */}
          <div className="pop-feature">
            <div className="pop-feature-kicker">
              <span className="pop-kicker pop-kicker--tomato">FEATURE · {ISSUE.number}</span>
            </div>
            <h2 className="pop-display pop-feature-title">
              {ISSUE.headline.prefix} <em>{ISSUE.headline.emphasis}</em><br />
              {ISSUE.headline.suffix}
            </h2>
            <p className="pop-swash pop-feature-swash">
              {ISSUE.headline.swash}
            </p>
            <p className="pop-feature-jp">
              {ISSUE.featureJp}
            </p>
          </div>

          {/* Issue monument — bottom-right block */}
          <div className="pop-cover-bottom">
            <div className="pop-monument">
              <span>ISSUE</span>
              <strong>{ISSUE.number}</strong>
              <span>{ISSUE.month} {ISSUE.year}</span>
              <span>{ISSUE.price}</span>
            </div>
          </div>

          <div className="pop-cover-stats">
            <span className="pop-hash">independent</span>
            <span className="pop-hash">open-source</span>
            <span className="pop-hash">mit-licensed</span>
            <span className="pop-hash">published-monthly</span>
          </div>

          {PREVIOUS_ISSUE && (
            <a href="#/issues" className="pop-previously">
              <span className="pop-folio">PREVIOUSLY</span>
              <span className="pop-previously-body">
                ISSUE {PREVIOUS_ISSUE.number} · {PREVIOUS_ISSUE.month} {PREVIOUS_ISSUE.year}
                <span className="pop-previously-feature"> · {PREVIOUS_ISSUE.feature}</span>
              </span>
              <span className="pop-folio pop-previously-arrow">SEE BACK CATALOG →</span>
            </a>
          )}
        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          CONTENTS — numbered table of contents
          ═══════════════════════════════════════════════ */}
      <section className="pop-contents pop-stock-ivory">
        <div className="pop-section-inner">

          <header className="pop-section-header">
            <span className="pop-kicker">CONTENTS · 目次</span>
            <hr className="pop-rule pop-rule--short pop-rule--tomato" />
            <h2 className="pop-display pop-section-title">
              In this issue
            </h2>
          </header>

          <ol className="pop-toc">
            {CONTENTS.map((item) => (
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

        </div>
      </section>


      {/* ═══════════════════════════════════════════════
          FEATURE SPREAD — rendered when this issue runs
          a long-form editorial feature. Each issue may
          or may not have one; the template adapts.
          ═══════════════════════════════════════════════ */}
      {ISSUE.spread && <FashionSpread issue={ISSUE} />}


      {/* ═══════════════════════════════════════════════
          MASTHEAD — editorial team credits
          ═══════════════════════════════════════════════ */}
      {ISSUE.credits && <IssueCredits issue={ISSUE} />}


      {/* ═══════════════════════════════════════════════
          COLOPHON — magazine-style footer
          ═══════════════════════════════════════════════ */}
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
              <strong>{ISSUE.number}</strong>
              <span>{ISSUE.month} {ISSUE.year}</span>
            </div>
          </div>

          <hr className="pop-rule pop-rule--soft" />

          <div className="pop-colophon-links">
            <a href="#/issues">Back Issues</a>
            <a href="#/privacy">Privacy</a>
            <a href="#/terms">Terms</a>
          </div>

          <p className="pop-folio pop-colophon-copy">
            MIT · kernel.chat group · Published monthly.
          </p>
        </div>
      </footer>

    </div>
  )
}
