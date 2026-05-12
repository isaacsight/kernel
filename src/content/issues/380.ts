/* ──────────────────────────────────────────────────────────────
   ISSUE 380 — MAY 2026
   THREE IDIOMS
   三つの語法 — 画面ごとの正しい入力

   A craft / structural piece. The thesis: there is a right shape
   of agent input per surface, and the magazine has now lived long
   enough alongside three of them to see the pattern. Web is the
   DOM. Audio is OSC. Native macOS is Accessibility. Each surface
   publishes its own structure, and the agent's job is to consume
   that structure rather than the pixels printed on top of it. The
   piece names the recognition. Peekaboo's arrival in the kbot
   toolkit is the occasion that made the third column legible —
   but Peekaboo is not the subject. The recognition is the subject.
   The toolkit-news angle is filed quietly in the closing margin.

   Identity decisions:

     • coverStock = 'cream' — the anchor stock; the default
       register. This is a thesis piece, not a filing. Ledger
       belongs to audits — 372 (THE AUDIT), 378 (ON THE BENCH).
       The 376→378 filed-pattern arc is its own thing; this issue
       sits adjacent to that arc, not inside it. Cream signals
       "structural argument," the same way it did for 373 (ON
       COMPOSITION) — and 373 is the kinship line this issue
       inherits from most directly.

     • coverLayout = 'asymmetric-left' — mirroring 373 explicitly.
       373 argued that three tools occupy three different rooms
       and should not be ranked on a single axis; 379 argues that
       three surfaces deserve three different idioms and should
       not be driven through a single one (pixels). Same shape of
       claim; same shape of layout. The left-aligned editorial
       column lets the prose carry the argument, the way 373's
       cover did.

     • coverOrnament = 'asterisk-stamp' — chosen, not declined.
       The piece is a footnote-shaped argument: the magazine is
       naming the small mark that should have shipped beside the
       toolkit news but did not. The asterisk-stamp is the right
       ornament for an issue that says "the structure is the
       footnote we missed." Distinct from the system asterisk
       (★) that travels through every folio. 374 introduced this
       ornament for AGAINST VIRAL BENCHMARKS; 379 uses it for the
       same reason 374 did — the asterisk that should have been
       on the headline.

     • coverPostmark = (none) — explicit. The work is not
       geographically grounded. Web, OSC, AX — the three surfaces
       have no street address. Postmark would invent a geography
       the subject does not have. Same answer 377 and 378 gave
       for the same reason.

     • coverSeal = NOTED · IDIOMS · V·26 — the verb shifts. 376
       FILED · STANDARDS, 377 FILED · API TIER, 378 FILED · BENCH
       were all filings; this issue is a noticing. The pattern
       recognized itself this week and the seal records that
       moment. The kinship to the small filed-pattern arc is
       intentional but the verb is honest about what's different.

     • accent = 'cobalt' — explicit. Unused in 376/377/378 (those
       ran olive, tomato, tomato). Cobalt is the deep print blue
       the magazine reserves for systemic / structural arguments;
       cool register, three-column reading. Pool would have read
       as warmer infrastructure-talk; cobalt reads as the colder,
       quieter "this is how the field is shaped" voice the piece
       wants.

     • spread.type = 'essay' — the form here is an argument, not
       a comparison. The review spread (378) graded five routes
       on a rubric; this issue does not grade three idioms, it
       names them. Essay is the right tool. No dossier (the route
       is in the prose), no filmstrip, no dataBlock (no numbers
       carry the argument), no references block (the sources are
       toolkits, not papers — naming them in the body is enough).
       Three numbered sections, each titled by its idiom; a brief
       opening; a closing recognition; a small margin note at the
       end about kbot v4.4.0.

   The kbot-news discipline:

     • kbot v4.4.0 ships peekaboo_* tools and an AX-first
       computer-use fallback. That news is the occasion for the
       issue, not its subject. The body of the essay names the
       three surfaces and their idioms; the news is filed quietly
       in the closing paragraph as an example, the way a magazine
       reports its own shipping when the shipping is incidental
       to the editorial argument. House style: ISSUE follows the
       substrate, the substrate does not lead the ISSUE.
     • Tool names that appear by necessity (Chrome MCP, Playwright,
       AbletonOSC, Peekaboo) are facts about the surfaces. Not
       casting decisions. Not endorsements. Reported the way 377
       reported Mythos and Cyber.

   Voice constraints honored (per 377/378 establishing rules):
     • Sober, slightly puzzled, instructive. No selling.
     • No "POPEYE" string. No app/dashboard/widget vocabulary.
     • No "this changes everything" register. No "we are excited
       to" register.
     • The recognition is editorial; the toolkit news is incidental.
       The order in the prose enforces this — the pattern is named
       before any specific tool is.

   Identity-catalog row to add to docs/design-language.md (handed
   to the editor — do not edit that file from inside this issue):

     | 379 | cream | asymmetric-left | asterisk-stamp | seal: NOTED · IDIOMS · V·26 | cobalt | essay | First issue to bind cobalt as a structural-argument accent in source. Inherits 373's asymmetric-left lockup for the second time, confirming it as the magazine's structural-thesis layout. Adjacent to but not inside the 376/377/378 filed-pattern arc — verb shifts from FILED to NOTED, signaling a recognition rather than a filing. Reuses 374's asterisk-stamp ornament for the same reason 374 did: the small mark that should have shipped beside the headline |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_380: IssueRecord = {
  number: '380',
  month: 'MAY',
  year: '2026',
  feature: 'THREE IDIOMS',
  featureJp: '「三つの語法」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream stock + asymmetric-left layout, the
      same structural-thesis shape 373 used. The argument is
      another "different categories, not one axis" piece, this
      time at the level of input idioms. Asterisk-stamp ornament
      reused from 374 for the small-mark-as-footnote register. */
  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  /** Registry stamp — verb shifted from FILED to NOTED. Adjacent
      to the 376/377/378 filed-pattern arc but honest about being
      a recognition rather than a filing. */
  coverSeal: {
    label: 'NOTED · IDIOMS · V·26',
    date: 'V·26',
  },

  /** Cobalt — explicit. The deep print blue the magazine reserves
      for systemic / structural arguments. Unused in 376/377/378.
      Reads cool, quiet, three-column. */
  accent: 'cobalt',

  /** Back cover — a vintage 5-pin DIN MIDI cable, coiled, on a
      workbench. The cable is one of the three idioms named in
      the spread (OSC's wire ancestor); the verso resonates with
      the argument without illustrating it. Kraft stock: the
      workshop register, the right place for a piece of cable to
      rest. */
  backCover: {
    subject: 'VINTAGE 5-PIN DIN MIDI CABLE, COILED',
    subjectJp: '五芯DINケーブル',
    stock: 'kraft',
  },

  headline: {
    prefix: 'Three',
    emphasis: 'Idioms.',
    suffix: '',
    swash: 'On the right shape of agent input per surface — and the week three surfaces stopped being three accidents.',
  },

  contents: [
    { n: '001', en: 'The recognition', jp: '気づき', tag: 'OPENING' },
    { n: '002', en: 'The DOM', jp: 'ウェブ — DOM', tag: 'IDIOM I' },
    { n: '003', en: 'OSC', jp: '音響 — OSC', tag: 'IDIOM II' },
    { n: '004', en: 'Accessibility', jp: 'macOS — AX', tag: 'IDIOM III' },
    { n: '005', en: 'Pixels are the fallback', jp: 'ピクセルは控え', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 構造',
    title: 'Three Idioms.',
    titleJp: '三つの語法。',
    deck: 'Web is the DOM. Audio is OSC. Native macOS is Accessibility. Each surface publishes its own structure; the agent\'s job is to consume that structure rather than the pixels printed on top of it. Notes on a pattern that, after a third example arrived this week, stopped being three accidents and started being a shape worth naming.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE RECOGNITION',
        headingJp: '気づき',
        paragraphs: [
          'The pattern was hiding in plain sight for a year. Two of the three surfaces had been there since the beginning of the agent toolkit — a browser layer that talked to web pages, an audio layer that talked to a digital audio workstation — and each one was treated, internally, as a one-off. The browser one was "browser tools." The audio one was "Ableton tools." Neither was small, but neither was generalised; both worked, and that was enough. This week a third surface joined the toolkit, and the third surface had the same shape as the first two, and the shape did not look like a coincidence anymore.',
          'The shape is small enough to put in a sentence. Each surface — web, audio, native macOS — already publishes a structured description of itself, and the right way for an agent to act on that surface is to read the structure and act on the named elements inside it. Not to look at the pixels. Not to type into the position where a button appears to be. To read the tree the surface itself maintains, find the element by name or role, and call the action by its labelled name. Three surfaces, three trees, three idioms. One pattern.',
          'The piece below names the three idioms, in the order the toolkit grew them. The closing paragraph names the recognition. The margin reports the small toolkit news that made the third column legible.',
        ],
      },
      {
        heading: 'THE DOM',
        headingJp: 'ウェブ — DOM',
        paragraphs: [
          'A web page is, before it is anything else, a tree. Elements have tags and roles and names; ancestors contain descendants; every node has an addressable path. The browser publishes that tree continuously, in a form a script can query, and a hundred years of accessibility work — the screen-reader stack, the testing-framework stack, the assistive-technology stack — has been built on the assumption that automation should travel through the tree rather than the rendered surface. The Document Object Model is the surface\'s own description of itself, and the field has settled on it as the canonical input for non-human readers.',
          'The agents the magazine uses follow the same line. The Chrome MCP layer hands the agent a snapshot of the page as a tree of named elements, each with a stable reference; the agent says "click the element with reference 47" and the browser dispatches a click against the actual node, not against the pixel coordinate where the node happens to render. Playwright has worked this way for years; Selenium before it; the testing community has known the right idiom since at least 2010. The agent that uses pixels on a web page is the agent that lost the tree somewhere and is now guessing.',
          'Why it works: the browser publishes its own surface. The page is not opaque. The page is a document, in the literal sense — a structured text whose parts have names. An agent that reads the document is doing the thing the document was designed for. An agent that screenshots the document and types coordinates at it is doing a worse version of the same job, with no advantage and several costs.',
        ],
      },
      {
        heading: 'OSC',
        headingJp: '音響 — OSC',
        paragraphs: [
          'A digital audio workstation is also a tree, though most of its users will never see it as one. Tracks contain clips. Clips contain notes. Devices contain parameters. The Live Object Model — the structured description Ableton publishes of its own running session — names every track, every clip, every device, every parameter, and assigns each one an addressable path: live_set tracks 3 clip_slots 0 clip notes. Open Sound Control is the wire format the addresses travel in. The DAW publishes the tree; OSC carries the queries; the agent acts on the named nodes.',
          'AbletonOSC, the bridge the magazine\'s toolkit speaks to the DAW through, is a thin server that exposes the LOM over UDP. The agent says "create a clip on track 3, slot 0, two bars long, and write these eight notes into it"; the bridge translates that into a sequence of LOM operations; the DAW does the work and returns the new state. The agent does not move the mouse. The agent does not look at the screen. There is, in the audio idiom, no screen to look at — the screen is for the human; the agent talks to the model the screen is a view of.',
          'Why it works: the DAW publishes its own scene graph. Music software has, for decades, exposed structured automation surfaces — MIDI, OSC, plug-in parameter trees — because the people who use it have been automating it longer than the people who use web pages have been automating those. The audio world arrived at the right idiom early because its users demanded the right idiom early. The web world arrived at the right idiom by way of accessibility regulation. The destination, in both cases, is the same: addressable nodes, idempotent setters, queries before writes.',
        ],
      },
      {
        heading: 'ACCESSIBILITY',
        headingJp: 'macOS — AX',
        paragraphs: [
          'Native macOS applications are also trees, and most agents that drive them have been treating them as pixel grids anyway. The macOS Accessibility framework — AX, in the platform vocabulary — has, since the late nineties, exposed every running application\'s UI as a hierarchical tree of elements: windows contain panes, panes contain rows, rows contain cells, cells have roles and labels and assigned actions. VoiceOver reads the tree; the system shortcut menu reads the tree; the testing tools developers use to verify their own applications read the tree. The framework was built so that a blind user could navigate any well-formed Mac application by name. The framework, it turns out, is also exactly what an agent needs.',
          'Peekaboo, which the toolkit gained this week, is the layer that makes that tree available to an agent. It snapshots the AX hierarchy of any running application, assigns each element a stable identifier, and lets the agent perform the framework\'s named actions — set-value on a text field, perform-action on a button, scroll-to on a list row — by referring to the identifier. The pattern is the same as the browser\'s and the same as the DAW\'s: snapshot the tree, find the element by role or label, call the action by name. The macOS surface, like the other two, has been publishing its own structure all along. The agent\'s job is to read it.',
          'Why it works: macOS publishes its own UI tree, via AX, and has done so for twenty-five years. The framework is older than most of the applications running on top of it. The labels are already in the tree. The actions are already named. An agent that uses the framework gets, for free, the same legibility a screen reader has always had — and the agent that screenshots the screen gets, in exchange, an unreliable copy of information the operating system was already willing to hand over.',
        ],
      },
      {
        heading: 'PIXELS ARE THE FALLBACK',
        headingJp: 'ピクセルは控え',
        paragraphs: [
          'The recognition is the part the magazine wants to leave on the page. Each surface an agent operates on already publishes a structured description of itself — a DOM, a scene graph, an Accessibility tree. The agent should consume that structure. The pixels rendered on top of it are a last resort, used only when no published structure exists, and they should be marked, in the toolkit, as the fallback they are.',
          'For a year the magazine\'s own agent treated the three surfaces as three different problems. The browser layer was good; the audio layer was good; the macOS layer was a screenshot-and-coordinates layer because no one had wired the AX bridge yet. The third bridge arrived this week, and at the moment it arrived the three surfaces stopped being three accidents and started being a pattern. The pattern is older than any of them. The recognition is what is new.',
          'A web agent that reads the DOM is doing the thing the web was designed for. An audio agent that speaks OSC is doing the thing the DAW was designed for. A native-app agent that walks the Accessibility tree is doing the thing the operating system was designed for. The week the toolkit grew its third idiom is the week the magazine started writing this down — not because the news is large, but because the shape, once visible, is hard to unsee. The pixels are the fallback. The structure is the input. The right idiom is whichever idiom the surface is already publishing about itself.',
          '街のコーダーたちへ — read the tree the surface is already keeping; act on the names that are already in it; reach for the pixels last.',
        ],
      },
      {
        heading: '— MARGIN —',
        headingJp: '余白に',
        paragraphs: [
          'The kbot v4.4.0 release this week ships a peekaboo_* tool family and an AX-first fallback for the existing computer-use layer — the screenshot-and-coordinates path is now the second choice, behind a tree-walk against the running application\'s Accessibility hierarchy. That release is the occasion for this issue and not its subject. ISSUE follows the substrate, as house style requires; the substrate, as house style permits, occasionally suggests an issue.',
        ],
      },
    ],

    pullQuote: {
      text: 'The agent that uses pixels on a web page is the agent that lost the tree somewhere and is now guessing. The same is true for audio. The same, as of this week, is true for native macOS.',
      attribution: 'KERNEL.CHAT · ON THREE IDIOMS',
    },

    signoff: '街のコーダーたちへ — read the tree the surface keeps; the pixels are the fallback, not the input.',
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
