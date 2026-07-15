/* ──────────────────────────────────────────────────────────────
   ISSUE 419 — JUL 2026
   THE INTELLIGENT CANVAS
   知性のキャンバス

   A field review of FLORA (flora.ai) — the "AI-powered canvas for
   designers, brand teams, and agencies" that wires fifty-plus
   generative models into one infinite sheet and seats an agent
   beside the maker. Read 2026-07-15: $42M raised; Pentagram,
   Lionsgate and Nike on the masthead; investors saying "the next
   Adobe" out loud. The claim worth reviewing is not a better
   model — it is the ROOM the models sit in. The workflow is the
   document; you do not export the process, you inhabit it. That
   is a magazine's kind of claim, which is why this magazine
   reviews it with a magazine's kind of instrument.

   THE SHAPE (tenth): `plate` — the WORKING MODEL. The magazine
   does not screenshot another shop's press; it builds a working
   miniature of the mechanism and hands the reader the lever.
   Four blocks (one prompt, two image frames, one video frame)
   wired on a framed plate; PULL THE PROOF sends the model's
   signal down the wires and each frame draws a seeded botanical
   engraving — drawn in-house, never generated, disclosed in
   `plateNote`. The reader can rearrange the blocks (the wires
   follow — arrangement is the canvas's material, not a control;
   no reading depends on it) and redraw any single proof.

   Which rules it stresses, and the TWO AMENDMENTS it ratifies
   (checklist §7 — edited into docs/interaction-language.md in
   this same commit, per that file's own amendment clause):
     • Rule 2 — the hand is required: FLORA's whole argument is
       that the process is the product. A static diagram of a
       node canvas is a picture of the claim; only operating one
       tests it. Cut the interaction and the review is gone.
     • Rule 3 — AMENDED (the working-model exception): inside the
       plate's frame, script may move the model's own signal,
       because the motion IS the subject — the mechanics of the
       thing under review, not decoration. Four constraints
       travel with the exception: confined to the plate frame;
       timer-robust (every animation step advances on a timer as
       well as a frame callback, so throttled and background tabs
       cannot stall the model — found the hard way when this
       issue's galley stalled in an embedded pane where rAF never
       fires); collapsed to instant state by reduced-motion; and
       everything OUTSIDE the frame stays CSS-only at weather
       amplitude. The video frame's sway stays ≤4px — inside the
       weather budget even though script drives it.
     • Rule 4 — AMENDED (the seed is the state's address): a
       generative frame cannot hold every reachable state in the
       DOM. Honesty is preserved by reproducibility instead:
       every proof prints its seed on the artwork (No.###), the
       drawing algorithm is deterministic from that seed, and
       print renders the current proofs with their seeds — a
       printed seed is a state the archive can re-draw. At rest
       the plate already holds a completed pull (seeds derived
       from the issue number), so an untouched page is complete
       (rule 1) and deterministic across every copy of the issue.
     • Rule 6 — doubled again (the simulation disclosure): when
       the page models an external product, the model must say
       so on-surface. `plateNote` is mandatory equipment: drawn
       in-house, nothing generated; the model names on the
       frames are FLORA's real stockroom, the artwork is ours;
       the ledger counts only the reader's pulls and redraws,
       session-only, unrecorded.
     • Rule 5 — controls are plain buttons (run + per-frame
       redraw); blocks are additionally keyboard-movable (arrow
       keys, aria-roledescription) so the hand arrives by every
       door even for the non-control arrangement affordance.

   Identity (differentiated from 418 butter/classic/cobalt and
   417 ivory/classic/pool):
     • coverStock = 'kraft' — the field-report register; this is
       a review of another shop's press, filed from their floor.
     • coverLayout = 'asymmetric-left' — the editorial-column
       rhythm; the cover reads like a dispatch masthead.
     • accent = 'ivy' — declared, not defaulted: the subject is
       literally named FLORA and the plate draws botanical
       engravings; the cabinet's nature seed has waited since
       371 for a subject this on-the-nose. First ivy issue.
     • coverSeal = WORKING MODEL — stamps the method, the way
       405/416/418 stamped theirs.
     • No postmark: FLORA's canvas is a place with no geography.

   Provenance: product facts (positioning, tagline, model names,
   $42M, the client masthead, the agent copy) read from flora.ai
   on 2026-07-15 and quoted verbatim where marked. The plate is
   a simulation; the issue says so three times — dossier, note,
   and colophon-grade plateNote — because a magazine that models
   someone else's machine owes the reader the seam.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_419: IssueRecord = {
  number: '419',
  month: 'JUL',
  year: '2026',
  feature: 'THE INTELLIGENT CANVAS',
  featureJp: '知性のキャンバス',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'kraft',
  coverLayout: 'asymmetric-left',

  coverSeal: {
    label: 'WORKING MODEL',
    date: 'VII·26',
  },

  accent: 'ivy',

  headline: {
    prefix: 'THE INTELLIGENT',
    emphasis: 'CANVAS',
    suffix: '.',
    swash: 'FLORA wires fifty generative models into one sheet of paper and seats the AI beside you, not in front of you. We built a working model of the idea and put it on the page. Drag the blocks. Pull the proof.',
  },

  contents: [
    { n: '001', en: 'The claim is the room, not the model', jp: '主張はモデルではなく部屋', tag: 'THESIS' },
    { n: '002', en: 'Plate No.1 — a working model you operate', jp: '作動模型第一号 — 読者が操作する', tag: 'THE PLATE' },
    { n: '003', en: 'The stockroom — fifty models, one subscription', jp: '在庫室 — 五十のモデル、一つの購読', tag: 'INVENTORY' },
    { n: '004', en: 'The hand beside yours — FLORA’s agent', jp: 'あなたの隣の手 — FLORAのエージェント', tag: 'THE HAND' },
    { n: '005', en: 'What the pressroom reads in it', jp: '編集部の読み', tag: 'VERDICT' },
  ],

  spread: {
    type: 'plate',
    kicker: 'FIELD REVIEW · 現場調査',
    title: 'THE INTELLIGENT CANVAS.',
    titleJp: '知性のキャンバス。',
    deck: 'FLORA calls itself an intelligent canvas built for flow — blocks carry models, wires carry intent, and the workflow is the document. Instead of describing that, this issue builds it small and hands you the lever.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    dossier: {
      kicker: 'THE SUBJECT · 対象',
      note: 'Product facts below were read from flora.ai on 15 July 2026 and are quoted where marked. The plate that follows is this magazine’s own working simulation of the mechanism — nothing on it was made with FLORA, and no FLORA account was used. The model names on the frames are real entries in FLORA’s stockroom; the engravings they label are drawn in-house.',
      items: [
        { label: 'SUBJECT', value: 'FLORA — FLORA.AI · "AI-POWERED CANVAS"' },
        { label: 'FOR', value: 'DESIGNERS · BRAND TEAMS · AGENCIES' },
        { label: 'CLAIM', value: '"EVERY CREATIVE AI TOOL, ONE UNIFIED PROCESS"' },
        { label: 'LEDGER', value: '$42M RAISED · PENTAGRAM · LIONSGATE · NIKE' },
        { label: 'APPARATUS', value: 'PLATE No.1 — SIMULATION, DRAWN IN-HOUSE' },
      ],
    },

    intro: [
      {
        heading: 'The claim is the room, not the model',
        headingJp: '主張はモデルではなく部屋',
        paragraphs: [
          'Every generative shop of the last three years has sold the same sentence with a different noun: our model is better. FLORA declines the sentence. Its canvas racks fifty-plus models — Veo, FLUX, Kling, Pika, Stable Diffusion — under one roof and one bill, "one subscription to rule them all," and bets that the model is paper stock, not the press. Stock gets swapped season to season; the press stays. What FLORA is actually selling is the room the models sit in: an infinite sheet where blocks carry models, wires carry intent, and the workflow is the document. You do not export the process. You inhabit it.',
          'The second claim is quieter and larger. FLORA’s agent — the house hand — "thinks with you, builds with you, and never runs out of directions to try." The vocabulary is deliberate: a hand beside yours on the sheet, not an autopilot over it. "Never let a good idea go unexplored." Forty-two million dollars, Pentagram and Nike on the masthead, and investors saying "the next Adobe" out loud — for a room.',
          'A room is hard to review in prose. So this issue does what a magazine with a plate section does: it builds a working miniature of the mechanism, frames it, and lets you run it. The plate below is a simulation — drawn by this magazine, not generated by anyone’s model, and it says so on its own face. What it models honestly is the grammar: blocks, wires, a pull, a proof.',
        ],
      },
    ],

    plateKicker: 'PLATE No.1 — WORKING MODEL · 作動模型',
    plateHint: 'DRAG OR ARROW-KEY A BLOCK TO REROUTE THE WIRES · CLICK A PROOF TO REDRAW IT',
    plateCaption: 'FIG. 1 — FLORA’S GRAMMAR, REDUCED: BLOCKS CARRY MODELS, WIRES CARRY INTENT. EVERY PROOF PRINTS ITS SEED — THE SAME SEED ALWAYS DRAWS THE SAME PROOF.',

    blocks: [
      {
        id: 'b1',
        label: 'BLOCK 01 · TEXT',
        labelJp: '言葉',
        kind: 'text',
        prompt: '"a botanical study, engraved, one flower leaning out of frame"',
        x: 3,
        y: 36,
      },
      {
        id: 'b2',
        label: 'BLOCK 02 · IMAGE',
        labelJp: '図版',
        kind: 'image',
        models: ['FLUX.1', 'SD 3.5', 'IDEOGRAM 3', 'RECRAFT V3', 'IMAGEN 4'],
        x: 36,
        y: 4,
      },
      {
        id: 'b3',
        label: 'BLOCK 03 · IMAGE',
        labelJp: '図版',
        kind: 'image',
        models: ['FLUX.1', 'SD 3.5', 'IDEOGRAM 3', 'RECRAFT V3', 'IMAGEN 4'],
        x: 36,
        y: 56,
      },
      {
        id: 'b4',
        label: 'BLOCK 04 · VIDEO',
        labelJp: '動画',
        kind: 'video',
        models: ['VEO 3', 'KLING 2.1', 'PIKA 2.2', 'RUNWAY GEN-4', 'LUMA RAY2'],
        x: 70,
        y: 28,
      },
    ],

    wires: [
      { from: 'b1', to: 'b2' },
      { from: 'b1', to: 'b3' },
      { from: 'b2', to: 'b4' },
      { from: 'b3', to: 'b4' },
    ],

    runLabel: '★ PULL THE PROOF',
    runAgainLabel: '★ PULL AGAIN — 再校',

    plateNote: 'Plate No.1 is a working simulation drawn by this magazine — nothing on it was generated by FLORA or by any of the models named on the frames; the names are real entries in FLORA’s stockroom, the engravings are ours. Every proof is drawn deterministically from the seed printed on its corner: the same seed always draws the same proof, on your copy or anyone’s, which is how a generative frame keeps the archive’s promise that nothing you saw is lost. The page opens on a completed pull whose seeds come from the issue number — a reader who touches nothing sees a finished plate, and the same finished plate as every other reader. The ledger under the plate counts only your own hand: pulls, single-frame redraws, models drawn. It is counted in your browser and nowhere else, and reloading resets the plate to the standing proof. Per the ethic set in ISSUE 411, nothing you pull is graded.',

    outro: [
      {
        heading: 'What the pressroom reads in it',
        headingJp: '編集部の読み',
        paragraphs: [
          'Our discipline says count what gets read and cut what does not. FLORA’s wager is the same rule applied to tools: count what gets used. When every model is a block on the same sheet, the model stops being the product — the process is. The subscription is not for the ink; it is for the imposition, the arrangement of work on the sheet. A magazine recognizes that business model because it is a magazine’s business model.',
          'The reservation, filed honestly: a room that holds every tool is also a room you never leave, and "one subscription to rule them all" is a sentence with a famous second act. The bet against FLORA is the same bet against any unified surface — that makers will want the seams back. The bet for it is on this plate: you pulled the proof, the signal walked the wires, and for one pull the process was legible end to end. Legibility is the product. It usually wins.',
        ],
      },
    ],

    pullQuote: {
      text: 'The issue was never the ink. It is the imposition.',
      attribution: 'THE INTELLIGENT CANVAS · FIELD REVIEW',
    },

    references: {
      kicker: 'THE SOURCE FILE · 出典',
      note: 'One source, read once, quoted where marked. The plate is not a source; it is an argument.',
      items: [
        {
          authors: 'FLORA (flora.ai)',
          year: '2026',
          title: 'Product site — positioning, stockroom, agent copy, client masthead, funding',
          journal: 'Read 15 July 2026',
        },
      ],
    },

    signoff: '街のコーダーたちへ — the tools will share one sheet soon enough; make sure the hand on the wire is still yours.',
  },

  audit: {
    drafted: 'field-reviewed and built in-session · claude-fable-5, VII·26',
    verified: 'product facts read from flora.ai 2026-07-15, quoted where marked; the plate discloses itself as simulation in dossier, plateNote, and caption; artifact edition (the original galley proof) filed at artifacts/419-the-intelligent-canvas.html — the first, per docs/artifact-language.md',
    adherence: 'tenth shape `plate` — rules 2/5/6 argued, rules 3/4 AMENDED in docs/interaction-language.md in this commit per its amendment clause; seeds make every proof reproducible',
    readCut: 'four catalog entries kept from the galley’s standalone study; the ticker cut — the stockroom reads better as a claim than a marquee',
    pressed: 'VII·26 · 2026-07-15',
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
