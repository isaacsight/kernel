# Interactions — kernel.chat

> Companion to `docs/design-language.md` and `docs/tiktok.md`. The
> magazine's grammar, translated for things the reader does with
> a cursor, a thumb, or a scroll wheel.
>
> Interaction is the fourth layer of the toolkit, beside Layout,
> Ornaments, and Images. It is also the one most likely to drift
> toward SaaS convention if left undefended.

---

## Why this doc exists

We shipped the typography, the stocks, the ornaments, and the
feature modules. We did not yet write down what *happens* when a
reader arrives — how a section appears, how a pull-quote behaves
when touched, how a page hands off to the next.

The site is mostly still on purpose. Two ambient accents (tomato
rule breath, dateline marquee) live in `docs/design-language.md`.
Everything else reads as print-on-a-screen.

But "mostly still" isn't a contract. Without one, every PR is a
chance to bolt on a hover flourish, a scroll-jack, a confetti
burst, a toast notification. Each looks reasonable in isolation.
In aggregate they are the SaaS dashboard we spent a year
refusing to be.

This doc is the contract. It says what interaction is, what it
isn't, which tools are allowed, and how new ones get proposed.
Same shape as `tiktok.md` — different medium, same grammar.

**This doc never names its inspiration on the site.** The sources
are private to contributors: the gatefold in a Taschen monograph,
the scroll-driven type in Apollo-era NASA annual reports, the
reveal-on-touch pull-quote in POPEYE's mobile app, the View
Transitions spec that finally lets the web do what InDesign has
always done.

---

## Philosophy

Print has three native interactions. Exactly three.

| Interaction | What it is | What it rewards |
|---|---|---|
| **Page turn** | The reader commits to the next spread | Anticipation — the next thing is somewhere else, not here |
| **Gatefold** | The reader pulls a folded flap outward | Discovery — the spread contains more than it first showed |
| **Moving-in-light** | The reader tilts the page, the ink catches light differently | Presence — the object is physical, responsive to attention |

The web inherits all three. It has a thousand more — draggable
carousels, infinite scroll, hover dropdowns, modal stacks, skeleton
loaders, toast queues — but those are SaaS interactions, and they
don't translate to print because print never needed them.

The working test for any new interaction on kernel.chat is a
three-part question. It must pass at least one. The ones it passes
tell you which print move it is.

| Test | Passes if it… | Print analog |
|---|---|---|
| **Translate** | Reproduces a print reading experience on a screen that print can't do | Page turn, gatefold, moving-in-light |
| **Solve** | Fixes a real reader problem that the current page genuinely has | Index tab, ribbon bookmark, footnote |
| **Unlock** | Enables a new editorial tool that wasn't possible before | Sound in a magazine, link in a footnote |

If it fails all three, it's SaaS chrome. Don't ship it.

A hover state that reveals an attribution under a pull-quote is
*translate* — the margin-note of print, compressed to touch. A
scroll-driven section-kicker type-in is *translate* — the page
turn, staged. A cover-to-feature View Transition is *translate* —
the gatefold, unfolding. A tooltip on every icon button is none of
the three. A modal for comment reactions is none of the three.

---

## In scope — six interactions

These are the only categories a kernel.chat contributor should
reach for. A new interaction must fit one. If it doesn't, the
interaction is either forbidden (section IV) or needs a category
proposal before shipping.

### 1. Scroll reveals — the staged page turn

A section, a pull-quote, or a kicker arrives as the reader scrolls
to it. Not a hype cut; a page coming into view. The reveal is the
only moment the element moves — once revealed, it is still.

| Property | Spec |
|---|---|
| Trigger | Intersection observer at `rootMargin: -12% 0px` |
| Duration | 400–600ms per element |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` (the "magazine push" curve) |
| Staggering | 60ms between peers in the same section |
| Transform | `translateY(12px) → 0` or `opacity 0 → 1`, nothing else |
| Respect | `prefers-reduced-motion`: instant, no transform |

### 2. Hover signals — moving-in-light, for cursor

On pointer-capable devices, a typographic element may respond to
hover with a *small* change of state. This is the magazine version
of tilting a page to catch the light. Touch devices do not fire
this; the interaction is strictly pointer-only.

| Property | Spec |
|---|---|
| Trigger | `:hover` on pointer-capable devices (media query `(hover: hover)`) |
| Duration | 120–180ms |
| Easing | `ease-out` |
| Allowed changes | Tomato rule appears/brightens, kicker opacity 0.6 → 1.0, subtle `letter-spacing` −0.002em on display type |
| Forbidden changes | Color on body text, scale, rotate, shadow, underline animation |
| Touch | Not fired. Pointer-only. |

### 3. Micro-parallax — the depth of good paper

One layer of deliberately small parallax on cover monuments and
feature heroes. The ground drifts at one rate, the typography at
another. The effect should be unnamed by the reader — they should
only feel that the page has weight.

| Property | Spec |
|---|---|
| Amplitude | ≤ 6px total translate across the scroll of the section |
| Rate | Two layers, one at 1.0× scroll, one at 0.94× |
| Trigger | IntersectionObserver + `scroll` handler, rAF-throttled |
| Usage | Cover monument, feature hero, essay drop-cap panel. Nowhere else. |
| Respect | `prefers-reduced-motion`: disabled entirely |

### 4. Page transitions — the gatefold

Route changes inside the magazine frame use the View Transitions
API when the browser supports it. A cover-to-feature is a
gatefold opening; a feature-to-next-feature is a page turn. The
fallback is an instant cut.

| Transition | Spec |
|---|---|
| Cover → feature | Masthead persists. Feature monument arrives from the right edge (the gatefold). 320ms. |
| Feature → feature | Masthead persists. Outgoing fades down 6px, incoming fades up 6px. 240ms. Overlapped by 120ms. |
| Feature → cover | Reverse of open. 280ms. |
| Fallback | Instant cut. No polyfill. |

### 5. Content-level interactivity — editorial tools

An editorial tool may require reader input because the content
demands it. A recipe can adjust servings. A forecast can toggle a
timeframe. A subject dossier can flip between subject and author
notes. These are *content-level* — they ship inside a feature,
not in the chrome around it.

| Tool (present or near-term) | Interaction |
|---|---|
| Recipe (future) | Numeric scrubber on servings updates ingredient amounts in place |
| Interview dossier | Tap subject card to flip to editor's-note back |
| Forecast (future) | Toggle chip for 1Y / 5Y / 20Y reading |
| Pull-quote margin note | Hover or tap reveals attribution beside the quote |

A content-level interaction is allowed only if it is *specified by
the feature module itself*. No content-level interaction may
appear outside a feature module. Chrome stays still.

### 6. State-driven ambient — the only moving parts that don't react

The two existing ambient accents (`docs/design-language.md`:
tomato rule breath, dateline marquee) are not interactions —
readers don't trigger them — but they *are* state-driven: they
pause when the tab is hidden, they respect
`prefers-reduced-motion`, they stop at the folio footer.

New state-driven ambient accents are the sixth category. They do
not react to the reader, but they do react to the environment
(visibility, motion preference, locale, time-of-day if editorial
asks for it). Before adding a third, audit whether the first two
are enough.

| Property | Spec |
|---|---|
| Allowed states | Tab visibility, reduced-motion, locale (JP vs Latin), issue stock |
| Forbidden states | Mouse position, scroll velocity, battery, network, geolocation, ambient light sensor |
| Implementation | CSS `@media`, CSS variables, nothing else |

---

## Out of scope — what we do not build

These are the interactions a SaaS dashboard builds by reflex.
They are forbidden on kernel.chat. Each is a real, common web
pattern — the ban is the point.

| Category | Examples | Why not |
|---|---|---|
| **SaaS chrome** | Persistent app shells, dock-style navbars, sidebar collapse, breadcrumb trails, avatar menus | The magazine has no application chrome. The frame is the chrome. |
| **Modals** | Dialog overlays, confirmation boxes, centered popovers, cookie banners (beyond single-line notice) | A magazine does not interrupt itself to ask a question |
| **Notifications** | Toast queues, snackbar stacks, badge counters, bell icons, "X new items" pills | Announcements belong in the masthead, not in chrome |
| **Tooltip-for-everything** | Icon-button tooltips, hover-help on labels, question-mark circle popovers | If a label needs explaining, change the label |
| **Loaders** | Spinners, skeleton screens, progress bars (beyond the `<progress>` used inside a forecast feature), shimmer effects | The page either has content or it doesn't. No "in-between" UI. |
| **Empty states as UI** | "Nothing here yet" illustrations, CTAs urging reader to "get started," onboarding tours | An empty section is absent from the issue. It is not an empty state. |
| **Engagement patterns** | Like buttons, reaction bars, share sheets, comment threads, save-to-later, reading progress rings | The magazine is read; it is not a thread |
| **Scroll gymnastics** | Scroll-jacking, locked scenes, horizontal-on-vertical wheel capture, parallax beyond §3, pinned ticker bars | The reader owns their scroll |
| **Auto-advance** | Auto-playing video, auto-advancing carousels, auto-rotating heroes, auto-flipping tabs | A magazine does not turn its own pages |
| **Drag handles** | Rearrangeable cards, kanban grids, draggable splitters, resize bars | Nothing is rearranged by the reader |

A request to add any of these is an invitation to re-read this
section, not to propose an exception.

---

## The toolkit

A small, opinionated stack. Adding a dependency is a design
decision, not a convenience.

### In

| Tool | Version | Role |
|---|---|---|
| **Motion** | `^12.34.5` (in `package.json`) | All JS-driven reveals, hover signals, and page transitions. Imported as `motion/react`. |
| **CSS keyframes + transitions** | native | All ambient accents, all ≤ 200ms hover states, all `prefers-reduced-motion` fallbacks |
| **IntersectionObserver** | native | The trigger for every scroll reveal |
| **View Transitions API** | native (Chromium + Safari TP) | Cover-to-feature gatefolds; graceful fallback to instant cut |
| **Rive** | proposed, ornaments only | State-machine-driven vector ornaments (PopShape and PopIcon loops) where a CSS keyframe won't express a two-state handoff. Not for page animation. |

### Out

| Tool | Rejected because |
|---|---|
| **Framer** (the service, not the library) | Hosted site builder; would replace the codebase, not extend it |
| **Lottie** | JSON-based runtime animation; ships opinionated easing curves and a large runtime; Rive covers the same ground with a smaller, saner footprint |
| **GSAP** | Duplicates Motion and the native APIs we already use; introduces a license concern at scale; no feature we need that Motion + native can't do |
| **Lenis** | "Buttery smooth scroll" is a SaaS marketing phrase; overrides the reader's scroll preference; violates §II ("the reader owns their scroll") |
| **AOS, Splide, Swiper, Typed.js, Locomotive, ScrollMagic** | Point libraries for patterns we either don't need or can build in twenty lines of Motion |

The rule: **one animation library, Motion. One vector runtime,
Rive (if accepted). Everything else is native.**

---

## Discovery sprint — three prototypes behind a flag

Before the interactions system is formalized across the whole
site, three prototypes ship behind a single build flag
(`VITE_INTERACTIONS_V1=1`). They are opt-in per contributor and
per preview deploy. Only after all three pass editorial review
does the flag flip to always-on.

| No. | Prototype | What it is | Print analog | Owner |
|---|---|---|---|---|
| 1 | **Section-kicker type-in on scroll** | As the reader scrolls a section into view, the `[KICKER · 日本語]` types itself in character-by-character, 30ms per character, then the tomato rule draws left-to-right in 400ms. One-shot per session, per kicker. | Page turn staged as typesetting | (Motion + IO) |
| 2 | **Pull-quote hover-reveal-attribution** | On pointer-capable devices, hovering an essay pull-quote reveals a right-margin attribution in mono tomato, 140ms ease-out. Touch devices see it always. | The margin note, compressed to cursor | (CSS + Motion) |
| 3 | **View Transitions for cover→feature** | The cover's feature monument persists to the feature hero as a View Transition. On unsupported browsers: instant cut, no polyfill. | The gatefold, opening | (View Transitions API) |

### Review contract

Each prototype ships with:

1. A one-paragraph spec at `docs/interactions/<slug>.md`.
2. A before/after loom or screen capture, checked into
   `docs/interactions/<slug>.mp4` or linked from the spec.
3. A reduced-motion recording showing the degraded state.
4. A measurement: CLS, INP, and largest paint impact from Lighthouse
   on a 4× CPU throttle, before and after.
5. A named reviewer from outside the PR author.

A prototype that ships without any of the five ships behind
`VITE_INTERACTIONS_V1=0` until the gap is closed.

---

## Rules for contributors

1. **Never name the inspiration on the site.** Same as web, same
   as TikTok. The grammar carries it. No "Taschen-style page
   transition" in copy, no "gatefold" in a component name — the
   mechanic ships under a neutral name.
2. **Never add an interaction library.** Motion, Rive (if
   accepted), and native. Every new dependency in the animation
   space is a PR that requires this doc be edited first.
3. **Never animate layout.** Only `opacity` and `transform`. No
   `width`, `height`, `padding`, `margin`, `top`, `left` in any
   animation or transition. If a layout move is needed, it ships
   as a View Transition.
4. **Never run two reveals at once on the same element.** A
   reveal is a single named motion. Fade OR rise OR letter-space,
   not a composite. The composite reads as SaaS.
5. **Never hover without `(hover: hover)`.** Every `:hover` rule
   is wrapped in the media query. Touch devices get the resting
   state. No exceptions.
6. **Never react to scroll velocity.** Scroll triggers reveals;
   scroll does not drive scale, rotation, translation beyond the
   6px micro-parallax ceiling in §III.3.
7. **Never ship an interaction without a reduced-motion path.**
   The fallback is almost always "instant, no transform." It is
   the default branch of every Motion and View Transition call.
8. **Never handle pointer events on body text.** Prose is read,
   not tapped. Links and the specified content-level tools in
   §III.5 are the only in-prose interactions.
9. **Every interaction ships with a named spec.** `docs/
   interactions/<slug>.md`: one paragraph, one table of
   properties, one reduced-motion note. Link it in the PR.
10. **Every interaction ships with a kill switch.** A CSS
    variable, a flag, or a `data-interactions="off"` attribute on
    the root. The author can turn it off without a release.

---

## The ten principles

1. **The page is the content, the interaction is the reader's
   hand.** We do not animate to decorate. We animate because the
   reader did something, or the page entered the reader's view,
   or the medium (a screen) demands a move the print page would
   have made in another way.

2. **Still is the default.** The resting state of every surface
   is still. Motion is the exception, timed, named, and reviewed.
   The magazine is not a live feed.

3. **Three print interactions, six web categories, one toolkit.**
   Page turn, gatefold, moving-in-light become scroll reveals,
   page transitions, and hover signals. Micro-parallax,
   content-level tools, and state-driven ambient are the three
   additions print could not have. There is no seventh category.

4. **The reader owns their scroll.** No jacking, no pinning
   beyond a section's own height, no smooth-scroll polyfills, no
   capture of the wheel. The browser's default scroll is the
   fastest, most predictable scroll we can ship.

5. **Hover is for pointers, never for touch.** Every hover state
   is gated by `(hover: hover)`. Touch surfaces are always in
   the resting state. The interaction system degrades upward
   from touch.

6. **Layout is layout; animation is opacity and transform.** A
   layout change is either instant or a View Transition. A CSS
   transition does not cross layout properties. The browser
   thanks us with no jank.

7. **One animation library, one vector runtime.** Motion and (if
   accepted) Rive. A second choice in either slot is a discussion,
   not a PR.

8. **Reduced-motion is a first-class output, not a fallback.**
   Every motion is designed with its reduced-motion state as the
   default branch. Reduced-motion is the form in which the
   interaction ships to the majority of screens under sunlight,
   on the train, at low battery.

9. **The chrome does not react.** Masthead, folio, nav, and the
   issue-frame stay still. The only surfaces that react are the
   feature modules and their specified content-level tools.
   Chrome reacting is the first tell of a SaaS app.

10. **Never name the inspiration.** Same rule as `docs/
    design-language.md` and `docs/tiktok.md`. Taschen is not
    said. NASA annual reports are not said. The View Transitions
    demos are not said. The grammar carries the homage.

---

## Future moves

- **Per-issue interaction palette.** A style issue may allow one
  extra hover signal (e.g., fabric-swatch reveal on a gear card);
  a forecast issue may allow a scrubber on a timeline chart. The
  palette is declared in `IssueRecord` and type-checked against
  the six in-scope categories.
- **Rive ornament tests.** Two to three ornaments (the
  `asterisk`, the `arc-top` path text) authored as Rive state
  machines to evaluate bundle cost and motion authoring DX
  against the current pure-CSS path.
- **View Transitions for list → detail inside an issue** (table
  of contents → feature). Once (3) in the discovery sprint is
  accepted, the same primitive extends to catalog rows.
- **Interaction audit tooling.** A build-time lint that fails any
  CSS `transition` property naming `width`, `height`, `top`,
  `left`, `right`, `bottom`, `padding`, `margin`, or naming an
  `ease-in-out` curve on a reveal (reveals are `cubic-bezier(0.22,
  1, 0.36, 1)` only).
- **Print stylesheet parity.** Every interaction spec ships with
  a printable equivalent (the still frame, the final state)
  because `@media print` must remain a first-class output.
- **Zero-motion variant for RSS / JSON Feed exports.** When the
  issue is consumed outside the browser, the interaction layer
  is absent by construction. The typography, the structure, and
  the editorial voice carry alone — as they must.
