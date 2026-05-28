/* ──────────────────────────────────────────────────────────────
   ISSUE 391 — MAY 2026
   THE WEEK THE ASSISTANT BECAME AN ACTOR
   助手が動き手になった週 — 五月末の電信

   The second dispatch-format issue (368 was the first, the night
   Anthropic Labs shipped Claude Design). 390 closed the third
   entry of "Agentic Substrates for the Frontier" by reading the
   substrate reaching the consumer surface. 391 steps out of the
   series for a wire filing: a single week of late May 2026 in
   which the field's centre of gravity visibly moved from "the
   model answers" to "the model acts" — across math, products,
   money, and governance at once.

   Why dispatch and not essay: the material is dated, plural, and
   reactive. No single argument; seven stakes filed against a
   deadline, each tied to a thing that actually shipped or landed
   between 5 and 23 May. The dispatch grammar — wire-slug marquee,
   dateline, FILED/STATUS dossier, checkbox numbering, mid-spread
   bulletin, bridge to the preceding issue, AP terminator — is the
   right tool for a week-in-review that wants to read as a serial,
   not a feed.

   Identity decisions:

     • coverStock = 'ivory' — press-preview white, the paper a
       wire filing arrives printed on. Last used for a dispatch in
       368; the pairing is the dispatch register.
     • coverLayout = 'asymmetric-left' — a bulletin filed on
       deadline, left-aligned column rhythm.
     • coverOrnament = 'ink-spread' — dispatch-exclusive; the
       tomato blot literalises the swash ("the ink is still wet").
       Deliberately breaks the asterisk-stamp run (374–390) to mark
       this issue as a wire filing, not a fieldwork read.
     • coverSeal = FILED · WIRE · V·26.
     • coverPostmark = THE WIRE DESK · V·26 — the honest dateline
       is the desk and the week, not a city.
     • accent = 'brick' — the dispatch default; wire, archival,
       printed-today red.
     • spread.type = 'dispatch'.

   Sources are cited in the prose at the surface where the reader
   meets each claim (companies and products named explicitly, per
   the dispatch contract). This is a fast filing: some of it will
   read differently by August. That is the nature of a wire.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_391: IssueRecord = {
  number: '391',
  month: 'MAY',
  year: '2026',
  feature: 'THE WEEK THE ASSISTANT BECAME AN ACTOR',
  featureJp: '助手が動き手になった週',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'ink-spread',

  coverSeal: {
    label: 'FILED · WIRE · V·26',
    date: 'V·26',
  },

  coverPostmark: {
    place: 'THE WIRE DESK',
    date: 'V·26',
  },

  accent: 'brick',

  backCover: {
    subject: 'TELETYPE PLATEN, RIBBON STILL WET',
    subjectJp: '電信機の圧盤',
    stock: 'ivory',
    image: '/back-covers/391-teletype.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'The Week the',
    emphasis: 'Assistant',
    suffix: 'Became an Actor.',
    swash: 'Seven stakes from a single late-May week — the field moves from answering to acting. The ink is still wet.',
  },

  contents: [
    { n: '001', en: 'The machine proved a theorem', jp: '機械が定理を証明した', tag: 'FIELD' },
    { n: '002', en: 'A new floor for the default', jp: '既定の新しい床', tag: 'MODELS' },
    { n: '003', en: 'Gemini learned to act', jp: 'ジェミニ、動くことを覚える', tag: 'AGENTS' },
    { n: '004', en: 'The ad arrives inside the answer', jp: '回答の中の広告', tag: 'MONEY' },
    { n: '005', en: 'Anthropic buys the toolmaker, funds the field', jp: '工具屋を買い、土地に出資する', tag: 'CAPITAL' },
    { n: '006', en: 'The regulators got a key', jp: '規制側が鍵を得た', tag: 'GOVERNANCE' },
    { n: '007', en: 'What stays scarce', jp: '残る希少', tag: 'TASTE' },
  ],

  spread: {
    type: 'dispatch',
    kicker: 'DISPATCH · 速報',
    title: 'The Week the Assistant Became an Actor.',
    titleJp: '助手が動き手になった週。',
    deck: 'Seven stakes filed against a single week of late May 2026, when the field’s centre of gravity moved — visibly, across four fronts at once — from a machine that answers to a machine that acts. What shipped, who should be watching, and the one thing the week did not make cheaper.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    slug: 'KERNEL.CHAT WIRE · 391 · V·26 · WEEK-IN-REVIEW · INK WET · THE FIELD ACTED',

    dateline: 'THE WIRE DESK — MAY 28 — FILED AT THE CLOSE OF THE WEEK.',

    filedAt: '28 MAY 2026 · WEEK OF 18–24 MAY',
    status: 'INK WET',

    /** The week’s players, triangulated. */
    partners: [
      { name: 'OPENAI', role: 'the math result and the ads desk; GPT-5.5 Instant becomes the default.' },
      { name: 'GOOGLE', role: 'I/O reframes Gemini as a thing that acts across Search, Android, Chrome, Workspace, YouTube.' },
      { name: 'ANTHROPIC', role: 'buys Stainless, partners the Gates Foundation; the toolmaker and the funder.' },
    ],

    /** Bridge to 390 — the series read the substrate reaching the
        consumer surface; this week is the surface starting to act. */
    bridge: {
      issue: '390',
      text: '390 watched the substrate surface as a glyph a billion users could tap. 391 is the week the surface stopped waiting to be tapped.',
    },

    intro: 'There is no single launch to file against this week. There are four, in four different rooms, and the reason they belong on one wire is that they rhyme. A model proved a piece of mathematics nobody asked it to. A consumer assistant was rebuilt around acting rather than replying. The advertisement moved inside the answer. And the regulators were handed a key to the building before the next models ship. Read together, the week is the clearest evidence yet that the word "assistant" is becoming a historical term. We filed these the same week, before the takes hardened. Some will be wrong by August. That is the cost of filing while the ink is wet.',

    propositions: [
      {
        n: '01',
        overline: 'FIELD',
        filedAt: 'MON',
        title: 'The machine proved a theorem.',
        titleJp: '機械が定理を証明した',
        body: [
          'An internal OpenAI model, by the company’s account, autonomously disproved a geometry conjecture that had stood open for roughly eighty years — reportedly the first time a model has independently closed a prominent open problem at the centre of a mathematical field, rather than checking, formalising, or assisting a proof a human had already shaped.',
          'Treat the claim with the caution any first-of-its-kind claim earns until the working is public and a referee has sat with it. But assume it survives review, because the direction is the story regardless of this one result. A first draft for free arrived for prose in 2023 and for code soon after. A first proof for free is a different category of cheap — the artefact is supposed to be the thing you could not get without understanding. The hour the blank artboard was declared solved (see 368) now has a sibling: the hour the open problem was.',
        ],
      },
      {
        n: '02',
        overline: 'MODELS',
        filedAt: 'TUE',
        title: 'The default floor moved up again.',
        titleJp: '既定の新しい床',
        body: [
          'GPT-5.5 Instant became the ChatGPT default early in the month, replacing GPT-5.3 Instant — tuned for fast chat and everyday reasoning. Around it the week stacked releases the way a busy week now does: Grok 4.3 to wider rollout, Google’s Gemini 3.5 Flash and a 3.1 Ultra with its largest context window yet, a first commercial subquadratic model claiming a 12-million-token window, an Apache-licensed mixture-of-experts trained on AMD silicon.',
          'The number on the model matters less each quarter than where the floor sits. What a free or default tier does without being asked twice is the real frontier for most people, and that floor rose again this week without a keynote to mark it. The interesting models are no longer only the ones at the top of the leaderboard. They are the ones quietly becoming the thing a billion people get by default.',
        ],
      },
      {
        n: '03',
        overline: 'AGENTS',
        filedAt: 'WED',
        title: 'Gemini learned to act.',
        titleJp: 'ジェミニ、動くことを覚える',
        body: [
          'At Google I/O, Gemini was reframed from a thing that answers into a thing that acts — automating tasks and operating across Search, Android, Chrome, Workspace, and YouTube as a single cross-platform layer. In the same window, Microsoft moved Copilot Studio’s computer-use capability to general availability across all commercial geographies. Two of the largest software surfaces on the planet shipped "the assistant can now operate the software for you" within days of each other.',
          'This is the week’s spine. Answering is a closed loop — you read the reply and decide. Acting is an open one — the system takes steps in the world on your behalf, and the question stops being "is the answer good" and becomes "do I trust the hand." Every substrate discipline this magazine has named — provenance, fidelity, the audit envelope — exists for exactly the moment a model stops talking and starts doing. That moment arrived at consumer scale this week.',
        ],
      },
      {
        n: '04',
        overline: 'MONEY',
        filedAt: 'THU',
        title: 'The advertisement moved inside the answer.',
        titleJp: '回答の中の広告',
        body: [
          'OpenAI opened a self-serve Ads Manager letting advertisers build campaigns directly inside ChatGPT, reportedly chasing billions in ad revenue this year. Google, at the same I/O, expanded advertising inside its AI Search experience — sponsored products set beside AI-generated explanations, some ads carrying their own chatbot.',
          'When the answer and the advertisement share a sentence, the reader loses the seam that told them which was which. Search at least drew a line, however thin, between the result and the ad beside it. A conversational interface erases that line by design — the persuasion arrives in the same voice as the help. This is the quiet load-bearing story of the week, and the one most worth watching, because it changes the incentive under every "helpful" reply you will read for the next decade.',
        ],
      },
      {
        n: '05',
        overline: 'CAPITAL',
        filedAt: 'FRI',
        title: 'Anthropic bought the toolmaker and funded the field.',
        titleJp: '工具屋を買い、土地に出資する',
        body: [
          'Anthropic acquired Stainless, the studio that generates high-quality SDKs for API products — a tell that the company sees the developer-surface, the client libraries themselves, as terrain worth owning rather than renting. In the same stretch it announced a 200-million-dollar, four-year partnership with the Gates Foundation aimed at AI for healthcare, education, agriculture, and economic development in underserved regions.',
          'Read an acquisition like a touring schedule and a philanthropy like a flag. Buying the SDK shop says the contract between a model and the code that calls it is being pulled in-house. The Gates partnership says the frontier labs have decided the global-development surface is theirs to shape early, on their terms. Both are moves on the board you only make when you believe you are going to be here a while.',
        ],
      },
      {
        n: '06',
        overline: 'GOVERNANCE',
        filedAt: 'SAT',
        title: 'The regulators got a key to the building.',
        titleJp: '規制側が鍵を得た',
        body: [
          'Governments — the United States most visibly — pressed for frontier models to be tested before public release, and major labs including Microsoft and xAI agreed to give regulators early access. Pre-release evaluation by the state is moving from proposal to practice, quietly, without a statute most people could name.',
          'This is the structural shift under the product noise. Early access is a key to the building; whoever holds it shapes what "safe enough to ship" means in private, before the public sees the model at all. The right question is no longer whether models get tested before release — it is who is in the room, what they are allowed to see, and whether any of it is ever filed where the rest of us can read it. A magazine that cares about audit trails should be watching this one closely.',
        ],
      },
      {
        n: '07',
        overline: 'TASTE',
        filedAt: 'SUN',
        title: 'What the week did not make cheaper.',
        titleJp: '残る希少',
        body: [
          'First proofs, first drafts, first mockups, first thousand options — all cheaper this week than last. What did not get cheaper is the judgement to know which of the four launches actually matters, which model behind the headline number is the one your work depends on, and which "helpful" answer is quietly selling you something. The week made generation free and made discernment more expensive by exactly the same amount.',
          'That is the through-line every tool-shift leaves behind, and the one this magazine keeps filing under the same word: taste survives. The hand that can look at a week like this and say plainly which line to watch — the proof, not the press release; the act, not the answer; the seam, not the sentence — is worth more at the close of this week than it was at the open. We will know which of these seven held by August. Until then the field is acting, the ink is wet, and the line it draws is the only thing worth watching.',
        ],
      },
    ],

    bulletin: {
      text: 'The week made generation free and discernment more expensive by exactly the same amount.',
      attribution: 'KERNEL.CHAT · DISPATCH · 391',
    },

    outro: 'Dispatches age fast. File this one under MAY 2026, beside the week that looked like four unrelated launches and reads, on the wire, as one move: the assistant stepped off the page and into the work. The parts that hold will be the parts about the seam — between answer and advertisement, between the hand and the trust you place in it — because the seam is always what a tool-shift tries to hide, and naming it is the job.',

    signoff: '街のコーダーたちへ — watch the act, not the answer; the proof, not the press release.',

    terminator: 'END OF DISPATCH · KERNEL.CHAT/391 · FILED 28 MAY · WEEK OF 18–24 MAY · INK STILL WET',
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
