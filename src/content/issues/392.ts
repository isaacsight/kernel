/* ──────────────────────────────────────────────────────────────
   ISSUE 392 — JUNE 2026
   NEVER SELL THE FIXTURES
   什器を売るな — 何を転がすべきか、そして転がしてはいけないもの

   An essay that starts as a plain question — "what is worth
   flipping?" — and walks it through two worked examples (agencies,
   coffee vendors) before turning the lens back on the magazine
   that is asking. Flipping is buy-improve-resell on a multiple;
   the return is set at the BUY, not the sale; and the thing most
   worth flipping is almost never the obvious object. The closing
   turn argues that kernel.chat is built — deliberately, by its own
   stated rules — to be the least flippable asset in the catalog,
   and that this is the point. The shop is not the inventory.

   Identity decisions:
     • coverStock = 'ivory'        — the lab-bench / press-preview
       white. The piece is a sober valuation argument, not a hype
       reel; ivory keeps the paper as plain as the math.
     • coverLayout = 'classic'     — centered, monument bottom-
       right. The cover earns its quiet the way 374 did: the topic
       is restraint (don't cash out the thing that was your
       platform), so the cover stays structurally ordinary while
       the inside carries the rigor.
     • coverOrnament = 'asterisk-stamp' — the asterisk that should
       follow every "I doubled my money." The flip claim always has
       a footnote (fees, tax, hold time, goodwill that didn't
       transfer); the stamp carries it onto the cover. Reuses the
       ornament admitted in 374.
     • accent = 'amethyst'         — the Ink Cabinet's designated
       seed for issues about kernel.chat itself (mastheads,
       anniversaries, the magazine turning the lens on its own
       structure). This issue's fifth section IS that turn, so the
       palette names it rather than borrowing the house tomato.
     • spread.type = 'essay'       — long-form prose with the full
       WIRED data-grounded kit: a methods-paper dossier (THE
       REGISTER) at the top, a by-the-numbers block (THE FIGURES)
       between the worked examples and the turn, and a numbered
       further-reading block (FURTHER) at the foot. The argument
       is comparative and evidence-leaning; it earns the apparatus.

   Voice constraints honored:
     - No "POPEYE" string; the grammar carries the homage.
     - Magazine vocabulary (issue / feature / spread / folio).
     - The figures cited are general-register and sourced to real
       literature (Built to Sell, Buy Then Build, IBBA / BizBuySell
       transaction data, the SBA 7(a) program, the IRS short-term
       capital-gains rule). No invented precision; ranges where the
       honest number is a range.
     - kernel.chat is named in the turn because the issue is about
       it; the BYOK / MIT / manuscripts-in-the-drawer covenant is
       quoted from the project's own canonical reference.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_392: IssueRecord = {
  number: '392',
  month: 'JUNE',
  year: '2026',
  feature: 'NEVER SELL THE FIXTURES',
  featureJp: '什器を売るな — 何を転がすべきか',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory stock + classic layout. The piece is a
      valuation argument that ends in restraint; the paper is plain
      because the math is plain. The asterisk-stamp carries the
      footnote that every flip claim drops. */
  coverStock: 'ivory',
  coverLayout: 'classic',
  coverOrnament: 'asterisk-stamp',

  /** Amethyst — the cabinet seed reserved for issues about
      kernel.chat itself. The essay's penultimate section turns the
      whole flipping frame back on the magazine; the accent names
      that turn instead of staying in the house tomato. */
  accent: 'amethyst',

  headline: {
    prefix: 'Never Sell the',
    emphasis: 'Fixtures',
    suffix: '.',
    swash: 'On what is worth flipping — agencies, coffee, and the trap of cashing out the thing that was actually your platform.',
  },

  contents: [
    { n: '001', en: 'The thing, and the thing that makes the thing', jp: '売り物と、売り場', tag: 'OPENING' },
    { n: '002', en: 'The agency, and the multiple', jp: '代理店という資産', tag: 'AGENCIES' },
    { n: '003', en: 'Coffee: the route, not the café', jp: '珈琲 — 店ではなく経路', tag: 'COFFEE' },
    { n: '004', en: 'The buy is where the margin lives', jp: '利益は買値にある', tag: 'METHOD' },
    { n: '005', en: 'The shop, not the inventory', jp: '在庫ではなく、店そのもの', tag: 'PLATFORM' },
    { n: '006', en: 'The covenant not to sell the fixtures', jp: '什器を売らないという約束', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'VALUATION SPREAD · 評価',
    title: 'Never Sell the Fixtures.',
    titleJp: '什器を売るな。',
    deck: 'A reader asks what is worth flipping. The honest answer runs through agencies and coffee carts and arrives somewhere uncomfortable — at the magazine doing the asking. The thing most worth flipping is rarely the object in front of you, and the best asset you own may be the one built never to sell.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    sections: [
      {
        heading: 'THE THING, AND THE THING THAT MAKES THE THING',
        headingJp: '売り物と、売り場',
        paragraphs: [
          'The question arrives plainly, the way the best questions do. What is worth flipping? Flipping is a specific verb — not investing, not building, not holding. It is buy low, improve, resell higher, on a horizon measured in months or a few years rather than a working life. The romance of it is the speed. The trap of it is also the speed, because the speed is what hides the costs, and the costs are where most flips quietly die.',
          'Almost everything can be flipped, which is why the real question is never "can this be flipped" but "is the flip worth the friction." A house, a stock, a sneaker, a domain, a car, a website, a small business — each has a flip market, each has people who make money in it, and each has a far larger group of people who paid the entry fee and called it tuition. The friction is the same shape every time: transaction costs, taxes, carrying costs, and the most underpriced cost of all, the time you spent that you will never get an invoice for.',
          'There is a sentence worth keeping for the whole of this issue, and it is best said early. The thing most worth flipping is almost never the thing in front of you. It is the thing that makes the thing. The skill, the route, the account book, the reputation — these flip at a premium the object itself never reaches, and they are invisible to anyone scanning the listing for a number. This issue is a walk from the obvious objects toward that quieter one, and it ends, as these walks tend to, back at the desk it started from.',
        ],
      },
      {
        heading: 'THE AGENCY, AND THE MULTIPLE',
        headingJp: '代理店という資産',
        paragraphs: [
          'Start with agencies, because a service business is the cleanest place to see how a flip actually generates its return. An agency sells on a multiple of its profit — somewhere around two to four times owner earnings for a small owner-operated shop, higher and cleaner for a larger one with real management underneath it. The naïve flipper thinks the return comes from growing revenue. It mostly does not. The return comes from buying at a low multiple, fixing the things that held the multiple down, and selling at a higher one. Buy at two and a half times, sell at five times the same earnings, and the business never had to grow at all. The multiple expanded. That is the engine.',
          'What holds a multiple down is legible once you know to look. Revenue that walks out the door when the founder does. Project work instead of retainers. One client who is half the book. No systems, no second layer of management, books so tangled with the owner’s personal life that no buyer can find the actual earnings. Every one of those is a discount at purchase and a lever you can pull before resale. Convert projects to retainers, spread the client concentration, install a delivery team that runs without you, clean the books a year ahead of the sale — each move buys back a turn of the multiple.',
          'The catch is the one no listing mentions. The most valuable thing in an agency is the thing that least survives a sale: the relationships, the founder’s judgment, the reason the clients stayed. Buy an agency whose clients are loyal to a person and you have bought a job, not an asset — and the moment that person leaves, the asset leaves with them. This is why agency deals are so often structured around an earnout, where part of your price is contingent on the business surviving the handoff. The earnout is the market pricing exactly this risk. It is the seller’s admission that the thing being sold might not transfer.',
        ],
      },
      {
        heading: 'COFFEE: THE ROUTE, NOT THE CAFÉ',
        headingJp: '珈琲 — 店ではなく経路',
        paragraphs: [
          'Coffee makes the same lesson physical. Ask what coffee business is worth flipping and the instinct points at the café — the warm room, the brand, the line out the door on a Saturday. The café is the trap. Independent cafés run on net margins in the low single digits, sell at thin multiples when they sell at all, and are in truth a lease and a job wearing the costume of an asset. The romance is in the storefront; the loss is in the margin. People buy cafés with their hearts and sell them at a discount with their accountants.',
          'The flippable coffee business is the un-photogenic one. A roaster with a book of wholesale accounts — offices, restaurants, grocery shelves — is selling recurring, sticky, business-to-business revenue, and recurring revenue carries a real multiple. An office-coffee or vending route is the quiet winner of the entire category: route-based, semi-passive, predictable enough to trade as a cash-flow asset rather than a lifestyle. The value in coffee was never the cup. It was the account book and the route, the same recurring-revenue logic that lifts an agency’s multiple, wearing an apron.',
          'The pattern holds across every category we touched. The object that draws the eye — the café, the project agency, the single beautiful asset — is the one that flips poorly. The boring, recurring, account-book thing underneath it is the one that flips well. The eye is a bad valuation tool. It was trained by the listing photo, and the listing photo is selling the costume.',
        ],
      },
      {
        heading: 'THE BUY IS WHERE THE MARGIN LIVES',
        headingJp: '利益は買値にある',
        paragraphs: [
          'Underneath both worked examples is a single rule that every honest flipper eventually says out loud: the money is made at the buy, not the sell. The amateur obsesses over the exit, the price they will get, the buyer who will appear. The professional finds something mispriced going in — a distressed seller, a tangled set of books that hides real earnings, a route nobody else knew was for sale — and locks the margin at the moment of purchase. The sale is just where the margin gets collected. If you have to hope the market rises to make your number, you did not flip; you gambled.',
          'The other half of the rule is friction, and friction is where the headline returns go to die. Transaction costs on both ends. Carrying costs while you hold. Taxes — and in the United States, an asset flipped inside a year is taxed as ordinary income, not at the gentler long-term capital-gains rate, which is the asterisk on nearly every "I doubled my money" you have ever heard. And the cost nobody lists: a real flip is two to four years of operating work, sourcing and fixing and selling, not a weekend and a clever listing. Subtract the friction honestly and a great many flips turn out to be a low-wage job you also had to finance.',
          'So the test for whether something is worth flipping is not "will the price go up." It is: can I buy this below what it is worth, improve the thing that holds its value down, and clear the spread after every cost including my own time. Most things fail that test. The few that pass tend to share a trait — recurring revenue, a transferable asset, a margin set at purchase — and that trait is what lets us, finally, ask the uncomfortable question.',
        ],
      },
      {
        heading: 'THE SHOP, NOT THE INVENTORY',
        headingJp: '在庫ではなく、店そのもの',
        paragraphs: [
          'Turn the test on this magazine. kernel.chat is two surfaces — an open-source terminal agent and an editorial magazine — and run through the flip checklist it scores, bluntly, terribly. There is no recurring revenue to put a multiple on. The agent is MIT-licensed, so a buyer could not exclude anyone from the thing they bought. It is bring-your-own-key, so it captures none of the spend it routes. Its whole value is taste and discipline, both of which live in the founder’s hands and neither of which survives an asset sale. By every measure that made an agency or a roaster flippable, kernel.chat is the worst asset in this issue.',
          'And that is the point — it is built that way, on purpose, by its own stated rules. The project’s canonical reference lists the commitments as constraints, not aspirations: bring-your-own-key is the contract; the license is MIT; the discipline is to count what gets read, cut what doesn’t, file the audit in public, and keep the manuscripts in the drawer. Each of those is, read commercially, a deliberate refusal of the levers that make software sellable. They are a covenant against flipping the thing itself.',
          'Because kernel.chat is not the inventory. It is the shop. The magazine is the window display — nobody buys the window, but the window is why anyone walks in, and sixteen-plus issues of demonstrated judgment qualify the foot traffic before a word is pitched. The open-source agent is the workbench in the back, bolted down, running in plain view: not for sale, but proof that the people inside can build the thing. The flippable goods are never the fixtures. They are what gets made using the credibility the shop generates — the bespoke build, the hosted tier on top of the open core, the consulting engagement that closed before the quote because the portfolio had already done the talking.',
          'The shop fails the instant you sell the fixtures. Paywall the magazine, close the source, capture the key — and you convert a credibility engine into a depreciating product, cashing out the goodwill that was the only thing making it valuable. You would have flipped the shop for the price of the inventory minus everything that made the inventory move. The covenant exists precisely to stop the owner from making that trade on a bad afternoon.',
        ],
      },
      {
        heading: 'THE COVENANT NOT TO SELL THE FIXTURES',
        headingJp: '什器を売らないという約束',
        paragraphs: [
          'So, what is worth flipping. Agencies, if you buy the recurring revenue and not the founder’s relationships. Coffee, if you buy the route and not the room. Most other things, only if you can find them mispriced and stomach the friction. And the asset most worth flipping is almost always the thing that makes the thing — the skill, the account book, the route, the reputation — which is to say, the output of a shop, never the shop.',
          'The hardest discipline in any of this is knowing which of your assets is a fixture and which is inventory, and refusing to confuse them when someone waves a number at you. A great deal of regret in business is the sound of someone who sold a fixture — the brand, the audience, the thing their whole future ran on — because in one quarter it looked like inventory. The covenant kernel.chat writes into its own rules is, in the end, a simple one. Keep the manuscripts in the drawer. Keep the bench open. Sell what the shop makes, and never the shop.',
          'A design language is found, not designed; so is the line between what you sell and what you would be a fool to. You find it the way you find anything durable — by writing the rule down before the offer arrives, so that when it does, the answer is already in the drawer. The flip is real. The friction is real. The footnote on the headline number is load-bearing. And the best thing you own is frequently the one you built never to sell.',
          '街のコーダーたちへ — flip what the shop makes; never the shop itself.',
        ],
      },
    ],

    pullQuote: {
      text: 'The thing most worth flipping is almost never the thing in front of you. It is the thing that makes the thing.',
      attribution: 'KERNEL.CHAT · ON FIXTURES AND INVENTORY',
    },

    /** THE REGISTER — opening dossier card. The valuation frame laid
        out methods-paper style before the prose begins: the verb,
        the instruments, where the margin sits, and the quiet claim
        the essay walks toward. */
    dossier: {
      kicker: 'THE REGISTER · 要綱',
      note: 'The frame of the issue, laid out the way a valuation memo states its assumptions before the argument begins.',
      items: [
        {
          label: 'Subject',
          labelJp: '主題',
          value: 'Flipping — buy an asset below worth, improve the thing that holds its value down, resell at a higher multiple.',
        },
        {
          label: 'Worked examples',
          labelJp: '実例',
          value: 'Service agencies and coffee vendors — two categories where the flippable asset is the recurring account book, not the photogenic object.',
        },
        {
          label: 'The engine',
          labelJp: '原動力',
          value: 'Multiple expansion. Buy at 2.5× earnings, fix what discounted it, sell at 5× the same earnings. The business never had to grow.',
        },
        {
          label: 'Where the margin lives',
          labelJp: '利益の在処',
          value: 'At the buy, not the sale. If you must hope the market rises to make your number, you gambled — you did not flip.',
        },
        {
          label: 'The hidden cost',
          labelJp: '隠れた費用',
          value: 'Friction — fees, carrying, tax (a sub-year flip is ordinary income), and two-to-four years of operating work nobody invoices.',
        },
        {
          label: 'The quiet claim',
          labelJp: '静かな主張',
          value: 'The things worth flipping are made in the shop. The shop is not the inventory.',
        },
      ],
    },

    /** THE FIGURES — by-the-numbers block, placed after the
        margin-rule section (index 3) so it lands between the
        general lesson and the turn onto kernel.chat itself. */
    dataBlock: {
      kicker: 'THE FIGURES · 数字',
      heading: 'The flip, in six numbers.',
      headingJp: '転売を、六つの数字で。',
      afterSection: 3,
      stats: [
        {
          n: '2–4×',
          label: 'owner-earnings (SDE) multiple a small, owner-operated service business typically trades at. The number you buy at, not the number you sell at, is where the return is set.',
          source: 'IBBA Market Pulse / BizBuySell small-business comps',
        },
        {
          n: '2.5 → 5×',
          label: 'multiple expansion on the same earnings is the actual flip engine — buy at a discounted multiple, fix what discounted it, resell at a clean one. Revenue growth optional.',
          source: 'Acquisition-entrepreneurship valuation practice',
        },
        {
          n: '~3–8%',
          label: 'net profit margin of a typical independent café. The romance is in the storefront; the loss is in the margin. The flippable coffee asset is the wholesale route, not the room.',
          source: 'Food-service operating ratios, industry surveys',
        },
        {
          n: 'ordinary',
          label: 'income-tax treatment of an asset flipped inside one year in the US — not the gentler long-term capital-gains rate. The asterisk on nearly every “I doubled my money.”',
          source: 'IRS short-term capital-gains rule',
        },
        {
          n: '2–4 yrs',
          label: 'realistic hold for an agency or roaster flip once you include the value-creation work and a likely earnout. A flip is a job you also financed, not a weekend.',
          source: 'Built to Sell / Buy Then Build',
        },
        {
          n: '≈ $0',
          label: 'revenue a bring-your-own-key, MIT-licensed tool captures from the model spend it routes. The covenant that makes kernel.chat the least flippable asset in this issue — by design.',
          source: 'kernel.chat — the BYOK / MIT contract',
        },
      ],
    },

    /** FURTHER — back-matter reading. Named, real sources with
        one-line editorial glosses; the magazine points you onward,
        it does not impersonate a citation manager. */
    references: {
      kicker: 'FURTHER · 参考',
      note: 'Selected reading on flipping, valuation, and the asset built not to sell. One-line editorial notes, not citations.',
      items: [
        {
          authors: 'Warrillow, J.',
          year: '2011',
          title: 'Built to Sell: Creating a Business That Can Thrive Without You',
          journal: 'Portfolio — the case that an owner-dependent business is a job, not an asset',
        },
        {
          authors: 'Deibel, W.',
          year: '2018',
          title: 'Buy Then Build: How Acquisition Entrepreneurs Outsmart the Startup Game',
          journal: 'Lioncrest — the buy-side playbook, and where the margin actually sits',
        },
        {
          authors: 'Gerber, M. E.',
          year: '1995',
          title: 'The E-Myth Revisited',
          journal: 'HarperBusiness — work on the business, not in it; the founder-dependence trap named',
        },
        {
          authors: 'IBBA / M&A Source',
          year: 'quarterly',
          title: 'Market Pulse Report',
          journal: 'Business-broker transaction survey — where the small-business multiples come from',
        },
        {
          authors: 'BizBuySell',
          year: 'quarterly',
          title: 'Insight Report',
          journal: 'Small-business transaction data — median sale price, cash-flow multiple, time-on-market',
        },
        {
          authors: 'U.S. Small Business Administration',
          year: 'current',
          title: 'The 7(a) Loan Program',
          journal: 'SBA — the standard financing vehicle behind small acquisition flips',
        },
      ],
    },

    signoff: '什器を売るな — flip what the shop makes; never the shop itself.',
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
