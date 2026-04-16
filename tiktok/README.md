# tiktok/ — kernel.chat TikTok infrastructure

Load-bearing files for the kernel.chat TikTok account. Same
principle as `src/` — adding a new cut should be one template +
one spec, and the cascade handles itself.

---

## Directory map

```
tiktok/
├── README.md                   # this file
├── templates/                  # master SVG per cut type
│   ├── issue-drop.svg          # 10–15s cover animation
│   ├── pull-quote.svg          # 12–20s quote + attribution
│   ├── monument.svg            # 8–12s issue-number teaser
│   └── colophon.svg            # 15–25s credits
└── specs/                      # per-issue cut specs
    └── 365/                    # ISSUE 365 cuts
        ├── README.md           # mix + order + schedule
        ├── drop.md
        ├── pull-01.md
        ├── pull-02.md
        ├── masthead-note.md
        └── colophon.md
```

---

## How to add a new cut type

1. Create `tiktok/templates/<name>.svg` using the shared
   canvas (1080×1920, 9:16) and the token spec in
   `docs/tiktok-tokens.md`.
2. Register it in `docs/tiktok.md` § Eight Cuts and in
   `docs/tiktok-tokens.md` § Composition Templates.
3. Register it in `.claude/agents/tiktok-producer.md` § The
   Eight Cuts table.

## How to produce cuts for a new issue

1. Invoke the `tiktok-producer` agent with the issue number.
2. The agent reads `src/content/issues/<N>.ts`, picks a cut
   mix, and outputs specs.
3. File specs under `tiktok/specs/<N>/`.
4. A producer (human or agent) opens the matching SVG template,
   fills in the slots from the spec, animates per the motion
   tokens, and exports MP4.
5. The caption in the spec ships with the upload.

---

## Template contract

Every template SVG declares the standard layers via `<g id>`:

| Layer id | Role | Required |
|---|---|---|
| `#ground` | Paper stock fill | yes |
| `#kicker` | `[CATEGORY · 日本語]` mono tomato | yes |
| `#content` | The main beat — headline, quote, scene | yes |
| `#colophon` | Tomato rule + `ISSUE N · MONTH YEAR` | yes |
| `#sign-off` | Optional 街のコーダーたちへ | no |

Layer ids are stable across templates. A producer importing
any SVG knows where to find the fill slots without reading the
file.

---

## What lives here vs. what lives elsewhere

| Lives in `tiktok/` | Lives elsewhere |
|---|---|
| SVG masters (this repo) | MP4 exports (upload to TikTok, do not commit) |
| Written cut specs | Captions copy (inside the specs) |
| Per-issue cut plans | Analytics (out of scope for this repo) |
| Template registry | Actual video rendering (After Effects / Rive project files — optional, can live under `tiktok/projects/` if ever added) |

---

## Forbidden in `tiktok/`

- Binary MP4 files (bloats the repo; upload to TikTok instead)
- Reference images from other accounts (POPEYE spreads, Kinfolk
  grids, etc.) — carry the grammar in specs, not in screenshots
- Trending-sound audio files
- Platform-default fonts (Inter, SF, Roboto)
