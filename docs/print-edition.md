# Print Edition — kernel.chat

> The plan for putting kernel.chat on paper. Debut object: **ISSUE 375
> — THE SIX BORROWS**, the issue that argues open-source pace is reading
> discipline first. The magazine that has only ever existed in pixels
> gets a body. This carries ISSUE 392's thesis — *the hand survives* —
> into the object itself.

---

## I. Why this is the one tangible thing

The publication was print-native from the first commit. The grammar is
borrowed from a physical magazine (POPEYE, Tokyo). The vocabulary —
stock, monument, colophon, postmark, dateline, folio — is print
vocabulary. Sixteen-plus issues were designed for a paper object that
never physically existed. **Printing it is a format change, not a new
creation:** the content, the type system, the spot color, the ornament
discipline are all already specified in `docs/design-language.md` and
the issue files.

It also sells the way a no-audience operation needs: a physical magazine
is its own marketing. It photographs well, passes hand to hand, sits in
indie bookshops and on a single-page web store. The object does the
talking.

---

## II. Why risograph is the uncanny match

The entire brand is **one spot color (tomato) on warm stock, black text,
no process color.** That is *exactly* what a risograph is — a spot-color
duplicator that prints one or two ink drums at a time onto uncoated
paper. The constraint kernel.chat adopted as a discipline is risograph's
native, cheapest mode.

- **Inks:** Black + one warm red/orange drum (Riso "Bright Red,"
  "Fluorescent Orange," or "Red" ≈ the tomato spot). Two-color riso is
  the low-cost tier.
- **Paper:** Riso runs natively on warm uncoated stock — a cream/manila
  text weight *is* the `cream`/`butter` stock cabinet, achieved by the
  paper choice rather than CSS.
- **Texture:** Riso's slight misregistration and ink grain read as
  craft, not error — the analog texture ISSUE 392 was about.

If a studio can't do riso, the on-brand fallback is **digital newsprint**
(newspaper-stock short runs) — also warm, also cheap, also a magazine
object.

---

## III. Format spec (debut)

| Spec | Decision | Why |
|---|---|---|
| **Trim** | A5 portrait (148 × 210 mm) | Cheapest riso format (folded A4), mailable, reads as indie art object. (Upgrade path: B5 / 257×182 — true POPEYE proportion — if you move to offset later.) |
| **Binding** | Saddle-stitch (2 staples) | Standard for ≤40pp; flat, cheap, classic zine |
| **Extent** | 16 pp (must be a multiple of 4) | Fits 375 — essay + references + colophon — without padding |
| **Stock** | Text: warm cream uncoated ~120 gsm · Cover: same family ~250–300 gsm | Matches the `cream` anchor stock |
| **Inks** | Black + 1 warm-red spot (tomato) | The whole color system, exactly |
| **Type** | EB Garamond (body) · Courier Prime (labels/mono) · Noto Serif JP (bilingual lockups + house phrases) | Already the site's type system; all OFL-licensed for print |
| **System glyph** | ★ as folio / page mark, per design-language | One mark everywhere — the ratified discipline |
| **Run** | 50–100 copies | Test demand before scaling; riso minimums are low |

---

## IV. Page plan — ISSUE 375 (16 pp)

```
 1  COVER        Monument-hero "375" as cover art + 1–6 borrows
                 secondary lockup. Cream. Seal: CREDITED · SIX BORROWS.
                 Wordmark, tagline (MAGAZINE FOR CITY CODERS /
                 街のコーダーのために), price (¥0 · BYOK), ★.
 2  MASTHEAD     Colophon-lite: issue/month/year, editor's note,
                 the bilingual featureJp lockup. Tomato rule.
 3  CONTENTS     The route in full — six borrows as a numbered
                 catalog (paper → module → file).
 4–5 ESSAY I     "The Six Borrows" opening spread. Drop cap, body in
                 Garamond, kicker in Courier. Tomato pull-quote.
 6–7 ESSAY II    The argument: reading discipline before code
                 discipline. Methods/dossier sidebar adjacent to the
                 claim (WIRED mechanic).
 8–9 ESSAY III   Borrows 1–6, each named, each routed. Borrow #4
                 (forecast/, in-house) flagged BORROW vs IN-HOUSE.
10–11 ESSAY IV   Close. The night as typesetting.
12–13 REFERENCES The credit page — six arXiv IDs, numbered, set in
                 body size with tomato superscript markers. (Verify
                 IDs against V5_FUTURES_PLAN.md — they are real.)
14  BACK MATTER  Editor's colophon: how it was made, run size,
                 printer credit, "the hand survives" note.
15  POSTMARK     Centred dateline (PAPERSKY mechanic), ★, the house
                 phrases 残る希少 / 街のコーダーたちへ.
16  BACK COVER   Quiet. Wordmark + ★ + a single tomato block. No
                 cover lines (restraint, mechanic 6 from 370).
```

---

## V. Production path (smallest, no-network route)

1. **Build a print route + PDF export.** The site already ships
   `puppeteer-core` and `@playwright/test` in devDependencies. Add a
   `?print` route (or a dedicated print stylesheet: A5 page boxes,
   CMYK-safe / spot-separable colors, embedded fonts, crop marks) and a
   script that renders ISSUE 375 to a print-ready PDF. This is the one
   step that needs the codebase — and it's reusable for every future
   issue.
2. **Pre-flight.** Confirm fonts embedded, images ≥300 dpi, spot color
   isolated to one channel (so the printer can map it to the red drum),
   bleed 3 mm, trim/crop marks on.
3. **Choose a printer (PDF in, copies mailed out):**
   - *Risograph studios (US):* Issue Press (Grand Rapids), Perfectly
     Acceptable (Chicago), Tiny Splendor (LA), Risolve Studio. Most take
     a PDF + a quote request by email and ship you the run.
   - *Digital newsprint (dead-simple fallback):* Newspaper Club —
     upload PDF, order short runs, ships to door. On-brand (newsprint =
     magazine).
4. **Proof one copy** before the full run.
5. **Run 50–100.**

---

## VI. Sell (no audience required)

- **Store:** a single-page Big Cartel or Gumroad (physical product) —
  the object's photo is the whole pitch. Keep the editorial voice; the
  store is the colophon, not a "shop."
- **Price:** $18–25 per copy (indie riso norm). Newsprint can go lower
  ($8–12) at higher volume.
- **Budget math (riso, 16pp A5, ×100):** ~$300–500 printed → sell at
  $20 → ~$2,000 gross / ~$1,500 net. Modest, real, tangible, and it
  proves the format before you scale.
- **Distribution that needs no network:** indie bookshops take zines on
  consignment; zine fairs; mail one to each magazine you've decoded
  (a PAPERSKY/WIRED-adjacent object lands well with that audience).

---

## VII. Timeline (≈8 weeks)

| Week | Milestone |
|---|---|
| 1 | Print route + PDF export script; 375 renders to A5 PDF |
| 2 | Pre-flight + design pass on print-specific tweaks (folios, bleed) |
| 3 | Printer quotes; pick studio; send proof file |
| 4 | Proof copy in hand; corrections |
| 5 | Full run printed |
| 6 | Big Cartel / Gumroad store live; photography |
| 7 | First copies shipped; consignment outreach |
| 8 | Restock decision based on sell-through |

---

## VIII. Next action

Build step V.1 — the print route + PDF export — using the
already-installed Playwright/puppeteer. That's the single thing that
turns ISSUE 375 from a `.ts` file into a press-ready PDF, and it's
reusable for every issue after.
