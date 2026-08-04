# Knowledge Base — a self-evolving second brain

A local-first, plain-text second brain built on Andrej Karpathy's
LLM-wiki pattern. No Obsidian, no vector store, no RAG, no setup beyond
folders and markdown. It gets *more* useful over time because Claude
organizes and audits it on every pass.

For the full rules, read [`CLAUDE.md`](./CLAUDE.md) — that is the
operating manual the agent runs on.

## The shape

```
knowledge-base/
├── CLAUDE.md     operating manual (agent-maintained)
├── raw/          inputs — drop anything here, messy is fine
├── wiki/         organized, linked, summarized knowledge
│   ├── index.md  the map: concepts, entities, sources
│   ├── log.md    the journal: what changed and why
│   └── processed.md  registry of already-ingested raw files
└── outputs/      generated artifacts (PDFs, decks, briefs)
```

## How to use it — three moves

### 1. Feed it
Drop files into `raw/`, paste notes, or share a link and say
**"save this."** Claude writes it into `raw/` with the source URL and
date, then updates the wiki so it's findable later. Or ask for
research on a topic and Claude will pull sources into `raw/` for you.

### 2. Ask it
Ask a question in plain language — "what were my notes from X?",
"summarize what I know about Y." Claude reads `wiki/index.md` to find
where the answer lives, then pulls the relevant raw/wiki files.

### 3. Audit it — the dream sequence
Run `/dream-sequence` (or schedule it). Claude ingests anything new in
`raw/`, then lints the wiki for contradictions, stale claims,
duplicates, and orphans, and rewrites the index/log/registry so the
base stays consistent. This is what makes it self-evolving.

## Customizing

The system is plain text and the manual is editable. Tell Claude what
you want and it edits `CLAUDE.md` itself. Examples:
- "Don't auto-update the wiki on ingest — let the dream sequence
  handle it."
- "Run the dream sequence daily instead of weekly."
- "Tag everything for topic Z."

## Scheduling the dream sequence

`/dream-sequence` runs it on demand. To run it automatically, point a
Claude desktop routine (or any scheduler/cron you use) at the same
command on whatever cadence you like — daily if you capture a lot,
weekly otherwise.
