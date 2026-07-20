import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { MagazineFrame } from '../components/MagazineFrame'
import './AtelierPage.css'

/**
 * /atelier — the made-to-order desk.
 *
 * The publication takes commissions: bespoke systems, hardware and
 * software, built the way everything else in this repo was built —
 * in public, evidence-cited, handed over with the audit trail.
 *
 * The page is an experience in the house interaction language, not
 * a brochure. Two calibrated instruments and a writable slip:
 *
 *   1. The commission dial (ARIA radiogroup) — four positions on the
 *      one variable the desk is about: what is being commissioned.
 *   2. The five stages (ARIA tablist) — the ordered process from
 *      letter to handover, each stage complete in itself.
 *   3. The slip (native textarea) — session-only and unrecorded; it
 *      composes the actual letter the visitor posts by mail.
 *
 * Everything stays on the page; print stacks all states.
 */

interface CommissionKind {
  key: string
  name: string
  jp: string
  line: string
  spec: string[]
  proof: string
}

const KINDS: CommissionKind[] = [
  {
    key: 'workstation',
    name: 'THE WORKSTATION',
    jp: '作業台',
    line: 'A machine for working locally — spec’d, sourced, configured, delivered running.',
    spec: [
      'Local-first AI hardware: a rig sized to the models you actually run, not the ones in headlines.',
      'Spec’d against your work, sourced, assembled or configured, and handed over already running.',
      'Ollama / MLX / llama.cpp stack installed, tuned, and documented — the $0-per-token path.',
      'Nothing phones home. The machine is yours the day it arrives.',
      'Parts are invoiced at cost before anything is ordered — the build never carries the hardware bill for you.',
    ],
    proof: 'Proof on file: the local stack this publication runs on — Ollama, LLaDA, MLX — wired and shipped in the open.',
  },
  {
    key: 'instrument',
    name: 'THE INSTRUMENT',
    jp: '道具',
    line: 'A tool that does one job well — a CLI, an agent, an automation, a server.',
    spec: [
      'Custom software built to a fixed brief: command-line tools, specialist agents, MCP servers, pipelines.',
      'BYOK by contract — the instrument never hardcodes a provider; your keys, your choice of model.',
      'Ships with tests, documentation, and the reasoning behind every cut.',
      'MIT-licensed to you unless the brief says otherwise.',
    ],
    proof: 'Proof on file: kbot — one hundred specialty skills on npm, curated from six hundred seventy with a public audit trail.',
  },
  {
    key: 'floor',
    name: 'THE FLOOR',
    jp: '編集部',
    line: 'A working system wired into your actual work — agents, daemons, the whole floor.',
    spec: [
      'An agent floor like the one that produces this magazine, built around your operation instead.',
      'Background daemons for the around-the-clock work; specialist agents for the skilled work.',
      'Wired into the places your work already lives — the channels, the repositories, the drives.',
      'You keep the keys, the logs, and the off switch.',
    ],
    proof: 'Proof on file: this publication — drafted on an agent floor, signed off by hand, chain published.',
  },
  {
    key: 'room',
    name: 'THE ROOM',
    jp: '部屋',
    line: 'Hardware and software together — a studio, an install, a place that works.',
    spec: [
      'The integrated case: machine, software, and setting commissioned as one system.',
      'Music production rigs — Ableton, Serum, Max for Live — wired for the way you actually write.',
      'Production suites for film and media work, from intake to mastered delivery.',
      'Documented so thoroughly you could rebuild the room without me.',
      'Any hardware in the room is invoiced at cost before it is ordered, the same as a standalone workstation.',
    ],
    proof: 'Proof on file: the thirty-two-tool film production suite and the music stack, both shipped and audited in this repository.',
  },
]

interface Stage {
  key: string
  name: string
  jp: string
  body: string
}

const STAGES: Stage[] = [
  {
    key: 'letter',
    name: 'THE LETTER',
    jp: '手紙',
    body: 'You write in. What you do, what keeps not working, what a good year would look like with the system in place. No forms, no calls booked by a robot — a letter, read by a person.',
  },
  {
    key: 'estimate',
    name: 'THE ESTIMATE',
    jp: '見積',
    body: 'I reply with a fixed estimate: what gets built, what it costs, how long it takes, and what is explicitly out of scope. The number does not move after you accept it. No rate card lives on this page because an honest price is quoted against real work, not posted next to a stock photograph.',
  },
  {
    key: 'deposit',
    name: 'THE DEPOSIT',
    jp: '内金',
    body: 'Two lines on the estimate, not one. Hardware and materials are billed at cost and due before anything is ordered — the build never fronts the parts bill on your behalf. Labor is billed half on commission, half on handover. The commission enters the ledger, the bench is booked, and the build begins once the deposit clears.',
  },
  {
    key: 'build',
    name: 'THE BUILD',
    jp: '制作',
    body: 'Built the way this repository is built: in the open with you, evidence-cited, decisions written down as they are made. You see the work while it is work, not just at the unveiling.',
  },
  {
    key: 'handover',
    name: 'THE HANDOVER',
    jp: '引渡',
    body: 'The balance is due when the system is yours: running, documented, and handed over with its audit trail. Your keys, your accounts, your machine. No lock-in, no dependency on me, no subscription wearing a bow. If the build is worth writing about, it may appear in a future issue — anonymized unless you would rather take the byline.',
  },
]

const DESK_ADDRESS = 'kernel.chat@gmail.com'

export function AtelierPage() {
  const [kindIndex, setKindIndex] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const [slip, setSlip] = useState('')

  const kind = KINDS[kindIndex]

  const onDialKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 :
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = (kindIndex + delta + KINDS.length) % KINDS.length
    setKindIndex(next)
    const group = event.currentTarget
    const radios = group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios[next]?.focus()
  }

  const onStagesKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 :
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = (stageIndex + delta + STAGES.length) % STAGES.length
    setStageIndex(next)
    const list = event.currentTarget
    const tabs = list.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[next]?.focus()
  }

  const letterSubject = `ATELIER — ${kind.name}`
  const letterBody = slip.trim()
  const mailHref =
    `mailto:${DESK_ADDRESS}` +
    `?subject=${encodeURIComponent(letterSubject)}` +
    (letterBody ? `&body=${encodeURIComponent(letterBody)}` : '')

  return (
    <MagazineFrame
      kicker="ATELIER"
      title="Made to order."
      titleJp="オーダーメイド"
      deck="The publication takes commissions. Bespoke systems — hardware and software — built the way everything here is built: in the open, evidence-cited, handed over whole."
      stock="cream"
    >
      <div className="pop-section-inner">
        <div className="pop-atelier">

          <p className="pop-atelier-lede">
            Every system in this repository was built for our own work first —
            the agent floor that drafts these pages, the local models that cost
            nothing per token, the production suites, the music rigs. The
            atelier builds one for you. The portfolio is not a highlight reel;
            it is the repository itself, audit trails included.
          </p>

          {/* ── Instrument I — the commission dial ─────────── */}
          <section className="pop-atelier-instrument" aria-labelledby="atelier-dial-head">
            <h2 id="atelier-dial-head">
              <span className="pop-atelier-no">I.</span> What is being commissioned
            </h2>
            <p className="pop-atelier-note">
              Four positions. Turn the dial; the spec sheet follows.
            </p>

            <div
              className="pop-atelier-dial"
              role="radiogroup"
              aria-label="Kind of commission"
              onKeyDown={onDialKey}
            >
              {KINDS.map((k, i) => (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={i === kindIndex}
                  tabIndex={i === kindIndex ? 0 : -1}
                  className={`pop-atelier-stop${i === kindIndex ? ' is-set' : ''}`}
                  onClick={() => setKindIndex(i)}
                >
                  <span className="pop-atelier-stop-name">{k.name}</span>
                  <span className="pop-atelier-stop-jp" lang="ja">{k.jp}</span>
                </button>
              ))}
            </div>

            {KINDS.map((k, i) => (
              <article
                key={k.key}
                className="pop-atelier-spec"
                data-name={k.name}
                hidden={i !== kindIndex}
                aria-label={`${k.name} — spec sheet`}
              >
                <p className="pop-atelier-spec-line">{k.line}</p>
                <ul>
                  {k.spec.map(item => <li key={item}>{item}</li>)}
                </ul>
                <p className="pop-atelier-proof">{k.proof}</p>
              </article>
            ))}
          </section>

          {/* ── Instrument II — the five stages ────────────── */}
          <section className="pop-atelier-instrument" aria-labelledby="atelier-stages-head">
            <h2 id="atelier-stages-head">
              <span className="pop-atelier-no">II.</span> How a commission runs
            </h2>
            <p className="pop-atelier-note">
              Five stages, in order. Each one is complete before the next begins.
            </p>

            <div
              className="pop-atelier-stages"
              role="tablist"
              aria-label="Stages of a commission"
              onKeyDown={onStagesKey}
            >
              {STAGES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  id={`atelier-stage-tab-${s.key}`}
                  aria-selected={i === stageIndex}
                  aria-controls={`atelier-stage-${s.key}`}
                  tabIndex={i === stageIndex ? 0 : -1}
                  className={`pop-atelier-stage${i === stageIndex ? ' is-set' : ''}`}
                  onClick={() => setStageIndex(i)}
                >
                  <span className="pop-atelier-stage-n">{i + 1}</span>
                  <span className="pop-atelier-stage-name">{s.name}</span>
                </button>
              ))}
            </div>

            {STAGES.map((s, i) => (
              <div
                key={s.key}
                id={`atelier-stage-${s.key}`}
                role="tabpanel"
                aria-labelledby={`atelier-stage-tab-${s.key}`}
                className="pop-atelier-stagebody"
                data-name={`${i + 1}. ${s.name}`}
                hidden={i !== stageIndex}
              >
                <p>
                  <span className="pop-atelier-stagejp" lang="ja">{s.jp}</span>
                  {s.body}
                </p>
              </div>
            ))}
          </section>

          {/* ── The slip ───────────────────────────────────── */}
          <section className="pop-atelier-instrument" aria-labelledby="atelier-slip-head">
            <h2 id="atelier-slip-head">
              <span className="pop-atelier-no">III.</span> The slip
            </h2>
            <p className="pop-atelier-note">
              Write the letter here if you like — the slip is session-only and
              unrecorded; nothing leaves this page until you post it. Reload
              erases it.
            </p>

            <div className="pop-atelier-slip">
              <div className="pop-atelier-slip-head">
                <span className="pop-folio">COMMISSION SLIP</span>
                <span className="pop-folio">{kind.name} · <span lang="ja">{kind.jp}</span></span>
              </div>
              <label className="pop-atelier-slip-label" htmlFor="atelier-slip">
                What you do, what keeps not working, and what a good year would
                look like with the system in place:
              </label>
              <textarea
                id="atelier-slip"
                className="pop-atelier-slip-field"
                value={slip}
                onChange={e => setSlip(e.target.value)}
                rows={7}
                spellCheck={false}
              />
              <div className="pop-atelier-slip-foot">
                <span className="pop-folio">TO: {DESK_ADDRESS}</span>
                <a className="pop-atelier-post" href={mailHref}>
                  POST THE LETTER →
                </a>
              </div>
            </div>
          </section>

          {/* ── Standing terms ─────────────────────────────── */}
          <section className="pop-atelier-instrument" aria-labelledby="atelier-terms-head">
            <h2 id="atelier-terms-head">
              <span className="pop-atelier-no">IV.</span> Standing terms
            </h2>
            <ul className="pop-atelier-terms">
              <li>The estimate is fixed before the build begins, and does not move after you accept it.</li>
              <li>Hardware and materials are billed at cost, due before anything is ordered — the build never fronts the parts bill on your behalf.</li>
              <li>Labor is billed half on commission, half on handover.</li>
              <li>You own the result — the machine, the code, the keys, the documentation.</li>
              <li>BYOK everywhere. Nothing in the build ties you to a provider, or to me.</li>
              <li>Every handover ships with its audit trail, the same as every release in this repository.</li>
            </ul>
          </section>

          <div className="pop-atelier-foot">
            <Link to="/" className="pop-folio">← back to the cover</Link>
            <Link to="/about" className="pop-folio">why this exists →</Link>
          </div>

        </div>
      </div>
    </MagazineFrame>
  )
}
