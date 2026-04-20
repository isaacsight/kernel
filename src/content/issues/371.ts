/* ──────────────────────────────────────────────────────────────
   ISSUE 371 — APRIL 2026
   AFTER HOURS — A LOS ANGELES CINEMATOGRAPHER OF THE ROOM
   アフターアワーズ — 部屋の撮影監督、ロサンゼルス

   The first cinematographer profile in the magazine. Subject is
   Dañiel Aügust (@thisisatool), a Los Angeles cinematographer
   whose body of work is built almost entirely inside the room —
   club nights, DJ sets (Kaytranada, Pharrell, Boiler Room),
   birthdays, cultural gatherings. The defining technical move is
   a dual-register approach to low light: warm tungsten and neon
   when the room provides the light, direct on-camera flash when
   the moment needs to be frozen at high contrast. The magazine's
   identity for this issue mirrors that move — but materially, not
   chromatically.

   Identity decisions:
     • coverStock = 'ink'           — the work happens after dark.
     • coverLayout = 'asymmetric-left' — editorial-column rhythm
                                        for a culture profile.
     • coverOrnament = 'flash-burn' — overexposed white wedge from
       the upper-right; reads as a Boiler Room flash hitting the
       cover. NEW ornament, introduced this issue. The dual-
       register is honored materially: the dark stock is the
       tungsten night, the white flash burns it.
     • coverSeal = FILED · AFTER HOURS · APR 2026 — names the
       beat. Stamped like a press credential.
     • spread.type = 'essay'        — long-form prose, not Q&A.
                                      Subject was described to the
                                      magazine; the magazine wrote
                                      the piece.
     • spread.dossier               — methods-paper card up top,
                                      subject coordinates.
     • spread.filmstrip             — NEW shared module: contact
       strip of frames pulled from his work, sits below the
       dossier so the reader sees the cinema before reading the
       prose about it.
     • signoff                      — issue-specific JP, replaces
       the standing 街のコーダーたちへ for one drop.

   Tomato remains the only spot color. An earlier draft introduced
   an ultramarine palette to honor the cool-flash register; it
   read as off-key against the magazine's warm POPEYE-coded grammar
   and was withdrawn before this draft. The dual register is
   carried by paper + ornament (ink stock + white flash-burn),
   not by a second chromatic accent.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_371: IssueRecord = {
  number: '371',
  month: 'APRIL',
  year: '2026',
  feature: 'AFTER HOURS — A LOS ANGELES CINEMATOGRAPHER OF THE ROOM',
  featureJp: 'アフターアワーズ — 部屋の撮影監督、ロサンゼルス',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — see header comment. Ink stock + asymmetric-
      left + flash-burn + FILED seal. The flash-burn is the move:
      a hot white corner that reads as the Boiler-Room moment the
      shutter opens. Tomato remains the only color. */
  coverStock: 'ink',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'flash-burn',

  /** FILED-style seal in the top-right. Reads as a press
      credential — the kind a venue hands a cinematographer so
      the bouncer waves him past the rope. */
  coverSeal: {
    label: 'FILED · AFTER HOURS',
    date: 'IV·26',
  },

  headline: {
    prefix: 'After',
    emphasis: 'Hours.',
    suffix: '',
    swash: 'A cinematographer of the room — Los Angeles, after sundown, on tungsten and on flash.',
  },

  contents: [
    { n: '001', en: 'First sighting', jp: '最初の出会い', tag: 'FIELD' },
    { n: '002', en: 'The room as a subject', jp: '部屋という主題', tag: 'BEAT' },
    { n: '003', en: 'Two registers — tungsten and flash', jp: 'タングステンとフラッシュ', tag: 'LIGHT' },
    { n: '004', en: 'Grain as a choice', jp: 'グレインの選択', tag: 'TEXTURE' },
    { n: '005', en: 'The room without a tripod', jp: '三脚を置かない部屋', tag: 'METHOD' },
    { n: '006', en: 'The other side of the camera', jp: 'カメラの裏側', tag: 'RANGE' },
    { n: '007', en: 'What the camera is for', jp: 'カメラの用', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CULTURE SPREAD · 文化',
    title: 'Inside the Room.',
    titleJp: '部屋の中で。',
    deck: 'Notes on Dañiel Aügust — a Los Angeles cinematographer who works almost entirely inside the room, on tungsten when the room will give him light and on flash when it won\u2019t, and on grain whether the codec asked for it or not.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ink',

    /** Subject card up top — the dossier module, used here as a
        cinematographer\u2019s coordinates rather than a methods
        abstract. Reads like the back of a press credential. */
    dossier: {
      kicker: 'SUBJECT · 対象',
      note: 'The subject\u2019s coordinates as filed for this issue. Self-described handle; magazine-described beat.',
      items: [
        {
          label: 'Subject',
          labelJp: '主題',
          value: 'Dañiel Aügust — cinematographer.',
        },
        {
          label: 'Handle',
          labelJp: 'ハンドル',
          value: '@thisisatool · instagram.com/thisisatool',
        },
        {
          label: 'Beat',
          labelJp: 'ビート',
          value: 'Nightlife and Black cultural documentation. Los Angeles.',
        },
        {
          label: 'Medium',
          labelJp: '媒体',
          value: 'Cinematography. Also: motion graphics, illustrated event posters, branded film.',
        },
        {
          label: 'Filed',
          labelJp: '撮影',
          value: 'Kaytranada · Pharrell · Boiler Room sets · birthdays · gatherings.',
        },
        {
          label: 'Reference',
          labelJp: '参照',
          value: 'Closer in spirit to Ricky Saiz or Cobrasnake than to commercial cinematography.',
        },
      ],
    },

    /* Cinema strip is intentionally omitted from this issue —
       no stills available to fill it. The SpreadFilmstrip type
       and the EssayFeature/InterviewFeature render block remain
       in the system for the next profile that ships with images. */

    sections: [
      {
        heading: 'FIRST SIGHTING',
        headingJp: '最初の出会い',
        paragraphs: [
          'The grid loads square by square the way a contact sheet would, if a contact sheet had ever been allowed to be the work. A man in a beanie, locs to his collarbone, brown waistcoat, the words A NEW YEAR set across him in tomato sans-serif. A clown in a fluorescent jumpsuit cartwheeling across a Los Angeles crosswalk, captioned THE FRIED CLOWN, captured at a slight low angle so the curb gets in the way of dignity exactly the way the cameraman wanted it to. A bald subject seated with a laptop, two crew members in white t-shirts holding the rig and the bounce, the whole behind-the-scenes shot framed as if the BTS itself were the piece.',
          'The grid belongs to Dañiel Aügust, who posts as @thisisatool, who lives in Los Angeles, who does not in any of the visible posts identify himself as a cinematographer in those words. The work does. It identifies him at a glance — to anyone who has spent a Saturday night in a room small enough that the DJ saw who walked in — as the person at the back of the room with the camera up. Not a phone. A camera, carried for hours, pointed at people who agreed to be looked at because the look was already happening anyway.',
          'This issue is for the grid, and for the camera that made it, and for the room — every room, whichever room — that the cinematographer keeps walking back into.',
        ],
      },
      {
        heading: 'THE ROOM AS A SUBJECT',
        headingJp: '部屋という主題',
        paragraphs: [
          'A cinematographer of the street has to wait for the city to give it to him. A cinematographer of the room walks in and the city is already there, compressed, in motion, lit. Dañiel works the room. The body of his Instagram is event work — club nights, DJ sets, birthday parties, cultural gatherings — and the names that recur across captions and tags read as a partial map of where the camera went on a given month. Kaytranada. Pharrell. Boiler Room. The kind of names a cinematographer doesn\u2019t cold-pitch his way next to; the kind a cinematographer ends up next to by being the person the room already trusted to point a lens at it.',
          'The choice of beat is editorial before it is anything else. Los Angeles has a daylight version that gets shot constantly — palm trees, freeways, the canyons in golden hour — and a nightlife version that gets shot less, less well, and more often by people standing outside the room looking in. Dañiel\u2019s frame is inside. The crowd has its back to the lens half the time because the crowd is dancing. The DJ is the foreground because the DJ is the gravitational mass of the next four hours. The subject of the work is not the celebrity at the booth or the brand on the riser; the subject is the room around them, the heat of it, the warmth of it, the fact that thirty seconds later someone will laugh at something we will never hear.',
          'A magazine for city coders is interested in the city. Most issues handle the city as a workplace — the desk, the studio, the kitchen, the morning bike to the office. This issue handles the city as a Saturday at 11pm, because that part of the city is also work, and someone is filming it.',
        ],
      },
      {
        heading: 'TWO REGISTERS — TUNGSTEN AND FLASH',
        headingJp: 'タングステンとフラッシュ',
        paragraphs: [
          'The technical signature of the work is a dual-register approach to low light. In the nightclub posts, Dañiel leans into whatever the room is already running — warm amber and deep red tungsten on the bartender\u2019s side, vibrant neon blues and purples on the dancefloor, the whole color cast left raw and uncorrected so the lighting reads as something the room did rather than something the camera asked for. The frame admits the room\u2019s palette. It does not balance it back to neutral. Neutral would be a lie about the temperature of being there.',
          'In the other posts — the Boiler Room flash work, the press shots, the moments when the practical light cannot do the job — the camera switches registers. Direct on-camera flash. High contrast. Cool documentary cast. Frozen subjects. The reference is American digital photography of the early 2000s — the Cobrasnake era, party-photographer flash on consumer DSLRs — and Dañiel handles it in the same spirit: not as a stylistic affectation borrowed from twenty years ago, but as the right tool for the moment when the room\u2019s light has nothing more to give.',
          'These are not two phases of his work. They are two tools, used in the same week, sometimes the same evening, switched between as the room asks. The interesting move is that he does not blend them. He does not wash the flash with a colored gel until it pretends to be tungsten; he does not push the tungsten until it pretends to be daylight. Both registers stay themselves. The viewer\u2019s eye learns to read them as adjacent statements about the same night — what the room gave, and what the room would not.',
        ],
      },
      {
        heading: 'GRAIN AS A CHOICE',
        headingJp: 'グレインの選択',
        paragraphs: [
          'Across the feed there is a consistent embrace of visible grain and digital noise, particularly in underexposed shadow areas. Modern cinema cameras can suppress noise to the floor; modern post can clean what the sensor missed. Dañiel\u2019s work does not. The grain is allowed. It reads, deliberately, as analog-adjacent rather than technically polished — closer to a 35mm push-process than to a 4K log file, even when the underlying file is exactly the latter.',
          'The choice is doing two things at once. First, it forgives the room. A nightlife scene shot at f/2 in genuinely poor light will have noise; the camera that pretends otherwise is the one that produces a frame that looks like an advertisement for the camera, not a frame about the room. Second, it cites a tradition. Grain in a frame of three friends at 1am does not just describe the light situation; it locates the image in a lineage of images — Larry Clark, Nan Goldin, the disposable camera at the wedding, the contact sheet a friend pinned to the inside of their kitchen door. Dañiel works inside that lineage on purpose.',
          'The lineage is not a costume. The room is real, the friends are real, the night is real. The grain is what holds them on the page once the night is over.',
        ],
      },
      {
        heading: 'THE ROOM WITHOUT A TRIPOD',
        headingJp: '三脚を置かない部屋',
        paragraphs: [
          'The compositions across the feed are loose and reactive. Tight on faces. Slight tilts. Informal framings. Subjects entering or leaving the edge of the frame with no apology to the rule of thirds. There is little evidence of deliberate studio-style composition; there is a great deal of evidence of the camera being where the camera needed to be a quarter-second before the moment happened, which is the only kind of evidence that matters in a room.',
          'A tripod, in this work, would be a confession. It would say: I knew where the picture was going to be. The work, at its most honest, does not know. It guesses, points, recovers, points again. The mistakes that survive — the slightly soft focus, the cropped elbow, the headline cut by the edge of the cell — are the proof that the camera was attending to the room rather than rehearsing for it.',
          'There is a discipline to this kind of looseness. Photographers describe it as being in the room before the camera is up: knowing the geometry, the bottlenecks, the corner where the light is doing the most, the path the bartender takes between the well and the rail. Dañiel\u2019s frames suggest that pre-camera attention. The camera arrives where it needs to be because the cinematographer was already standing there. The frame is not designed; it is recognised.',
        ],
      },
      {
        heading: 'THE OTHER SIDE OF THE CAMERA',
        headingJp: 'カメラの裏側',
        paragraphs: [
          'Alongside the live cinematography and motion work, the feed carries a second body of output that does not require the camera at all. Animated event promos for a recurring night called 9PM Sharp — title cards that come in on a beat, hand-set in tomato sans against deep ground, ornamented with a kind of Saul-Bass-meets-club-flyer iconography. Illustrated posters. Branded film for clients who came for the cinematography and stayed for the design. The shop is wider than the lens.',
          'It is a useful breadth to have. A night that asks for a cinematographer is sometimes a night that also needs a poster three weeks earlier, a title card a day before, a logo lockup the morning of. The studios that survive are the ones that can turn each of those into the same job. Dañiel\u2019s feed makes the case that those four jobs — promo art, identity work, motion graphics, live cinematography — are not four jobs. They are one editorial sensibility expressed across four toolkits, and the toolkit chosen each time is the one the night needed.',
          'A magazine notices this kind of self-publishing because a magazine recognises the grammar. A nightlife studio that issues its own promotional material — designed in-house, published on the studio\u2019s own grid, repeated weekly — is, structurally, a magazine. 9PM Sharp is a magazine. @thisisatool is a magazine. They go out on the same publication schedule the room does.',
        ],
      },
      {
        heading: 'WHAT THE CAMERA IS FOR',
        headingJp: 'カメラの用',
        paragraphs: [
          'The honest question under any cinematographer profile is what the camera is for. The commercial answer is: the camera is for the brand that paid for the shoot. The art-school answer is: the camera is for the cinematographer\u2019s eye. Both answers are partial. The answer this work suggests is closer to: the camera is for the room, on behalf of the people in it, on the chance that one of them will want, six months later, to remember being there.',
          'A nightlife cinematographer is, in a non-trivial sense, the room\u2019s historian. The DJ remembers the set list. The bartender remembers the rush. The friend in the corner remembers the conversation. The cinematographer is the only person in the room whose entire job is to remember, on everyone else\u2019s behalf, what the light looked like and where the people stood and how the room felt at 12:43 when the bass dropped and the temperature went up two degrees. That is not a small job. It is, on the right night, the most important job in the room.',
          'Dañiel does it on tungsten and on flash, on warm and on cool, on grain and on more grain, in a city that pretends not to need this kind of cultural memory because the next room is opening on Friday. This issue is for the grid, and for the camera, and for the cinematographer at the back of the room — who, when the night ends, is the reason the night will still exist.',
          '夜の撮影監督たちへ — stay in the room; shoot the flash, not the pose; let the grain stand.',
        ],
      },
    ],

    pullQuote: {
      text: 'The viewer\u2019s eye learns to read them as adjacent statements about the same night — what the room gave, and what the room would not.',
      attribution: 'KERNEL.CHAT · ON THE TUNGSTEN/FLASH REGISTER',
    },

    signoff: '夜の撮影監督たちへ — stay in the room; shoot the flash, not the pose.',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'in-house',
    copy: 'kernel.chat editorial',
    /* No photography credit — this issue is text-only. Cinema-strip
       module is preserved in the codebase but the spread itself
       carries no stills from the subject. */
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}
