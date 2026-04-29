/* ──────────────────────────────────────────────────────────────
   ISSUE 375 — APRIL 2026
   THE SIX BORROWS — A NIGHT'S READING, TYPESET AS CODE
   六つの論文、六つのモジュール — 夜の借り受け

   The credit-page essay for the v5 futures build. On 2026-04-29
   six recent papers were folded into six modules under
   packages/kbot/src/futures/ — about twelve hours, ~1,200 LOC of
   TypeScript, ~400 LOC of tests, and one README that names every
   borrow at the surface where it lives. This issue is not the
   changelog. It is the editorial frame around the borrow.

   The argument: open-source pace works when it is reading
   discipline first and code discipline second. The papers are the
   spine; the night was the typesetting. Magazines have always
   been collage; the magazine's own working method (POPEYE-as-
   spine, the editorial-neighbours catalogue from 370, the steal-
   the-mechanic ethic from 367) is being applied here at the
   source-code level. Six borrows, each named, each credited,
   each module's place in the larger architecture explained.

   Identity decisions:
     • coverStock = 'cream'           — the anchor stock. This is a
       foundational reference issue; it earns the canonical paper.
     • coverLayout = 'monument-hero'  — the issue number 375 IS
       the cover art. The numbered list of six borrows runs as a
       tiny secondary lockup beneath the headline; the contents
       page carries the route in full. (370 used monument-hero
       for the same structural reason — when the serial position
       is itself doing editorial work, hero the number.)
     • coverSeal = CREDITED · SIX BORROWS — names the beat. Reads
       as a librarian's stamp: every borrow logged.
     • NO coverOrnament                — the numbered route IS the
       structure; ornament would crowd it. Restraint, mechanic 6
       from 370.
     • NO POSTMARK DATELINE            — held back per brief.
     • accent = (omit, default tomato) — the magazine's anchor
       accent for an anchor-stock issue. No new register needed
       when the subject is the magazine's own working method.
     • spread.type = 'essay'           — long-form prose, with a
       methods-paper dossier and a works-cited references block.
       The references module is doing structural work this time:
       it is the credit page. The essay's argument lands in the
       footnotes as much as in the body.

   PLACE-AND-ROUTE STRUCTURE — exercised again, this time at the
   references layer. Each borrow has a single route through it:
   paper → module → file. Numbered, six steps. Where 370 routed
   through design propositions, 375 routes through attribution.
   The mechanic is the same; the destination is different.

   Note on borrow #4 — 'forecast/' is the in-house module, the
   one without a paper. It is included on purpose: the borrow
   ethic only reads honestly when the non-borrows are also named
   as such. The catalog tag carries that distinction (BORROW vs
   IN-HOUSE).

   Note on accuracy — the arXiv IDs are real. They are reproduced
   literally here and in the references block; do not edit them
   without checking the V5_FUTURES_PLAN.md and src/futures/README.md
   sources, which are the canonical record.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_375: IssueRecord = {
  number: '375',
  month: 'APRIL',
  year: '2026',
  feature: 'THE SIX BORROWS — A NIGHT’S READING, TYPESET AS CODE',
  featureJp: '六つの論文、六つのモジュール — 夜の借り受け',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream stock + monument-hero. The issue
      number 375 is the cover art; the numbered list of six
      borrows acts as a tiny secondary lockup. Cream is the
      anchor stock, the right paper for an issue about the
      magazine’s own working method applied at the source-code
      level. No ornament — the numbered route is the structure;
      ornament would crowd it. */
  coverStock: 'cream',
  /** Numbered-catalog — monument-hero number paired with a 1–6
      catalog lockup as secondary art. The cover IS the credit
      page. Newly admitted to the cover-layout union alongside
      this issue. */
  coverLayout: 'numbered-catalog',

  /** Librarian’s stamp. Every borrow logged. */
  coverSeal: {
    label: 'CREDITED · SIX BORROWS',
    date: 'IV·26',
  },

  headline: {
    prefix: 'Six Papers,',
    emphasis: 'Six',
    suffix: 'Modules.',
    swash: 'Reading discipline first, code discipline second. A night of borrows, with credit.',
  },

  contents: [
    { n: '001', en: 'The Harness', jp: 'ハーネス', tag: 'BORROW' },
    { n: '002', en: 'The Skill Graph', jp: 'スキルグラフ', tag: 'BORROW' },
    { n: '003', en: 'The Latent Envelope', jp: '潜在状態の封筒', tag: 'BORROW' },
    { n: '004', en: 'The Forecast', jp: '予測モジュール', tag: 'IN-HOUSE' },
    { n: '005', en: 'The Persona', jp: 'ペルソナ', tag: 'BORROW' },
    { n: '006', en: 'The Debate', jp: 'ディベート', tag: 'BORROW' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CREDIT PAGE · ★ · 参照',
    title: 'The Six Borrows.',
    titleJp: '六つの借り受け。',
    deck: 'On 2026-04-29 six recent papers became six modules under packages/kbot/src/futures/ in about twelve hours. This is the credit page — every borrow named, every paper logged, every module’s place in the larger architecture written down in the language of an editorial masthead.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    /** Methods-paper dossier up top — coordinates of the build,
        rendered as if the issue were the abstract page of a
        practice paper. */
    dossier: {
      kicker: 'BUILD · 仕様',
      note: 'Coordinates of the night, as filed for this issue. The substance is downstream of the reading.',
      items: [
        {
          label: 'Subject',
          labelJp: '主題',
          value: 'packages/kbot/src/futures/ — the v5 architectural skeleton.',
        },
        {
          label: 'Window',
          labelJp: '時間',
          value: '~12 hours, 2026-04-29 — drafted from the V5_FUTURES_PLAN.md research session of the same day.',
        },
        {
          label: 'Volume',
          labelJp: '分量',
          value: '~1,200 LOC TypeScript · ~400 LOC tests · 95 tests, deterministic, ~150ms total.',
        },
        {
          label: 'Modules',
          labelJp: 'モジュール',
          value: 'harness · skill-graph · latent-state · forecast · persona · debate.',
        },
        {
          label: 'Sources',
          labelJp: '出典',
          value: 'Five papers (arXiv 2604.21003 · 2604.25727 · 2604.25917 · 2604.25203) plus one industry signal (Cequence Agent Personas, Apr 2026).',
        },
        {
          label: 'In-house',
          labelJp: '自製',
          value: 'forecast/ — the one module without a paper, named as such.',
        },
        {
          label: 'Frame',
          labelJp: '枠組み',
          value: '“Agent = Model + Harness” — Sylph.AI, 2026.',
        },
      ],
    },

    sections: [
      {
        heading: 'OPEN — A SHELF, IN THE READING ROOM',
        headingJp: '開幕 ─ 棚と、読書室',
        paragraphs: [
          'Magazines have always been collage. The shelf in the reading room is what you see when you trust your magazine: not the issue you are holding, but the run of issues behind it, plus the run of other magazines beside that, plus the spines of the monographs the editors keep on the desk. The shelf is the practice. The single issue is just the cross-section the reader sees this month.',
          'This issue makes a quieter version of the same claim about software. On 2026-04-29 six recent papers were folded into six modules under one directory of the kbot codebase, in roughly the time it would take to lay out a single magazine spread. The argument that follows is not that the night was fast. The argument is that the night was reading first and code second, and that this is how open-source pace works when it works.',
          'The papers are the spine. The code was the typesetting. Both are credited here, the way a masthead credits its writers and a colophon credits its press.',
        ],
      },
      {
        heading: 'THE SHELF — SIX PAPERS, BRIEFLY',
        headingJp: '棚 ─ 六つの論文、簡潔に',
        paragraphs: [
          'Six positions on the shelf, in the order the night read them. Each gets one paragraph: title, authors, the single thing it unlocked. None of these summaries does the underlying paper any justice; that is what the works-cited block at the foot of this spread is for. The point of this section is the shelf, not the books.',
          'First — Sylph.AI, “The Last Harness You’ll Ever Build” (arXiv 2604.21003). The frame: an agent is a Model plus a Harness, and the harness is the part that should improve itself. Worker, Evaluator, EvolutionAgent. An inner loop that runs the worker against an evaluator; an outer loop that mutates the harness. The paper is what gave kbot’s long-dormant critic-gate a job. Without an Evaluator role, the critic was a feature flag waiting for a use; with the role, it is the loop’s grading head.',
          'Second — Tencent Hunyuan, “Toward Scalable Terminal Task Synthesis via Skill Graphs” (arXiv 2604.25727). A graph of skills connected by intermediate scenarios; a path through the graph is a synthetic task. The paper is what turned kbot’s flat skill-router into a graph data structure that could sample its own evaluation tasks. Path → Task → run inside the harness loop. The shelf is starting to compose.',
          'Third — Stanford, UIUC, NVIDIA and MIT, “Recursive Multi-Agent Systems” (arXiv 2604.25917). The argument: agents handing off in plain text leak structure that the next agent has to re-derive. A typed envelope that carries either text or a structured payload, with provenance, is the most you can ship today against a future where models support latent-state transfer directly. The paper is what justified writing the envelope before the model side is ready.',
          'Fourth — no paper. The forecast module is in-house, and it is in this list precisely so the borrows can be told from the non-borrows. Linear and exponential projection over signal arrays, joined to the existing growth.ts surface (npm, GitHub, users, tools, traces). The build does not pretend the forecast came from a 2604-prefixed arXiv ID. Listing it here is the credit page being honest about what it owes and what it does not.',
          'Fifth — Cequence Agent Personas, an industry signal from late April 2026 rather than an arXiv paper. Type-checked privilege scoping for agent invocations: per-persona allowlists, args-shape constraints, a maximum blast radius. The signal is what gave kbot’s existing permissions.ts a concept richer than a yes/no gate. Personas are what who-can-do-what looks like when you write it down before a security incident makes you.',
          'Sixth — Plurai, “BARRED: Custom Policy Guardrails via Asymmetric Debate” (arXiv 2604.25203). The recipe: run two LLMs against each other in asymmetric roles, log the rounds, and keep the verdict-plus-rationale tuples as guardrail training data. The paper is what closed the loop on the critic. The critic is feature-flagged off until its false-positive rate is measured; the debate runner is the thing that can produce the dataset to measure it on.',
        ],
      },
      {
        heading: 'THE BORROW, NOT THE IMITATION',
        headingJp: '借り受け、模倣ではなく',
        paragraphs: [
          'The magazine’s working ethic — articulated across issues 367 and 370 — is to steal mechanics, not silence. Pick the move; leave the mood. Carry the structure across; do not cosplay the source. The same ethic transfers cleanly to source code, because source code is, structurally, just another grammar that a working publication borrows from.',
          'For each borrow above, the surface that travelled was an interface, a structure, or a method. The Sylph harness gave kbot the Worker / Evaluator / EvolutionAgent role split — three TypeScript interfaces, an inner-loop function, an outer-loop function. The Hunyuan skill graph gave kbot a typed graph plus a path-sampling function. The Stanford / NVIDIA envelope gave kbot a serializable type with a provenance field and a sha256-hash verification step. The Cequence personas gave kbot a Persona record plus a canInvoke check. The Plurai debate gave kbot an asymmetric runner with an injectable LLM client and a JSONL synthesis pipeline.',
          'What did not travel: the implementations, the model choices, the training pipelines, the rest of each paper. None of the source authors’ own runtime is in this codebase. None of their model weights, none of their evaluation suites, none of their proprietary scaffolding. The borrow took the move and left the silence — the way a magazine borrows the postmark dateline grammar from a wire service without lifting the wire.',
          'A simple test, the same one the magazine uses on its visual borrows: would a reader who knows the source paper recognise the code as borrowed, and would they recognise it as borrowed *honestly*? The answer is yes on both counts when the paper’s arXiv ID lives in the file’s top-of-file comment, and yes on both counts when the README makes the lineage legible at a glance. The borrow is documented at the surface where it lives. That is what makes it a borrow rather than an appropriation.',
        ],
      },
      {
        heading: 'THE NIGHT — WHAT TWELVE HOURS LOOKED LIKE',
        headingJp: '夜 ─ 十二時間の中身',
        paragraphs: [
          'The plan document — V5_FUTURES_PLAN.md — was drafted earlier in the day from the research synthesis. It listed the six modules, the source paper for each, the directory layout, the test strategy, and the deliberate exclusions (no real EvolutionAgent codegen, no recursive MAS latent-thought training, no Terminal-Bench evaluation). The plan came first because the reading came first. The code below it is the answer to the plan.',
          'Six modules went up under packages/kbot/src/futures/, each as its own directory with a types.ts, a small set of pure-function source files, an index.ts barrel, and a *.test.ts file. The harness module came up first because every other module hangs off its loop. The skill-graph module came second because the harness needs Tasks to run. Latent-state, forecast, persona and debate followed in the order that read most cleanly from the plan. Six parallel sub-agents, in the working metaphor: six typesetters laying out six spreads to a shared house style.',
          '~1,200 LOC of TypeScript landed across the night. ~400 LOC of tests landed beside it — 95 tests in total, all deterministic, all stub-driven, all running in roughly 150 milliseconds because not one of them calls a real LLM. The README at src/futures/README.md was the last file written, because a README is a colophon: the page that says where the issue came from, who set the type, and what the next issue will probably be about.',
          'Fast is not the claim. The claim is the order. Reading first, plan second, code third, README fourth — and an arXiv ID in the top of every borrowed module so the lineage is on the file, not in the writer’s head. Research-to-infrastructure pace is fastest when the reading is real, because the reading is what tells you what not to ship. None of the six borrows includes the part of the source paper that would have been a multi-month problem to translate. The plan named those exclusions explicitly. The night honoured them.',
        ],
      },
      {
        heading: 'CREDIT, WRITTEN IN CODE',
        headingJp: '出典 ─ コードに書く',
        paragraphs: [
          'Every module file in src/futures/ carries its source paper at the top, in a block comment that is the file’s first content. The harness directory carries the Sylph arXiv ID; the skill-graph directory carries the Tencent ID; the latent-state directory carries the Stanford / UIUC / NVIDIA / MIT ID; the persona directory carries the Cequence press signal date; the debate directory carries the Plurai ID. The forecast directory carries an explicit “in-house, no source paper” line, because a credit page that does not name its non-borrows is not actually a credit page.',
          'The README at packages/kbot/src/futures/README.md sets the same record at the directory level: a six-row table whose left column is the module, whose middle column is the source, and whose right column is the status. The arXiv URLs are live links. A reader who arrives at the directory before the issue can reconstruct every borrow without ever reading this magazine. That is the right shape for credit. The magazine is editorial; the code is operational; both must say the same thing about who lent what.',
          'The works-cited block at the foot of this spread holds the same six entries again, in the magazine’s own grammar — author, year, title, journal — so the citation reads as a kernel.chat reference and not as a regurgitated arXiv listing. The literal arXiv IDs are reproduced inside the journal field where they belong. Three places, one record. Editorial credit, README credit, file-header credit — the same six borrows, named the same six ways, each at the surface where the relevant reader will encounter them first.',
          'A magazine’s masthead names its writers because credit is editorial. A repository’s comments and references name its sources for the same reason. The two pages are the same page in different stocks. We added both on the same night because the night was, the whole time, an editorial operation.',
        ],
      },
      {
        heading: 'CLOSING — WHY THE CREDIT IS THE SUBSTANCE',
        headingJp: '結び ─ 出典こそが本体',
        paragraphs: [
          'A magazine that does not name its sources is a marketing brochure. A codebase that does not name its sources is a portfolio piece. Neither is a serial. Neither is a working publication. Neither earns the trust that lets the next issue, or the next release, ship without a sales pitch.',
          'The six borrows in src/futures/ name their sources. The README names its sources. This issue names its sources, three places deep, with the live links to follow. None of that is a courtesy to the source authors — it is the working condition of the publication. The borrow is the substance, and the credit is the borrow. The magazine has a masthead because credit is editorial; the codebase has comments and references because credit is operational. Same page, different stocks.',
          'The next issues of kbot — and the next issues of this magazine — will keep doing it the same way. Read first; plan second; build third; credit at every surface where the relevant reader will see it. The shelf in the reading room stays visible. The collage stays a collage. The borrow stays a borrow.',
          '街のコーダーたちへ ★ read the paper before you write the file; cite at the file before you cite anywhere else; the credit page is the substance.',
        ],
      },
    ],

    pullQuote: {
      text: 'The papers are the spine. The code was the typesetting. Both are credited here, the way a masthead credits its writers and a colophon credits its press.',
      attribution: 'KERNEL.CHAT · ON THE WORKING METHOD',
    },

    /** The works-cited block as the credit page proper. Six rows,
        in the order the essay touches them. The arXiv ID lives
        inside the journal field for the five borrows; the in-
        house module carries an explicit no-source line. The route
        is paper → module → file, named in each row. */
    references: {
      kicker: 'CREDIT · 出典',
      note: 'Six borrows, in the order the essay touches them. Each row routes paper → module → file. The fourth is in-house and named as such.',
      items: [
        {
          authors: 'Sylph.AI',
          year: '2026',
          title: 'The Last Harness You’ll Ever Build',
          journal: 'arXiv 2604.21003 → packages/kbot/src/futures/harness/ — Worker, Evaluator, EvolutionAgent; inner loop + outer meta-loop; the role split that finally gave critic-gate.ts a job',
        },
        {
          authors: 'Tencent Hunyuan',
          year: '2026',
          title: 'Toward Scalable Terminal Task Synthesis via Skill Graphs',
          journal: 'arXiv 2604.25727 → packages/kbot/src/futures/skill-graph/ — Skills, Scenarios, Edges; sampled paths produce synthetic evaluation tasks for the harness loop',
        },
        {
          authors: 'Stanford / UIUC / NVIDIA / MIT',
          year: '2026',
          title: 'Recursive Multi-Agent Systems',
          journal: 'arXiv 2604.25917 → packages/kbot/src/futures/latent-state/ — typed envelope with provenance and sha256 verification, written today against a future where models support latent transfer directly',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: 'forecast/ — projections over growth signals',
          journal: 'IN-HOUSE · NO SOURCE PAPER → packages/kbot/src/futures/forecast/ — linear, exponential, and flat projection over npm, GitHub, users, tools and traces, joined to the existing growth.ts surface',
        },
        {
          authors: 'Cequence Security',
          year: '2026',
          title: 'Agent Personas — type-checked privilege scoping for agent invocations',
          journal: 'press signal, April 2026 → packages/kbot/src/futures/persona/ — Persona allowlists, args-shape constraints, blast-radius bounds; runtime check before any tool execution',
        },
        {
          authors: 'Plurai',
          year: '2026',
          title: 'BARRED: Custom Policy Guardrails via Asymmetric Debate',
          journal: 'arXiv 2604.25203 → packages/kbot/src/futures/debate/ — asymmetric runner with injectable LLM client; produces JSONL training tuples for the critic',
        },
        {
          authors: 'kernel.chat group',
          year: '2026',
          title: 'V5_FUTURES_PLAN.md — the plan that drove the night',
          journal: 'packages/kbot/V5_FUTURES_PLAN.md — sequenced module specs and deliberate exclusions; the plan came first because the reading came first',
        },
        {
          authors: 'kernel.chat group',
          year: '2026',
          title: 'futures/README.md — the colophon at the directory level',
          journal: 'packages/kbot/src/futures/README.md — six-row source table with live arXiv links, public API surface, and 95-test footprint',
        },
      ],
    },

    signoff: '街のコーダーたちへ ★ read the paper before you write the file; cite at the file before you cite anywhere else.',
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
