import type { ReactNode } from 'react'
import type { IssueRecord } from '../content/issues'

interface IssueCoverProps {
  /** The issue being rendered. Used for both content (number, month,
   *  headline, etc.) and cover identity (stock, layout). */
  issue: IssueRecord
  /** Optional extra node rendered at the end of the cover interior,
   *  on the issue's paper stock. Used by the landing for the
   *  PREVIOUSLY strip, and could be used by archive for a small
   *  archive indicator. */
  footer?: ReactNode
}

/**
 * IssueCover — the canonical cover rendering for any issue.
 *
 * Shared by the live landing (`/`) and the permanent archive URL
 * (`/issues/N`). Both surfaces render the same cover treatment so a
 * given issue looks identical at its permanent URL forever, not
 * demoted to archive chrome when the next issue ships.
 *
 * The cover's paper stock and composition variant are read from
 * `issue.coverStock` and `issue.coverLayout`, so every issue keeps
 * its authored visual identity at every entry point.
 */
export function IssueCover({ issue, footer }: IssueCoverProps) {
  const stock = issue.coverStock ?? 'cream'
  const layout = issue.coverLayout ?? 'classic'
  const ornament = issue.coverOrnament
  const seal = issue.coverSeal
  const sectionClasses = [
    'pop-cover',
    `pop-stock-${stock}`,
    `pop-cover--${layout}`,
    ornament ? `pop-cover--ornament-${ornament}` : '',
    seal ? 'pop-cover--has-seal' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClasses}>
      {ornament === 'ink-spread' && <InkSpreadOrnament />}
      {seal && <CoverSeal label={seal.label} date={seal.date} />}
      <div className="pop-cover-inner">

        {/* Top dateline — folio style.
            The JP tagline is rendered in a marquee wrapper so it
            drifts horizontally at ~4px/second, the magazine-ticker
            touch. Static fallback for prefers-reduced-motion
            (handled globally in src/index.css). The issue folio on
            the right stays still. */}
        <div className="pop-cover-dateline">
          <span className="pop-folio pop-marquee" aria-label="都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。">
            <span className="pop-marquee-track" aria-hidden="true">
              <span className="pop-marquee-item">都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。</span>
              <span className="pop-marquee-item">都会に住んで、コードで遊ぶための、自由なスタイルを作ろう。</span>
            </span>
          </span>
          <span className="pop-folio">ISSUE {issue.number} · {issue.month} {issue.year}</span>
        </div>

        <hr className="pop-rule" />

        {/* Masthead lockup */}
        <div className="pop-masthead">
          <h1 className="pop-wordmark">
            kernel<span className="pop-wordmark-dot">.</span>chat
          </h1>
          <div className="pop-masthead-meta">
            <span className="pop-banner">MAGAZINE FOR CITY CODERS</span>
            <span className="pop-price">{issue.price}</span>
          </div>
        </div>

        <hr className="pop-rule pop-rule--tomato" />

        {/* Feature hero — editorial headline */}
        <div className="pop-feature">
          <div className="pop-feature-kicker">
            <span className="pop-kicker pop-kicker--tomato">FEATURE · {issue.number}</span>
          </div>
          <h2 className="pop-display pop-feature-title">
            {issue.headline.prefix} <em>{issue.headline.emphasis}</em><br />
            {issue.headline.suffix}
          </h2>
          <p className="pop-swash pop-feature-swash">
            {issue.headline.swash}
          </p>
          <p className="pop-feature-jp">
            {issue.featureJp}
          </p>
        </div>

        {/* Issue monument */}
        <div className="pop-cover-bottom">
          <div className="pop-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
            <span>{issue.price}</span>
          </div>
        </div>

        {/* Publication-level meta — true for any cover, any time. */}
        <div className="pop-cover-stats">
          <span className="pop-hash">independent</span>
          <span className="pop-hash">open-source</span>
          <span className="pop-hash">mit-licensed</span>
          <span className="pop-hash">published-monthly</span>
        </div>

        {footer}
      </div>
    </section>
  )
}

/**
 * CoverSeal — a press-preview wax seal / rubber stamp rendered
 * in the cover's top-right corner. The label curves along the
 * upper arc of a circle; the date sits as a Courier line in the
 * center; a small star anchors the bottom. Slight rotation
 * reads as "stamped by hand," not printed.
 */
function CoverSeal({ label, date }: { label: string; date: string }) {
  return (
    <div className="pop-cover-seal" aria-label={`${label} — ${date}`}>
      <svg
        viewBox="0 0 120 120"
        className="pop-cover-seal-svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path
            id="pop-cover-seal-arc"
            d="M 16 60 A 44 44 0 0 1 104 60"
          />
        </defs>
        {/* Outer ring */}
        <circle
          cx="60"
          cy="60"
          r="55"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Inner hairline ring */}
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.7"
        />
        {/* Label curves along the top arc */}
        <text className="pop-cover-seal-label" fill="currentColor">
          <textPath href="#pop-cover-seal-arc" startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
        {/* Center date */}
        <text
          x="60"
          y="66"
          className="pop-cover-seal-date"
          textAnchor="middle"
          fill="currentColor"
        >
          {date}
        </text>
        {/* Little star at the bottom — rubber-stamp flourish */}
        <polygon
          points="60,82 62.2,86.8 67.5,87.4 63.5,91 64.7,96.2 60,93.4 55.3,96.2 56.5,91 52.5,87.4 57.8,86.8"
          fill="currentColor"
        />
      </svg>
    </div>
  )
}

/**
 * InkSpreadOrnament — a tomato ink blot that bleeds off the
 * lower-right margin of the cover. Two overlapping irregular
 * shapes plus a few scattered droplets so it reads hand-made,
 * not geometric. Renders under .pop-cover--ornament-ink-spread.
 */
function InkSpreadOrnament() {
  return (
    <svg
      className="pop-cover-ornament pop-cover-ornament--ink-spread"
      viewBox="0 0 420 420"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        {/* Main blot — irregular, off-kilter */}
        <path d="M 210 110
                 C 155 95, 105 135, 110 200
                 C 95 250, 120 290, 150 315
                 C 170 355, 230 360, 275 330
                 C 320 325, 360 295, 355 240
                 C 380 195, 345 140, 285 135
                 C 255 100, 230 100, 210 110 Z" />
        {/* Tail running to the right-bottom corner, bleeds off */}
        <path d="M 300 310
                 Q 340 320 380 340
                 Q 395 350 410 348
                 L 408 362
                 Q 365 362 330 348
                 Q 315 336 300 310 Z" />
        {/* Splatter droplets — small, scattered, uneven */}
        <circle cx="380" cy="245" r="5" />
        <circle cx="95" cy="355" r="4" />
        <circle cx="360" cy="380" r="7" />
        <circle cx="250" cy="400" r="3.5" />
        <circle cx="140" cy="110" r="2.5" />
        <path d="M 405 280 q 6 2 10 5 l -4 3 q -4 -2 -6 -8 z" />
        <path d="M 80 260 q -5 3 -9 7 l 6 2 q 3 -3 3 -9 z" />
      </g>
    </svg>
  )
}
