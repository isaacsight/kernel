import type { IssueRecord, InterviewSpread } from '../content/issues'
import { PopShape } from './ornaments'
import './InterviewFeature.css'
import './Filmstrip.css'

interface InterviewFeatureProps {
  spread: InterviewSpread
  issue: IssueRecord
}

/**
 * InterviewFeature — Q&A profile.
 *
 * Editorial tool #2 in the IssueFeature family. Used when the issue
 * is carried by a subject: a profile of a person (real, fictional,
 * or composite) shaped as an interview. Different rhythm from
 * EssayFeature — the subject dossier up top sets up a person; the
 * Q&A format alternates italic tomato questions with serif answers.
 * Last answer gets a drop cap.
 */
export function InterviewFeature({ spread, issue }: InterviewFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`

  return (
    <section className={`pop-interview ${stockClass}`} aria-labelledby="pop-interview-title">
      <div className="pop-interview-inner">

        {/* ── Interview head ─────────────────────────────── */}
        <header className="pop-interview-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-interview-title" className="pop-display pop-interview-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-interview-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-interview-deck">{spread.deck}</p>
          <p className="pop-folio pop-interview-byline">{spread.byline}</p>
        </header>

        {/* ── Subject dossier — name, role, location card ── */}
        <aside className="pop-interview-subject" aria-label="Interview subject">
          <div className="pop-interview-subject-frame">
            {/* Editorial badge — tomato lozenge in the corner.
                Uses a PopShape primitive (Illustrator layer). */}
            <PopShape
              name="lozenge"
              size="md"
              color="tomato"
              className="pop-interview-subject-badge"
              aria-label="subject badge"
            />
            <span className="pop-folio pop-interview-subject-kicker">THE SUBJECT · 対象</span>
            <h3 className="pop-interview-subject-name">
              {spread.subject.name}
              {spread.subject.nameJp && (
                <span className="pop-interview-subject-name-jp">{spread.subject.nameJp}</span>
              )}
            </h3>
            <div className="pop-interview-subject-meta">
              <span className="pop-interview-subject-role">{spread.subject.role}</span>
              {spread.subject.roleJp && (
                <span className="pop-interview-subject-role-jp">{spread.subject.roleJp}</span>
              )}
            </div>
            <div className="pop-interview-subject-location">
              <span className="pop-folio">LOCATION</span>
              <span className="pop-interview-subject-location-value">{spread.subject.location}</span>
            </div>
          </div>
        </aside>

        {/* ── Intro block (optional) ──────────────────────── */}
        {spread.intro && (
          <p className="pop-interview-intro">{spread.intro}</p>
        )}

        {/* ── Cinema strip (optional, shared module) ──────── */}
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

        <hr className="pop-rule pop-interview-rule" />

        {/* ── Q&A exchanges ──────────────────────────────── */}
        <article className="pop-interview-body">
          {spread.exchanges.map((x, i) => {
            const isLast = i === spread.exchanges.length - 1
            return (
              <div key={i} className="pop-interview-exchange">
                <p className="pop-interview-q">
                  <span className="pop-interview-q-mark" aria-hidden="true">Q.</span>
                  <span className="pop-interview-q-text">{x.q}</span>
                </p>
                <p className={`pop-interview-a${isLast ? ' pop-interview-a--last' : ''}`}>
                  <span className="pop-interview-a-mark" aria-hidden="true">A.</span>
                  <span className="pop-interview-a-text">{x.a}</span>
                </p>
                {!isLast && <hr className="pop-rule pop-rule--soft pop-interview-divider" />}
              </div>
            )
          })}
        </article>

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-interview-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-interview-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-interview-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
