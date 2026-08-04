Run the knowledge base dream sequence — ingest new raw captures, lint the wiki for problems, and rewrite the index/log/registry so the second brain stays consistent and self-evolving.

You are operating on the knowledge base at `knowledge-base/`. Read
`knowledge-base/CLAUDE.md` first — it is the operating manual and may
have been customized since this command was written. Follow the live
rules there if they differ from the steps below.

## Protocol

### 1. Ingest

- List every file in `knowledge-base/raw/` (ignore `README.md`).
- Read `knowledge-base/wiki/processed.md` and diff: find raw files
  that are **not yet** in the registry.
- For each new file: read it, extract concepts / entities / sources,
  and fold it into `knowledge-base/wiki/index.md` with links back to
  the raw file. Never re-ingest a file already in the registry.

### 2. Lint

Scan the whole wiki for:
- **Contradictions** — claims that conflict. Flag both, note which
  source each came from.
- **Stale claims** — facts that may have aged out. Mark for review
  with the capture date.
- **Duplicates** — the same concept covered in two places. Merge into
  one entry; keep all source links.
- **Orphans** — files nothing links to. Wire them into the index, or
  flag for removal if they are noise.

### 3. Update

- Rewrite `knowledge-base/wiki/index.md` so it is internally
  consistent (concepts, entities, sources all linked).
- Append a dated entry to `knowledge-base/wiki/log.md` (newest at top,
  append-only) describing what was ingested, merged, and flagged.
- Update `knowledge-base/wiki/processed.md` with every newly ingested
  raw file: `filename — date — where it landed`.

## Report format

```
# Dream Sequence — [date]

## Ingested
- [raw file] -> [wiki destination]   (or: nothing new)

## Lint findings
- Contradictions: [list or none]
- Stale: [list or none]
- Duplicates merged: [list or none]
- Orphans: [list or none]

## Wiki state: CONSISTENT / NEEDS REVIEW
```
