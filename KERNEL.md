# KERNEL.md — kernel.chat group

> **Canonical project reference.** Supersedes `CLAUDE.md`. This file is the
> single source of truth for what the project is, where things live, how
> to ship, and what discipline holds the work together.
>
> **Publishing a new magazine issue?** Read
> [`src/content/issues/PUBLISHING.md`](src/content/issues/PUBLISHING.md)
> first.
>
> **Adding to the v5 futures substrate?** Read
> [`packages/kbot/V5_FUTURES_PLAN.md`](packages/kbot/V5_FUTURES_PLAN.md).
>
> **Touching the magazine's visual grammar?** Read
> [`docs/design-language.md`](docs/design-language.md).

---

## I. What kernel.chat is

**One publication on two media.** Not a product with a marketing site,
not a magazine with a branded tool — *one editorial operation working
across two surfaces*. The discipline is the same in both rooms.

**Surface 1 — kbot.** An open-source terminal AI agent
(`@kernel.chat/kbot` on npm). MIT. BYOK. Local-first. ~100 specialty
skills as of v4.5.0, evidence-curated from 670 in v4.0 with a public
audit trail at `packages/kbot/CURATION_DISCOVERY/CURATION_DECISION.csv`.
The package sits inside a family — `kbot-finance` (regulated-industry
audit primitives), `kbot-orchestrator` (the orchestration + agent
fidelity disciplines), `agent-os` (the OS-shaped portion mirrored to
`isaacsight/agent-os`), plus seven specialty packages.

**Surface 2 — kernel.chat.** An editorial magazine. Monthly cadence.
Thirty-one issues in the catalog (360–390). POPEYE-grammar anchored,
PAPERSKY and WIRED as decoded editorial neighbours. The site lives in
`src/` and ships to `https://kernel.chat` via GitHub Pages.

The two surfaces share one editor's discipline: count what gets read,
cut what doesn't, file the audit in public, keep the manuscripts in
the drawer. Whether the surface is a tool registry or a table of
contents, the work is the same.

---

## II. Active state (2026-05-26)

| | kbot | kernel.chat |
|---|---|---|
| Latest version | **4.5.0** (npm) | **ISSUE 390 — ON THE CONSUMER STANDARD** (live cover) |
| Surface area | 100 specialty skills + 35 specialist agents + 10 packages in the family | 31 issues, 2 decoded neighbours, 4 starred mechanics in active use |
| Core moat | Music (Ableton/Serum/M4L), computer-use coordinator (Peekaboo AX-first as of 4.4), local AI (Ollama/LLaDA), channels (Slack/Office), V5 futures substrate, OWASP-self-audited posture | POPEYE-grammar editorial discipline, evidence-driven audit trail, named field (agentic engineering) with three disciplines coined and three reference packages |
| Cadence | Patch versions multi-per-week; minor versions monthly | Monthly issues, drops of 2–4 common, May 2026 ran 11 issues in three weeks |
| What just shipped | OWASP self-audit (ASI01–ASI10), kbot-finance FEDERAL_ALIGNMENT.md (NIST AI RMF + EO + DoD), kbot-orchestrator v0.3.0-alpha.0 (refusal predicates + two-kind classifier), C2PA emission design, agent-os mirror at isaacsight/agent-os | 381–390 ten-issue arc: provenance manifesto → fieldwork → field/discipline naming series ("Agentic Substrates for the Frontier"); cobalt accent debuted at 380, asterisk-stamp now eleven issues running |

**Immediate context the next session needs:**
- The field has a name: **agentic engineering** (the magazine's beat,
  field-named ISSUE 386 / docs/agentic-engineering.md). Umbrella is
  **autonomy engineering** (ISSUE 388). Three disciplines coined so
  far: provenance engineering (381 + kbot-finance/ROLE.md),
  orchestration engineering (387 + kbot-orchestrator/ROLE.md), agent
  fidelity engineering (389 + kbot-orchestrator/AGENT_FIDELITY_ROLE.md)
- The naming pattern is durable: ROLE.md in the package + reference
  implementation open-sourced + magazine issue that declares the move.
  Each ROLE.md says what the package is *for*, not what it does
- **"Agentic Substrates for the Frontier"** is the in-flight series
  — 388 declared it, 389 named agent fidelity, 390 read the consumer-
  side of provenance via C2PA + Google I/O 2026. Series will read
  each adjacent autonomy branch over 4–6 weeks
- **agent-os** ships as a standalone mirror at `isaacsight/agent-os`
  with auto-sync workflow — the OS-shaped portion of orchestration is
  citable from outside the kernel monorepo
- kbot v4.4.0 wired Peekaboo as AX-first native automation
  (snapshot-then-act over screenshot-and-guess); current v4.5.0
- v4.0 cut 670 → 105 evidence-driven; 61 deprecated tools have warn-once
  runtime emission and are scheduled for removal across 4.1 → 4.5
- V5 futures live as substrate at `packages/kbot/src/futures/`
  (harness, skill-graph, latent-state, forecast, persona, debate) —
  stub-driven, opt-in, none auto-wired into the agent loop yet
- The OWASP Top 10 for Agentic Applications 2026 self-audit is at
  `docs/owasp-agentic-self-audit.md` (CC BY 4.0). Strong on ASI02
  (tool misuse) + ASI06 (context mgmt); weakest on ASI04 (supply chain)
- The `kbot.md` Claude Code skill at `.claude/skills/kbot.md`
  pre-authorizes the kbot integration so safety filters stop refusing
  legitimate kbot calls (the Harrison fix)
- jcode (1jehuang/jcode, 840★) is in the same neighbourhood as kbot —
  different category (meta-harness vs parallel agent); coexistence
  story shipped at `packages/kbot/templates/jcode-mcp-snippet.json`

---

## III. The two disciplines

### Open sovereign stack (kbot)

The architectural frame underneath kbot's choices. Three layers, three
roles:

- **Reasoning layer** — Claude Code (Opus 4.7), or whatever the user's
  primary AI editor is
- **Specialty layer** — kbot, the parallel BYOK agent with the
  verticals other harnesses don't ship
- **Substrate layer** — V5 futures (`src/futures/`): harness evolution
  loop, skill graph, latent-state envelope, forecast, persona, debate

The three compose. `kbot setup-claude-code` wires kbot into Claude
Code's MCP host; the `templates/jcode-mcp-snippet.json` does the same
for jcode users. Composition is infrastructure when the seams have
addresses.

**Honest about what kbot doesn't do:** Rust-fast cold start (jcode
wins on raw boot, kbot doesn't chase this); enterprise SaaS coverage
(Atlassian/GitLab native — kbot has Office via Graph but the rest are
MCP-installable); polish (jcode's terminal UI is more refined).

**Honest about what kbot owns:** music production (Ableton/Serum/M4L),
computer-use at scale (parallel coordinator), local-first AI ($0 via
Ollama/LLaDA/MLX/embedded llama.cpp), background daemons (24/7 work),
specialty agents (guardian, hacker, researcher, …).

### Editorial-neighbours framework (kernel.chat)

The magazine has a **spine** and a working file of **neighbours**.

- **Spine** — POPEYE (Tokyo, Magazine House Co.). Never named on the
  site; the grammar carries the homage.
- **First neighbour** — PAPERSKY (Tokyo). Decoded for four
  transferable mechanics: restraint, single-glyph system thread,
  place-and-route structure, postmark dateline. All four now in
  active use as of 372.
- **Second neighbour** — WIRED (San Francisco). Decoded 2026-04-29
  for the data-grounded register: methods sidebar adjacent to the
  claim, numbered references at the foot of long features, pull-quote
  with the number not the sentence, tomato-tinted inline footnote
  markers.

**Discipline:** steal mechanics, not silence. Borrow the move; leave
the costume. Reduce to one mark you use everywhere (the asterisk ★).
Pick the spine because you needed an anchor; collect the neighbours
because each does one move the spine doesn't.

The same framework applies one level up — to the AI tools sitting
next to each other on the desk. See ISSUE 373: ON COMPOSITION.

---

## IV. Directory map

```
kernel.chat/                        ← repo root
├── KERNEL.md                       ← this file (canonical reference)
├── CLAUDE.md                       ← shim pointing at KERNEL.md
├── SCRATCHPAD.md                   ← session memory; update at end of session
├── README.md                       ← public landing for the repo
│
├── docs/
│   └── design-language.md          ← magazine visual grammar (POPEYE, PAPERSKY, WIRED)
│
├── packages/kbot/                  ← the agent (npm @kernel.chat/kbot)
│   ├── README.md                   ← npm-facing
│   ├── CHANGELOG.md                ← all releases, evidence-cited
│   ├── BENCHMARKS.md               ← methodology-explicit cold-start + cost-per-task
│   ├── V5_FUTURES_PLAN.md          ← the substrate plan that shipped 4.1
│   ├── RELEASE_NOTES_4_0.md        ← the audit-driven 4.0 cut
│   ├── PLUGINS_INTEGRITY.md        ← plugin manifest + fail-closed enforcement
│   ├── CURATION_PLAN.md            ← the 670 → 52 proposal that drove 4.0
│   ├── CURATION_DISCOVERY/         ← per-tool decision audit trail
│   ├── examples/                   ← plugins.json sample, etc.
│   ├── templates/                  ← jcode-mcp-snippet.json + kbot-skill.md
│   ├── research/                   ← jcode-analysis, action-tokens
│   └── src/
│       ├── cli.ts                  ← entrypoint, all kbot subcommands
│       ├── agent.ts                ← the agent loop
│       ├── auth.ts                 ← 20-provider BYOK config
│       ├── streaming.ts            ← API call layer + cache-warmth wired in
│       ├── architect.ts            ← --architect dual-agent loop (default Opus 4.7)
│       ├── cache-warmth.ts         ← prompt-cache TTL warning (jcode borrow)
│       ├── futures/                ← v5 architectural skeleton (NEW in 4.1)
│       │   ├── harness/            ← Sylph evolution loop
│       │   ├── skill-graph/        ← Tencent SkillSynth
│       │   ├── latent-state/       ← Recursive MAS envelope
│       │   ├── forecast/           ← in-house projection
│       │   ├── persona/            ← Cequence privilege scoping
│       │   └── debate/             ← Plurai BARRED runner
│       ├── channels/               ← Slack (full), Office (full), 5 stubs
│       ├── tools/                  ← skill registry (~100 active in 4.1)
│       ├── agents/                 ← 17 specialist roles + security-agent
│       ├── planner/hierarchical/   ← 4-tier planner (wired into workspace agents)
│       └── ide/mcp-server.ts       ← kbot exposed as MCP for editors
│
├── src/                            ← kernel.chat magazine site (React + Vite)
│   ├── content/
│   │   └── issues/
│   │       ├── PUBLISHING.md       ← THE source of truth for shipping issues
│   │       ├── index.ts            ← IssueRecord type + ALL_ISSUES + LATEST_ISSUE
│   │       ├── accents.ts          ← Ink Cabinet (named seeds + per-stock lift)
│   │       ├── 360.ts ... 375.ts   ← every published issue
│   │       └── …
│   ├── pages/                      ← routes (IssueDetailPage, EnginePage, …)
│   ├── engine/                     ← AI orchestration (when the magazine
│   │                                  hosts an interactive surface)
│   └── components/MagazineFrame.tsx← masthead/folio rendering
│
├── tools/                          ← project-level scripts (NOT kbot tools)
│   ├── kbot-daemon.ts              ← 24/7 background worker
│   ├── kbot-discovery-daemon.ts    ← self-advocacy daemon
│   ├── kbot-social-daemon.ts       ← social media autoposter
│   ├── kbot-local-mcp.ts           ← MCP server for Claude Code (local-Ollama)
│   ├── kernel-*-mcp.ts             ← project MCP servers
│   └── …
│
├── supabase/                       ← edge functions for site backend
│
└── .claude/
    ├── skills/kbot.md              ← Claude Code pre-authorization skill
    └── agents/                     ← 44 specialist agent definitions
```

---

## V. How to ship

### kbot (npm)

```bash
cd packages/kbot
# 1. Bump version in package.json
# 2. Update CHANGELOG.md with what shipped and why
npm run build              # tsc + chmod +x dist/cli.js
npm run test               # vitest — full suite must pass
npx tsc --noEmit           # typecheck must be clean
git add . && git commit -m "kbot vX.Y.Z: …"
git push origin main
npm publish                # @kernel.chat/kbot
```

Always:
- Cite the **why** in the commit and CHANGELOG, not just the what
- Keep the audit trail (CURATION_DISCOVERY, RELEASE_NOTES) updated
  for any cut or substrate change
- Use `Co-Authored-By: Claude Opus 4.7 (1M context)` in commit
  messages when Claude Code did substantial agent-driven work

### kernel.chat (magazine)

```bash
# 1. Add src/content/issues/<number>.ts following the IssueRecord shape
#    (template: 370.ts for essays, 371.ts for asymmetric profiles)
# 2. Import + push into ALL_ISSUES in src/content/issues/index.ts
# 3. Run typecheck
npx tsc --noEmit
# 4. Build + deploy
npm run build              # vite build
npm run deploy             # build + push to gh-pages
```

Always:
- Read `src/content/issues/PUBLISHING.md` first
- Magazine vocabulary only (issue / feature / spread / folio /
  monument / colophon / dateline / postmark — never dashboard /
  panel / card / widget / modal)
- Never name "POPEYE" in user-visible copy
- The grammar carries the homage

---

## VI. Constraints (always)

### Security
- Never commit `.env`, `.pem`, `.key` files
- Never expose `SUPABASE_SERVICE_KEY` in client code
- Never hardcode API keys or tokens in source
- kbot encrypts API keys at rest (AES-256-CBC) at `~/.kbot/config.json`
- Plugin integrity manifest at `~/.kbot/plugins.json` —
  fail-closed unless `KBOT_PLUGIN_INTEGRITY=off`

### Magazine
- See `docs/design-language.md` and `src/content/issues/PUBLISHING.md`
- No emojis in user-visible copy unless the issue genuinely needs it
- The asterisk (★) is the system glyph — one mark, three+ surfaces,
  never as decoration
- A magazine that does not name its sources is a marketing brochure
  — every borrow is credited at the surface where the relevant
  reader will find it first (file-header, README, references block)

### kbot
- BYOK is the contract — never hardcode a provider preference
- Local-first when there's a free path (Ollama/LLaDA) for the task
- Magazine vocabulary in CLI copy when natural ("specialist skills",
  "specialist agents", not "tools" / "modules" — internal identifiers
  unchanged)
- Don't add features beyond what the task requires; don't add
  fallbacks for cases that can't happen

---

## VII. Common pitfalls

- **kbot won't start** → check Node.js >= 20; `kbot doctor`
- **Provider 401** → `kbot auth`
- **npm publish fails** → `npm login` (token expires)
- **Local models slow on first run** → Ollama is downloading the model
- **Web build fails** → usually type errors; `npx tsc --noEmit` first
- **Computer use blocked on macOS** → grant Accessibility + Screen
  Recording to the Node binary in System Settings
- **gh-pages deploy lag** → 1–2 min for CDN to flip; check
  `git log origin/gh-pages -3`
- **CSS** → no Tailwind; vanilla CSS with `ka-` prefix in `src/index.css`

---

## VIII. The session pattern

Tonight's-and-this-morning's session shipped 7 npm releases, 4
magazine issues, 5 design-language extensions, and the WIRED decode
in roughly 18 hours. The pattern that made it work:

1. **Read research first.** Six papers became six modules under
   `src/futures/` because the reading was real before the code
   started. The plan (`V5_FUTURES_PLAN.md`) listed exclusions
   explicitly; the night honoured them.
2. **Plan in writing.** Long-form plan documents (PLAN, PROPOSAL,
   RELEASE_NOTES) before any code. The plan is what tells you what
   *not* to ship.
3. **Swarm-dispatch parallel agents** for non-overlapping work
   (separate files, separate scopes). Tight scope per agent —
   stream timeouts come from sprawling agent contexts.
4. **Foreground the integration step.** After agents return, do the
   wiring/registration/typecheck yourself — it's the one place
   conflict matters.
5. **Ship with evidence.** Every release commit cites numbers;
   audit trails (CSV, JSONL, RELEASE_NOTES) get filed alongside
   the code change.
6. **Update SCRATCHPAD at session end.** Future sessions need
   the context you accumulated.

---

## IX. References

| File | Role |
|---|---|
| `KERNEL.md` (this file) | Canonical project reference |
| `CLAUDE.md` | Shim pointing at KERNEL.md (auto-loaded by Claude Code) |
| `SCRATCHPAD.md` | Per-session working memory |
| `docs/design-language.md` | Magazine visual grammar |
| `packages/kbot/README.md` | npm-facing kbot intro |
| `packages/kbot/CHANGELOG.md` | All kbot releases, evidence-cited |
| `packages/kbot/V5_FUTURES_PLAN.md` | The 4.1 substrate plan |
| `packages/kbot/RELEASE_NOTES_4_0.md` | The 4.0 audit-driven cut |
| `packages/kbot/BENCHMARKS.md` | Methodology-explicit comparison |
| `packages/kbot/research/jcode-analysis.md` | Competitive analysis |
| `packages/kbot/CURATION_DISCOVERY/` | Per-tool audit trail (CSVs) |
| `src/content/issues/PUBLISHING.md` | Magazine publishing workflow |

---

*Last updated 2026-05-26, after the May 17–21 build sprint:
field-naming move (agentic engineering, docs/agentic-engineering.md),
three disciplines coined and packaged (provenance + orchestration +
agent fidelity), ten magazine issues 381–390 published, OWASP
self-audit and federal-alignment docs filed, kbot-orchestrator
v0.3.0-alpha.0 shipped with refusal predicates + classifier, agent-os
mirrored to its own repo. Update this file when the project shape
changes; update SCRATCHPAD.md at the end of every session.*
