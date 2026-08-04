---
source: deep research (multiple, see Sources below)
captured: 2026-06-10
title: Agentic AI — technical stack, MCP, and orchestration frameworks (2026)
---

# Agentic AI — technical stack, 2026

Raw research capture. Faithful to sources; not yet summarized into the wiki.

## Stack layers
- Tool integration (increasingly native **MCP** support), observability & governance (distributed tracing, evaluation harnesses), orchestration, memory/state.

## Model Context Protocol (MCP)
- Open standard for how agents connect to tools and data sources.
- Moved from proprietary spec to **Linux Foundation** stewardship in 2025.
- Backers: **Anthropic, OpenAI, Google, Microsoft, AWS, Cloudflare, Block, Bloomberg**.
- Key property: MCP-built integrations **port between frameworks** without rewriting — the one layer that transfers across provider SDKs, framework-based, and build-it-yourself approaches. Swap LangGraph for Microsoft Agent Framework without rebuilding the integration layer.

## Orchestration styles (four patterns stabilized)
- **Graph-based** — LangGraph, Microsoft Agent Framework.
- **Role-based** — CrewAI, Agno.
- **Handoff-based** — OpenAI Agents SDK.
- **Hierarchical** — Google ADK.

## Frameworks
- **LangGraph** — graph-based leader; **v1.0 Oct 2025**; state machine on top of LangChain; explicit state + human-in-the-loop checkpoints. Production at Uber, JPMorgan, LinkedIn, Klarna.
- **CrewAI** — higher abstraction; agent "crews" with roles/goals/backstories; simpler to start, less flexible for complex state.
- **OpenAI Agents SDK** — structured workflows; native tool calling, file search, code interpretation; explicit orchestration primitives; MCP-compatible.

## Why scaffold matters
- Framework choice can shift performance by **up to ~30 absolute percentage points** on identical models/tasks.
- Princeton HAL benchmark: same Claude Opus 4 scored **64.9%** on GAIA in one scaffold vs **57.6%** in another.

## Sources
- https://uvik.net/blog/agentic-ai-frameworks/
- https://neuralcoretech.com/agentic-ai-model-context-protocol-mcp-architecture-2026/
- https://www.oreilly.com/radar/the-ai-agents-stack-2026-edition/
- https://gurusup.com/blog/best-multi-agent-frameworks-2026
- https://guptadeepak.com/tools/top-10-mcp-frameworks-2026/
- https://acropolium.com/blog/ai-agent-orchestration-frameworks/
