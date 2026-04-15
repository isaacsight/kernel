import type { IssueRecord } from '../content/issues'
import './FashionSpread.css'

interface FashionSpreadProps {
  issue: IssueRecord
}

/**
 * FashionSpread — long-form editorial feature, text only.
 * Used by issues that set a `spread` field on IssueRecord.
 * Renders as a proper magazine essay: kicker, title + JP, italic
 * standfirst, byline, sectioned prose with a drop cap on the first
 * paragraph, a tomato pull-quote, and a signoff. No images.
 */
export function FashionSpread({ issue }: FashionSpreadProps) {
  if (!issue.spread) return null
  const { spread } = issue
  const stockClass = `pop-stock-${spread.stock ?? 'kraft'}`

  return (
    <section className={`pop-essay ${stockClass}`} aria-labelledby="pop-essay-title">
      <div className="pop-essay-inner">

        {/* ── Essay head ──────────────────────────────────── */}
        <header className="pop-essay-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-essay-title" className="pop-display pop-essay-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-essay-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-essay-deck">{spread.deck}</p>
          <p className="pop-folio pop-essay-byline">{spread.byline}</p>
        </header>

        <hr className="pop-rule pop-essay-rule" />

        {/* ── Body ────────────────────────────────────────── */}
        <article className="pop-essay-body">
          {spread.sections.map((section, sIdx) => (
            <div key={section.heading} className="pop-essay-section">
              <h3 className="pop-essay-section-head">
                <span className="pop-essay-section-head-en">{section.heading}</span>
                {section.headingJp && (
                  <span className="pop-essay-section-head-jp">{section.headingJp}</span>
                )}
              </h3>
              {section.paragraphs.map((para, pIdx) => {
                const isFirst = sIdx === 0 && pIdx === 0
                return (
                  <p
                    key={pIdx}
                    className={`pop-essay-para${isFirst ? ' pop-essay-para--lead' : ''}`}
                  >
                    {para}
                  </p>
                )
              })}

              {/* Insert pull quote after the second section for visual rhythm. */}
              {sIdx === 1 && spread.pullQuote && (
                <aside className="pop-essay-pullquote">
                  <p className="pop-essay-pullquote-text">
                    &ldquo;{spread.pullQuote.text}&rdquo;
                  </p>
                  <p className="pop-folio pop-essay-pullquote-attr">
                    {spread.pullQuote.attribution}
                  </p>
                </aside>
              )}
            </div>
          ))}
        </article>

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-essay-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-essay-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-essay-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
