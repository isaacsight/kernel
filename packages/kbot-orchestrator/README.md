# @kernel.chat/kbot-orchestrator

> Reference implementation of **orchestration engineering** — the discipline
> of structuring how agents pass work to each other and to humans, with
> audit trails. MIT licensed. Part of the [kernel.chat](https://kernel.chat)
> open-source stack.

See [`ROLE.md`](./ROLE.md) for the discipline definition.

## What this is

A working pipeline runner for multi-step outcomes that mix agent work,
deterministic engine calls, and human approval gates. v0.1 ships the
**outreach pipeline** because that's the load-bearing loop kernel.chat
itself has been running by hand for months.

Roadmap: content pipeline, code-maintenance pipeline, multi-agent research
pipeline.

## Install

```bash
npm install -g @kernel.chat/kbot-orchestrator
```

## One-time setup (macOS, for the outreach pipeline)

The outreach pipeline sends via Gmail SMTP using an App Password stored in
macOS Keychain. Never put the App Password in `.env`, in a config file, or
in command-line arguments.

```bash
# Generate an App Password at https://myaccount.google.com/apppasswords
security add-generic-password -U \
  -a your-email@gmail.com \
  -s kbot-gmail-app-password \
  -w '<16-char-app-password>'
```

## Usage

```bash
# Dry-run: lists who would be sent
kbot-orchestrator outreach --briefing .claude/OUTREACH.md

# Send Tier 1 only
kbot-orchestrator outreach --briefing .claude/OUTREACH.md --tier "Tier 1" --confirm

# Send a single named recipient
kbot-orchestrator outreach --briefing .claude/OUTREACH.md --name "Chase" --confirm

# Cap a batch
kbot-orchestrator outreach --briefing .claude/OUTREACH.md --confirm --limit 3
```

After a run, results are appended to the briefing as a `## Send log
(machine-appended)` table at the bottom of the file.

## Briefing format

A briefing is a markdown document. Each recipient is a `###` block with
`**To:**`, `**Subject:**`, and a fenced body. Tier headers (`##`) are
optional and used for filtering.

```markdown
## TIER 1 — Send today

### 1 / Jane Researcher

**To:** `jane@example.edu`
**Subject:** Cold pitch about your work

\`\`\`
Hi Jane,

Specific body text here.

Isaac
\`\`\`

### 2 / Bob Practitioner
...
```

Recipients without `**To:**` (e.g. `**Channel:** LinkedIn DM`) are skipped
by the outreach pipeline. The CLI's dry-run mode shows which recipients
would be sent.

## Programmatic API

```ts
import { runOutreach } from '@kernel.chat/kbot-orchestrator'

const result = await runOutreach({
  briefingPath: '.claude/OUTREACH.md',
  sender: {
    email: 'you@gmail.com',
    name: 'Your Name',
    keychainService: 'kbot-gmail-app-password',
  },
  tier: 'Tier 1',
  confirm: true,
  limit: 5,
})

console.log(`Sent ${result.sent.filter((s) => s.result.ok).length}`)
```

## Safety defaults

- **Dry-run by default.** Sends only with explicit `--confirm`.
- **Per-send delay** (500ms default) to stay gentle with Gmail send limits.
- **Append-only logging.** Briefing markdown is never destructively
  rewritten; the audit trail goes into a `## Send log` table at the
  bottom.
- **No credentials on command line or in config files.** Keychain-only.
- **Errors don't halt the loop.** Partial-success is the realistic
  outcome of any outreach batch (~10-15% bounce rate on best-guess
  addresses); the loop continues, the log records every failure.

## What this package does NOT do (yet)

- **Reply tracking.** v0.2 will integrate Gmail IMAP / MCP to surface
  inbound replies. Today you check Gmail manually.
- **LinkedIn / Bluesky / X DM channels.** Email-only. Other channels
  require your hands.
- **Pipeline shapes beyond outreach.** Content production, code
  maintenance, and research pipelines are roadmap.
- **Multi-agent specialist nodes.** v0.1 is a single-sender pipeline.
  The multi-agent version with handoff protocols comes after the v0.1
  shape settles.

## Related packages in the kernel.chat stack

| Package | Discipline | License |
|---|---|---|
| [@kernel.chat/agent-os](../agent-os/) | agent-OS — system primitives | Apache-2.0 |
| [@kernel.chat/kbot-finance](../kbot-finance/) | provenance engineering — substrate | Apache-2.0 |
| **@kernel.chat/kbot-orchestrator** (this) | **orchestration engineering — pipelines** | **MIT** |
| [@kernel.chat/kbot](../kbot/) | the agent itself | MIT |

## Discipline context

Orchestration engineering is one of six disciplines mapped in the
[agentic engineering field reference](../../docs/agentic-engineering.md).
kernel.chat now holds three of those six: provenance engineering, agent-OS,
and orchestration engineering. The other three (skill curation, evaluation,
operations) are open to whoever names them first.

## License

MIT. See [LICENSE](./LICENSE).

The accompanying ROLE.md is CC BY 4.0. Fork it, improve it, adopt it in
your own JDs and onboarding docs.
