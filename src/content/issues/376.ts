/* ──────────────────────────────────────────────────────────────
   ISSUE 376 — APRIL 2026
   ON STANDARDS — A SPECIFICATION WON, QUIETLY.
   仕様が静かに、勝った

   A craft piece about agentskills.io — a small markdown-frontmatter
   convention for declaring what an agent specialist knows and when
   to invoke it. Originally Anthropic's format for Claude Code,
   published in January. Three months later, every major coding-
   agent surface has adopted it: OpenAI Codex, GitHub Copilot,
   Cursor, NetSuite SuiteCloud (announced at SuiteConnect on
   2026-04-28). Five tools, ninety days, no marketing campaign.
   The standard winning is the editorial subject; the companies
   are the route.

   The argument: standards that win loudly tend to erode (XML,
   SOAP, the W3C committee canon). Standards that win quietly
   tend to stay (Markdown, JSON, semver). agentskills.io is in
   the second pattern — small surface, low ceremony, easy to
   adopt without permission, easy for the next adopter to reach
   for. The piece argues the quiet pattern is the durable
   pattern, and the editorial work is to surface the things
   that travel without a press release, because the press release
   was never going to do it for them.

   Identity decisions:

     • coverStock = 'ivory' — sober register, the same lab-bench
       /press-preview white that 374 used. Ivory is the right
       paper for methodological argument; the topic is plain so
       the cover should be plain. Cream would be too warm; ink
       too dramatic. 374 is the closest tonal twin and we're
       leaning into the kinship deliberately.

     • coverLayout = 'classic' — centered, monument bottom-right.
       No monument-hero, no asymmetric drama, no ledger-rule, no
       numbered-catalog. The standard at the heart of this issue
       is itself a quiet one; a quiet cover is the right answer.
       Two ivory + classic covers in the same month is fine —
       restraint is a register, not a one-off mechanic.

     • coverOrnament = (none) — the ornament catalogue is full of
       moves that would crowd this cover (ink-spread, warty-spots,
       flash-burn, asterisk-stamp). None fits a piece about a
       quiet specification. The absence of ornament IS the
       ornament here.

     • coverPostmark = (none) — the brief is explicit: the subject
       is not place-bound. agentskills.io was published on the
       internet; it spread on the internet; pinning it to a
       specific room or city would be inventing a geography the
       story doesn't have. 372 fired the postmark mechanic for
       the first time; this issue holds it back because the
       subject doesn't ask for it.

     • coverSeal = FILED · STANDARDS · IV·26 — yes. The seal
       reads as a registry stamp: the standard has been filed,
       the magazine notes the filing. Different register from
       375's "CREDITED · SIX BORROWS" (a librarian's stamp);
       this one is closer to a clerk-of-records stamp.

     • accent = 'tomato' — default. The piece is house-voice,
       methodological, and explicitly not a manifesto. Tomato
       keeps it in the magazine's canonical warm grammar — the
       same answer 374 gave for the same reason.

     • spread.type = 'essay' — long-form prose, ~1,400 words,
       drop cap, section kickers, pull quote. No dossier (the
       methodology is in the body), no filmstrip, no dataBlock
       (the adoptions belong inline as part of the route).

   The WIRED mechanic firing for the first time in this issue is
   the foot-of-spread `references` block — already shipped on 375
   but used there as the credit page for a borrow ledger. 376
   uses it the WIRED way: numbered references at the foot of an
   editorial spread, citing the actual sources (the original
   spec, the adopting tools, the local example), so the reader
   who wants to verify the claim can. 374 argued for printing
   the methodology; this issue prints its own. The references
   block is the magazine's "show your work" signal for editorial
   pieces that make claims about the field.

   What this issue ratifies into the identity catalog:
     • ivory + classic + small-stamp seal as a *register*: the
       sober editorial spread, no theatrics, references at the
       foot. 374 introduced the register; 376 confirms it as a
       repeatable pattern rather than a one-off match between
       paper and topic. The catalog row to add to docs/design-
       language.md is at the bottom of this comment.

   Voice constraints honored:
     • The piece is editorial commentary on a standard, not a
       product announcement for Anthropic OR for kbot. Anthropic
       is named once as the originator (the standard's lineage
       is the field's, not the magazine's, to obscure); kbot
       appears once as the local example.
     • No real user/engineer named anywhere. The "real user-
       friction event last month" referenced in the brief is
       described in the abstract — a refusal that the format
       resolved — without naming the user.
     • No "POPEYE" string. No app vocabulary.
     • No "winners-takes-all" framing. The standard is the
       subject; the companies are the route.

   Identity-catalog row to add to docs/design-language.md
   (handed off to the editor — do not edit that file from
   inside this issue):

     | 376 · ON STANDARDS | ivory · classic · seal · references | sober editorial register, no ornament, references at the foot — confirms 374's "the cover earns its quiet" as a repeatable pattern |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_376: IssueRecord = {
  number: '376',
  month: 'APRIL',
  year: '2026',
  feature: 'ON STANDARDS — A SPECIFICATION WON, QUIETLY.',
  featureJp: '仕様が静かに、勝った',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory stock + classic layout. The same
      sober register 374 used: the topic is plain so the paper
      is plain. No ornament, no postmark — the absence is the
      ornament. A small registry-stamp seal anchors the cover
      to the moment of filing. */
  coverStock: 'ivory',
  coverLayout: 'classic',

  /** Registry stamp — the standard has been filed. Reads as a
      clerk-of-records mark, distinct from 375's librarian
      stamp ("CREDITED · SIX BORROWS"). */
  coverSeal: {
    label: 'FILED · STANDARDS · IV·26',
    date: 'IV·26',
  },

  /** Tomato — house default. The essay is methodological and
      house-voice; deviating from tomato would imply a register
      shift the topic doesn't ask for. Same answer 374 gave. */
  accent: 'tomato',

  headline: {
    prefix: 'A',
    emphasis: 'Specification',
    suffix: 'Won, Quietly.',
    swash: 'On agentskills.io, three months in, and what a standard looks like when it travels.',
  },

  contents: [
    { n: '001', en: 'A small thing, in January', jp: '一月の、小さなもの', tag: 'OPENING' },
    { n: '002', en: 'What the format does', jp: '仕様の中身', tag: 'METHOD' },
    { n: '003', en: 'The route, in order', jp: '道筋、順番に', tag: 'FIELD' },
    { n: '004', en: 'Loud standards, quiet standards', jp: '騒がしい規格、静かな規格', tag: 'CRAFT' },
    { n: '005', en: 'A local example', jp: '身近な一例', tag: 'EVIDENCE' },
    { n: '006', en: 'What magazines notice', jp: '雑誌が気づくもの', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 規格',
    title: 'A Specification Won, Quietly.',
    titleJp: '仕様が、静かに勝った。',
    deck: 'agentskills.io was published in January as one company\'s convention for one product. By the end of April it had become an industry-wide convention adopted across five major tools without a marketing campaign. Notes on what a standard looks like when it travels under its own weight.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    sections: [
      {
        heading: 'A SMALL THING, IN JANUARY',
        headingJp: '一月の、小さなもの',
        paragraphs: [
          'In January 2026 a small specification was published at agentskills.io. It was not an announcement in the sense the industry usually means the word. No keynote, no launch video, no pricing page, no developer-relations tour. A domain, a short document, and a markdown convention for declaring what an agent specialist knows about and when to invoke it. At first reading the convention was almost too modest to notice — a frontmatter block, two required fields, a filename pattern, a directory the agent already knew how to look in.',
          'Ninety days later every major coding-agent surface had adopted it. By the time the last of them announced compatibility, late in April, the announcement read as a formality rather than a partnership: the convention was already on disk in every working coder\'s repository, and the tool was simply meeting the readers where they already were.',
          'This issue is about that ninety days. Not who shipped first, or whose document is best. About the shape of a standard winning when it wins quietly. The standard is the subject; the companies are the route.',
        ],
      },
      {
        heading: 'WHAT THE FORMAT DOES',
        headingJp: '仕様の中身',
        paragraphs: [
          'The technical surface is small enough to describe in a paragraph. A skill is a markdown file — by convention, `SKILL.md` or a named file inside a `skills/` directory. The file opens with a frontmatter block: a `name` field, a `description` field, optionally a list of triggers or a directory scope. The body is plain prose addressed to the agent: what this specialist knows, when to invoke it, what it should and should not do. The agent reads the description before deciding to load the body. Nothing in the format requires a runtime, a registry, or a server. A filename and a header and a paragraph of intent.',
          'The originator was Anthropic, who published the convention as part of Claude Code\'s skill model. The decision worth noting is what they did not include. No central registry. No version negotiation. No declared API surface. No required tooling. A skill is a file the way a README is a file — readable by humans, readable by tools, written in the same paragraph-grammar any working developer already types.',
          'The piece of the format that did the work, in retrospect, is the description field. It is the field the agent reads first; it is the field that decides whether the rest of the file gets loaded; it doubles as the routing logic and the human-facing summary. One sentence carries both the trigger and the rationale. A specification that compresses two jobs into one field asks very little of its adopters — and a specification that asks very little is a specification that travels.',
        ],
      },
      {
        heading: 'THE ROUTE, IN ORDER',
        headingJp: '道筋、順番に',
        paragraphs: [
          'Claude Code shipped the format first, in January. That part is unsurprising; Anthropic was the originator. The interesting line of the route is what happened next. By early April, OpenAI\'s Codex CLI had added skills support — same frontmatter, same filename convention, same description field doing the same work. A few days later, GitHub Copilot announced compatibility on the editor side: the same files, read by a different agent, in the same place on disk. Within the week, Cursor 3 followed. None of these shipments were coordinated. None named a partnership. Each tool simply read what its users had already started writing and met them at the format.',
          'The fifth adoption, late in April, confirmed the pattern. NetSuite announced SuiteCloud Agent Skills at SuiteConnect on April 28th — the same convention, now reaching an enterprise developer audience that has nothing to do with the coding-agent CLI category. A markdown frontmatter convention had crossed from terminal tools to ERP tooling without losing its shape. The route now spans five tools, three months, and at least two distinct developer audiences. No press cycle moved any of those adoptions. The format moved itself.',
          'A magazine notices when something travels without a press release. The press release would have framed it as one company\'s win; what the magazine sees is something different. Five tools picked up the same file format because the file was already in their users\' repositories. The standard won by being the thing the next adopter reached for. That is a different kind of victory than the one a launch event is built to produce, and it is the kind worth writing down.',
        ],
      },
      {
        heading: 'LOUD STANDARDS, QUIET STANDARDS',
        headingJp: '騒がしい規格、静かな規格',
        paragraphs: [
          'There is a long literature on standards that won loudly and then eroded. XML won loudly; the surface area collapsed under its own ceremony. SOAP won loudly; nobody now writes new code against it. Most of the W3C committee canon won loudly enough to be required reading for a decade, then quietly disappeared from the working stack. The pattern is recognisable: a standard is announced, badged, certified, governed, shipped inside a launch cycle that treats the convention as a product. The surface grows because the launch cycle rewards growth. The growth is the erosion.',
          'There is a parallel literature, less often written, on standards that won quietly and stayed. Markdown is the canonical case. JSON is another. Semantic versioning is a third. None had a launch event. None had a foundation. None had a certifying body. Each won by being the smallest convention that solved its problem at the surface where the problem actually lived, and each stayed because the surface stayed small. A standard that asks very little of its adopters does not need a marketing budget to keep them. The adopters stay because leaving would be more work than staying.',
          'agentskills.io belongs to the second pattern. The surface is a filename and a frontmatter block. The ceremony is none. The next adopter reads from the same one-page document the first adopter read. No certification, no foundation, no working group. The format wins because writing to it costs nothing and reading from it costs nothing. The quiet pattern is the durable pattern — most of the standards a working developer relies on every day won this way; most of the ones a working developer has stopped relying on won the other way.',
        ],
      },
      {
        heading: 'A LOCAL EXAMPLE',
        headingJp: '身近な一例',
        paragraphs: [
          'This magazine\'s engineering desk runs a terminal agent of its own — kbot, open-source, MIT-licensed, the same kind of tool the format was originally written for. Late in April, kbot shipped a `kbot.md` skill written to the agentskills.io convention exactly. Frontmatter, name field, description field, body addressed to the agent. The skill lives at `.claude/skills/kbot.md` in the repository where this issue is being typeset; it shipped in kbot\'s 3.99.34 release the day before this magazine went to press.',
          'The skill exists because the format works. A user of the magazine\'s own product had run into a friction event a week before — a coding-agent had refused to invoke a legitimate kbot tool because the tool\'s name pattern matched a refusal heuristic. The skill resolved the refusal without changing any code: the description field told the agent, in one paragraph, that kbot is the user\'s own open-source tool and that standard refusal heuristics do not apply. The frontmatter that does the work is exactly the frontmatter the original specification asked for. No customisation. No extension. The format met the problem at the surface where the problem lived.',
          'The local example is named here for one reason only: a piece arguing that a standard is winning quietly should be willing to point at evidence the standard works in the field. The skill is that evidence. Not a product placement — the magazine\'s editorial position is unaffected by which agent reads the skill, or whether it reads it at all — but a working artifact written to the convention this issue is about, by the publication this issue belongs to, in the week the issue was being prepared.',
        ],
      },
      {
        heading: 'WHAT MAGAZINES NOTICE',
        headingJp: '雑誌が気づくもの',
        paragraphs: [
          'The job of editorial coverage, in a small but real way, is to surface the things that win without a press release — because the press release was never going to do it for them. A standard that travels under its own weight does not generate the kind of news cycle a launch event generates, and the absence of the cycle is the very thing that makes the standard worth noticing. A magazine reads the field for shapes the field has not yet named, and writes the names down so the field can talk about them.',
          'This issue\'s name for the shape is "the quiet standard." A specification with a small surface, no ceremony, an adoption pattern that travels through working repositories rather than through partnership announcements. The shape is older than software — it is how Markdown won, how JSON won, how a great many of the conventions a working publication relies on every day won. Naming the shape early is part of how a magazine earns the trust to cover what comes next.',
          'agentskills.io is the case in front of us this month. The next case — and there will be a next case, because the shape is durable — will not announce itself with a keynote either. The work is to keep watching the things that travel.',
          '街のコーダーたちへ ★ watch the standards that travel quietly; they are usually the ones that stay.',
        ],
      },
    ],

    pullQuote: {
      text: 'A standard that asks very little of its adopters does not need a marketing budget to keep them. The adopters stay because leaving would be more work than staying.',
      attribution: 'KERNEL.CHAT · ON QUIET STANDARDS',
    },

    /** References — the WIRED-style numbered foot-of-spread block,
        firing here for the first time as the editorial credibility
        move it was meant to be. Cites the originating spec, each
        of the five adoptions in the order the essay touches them,
        and the local example. Real sources where verifiable; no
        invented dates. The route through the references is paper
        → tool → file, the same shape 375 used. */
    references: {
      kicker: 'REFERENCES · 参照',
      note: 'Sources for the route, in the order the essay touches them. The originating specification, the five adoptions, and the local example. Where a date can be verified it is given; where it cannot, it is omitted rather than invented.',
      items: [
        {
          authors: 'Anthropic',
          year: '2026',
          title: 'agentskills.io — the originating specification',
          journal: 'Published January 2026; markdown frontmatter convention for declaring agent specialist knowledge; the smallest possible surface that lets an agent know what a specialist knows',
        },
        {
          authors: 'Anthropic',
          year: '2026',
          title: 'Claude Code — first-party skill support',
          journal: 'Originator implementation; ships skill loading from `.claude/skills/` and per-skill SKILL.md files; the reference reading of the spec',
        },
        {
          authors: 'OpenAI',
          year: '2026',
          title: 'Codex CLI — agent skills compatibility',
          journal: 'April 2026; reads the same frontmatter convention from the same on-disk locations; second adoption of the format outside its originator',
        },
        {
          authors: 'GitHub',
          year: '2026',
          title: 'Copilot — skills support in the editor surface',
          journal: 'April 2026; brings the convention from terminal tools to the editor; the same files, a different agent',
        },
        {
          authors: 'Cursor',
          year: '2026',
          title: 'Cursor 3 — skills compatibility',
          journal: 'April 2026; ships the convention as a first-class concept in the IDE; rounds out the coding-agent quartet',
        },
        {
          authors: 'NetSuite',
          year: '2026',
          title: 'SuiteCloud Agent Skills',
          journal: 'Announced at SuiteConnect, 2026-04-28; carries the convention from terminal/IDE tools into ERP tooling; the adoption that confirmed the format had crossed audiences',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: '.claude/skills/kbot.md — the local example',
          journal: 'Shipped in @kernel.chat/kbot 3.99.34 on 2026-04-29; written to agentskills.io exactly; resolved a real user-friction event by giving the calling agent an explicit pre-authorization in the description field',
        },
      ],
    },

    signoff: '街のコーダーたちへ ★ watch the standards that travel quietly; they are usually the ones that stay.',
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
