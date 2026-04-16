/* ──────────────────────────────────────────────────────────────
   ISSUE 366 — APRIL 2026
   THE TOOLS THAT USE US: THE SOCIAL CLIMATE OF DESIGN IN 2026
   道具号 — 道具が私たちを使うとき

   The second essay-format issue (363 was the first). Where 363
   observed what coders wear, 366 observes what the software
   they design inside is doing to them — Figma's multiplayer
   surveillance, the cost of the always-commented room, what AI
   tools deleted from the workday, and how design vocabulary
   leaked out of the studio into everyday speech.

   Butter stock + monument-hero layout — new combination. Butter
   reads as lamplight-gold, the warm interior light of an
   always-on design room; monument-hero gives the social-
   critique issue its iconic weight.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_366: IssueRecord = {
  number: '366',
  month: 'APRIL',
  year: '2026',
  feature: 'THE TOOLS THAT USE US: THE SOCIAL CLIMATE OF DESIGN IN 2026',
  featureJp: '道具号 — 道具が私たちを使うとき',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — butter stock + monument-hero layout. The
      warm lamplight ground for a story about being perpetually
      inside the same software room; the monument-hero makes the
      issue number iconic, billboard-weight, for a cultural
      argument the magazine is putting its weight behind. */
  coverStock: 'butter',
  coverLayout: 'monument-hero',

  headline: {
    prefix: 'The Tools',
    emphasis: 'That Use',
    suffix: 'Us',
    swash: 'The social climate of design in 2026.',
  },

  contents: [
    { n: '001', en: 'The multiplayer room', jp: '多人数の部屋', tag: 'FIGMA' },
    { n: '002', en: 'Your software, your uniform', jp: '道具という服', tag: 'IDENTITY' },
    { n: '003', en: 'The always-commented room', jp: '常時のレビュー', tag: 'ATTENTION' },
    { n: '004', en: 'What the AI tools took', jp: 'AI以後の孤独', tag: 'LABOR' },
    { n: '005', en: 'Design-speak leaks out', jp: 'デザイン語、外へ', tag: 'LANGUAGE' },
    { n: '006', en: 'What comes back', jp: '戻ってくるもの', tag: 'FUTURE' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CULTURE SPREAD · 道具論',
    title: 'The Tools That Use Us.',
    titleJp: '道具が私たちを使うとき。',
    deck: 'Notes on the social climate of design in 2026 — what the software we work inside has started to do to the people who never leave it.',
    byline: 'BY THE EDITORS \u00b7 KERNEL.CHAT',
    stock: 'butter',

    sections: [
      {
        heading: 'THE MULTIPLAYER ROOM',
        headingJp: '多人数の部屋',
        paragraphs: [
          'Figma changed design by making it multiplayer, and the implications are only now becoming visible. For a decade the default state of a design file was private. You worked on it alone, showed it when it was ready, took feedback, iterated. The transaction was legible: here is the work, here is what I think, please respond. Now the default state of a design file is a room full of named cursors. A designer opens Figma in the morning and is already visible to seven colleagues. They will be visible for the rest of the working day.',
          'This sounds like collaboration. For the first six months it was. What it has become, in 2026, is something closer to ambient surveillance — the kind you stop noticing but never stop experiencing. Every pixel pushed happens under a dozen silent observers who may or may not be watching and whom you cannot reliably tell apart from the ones who left the tab open and went to lunch. The private act of trying and failing has no room to happen inside the room where all the work happens.',
          'The effect is small at the scale of one day and enormous at the scale of five years. Junior designers came up inside the room. They have never sketched a thing without witnesses. The confidence that used to come from private practice has been replaced by the confidence that comes from performing unfazed composure in front of an audience of peers. These are not the same skill.',
        ],
      },
      {
        heading: 'YOUR SOFTWARE, YOUR UNIFORM',
        headingJp: '道具という服',
        paragraphs: [
          'The tool you use is now a social marker in the way the brand of your jeans was in 1998. The Figma designer belongs to one culture, the Sketch holdout to another, the Canva arrival to a third. These are not interchangeable. A LinkedIn profile that says "Figma, Webflow, Framer" telegraphs a different person from one that says "Photoshop, Illustrator, Sketch" and a different person again from one that says "Midjourney, Runway, Cursor."',
          'The tool is the tell. It communicates before the portfolio loads. Hiring managers read the list the way a club steward reads a necktie — they are looking for signals of which room you think you belong to. The dirty part of this is that the signal is usually accurate. People who picked Webflow in 2022 usually do think differently about the web than people who picked Framer did, and they think differently again from the ones who were still defending Dreamweaver. The tool shaped how the thinking happened.',
          'The uncomfortable consequence is that changing tools is now more like changing subcultures than changing software. A Photoshop lifer who moves to Figma is not learning a new UI; they are leaving one neighborhood and arriving in another. The move is social as much as technical. The loneliness is real.',
        ],
      },
      {
        heading: 'THE ALWAYS-COMMENTED ROOM',
        headingJp: '常時のレビュー',
        paragraphs: [
          'The second change the multiplayer tools brought is the always-commented room. Feedback used to be bounded — a design review happened at a time, with people in it, and then it ended. In 2026 feedback is continuous, asynchronous, and scrolling. A designer finishes a screen at 11pm; seven comments are waiting when they open the file at 9am. The comments range from substantive to typo-pedantic to someone\u2019s manager leaving a single emoji.',
          'The cognitive cost of this is severe and almost entirely undocumented. The working day now begins with triaging reactions to yesterday\u2019s work rather than starting today\u2019s. The first hour — historically the most valuable one, the one K. Tanaka protects on purpose — is eaten by the comment queue. By noon the designer has not yet made anything, only adjudicated the making that happened while they were asleep.',
          'What this does to people, measured over years, is teach them that design is a response to feedback rather than a proposal of a thing. The proposal muscle atrophies. The reaction muscle hypertrophies. The result is a workforce fluent in revisions and less fluent in first drafts, which is bad for the craft and catastrophic for the quieter designers who never get their proposal into the room in the first place.',
        ],
      },
      {
        heading: 'WHAT THE AI TOOLS TOOK',
        headingJp: 'AI以後の孤独',
        paragraphs: [
          'The AI generation tools that arrived in force between 2023 and 2025 made the first draft free. This was supposed to liberate the designer. The effect in the studio has been almost the opposite. The first draft was never the expensive part of design work. The expensive part was the hour of someone else\u2019s attention that came after it — a senior looking at your mockup, pointing at three things, and saying "try these." That hour was the apprenticeship. It was also, for many designers, the reason the job was interesting.',
          'AI tools produce drafts faster than the senior can schedule the review. The review either happens on the AI-generated version, which is rarely worth arguing with because it has no author to argue back, or it gets skipped entirely because the team has moved on to the next generated batch. The designer, who used to be in dialogue with a mentor for an hour a day, is now in dialogue with a model that has no opinion and no memory. The loneliness this produces is the least-discussed labor cost of the AI wave.',
          'Some of this will recover. The senior review will come back, probably in a premium-priced form, because people who can give feedback worth acting on are suddenly scarce and worth paying for. Until then, a lot of designers are just quieter at their desks than they used to be.',
        ],
      },
      {
        heading: 'DESIGN-SPEAK LEAKS OUT',
        headingJp: 'デザイン語、外へ',
        paragraphs: [
          'A less-predicted effect of the last five years is that the studio vocabulary has escaped the studio. In 2021 "design system" was a phrase you said to other designers and watched them nod. In 2026 a lawyer will describe the workflow of a commercial real estate deal as "our design system for closings." Parents refer to their kitchen as a "component library." A recent-graduate doctor told us, with a straight face, that her bedside manner has "tokens."',
          'This is not quite satire. The vocabulary leaked because the vocabulary was, it turns out, useful. Tokens are a better abstraction than "ingredients." A design system is a better description of a repeatable workflow than "SOP." The studio invented the words because nobody else had good ones. Now everyone else is using them.',
          'The uncomfortable consequence is that designers, who used to have a private vocabulary that marked them as specialists, no longer do. This lowers the status of the profession in the same way that "doctors" lost some of their mystique once "self-care" became a common word. The language escaped, and some of the magic escaped with it. This is fine. Language was never supposed to be a moat.',
        ],
      },
      {
        heading: 'WHAT COMES BACK',
        headingJp: '戻ってくるもの',
        paragraphs: [
          'What comes back, slowly, is the private file. The single-player design session. The hour before anyone opens the shared Figma. A small but growing number of designers we spoke to for this issue now keep a personal sketchbook — a physical one, on paper — specifically to have a place where the cursor-count is zero. The sketchbook is not about the output. It is about having a room where trying a bad idea is allowed to happen without an audience.',
          'The software will adapt too, eventually. Expect to see "private mode" or "solo draft" features in every multiplayer design tool within eighteen months; expect the serious designers to use them. Expect the senior review hour to come back as a premium feature rather than a norm. Expect a renewed interest in single-player tools — Affinity, local Sketch files, terminal-based mockup tools, hand-drawn sketches scanned and uploaded late. The multiplayer room is not going away. A small closet next to it, with the door closed, is.',
          'The deeper correction is that design, as a profession, is starting to understand that the tools it adopted in a hurry came with costs that nobody itemized at the time. The next decade of the craft will be spent itemizing them and deciding which ones were worth paying.',
        ],
      },
    ],

    pullQuote: {
      text: 'We design inside the tool. The tool also designs us.',
      attribution: 'KERNEL.CHAT \u00b7 EDITORIAL',
    },

    signoff: '\u8857\u306e\u30b3\u30fc\u30c0\u30fc\u305f\u3061\u3078 \u2014 close the door when you need to.',
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
