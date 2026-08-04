# CLAUDE.md — Knowledge Base Operating Manual

> This is the operating manual for a **self-improving second brain**,
> built on Andrej Karpathy's LLM-wiki pattern. It is auto-loaded by
> Claude Code at session start when work happens inside
> `knowledge-base/`. **This file is maintained by the agent itself** —
> when the system's rules change, you edit this file as part of the
> same turn.

## What this is

A local-first, plain-text knowledge base. No Obsidian, no vector
store, no RAG database, no external service. Just folders and markdown
files that get *more* useful over time, because the agent organizes
and audits them on every pass.

The contract: **count what gets read, cut what doesn't, file the audit
in public, keep the raw drafts in the drawer.** The room is markdown;
the job is curation.

## The five building blocks

```
knowledge-base/
├── CLAUDE.md        # (this file) the operating manual / system prompt
├── raw/             # 1. INPUTS  — the dumping ground (messy by design)
├── wiki/            # 2. WIKI    — organized, linked, summarized layer
│   ├── index.md     #    the map: concepts, entities, sources
│   ├── log.md       #    the journal: what changed, when, why
│   └── processed.md #    the registry: which raw files are ingested
└── outputs/         # 3. OUTPUTS — generated artifacts (PDFs, decks, apps)
```

Plus the two behaviors:
4. **This manual** tells the agent how to read, write, and maintain
   everything above.
5. **The dream sequence** (`/dream-sequence`) is the periodic
   health-check / lint pass that keeps the wiki honest.

## raw/ — inputs

The raw folder is a **dumping ground**. It can be as messy as the user
wants. Organization is *not* this layer's job.

Two ways things land here:
- The user drops files, notes, or pasted text directly.
- The user shares a link or asks for research, and you fetch and save
  it here as markdown.

**When the user says "save this"** (a link, an article, a note), the
default action is: write it as a markdown file into `raw/`, preserving
the source URL and a capture date at the top of the file. Use a
descriptive `kebab-case` filename. Do not editorialize raw captures —
keep the source faithful.

Raw file front matter (top of every captured file):
```
---
source: <url or "user note">
captured: YYYY-MM-DD
title: <human title>
---
```

## wiki/ — the organization layer

This is where raw material becomes **navigable knowledge**: linked,
summarized, deduplicated. Three files run it.

### index.md — the map
A table of contents the agent uses to browse the base fast. It lists:
- **Concepts** — ideas, with a one-line gloss and links to the
  wiki/raw files that cover them.
- **Entities** — people, orgs, products, tools.
- **Sources** — the raw captures, with their topic tags.

Every entry links to where the detail lives. The index is a map, not
the territory; keep entries short.

### log.md — the journal
Append-only. Every meaningful change gets a dated line: what was added
or removed, and why. Newest entries at the top. This is the audit
trail — never rewrite history here, only append.

### processed.md — the registry
Tracks **which raw files have already been folded into the wiki**, so
the dream sequence never re-ingests the same file twice. One line per
raw file: filename, date processed, and where it landed in the wiki.

## outputs/ — artifacts

Anything *generated* from the knowledge base lives here: PDFs, slide
decks, summaries, briefs, small apps. Inputs go in `raw/`, knowledge
lives in `wiki/`, deliverables come out in `outputs/`. Keep the three
roles distinct.

## Default ingestion behavior

By default, when a new raw file arrives:
1. Save it to `raw/` with proper front matter.
2. Update `wiki/index.md` so the new concepts/entities/source are
   findable.
3. Append a line to `wiki/log.md`.
4. Record it in `wiki/processed.md`.

This default is **configurable**. If the user says something like
"don't auto-update the wiki on ingest — let the dream sequence handle
it," then change step 2–4 to only happen during the dream sequence,
and **edit this file to record the new rule.** The manual always
reflects the live behavior.

## The dream sequence (lint / health check)

A periodic self-audit. Invoke it with `/dream-sequence`, or run it on
a schedule (e.g. Claude desktop routines, weekly or daily). What it
does:

1. **Ingest** — list everything in `raw/`, diff against
   `processed.md`, and fold any new files into the wiki.
2. **Lint** — scan the wiki for:
   - **Contradictions** — claims that conflict; flag them.
   - **Stale claims** — facts that may have aged out; mark for review.
   - **Duplicates** — the same concept covered twice; merge.
   - **Orphans** — files nothing links to; wire them into the index
     or flag for removal.
3. **Update** — rewrite the index, append to the log, and update the
   registry so the base is internally consistent again.

The dream sequence is what makes the base self-evolving: it is far
more useful on day 100 than on day 1 because every pass tightens the
connections.

## Rules that always apply

1. **Plain text only.** Markdown files and folders. No databases, no
   binary indexes, no external services.
2. **The index links; it does not duplicate.** Detail lives in the raw
   or wiki files it points to.
3. **The log is append-only.** Never rewrite past entries.
4. **Never re-ingest.** Always check `processed.md` first.
5. **Faithful captures.** Preserve source URLs and dates; don't
   paraphrase raw material into the wiki without a link back.
6. **The agent maintains this manual.** When the rules change, edit
   this file in the same turn.
7. **No emojis** in files unless the user asks.

---

*Pattern credit: Andrej Karpathy's LLM-wiki / "second brain" approach —
a plain-text knowledge base the model maintains, with a periodic lint
pass for contradictions, stale claims, duplicates, and orphans.*
