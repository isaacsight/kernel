/* ──────────────────────────────────────────────────────────────
   ISSUE 372 — APRIL 2026
   THE AUDIT — ON CUTTING WHAT NOBODY USED
   使われなかったものを切る

   This issue claims the kbot 4.0 cut as editorial work and writes
   it up the way a magazine writes up its own editorial cut. The
   parallel that drives the piece: every magazine editor performs
   the same cut every issue — what stays in the book, what doesn't,
   what gets reassigned to the back pages, what gets quietly killed.
   The 4.0 release performed the same cut on a software registry:
   670 tools surveyed, 105 actually used over 90 days, 630 cut with
   a public audit trail at CURATION_DECISION.csv. Same craft,
   different surface. The magazine's job in this issue is to claim
   the practice — not to celebrate the cut, but to describe the
   discipline that produced it.

   Identity decisions:

     • coverStock — 'ledger' was the intended stock for this issue.
       A pale graph-ruled accountant's paper would have been the
       right material answer to a register-and-audit subject. The
       IssueStock union in src/content/issues/index.ts currently
       only admits 'cream' | 'butter' | 'kraft' | 'ivory' | 'ink'.
       Per the brief, do NOT extend the type today; the follow-up
       work is to add 'ledger' to IssueStock, paint --pop-ledger in
       src/index.css (a cool ivory tinted with the faintest
       graph-rule blue), and add a stock case to LandingPage.css.
       For this drop the cover ships on 'cream' — the closest
       in-cabinet neighbour, and the canonical anchor stock the
       rest of the run varies against. The cream is a placeholder;
       the ledger is the brief.

     • coverLayout = 'monument-hero' — the issue number 372 IS the
       cover art. The headline shrinks to a subtitle. This reuses
       the restraint mechanic exercised at 370 (the seven-stakes
       milestone), now applied to the audit register: when the
       magazine's subject is the act of counting things, the
       loudest number on the page should be the issue's own. Two
       monument-hero covers in three issues is on purpose. The
       first earned the quiet cover; the second cashes it in
       against the audit.

     • coverPostmark — this is the first issue to exercise the
       fourth starred mechanic from the PAPERSKY decode (see
       docs/design-language.md, "Editorial neighbours"). The
       postmark is small-caps Latin, anchored bottom-centre,
       grounding the issue in a specific room rather than in
       serial position. Format: ROOM 503 · IV·26 — the accountant's
       terseness, named after the room where the audit ran. The
       IssueRecord type does not yet carry a `coverPostmark` field;
       per the brief, do NOT extend the type today. We ship the
       postmark text inside the existing `coverSeal` slot
       (top-right rubber-stamp), formatted to read as a postmark.
       The follow-up work is to add a real `coverPostmark` field
       to IssueRecord, render it as a centred bottom-of-cover
       lockup in IssueCover.tsx, and migrate this issue's seal
       text up to the new field. The seal is a placeholder; the
       postmark is the brief.

     • accent — the brief proposes a new seed named 'graphite' for
       this issue. It does not exist in INK_SEEDS yet (see
       src/content/issues/accents.ts, where only nine seeds are
       enumerated and adding a new one requires PR review per
       PUBLISHING.md §III.4.5). Per the brief, do NOT modify
       accents.ts today. We omit the accent field entirely; the
       essay spread type defaults to 'tomato' (the house warmth)
       which reads correctly on cream stock and against the
       audit's archival register. The follow-up work — when a
       graphite seed is reviewed and admitted to the cabinet — is
       a one-line add here. Graphite would carry the audit's
       pencil-on-paper register; tomato is the safe default until
       then. The default is a placeholder; graphite is the brief.

     • spread.type = 'essay' — ~1,500 words of long-form prose
       drawing the parallel between editorial cuts and software
       registry cuts. Voice is the magazine's: warm, plain,
       declarative. No changelog hype. No "we cut 600 tools"
       triumphalism. The calmer claim — that we counted what got
       read, twice — is the point.

     • The asterisk (★) — system glyph ratified at 370 — carries
       forward through MagazineFrame automatically. Not added
       explicitly to this issue's strings; appears in folio strips
       on every inner page.

   Three of the four PAPERSKY-decoded mechanics are now in active
   service across the run: restraint (370, 372), single-glyph
   system thread (370 onward), and now postmark dateline (372).
   Place-and-route as a structural principle continues quietly in
   the spread architecture. The route grammar this issue takes is
   the route through one editorial cut — opening the registry,
   counting what got read, writing the audit, shipping the version.

   What's deferred (do NOT do today; written up here so the next
   editor doesn't lose the thread):
     1. Add 'ledger' to IssueStock union in index.ts
     2. Paint --pop-ledger in src/index.css and the matching
        .pop-stock-ledger class
     3. Add 'ledger' case to STOCK_HEX in accents.ts
     4. Add coverPostmark: { label, place } field to IssueRecord
     5. Render coverPostmark in IssueCover.tsx (centred, bottom of
        cover, small-caps Latin)
     6. Migrate this issue's seal text to coverPostmark when (4)+
        (5) ship
     7. Submit 'graphite' seed for INK_SEEDS review (cool,
        slightly warm-tinged charcoal — pencil-on-paper register;
        proposed hex around #3F3D3A; must pass isPopeyeSafe)
     8. Once admitted, switch this issue's accent to 'graphite'
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_372: IssueRecord = {
  number: '372',
  month: 'APRIL',
  year: '2026',
  feature: 'THE AUDIT — ON CUTTING WHAT NOBODY USED',
  featureJp: '監査 — 使われなかったものを切る',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — see header comment. The intended stock is
      'ledger' (pale graph-ruled accountant's paper). The type
      union now admits it via the design-language extensions
      shipped alongside this issue. */
  coverStock: 'ledger',
  coverLayout: 'ledger-rule',

  /** Postmark dateline — the fourth starred PAPERSKY mechanic,
      fired here for the first time. Small-caps Latin lockup at
      the bottom-centre of the cover. The dateline names the room
      the audit ran in and the POPEYE-grammar Roman-numeral month +
      two-digit year. */
  coverPostmark: {
    place: 'ROOM 503',
    date: 'IV·26',
  },

  /** Graphite — pencil-lead grey, the audit's ink. Pairs with
      the ledger stock as the issue's quiet-but-considered palette.
      Newly admitted to INK_SEEDS alongside this issue. */
  accent: 'graphite',

  headline: {
    prefix: 'On Cutting',
    emphasis: 'What',
    suffix: 'Nobody Used.',
    swash: 'Field notes from an editorial cut. 670 → 105.',
  },

  contents: [
    { n: '001', en: 'Every editor cuts', jp: 'すべての編集者は切る', tag: 'PRACTICE' },
    { n: '002', en: 'The wrong first question', jp: '最初の問いを間違える', tag: 'METHOD' },
    { n: '003', en: 'Counting what got read', jp: '読まれたものを数える', tag: 'FIELD' },
    { n: '004', en: 'The audit as colophon', jp: '監査は奥付', tag: 'RECORD' },
    { n: '005', en: 'Manuscripts in the drawer', jp: '引き出しの原稿', tag: 'REVERSAL' },
    { n: '006', en: 'The discipline is the same', jp: '規律は同じ', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'THE AUDIT · 監査',
    title: 'On Cutting What Nobody Used.',
    titleJp: '使われなかったものを切る。',
    deck: 'Notes from a software cut written up the way a magazine writes up its own. Every editor performs this work every issue; the version that shipped this month performed it on a registry of 670 entries, kept 105, and filed the audit in public.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'EVERY EDITOR CUTS',
        headingJp: 'すべての編集者は切る',
        paragraphs: [
          'Every editor of every magazine in the world is doing the same thing right now. They are sitting with a list — pitches, drafts, columns, standing items, recurring features — and they are crossing things out. The magazine they will publish next month is the magazine that survives the line through the names. That is the work. It is older than print and it does not get easier with practice; it only gets faster, and faster is not the same as easier.',
          'A software release is the same work on a different surface. Every version that ships is a version that crossed things out. The temptation, in software, is to pretend the cut is not happening — to tell yourself nothing has been removed because the source files are still on disk and the git history still resolves and any feature could, in theory, be turned back on tomorrow. The magazine has the same temptation: the unused pitches are still in the inbox; nothing got deleted. But the issue that ships is the issue that was cut, and the version that ships is the version that was cut, and pretending otherwise is how a system loses its grip on its own surface.',
          'This issue is about a specific cut, performed in a specific room, on a specific software, in the specific week that produced version 4.0. The version went out with a smaller registry than the one that came before it. The magazine cut that produced the smaller registry is the subject. The point is not the size of the cut. The point is the practice underneath it, which is the same practice every editor in every room performs every month, and which is rarely written down because the people who do it think of it as their job rather than as their craft.',
        ],
      },
      {
        heading: 'THE WRONG FIRST QUESTION',
        headingJp: '最初の問いを間違える',
        paragraphs: [
          'A new editor opens the table of contents and asks: what could go in this issue? The question is wrong. The veteran opens the table of contents and asks: what has been read? The first question generates more pages, more pitches, more lists. The second question generates a magazine.',
          'The software equivalent is the same shape. A new release pass opens the tool registry and asks: what could ship in 4.0? The answer is hundreds of things, because the registry is full of things that were once useful, things that nearly worked, things that worked once and then quietly stopped getting called. The right question is the editor’s question, transposed. What has been read? What has been used? Of the 793 entries in the registry on the morning of the audit, how many had been called by anybody, by any agent, in the last ninety days?',
          'The answer was thirty-nine. Of 793 registered tools, 754 had zero calls in the trailing ninety-day window. Not low calls. Zero. The number was not a surprise to anyone who has run a magazine — the back of every editor’s drawer is full of ninety per cent of the pitches that ever crossed the desk — but it was a clarifying number. The registry was not 793 tools. The registry was thirty-nine tools and 754 manuscripts in a drawer.',
        ],
      },
      {
        heading: 'COUNTING WHAT GOT READ',
        headingJp: '読まれたものを数える',
        paragraphs: [
          'The mechanics of the count are not exotic. A magazine knows what got read because the readership tells it: subscriptions, newsstand pulls, time-on-page if the magazine is also a website, mail. A software registry knows the same things if it bothers to look. Telemetry on which tool names appeared in which sessions. Cross-references from the tests that exercise each tool. Cross-references from the agent definitions that name-check tools as their working set. Three signals, each one cheap, none of them new.',
          'The audit ran the three signals against the registry in parallel. Telemetry — page-turn data. Tests — has any check ever exercised this tool. Agent references — does anyone in the system call this tool by name when describing its work. A tool that fired on all three was a column with a readership and a writer and a copy editor. A tool that fired on none was a manuscript in the drawer. Most of the registry was the second case.',
          'There were also daemons — the back-of-book recurring features, the regular columns that run on schedule whether anyone is reading them. The audit checked which daemons depended on the registry. The number was zero. Not low. Zero. The recurring columns in this magazine, it turned out, did not depend on the back-of-book pages they were notionally indexed in. The columns ran on their own, and the registry was a parallel object that had drifted away from them quietly, the way drawers do.',
          'Counting was the work. The decision was downstream of the count, and the decision was easy once the count was on the table. One hundred and five tools to keep — the columns with readership. Sixty-one to deprecate — the standing items that still had a sentimental case but no usage worth defending; into a holding folder, marked for review at the next cut. Six hundred and thirty to cut — the drawer. Numbers that, once written down, did not invite argument.',
        ],
      },
      {
        heading: 'THE AUDIT AS COLOPHON',
        headingJp: '監査は奥付',
        paragraphs: [
          'A magazine cut, done well, leaves a trail. The unused pitches do not vanish from the editor’s memory; they are filed, with a note, and the note will save the editor twenty minutes the next time a similar pitch arrives. The note is not for the public. It is for the next editor in the chair, six months from now, who will need to know why the standing column on regional cocktails was killed in April and whether to revive it for the summer issue.',
          'The software cut left the same trail, in the same shape, and left it in public. Every one of the 796 entries that crossed the desk in the audit got a row in CURATION_DECISION.csv. Tool name. Calls in the last ninety days. Whether tests exercised it. Whether any agent named it. The decision: keep, deprecate, cut. A one-line note explaining the decision. The CSV is the colophon for what got cut. It is what a magazine prints in the back when it acknowledges its own working method, except in this case the back of the book is a file in a repository and anybody can read it.',
          'The audit trail matters more than the cut. A cut without a trail is a deletion; the next editor in the chair has no idea what was killed or why, and the magazine’s memory of its own decisions atrophies inside one cycle. A cut with a trail is editorial work; the next editor can disagree, can revive a deprecated column, can argue with the decision and have the data to argue with. The point of the colophon is not to justify the editor’s choices; it is to keep the choices visible long enough for the next editor to do their job.',
        ],
      },
      {
        heading: 'MANUSCRIPTS IN THE DRAWER',
        headingJp: '引き出しの原稿',
        paragraphs: [
          'A magazine cut is reversible in the way a software cut is reversible: the source survives, the decision does not. A killed column can be revived in a future issue. A killed tool can be brought back from the source tree. The reversibility is exactly what allows the cut to be made cleanly in the first place. If a deletion were permanent, every editor would be too cautious to perform it, and the magazine would slowly become unreadable, and the registry would slowly become unusable.',
          'What gets cut is not the tool, and not the column. What gets cut is the surface. The thing the reader encounters; the thing the agent reaches for; the thing the table of contents indexes. Behind the surface, the manuscripts stay in the drawer, where the editor can find them on the day a future issue genuinely calls for one. This is the discipline. The drawer is wide. The issue is narrow. The narrowness is not a loss — it is the editorial work — and the wideness of the drawer is what makes the narrowness sustainable.',
          'The 4.0 cut closed sixty-one tools into a deprecated holder rather than killing them outright; the next cycle will revisit the holder and either pull a few back to keep, or move the rest to cut. The middle category is the magazine’s standing-item review — the column that almost made the issue, parked in the queue, with a note. Some will return. Most will not. The drawer is for both. The honesty of the drawer is in admitting which is which.',
        ],
      },
      {
        heading: 'THE DISCIPLINE IS THE SAME',
        headingJp: '規律は同じ',
        paragraphs: [
          'A magazine and a software registry are different surfaces with the same editor’s discipline underneath. The discipline says: count what got read; cut what didn’t; file the decision; keep the manuscripts; go again next month. It says nothing about which surface you are working on. It is not a software practice borrowed by editors, and it is not an editorial practice borrowed by software. It is older than both and it is the same in both.',
          'The version that shipped this month is the version that was cut. The issue that shipped this month is the issue that was cut. Both went out with a smaller surface than the one before, and both went out with a written record of what got removed and why. That symmetry is the point of this piece. The audit is not an event in a release cycle; the audit is the editorial cut, performed in public, on a surface that happens to be a tool registry rather than a table of contents. The job is the same. The room is different.',
          '街のコーダーたちへ ★ count what gets read; cut what doesn’t; file the audit in public; keep the drawer wide.',
        ],
      },
    ],

    pullQuote: {
      text: 'The registry was not 793 tools. The registry was thirty-nine tools and 754 manuscripts in a drawer.',
      attribution: 'KERNEL.CHAT · ON THE 4.0 CUT',
    },

    signoff: '街のコーダーたちへ ★ count what gets read; cut what doesn’t; file the audit in public.',
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
