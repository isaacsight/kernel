import type { CSSProperties, ReactNode } from 'react'
import type { IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopIcon } from './ornaments'
import './IssueAccent.css'

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
  // Adaptive accent — either the issue's declared accent (named
  // seed or raw hex) or the spread type's default. Pushed onto
  // the cover root as a CSS custom property; IssueAccent.css
  // derives the five tones from there.
  const accentHex = resolveAccentHex(issue.accent, issue.spread?.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties
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
    <section className={sectionClasses} style={accentStyle}>
      {ornament === 'ink-spread' && <InkSpreadOrnament />}
      {ornament === 'warty-spots' && <WartySpotsOrnament />}
      {ornament === 'flash-burn' && <FlashBurnOrnament />}
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
          <span className="pop-folio">
            <PopIcon name="asterisk" size="sm" className="pop-system-glyph" />
            ISSUE {issue.number} · {issue.month} {issue.year}
          </span>
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

/**
 * WartySpotsOrnament — a drifting field of irregular tomato
 * papillae scattered across the cover. Each spot is hand-tuned
 * (position, radius, slight ellipse skew) so the cluster reads
 * as a specimen's dermis, not a polka-dot pattern. Renders under
 * .pop-cover--ornament-warty-spots.
 */
function WartySpotsOrnament() {
  return (
    <svg
      className="pop-cover-ornament pop-cover-ornament--warty-spots"
      viewBox="0 0 420 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        {/* Upper drift — sparse, the ornament's lightest region */}
        <ellipse cx="58" cy="46" rx="7" ry="6" />
        <ellipse cx="92" cy="78" rx="4" ry="3.5" />
        <ellipse cx="348" cy="62" rx="9" ry="7.5" />
        <ellipse cx="384" cy="104" rx="5" ry="4.5" />
        <ellipse cx="168" cy="52" rx="3" ry="2.5" />
        {/* Mid-cover scatter — behind the headline; kept small
            so type reads cleanly against it */}
        <ellipse cx="32" cy="212" rx="6" ry="5" />
        <ellipse cx="400" cy="198" rx="8" ry="7" />
        <ellipse cx="380" cy="256" rx="4" ry="3.5" />
        <ellipse cx="48" cy="288" rx="5" ry="4" />
        <ellipse cx="402" cy="322" rx="11" ry="9" />
        <ellipse cx="18" cy="358" rx="9" ry="7" />
        {/* Lower field — the cluster intensifies toward the
            bottom edge, reading as warts gathering on the
            belly of the specimen */}
        <ellipse cx="72" cy="430" rx="12" ry="9" />
        <ellipse cx="118" cy="468" rx="6" ry="5" />
        <ellipse cx="156" cy="502" rx="14" ry="11" />
        <ellipse cx="208" cy="478" rx="5" ry="4" />
        <ellipse cx="252" cy="512" rx="9" ry="7" />
        <ellipse cx="296" cy="482" rx="7" ry="6" />
        <ellipse cx="334" cy="518" rx="13" ry="10" />
        <ellipse cx="380" cy="478" rx="6" ry="5" />
        <ellipse cx="402" cy="538" rx="16" ry="12" />
        <ellipse cx="22" cy="498" rx="10" ry="8" />
        {/* Tiny specks — the grain between the larger papillae */}
        <circle cx="142" cy="228" r="1.8" />
        <circle cx="270" cy="268" r="2.2" />
        <circle cx="210" cy="340" r="1.6" />
        <circle cx="330" cy="182" r="2" />
        <circle cx="90" cy="350" r="2.4" />
        <circle cx="368" cy="420" r="2.6" />
        <circle cx="248" cy="430" r="1.8" />
        <circle cx="186" cy="140" r="2" />
      </g>
    </svg>
  )
}

/**
 * FlashBurnOrnament — an overexposed white wedge from the
 * upper-right corner of the cover, with a soft radial falloff
 * into the paper. Reads as a Boiler-Room-style on-camera flash
 * frozen in the moment the shutter opened. Built with a radial
 * gradient (origin in the burnt corner) so the falloff stays
 * smooth on dark stocks. The .pop-cover--ornament-flash-burn
 * rule re-positions the issue monument so the number sits inside
 * the burn as negative ink. Introduced for ISSUE 371.
 */
function FlashBurnOrnament() {
  return (
    <svg
      className="pop-cover-ornament pop-cover-ornament--flash-burn"
      viewBox="0 0 420 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id="pop-flash-burn-gradient"
          cx="100%"
          cy="0%"
          r="85%"
          fx="100%"
          fy="0%"
        >
          {/* Hot core — overexposed white at the corner */}
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          {/* Halo — still bright, beginning to fall off */}
          <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.92" />
          {/* Mid-falloff — translucent veil */}
          <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.55" />
          {/* Outer wash — barely there, ghosts the page */}
          <stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.18" />
          {/* Edge — fully transparent, paper takes over */}
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="420"
        height="560"
        fill="url(#pop-flash-burn-gradient)"
      />
    </svg>
  )
}
