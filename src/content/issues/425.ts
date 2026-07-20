/* ──────────────────────────────────────────────────────────────
   ISSUE 425 — DEC 2026
   ONE OF ONE · 一点もの

   A five-station immersive sequence about the completed 42-second
   fashion short and the contradiction inside it: a system capable
   of making a garment for one person can still learn to make the
   same desire for everyone. No film frames appear here. Five new
   mixed-media editorial plates were commissioned for this issue:
   paper, graphite, thread, sage, and one oxblood register.

   The established Sequence apparatus is reused because the subject
   has a real order: call → measure → make → fit → street. Optional
   stage plates extend the second Sequence instance without adding a
   new interaction shape. Every production claim was checked against
   the July 19 greenlight, routing, handoff, delivery, and refined-edit
   records in docs/video/one-of-one-2027.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_425: IssueRecord = {
  number: '425',
  month: 'DEC',
  year: '2026',
  feature: 'ONE OF ONE',
  featureJp: '一点もの',
  price: '¥0 · MADE ON DEMAND',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'kraft',
  coverLayout: 'asymmetric-left',
  coverSeal: { label: 'CUT No.1 · HUMAN FINISH', date: 'XII·26' },
  coverPostmark: { place: 'THE EDIT ROOM', date: 'XII·26' },
  accent: 'oxblood',

  headline: {
    prefix: 'One of',
    emphasis: 'One.',
    suffix: '',
    swash: 'A coat made for one body. A street full of the same answer. Five stations inside a 42-second argument about personalization.',
  },
  coverDeck: 'A coat made for one body. A street full of the same answer.',

  contents: [
    { n: '001', en: 'The call', jp: '呼び出し', tag: 'BEFORE DAWN' },
    { n: '002', en: 'The measure', jp: '採寸', tag: 'BODY' },
    { n: '003', en: 'The making', jp: '仕立て', tag: 'MATERIAL' },
    { n: '004', en: 'The fit', jp: '試着', tag: 'MIRROR' },
    { n: '005', en: 'The street', jp: '通り', tag: 'AFTER' },
    { n: '006', en: 'The human finish', jp: '人の仕上げ', tag: 'RECEIPT' },
  ],

  spread: {
    type: 'sequence',
    kicker: 'AN IMMERSIVE SEQUENCE · 没入型シークエンス',
    title: 'One of One.',
    titleJp: '一点もの。',
    deck: 'Enter at the bedside and leave in the crowd. The five plates do not reproduce the film. They rebuild its argument from paper, absence, measurement, thread, and repetition.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'kraft',

    dossier: {
      kicker: 'THE FINISHED CUT · 完成版',
      note: 'Production facts verified against the local project record on 19 July 2026. The five artworks below were generated expressly for this issue and are not frames from the film.',
      items: [
        { label: 'PICTURE', value: '42.0 SECONDS · 10 SHOTS · 1260 FRAMES' },
        { label: 'FORMAT', value: '1080 × 1920 · 30 FPS · H.264 / AAC' },
        { label: 'SOUND', value: '7 AUTHORED CUES · -16.01 LUFS · -1.43 dBTP' },
        { label: 'ROUTING', value: 'QUOTE FIRST · $22.66 ENGINE-RECORDED' },
        { label: 'FINISH', value: 'PALMIER · EDIT CRITIC · CONTINUITY · HUMAN PICTURE LOCK' },
      ],
    },

    intro: [
      {
        heading: 'A perfect answer can still be the wrong question',
        headingJp: '完璧な答え、間違った問い',
        paragraphs: [
          'The premise is almost frictionless. Before dawn, a system already knows what you will wear. It reads the body, composes the material, settles every seam, and presents a finished coat before the city is fully awake. Nothing is shipped. Nothing waits on a rack. Nothing exists until this body asks for it.',
          'Then the door opens. The coat is exact, personal, and everywhere. The short does not resolve whether this is comfort or capture. It lets customization achieve its technical victory, then asks what remains individual when every private desire has been trained toward the same silhouette.',
        ],
      },
    ],

    stages: [
      {
        id: 'call',
        label: 'CALL',
        labelJp: '呼び出し',
        summary: 'The system speaks before the person has chosen to ask.',
        image: '/issues/425/01-call.jpg',
        imageAlt: 'Layered torn paper forming an empty human silhouette beside a sage garment pattern, connected by a single oxblood thread.',
        imageCaption: 'THE ABSENCE RECEIVES THE FIRST THREAD',
        detail: [
          'The first station contains no person. It contains the space a person is expected to fill. A cut-paper absence and a garment pattern face one another while a red thread crosses between them. The system’s first claim is temporal: the answer is ready before intention has had time to become language.',
          'That convenience is the seduction. Prediction feels like care when it arrives quietly enough. The issue begins here because the garment is not yet the central object; the central object is the distance between a body and an answer prepared in its name.',
        ],
        artifact: 'FILM RECEIPT · SHOT 01 · FRAMES 000–120 · phone chirp over near-silent room tone.',
      },
      {
        id: 'measure',
        label: 'MEASURE',
        labelJp: '採寸',
        summary: 'A body becomes a field of usable coordinates.',
        image: '/issues/425/02-measure.jpg',
        imageAlt: 'Abstract empty body contour surrounded by translucent tailor curves, pinholes, graphite marks, and one oxblood registration point.',
        imageCaption: 'THE BODY, TRANSLATED INTO A CUTTING FIELD',
        detail: [
          'Measurement is usually described as neutral: length, width, posture, preference. But every measurement also decides what counts. The second plate refuses the face and leaves only a contour surrounded by tailor curves, pinholes, and registration marks. A living body has become information clean enough to cut against.',
          'The scene is not framed as violation. The person stands still and permits the reading. That calm matters. Most consequential systems do not enter our lives as intruders; they enter as useful rooms we walk into ourselves.',
        ],
        artifact: 'FILM RECEIPT · SHOT 02 · FRAMES 120–240 · scan tone; corrected interior match preserved in Refined Cut.',
      },
      {
        id: 'make',
        label: 'MAKE',
        labelJp: '仕立て',
        summary: 'Matter arrives only after the decision has already been made.',
        image: '/issues/425/03-make.jpg',
        imageAlt: 'A sage paper coat assembling from suspended pattern pieces joined by dense graphite and oxblood threads.',
        imageCaption: 'THE PATTERN HOLDS WHILE THE GARMENT APPEARS',
        detail: [
          'The third station is the pleasure center: panels float, threads tighten, and a coat coheres without factory, warehouse, or waste pile in view. The original production treated this beat as mechanical-organic rather than magical. The distinction keeps the garment made. Every seam still has a route, even when the hand is invisible.',
          'On-demand manufacture promises to move abundance from inventory to possibility. That is a real change. The short gives it room to feel beautiful before asking who authored the possibility set from which this supposedly singular coat emerged.',
        ],
        artifact: 'FILM RECEIPT · SHOTS 03–05 · FRAMES 240–570 · assembly purr and fabric whisper; no native model audio retained.',
      },
      {
        id: 'fit',
        label: 'FIT',
        labelJp: '試着',
        summary: 'The object becomes personal at the instant it is recognized.',
        image: '/issues/425/04-fit.jpg',
        imageAlt: 'A finished sage coat standing without a mannequin, one half opened to reveal hand-worked seams and a single oxblood tailor tack.',
        imageCaption: 'THE OUTSIDE IS FINISHED; THE INSIDE KEEPS THE HAND',
        detail: [
          'A garment becomes yours through recognition as much as ownership. The mirror turn is warm, private, almost vain. The coat settles. The person likes what they see. Any critique that skips this pleasure misunderstands why personalized systems work: they do not only remove friction; they return a flattering image of the self.',
          'The plate opens the coat and exposes its construction. One tailor tack remains visible. That mark carries the human finish applied after generation: pacing, color continuity, hard-cut discipline, ambience repaired across loop boundaries, and the decision to stop when the film could finally hold its own silence.',
        ],
        artifact: 'FILM RECEIPT · SHOTS 06–07 · FRAMES 570–750 · score ends at the door; the exterior act begins without it.',
      },
      {
        id: 'street',
        label: 'STREET',
        labelJp: '通り',
        summary: 'One of one meets everyone else’s one of one.',
        image: '/issues/425/05-street.jpg',
        imageAlt: 'A graphite city filled with near-identical folded-paper coats; one central coat has oxblood stitches and a displaced shadow.',
        imageCaption: 'THE DIFFERENCE SURVIVES AS A SEAM AND A SHADOW',
        detail: [
          'Outside, personalization meets culture. The street is full of identical coats, each presumably generated for the singular person wearing it. The contradiction is not a software bug. It is what happens when individualized prediction drinks from a shared pool of aspiration, reference, reward, and taste.',
          'Look closely at the final plate. One coat carries a red seam, but the difference is small enough to miss. That is the issue’s last question: if uniqueness requires inspection to be found, was the system making identity—or merely serializing it?',
        ],
        artifact: 'FILM RECEIPT · SHOTS 08–10 · FRAMES 750–1260 · street bed continuous through frame 1200; final fade only at the end.',
      },
    ],

    defaultStage: 'call',

    outro: [
      {
        heading: 'The human finish',
        headingJp: '人の仕上げ',
        paragraphs: [
          'The picture was generated across routed models, but the film was not delivered by a model run. Ten shots were selected, conformed, timed, sounded, graded, revised, mastered, and checked. The original cut was preserved. A duplicate timeline repaired three ambience joins and restrained two interior inserts without changing the 42-second structure. The work became complete through a sequence of refusals: reject the wrong reflection, reject the stalled queue, reject the accidental silence, reject the temptation to keep polishing after the argument was legible.',
          'That is why this issue does not reproduce the finished film. Its five plates were made for the page. A project should be able to leave one medium and arrive in another with something new to say. The short asks whether one-of-one production can escape sameness. The issue answers with five artifacts that share a grammar but never repeat an image.',
        ],
      },
    ],

    pullQuote: {
      text: 'A system can make one object for one person and still teach everyone to want the same thing.',
      attribution: 'ONE OF ONE · ISSUE 425',
    },

    signoff: '街のコーダーたちへ — make the system answer the body without teaching every body the same desire.',
  },

  audit: {
    drafted: 'kernel.chat editorial · OpenAI Codex · 19 July 2026',
    verified: 'greenlight, routing, Palmier handoff, delivery master, refined-edit QC, and five new issue-only editorial plates',
    adherence: 'second Sequence instance; established ARIA tabs plus previous/next shortcuts; premium paper motion is CSS-only and collapses completely under reduced motion; optional visual plates add no new interaction shape',
    readCut: 'film frames and video embed refused; five original mixed-media plates commissioned exclusively for the issue',
    pressed: 'artifacts/425-one-of-one.html · XII·26 · source record read 2026-07-19',
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
