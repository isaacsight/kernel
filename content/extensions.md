---
title: "Extension Ecosystem"
date: 2025-12-17
description: "Ubiquitous decision layer reachable from wherever you work, think, or build."
slug: extensions
layout: wide
---

# Studio OS Copilot: The Universal Interface

The **Studio OS Copilot** is a universal decision-capture and agent-governance layer that plugs into every surface you work in (browser, phone, IDE, hardware). Instead of AI being a tool you open, it becomes an **opinionated OS layer** that asks **“Does this feel right?”** at the moments that matter.

It is a living operating system designed for **simplicity and speed**. It ingests your actions, classifies them against your patterns, and produces a verifiable decision ledger to ensure every AI agent you use runs inside a governance mesh that amplifies your judgment.

---

## 1. **Browser: Studio Lens**
- **Chrome/Firefox extension**: Adds a “Log to Studio” button on every page. Click → classify as decision, pattern, failure, or “felt wrong” with 1–2 taps.
- **Sidebar panel**: Shows today’s key decisions, misalignments, and rituals; answer “Does this still feel right?” without leaving your tab.
- **Context-aware hints**: If you’re in GitHub, Linear, or Notion, it suggests relevant patterns or guardrails (“This looks like a rushed release—log or adjust?”).

---

## 2. **Mobile: Studio Companion**
- **Mobile extension**: Our signature mobile extension (located in `tools/mobile_extension/`) brings the decision layer to your phone.
- **iOS Share Target**: “Send to Studio” turns any link, screenshot, or note into a structured entry, auto-tagged by app and context.
- **Decision Capture**: Long-press or dictate a 10-second voice note; it lands as a signed, verifiable decision in your OS.

---

## 3. **Hardware: Frontier Console**
- **E-ink desk display**: Shows live agent status, metrics, and decisions; physical knobs/buttons let you accept/decline agent suggestions.
- **Edge device**: Runs agent inference locally, logs decisions offline, syncs when connected—perfect for regulated environments.
- **Wearable tap**: One tap = “this felt wrong” flag that feeds directly into your decision log and pattern analysis.

---

## 4. **API & Programmatic**
- **Ingest API**: Any tool (GitHub, n8n, Slack) can POST decisions, events, or failures; your OS classifies and routes them.
- **Snapshot API**: Powers the mobile widget, browser sidebar, and hardware display—so every surface shows the same “what matters now” view.
- **Webhook triggers**: When a pattern misfires or a guardrail is violated, the OS can ping Slack, email, or trigger a workflow in the client’s stack.

---

## 5. **Desktop & CLI**
- **Menu bar app**: (Mac/Windows) Shows a live “Studio health” dot: green if aligned, yellow if misalignments are building, red if overrides are spiking.
- **Terminal CLI**: `studio log "rushed release"` or `studio snapshot` to capture or query the OS from anywhere in your dev workflow.

---

## 6. **On-Chain & Verifiable**
- **Decision token**: Every major decision is hashed and stored on a cheap L2 (e.g., NEAR, Base). Over time, you have a verifiable log of judgment that partners and clients can audit.
- **Pattern NFT**: When a pattern is proven (used 100× with <5% failure), mint it as an open artifact others can fork and attribute.

---

> [!NOTE]
> All extensions feed the **same Studio OS backend**, so your decision log, pattern library, and metrics stay in sync everywhere.
