import type { CSSProperties } from 'react'
import type { IssueRecord, ReviewSpread, ReviewSubject } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import './ReviewFeature.css'
import './IssueAccent.css'

interface ReviewFeatureProps {
  spread: ReviewSpread
  issue: IssueRecord
}

/**
 * ReviewFeature — graded survey, head-to-head form.
 *
 * Editorial tool #5 in the IssueFeature family. Used when an issue
 * tests N things and commits to a verdict. The grammar is measured:
 * a top-line italic verdict, a numbered rubric (the criteria), an
 * optional standout pull, then a grid of subject cards each carrying
 * a score monument, optional stars, pros, cons, and a per-subject
 * one-line judgment. The reader can stop at the verdict and still
 * have an answer; the grid rewards staying.
 */
export function ReviewFeature({ spread, issue }: ReviewFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  return (
    <section
      className={`pop-review ${stockClass}`}
      style={accentStyle}
      aria-labelledby="pop-review-title"
    >
      <div className="pop-review-inner">

        {/* ── Optional wire-style slug band ───────────────────── */}
        {spread.slug && (
          <div className="pop-review-slug" aria-hidden="true">
            <span>{spread.slug}</span>
            <span>{spread.slug}</span>
            <span>{spread.slug}</span>
          </div>
        )}

        {/* ── Review head ─────────────────────────────────────── */}
        <header className="pop-review-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-review-title" className="pop-display pop-review-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-review-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-review-deck">{spread.deck}</p>
          <p className="pop-folio pop-review-byline">{spread.byline}</p>
        </header>

        {/* ── Top-line verdict — the loudest line ─────────────── */}
        <aside className="pop-review-verdict" aria-label="Verdict">
          <span className="pop-folio pop-review-verdict-kicker">VERDICT · 判定</span>
          <p className="pop-review-verdict-text">{spread.verdict}</p>
        </aside>

        {/* ── Optional standfirst prose ──────────────────────── */}
        {spread.intro && (
          <p className="pop-review-intro">{spread.intro}</p>
        )}

        {/* ── Numbered rubric ────────────────────────────────── */}
        <aside className="pop-review-rubric" aria-label="Criteria">
          <span className="pop-kicker pop-kicker--tomato pop-review-rubric-kicker">
            THE RUBRIC · 評価基準
          </span>
          <dl className="pop-review-rubric-list">
            {spread.criteria.map((c) => (
              <div key={c.n} className="pop-review-rubric-row">
                <dt className="pop-review-rubric-term">
                  <span className="pop-review-rubric-n">{c.n}</span>
                  <span className="pop-review-rubric-label">{c.label}</span>
                  {c.labelJp && (
                    <span className="pop-review-rubric-label-jp">{c.labelJp}</span>
                  )}
                  {c.weight && (
                    <span className="pop-review-rubric-weight">{c.weight}</span>
                  )}
                </dt>
                {c.description && (
                  <dd className="pop-review-rubric-desc">{c.description}</dd>
                )}
              </div>
            ))}
          </dl>
        </aside>

        {/* ── Optional standout award ─────────────────────────── */}
        {spread.standout && (
          <aside className="pop-review-standout" aria-label={spread.standout.label}>
            <span className="pop-folio pop-review-standout-label">
              {spread.standout.label} · 一等賞
            </span>
            <p className="pop-review-standout-name">{spread.standout.subjectName}</p>
            <p className="pop-swash pop-review-standout-reason">
              {spread.standout.reason}
            </p>
          </aside>
        )}

        <hr className="pop-rule pop-review-divider" />

        {/* ── Subject grid — N graded cards ──────────────────── */}
        <ol className="pop-review-grid">
          {spread.subjects.map((s) => (
            <li key={s.rank} className="pop-review-card">
              <SubjectCard subject={s} />
            </li>
          ))}
        </ol>

        {/* ── Optional closing recommendation ─────────────────── */}
        {spread.outro && (
          <p className="pop-review-outro">{spread.outro}</p>
        )}

        {/* ── Sign-off + monument ─────────────────────────────── */}
        <footer className="pop-review-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-review-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-review-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}

interface SubjectCardProps {
  subject: ReviewSubject
}

/**
 * SubjectCard — a single graded entry in the review grid.
 * Rank gutter, score monument, name + read, optional stars, pros/cons
 * columns, optional verdict line. Layout collapses to single column
 * on mobile.
 */
function SubjectCard({ subject }: SubjectCardProps) {
  const rankLabel = String(subject.rank).padStart(2, '0')
  const stars = typeof subject.stars === 'number'
    ? Math.max(0, Math.min(5, Math.round(subject.stars)))
    : null
  return (
    <article className="pop-review-card-inner" aria-labelledby={`subj-${subject.rank}`}>
      <div className="pop-review-card-head">
        <span className="pop-review-card-rank" aria-hidden="true">{rankLabel}</span>
        <div className="pop-review-card-naming">
          <h3 id={`subj-${subject.rank}`} className="pop-review-card-name">
            {subject.name}
          </h3>
          {subject.nameJp && (
            <p className="pop-review-card-name-jp">{subject.nameJp}</p>
          )}
          <p className="pop-review-card-read">{subject.read}</p>
        </div>
        <div className="pop-monument pop-review-card-score" aria-label={`Score ${subject.score}`}>
          <span>SCORE</span>
          <strong>{subject.score}</strong>
        </div>
      </div>

      {(stars !== null || subject.priceLabel || subject.priceBand) && (
        <div className="pop-review-card-meta">
          {stars !== null && (
            <span
              className="pop-review-card-stars"
              role="img"
              aria-label={`${stars} of 5 stars`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i < stars
                      ? 'pop-review-star pop-review-star--on'
                      : 'pop-review-star'
                  }
                  aria-hidden="true"
                />
              ))}
            </span>
          )}
          {subject.priceLabel && (
            <span className="pop-review-card-price">{subject.priceLabel}</span>
          )}
          {subject.priceBand && (
            <span className="pop-review-card-priceband" aria-label={`Price band ${subject.priceBand}`}>
              {subject.priceBand}
            </span>
          )}
        </div>
      )}

      <div className="pop-review-card-cols">
        <section className="pop-review-card-col pop-review-card-col--pros" aria-label="Pros">
          <span className="pop-folio pop-review-card-col-kicker">PROS · 長所</span>
          <ul className="pop-review-card-list">
            {subject.pros.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
        <section className="pop-review-card-col pop-review-card-col--cons" aria-label="Cons">
          <span className="pop-folio pop-review-card-col-kicker">CONS · 短所</span>
          <ul className="pop-review-card-list">
            {subject.cons.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      </div>

      {subject.verdict && (
        <p className="pop-review-card-verdict">{subject.verdict}</p>
      )}
    </article>
  )
}
