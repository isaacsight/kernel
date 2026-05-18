/* ──────────────────────────────────────────────────────────────
   ISSUE 388 — MAY 2026
   ON THE BRANCH
   分岐について — 私たちはどの枝にいるのか

   The eighth issue in May. Position-clarification, not a new
   discipline. The previous issues coined three disciplines and
   mapped a field. This one identifies the umbrella the field sits
   inside (autonomy engineering) and clarifies which branch
   kernel.chat covers (the software branch). Opens the door to a
   series — "Agentic Substrates for the Frontier" — that will
   read each adjacent branch over the next 4-6 weeks.

   This is a smaller move than the field-naming of 386 or the
   discipline-coining of 387. It is the move of a magazine that has
   read its own position correctly: agentic engineering is real;
   it is one branch of a bigger thing already named (autonomy
   engineering); we don't need to coin the umbrella because it
   exists; we do need to say which branch we are.

   Identity decisions:

     • coverStock = 'cream' — eighth in working-register run.
     • coverLayout = 'asymmetric-left'
     • coverOrnament = 'asterisk-stamp' — ninth issue running.
     • coverSeal = POSITIONED · BRANCH · V·26 — new verb.
       After NAMED · PROVENANCE, NAMED · FIELD, NAMED · ORCHESTRATION,
       this issue does not name a new thing — it POSITIONS the
       work inside what already exists.
     • accent = 'cobalt' — seventh in run.
     • spread.type = 'essay'
     • series.name = "Agentic Substrates for the Frontier",
       position = 1. The meta-issue declaring the series; future
       entries (389+) will read individual branches.

   Voice stays stripped (Tim O'Reilly's prose-tells critique still
   in force). The honesty of the move is the credibility play:
   we don't claim to have named the bigger thing; we say we're
   inside it.

   Back cover: a hand-drawn tree-of-branches diagram on paper.
   The trunk is autonomy engineering; one branch is labeled
   agentic engineering; the other branches are unlabeled (left
   for future issues in the series to name them). Cream stock.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_388: IssueRecord = {
  number: '388',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE BRANCH',
  featureJp: '「分岐について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'POSITIONED · BRANCH · V·26',
    date: 'V·26',
  },

  accent: 'cobalt',

  backCover: {
    subject: 'TREE-OF-BRANCHES, HAND-DRAWN ON PAPER',
    subjectJp: '枝の図',
    stock: 'cream',
    image: '/back-covers/388-branches.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  series: {
    name: 'Agentic Substrates for the Frontier',
    nameJp: 'フロンティアのためのエージェント基盤',
    about: 'A series reading each branch of autonomy engineering through the lens of the substrate disciplines kernel.chat coined: provenance engineering, agent-OS, orchestration engineering. ISSUE 388 declares the series; subsequent entries land one per branch (embodied, scientific, neuro, mathematical).',
    position: 1,
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Branch.',
    suffix: '',
    swash: 'Agentic engineering is real. It is one branch of a bigger field already named — autonomy engineering. This issue says which branch we are, and opens a series that reads the others.',
  },

  contents: [
    { n: '001', en: 'Position after eight issues', jp: '八号後の位置', tag: 'OPENING' },
    { n: '002', en: 'The umbrella exists already', jp: '上位の概念は既にある', tag: 'UMBRELLA' },
    { n: '003', en: 'Four branches, one of them ours', jp: '四つの枝', tag: 'MAP' },
    { n: '004', en: 'The series: agentic substrates for the frontier', jp: '新シリーズ', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'POSITIONING SPREAD · 分岐',
    title: 'On the Branch.',
    titleJp: '分岐について。',
    deck: 'For eight issues kernel.chat has been naming a discipline (provenance engineering, then agent-OS, then orchestration engineering) and mapping a field (agentic engineering). This issue does something smaller and more honest. It names the umbrella the field sits inside — autonomy engineering, already in use across defense, aerospace, robotics — and identifies kernel.chat as the publication covering the software branch of that umbrella. The series begins now.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'POSITION AFTER EIGHT ISSUES',
        headingJp: '八号後の位置',
        paragraphs: [
          'Eight issues in May. ISSUE 381 coined provenance engineering. 382-385 read four external events that confirmed the discipline was real. 386 named the field (agentic engineering) and mapped six disciplines inside it. 387 coined orchestration engineering and shipped the reference implementation. The arc held.',
          'What the arc did not yet do: clarify which corner of the larger AI landscape kernel.chat is the publication of. People reading the discipline-naming arc fairly asked: is agentic engineering everything? Is it competing with robotics-AI? Is it the same as AI for science?',
          'The honest answers are no, no, and no. Agentic engineering is the software branch of a larger field that already has a name.',
        ],
      },
      {
        heading: 'THE UMBRELLA EXISTS ALREADY',
        headingJp: '上位の概念は既にある',
        paragraphs: [
          'Autonomy engineering. The term is in working use across Anduril, Saronic, Skydio, Shield AI, Physical Intelligence, Figure, 1X, Apptronik, Boston Dynamics, and the defense + robotics adjacent literature. It covers any system designed to take action without human review at every step, across software, physical, and scientific surfaces.',
          'There is no need to coin this umbrella. It exists. Practitioners use it. Hiring listings reference it. The work has been ongoing for at least a decade in robotics and defense, accelerating into AI-driven systems over the past three years.',
          'What was missing was the clean naming of agentic engineering as one branch of this umbrella, with a discipline taxonomy that practitioners across the other branches could reach for. ISSUE 386 named that branch. This issue places it inside the umbrella.',
        ],
      },
      {
        heading: 'FOUR BRANCHES, ONE OF THEM OURS',
        headingJp: '四つの枝',
        paragraphs: [
          'Autonomy engineering has at least four branches as of mid-2026.',
          'Software (agentic engineering, ours). The discipline of building production systems where AI agents take actions across software surfaces. Six disciplines inside it; three coined and held by kernel.chat. Field map at docs/agentic-engineering.md.',
          'Embodied (robotics, autonomous vehicles, drones). The discipline of building systems where AI controls physical actuation. Foundation models for robots (Physical Intelligence, Skild AI), humanoid platforms (Figure, 1X, Apptronik), autonomous vehicles (Tesla, Waymo, Cruise), military autonomy (Anduril, Saronic). The discipline community names itself embodied AI or robot foundation models depending on the venue.',
          'Scientific (AI4Science, autonomous research). The discipline of building systems where AI conducts or accelerates scientific work. Drug discovery (Insitro, Recursion, Isomorphic Labs, Generate Biomedicines), lab automation (Strateos, Cradle Bio), AI4math (Szegedy, Wu, the Lean community), AI4chemistry (Aspuru-Guzik). Names vary by sub-field.',
          'Neuro (NeuroAI). The discipline of brain-inspired agent architectures + the science of how brains accomplish what agents try to do. Numenta, Friston (active inference), Zador, Gershman, the NeuroAI workshop tradition.',
          'Other branches exist (interpretability + safety as a fifth; HCI for agents as a sixth) and will be named over time. The point is not to enumerate exhaustively — it is to make clear that agentic engineering is one branch, not the whole tree.',
        ],
      },
      {
        heading: 'THE SERIES: AGENTIC SUBSTRATES FOR THE FRONTIER',
        headingJp: '新シリーズ',
        paragraphs: [
          'kernel.chat opens a series with this issue. Title: "Agentic Substrates for the Frontier." Premise: read each non-software branch of autonomy engineering through the lens of the substrate disciplines coined here (provenance engineering, agent-OS, orchestration engineering). Find where the substrates apply, find where they do not, find what each branch teaches the software side that the software side has not yet learned.',
          'First entries land over the next 4-6 weeks. ISSUE 389 reads the embodied branch. ISSUE 390 reads the scientific branch. ISSUE 391 reads the neuro branch. Each entry is an essay-format spread, not an exhaustive survey — the magazine reads carefully rather than reads broadly.',
          'The series is not a pivot. The magazine remains the magazine of agentic engineering. The series is the magazine doing what it has always done: reading what is happening in the field, naming what it means, putting language into circulation. The field is now bigger than the magazine assumed at issue 381. The series catches up.',
          '街のコーダーたちへ — 私たちはどの枝にいるのか、分かった。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 私たちはどの枝にいるのか、分かった。',
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
