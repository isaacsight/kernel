import type { CSSProperties } from 'react'
import type { IssueRecord, EssaySpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import './EssayFeature.css'
import './Filmstrip.css'
import './IssueAccent.css'

interface EssayFeatureProps {
  spread: EssaySpread
  issue: IssueRecord
}

/**
 * EssayFeature — long-form prose essay.
 *
 * Editorial tool #1 in the IssueFeature family. Used when the issue
 * is carried by writing: culture, style, field-of-thought pieces.
 * Kicker, title + JP, italic standfirst, byline, sectioned prose
 * with a drop cap on the lead paragraph, a tomato pull-quote, and
 * a signoff. No images.
 */
export function EssayFeature({ spread, issue }: EssayFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'kraft'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  return (
    <section className={`pop-essay ${stockClass}`} style={accentStyle} aria-labelledby="pop-essay-title">
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

        {/* ── Optional dossier: methods-paper abstract card ── */}
        {spread.dossier && (
          <aside className="pop-essay-dossier" aria-label="Abstract">
            <span className="pop-kicker pop-kicker--tomato pop-essay-dossier-kicker">
              {spread.dossier.kicker}
            </span>
            {spread.dossier.note && (
              <p className="pop-essay-dossier-note">{spread.dossier.note}</p>
            )}
            <dl className="pop-essay-dossier-list">
              {spread.dossier.items.map((item, i) => (
                <div key={i} className="pop-essay-dossier-row">
                  <dt className="pop-essay-dossier-label">
                    <span className="pop-essay-dossier-n">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="pop-essay-dossier-label-en">{item.label}</span>
                    {item.labelJp && (
                      <span className="pop-essay-dossier-label-jp">{item.labelJp}</span>
                    )}
                  </dt>
                  <dd className="pop-essay-dossier-value">
                    <span className="pop-essay-dossier-value-en">{item.value}</span>
                    {item.valueJp && (
                      <span className="pop-essay-dossier-value-jp">{item.valueJp}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        )}

        {/* ── Optional cinema strip — sits below the dossier so the
              reader sees the work before reading the prose about
              it. Shared module; classes prefixed `.pop-filmstrip-`
              live in Filmstrip.css. */}
        {spread.filmstrip && (
          <aside
            className="pop-filmstrip"
            aria-label={spread.filmstrip.kicker}
          >
            <div className="pop-filmstrip-head">
              <span className="pop-folio pop-filmstrip-kicker">
                {spread.filmstrip.kicker}
              </span>
              {spread.filmstrip.note && (
                <span className="pop-filmstrip-note">
                  {spread.filmstrip.note}
                </span>
              )}
            </div>
            <ol className="pop-filmstrip-track">
              {spread.filmstrip.frames.map((frame, i) => (
                <li
                  key={i}
                  className={`pop-filmstrip-cell${
                    frame.image ? '' : ' pop-filmstrip-cell--caption-only'
                  }`}
                >
                  <div className="pop-filmstrip-frame">
                    {frame.image ? (
                      <img
                        src={frame.image}
                        alt={`${frame.take} — ${frame.venue}`}
                        loading="lazy"
                      />
                    ) : (
                      <span className="pop-filmstrip-placeholder" aria-hidden="true">
                        ▮
                      </span>
                    )}
                  </div>
                  <p className="pop-folio pop-filmstrip-take">{frame.take}</p>
                  <p className="pop-filmstrip-venue">{frame.venue}</p>
                  <p className="pop-folio pop-filmstrip-date">{frame.date}</p>
                </li>
              ))}
            </ol>
          </aside>
        )}

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

              {/* Optional "by the numbers" data block — mid-essay. */}
              {spread.dataBlock && spread.dataBlock.afterSection === sIdx && (
                <aside className="pop-essay-data" aria-label="By the numbers">
                  <header className="pop-essay-data-head">
                    <span className="pop-kicker pop-kicker--tomato">
                      {spread.dataBlock.kicker}
                    </span>
                    {spread.dataBlock.heading && (
                      <h4 className="pop-essay-data-heading">
                        {spread.dataBlock.heading}
                      </h4>
                    )}
                    {spread.dataBlock.headingJp && (
                      <p className="pop-essay-data-heading-jp">
                        {spread.dataBlock.headingJp}
                      </p>
                    )}
                  </header>
                  <ul className="pop-essay-data-grid">
                    {spread.dataBlock.stats.map((stat, i) => (
                      <li key={i} className="pop-essay-data-stat">
                        <span className="pop-essay-data-n">{stat.n}</span>
                        <span className="pop-essay-data-label">{stat.label}</span>
                        {stat.labelJp && (
                          <span className="pop-essay-data-label-jp">{stat.labelJp}</span>
                        )}
                        {stat.source && (
                          <span className="pop-essay-data-source">— {stat.source}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          ))}
        </article>

        {/* ── Optional works-cited block ───────────────────── */}
        {spread.references && (
          <aside className="pop-essay-refs" aria-label="Works cited">
            <header className="pop-essay-refs-head">
              <span className="pop-kicker pop-kicker--tomato">
                {spread.references.kicker}
              </span>
              {spread.references.note && (
                <p className="pop-essay-refs-note">{spread.references.note}</p>
              )}
            </header>
            <ol className="pop-essay-refs-list">
              {spread.references.items.map((ref, i) => (
                <li key={i} className="pop-essay-refs-item">
                  <span className="pop-essay-refs-n">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="pop-essay-refs-body">
                    <span className="pop-essay-refs-authors">{ref.authors}</span>
                    <span className="pop-essay-refs-year"> ({ref.year}). </span>
                    <span className="pop-essay-refs-title">{ref.title}</span>
                    {ref.journal && (
                      <span className="pop-essay-refs-journal">. {ref.journal}</span>
                    )}
                    <span className="pop-essay-refs-dot">.</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        )}

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
