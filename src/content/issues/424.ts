/* ──────────────────────────────────────────────────────────────
   ISSUE 424 — NOV 2026
   THE STUDIO THAT STAYS HOME · 家にいるスタジオ

   Artifact first: artifacts/424-the-studio-that-stays-home.html.
   Its named depth axis follows one production decision from brief
   through model, estimate, decision, and receipt. The site carries
   the lawful reduction as Plate No.3: GALLEY's local services,
   explicit cost gate, durable job receipt, and Palmier handoff.

   The proof grammar is deterministic and drawn in-house. No model
   runs from this issue. Palmier VFX is described as proposed work,
   never as shipped capability. Engine facts were verified against
   the repository's operator reference and the completed 58.9-second
   production record on 18 July 2026.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_424: IssueRecord = {
  number: '424',
  month: 'NOV',
  year: '2026',
  feature: 'THE STUDIO THAT STAYS HOME',
  featureJp: '家にいるスタジオ',
  price: '¥0 · LOCAL FIRST',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ink',
  coverLayout: 'monument-hero',
  coverSeal: { label: 'LOCAL RECEIPT No.1', date: 'XI·26' },
  accent: 'amethyst',

  headline: {
    prefix: 'THE STUDIO THAT',
    emphasis: 'STAYS',
    suffix: 'HOME.',
    swash: 'A model-agnostic production engine on localhost. The quote arrives before the charge. The files come home after the run.',
  },
  coverDeck: 'The quote arrives before the charge. The files come home after the run.',

  contents: [
    { n: '001', en: 'The boring door', jp: '退屈な扉', tag: 'HTTP' },
    { n: '002', en: 'The price card', jp: '価格カード', tag: 'GATE' },
    { n: '003', en: 'The local receipt', jp: 'ローカル受領書', tag: 'OWNERSHIP' },
    { n: '004', en: 'The edit room', jp: '編集室', tag: 'PALMIER' },
    { n: '005', en: 'The next room', jp: '次の部屋', tag: 'VFX' },
  ],

  spread: {
    type: 'plate',
    proofStyle: 'studio',
    kicker: 'SYSTEMS REVIEW · GALLEY — REPOSITORY READ 18 JULY 2026',
    title: 'THE STUDIO THAT STAYS HOME.',
    titleLines: ['THE STUDIO', 'THAT STAYS', 'HOME'],
    titleJp: '家にいるスタジオ — 見積もり、決裁、受領',
    deck: 'The interesting part of a generation engine is not the button that spends money. It is the operating system around the button: a boring interface, a visible quote, bounded authority, restart-safe work, and a local file at the end.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    dossier: {
      kicker: 'THE LOCAL STUDIO · ローカルスタジオ',
      note: 'The services and production totals below are repository facts. Plate No.3 is this magazine’s deterministic simulation. It never contacts fal, mflux, ElevenLabs, or Palmier; it draws contact sheets in the browser and counts only the reader’s actions.',
      items: [
        { label: 'INTERFACE', value: 'PLAIN HTTP · 127.0.0.1 · MODEL-AGNOSTIC' },
        { label: 'SERVICES', value: ':5411 LOCAL STILLS · :5412 VIDEO / IMAGE / SPEECH' },
        { label: 'GUARDS', value: 'ESTIMATE FIRST · HUMAN APPROVAL · DAILY CAP · ORIGIN BOUNDARY' },
        { label: 'RECEIPT', value: 'PERSISTENT JOB · LOCAL MP4 · RESTART RECOVERY' },
        { label: 'PROOF FILM', value: '58.9 SECONDS · 13 CLIPS · ABOUT $19.50' },
      ],
    },

    intro: [
      {
        heading: 'The boring door',
        headingJp: '退屈な扉',
        paragraphs: [
          'A good creative engine should be easy to replace at its edges. GALLEY exposes image, video, speech, catalog, estimate, and job status over plain HTTP on localhost. Any agent capable of a web request can hold the handle. A terminal model can use curl; an MCP client can pass the finished media into an editor; a chat model without tools can still write a request for a human to inspect and run.',
          'This is model-agnostic in the useful sense. It does not promise that models are interchangeable. It makes the studio interface independent of whichever provider is presently behind it. The door stays boring so the work can remain specific.',
        ],
      },
    ],

    plateKicker: 'PLATE No.3 — LOCAL STUDIO MODEL · ローカル制作模型',
    plateHint: 'DRAG OR ARROW-KEY A BLOCK TO REARRANGE THE STUDIO · PULL TO DRAW A NEW DETERMINISTIC LOCAL RECEIPT',
    plateCaption: 'FIG. 1 — A BRIEF ENTERS TWO LOCAL SERVICES; THE COST GATE KEEPS AUTHORITY WITH THE OPERATOR; A DURABLE RECEIPT HANDS THE FILE TO PALMIER.',
    blocks: [
      { id: 'b1', label: 'BLOCK 01 · BRIEF', labelJp: '入稿', kind: 'text', prompt: '“Make the smallest production that proves the idea, show the total before spending, and return files I can keep.”', x: 3, y: 35 },
      { id: 'b2', label: 'BLOCK 02 · LOCAL STILL', labelJp: '静止画', kind: 'image', models: ['MFLUX · :5411 · FREE', 'FAL IMAGE · :5412 · QUOTED'], x: 35, y: 4 },
      { id: 'b3', label: 'BLOCK 03 · COST GATE', labelJp: '決裁', kind: 'image', models: ['ESTIMATE · APPROVE / REFUSE', 'DAILY CAP · HTTP 402'], x: 35, y: 57 },
      { id: 'b4', label: 'BLOCK 04 · LOCAL RECEIPT', labelJp: '受領書', kind: 'video', models: ['MP4 · JOB PERSISTED', 'PALMIER · MCP HANDOFF'], x: 70, y: 28 },
    ],
    wires: [
      { from: 'b1', to: 'b2' }, { from: 'b1', to: 'b3' },
      { from: 'b2', to: 'b4' }, { from: 'b3', to: 'b4' },
    ],
    runLabel: '★ PULL THE RECEIPT',
    runAgainLabel: '★ PULL ANOTHER — 再受領',
    plateNote: 'Plate No.3 is a deterministic editorial simulation drawn in-house. It does not start either local server, call a provider, spend money, render media, or operate Palmier. The contact sheets preserve only the engine’s operating sequence; the printed seed is their reproducible address. The ledger counts your pulls, redraws, and model-label variants in this browser session. Reloading restores the standing plate. Nothing is sent or graded. Palmier VFX remains a proposal in the source issue, not a shipped engine claim.',

    ticker: ['PLAIN HTTP', 'LOCALHOST', 'ESTIMATE FIRST', 'APPROVE OR REFUSE', 'DAILY CAP', 'PERSISTENT JOBS', 'LOCAL MP4', 'PALMIER MCP'],
    tickerLabel: 'THE OPERATING CONTRACT · 操作契約',
    catalogKicker: 'THE STUDIO, IN FIVE ROOMS · 五つの部屋',
    catalog: [
      { n: '01', en: 'Interface', jp: '接続', body: 'Plain HTTP keeps the engine available to any capable model or agent. The creative system is not trapped inside one chat product, provider SDK, or proprietary orchestration layer.' },
      { n: '02', en: 'Authority', jp: '権限', body: 'Estimate is free. Generation is a purchase. The operator sees the total and may approve or refuse; the daily cap and local-origin boundary make discipline executable instead of ceremonial.' },
      { n: '03', en: 'Recovery', jp: '復旧', body: 'Jobs survive a server restart. A status receipt carries the provider source, local delivery, and error state, so a long generation can be recovered rather than guessed at.' },
      { n: '04', en: 'Ownership', jp: '所有', body: 'Finished media lands in ordinary local files. The proof film used thirteen clips, thirteen keyframes, narration, and a Palmier project; the exported MP4 is not held hostage by the generation vendor.' },
      { n: '05', en: 'Extension', jp: '拡張', body: 'The next careful layer is reversible VFX beside the edit: tracked masks, clean plates, compositing, relighting, upscale, denoise, interpolation, grain, captions, and color-match—each inspectable on the timeline. This is proposed work.' },
    ],

    outro: [
      {
        heading: 'The price card',
        headingJp: '価格カード',
        paragraphs: [
          'The first completed film makes the economics tangible. Its 58.9 seconds used a smoke test, a voice, premium stills, and twelve five-second motion clips for about $19.50. The number matters because it turns “AI video” from a spectacle into a production choice. An editor can compare a new shot with lunch, a stock license, a day of compositing, or the value of leaving the scene out.',
          'A refusal is therefore not a failed generation. It is a completed decision with a cost of zero. Good tooling gives that outcome the same dignity as approval.',
        ],
      },
      {
        heading: 'The edit room',
        headingJp: '編集室',
        paragraphs: [
          'Palmier receives what the engine makes. Its MCP can open the project, import media, place clips, inspect transcript timing, set properties, and export video or FCPXML. That handoff exposes an important boundary: generation produces material; editing makes a film.',
          'VFX belongs on the editing side of that boundary when it can remain reversible and inspectable. A tracked mask, clean plate, blend mode, or denoise pass should be an operation the timeline can name and remove—not an unexplained transformation burned into the only copy.',
        ],
      },
    ],
    pullQuote: { text: 'The machine walks. You decide. The receipt comes home.', attribution: 'THE STUDIO THAT STAYS HOME · ISSUE 424' },
    references: {
      kicker: 'THE SOURCE FILE · 出典',
      note: 'Repository evidence and the public project issue. Provider prices change; this issue repeats only the completed production total and sends operators back to the live catalog for new work.',
      items: [
        { authors: 'kernel.chat', year: '2026', title: 'GALLEY engine: operator reference', journal: 'docs/ENGINE.md · repository record read 18 July 2026' },
        { authors: 'kernel.chat', year: '2026', title: 'WHAT WE HAVE MADE — production plan and cost sheet', journal: 'docs/video/2026-07-18-what-we-made.md' },
        { authors: 'Isaac Hernandez', year: '2026', title: 'GALLEY: model-agnostic local media engine + Palmier VFX toolbelt', journal: 'GitHub issue #57 · github.com/isaacsight/kernel/issues/57' },
      ],
    },
    signoff: '街のコーダーたちへ — make the interface boring, the authority visible, and the receipt local.',
  },

  audit: {
    drafted: 'artifact-first editorial build · OpenAI Codex · 18 July 2026',
    verified: 'local engine reference + film production record + GitHub issue #57; no provider contacted by the issue',
    adherence: 'third `plate` instance — existing working model reused; studio receipt grammar added without a new interaction shape',
    readCut: 'product pitch cut; operating contract, completed cost, ownership boundary, and proposed Palmier VFX kept',
    pressed: 'XI·26 · repository source read 2026-07-18',
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
