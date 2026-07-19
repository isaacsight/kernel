import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { IssueRecord, SequenceSpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './SequenceFeature.css'
import './IssueAccent.css'

interface SequenceFeatureProps {
  spread: SequenceSpread
  issue: IssueRecord
}

/**
 * SequenceFeature — an ordered argument in discrete, complete stages.
 *
 * Editorial tool #9 in the IssueFeature family, and the magazine's
 * third interactive spread — the reserved shape named in
 * interaction-language.md, built here for the first time (ISSUE
 * 408). Where the Dial holds N positions on one variable and Compare
 * holds two irreducible lenses, Sequence holds a real process that
 * runs in order: each stage's account depends on what happened in
 * the one before it.
 *
 * ARIA pattern: standard Tabs (role="tablist"/"tab"/"tabpanel"),
 * exactly the established behaviour — any stage reachable at any
 * time via click or arrow keys, no forward-lock invented on top of
 * it. The reader here is inspecting a finished, real run (a decision
 * journal), not driving a live process, so jumping straight to the
 * last stage is a legitimate way to read it.
 *
 * Interaction is React state; motion stays CSS-only within the
 * ambient contract. All stage panels remain in the DOM — print
 * shows every stage stacked in order, becoming a numbered table of
 * the whole process on paper.
 */
export function SequenceFeature({ spread, issue }: SequenceFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const [activeId, setActiveId] = useState(
    spread.defaultStage ?? spread.stages[0]?.id,
  )
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(0, spread.stages.findIndex((s) => s.id === activeId))
  const activeStage = spread.stages[activeIndex]
  const railFill = spread.stages.length > 1 ? activeIndex / (spread.stages.length - 1) : 1

  const goToStage = (index: number) => {
    if (index < 0 || index >= spread.stages.length) return
    setActiveId(spread.stages[index].id)
    tabRefs.current[index]?.focus()
  }

  // Standard Tabs keyboard behaviour — arrow keys move both focus
  // and selection; Home/End jump to the ends. No forward-lock: a
  // reader reviewing a finished run may jump anywhere.
  const onTablistKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = Math.min(spread.stages.length - 1, activeIndex + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = Math.max(0, activeIndex - 1)
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = spread.stages.length - 1
    }
    if (next >= 0 && next !== activeIndex) {
      e.preventDefault()
      setActiveId(spread.stages[next].id)
      tabRefs.current[next]?.focus()
    }
  }

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-sequence-section">
        <h3 className="pop-sequence-section-heading">
          {section.heading}
          {section.headingJp && (
            <span className="pop-sequence-section-heading-jp">{section.headingJp}</span>
          )}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-sequence-paragraph">{p}</p>
        ))}
      </section>
    ))

  return (
    <section className={`pop-sequence ${stockClass}`} style={accentStyle} aria-labelledby="pop-sequence-title">
      <div className="pop-sequence-inner">

        {/* ── Head ───────────────────────────────────────── */}
        <header className="pop-sequence-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-sequence-title" className="pop-display pop-sequence-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-sequence-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-sequence-deck">{spread.deck}</p>
          <p className="pop-folio pop-sequence-byline">{spread.byline}</p>
        </header>

        {/* ── The spec — dossier (optional, reused module) ── */}
        {spread.dossier && (
          <aside className="pop-sequence-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-sequence-spec-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-sequence-spec-badge"
                aria-label="spec badge"
              />
              <span className="pop-folio pop-sequence-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-sequence-spec-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-sequence-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-sequence-spec-row">
                    <dt className="pop-folio pop-sequence-spec-label">{item.label}</dt>
                    <dd className="pop-sequence-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {/* ── Intro prose ─────────────────────────────────── */}
        {spread.intro && (
          <article className="pop-sequence-prose">{renderSections(spread.intro)}</article>
        )}

        <hr className="pop-rule pop-sequence-rule" />

        {/* ── THE SEQUENCE ─────────────────────────────────── */}
        <div className="pop-sequence-apparatus">
          <p className="pop-folio pop-sequence-progress" aria-live="polite">
            STAGE {activeIndex + 1} · OF {spread.stages.length}
          </p>

          {/* The rail — a numbered tablist, ordered left to right. */}
          <div
            className="pop-sequence-rail"
            role="tablist"
            aria-label={spread.kicker}
            onKeyDown={onTablistKeyDown}
          >
            <span className="pop-sequence-rail-track" aria-hidden="true" />
            <span
              className="pop-sequence-rail-fill"
              aria-hidden="true"
              style={{ transform: `scaleX(${railFill})` }}
            />
            {spread.stages.map((stage, i) => (
              <button
                key={stage.id}
                ref={(el) => { tabRefs.current[i] = el }}
                type="button"
                role="tab"
                id={`pop-sequence-tab-${stage.id}`}
                aria-selected={stage.id === activeId}
                aria-controls={`pop-sequence-panel-${stage.id}`}
                tabIndex={stage.id === activeId ? 0 : -1}
                className={`pop-sequence-stage${stage.id === activeId ? ' pop-sequence-stage--active' : ''}${i < activeIndex ? ' pop-sequence-stage--past' : ''}`}
                onClick={() => setActiveId(stage.id)}
              >
                <span className="pop-sequence-stage-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="pop-folio pop-sequence-stage-label">{stage.label}</span>
                {stage.labelJp && (
                  <span className="pop-sequence-stage-jp" aria-hidden="true">{stage.labelJp}</span>
                )}
              </button>
            ))}
          </div>

          {activeStage?.summary && (
            <p className="pop-sequence-rail-note" aria-live="polite">{activeStage.summary}</p>
          )}

          {/* Panels — all in the DOM; screen shows only the active
              stage, print stacks every stage in order. */}
          <div className="pop-sequence-panels">
            {spread.stages.map((stage, i) => (
              <section
                key={stage.id}
                id={`pop-sequence-panel-${stage.id}`}
                role="tabpanel"
                aria-labelledby={`pop-sequence-tab-${stage.id}`}
                className={`pop-sequence-panel${stage.id === activeId ? ' pop-sequence-panel--active' : ''}`}
                aria-hidden={stage.id !== activeId}
              >
                {stage.image && (
                  <figure className="pop-sequence-plate">
                    <img
                      src={stage.image}
                      alt={stage.imageAlt ?? ''}
                      loading={i === 0 ? 'eager' : 'lazy'}
                    />
                    {stage.imageCaption && (
                      <figcaption className="pop-folio pop-sequence-plate-caption">
                        PLATE {String(i + 1).padStart(2, '0')} · {stage.imageCaption}
                      </figcaption>
                    )}
                  </figure>
                )}
                <h4 className="pop-folio pop-sequence-panel-head">
                  {String(i + 1).padStart(2, '0')} · {stage.label}
                  {stage.labelJp ? ` · ${stage.labelJp}` : ''}
                </h4>
                {stage.detail.map((p, pi) => (
                  <p key={pi} className="pop-sequence-paragraph">{p}</p>
                ))}
                {stage.artifact && (
                  <p className="pop-sequence-artifact">{stage.artifact}</p>
                )}

                <nav className="pop-sequence-step-nav" aria-label={`Navigate from ${stage.label}`}>
                  <button
                    type="button"
                    className="pop-sequence-step-button"
                    disabled={i === 0}
                    onClick={() => goToStage(i - 1)}
                  >
                    <span aria-hidden="true">←</span>
                    Previous stage
                  </button>
                  <button
                    type="button"
                    className="pop-sequence-step-button"
                    disabled={i === spread.stages.length - 1}
                    onClick={() => goToStage(i + 1)}
                  >
                    Next stage
                    <span aria-hidden="true">→</span>
                  </button>
                </nav>

                {/* The process's real terminal branches — attached
                    to the final stage, always in the DOM, not a
                    separate interactive control. */}
                {i === spread.stages.length - 1 && spread.outcomes && spread.outcomes.length > 0 && (
                  <div className="pop-sequence-outcomes">
                    <span className="pop-folio pop-sequence-outcomes-kicker">
                      THE EXITS · 終着点
                    </span>
                    {spread.outcomes.map((outcome) => (
                      <div key={outcome.id} className="pop-sequence-outcome">
                        <p className="pop-sequence-outcome-label">
                          {outcome.label}
                          {outcome.labelJp && (
                            <span className="pop-sequence-outcome-jp"> · {outcome.labelJp}</span>
                          )}
                        </p>
                        <p className="pop-sequence-outcome-condition">{outcome.condition}</p>
                        <p className="pop-sequence-outcome-result">{outcome.result}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <hr className="pop-rule pop-sequence-rule" />

        {/* ── Outro prose ─────────────────────────────────── */}
        {spread.outro && (
          <article className="pop-sequence-prose">{renderSections(spread.outro)}</article>
        )}

        {/* ── Pull quote (optional) ───────────────────────── */}
        {spread.pullQuote && (
          <blockquote className="pop-sequence-pullquote">
            <p className="pop-sequence-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-sequence-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-sequence-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-sequence-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-sequence-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
