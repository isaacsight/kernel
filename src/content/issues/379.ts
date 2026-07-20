/* ──────────────────────────────────────────────────────────────
   ISSUE 379 — MAY 2026
   ON BECOMING A REAL MAGAZINE
   本物の雑誌になるということ — 五つの欠けている動き

   The audit issue. 378 graded the security-audit field; 379 grades
   the magazine itself. Five concrete moves the frame has not made
   yet, named in plain language, ranked by leverage. The piece is
   not a roadmap — roadmaps belong in V5_FUTURES_PLAN. The piece is
   the editorial position that explains *why* these are the next
   moves, written so a reader who has never opened the design-
   language doc can still follow the argument.

   Identity decisions:

     • coverStock = 'ledger' — auditing ourselves; same pale
       graph-ruled accountant's paper that signaled THE AUDIT (372)
       and ON THE BENCH (378). The three-issue arc — 372/378/379 —
       now reads as a small filed-pattern series, the magazine
       holding itself to the same bench it built for everyone else.

     • coverLayout = 'classic' — centered, monument bottom-right.
       The headline carries the work; the move is honest, not
       theatrical.

     • coverOrnament = (none) — explicit. A piece about restraint
       does not get a decoration on the cover.

     • coverPostmark = (none) — the magazine has no geography. The
       work is published from the same place that wrote it.

     • coverSeal = FILED · IN-HOUSE · V·26 — small clerk-of-records
       stamp matching the audit register.

     • accent = 'graphite' — explicit. Reuses the audit-register
       accent introduced in 372 to keep the filed-pattern arc tonally
       coherent. (Olive would have read as a callback to 378, which
       isn't the move; this issue is filed, not graded.)

     • spread.type = 'essay' — five named moves, prose carrying the
       argument, drop cap on the lead, tomato pull-quote, sign-off.
       No bullet-list shortcuts; the ranking earns its order in the
       text.

   Voice constraints honored:
     • Self-aware, slightly dry, never aspirational.
     • No "we are excited to" register. No promotional language.
     • Names what is missing without apologizing for missing it.
     • Treats the reader as a peer who already knows what a
       magazine is and can judge whether the argument is honest.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_379: IssueRecord = {
  number: '379',
  month: 'MAY',
  year: '2026',
  feature: 'ON BECOMING A REAL MAGAZINE',
  featureJp: '本物の雑誌になるということ — 五つの欠けている動き',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ledger stock + classic centered layout.
      Audit register; the magazine filing itself. */
  coverStock: 'ledger',
  coverLayout: 'classic',
  accent: 'graphite',

  /** Back cover — a printer's composing stick with hand-set wood
      type spelling ISSUE. The verso the magazine asked for in
      this exact issue, given retroactively to the issue that
      asked for it. Cream stock — the artefact's natural surface
      and the issue's own front register. Image is shape (5)
      AI-generated placeholder per spec §XI addendum; commission
      pending. */
  backCover: {
    subject: "PRINTER'S COMPOSING STICK WITH WOOD-TYPE 'ISSUE'",
    subjectJp: '組版用ステッキ',
    stock: 'cream',
    image: '/back-covers/379-back.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  coverSeal: {
    label: 'FILED · IN-HOUSE',
    date: 'V·26',
  },

  headline: {
    prefix: 'On Becoming a',
    emphasis: 'Real',
    suffix: 'Magazine',
    swash: 'Five moves the frame hasn’t made yet.',
  },

  contents: [
    { n: '001', en: 'A magazine that looks like a magazine', jp: '雑誌に見える雑誌', tag: 'PREMISE' },
    { n: '002', en: 'Print, before everything', jp: 'まず印刷', tag: 'MOVE I' },
    { n: '003', en: 'The photography we don’t take', jp: '撮らない写真', tag: 'MOVE II' },
    { n: '004', en: 'A signature for each issue', jp: '号ごとの署名', tag: 'MOVE III' },
    { n: '005', en: 'A back to every cover', jp: '裏表紙という面', tag: 'MOVE IV' },
    { n: '006', en: 'The archive, made browsable', jp: '見える書庫', tag: 'MOVE V' },
    { n: '007', en: 'The one move that comes first', jp: '最初の一手', tag: 'VERDICT' },
  ],

  spread: {
    type: 'essay',
    kicker: 'AUDIT SPREAD · 自己採点',
    title: 'On Becoming a Real Magazine.',
    titleJp: '本物の雑誌になるということ。',
    deck: 'We made a magazine that looks like a magazine. We have not yet made a magazine. Five moves the frame hasn’t made.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ledger',

    sections: [
      {
        heading: 'A MAGAZINE THAT LOOKS LIKE A MAGAZINE',
        headingJp: '雑誌に見える雑誌',
        paragraphs: [
          'It is worth saying out loud, since we have not before. Eighteen issues into the year — three hundred and seventy-eight back issues sitting in the catalog before this one — and the frame is in its strongest shape it has ever been. EB Garamond and Courier Prime carry every page. Tomato is the only spot color the press would need to mix. The asterisk has been ratified as the system’s single small mark. Six paper stocks signal six editorial registers. The print stylesheet collapses everything to a press-ready A4 with the spot color preserved. A reader who picks up the cover knows, within two seconds, what kind of object this is meant to be.',
          'And yet. The object has no edges. You cannot hold it. The photography layer is, by deliberate choice, empty. Every issue’s Japanese subtitle is set in the same EB Garamond as the body text — a typographic register, not a per-issue signature. Every cover is a front; no cover has a back. The catalog of three hundred and seventy-nine issues exists as a TypeScript array, not as a wall a reader can walk along. We made a magazine that looks like a magazine. We have not yet made a magazine.',
          'What follows is an audit, in five moves, of where the frame is missing. None of these moves require breaking the discipline — none ask for a third spot color, a second display font, or a fifth cover layout. They ask for the frame to do, in physical and per-issue terms, what it has so far only done in code.',
        ],
      },
      {
        heading: 'PRINT, BEFORE EVERYTHING',
        headingJp: 'まず印刷',
        paragraphs: [
          'The first move is the largest and the simplest: ship a physical issue. The print stylesheet has existed since 360. It has been tested on every release. The tomato is preserved as a press spot color, the stocks collapse cleanly to white, the interactive chrome is hidden, the URLs are exposed beside the inline links. Hit ⌘P from any route and the page becomes a PDF that a small-run printer would accept without modification. The capability has been ready for a year. The artifact has not.',
          'A short-run risograph or two-color letterpress mailing — fifty copies, eighty pages, ledger-cream stock and tomato spot — would take kernel.chat from "magazine-styled site" to "real magazine that happens to also have a site." Print is the structural unlock. Everything else in this audit is style; this is the move that closes the loop on what the publication actually is.',
          'The cost of skipping it is real. Every discipline a printed magazine enforces — copy editing without an undo button, a single set of line breaks per spread, a colophon with the press named, a date on the masthead that is the date the ink dried — slackens, slightly, when no ink ever dries. The site can be edited in the night. The print issue cannot. That constraint is not a tax on the operation; it is the thing that makes the operation a magazine.',
        ],
      },
      {
        heading: 'THE PHOTOGRAPHY WE DON’T TAKE',
        headingJp: '撮らない写真',
        paragraphs: [
          'The toolkit doc has, in its own words, a "deliberately skipped" Photoshop layer. Images and textures are not part of the system. The discipline is good — most magazines drown in stock photography, and skipping the layer entirely has kept the frame from ever reading as a content-mill — but the discipline has now had eighteen issues to harden, and the cost is becoming legible. The magazine has no register for a place dispatch, no way to publish a maker profile that needs a face, no shape for a field report that wants an image and not a paragraph.',
          'The fix is not "start using photos." The fix is the variant the design language doc has already specced and never built: a single photo-postmark cover layout, brief in the PAPERSKY register — natural light, candid, place-led, white margin, no bleed, no studio gloss. One layout. One photographic voice. Used three or four times a year, not twelve.',
          'A magazine that does not use photographs at all is a magazine without a way to grieve, celebrate, or record. The frame deserves the surface; it should be built before the first issue that needs it lands without one.',
        ],
      },
      {
        heading: 'A SIGNATURE FOR EACH ISSUE',
        headingJp: '号ごとの署名',
        paragraphs: [
          'Every issue’s Japanese subtitle is currently set in EB Garamond. So is every issue’s English headline. The result is that, typographically, every issue looks like every other issue plus a different word. The cover stocks vary; the layouts vary; the headline word changes. The signature does not.',
          'PAPERSKY commissions a per-issue hand-drawn Japanese display word. The kanji for SHIMANAMI is not the kanji for HOKKAIDO is not the kanji for IZU. Each issue carries a single drawn mark that the issue afterward will not. The mechanic is small and the discipline is large: it forces every issue to be about something specific enough to draw a word for. It rewards the editor who picked a sharp subject. It makes the cover, even on a quiet issue, recognizably itself.',
          'This is not expensive — fifty to a hundred and fifty dollars per commission, three or four times a year, against a magazine that already carries an editorial budget. It is also a learnable hand for the editor who would rather draw than commission. The output, either way, is the same: each issue looks like itself in a way that no font alone can produce.',
        ],
      },
      {
        heading: 'A BACK TO EVERY COVER',
        headingJp: '裏表紙という面',
        paragraphs: [
          'Magazines have backs. Brutus uses the back for a recurring food still life. PAPERSKY, when it carries one, runs a single quiet image with the issue’s place name set small below it. The back cover is a surface a magazine cannot avoid having, because it is the surface a reader sees as often as the front — every time the issue is set down face-up on a table.',
          'The frame, as it stands, has no back. Every issue’s cover is a front; the inside flows into a feature; the feature ends with a sign-off; and then the issue ends. There is no verso surface, no recurring back-cover slot, no place for a kbot manifesto, a contributor portrait, an unannotated still life, or a single tomato spot under a small dateline.',
          'Adding one is not large work. A `coverLayout: "verso"` variant, a single optional field on `IssueRecord`, a one-page route. The hard part is editorial: deciding what kind of back the magazine should have, and then committing to that kind for thirty issues. The easy answer — a recurring still life, ledger stock, one object per issue, the kbot terminal as the only voiceover — is good enough to start. Better answers will arrive after the first ten backs have been printed and held.',
        ],
      },
      {
        heading: 'THE ARCHIVE, MADE BROWSABLE',
        headingJp: '見える書庫',
        paragraphs: [
          'There are now three hundred and seventy-nine issues. The Issue Identity Catalog, shipped earlier this month, gives each one a row in a typed array — accent, stock, headline, dateline, all queryable from code. What the catalog does not yet have is a visible surface a reader can browse. A magazine archive is, in any newsstand or library, a wall: spines lined up, each one slightly different from its neighbor, the run of color and form telling its own story before any single issue is opened.',
          'A `/catalog` route built around the existing data — small monument blocks for each issue, accent strip down the side, dateline below, hover for the feature title — would convert three hundred and seventy-nine TypeScript records into a wall that does the magazine’s history visible work. It is the move with the lowest cost and the highest discoverability return. It is also the surface that lets a new reader, arriving in the middle of the run, see what they have walked into.',
          'This is the only one of the five moves that asks for nothing the system does not already have. The data is in code. The primitives — `pop-monument`, `pop-folio`, accent tokens — are shipped. The build is one component and one route.',
        ],
      },
      {
        heading: 'THE ONE MOVE THAT COMES FIRST',
        headingJp: '最初の一手',
        paragraphs: [
          'Five moves. The temptation is to take the cheapest one first — the catalog wall, since the data is already there and the surface would land in a weekend. The temptation is wrong. Print is the move that comes first.',
          'The reason is simple. Each of the other four — photography register, hand-drawn signature, back cover, browsable archive — gets harder if it has to be designed twice, once for the screen and once for the page. If print is shipped first, every other move inherits its constraints automatically: the photo-postmark layout has to print, the JP signature has to print, the back cover has to print, the catalog wall has to print. The discipline radiates outward from the artifact. If print is shipped last, the magazine spends a year designing for a screen and then has to redesign half of it for paper.',
          'Print is also the move that changes the operation. Once a physical issue is in the mail every other month, the masthead means something it currently does not. The dateline becomes a deadline. The colophon names a press. The reader becomes a subscriber rather than a visitor. Everything that has, until now, been a stylistic choice — the warm stocks, the single spot color, the disciplined typography — becomes a press-room decision with a cost attached. The discipline tightens because the cost of slack is now visible.',
          'The other four moves are good. None of them are the move. Print is the move. Everything else is downstream.',
        ],
      },
    ],

    pullQuote: {
      text: 'The dateline becomes a deadline. The colophon names a press. The reader becomes a subscriber rather than a visitor.',
      attribution: 'FROM THE AUDIT · 社内',
    },

    signoff: '本物の雑誌になるために — file the audit; print the issue.',
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
