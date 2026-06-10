# Agentic AI & the agentic industry (2026)

Synthesized topic page. Pulls together the three raw captures of
2026-06-10 into linked, deduplicated knowledge. Detail and citations
live in the linked raw files.

## The shape of the industry
The agentic-AI market crossed **$9B in 2026** and is on a steep curve
(~46% CAGR, **$7.84B → $52.62B** by 2030). Gartner expects **40% of
enterprise apps** to embed task-specific agents by year-end. The
headline tension is the **pilot-to-production gap**: ~79% of orgs say
they've adopted agents, but only ~11% run them in production.
→ [market & adoption](../raw/agentic-ai-market-adoption-2026.md)

## What's working
ROI is real where agents ship: **66%** report measurable productivity
gains. The standout is **Salesforce Agentforce** — $540M ARR, 18,500
customers, **84%** of support cases resolved autonomously. Healthcare
(68% usage) leads sector adoption.
→ [market & adoption](../raw/agentic-ai-market-adoption-2026.md)

## The technical substrate
The stack settled around: tool integration (native **MCP**),
orchestration, memory/state, and observability/governance.

**MCP** is the load-bearing standard — open, under **Linux Foundation**
stewardship since 2025, backed by Anthropic, OpenAI, Google, Microsoft,
AWS and others. Its value is portability: MCP integrations move between
frameworks without a rewrite.

Orchestration crystallized into four patterns — **graph-based**
(LangGraph, Microsoft Agent Framework), **role-based** (CrewAI, Agno),
**handoff-based** (OpenAI Agents SDK), **hierarchical** (Google ADK).
Scaffold choice is not cosmetic: it can swing results by **~30 points**
on identical models (Princeton HAL: Claude Opus 4 at 64.9% vs 57.6% on
GAIA depending on scaffold).
→ [technical stack](../raw/agentic-ai-technical-stack-2026.md)

## What's holding it back
The brake is **trust, not capability**. Trust in fully autonomous AI
fell **43% → 27%** during 2025; ~two-thirds cite security/risk as the
top scaling barrier. Failure modes compound: agents still fabricate and
err, multi-agent coordination complexity grows near-exponentially, half
of running agents operate in isolation, and errors compound silently
("agent sprawl"). **<10%** of orgs have robust governance — the gap
between deployment velocity and governance maturity is where risk lives.
New disciplines forming: agentic **governance**, **security**, and
**FinOps**.
→ [risks & governance](../raw/agentic-ai-risks-governance-2026.md)

## Connective thread
The same fact line runs through all three captures: **adoption is
racing ahead of the ability to deploy safely.** MCP standardization
(stack) lowers the build cost, ROI evidence (market) pulls demand
forward, and governance immaturity (risk) is the throttle. The
pilot-to-production gap is the industry's central 2026 problem.
