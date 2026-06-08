/* ──────────────────────────────────────────────────────────────
   ISSUE 394 — JUNE 2026
   THE DESK THAT SURVIVES: ON THE OBJECTS BESIDE THE SCREEN
   残る机 — 画面のそばの道具たち

   A deliberate restoration of range. 388–391 were four issues deep
   on agentic AI (substrates, provenance, the week the assistant
   became an actor). The magazine was drifting toward a trade
   newsletter. 394 turns back to culture/craft — the format the
   publication was built on (360–366: outdoor, indoor, style,
   craft) — but carries 391's own thread forward instead of cutting
   away from it. 391 argued that taste and the hand are what survive
   the machine. 394 stops arguing and goes and looks: at the analog
   objects a coder keeps beside the screen, and at the fact that
   choosing them by hand IS the taste that survives.

   Identity — kraft stock + classic layout + coffee accent. Kraft is
   the field-report / hand-made register; classic (centered,
   monument bottom-right) breaks the asymmetric-left streak of 389–391
   for a calmer, still-life rhythm; coffee is the craft/slow-work
   accent. A "BY HAND" seal signs the issue the way a maker stamps a
   finished object. Essay field-piece (369 template) with a dossier
   that reads as an inventory of the desk. No AI in the subject; the
   continuity is in the argument, not the topic.

   Back cover: the desk at rest — notebook, pen, keyboard, cup —
   still-life on kraft. The verso is literally the issue's subject.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_394: IssueRecord = {
  number: '394',
  month: 'JUNE',
  year: '2026',
  feature: 'THE DESK THAT SURVIVES: ON THE OBJECTS BESIDE THE SCREEN',
  featureJp: '残る机 — 画面のそばの道具たち',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'kraft',
  coverLayout: 'classic',

  coverSeal: {
    label: 'BY HAND · V·26',
    date: 'VI·26',
  },

  accent: 'coffee',

  backCover: {
    subject: 'THE DESK AT REST',
    subjectJp: '休む机',
    stock: 'kraft',
    image: '/back-covers/394-desk.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated',
  },

  headline: {
    prefix: 'The Desk That',
    emphasis: 'Survives',
    suffix: '.',
    swash: 'On the analog objects beside the screen — the notebook, the pen, the keyboard, the cup — and why the hand still chooses them.',
  },

  contents: [
    { n: '001', en: 'The desk at three o’clock', jp: '三時の机', tag: 'SCENE' },
    { n: '002', en: 'The notebook', jp: 'ノート', tag: 'PAPER' },
    { n: '003', en: 'The keyboard', jp: 'キーボード', tag: 'TOUCH' },
    { n: '004', en: 'The cup', jp: 'カップ', tag: 'RITUAL' },
    { n: '005', en: 'The pen and the margin', jp: 'ペンと余白', tag: 'HAND' },
    { n: '006', en: 'What the desk is for', jp: '机の用', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 手仕事',
    title: 'The Objects Beside the Screen.',
    titleJp: '画面のそばのもの。',
    deck: 'After four issues on machines that do the work, a look at the things on the desk that do not get automated — and an argument that choosing them by hand is the same scarce act the work itself now turns on.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'kraft',

    sections: [
      {
        heading: 'THE DESK AT THREE O’CLOCK',
        headingJp: '三時の机',
        paragraphs: [
          'Look at the desk, not the screen. The screen is where the work happens and it is, increasingly, where the work happens by itself — the agent runs, the diff lands, the proof gets checked. But the screen is rented. It is the same rectangle for everyone, configured by a company that has never met you. Pan the camera six inches to the left and right of it, and you reach the part of the desk that is yours: the part you assembled by hand, object by object, over years, with nobody’s defaults.',
          'There is a notebook, open or shut. There is a pen that is not the first pen you owned — you went through several before this one, and you can say why this one. There is a keyboard chosen by feel. There is a cup, with something in it that has gone slightly cold. There is a particular light. None of this is necessary. A laptop on a kitchen table runs the same compiler. And yet the desk accretes, because a person who works with their mind builds a small physical world around the work, and the shape of that world is a self-portrait nobody intended to paint.',
          'This issue is about that six inches. Four issues running we have written about the machine picking up the pen, the assistant becoming an actor, the substrate reaching the surface. This one is about the objects the machine has not asked for and cannot use — and about why the coder keeps choosing them anyway, more deliberately than before, not less.',
        ],
      },
      {
        heading: 'THE NOTEBOOK',
        headingJp: 'ノート',
        paragraphs: [
          'Everything in the notebook could live in a file. The file would be searchable, synced, backed up, and legible to a model that could summarise it on request. The notebook is none of those things. It is slow, it is lossy, it cannot be grepped, and it is exactly because of these deficits that it survives. The friction of the hand is not a bug the notebook has failed to fix. It is the feature the screen cannot offer.',
          'Writing by hand is a governor on speed, and a governor on speed is a governor on thought. You cannot transcribe a meeting verbatim with a pen, so you are forced to decide, in real time, what matters — which is the entire skill the rest of the day will ask of you. The notebook is where the editing happens before there is anything to edit. It is the one surface on the desk that refuses to autocomplete you.',
          'The honest caveat: most notebooks are never reread, and a coder who romanticises the object over the practice is just buying stationery. The notebook earns its place on the desk only if the hand actually opens it. But the ones that get opened are doing something no file does — holding the half-formed thought at the speed the thought was actually had, in handwriting that will, years later, return the whole afternoon to you in a way no timestamp can.',
        ],
      },
      {
        heading: 'THE KEYBOARD',
        headingJp: 'キーボード',
        paragraphs: [
          'The keyboard is the one object on the desk you touch more than any human you love, and most people type on whatever shipped in the box. The coders who do not — who went down the rabbit hole of switches and keycaps and layout, who can tell you what their board sounds like and why — are sometimes mocked for it, and the mockery misreads the thing entirely. The obsession is not about the keyboard. It is about respect for the interface you spend your life inside.',
          'A tool you use eight hours a day is worth tuning to the hand the way a chef tunes a knife or a drummer a kit. The feel of the keypress, the travel, the sound, the angle of the wrist — these are not aesthetics laid on top of the work. They are the work, felt through the fingertips, ten thousand times a day. To choose the keyboard deliberately is to admit that the body is part of the thinking, which it is, and which the screen, abstract and frictionless, is forever trying to make you forget.',
          'You can take this too far. There is a version of keyboard culture that is pure acquisition — a drawer of boards never typed on, a hobby that has quietly replaced the craft it was meant to serve. The line is simple and it is the same line as the notebook: the object is justified by the practice, not the other way round. A board you type a million words on is a tool. A board you photograph is a possession.',
        ],
      },
      {
        heading: 'THE CUP',
        headingJp: 'カップ',
        paragraphs: [
          'The cup is the clock. Not the one on the screen — that clock belongs to the calendar and the standup and the deploy window. The cup is the body’s clock: it marks the morning by being full, the afternoon by being cold, the evening by being rinsed and set to dry. The ritual around it — the grind, the pour, the wait — is the one part of the working day that cannot be made faster without being ruined, and a day needs at least one of those.',
          'What the cup actually defends is the pause. The agent has removed most of the natural pauses from the work — the compile you used to wait on, the search you used to run by hand, the draft you used to write from nothing. The pour is a pause you install on purpose, a small enforced gap where the mind catches up with the machine. The coder who keeps the ritual is not being precious. They are protecting the one interval in which the good idea, which never arrives during the typing, has room to arrive.',
          'It does not have to be coffee, and it does not have to be good. The tea drinkers are right too, and the person nursing tap water in a chipped mug is observing the same liturgy. The point is the object that says, by being picked up, that the work is paced by a person and not only by the run.',
        ],
      },
      {
        heading: 'THE PEN AND THE MARGIN',
        headingJp: 'ペンと余白',
        paragraphs: [
          'The smallest object on the desk is the one that does the thing the model cannot. A pen in the margin of a printout, a sticky note stuck to the monitor’s edge, a single word underlined twice — these are acts of judgement made physical, and judgement is the one input the machine still has to be handed. The margin is where you tell the work what you think of it, in a hand that is unmistakably yours.',
          'There is a reason the marginal note survives the move to the screen even among people who do everything else digitally. The margin is adjacent to the claim — the comment sits next to the sentence it is arguing with, close enough to touch, which is a different cognitive act from writing the comment in a separate window. Proximity is the whole point. The hand in the margin is the reader refusing to be passive, and a reader refusing to be passive is, increasingly, the rarest and most valuable thing in a working life full of outputs that ask only to be accepted.',
          'The caveat holds here too, and harder: a margin full of notes is worthless if the notes are never acted on, and there is a kind of annotation that is just procrastination with a pen. But the underline that becomes a decision, the marginal "no" that kills a bad paragraph, the arrow that reorders a whole argument — that is the hand doing the one job that does not delegate. It is small. It is the most important thing on the desk.',
        ],
      },
      {
        heading: 'WHAT THE DESK IS FOR',
        headingJp: '机の用',
        paragraphs: [
          'The honest question under all of this is what the desk is for, when the work has moved into the screen and the screen increasingly runs itself. The notebook does not compile. The keyboard types into the same editor a cheaper board would. The cup holds no information. By any straight accounting, the six inches around the screen are overhead — sentiment a more efficient worker would clear away. And yet the better the coder, very often, the more deliberate the desk.',
          'That is not a coincidence; it is the argument. Everything 388 through 391 traced — the machine that drafts, proves, acts, and sells in the same breath — pushes the value of the work onto the one input that does not automate: judgement, taste, the deciding of what is worth keeping. The desk is where that faculty gets practised on objects. Choosing this pen over that one, tuning the board to the hand, installing the pause, marking the margin — these are taste exercised on small things, daily, until it is reflex on large ones. The desk is a gym for discernment.',
          'So keep the six inches. Not out of nostalgia, and not as a costume of craft worn over a frictionless job — the objects are justified only by the hands that actually use them. Keep them because the part of the work that is now scarce is the part the desk has always trained, and a person who has chosen every object within reach by hand is a person practised at the one move the machine still cannot make. The screen is rented. The desk is yours. 街のコーダーたちへ — choose the objects by hand; the desk is a self-portrait.',
        ],
      },
    ],

    pullQuote: {
      text: 'The screen is rented. The desk is yours.',
      attribution: 'KERNEL.CHAT · CRAFT SPREAD · 394',
    },

    dossier: {
      kicker: 'THE DESK · 机上',
      note: 'An inventory of the six inches around the screen — the part you assembled by hand, with nobody’s defaults.',
      items: [
        {
          label: 'Notebook',
          labelJp: 'ノート',
          value: 'Slow, lossy, ungreppable. The one surface that refuses to autocomplete you.',
        },
        {
          label: 'Pen',
          labelJp: 'ペン',
          value: 'Not the first you owned. The margin tool — judgement made physical, in a hand that is yours.',
        },
        {
          label: 'Keyboard',
          labelJp: 'キーボード',
          value: 'Touched more than any person you love. Tuned to the hand because the body is part of the thinking.',
        },
        {
          label: 'Cup',
          labelJp: 'カップ',
          value: 'The body’s clock. Full by morning, cold by afternoon. Defends the pause the agent removed.',
        },
        {
          label: 'Light',
          labelJp: '灯り',
          value: 'A particular one, chosen. The room’s register, set by a person and not by a default.',
        },
        {
          label: 'Subject',
          labelJp: '主題',
          value: 'Not the objects — the choosing. The desk is a gym for the discernment the work now turns on.',
        },
      ],
    },

    signoff: '街のコーダーたちへ — choose the objects by hand; the desk is a self-portrait.',
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
