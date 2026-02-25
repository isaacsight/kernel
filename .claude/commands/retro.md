Run a team retrospective. Agents review accumulated knowledge, prune stale entries, and identify tool gaps.

## Protocol

### 1. Load All Memories

Read all agent memory files:
- Call `agent_memory_read` for each: `qa`, `designer`, `performance`, `security`, `devops`, `product`
- Also read `shared-knowledge` and `tool-effectiveness`

### 2. Analyze Patterns

For each agent's memory, identify:
- **Recurring issues** — Problems that keep appearing (indicate systemic issues)
- **Stale entries** — Findings that are no longer relevant (fixed issues, outdated metrics)
- **Wins** — Successful patterns worth reinforcing
- **Gaps** — Things agents needed but couldn't do

### 3. Prune Stale Entries

For each stale entry found:
- Note what was stale and why
- Suggest removal (but do NOT auto-delete — list for human review)

### 4. Identify Tool Gaps

Review `tool-effectiveness.md` for:
- Tools with high failure rates
- Agents that frequently work around missing capabilities
- Propose new tools via `create_tool` if clear gaps emerge

### 5. Update Shared Knowledge

Call `agent_memory_write` for `shared-knowledge` with:
- Key cross-cutting patterns discovered
- Updated architecture decisions
- Resolved coordination notes

### 6. Generate Retro Report

```
# Team Retrospective — [date]

## What's Working
[patterns and tools that consistently deliver value]

## Recurring Issues
[problems that keep appearing — need systemic fixes]

## Stale Entries (suggest pruning)
[entries that are no longer relevant, grouped by agent]

## Tool Effectiveness
| Tool | Uses | Success Rate | Notes |
|------|------|-------------|-------|

## Tool Gaps
[capabilities agents need but don't have]

## Proposed Tools
[new tools created via create_tool, if any]

## Action Items
1. [highest priority systemic fix]
2. [next priority]
...
```

### 7. Notify

Call `kernel_notify` on discord with retro summary.
