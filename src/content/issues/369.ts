/* ──────────────────────────────────────────────────────────────
   ISSUE 369 — APRIL 2026
   A WARTY SPECIMEN: ON POKÉMON ENERGY AT THE SHEDD
   イボのある魚 — シカゴのカエルアンコウ

   An essay on the warty frogfish (Antennarius maculatus) — a
   small yellow ambush predator the Shedd Aquarium in Chicago
   has learned to raise, and on the editorial category the fish
   occupies: neither cute nor cool, but charming in the third
   way, which is the way Pokémon understood and the way a city
   learns to love the creatures that look, at first, like a
   mistake.

   Identity — butter stock + asymmetric-left layout + warty-spots
   ornament + a Shedd specimen-card seal. First run of butter +
   asymmetric-left; first run of the new `warty-spots` ornament.
   The paper is yellow because the fish is yellow. The layout is
   off-centre because the fish is off-centre. The ornament is a
   scattered field of tomato papillae because the fish is warty.
   The whole object is meant to read the way the fish reads: a
   bright, lumpy, slightly improbable thing that is precisely as
   serious as it looks.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_369: IssueRecord = {
  number: '369',
  month: 'APRIL',
  year: '2026',
  feature: 'A WARTY SPECIMEN: ON POKÉMON ENERGY AT THE SHEDD',
  featureJp: 'イボのある魚 — シカゴのカエルアンコウ',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — butter stock + asymmetric-left + the new
      warty-spots ornament + a Shedd specimen-card seal. The
      combination is deliberate: butter is the paper the fish's
      yellow body wanted; asymmetric-left sets a lumpy,
      off-centred rhythm that matches a creature that walks more
      than it swims; warty-spots scatter the cover with tomato
      papillae so the whole page reads as the fish's dermis; the
      seal signs the issue "CARE OF SHEDD" the way a public
      aquarium labels a specimen card. */
  coverStock: 'butter',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'warty-spots',

  /** Specimen-card seal, top-right. Reads as the hand-stamped
      label on the back of a Shedd tank card. Pairs with the
      warty-spots ornament to make the cover feel like an
      aquarium's object, not a magazine's. */
  coverSeal: {
    label: 'CARE OF SHEDD',
    date: 'IV·26',
  },

  headline: {
    prefix: 'A',
    emphasis: 'Warty',
    suffix: 'Specimen.',
    swash: 'On Pokémon energy, ambush lures, and the reef fish a Chicago aquarium learned to raise.',
  },

  contents: [
    { n: '001', en: 'First sighting', jp: '最初の出会い', tag: 'FIELD' },
    { n: '002', en: 'The body, the walk, the strike', jp: '体と歩き方と一撃', tag: 'SPECIMEN' },
    { n: '003', en: 'Pokémon energy', jp: 'ポケモンの気配', tag: 'FRAMING' },
    { n: '004', en: 'A nursery in Chicago', jp: 'シカゴの保育', tag: 'CARE' },
    { n: '005', en: 'The charm third column', jp: '第三の魅力', tag: 'AESTHETIC' },
    { n: '006', en: 'What the fish is for', jp: '魚の用', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELD SPREAD · 現場',
    title: 'The Yellow Lump.',
    titleJp: '黄色いかたまり。',
    deck: 'Notes on a small ambush predator, filed after a thirty-second video from a Chicago tank — what the fish is, why an aquarist called it Pokémon, and what it means that a public aquarium learned to raise it.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'butter',

    sections: [
      {
        heading: 'FIRST SIGHTING',
        headingJp: '最初の出会い',
        paragraphs: [
          'The video scrolls past on a phone in the afternoon — thirty seconds, NPR News Now, a Shedd Aquarium tank, a bright yellow thing that does not, at first glance, look like a fish. It has warts. It has a face. It appears to be standing. The caption quotes a man named Daniel, who calls it Pokémon. The aquarium has nursed three of them, the video says, for the first time in the North American public-aquarium system. The scroll continues. The image does not. Two hours later we have read Pietsch\'s monograph and we are writing this issue.',
          'The fish in the tank is Antennarius maculatus, a warty frogfish — called, depending on the field guide, clown frogfish, warty frogfish, or (in Japanese) オオモンカエルアンコウ, "large-spotted frog-anglerfish." Yellow is one of the colour morphs. Orange is another. White with rust-coloured patches is a third. The species does not commit to a uniform. It picks a paint scheme per individual, sometimes per month, and wears it with the confidence of something that has no predators to impress.',
          'The lede of this issue is the fact that a camera crew thought this fish was worth a minute of national airtime. That is editorial judgement we do not often see extended to the ambush predators of shallow Indo-Pacific reefs. It is correct judgement. The fish is a news item. What follows is an argument for why.',
        ],
      },
      {
        heading: 'THE BODY, THE WALK, THE STRIKE',
        headingJp: '体と歩き方と一撃',
        paragraphs: [
          'The warty frogfish reaches ten to fifteen centimetres at adulthood. The body is rounded, almost spherical when at rest, stippled across its entire surface with irregular bumps. The bumps are not warts in the clinical sense. Ichthyologists call them dermal papillae — fleshy outgrowths that thicken the fish\'s silhouette, catch light unevenly, and help the animal disappear against encrusted reef rubble. The illusion the fish is after is not "fish." The illusion is "lump of sponge with nothing going on." It is very good at this.',
          'The pectoral fins are modified into something closer to feet. They articulate at the base, splay outward, and can bear weight. The pelvic fins, tucked under the belly, do the same job. The fish walks. It climbs slow inclines across the substrate one fin-limb at a time, a gait somewhere between an inchworm and a toad, and it does this because the swim bladder has been enlarged past the point where smooth neutral buoyancy is available to it. Swimming, for an adult warty frogfish, is awkward work. Walking is the preferred grammar.',
          'What the body is actually optimised for is the strike. A modified dorsal spine rises from the forehead, thin as wire, tipped with a fleshy lure called an esca. The fish wags the esca. Smaller reef fish — wrasses, gobies, juveniles of species three times the frogfish\'s length — approach to investigate. The mouth opens. In six milliseconds, faster than the human nervous system can register a flash of colour, the buccal cavity expands by a factor of twelve and the prey is inhaled whole. The paper that measured this (Grobecker & Pietsch, Science, 1979) documented it with high-speed film because no slower instrument could catch it. The yellow lump is among the fastest feeders in the animal kingdom.',
        ],
      },
      {
        heading: 'POKÉMON ENERGY',
        headingJp: 'ポケモンの気配',
        paragraphs: [
          'Daniel, whoever Daniel is at the Shedd, gave NPR the line the piece needed. The warty frogfish has real Pokémon energy. He said it plainly, on tape, into a microphone that was about to carry it out to several hundred thousand listeners. It is the right line. It is also a curatorial act. A good aquarist tells the public what they are going to feel before the public has organised it into a feeling, and Pokémon is what the public is going to feel, because Pokémon is the cultural grammar we have for "creature that looks like a sketch the universe never erased."',
          'The reference does not diminish the animal. Pokémon, at its best, is a monument to exactly the category the warty frogfish occupies — vertebrates that appear to have been designed by a committee that lost track of the brief halfway through and went with it anyway. Psyduck. Wooper. Magikarp. Quagsire. The franchise has spent thirty years training a global audience to see the charisma in creatures evolution built out of spare parts, and that training pays out, in moments like this one, as instantaneous recognition. A small child seeing the Shedd tank for the first time does not need the word "frogfish." They have a word for it already. The word is Wooper.',
          'The translation runs both ways. The warty frogfish is, in a non-trivial sense, part of the referential pool Pokémon drew from — not this species specifically, but the order, the family, the wider world of anglerfish weirdness that staff artists at Game Freak have been sketching since the mid-1990s. The cartoon did not invent the aesthetic. It named it. Daniel was pointing at the original. The video we scrolled past was a reminder that the original is still running, in a tank in Chicago, waggling a lure and waiting.',
        ],
      },
      {
        heading: 'A NURSERY IN CHICAGO',
        headingJp: 'シカゴの保育',
        paragraphs: [
          'Breeding frogfish in captivity is not easy. The adults spawn by releasing a gelatinous egg raft — a buoyant ribbon, sometimes half a metre long, laced with thousands of eggs — that drifts at the surface until the larvae hatch into a planktonic stage with almost no resemblance to the adult they will become. The larvae need live food at scales smaller than most hatcheries stock. The juveniles, once they metamorphose, need to learn to use an esca they have never seen another frogfish use, in a tank with nothing to ambush but the hand that feeds them. Each stage is a point at which the cohort can collapse to zero.',
          'The Shedd did not collapse to zero. The Shedd, according to the NPR peg and the aquarium\'s own notes, is raising warty frogfish in Chicago in numbers that let a reporter say "a special kind of reef fish for the first time." That is the work of aquarists whose names will not be on the segment. It is also the work of an institution deciding that a lumpy yellow fish with no obvious charisma budget is worth the tank time, the live-food line item, the husbandry staff hours, and the risk of writing a press note about a cohort that might not have survived to be photographed.',
          'The species is not presently listed as endangered — the warty frogfish is widespread across the Indo-Pacific and does not appear on IUCN\'s threatened list as of the last audit. The point of the Shedd programme is not rescue. The point is method. Frogfish husbandry that works for Antennarius maculatus is husbandry that transfers, with modification, to the deep-sea anglerfish whose populations we know almost nothing about and whose futures are already compromised by bottom-trawling and warming. A public aquarium in Chicago practising on a species that can afford the practice is how the field gets good enough to help the species that cannot.',
        ],
      },
      {
        heading: 'THE CHARM THIRD COLUMN',
        headingJp: '第三の魅力',
        paragraphs: [
          'Popular zoology runs on two columns. The first is cute — the column that holds otters and red pandas and the sleepier sort of owl, the animals whose faces map onto the neotenic features a human nursery is wired to respond to. The second is cool — octopus, peregrine falcon, orca, jaguar, the animals whose competence reads at a glance as something a person might want to borrow. Conservation campaigns almost always run on one or the other. Aquarium gift shops almost always sell one or the other. The animals that show up in both columns — dolphins, perhaps, and the bigger cats — get the bulk of the attention budget.',
          'There is a third column and it is where the warty frogfish lives. The third column is for animals too odd to be cute and too inefficient to be cool. Blobfish. Axolotl. Aye-aye. Proboscis monkey. Naked mole rat. Every frogfish. The third column accumulates partisans rather than fans — the person who has been telling you about the axolotl for seven years, the child whose favourite animal is something their parents cannot spell. Pokémon monetised this column before biology quite noticed it was there. A good nature documentary eventually wanders into it. A good aquarium, Chicago now demonstrates, can build a programme around it.',
          'This magazine has a soft spot for the third column and it is worth naming the bias. The things we find ourselves writing about — small tools, strange little languages, operating systems too weird to scale, species that cannot sell a plush toy — are third-column objects. We think the column is undervalued. We think the first two columns get along fine without our help. A magazine for city coders is at its most useful when it points at what the first two columns do not notice, and at the species level that is very often something warty, off-balance, and yellow.',
        ],
      },
      {
        heading: 'WHAT THE FISH IS FOR',
        headingJp: '魚の用',
        paragraphs: [
          'The honest question under all of this is what the fish is for. A warty frogfish in a Chicago tank is not saving its species — the species is not in trouble. It is not feeding a research programme that could not proceed without it. It is not, by any straight utilitarian accounting, earning its GPU budget of live shrimp and filtered seawater. The fish is in the tank because an institution decided the fish was worth being in a tank, and because a reporter decided the decision was worth a minute of national airtime, and because a man named Daniel decided Pokémon was the right word.',
          'That chain of decisions is the point. A city that learns to raise a small yellow ambush predator is a city that has extended the boundary of what it thinks is worth the trouble. The boundary used to stop at the charismatic megafauna — the dolphins the children recognise from the movie, the sharks the adults recognise from the other movie. Moving the boundary outward, one warty specimen at a time, is slow cultural work and it is how the third column gets shorter and the first two columns get less lonely. The Shedd is doing that work. NPR is doing that work. Daniel, giving the fish the right pop-cultural entry point, is doing that work.',
          'We are, in writing this, also doing it, at the scale an independent magazine can do anything — by pointing a few hundred city coders at a tank in Chicago, and at the animal inside it, and at the slightly improbable fact that the animal is there at all. The lure wags. The strike is six milliseconds. The fish is yellow and stands on its fins and looks at the camera with an expression no taxonomist will describe in those words. This issue is for it. 街のコーダーたちへ — the weird ones are the ones worth watching.',
        ],
      },
    ],

    pullQuote: {
      text: 'DANIEL: The warty frogfish has real Pokémon energy.',
      attribution: 'SHEDD AQUARIUM · VIA NPR NEWS NOW · APR 2026',
    },

    /** Opening register — specimen card for the fish. Reads as
        the back of an aquarium tank label: numbered rows, mono
        field names, the frame of the issue before the prose. */
    dossier: {
      kicker: 'SPECIMEN CARD · 標本',
      note: 'The back-of-tank card, transcribed — the frame the aquarium would hand you before the essay begins.',
      items: [
        {
          label: 'Subject',
          labelJp: '主題',
          value: 'Antennarius maculatus — the warty frogfish. Also: clown frogfish, オオモンカエルアンコウ.',
        },
        {
          label: 'Range',
          labelJp: '分布',
          value: 'Indo-Pacific reefs, shallow. As of this issue, a tank at Shedd Aquarium, Chicago.',
        },
        {
          label: 'Body',
          labelJp: '体',
          value: '10–15 cm at adulthood. Yellow, orange, or white. Dermal papillae across the entire surface.',
        },
        {
          label: 'Gait',
          labelJp: '歩き方',
          value: 'Walks on pectoral and pelvic fins. Swims only when pressed; swimming is an inconvenience.',
        },
        {
          label: 'Strike',
          labelJp: '一撃',
          value: 'Six milliseconds. Twelve-fold buccal expansion. Among the fastest feeders in the animal kingdom.',
        },
        {
          label: 'Peg',
          labelJp: '発端',
          value: 'NPR News Now, April 2026. Daniel, Shedd Aquarium. "Real Pokémon energy."',
        },
      ],
    },

    /** The Figures — six statistics on the fish, the strike, and
        the institution. Lands between the nursery section (index
        3) and the charm-third-column turn, so the data breaks
        the prose at the point where the essay pivots from
        natural history to cultural argument. */
    dataBlock: {
      kicker: 'THE FIGURES · 数字',
      heading: 'The fish, in six numbers.',
      headingJp: 'カエルアンコウを、六つの数字で。',
      afterSection: 3,
      stats: [
        {
          n: '6 ms',
          label: 'duration of the prey-capture strike — the buccal expansion that inhales a passing reef fish whole. Among the fastest in the animal kingdom.',
          source: 'Grobecker & Pietsch, Science, 1979',
        },
        {
          n: '12×',
          label: 'factor by which the buccal cavity expands during the strike. The yellow lump briefly doubles as a vacuum chamber.',
          source: 'Grobecker & Pietsch, Science, 1979',
        },
        {
          n: '10–15 cm',
          label: 'adult body length. The fish is smaller than the hand that would reach for it. The hand, nonetheless, should not.',
          source: 'Pietsch & Arnold, Frogfishes, 2020',
        },
        {
          n: '~47',
          label: 'species in Antennariidae, the frogfish family. Each one handles its weirdness differently; the warty is the one Chicago raised.',
          source: 'Pietsch & Arnold, Frogfishes, 2020',
        },
        {
          n: '1930',
          label: 'year the Shedd Aquarium opened on the Chicago lakefront. It took the institution almost a century to get around to breeding this one.',
          source: 'Shedd Aquarium history',
        },
        {
          n: '1',
          label: 'thing this issue is asking you to remember — a small yellow fish, waggling a lure, in a city that is nowhere near a reef.',
          source: 'KERNEL.CHAT · EDITORIAL',
        },
      ],
    },

    /** Further reading — editorial back matter. Short, named,
        one-line gloss each. The reference list is the colophon
        of an essay that took itself seriously enough to cite. */
    references: {
      kicker: 'FURTHER · 参考',
      note: 'Selected reading, in the order the essay touches them. One-line editorial notes, not citations.',
      items: [
        {
          authors: 'Grobecker, D. B. & Pietsch, T. W.',
          year: '1979',
          title: 'High-speed cinematographic evidence for ultrafast feeding in antennariid anglerfishes',
          journal: 'Science — the six-millisecond paper, filmed on rotating drum cameras because nothing slower could see the strike',
        },
        {
          authors: 'Pietsch, T. W. & Arnold, R. J.',
          year: '2020',
          title: 'Frogfishes: Biodiversity, Zoogeography, and Behavioral Ecology',
          journal: 'Johns Hopkins University Press — the monograph. If you want to read one book about this family, it is this one',
        },
        {
          authors: 'Shedd Aquarium',
          year: '2026',
          title: 'Warty frogfish breeding notes',
          journal: 'Chicago — the institutional peg; a public aquarium doing quiet husbandry work on a species no gift shop will plush',
        },
        {
          authors: 'NPR News Now',
          year: '2026',
          title: '"Chicago\'s Shedd Aquarium has nursed a special kind of reef fish."',
          journal: 'National Public Radio — thirty seconds of airtime; the reason this issue exists',
        },
        {
          authors: 'Tanaka, Game Freak et al.',
          year: '1996–present',
          title: 'Pokémon Red / Blue and successors',
          journal: 'Game Freak / Nintendo — the cultural grammar Daniel invoked, and the reason the child at the tank already knows what to call this fish',
        },
      ],
    },

    signoff: '街のコーダーたちへ — stay lumpy; keep the lure out; watch the reef you will never swim in.',
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
