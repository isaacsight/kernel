/* ──────────────────────────────────────────────────────────────
   ISSUE 408 — JUL 2026
   THE LOOP THAT KNOWS WHEN TO STOP
   止まり方を知るループ — 五段階、一つの順序、三つの本当の出口

   The first Sequence — the third interactive shape, reserved and
   unbuilt since interaction-language.md's first draft, built here
   because a real story finally needed it: kbot's engineering loop
   (`packages/kbot/src/engineering-loop.ts`, 29 passing tests, four
   real commits — 2c4e1ba77, 7ccf59846, aa780d3ce, 378e222af). Five
   phases run in a fixed order — plan, act, observe, reflect,
   decide — where each phase's account depends on what the one
   before it produced. Neither built shape fit this material: it is
   not a spectrum with a "medium" between plan and decide (Dial),
   and it is not two readings of one fact set (Compare). It is a
   real process with a real order, forking at the end to one of
   three genuine, mutually exclusive exits.

   Why not another interactivity essay: 407 already named, on the
   record, the temptation to build a needless shape and refused it.
   This issue is the payoff of that refusal — the real story showed
   up four issues later, not manufactured to arrive on schedule.

   Every fact below is verified directly against the source and its
   test file (2026-07-05), not carried over from the 2026-06-30
   design spec unchecked: file paths, function names, the exact
   priority order in `decideExit`, the default budget numbers, and
   the 29/29 test count were all re-read from
   `packages/kbot/src/engineering-loop.ts` and
   `engineering-loop.test.ts` this session, and the test suite was
   re-run rather than assumed green.

   Identity decisions:
     • coverStock = 'cream' — the anchor default. Unlike 405's
       archival-receipt register or 399's lab-bench white, this
       issue's argument is that the loop is now ordinary
       infrastructure, not a special occasion — the workaday
       stock is the honest one.
     • coverLayout = 'classic' — the moving part lives inside the
       spread, per every interactive issue so far.
     • coverSeal = BOUNDED · NOT SILENT · VII·26 — the spec's own
       phrase for the handback exit ("an explicit 'stuck → hand to
       a human' exit, not silent grinding"), promoted to the cover
       because it is the actual thesis: an unattended loop that
       stops for a reason it can name.
     • accent = 'pool' — sequence's own default (systems /
       infrastructure register), used at its own default the same
       way 399 (instrument) and 406 (compare) used their defaults
       at each shape's first instance.
     • spread.type = 'sequence' — five `SequenceStage` entries
       (plan/act/observe/reflect/decide), each carrying a real
       `artifact` line, plus three `SequenceOutcome` entries
       (success/budget/handback) attached to the final stage.

   Identity-catalog row to add to docs/design-language.md:

     | 408 | cream | classic | — | seal: BOUNDED · NOT SILENT · VII·26 | pool | sequence (new) | First Sequence — the third interactive shape, reserved since interaction-language.md's first draft; five ordered stages (plan/act/observe/reflect/decide) over kbot's real engineering loop, forking to three real exits at the final stage | `sequence` spread type (ARIA tablist); ninth editorial tool |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_408: IssueRecord = {
  number: '408',
  month: 'JUL',
  year: '2026',
  feature: 'THE LOOP THAT KNOWS WHEN TO STOP',
  featureJp: '止まり方を知るループ',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'classic',

  coverSeal: {
    label: 'BOUNDED · NOT SILENT',
    date: 'VII·26',
  },

  accent: 'pool',

  headline: {
    prefix: 'The Loop That',
    emphasis: 'Knows',
    suffix: 'When to Stop.',
    swash: 'Five ordered stages, one no-progress counter, three real exits — the interaction law’s reserved third shape, built on kbot’s actual engineering loop.',
  },

  contents: [
    { n: '001', en: 'An analyzer is not a loop', jp: '分析器はループではない', tag: 'METHOD' },
    { n: '002', en: 'Plan — picking the next slice', jp: '計画 — 次の一手を選ぶ', tag: '01' },
    { n: '003', en: 'Act — what it is allowed to touch', jp: '実行 — 触れてよいもの', tag: '02' },
    { n: '004', en: 'Observe — what verify actually says', jp: '観測 — 検証が語ること', tag: '03' },
    { n: '005', en: 'Reflect — when the lesson repeats', jp: '内省 — 教訓が繰り返すとき', tag: '04' },
    { n: '006', en: 'Decide — three real exits', jp: '決定 — 三つの本当の出口', tag: '05' },
    { n: '007', en: 'What the loop does not decide alone', jp: 'ループが一人で決めないこと', tag: 'CLOSING' },
  ],

  spread: {
    type: 'sequence',
    kicker: 'THE SEQUENCE · 手順',
    title: 'The Loop That Knows When to Stop.',
    titleJp: '止まり方を知るループ。',
    deck: 'kbot’s analyzer could scan a repo and report. It could not fix anything, verify anything, or know when to quit trying. This is the loop that gave it all three — five stages in a fixed order, and three real reasons to stop.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    dossier: {
      kicker: 'THE LOOP · ループ',
      note: 'Verified directly against packages/kbot/src/engineering-loop.ts and its test file, 2026-07-05. The test suite was re-run this session, not assumed from the commit history.',
      items: [
        { label: 'FILE', value: 'engineering-loop.ts · 360 lines' },
        { label: 'TESTS', value: '29 PASSING · engineering-loop.test.ts' },
        { label: 'DEFAULT BUDGET', value: '12 ITERATIONS · 20 MIN · 2 NO-PROGRESS' },
        { label: 'EXITS', value: 'SUCCESS · BUDGET · HANDBACK' },
        { label: 'COMMITS', value: '4 — 2c4e1ba7 · 7ccf5984 · aa780d3c · 378e222a' },
      ],
    },

    intro: [
      {
        heading: 'An analyzer is not a loop',
        headingJp: '分析器はループではない',
        paragraphs: [
          'Before this, kbot had `autonomous-contributor.ts`: clone a repo, scan it, emit a one-shot report. It never applied a fix. It never verified one. It never iterated, and so it never needed a principled way to stop, because it never started anything that could grind. Turning that into a real engineering loop meant answering a question the analyzer never had to face: given a goal, a budget, and the ability to actually edit files, how does an unattended process know when it is done, when it has run out of runway, and when it should stop trying and hand the problem to a person instead?',
          'The answer is five phases, run in a fixed order, where each one’s account depends on what the one before it produced — you cannot decide before you observe, and you cannot reflect on a verify result that hasn’t run yet. That dependency is the reason this issue uses the reserved third shape in the interaction cabinet rather than the two already built: it is not a spectrum, and it is not two lenses on one fact set. It is an order.',
        ],
      },
    ],

    stages: [
      {
        id: 'plan',
        label: 'PLAN',
        labelJp: '計画',
        summary: 'Rank real findings, pick the next actionable slice.',
        detail: [
          'The loop does not invent work. Each iteration’s plan phase reuses the existing analyzer as its candidate source, then ranks whatever it returns by a fixed, inspectable rule: severity first — critical before warn before info — and, inside a tier, a simple fix ordered before a complex one. Nothing about the ranking is left to runtime judgment; it is a plain sort over real findings.',
          'Nothing is applied at this stage. Planning narrows the field to one next candidate and files a `plan` decision to the narration channel — a persisted, human-readable record of what the loop is about to try, and why, written before it tries it.',
        ],
        artifact: 'rankFindings() — engineering-loop.ts:145. Order: critical → warn → info; ties broken by isSimpleFix.',
      },
      {
        id: 'act',
        label: 'ACT',
        labelJp: '実行',
        summary: 'Apply the picked fix — or refuse, unconditionally, before it does.',
        detail: [
          'Act is the only phase allowed to touch the working tree, and the boundary is enforced in code, not left to review discipline: every computed edit path is checked against the repository root before anything is written. A path that resolves outside `repoPath` — a symlink escape, a miscomputed relative path, anything — is a hard handback. It is never applied, and the check is covered by its own test rather than trusted to a reviewer noticing.',
          'A finding flagged `critical` severity is refused the same way, before any edit is attempted. The loop does not auto-apply against its own judgment that something is high-stakes. Neither refusal has a confidence threshold that can override it — both are unconditional.',
        ],
        artifact: 'isInsideRepo() — engineering-loop.ts:77. Critical findings and out-of-repo paths both hand back before Act runs; no override.',
      },
      {
        id: 'observe',
        label: 'OBSERVE',
        labelJp: '観測',
        summary: 'Run the repository’s own verify command; capture what it says.',
        detail: [
          'Observe runs whatever the repository’s own tooling considers correct: `detectVerifyCommand` prefers an npm `build` script, falls back to `test` (`npx vitest run`), falls back to `tsc --noEmit` when only a `tsconfig.json` exists, and returns nothing detectable rather than guess at one. If nothing is detectable, the loop refuses to start at all — an engineering loop that cannot observe cannot be trusted to loop unsupervised, so it does not try.',
          'The captured outcome is a plain fact: pass or fail, and which step failed if it didn’t. Reading meaning into that fact is the next phase’s job, not this one’s.',
        ],
        artifact: 'detectVerifyCommand() — engineering-loop.ts:152. build → test → tsc → null (refuses to start).',
      },
      {
        id: 'reflect',
        label: 'REFLECT',
        labelJp: '内省',
        summary: 'When verify is red, ask what the failure teaches — and notice repetition.',
        detail: [
          'Reflection only runs when the observed verify is not green. It calls the existing reflexion machinery for a `lesson` — a natural-language read on why this attempt failed — and that lesson becomes evidence for the decide phase, not just a note left for a human to find later.',
          'The loop’s real discipline sits in one function: a no-progress counter increments when the failing verify step is unchanged from the prior iteration, or when the lesson is byte-identical to the prior iteration’s. Either condition means the loop tried something and got the same wall back. It resets to zero the moment verify actually improves. This is the mechanism that notices a loop is grinding before a person has to.',
        ],
        artifact: 'computeNoProgress() — engineering-loop.ts:88. Increments on same failingStep OR byte-identical lesson; resets on any verify improvement.',
      },
      {
        id: 'decide',
        label: 'DECIDE',
        labelJp: '決定',
        summary: 'Compute the exit — success, handback, or budget, checked in that order.',
        detail: [
          'Decide is a pure function over what the other four phases produced. It checks, in fixed order: is verify green with no targeted findings left (success); has the no-progress counter hit its cap (handback); has the iteration or wall-clock budget run out (budget); otherwise, continue to the next plan. The order is not cosmetic — success is checked first, so a loop that happens to finish on the very iteration it would otherwise have handed back on still exits success, not handback.',
          'Every decision this loop makes — plan, act, decide — is written to the same narration channel the first phase opened. A finished run reads back as a real, ordered account of what happened and why, not a summary composed after the fact.',
        ],
        artifact: 'decideExit() — engineering-loop.ts:101–112. Priority: success → handback (noProgress ≥ cap) → budget (iterations) → budget (wall-clock) → continue.',
      },
    ],

    defaultStage: 'plan',

    outcomes: [
      {
        id: 'success',
        label: 'SUCCESS',
        labelJp: '成功',
        condition: 'verify is green AND no targeted findings remain.',
        result: 'The picked slice is done and the repository verifies clean. The loop stops because the goal was met — not because it ran out of iterations, time, or patience.',
      },
      {
        id: 'budget',
        label: 'BUDGET',
        labelJp: '予算超過',
        condition: 'iteration ≥ 12, or elapsed time ≥ 20 minutes (the default budget).',
        result: 'The loop made real attempts and consumed the runway it was given without finishing. It stops on a limit it was told about in advance, not one it discovers by surprise.',
      },
      {
        id: 'handback',
        label: 'HANDBACK',
        labelJp: '引き継ぎ',
        condition: 'no-progress reaches 2 consecutive iterations, or a risk boundary is crossed (critical finding, out-of-repo edit).',
        result: 'The loop concludes it is stuck, or that the next edit would cross a line it is not allowed to cross alone, and stops with a written summary. This is the explicit “stuck → hand to a human” exit — not silent grinding wearing a green checkmark.',
      },
    ],

    outro: [
      {
        heading: 'What the loop does not decide alone',
        headingJp: 'ループが一人で決めないこと',
        paragraphs: [
          'The loop auto-applies edits by default, and that is the least interesting fact about it. The interesting fact is what it refuses to do regardless of budget: it will not touch a file outside the repository it was given, and it will not auto-apply against a finding it has flagged critical. Neither refusal has an override. And even on its best run — full success, verify green, goal met — the loop does not open a pull request and does not push. Shipping stays a separate, human-initiated step, on purpose, the same discipline this desk holds itself to when it writes an issue: build it, verify it, and let a person decide when it goes out the door.',
          'Issue 407 named the temptation to reach for a third interactive shape simply because two already existed, and refused it. This issue is what refusing that temptation actually bought: a real story showed up on its own schedule, needed an order rather than a spectrum or a switch, and the shape built for it is one the reader can now hold, stage by stage, the same way the loop itself holds its own five phases — in order, each one accountable to the one before it.',
          '街のコーダーたちへ — let the loop stop on purpose; that is the whole point of building one.',
        ],
      },
    ],

    pullQuote: {
      text: 'An engineering loop that cannot observe cannot be trusted to loop unsupervised — so it refuses to start.',
      attribution: 'THE LOOP DESK · 408',
    },

    signoff: '街のコーダーたちへ — let the loop stop on purpose; that is the whole point of building one.',
  },

  audit: {
    drafted: 'magazine-editor · claude-sonnet-5 session, VII·26',
    verified: 'cross-checked directly against packages/kbot/src/engineering-loop.ts and engineering-loop.test.ts, 2026-07-05 — 29/29 tests re-run this session, not assumed from prior commits',
    adherence: 'SequenceSpread — new type, first instance, ARIA tablist per interaction-language.md rule 5; built only once a real ordered-stage story existed (rule 7)',
    readCut: 'kept the exact priority order in decideExit (success checked before handback) rather than simplifying it to "roughly three outcomes"',
    pressed: 'VII·26 · 2026-07-05',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'in-house',
    copy: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}
