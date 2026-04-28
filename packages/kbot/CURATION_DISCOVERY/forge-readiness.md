# Forge Readiness Assessment

**Question**: Can `forge_tool` actually absorb the 180 FORGE-bucket tools the curation plan wants to migrate out of core?

**Verdict**: **PARTIAL.** `forge_tool` can absorb roughly **35–40%** of the 180 today. The remaining ~60% needs new infrastructure before it can move. Most-needed addition: a **secrets-bridge** so forged code can read API keys from `~/.kbot/config.json` without violating the `process.env` blocklist.

Sources read:
- `packages/kbot/src/tools/forge.ts` (449 LOC)
- `packages/kbot/src/plugins.ts` (loader for `~/.kbot/plugins/`)
- `packages/kbot/CURATION_PLAN.md` (FORGE bucket = 180 tools)
- 5 sampled FORGE candidates (pubmed_search, dns_enum, stream_start, wallet_balance, arxiv_search) plus admin.ts spot-check.

---

## 1. forge_tool current capabilities

What `forge_tool` can do today:

- **Shape**: takes `{ name, description, parameters, code }`. `code` is a JS async function body that receives an `args` object and returns a string.
- **Execution**: runs the code inside a Node `vm.createContext` sandbox via `runInNewContext` with a 5-second timeout per call.
- **Sandbox globals exposed**: `args, console (no-op), Buffer, JSON, Math, Date, URL, URLSearchParams, setTimeout, clearTimeout, Promise`. **Plus `fetch` is callable** because `runInNewContext` inherits Node globals not explicitly shadowed.
- **Validation**: a 30-line regex blocklist rejects `eval`, `new Function`, `child_process`, `fs`, `net`, `dgram`, `tls`, `http2`, `os`, `crypto`, `process.env`, `process.exit`, `globalThis`, `__proto__`, `Reflect.*`, `Object.setPrototypeOf`, `.constructor(...)`, dynamic `import(...)` with non-literal path, etc.
- **Reserved names**: 16 core tool names cannot be overwritten.
- **Test gate**: before registration, the code is dry-run with synthetic typed args. If that throws, registration is rejected.
- **Persistence**: tool is written as a `.js` file to `~/.kbot/plugins/forged/<name>.js` and registered in-process.
- **Registry sharing**: `forge_publish`, `forge_search`, `forge_install` round-trip through `https://eoxxpyixdieprsxlpwcs.supabase.co/.../forge-registry`, with re-validation on install.
- **Invocation**: identical to any other registered tool — once `registerTool(toolDef)` runs, the agent loop sees it through `getTool()` and invokes it through the same pipeline (timeout, metrics, fallback, etc.).

---

## 2. forge_tool gaps

**Critical (blocks the migration as written):**

1. **No restart persistence path.** Forged tools are written to `~/.kbot/plugins/forged/<name>.js`, but `loadPlugins()` in `plugins.ts` reads `~/.kbot/plugins/*.js` (top-level only, no subdir recursion). Forged tools survive on disk but are NOT auto-loaded next session. They only re-register if the user re-runs forge_tool or runs forge_install. This needs to be fixed before forge can replace any tool that runs more than once.
2. **No secrets/auth surface.** `process.env` is blocked, `fs` is blocked, `crypto` is blocked. Forged code cannot read `~/.kbot/config.json` (the AES-encrypted BYOK key store), cannot read OAuth tokens, cannot read stream keys. Any tool that needs an API key beyond what a public-anonymous endpoint provides cannot be expressed.
3. **No persistent state.** Forged code can't open a JSON file, can't talk to a sqlite DB, can't write a state file. Any tool that needs cross-call memory (rate-limit counters, login sessions, "active wallet" pointer, scheduled jobs) cannot be expressed.
4. **No process spawning.** `child_process`, `spawn`, `exec`, `execFile`, `spawnSync` are all blocked. Anything that wraps a shell binary (`nmap`, `ffmpeg`, `dig`, `openssl`, `nvidia-smi`, `python`, `pip`) cannot be expressed.
5. **No native networking.** `net`, `dgram`, `tls`, `http2` are blocked. `fetch` works but only for HTTP/HTTPS request/response — no raw sockets, no DNS resolver (`dns.Resolver` is from `node:dns` which is not in the sandbox), no UDP, no TLS handshake inspection.

**Soft gaps:**

6. **Sandbox globals are minimal.** No `TextEncoder/TextDecoder`, no `crypto.subtle`, no `WebSocket`, no `EventSource`, no `AbortController` (though `AbortSignal.timeout` works on `fetch` because it's a built-in static).
7. **Return type is `string`.** Tools that natively return rich JSON have to stringify.
8. **No way to call other tools from forged code.** A forged composite that wants to call `kbot_grep` then `web_search` has no in-sandbox handle to the registry.
9. **Code is regex-validated, not AST-validated.** False positives are real (e.g., `process.exit` in a string literal, comment containing `eval(`). The blocklist is paranoid but blunt.
10. **No versioning of forged tools.** Re-forging overwrites with no history. Registry has versions, local store does not.

---

## 3. Five sampled candidates

| # | Tool | Source bucket | Replicable as-is? | Gap | What forge_tool needs to learn |
|---|---|---|---|---|---|
| 1 | `pubmed_search` (lab-bio) | Science wrapper | **YES** | None — pure HTTP fetch + XML regex parse, no auth, throttle is just a `setTimeout`. | Nothing. This is the canonical happy-path forge candidate. |
| 2 | `arxiv_search` (research) | Research wrapper | **YES** | None — single HTTPS GET against `export.arxiv.org`, regex parse the Atom XML. | Nothing. |
| 3 | `dns_enum` (hacker-toolkit) | Hacker shell-wrapper | **NO** | Imports `node:dns` (`new Resolver()`), and `node:dns` is not in the sandbox. The plan says "wrap dig" — but `child_process` is blocked too. | Either expose a curated `dns.lookup`/`dns.resolve` shim in the sandbox globals, or add a "shell-binary" forge mode that uses `kbot_bash` underneath. |
| 4 | `stream_start` (streaming.ts) | Stream shell-wrapper | **NO** | Spawns `ffmpeg`, reads stream keys from `process.env`, writes a PID file (`writeFileSync`), tracks a long-lived process across calls. Hits 4 of the 5 critical gaps simultaneously. | Process spawning, env/secret access, persistent state, long-running process handles. Effectively requires forge_tool to grow a daemon-task primitive. |
| 5 | `wallet_balance` / `wallet_list` (wallet.ts) | Admin/finance | **PARTIAL** | The Solana RPC call is plain HTTPS so the network half works. But it has to load the wallet store from `~/.kbot/wallet.json`, which means `fs` access — blocked. And `wallet_send` needs the encrypted private key — needs `crypto`. | Filesystem-scoped read for `~/.kbot/*` config files and a vetted crypto subset. Probably never worth allowing in forge — leave it CUT or in core. |

Spot-check on admin.ts (`admin_users`, `admin_stats`, `admin_billing`): all hit `https://eoxxpyixdieprsxlpwcs.supabase.co/...` with a service-key Authorization header pulled from env. **NO** as-is — needs the secrets-bridge.

---

## 4. Macro categorization of the 180 FORGE bucket

Estimating from the categories CURATION_PLAN groups them into:

| Bucket | Count | % of 180 | Trivially forgeable today? | Notes |
|---|---|---|---|---|
| Science labs (~100) | 100 | 56% | **~70 yes / 30 no** | Most are pure `url_fetch` + JSON/XML parse against NCBI, RCSB, PubChem, NASA, USGS, NOAA, arXiv, PubMed — same shape as `pubmed_search` and `arxiv_search`. Maybe 30 need either an API key (NCBI rate-limit key, NASA API key) or a shell binary (`pip_run` for stats). |
| Research wrappers (~13) | 13 | 7% | **~12 yes / 1 needs key** | All are HTTP fetch over public endpoints. HF datasets sometimes needs a token. |
| Hacker toolkit (~15) | 15 | 8% | **~3 yes / 12 no** | Plan literally says "wrap nmap/dig/openssl/hashcat" — all blocked. Only the pure-HTTP ones (e.g. `cve_lookup`, `tech_fingerprint`) work today. |
| Threat / CTF (~10) | 10 | 6% | **~7 yes / 3 no** | Wrappers over CIRCL / MITRE / NVD JSON APIs are fine. CTFd usually needs auth. |
| Finance / markets (~12) | 12 | 7% | **~5 yes / 7 no** | yfinance and CoinGecko have anonymous endpoints; Alpha Vantage requires an API key. |
| Wallet / web3 (~11) | 11 | 6% | **0 yes / 11 no** | Reads encrypted key file, signs transactions, uses crypto. Fundamentally incompatible with the sandbox. Plan was right to flag these as security-sensitive. |
| Gamedev (~14) | 14 | 8% | **~2 yes / 12 no** | Most spawn `blender`, `godot`, `unity` CLIs or write project files. |
| VFX / media (~4) | 4 | 2% | **0 yes / 4 no** | All spawn shell binaries (`ffmpeg`, `imagemagick`, `latex`, `blender`). |
| Training ML (~8) | 8 | 4% | **~1 yes / 7 no** | Needs filesystem + spawn (`modal`, `sky`). |
| Composio (~4) | 4 | 2% | **0 yes / 4 no** | OAuth + persistent token. |
| Notebook research (~13) | 13 | 7% | **0 yes / 13 no** | All write `.ipynb` / markdown files — needs `fs.writeFile`. |

**Roll-up**:

- **Trivially forgeable today**: ~65 / 180 ≈ **36%** (most science wrappers, most research wrappers, most threat-intel)
- **Forgeable with a secrets-bridge**: ~30 / 180 ≈ **17%** (Alpha Vantage, NASA-with-key, HF datasets, Composio, NCBI-with-key)
- **Forgeable with a shell-binary primitive**: ~50 / 180 ≈ **28%** (hacker-toolkit, vfx, training, half of gamedev, dns)
- **Forgeable with filesystem + state**: ~25 / 180 ≈ **14%** (notebook tools, half of admin)
- **Not realistically forgeable**: ~10 / 180 ≈ **5%** (wallet/crypto signing, long-lived stream daemons)

---

## 5. Verdict on the migration plan

**Partial-go.** The CURATION_PLAN's claim that "180 tools move to forge" is correct in spirit but wrong in immediacy.

Concrete numbers:
- **~65 tools (36%)** can move today with no forge_tool changes — almost all of them science/research wrappers. **Phase 1** of the plan can ship right now with this subset, validating the "skills/forge-specs" YAML approach end-to-end before touching anything riskier.
- **~95 tools (53%)** are forgeable but need 2 new forge primitives: a **secrets-bridge** and a **shell-binary primitive**. Buildable in a week; both are bounded scope.
- **~10 tools (5%)** should never move to forge — wallet signing, daemon processes. The plan should reclassify these as **CUT** (with a documented "if you want this, install a plugin from npm") rather than FORGE.
- **The persistence bug is a hard blocker for any restart-surviving forge.** Even the 36% trivially-forgeable subset gets re-forged every session unless the loader is patched. This is a one-line fix (recurse into `forged/` subdir) but it's mandatory.

**Reclassification candidates** (from FORGE → other buckets):
- `wallet_*` (11 tools): reclassify as **CUT** with a guidance note pointing to a future `@kernel.chat/kbot-wallet` npm plugin. Forge sandbox will never sign Solana txns safely.
- `stream_announce`, `stream_followers`, `stream_marker`, `stream_clip` etc (the OAuth-Twitch ones, ~10 tools): reclassify as **CUT** — the streaming subsystem is moving to its own daemon per the plan, so forge specs duplicate that.
- `notebook_*` (13 tools): reclassify as **CUT** — markdown + git already does this. Plan even admits this in the rationale.
- That trims FORGE from 180 → ~145 and makes the remaining set genuinely forge-shaped.

---

## 6. Infrastructure proposal

Three additions to `forge.ts`, in priority order:

### Priority 1 — Auto-load on startup (1-line bug fix)
Patch `plugins.ts:loadPlugins` to also walk `~/.kbot/plugins/forged/` (or call a dedicated `loadForgedTools()` from `cli.ts` boot path). Without this, forge is functionally a session-scoped feature, not a persistence-scoped one. **Unlocks all 180 candidates** for survival, regardless of which other gaps remain.

### Priority 2 — Secrets bridge (small, scoped)
Expose a `getSecret(provider: string)` global in the sandbox that:
- looks up a value in `~/.kbot/config.json` (the existing AES-256-CBC store)
- only allows whitelisted provider keys (anthropic, openai, github, twitch, etc.)
- never returns the raw decrypted blob — returns the value for the requested key only
- logs every access for audit

This unlocks ~30 of the 180 (the auth-wrapped HTTP fetchers). Implementation is ~50 LOC; security boundary is clean because the surface is one function with a known argument set.

### Priority 3 — Shell-binary primitive (medium scope)
Expose a `runBinary(name: string, args: string[])` global that:
- only allows binaries from a curated whitelist (`nmap, dig, openssl, ffmpeg, imagemagick, latex, blender, hashcat`)
- runs through the existing `kbot_bash` middleware (so SSRF/destructive guards apply)
- returns `{ stdout, stderr, exitCode }`
- has its own per-call timeout

This unlocks ~50 more (hacker-toolkit, vfx, half of gamedev, dns_enum). Implementation rides on top of existing `bash.ts` and the `kbot-bash` permission system. Combined with Priority 2, forge_tool can absorb ~80% of the 180 (~145 tools post-reclassification).

**Out of scope for now**: filesystem write, crypto.subtle, long-lived process handles, inter-tool calls. These would unlock the remaining 5–10% and are not worth their security cost on the current timeline.

---

## TL;DR for the gate

- forge_tool can absorb **~36% of the 180 today** (no changes), **~80% with the 3 fixes above** (1 day for #1, 1 week for #2+#3).
- Top 3 forge_tool capabilities needed (in order): **(1) auto-load forged tools on startup**, **(2) secrets bridge for API keys**, **(3) whitelisted shell-binary primitive**.
- Reclassify out of FORGE: **wallet_* (11) → CUT**, **stream_* OAuth tools (~10) → CUT**, **notebook_* (13) → CUT**. Net new FORGE bucket = ~145, of which ~115 are reachable post-fixes.
- The migration plan is **feasible but not shippable as written** — the persistence bug means even the easy wins don't survive a kbot restart today.
