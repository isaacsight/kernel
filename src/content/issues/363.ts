/* ──────────────────────────────────────────────────────────────
   ISSUE 363 — JULY 2026
   THE STYLE ISSUE: WHAT CODERS ARE WEARING NOW
   スタイル号 — 今、コーダーが着ているもの

   A departure from the first three. 360/361/362 ran typography-
   forward covers. 363 runs a long-form editorial feature — a
   proper magazine essay on the uniform of the city coder, written
   in full prose with drop caps, section kickers, and a tomato
   pull quote. No images. The writing carries it.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_363: IssueRecord = {
  number: '363',
  month: 'JULY',
  year: '2026',
  feature: 'THE STYLE ISSUE: WHAT CODERS ARE WEARING NOW',
  featureJp: 'スタイル号 — 今、コーダーが着ているもの',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — kraft stock + asymmetric-left layout.
      Editorial / fashion-magazine rhythm; left-aligned lockup and
      a denser, looser grid break from the centered template of
      the first three issues. */
  coverStock: 'kraft',
  coverLayout: 'asymmetric-left',

  headline: {
    prefix: 'The',
    emphasis: 'Style',
    suffix: 'Issue',
    swash: 'What coders are wearing now.',
  },

  contents: [
    { n: '001', en: 'The uniform is quieter now', jp: '静かな制服', tag: 'STREET' },
    { n: '002', en: 'The laptop is the jacket', jp: 'ラップトップは上着', tag: 'OBJECT' },
    { n: '003', en: 'Japanese minimalism wins', jp: '日本的ミニマリズム', tag: 'CULTURE' },
    { n: '004', en: 'Conference clothing gets serious', jp: 'カンファレンス', tag: 'EVENTS' },
    { n: '005', en: 'The café is the runway', jp: 'カフェ滑走路', tag: 'SCENE' },
    { n: '006', en: 'What the clothes are saying', jp: '服が語るもの', tag: 'ESSAY' },
  ],

  spread: {
    kicker: 'STYLE SPREAD · スタイル特集',
    title: 'On the Street.',
    titleJp: '街角で。',
    deck: 'Notes on the uniform of the city coder — what they\u2019re wearing, why it matters, and what it says about where the culture is headed.',
    byline: 'BY THE EDITORS \u00b7 KERNEL.CHAT',
    stock: 'kraft',

    sections: [
      {
        heading: 'THE UNIFORM IS QUIETER NOW',
        headingJp: '静かな制服',
        paragraphs: [
          'Something shifted in the last eighteen months. The wardrobe of the average developer — the one you see hunched over a laptop at Blue Bottle or walking out of an Akihabara station at dusk — has gotten noticeably, deliberately, quieter. The conference-logo t-shirt is gone. The zip-up hoodie has been demoted to the gym bag. In their place: an oversized navy tee in heavyweight cotton, charcoal cargo shorts that almost touch the knee, white Nike Pegasus so clean they read as a style choice rather than neglect.',
          'This is not coincidence. This is a culture, for the first time in maybe a decade, becoming conscious of itself. The developer has looked around and noticed that the rest of the world dresses better. The response has not been to perform fashion — that would be undignified — but to adopt a set of quiet, consistent, legibly-intentional garments that require no explanation. Uniqlo U does most of the work. Theory picks up the rest. A little bit of Lemaire for anyone who\u2019s been paid recently.',
          'The signal is: I have considered this. The refusal is: I am not going to perform for you.',
        ],
      },
      {
        heading: 'THE LAPTOP IS THE JACKET',
        headingJp: 'ラップトップは上着',
        paragraphs: [
          'If the clothes have gotten quieter, the objects have gotten louder. The MacBook Pro has replaced the sport coat as the primary expressive garment of the working developer. Its finish — Space Black, these days — is the color of the lapel. Its weight is the cut of the sleeve. The stickers across its lid are the pins on the jacket.',
          'Sticker grammar is now sophisticated enough to deserve its own vocabulary. One sticker is a statement of loyalty; three is a working biography; twelve is a clown car. The consensus has settled around four-to-six carefully chosen pieces: one for a conference you actually attended and remember, one for a tool you genuinely love, one unbranded color block as ballast, one for a project that matters to you personally. Anything more reads as performance.',
          'The mechanical keyboard has become the equivalent of a good watch. The HHKB Professional Hybrid Type-S is the Rolex Submariner of the category — legible to those who know, invisible to those who don\u2019t, made in Japan, quietly expensive. The split ortholinear contingent carries Moonlander or ZSA Voyager like a vintage Omega: correct, specific, a little bit of a lecture.',
        ],
      },
      {
        heading: 'JAPANESE MINIMALISM WINS',
        headingJp: '日本的ミニマリズム、勝つ',
        paragraphs: [
          'You cannot talk about where coder fashion is now without acknowledging that Japan has won. The quiet heavy cotton came from Uniqlo. The off-white canvas tote came from Muji. The keyboard came from PFU. The sensibility — that a well-made plain object is more luxurious than a branded one — came from fifty years of Tokyo doing precisely that.',
          'America\u2019s contribution to developer fashion was the free t-shirt. Japan\u2019s contribution was teaching the developer class that the absence of logos is not austerity but taste. In 2026 this is no longer contested. The hoodie is in the closet. The Uniqlo tee is on the body.',
        ],
      },
      {
        heading: 'CONFERENCE CLOTHING GETS SERIOUS',
        headingJp: 'カンファレンス、本気モード',
        paragraphs: [
          'Walk the hallway track at KubeCon EU this year and you will see something unfamiliar: suede loafers. Linen trousers in colors that were previously illegal. Charcoal polos that cost more than forty dollars. The fleece is still there — it is an American genre and it is not going anywhere — but it is now optional rather than automatic.',
          'This is the final defeat of the era in which "I did not think about my clothes" was a flex. Thinking about your clothes at a technical conference no longer reads as insecure; it reads as respectful. The audience knows the difference. The speaker who dressed deliberately is, on balance, taken slightly more seriously. The craft of the keynote includes the shirt.',
        ],
      },
      {
        heading: 'THE CAFÉ IS THE RUNWAY',
        headingJp: 'カフェは滑走路',
        paragraphs: [
          'Most of this gets performed not at conferences, where performance is legible, but at cafés, where it is constant and unconscious. A window seat at Blue Bottle Shibuya is the single most-photographed piece of developer fashion theater in the world, and almost none of the people in it know they are being observed. Three hours of uninterrupted work, two iced americanos, a Moleskine open to a page with six bullet points and a crossed-out fourth. The clothes are the clothes. The laptop is the laptop. The terminal is open.',
          'This is where a culture becomes visible to itself. The uniform is finalized not in the closet in the morning but in the public act of showing up in it — ordering quietly, opening the laptop, not looking up.',
        ],
      },
      {
        heading: 'WHAT THE CLOTHES ARE SAYING',
        headingJp: '服が語ること',
        paragraphs: [
          'There is a temptation to read all of this cynically — to say that developers have simply discovered that dressing well helps them close offers, raise rounds, and be taken seriously in rooms that were previously hostile to them. That reading is not wrong. But it is incomplete.',
          'The honest version is this: a craft culture is coming into its own, and a craft culture that respects itself produces its own uniform. Chefs in New York dress like chefs in New York. Architects in Copenhagen dress like architects in Copenhagen. Developers in Tokyo — and increasingly, in Brooklyn, Berlin, Taipei, Mexico City — are starting to dress like developers in Tokyo, which is to say: quietly, carefully, with good cotton and good objects, in clothes that will still be wearable in five years.',
          'The clothes are saying: we have been here a while, and we are going to be here longer. Dress accordingly.',
        ],
      },
    ],

    pullQuote: {
      text: 'The developer who dresses well has less to prove — and gets taken more seriously for it.',
      attribution: 'FROM A READER \u00b7 TOKYO',
    },

    signoff: '\u8857\u306e\u30b3\u30fc\u30c0\u30fc\u305f\u3061\u3078 \u2014 stay loose, stay quiet, stay warm.',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'in-house',
    copy: 'kernel.chat editorial',
    styling: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}
