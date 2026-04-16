# TikTok Design Language — kernel.chat

> Companion to `docs/design-language.md`. The magazine's grammar,
> translated for a vertical-video platform.
>
> The account is **@kernel.chat** on TikTok. It is not a product
> account. It is not a personal account. It is the magazine,
> broadcast on a phone.

---

## Why TikTok at all

The magazine is typographic, slow, print-inspired. TikTok is
algorithmic, fast, attention-measured-in-seconds. The temptation is
to abandon the grammar on a platform that seems hostile to it.

We don't do that.

Kinfolk's Instagram is quiet and it works. MUJI's retail videos
are silent except for a single note and they work. POPEYE posts
still shots of magazine spreads and they work. The lesson is that
restraint reads *louder* on a loud platform, not quieter.

**The account is a vertical table of contents.** Every video is
either a page from the current issue, a cut from its feature, a
field dispatch that became an article, or a masthead note. The
account reinforces that kernel.chat is a publication. It does not
perform separately from the publication.

---

## The system

### Format — 9:16, every time

- Vertical only. 1080 × 1920. No landscape, no square.
- 15–60 seconds. Anything longer belongs as an article.
- Safe area: 80px top (for kicker) and 160px bottom (for handle +
  caption chrome). Nothing important in those zones.

### Type stack — unchanged

- **Display + prose**: EB Garamond → `var(--font-serif)`
- **Meta + captions**: Courier Prime → `var(--font-mono)`

No system fonts. No Futura, no Inter, no Instagram-default.
Serif leads. Always.

### Color — unchanged

Same tokens as the web. Every video sits on a warm ground:

- `--pop-cream` `#F3E9D2` — default video ground
- `--pop-ivory` `#FAF9F6` — airy / bright / interview
- `--pop-butter` `#EFD9A0` — indoor / night
- `--pop-kraft` `#C8A97E` — fashion / field dispatch
- `--pop-ink` `#1F1E1D` — manifesto / forecast / late-night

**Tomato (`#E24E1B`) is still the only spot color.** Italic
emphasis, kicker brackets, catalog numbers, the sign-off rule.
No second accent. Ever.

**No pure white. No pure black. No dark-mode UI gradient.**

### Grammar primitives — the video lockup

Every video ships with the same four-part structure. Think of it
as the section head for moving image.

```
┌──────────────────────────────────────┐
│  [KICKER · 日本語]                      │ ← 0–1s
│                                      │
│  Large serif headline                │ ← 1–3s
│  italic tomato emphasis              │
│                                      │
│  body / pull-quote / scene           │ ← 3–Xs
│                                      │
│  ── (tomato rule)                    │
│  ISSUE 365 · APR 2026                │ ← last 2s
└──────────────────────────────────────┘
```

| Element | Duration | Rule |
|---|---|---|
| Kicker | 0–1s | `[CATEGORY · 日本語]` in mono tomato |
| Headline | 1–3s | EB Garamond, italic emphasis → tomato |
| Body | 3–Xs | Pull-quote, scene, or voiceover text |
| Colophon | last 2s | Tomato rule + `ISSUE N · MONTH YEAR` |

The kicker and the colophon are the magazine showing up. They
appear on every single video. They're the masthead strip.

### Motion — minimal, deliberate

| Move | When | Timing |
|---|---|---|
| Fade in | Headlines entering | 200ms |
| Hold | Main beat | 60–80% of video |
| Fade out | Transitions | 200ms |
| Tomato underline sweep | Emphasis on a word | 400ms |
| Type reveal | Pull quotes, one line at a time | 80ms per character |

**No:** spring bounces, kinetic type, particle effects, camera
shakes, glitch effects, 3D text, sticker animations, emoji rain.

Motion is the difference between a book being opened and a
slideshow. We're a book being opened.

### Sound — restrained

Sound-on by default (TikTok rewards it) but never loud.

- **Field recordings** over music. A café in Shimokitazawa. A
  keyboard being typed on. Rain on a window. One held violin note.
- **Voiceover** is always the magazine voice — declarative, specific,
  unhedged. Not hyped. Not whispered. Read aloud at reading pace.
- **No trending sounds.** Ever. A trending sound pulls the video
  out of the magazine and into the platform's timeline. We are
  not of the timeline.
- **Silent videos are allowed.** A beautifully typeset pull quote
  on cream with no sound is a complete video. Let the caption
  carry it.

---

## Content types — the "cuts" of each issue

An issue ships with 3–5 pieces. Think of them as album tracks from
the LP. Each is a discrete editorial unit that links back to the
full issue.

| Type | What it is | Length |
|---|---|---|
| **Issue drop** | Cover animation: stock fills in, masthead slides in, issue number monument arrives. One line of feature copy. | 10–15s |
| **Pull quote** | One italic tomato pull-quote, read aloud, held on cream. The whole video is the quote. | 12–20s |
| **Page flip** | Three or four pages of a spread, held 3 seconds each. No voiceover. Ambient room sound. | 15–30s |
| **Field dispatch** | Shot in a city (Tokyo, Brooklyn, Berlin). One observation. The observation becomes a future article. | 20–40s |
| **Masthead note** | "Why we use kraft stock on the style issue." One editorial decision explained. | 25–45s |
| **Interview clip** | 20-second extract from a full interview — audio + serif caption. | 20s |
| **Monument** | The large issue number animation + one line. Announces the current issue. | 8–12s |
| **Colophon** | Who made the issue, what tools, what software. Credits-style. | 15–25s |

Each issue doesn't need every type. A forecast issue is mostly
pull quotes and monuments. A style issue is mostly field
dispatches and page flips. Pick the cuts that suit the feature.

### The "issue drop" in detail

Every time a new issue ships, the drop video is posted within 24
hours. It is the platform's version of the cover:

1. 0–2s: stock fills the frame from the left edge (cream, kraft,
   ink — whichever the issue is).
2. 2–5s: masthead slides in — wordmark, banner, ISSUE N.
3. 5–8s: the monument arrives, issue number at 80% frame height.
4. 8–12s: headline fades in under the monument, with italic
   tomato emphasis on the feature word.
5. 12–15s: colophon strip, tomato rule, sign-off.

No voiceover on the drop. Ambient room sound. Let the print
object land.

### Captions

- Written in the magazine voice. Not "🔥 new issue dropping 🔥."
- Always include: `ISSUE N · MONTH YEAR` and a link-in-bio mention.
- Bilingual kicker at the top of the caption: `[FEATURE · 手仕事号]`
- No hashtag wall. Three hashtags maximum: `#kernelchat
  #magazine` and one thematic one per issue.

---

## Application — where the magazine shows up

| Surface | Role |
|---|---|
| Profile avatar | Wordmark mark — tomato K on cream |
| Profile banner | Current issue's monument number |
| Profile bio | `MAGAZINE FOR CITY CODERS · 街のコーダーのために / kernel.chat` |
| Pinned posts (×3) | Latest issue drop, best pull-quote of current issue, masthead-note explainer |
| Grid feel | Every ninth video is a monument number. Every third is a pull quote. Creates an editorial rhythm on the profile grid without needing to "design the grid." |
| Link-in-bio | `kernel.chat/#/issues/<latest>` — the permanent URL of the current issue. Never a Linktree. |

---

## Rules for contributors

1. **Never name the inspiration.** Same as web. No "POPEYE" on
   camera, no "this is our POPEYE tribute" captions. The grammar
   carries the homage.
2. **Never break the type stack.** EB Garamond + Courier Prime.
   If a design tool doesn't have Garamond, use the free version
   from Google Fonts, never substitute.
3. **Never introduce a second spot color.** Tomato is the accent.
   The reserved accents (cobalt / ivy / pool) remain reserved for
   future issue variants and stay off TikTok until web uses them.
4. **Never use trending sounds.** Not even for reach. A trending
   sound dates the content to the week it was posted; the magazine
   is meant to be browseable five years from now.
5. **Never post without a kicker and colophon.** Even a 10-second
   monument video gets the `[MONUMENT · 記念]` kicker up top and
   `ISSUE N · MONTH YEAR` at the bottom.
6. **Never face-cam as the hook.** If a person appears, they
   appear as a subject, not as a host. Magazines have
   interviewees, not presenters.
7. **Never post a listicle.** "5 reasons to…" is a format we
   don't run. One idea per video. One quote. One observation.
   One scene.
8. **Never use generic stock video.** Skyline timelapses, coffee
   being poured in ultra-slow-mo, unboxings. All forbidden. Every
   frame is either typography, a page of the magazine, or a
   specific observed scene.
9. **Never break the caption voice.** Declarative, specific,
   unhedged. No "DM me for the full piece!" energy. No calls to
   action beyond the link-in-bio.
10. **Every video links to an issue.** If a video can't be
    tethered to a specific issue, it doesn't ship. The account is
    a table of contents, not a standalone feed.

---

## Voice guide (on camera + in captions)

Same as the web, but compressed for the format:

- **Declarative.** "This is what the uniform looks like now."
  Not "Have you noticed…?"
- **Specific.** Name the café, the keyboard, the fabric. Never
  "a coffee shop," "a keyboard," "some clothing."
- **Slightly tongue-in-cheek.** Confident without being superior.
  A single raised eyebrow, never a wink.
- **Bilingual wherever it fits.** JP kicker + EN headline. Or EN
  headline + JP subtitle. The JP is not translation; it is
  complement.
- **Short sentences.** Under fifteen words. A comma is usually a
  mistake on camera.
- **Sign-offs** in Japanese: 街のコーダーたちへ — "to the city
  coders." Always the last two seconds.

---

## What we don't do on TikTok

- No reaction videos.
- No duets or stitches (we post; we don't respond).
- No "day in the life" content. The magazine has no day.
- No before/after, no transformations.
- No software tutorials. The magazine is about culture, not
  how-to.
- No personality-branding. Isaac's face isn't the account; the
  magazine is.
- No growth-hacks. No "comment X to get the link." No "follow
  for more." The link is in the bio and the content is the work.
- No AI-generated voiceover. If it's voiced, a human voiced it.
- No AI-generated imagery. If we don't have an image, we let
  typography carry it.
- No engagement-bait questions in captions. If we're asking, we
  mean it.

---

## The ten principles

1. **The magazine is the content.** TikTok is the broadcast
   channel, not the medium. The video is a page, a pull quote, a
   scene from an issue. Never something that exists only on
   TikTok.

2. **Restraint reads louder on a loud platform.** The feed is a
   wall of motion and hype. A still serif pull quote on cream
   with no music stops the scroll harder than another hype edit.

3. **Warm grounds, always.** Never pure white or pure black.
   Cream, ivory, butter, kraft, ink — same tokens as the web.

4. **Serif leads.** The moment a video defaults to a sans-serif
   platform font, the magazine is gone.

5. **Tomato is still the only spot.** No second accent. No brand
   gradient. No neon.

6. **One idea per video.** Multiple ideas are multiple videos.
   Or they're an article and this video is a pull quote from it.

7. **Sound is restrained or absent.** No trending audio. Field
   recordings, single notes, voiceover at reading pace, or
   silence.

8. **Every video ships with a masthead.** Kicker at the top,
   colophon at the bottom. The video is inside the publication,
   not next to it.

9. **The account is a table of contents.** Profile grid = back
   catalog. Link in bio = current issue. The account has no life
   apart from the magazine.

10. **Never name the inspiration.** Same rule as web. POPEYE is
    not said. Kinfolk is not said. MUJI is not said. The grammar
    carries it.

---

## Template builders (deferred)

A future `tiktok/` directory in the repo will hold editable
templates — After Effects / Rive / Figma community files — that
encode the kicker, headline, monument, and colophon grammar as
reusable composition layers. Goal: one-call "drop a quote onto
the current-issue template" authoring, same load-bearing
philosophy as the web.

Until then, each video is hand-composed against this doc.

---

## Future moves

- TikTok → Instagram Reels cross-post (same 9:16, same templates).
- TikTok → YouTube Shorts cross-post (same).
- **No X/Twitter video.** 16:9 breaks the grammar; we post
  stills to X, video to TikTok/Reels/Shorts only.
- **Zero-motion video variant** for Threads and Mastodon: same
  typography composition exported as a static image; the
  typography does the work even without motion.
- Per-issue sound palette — a named field recording that
  accompanies the issue (e.g., ISSUE 363 style issue → "Blue
  Bottle Shibuya, 8am, light rain").
