# KBOT ↔ kernel.chat

Operator's reference for the two halves of the project: the K:BOT terminal CLI
(`@kernel.chat/kbot` on npm) and the kernel.chat web companion (this repo).

---

## I. Two products, one repo

| | K:BOT CLI | kernel.chat Web |
|---|---|---|
| **Where** | `packages/kbot/` | `src/` + `supabase/` |
| **Shipped via** | npm (`@kernel.chat/kbot`) | GitHub Pages (`gh-pages` branch) |
| **Runs** | user's terminal | browser (PWA) |
| **Provider model** | BYOK — 20 providers, keys stored locally (AES-256-CBC) | Routes through `supabase/functions/claude-proxy/` |
| **Cost to user** | $0 with local Ollama; otherwise pay-per-token to their own provider | Free tier + paid tiers via Stripe |
| **Data boundary** | All session data on-device in `~/.kbot/` | Supabase Postgres + storage (user-authenticated) |

**Rule:** Anything that needs a secret (OpenAI key, Stripe secret, Supabase service key) lives on the user's machine (CLI) or in an edge function (web). Never in the React bundle.

---

## II. Where the two products meet

### 1. Cloud sync — CLI → Web
`packages/kbot/src/cloud-sync.ts`

The CLI optionally syncs a slice of its learning state (patterns, solutions, user profile) to the kernel.chat backend so the web dashboard can render it. Off by default, opt-in via `kbot cloud` subcommand.

- Payload is user-owned (tied to their Supabase auth session)
- Sync endpoint: Supabase edge function (service-key gated, user-scoped RLS)
- Nothing leaves the machine without explicit `kbot cloud enable`

### 2. Agent routing — Web → CLI-style agents
`src/engine/` (web) mirrors the 17 core agents defined in `packages/kbot/src/agents/`. Both sides use the same agent IDs (`kernel`, `researcher`, `coder`, `guardian`, …) so a conversation started on the web can be resumed in the terminal without losing the specialist context.

### 3. Shared model registry
The canonical provider/model registry lives in `packages/kbot/src/auth.ts` (`PROVIDERS`). The web `claude-proxy` edge function keeps a parallel list. When a new model ships (e.g., **Claude Mythos 5**, **GPT-5.4-thinking**, **Gemini 3.1**), update **both** sides in the same PR.

### 4. MCP servers (third bridge)
Under `tools/`, MCP servers like `kernel-agent-mcp.ts` let Claude Code (or any MCP client) delegate to web-side specialist agents, and `kbot-local-mcp.ts` lets Claude Code hit the CLI's local Ollama — these are the glue layer used in daily dev sessions.

---

## III. When to build in kbot vs. kernel.chat

| Feature type | Build in kbot | Build in kernel.chat |
|---|---|---|
| Terminal workflow (bash, git, grep, files) | ✅ | ❌ |
| Local AI (Ollama, llama.cpp) | ✅ | ❌ — browsers can't run Ollama |
| Needs filesystem / subprocess | ✅ | ❌ |
| Visual/interactive UI, charts, rich content | ❌ | ✅ |
| Multi-user / shared state | ❌ | ✅ (Supabase) |
| Account management, billing | ❌ | ✅ |
| New AI provider | ✅ **and** ✅ (both registries) | |
| New specialist agent | ✅ **and** ✅ (keep IDs consistent) | |
| Mobile / iOS / PWA | ❌ | ✅ (Capacitor) |

**Heuristic:** if it needs a terminal or a subprocess → kbot. If it needs a screen → kernel.chat. If it touches the user's money or identity → kernel.chat via edge functions.

---

## IV. Shipping a change that spans both

1. **Design the boundary first.** Decide what state is user-local (kbot) vs shared (web).
2. **Update the shared registries together.** `packages/kbot/src/auth.ts` PROVIDERS + `supabase/functions/claude-proxy/` model list + `src/engine/` agent definitions should move in lockstep.
3. **Run `npm run typecheck`** at the root AND `cd packages/kbot && npm run typecheck`. Two pipelines, two type checks.
4. **Test the CLI path** (`cd packages/kbot && npm run dev -- <cmd>`) before publishing to npm.
5. **Test the web path** (`npm run dev` at root, then `npm run build`) before deploying to Pages.
6. **Deploy separately.** `npm publish` for the CLI; `npm run deploy` for the web. They have independent release cadences.

---

## V. Pitfalls to avoid

- **Don't** import anything from `packages/kbot/` into `src/` or vice versa. The CLI depends on Node APIs (`fs`, `child_process`) that don't exist in the browser; the web depends on React which the CLI doesn't need. Cross-sharing happens at the **registry/protocol level only** (JSON schemas, agent IDs).
- **Don't** duplicate model IDs across registries by hand — prefer a constant in a shared package (`packages/shared/`) when the surface grows. Today the two files are close enough to hand-sync, but that won't scale.
- **Don't** put secrets in either bundle. kbot encrypts at rest; the web uses edge functions. Anything else is a leak.
- **Don't** treat kbot as a "lite" version of the web. They're coequal surfaces for different contexts. A user in their terminal should never feel like they're missing something — and a user on their phone shouldn't need a terminal.

---

## VI. Recent April 2026 changes (AI news reflected)

The `claude/ai-news-updates-y2qoY` branch brought both halves in sync with the April 2026 model-release cycle:

- **Anthropic Claude Mythos 5** (10T params, cybersecurity / coding focused) — added to `PROVIDERS.anthropic.models` and the OpenRouter list in `packages/kbot/src/auth.ts`. Restricted preview — requests fall through to `claude-sonnet-4-6` if the key isn't allow-listed.
- **OpenAI GPT-5.4-thinking** (autonomous-agent variant, 75% on desktop task benchmarks) — added to `PROVIDERS.openai.models`.
- **Google Gemini 3.1 / 3.1-pro** (real-time voice + image; 6× memory compression) — added to `PROVIDERS.google.models`.
- **`kbot news`** subcommand shipped — pulls from HN, arXiv, GitHub Trending; optional local-Ollama digest via `--summarize`.
- **Model-releases tracker** added to `tools/kbot-discovery-daemon.ts` — runs every 6h, writes signals to `.kbot-discovery/model-releases/signals.jsonl`, notifies Discord on high-signal releases (HN ≥ 100 pts).

Keep this file updated whenever a cross-cutting change lands.
