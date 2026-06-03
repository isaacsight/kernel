/* ──────────────────────────────────────────────────────────────
   ISSUE 393 — JUNE 2026
   OWN THE STACK: SEVEN STAKES ON EDITORIAL TECH
   編集技術 — 借りる道具と、所有する道具

   The companion to 392 (NEVER SELL THE FIXTURES). Where 392 argued
   the shop is not the inventory, 393 turns to the most underrated
   fixture in that shop: editorial technology. The thesis is one
   line — editorial tech you rent is inventory and depreciates; the
   tech you own, that encodes your discipline, is a fixture and
   compounds. Seven stakes carry it, drawn straight from how this
   magazine is actually built: content as typed code, the schema as
   copy editor, derived design (the Ink Cabinet), the audit as
   infrastructure, the agent layer as version-controlled staff, and
   cadence over platform.

   Identity decisions (deliberately distinct from 392 on all five
   axes per PUBLISHING.md §III — 392 was essay / ivory / classic /
   asterisk-stamp / amethyst):
     • spread.type = 'forecast'   — a numbered manifesto. The
       argument IS a list of claims about what editorial tech
       should be, so the forecast tool fits where the essay would
       over-narrate. Template: 370 (SEVEN STAKES FOR 2027).
     • coverStock = 'ink'         — the manifesto / archival /
       nocturnal stock. A declaration filed against a deadline
       wants the dark paper.
     • coverLayout = 'asymmetric-left' — editorial-column rhythm,
       not 370's monument-hero (393 is not a milestone number) and
       not 392's classic.
     • accent = 'cobalt'          — the forecast default; manifesto
       cold clarity, print-blue declaration. Cobalt-on-ink is a
       proven pairing (both introduced together in 371). Distinct
       from 392's amethyst; the manifesto register here is
       universal to any publisher, not kernel.chat-specific.
     • coverSeal                  — a FORECAST filing stamp, as 370
       used. The signature move that replaces 392's asterisk-stamp.

   Voice constraints honored:
     - No "POPEYE" string; grammar carries the homage.
     - Magazine vocabulary (issue / feature / spread / folio).
     - kernel.chat is named in the outro because the stakes are
       drawn from how it is built; the rent-vs-own framing extends
       the 392 fixtures/inventory covenant.
     - The asterisk (★) travels in the kicker and signoff, the
       ratified system glyph — not decoration.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_393: IssueRecord = {
  number: '393',
  month: 'JUNE',
  year: '2026',
  feature: 'OWN THE STACK: SEVEN STAKES ON EDITORIAL TECH',
  featureJp: '編集技術 — 借りる道具と、所有する道具',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ink stock + asymmetric-left layout. The dark
      paper gives a manifesto its filed-against-a-deadline weight;
      the asymmetric column keeps it from competing with 370's
      monument-hero or 392's classic centre. */
  coverStock: 'ink',
  coverLayout: 'asymmetric-left',

  /** Forecast filing stamp, top-right — this is what we believed in
      June 2026 about the technology of editing. Pairs with the ink
      stock to read as a declaration pressed against a deadline. */
  coverSeal: {
    label: 'FORECAST · STACK',
    date: 'VI·26',
  },

  /** Cobalt — the forecast default. Print-blue manifesto clarity;
      a proven pairing on ink. The companion issue 392 used amethyst
      (about kernel.chat itself); 393's argument is universal to any
      publisher, so it stays in the declaration register. */
  accent: 'cobalt',

  headline: {
    prefix: 'Own the',
    emphasis: 'Stack',
    suffix: ', not the Subscription.',
    swash: 'Seven stakes on editorial technology — the tools you rent depreciate; the ones that encode your discipline compound.',
  },

  contents: [
    { n: '001', en: 'Rent is inventory; ownership is a fixture', jp: '借り物は在庫、所有は什器', tag: 'FRAME' },
    { n: '002', en: 'Content as code', jp: 'コードとしての記事', tag: 'METHOD' },
    { n: '003', en: 'The schema is the copy editor', jp: '型が校正する', tag: 'DISCIPLINE' },
    { n: '004', en: 'Derive the design, don’t maintain it', jp: '設計は導出する、保守しない', tag: 'SYSTEMS' },
    { n: '005', en: 'The audit is infrastructure', jp: '監査は基盤', tag: 'TRUST' },
    { n: '006', en: 'Your staff is version-controlled', jp: 'バージョン管理される編集部', tag: 'LABOR' },
    { n: '007', en: 'Cadence over platform', jp: '媒体より、リズム', tag: 'TEMPO' },
  ],

  spread: {
    type: 'forecast',
    kicker: 'THE FORECAST · ★ · 編集技術',
    title: 'Own the Stack.',
    titleJp: 'スタックを所有せよ。',
    deck: 'A companion to last issue’s fixtures-and-inventory argument, pointed at the most underrated fixture of all: the technology you publish on. Seven stakes on why the editorial tech you rent depreciates, and the tech that encodes your discipline compounds.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ink',

    intro: 'Editorial technology is usually shopped for like inventory — a CMS off the shelf, a newsletter tool bolted on, a paywall rented by the month, the platform everyone moved to last spring. All of it depreciates the moment the platform changes its pricing or its politics. The tech worth having is the other kind: the kind you own, that encodes how you work, that compounds with every issue instead of resetting with every migration. Seven stakes follow, drawn from how this magazine is actually built.',

    propositions: [
      {
        n: '01',
        title: 'Rent is inventory; ownership is a fixture.',
        titleJp: '借り物は在庫、所有は什器',
        body: [
          'The same line that governs a business governs its tools. What you rent is inventory — convenient, replaceable, depreciating, owned by someone whose interests are not yours. What you own and that carries your discipline is a fixture — it appreciates with use and it is the reason the work compounds. Rent the convenience; never rent the spine.',
          'The test is simple: if the vendor doubled the price or shut down tomorrow, what would you lose? Lose nothing structural and you rented well. Lose the publication itself and you mistook a fixture for a subscription.',
        ],
      },
      {
        n: '02',
        title: 'Content as code.',
        titleJp: 'コードとしての記事',
        body: [
          'An issue should be a typed object in version control, not a row in a database you rent. When the article is code, the entire apparatus of software becomes editorial apparatus for free — review, history, branching, diffing, one-command rollback. You can see exactly what changed between drafts, who changed it, and undo a bad cut without ceremony.',
          'A magazine that lives in git has a memory no hosted editor can give it. Every issue ever shipped is reproducible from source; every decision has a timestamp and an author. The archive is not a feature you pay for. It is the substrate.',
        ],
      },
      {
        n: '03',
        title: 'The schema is the copy editor.',
        titleJp: '型が校正する',
        body: [
          'If the shape of an issue is a type, the type checker becomes a copy editor that never sleeps and never lets a malformed issue ship. Declare that every issue must name its stock, its layout, its accent, its contents — and the compiler refuses the one that forgets. The discipline stops being a checklist someone might skip and becomes a constraint the build enforces.',
          'Good editorial systems make the wrong thing impossible, not merely discouraged. A house style enforced by a linter is a house style that holds at three in the morning, when the human copy desk has gone home and the standard has to defend itself.',
        ],
      },
      {
        n: '04',
        title: 'Derive the design, don’t maintain it.',
        titleJp: '設計は導出する、保守しない',
        body: [
          'A design system that is hand-maintained is a design system that drifts. Encode the look as derivation instead: one accent seed, five tones computed from it, a per-stock lift so the same ink reads correctly on every paper and in every mode. Change one value and it propagates everywhere at once.',
          'Then guard the inputs — reject the off-key colour before a human has to argue about it. Leverage in editorial tech is one decision touching a hundred surfaces, and a validator that refuses the neon before it ships. The system has the taste so the editor does not have to re-supply it every issue.',
        ],
      },
      {
        n: '05',
        title: 'The audit is infrastructure.',
        titleJp: '監査は基盤',
        body: [
          'Showing your work only scales when the showing is mechanized. The credibility a publication trades on — the reason anyone trusts the number — is a byproduct of tooling that files the evidence automatically: the changelog, the decision record, the commit that cites why and not merely what.',
          'Bolt the audit to the build and trust accrues without anyone having to remember to be honest. Make the honest path the default path, and the default path the only one the pipeline will accept. A publication that cannot show how it knows is a brochure that happens to use footnotes.',
        ],
      },
      {
        n: '06',
        title: 'Your staff is version-controlled.',
        titleJp: 'バージョン管理される編集部',
        body: [
          'The newest fixture in the shop is the agent. A publication’s editorial roles — the line editor, the language reviewer, the designer’s brief — can live as version-controlled instructions, reviewed and improved like any other code in the tree. This is not replacing the editor. It is encoding the editor’s standards so they apply to every issue, on every shift, without fatigue.',
          'The staff you can diff is the staff that does not forget last month’s ruling. When the standard is a file, last month’s hard-won decision is this month’s starting condition, and the publication stops re-litigating itself.',
        ],
      },
      {
        n: '07',
        title: 'Cadence over platform.',
        titleJp: '媒体より、リズム',
        body: [
          'The loudest decision in editorial tech is not which tool you pick — it is how often you ship. A stack that lets you publish monthly without heroics is worth more than the most feature-rich platform you can only wrestle into action twice a year. Choose the tooling that protects the rhythm; refuse the tooling that taxes it.',
          'The platform is replaceable and the cadence is the product. Readers feel the rhythm before they feel any single feature, and a team builds around the rhythm before it builds around anything else. Pick the tools that keep the serial a serial.',
        ],
      },
    ],

    outro: 'None of this is new; all of it had to be re-said, because the default is still to rent. The stakes above are not aspirations here — they are how this issue reached you: a typed object in git, its shape enforced by a compiler, its colour derived from one seed, its evidence filed alongside the code, reviewed by a staff that lives in the repository, on a monthly rhythm the tooling is built to protect. kernel.chat owns its stack the way the last issue said to own a shop. The subscription depreciates. The fixture compounds.',

    signoff: '街のコーダーたちへ ★ own the stack; rent the convenience; never the spine.',
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
