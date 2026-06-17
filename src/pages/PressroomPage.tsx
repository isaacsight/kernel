import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MagazineFrame } from '../components/MagazineFrame'
import { PopIcon } from '../components/ornaments'
import './PressroomPage.css'

/**
 * PressroomPage — the studio project page.
 *
 * Not a feature inside an issue: the design team's own imprint stepping
 * forward, once, on its flagship object. The studio is an AI-native
 * imprint — one director, an agent production floor — whose moat is
 * provenance: every edition is dated, credited, ownable, and the
 * production chain is published rather than hidden.
 *
 * The flagship object is THE PRESS EDITION — ISSUE 360 rendered as a
 * single-spot (tomato) printed magazine. This page reads as the
 * imprint's colophon-manifesto; the printable edition itself lives on
 * the issue route, which the print stylesheet already renders as the
 * tomato-spot press form.
 *
 * Magazine vocabulary throughout: imprint / edition / pressroom /
 * colophon / folio / monument / dateline. Never "portfolio dashboard."
 */

/** Screen → press translation, as a numbered catalog. */
const PROCESS: Array<{ n: string; en: string; jp: string }> = [
  { n: '001', en: 'Freeze the issue — snapshot the data file; a shipped edition is never re-set', jp: '号を凍結する' },
  { n: '002', en: 'Collapse the stocks to paper white; keep tomato as the single spot the press mixes', jp: '紙を白に、特色は朱一色' },
  { n: '003', en: 'Separate — Key holds the type and rules; Spot holds the banners, hairlines and catalog numbers', jp: '版を分ける（墨と特色）' },
  { n: '004', en: 'Impose the A5 booklet — 3 mm bleed, crop marks, reader spreads', jp: 'A5に面付けする' },
  { n: '005', en: 'Proof on uncoated; pull registration; lock overprint and trapping on the spot', jp: '校正・見当・ノセを固定' },
  { n: '006', en: 'Number the run; sign the colophon; publish the production ledger', jp: '番号を打ち、奥付に署名する' },
]

/** The edition specification — the studio's target spec, finalized at proof. */
const SPEC: Array<{ label: string; labelJp?: string; value: string }> = [
  { label: 'Edition', labelJp: '版', value: 'THE PRESS EDITION № 1' },
  { label: 'Source', labelJp: '原号', value: 'ISSUE 360 · THE URBAN OUTDOORS REVIEW' },
  { label: 'Format', labelJp: '判型', value: 'A5 · 148 × 210 mm · saddle-stitched' },
  { label: 'Inks', labelJp: 'インキ', value: 'One spot — Tomato (≈ Riso Fluorescent Orange) + Key' },
  { label: 'Spot ref', labelJp: '特色', value: '#E24E1B — warm red-orange, matched on press' },
  { label: 'Stock', labelJp: '用紙', value: 'Warm uncoated cream · 120 gsm text / 270 gsm cover' },
  { label: 'Bleed', labelJp: '裁ち落とし', value: '3 mm · crop marks · 300 dpi / vector type' },
  { label: 'Binding', labelJp: '製本', value: 'Saddle-stitch, two staples' },
  { label: 'Provenance', labelJp: '来歴', value: 'Numbered run; each copy carries its production ledger' },
]

/** The production floor, named in full — the imprint's whole ethic. */
const LEDGER: Array<{ role: string; roleJp: string; hand: string }> = [
  { role: 'Editorial direction & final cut', roleJp: '編集・最終判断', hand: 'Isaac Hernandez — human' },
  { role: 'Research & drafting', roleJp: '取材・草稿', hand: 'kbot + specialist roster — agent' },
  { role: 'Japanese setting', roleJp: '和文組版', hand: 'kbot editorial — agent' },
  { role: 'Separation & imposition prep', roleJp: '製版・面付け', hand: 'kbot production — agent' },
]

export function PressroomPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  return (
    <MagazineFrame kicker="★ PRESSROOM · 工房" stock="cream">
      <div className="pop-section-inner pressroom">

        {/* Corner registration marks — frame the page as a press sheet. */}
        <div className="pressroom-regmarks" aria-hidden="true">
          <span className="pressroom-regmark pressroom-regmark--tl" />
          <span className="pressroom-regmark pressroom-regmark--tr" />
          <span className="pressroom-regmark pressroom-regmark--bl" />
          <span className="pressroom-regmark pressroom-regmark--br" />
        </div>

        {/* ── Imprint dateline ─────────────────────────────── */}
        <header className="pressroom-imprint">
          <span className="pressroom-imprint-mark">
            <PopIcon name="asterisk" size="sm" className="pop-system-glyph" />
            KERNEL PRESS
          </span>
          <span className="pop-folio pressroom-imprint-jp">工房 · AN AI-NATIVE IMPRINT</span>
        </header>

        {/* ── Hero — the headline printed a hair out of register, so the
              two plates show. The studio's signature gesture. ──────── */}
        <section className="pressroom-hero">
          <h1 className="pressroom-hero-title" data-ghost="The Press Edition.">
            The Press Edition.
          </h1>
          <p className="pressroom-hero-jp">工房版 — 画面から、紙へ</p>
          <p className="pressroom-hero-deck">
            The design team steps forward, once, on its flagship object:
            ISSUE&nbsp;360 pulled off the screen and onto press as a
            single-spot magazine you can hold.
          </p>
        </section>

        {/* ── The two plates — the separation, shown not told. ─────── */}
        <section
          className="pressroom-plates"
          aria-label="Key plate plus spot plate equals the edition"
        >
          <div className="pressroom-plate pressroom-plate--key">
            <span className="pressroom-plate-chip pressroom-plate-chip--key" aria-hidden="true">Aa</span>
            <span className="pressroom-plate-tag">KEY · 墨版</span>
            <span className="pressroom-plate-sub">type &amp; rules</span>
          </div>
          <span className="pressroom-op pressroom-op--plus" aria-hidden="true" />
          <div className="pressroom-plate pressroom-plate--spot">
            <span className="pressroom-plate-chip pressroom-plate-chip--spot" aria-hidden="true" />
            <span className="pressroom-plate-tag">SPOT · 朱版</span>
            <span className="pressroom-plate-sub">tomato · #E24E1B</span>
          </div>
          <span className="pressroom-op pressroom-op--eq" aria-hidden="true" />
          <div className="pressroom-plate pressroom-plate--edition">
            <span className="pressroom-plate-stamp" aria-hidden="true">№001</span>
            <span className="pressroom-plate-tag">THE EDITION · 工房版</span>
            <span className="pressroom-plate-sub">one fold · numbered</span>
          </div>
        </section>

        {/* ── The brief ────────────────────────────────────── */}
        <section className="pressroom-brief">
          <span className="pop-kicker pop-kicker--tomato">THE BRIEF · 趣意</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pressroom-brief-lead">
            The magazine is built on the screen, but it has always been set
            to be <em>held</em>. KERNEL PRESS is the imprint that finishes
            that sentence — a studio of one director and a floor of agents,
            whose discipline is editions, not interfaces.
          </p>
          <p className="pressroom-brief-text">
            Its first object is the anchor issue. ISSUE 360 — cream stock,
            one tomato spot, classic lockup — is the purest statement of the
            house grammar, which makes it the right thing to commit to paper.
            One ink, one fold, numbered. The studio&rsquo;s whole argument,
            pressed once.
          </p>
        </section>

        {/* ── Process — the screen → press translation ─────── */}
        <section className="pressroom-process">
          <span className="pop-kicker pop-kicker--tomato">THE PASS · 工程</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <ol className="pressroom-rows">
            {PROCESS.map((step) => (
              <li key={step.n} className="pressroom-row">
                <span className="pop-catalog-num pressroom-row-n">{step.n}.</span>
                <span className="pressroom-row-body">
                  <span className="pressroom-row-en">{step.en}</span>
                  <span className="pressroom-row-jp">{step.jp}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Specification — the methods sidebar, made the page ─ */}
        <section className="pressroom-spec" aria-label="Edition specification">
          <span className="pop-kicker pop-kicker--tomato">SPECIFICATION · 仕様</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <dl className="pressroom-spec-list">
            {SPEC.map((row) => (
              <div key={row.label} className="pressroom-spec-row">
                <dt className="pressroom-spec-label">
                  <span className="pressroom-spec-label-en">{row.label}</span>
                  {row.labelJp && (
                    <span className="pressroom-spec-label-jp">{row.labelJp}</span>
                  )}
                </dt>
                <dd className="pressroom-spec-value">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="pressroom-spec-note">
            Press matches are finalized at proof. The single-spot discipline
            is load-bearing: tomato is the only colour the press mixes — every
            other ink collapses to key black on separation.
          </p>
        </section>

        {/* ── Provenance ledger — the floor, named ─────────── */}
        <section className="pressroom-ledger">
          <span className="pop-kicker pop-kicker--tomato">PRODUCTION LEDGER · 奥付</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pressroom-ledger-lead">
            The imprint does not hide that the floor is agents. It publishes
            the chain. AI-made is a mark of rigour when the provenance is
            auditable — the same argument ISSUE 390 makes about the consumer
            standard, turned on the studio itself.
          </p>
          <ul className="pressroom-ledger-list">
            {LEDGER.map((entry) => (
              <li key={entry.role} className="pressroom-ledger-row">
                <span className="pressroom-ledger-role">
                  <span className="pressroom-ledger-role-en">{entry.role}</span>
                  <span className="pressroom-ledger-role-jp">{entry.roleJp}</span>
                </span>
                <span className="pressroom-ledger-hand">{entry.hand}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── The artifact — monument + the press action ───── */}
        <section className="pressroom-artifact">
          <div className="pop-monument pressroom-monument">
            <span>PRESS EDITION</span>
            <strong>360</strong>
            <span>CMYK · ¥0 · BYOK</span>
          </div>
          <div className="pressroom-artifact-action">
            <Link to="/issues/360" className="pop-btn primary pressroom-press-btn">
              Open the edition →
            </Link>
            <p className="pressroom-artifact-hint">
              The edition prints from its issue route. Open it, then{' '}
              <span className="pressroom-kbd">Cmd · P</span> — the press
              stylesheet pulls the chrome, holds the type, and keeps tomato
              as the spot.
            </p>
          </div>
        </section>

        {/* ── Back navigation ──────────────────────────────── */}
        <footer className="pressroom-back-nav">
          <Link to="/">← Back to Cover</Link>
          <Link to="/issues">Back Catalog →</Link>
        </footer>

      </div>
    </MagazineFrame>
  )
}
