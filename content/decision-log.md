---
title: "Decision Log"
date: 2025-12-15
description: "A record of the architectural and strategic decisions made by the Studio OS."
slug: decision-log
type: log
---

# Studio Decision Log

**The Studio OS learns by making decisions, recording the context, and measuring the outcome.**
This log tracks the evolution of the system.
[View Studio Changelog →](changelog.html)

<div class="decision-feed">

## 2025-12-15: Adopted Agentic OS Pattern
- **Context:** The studio was operating as a collection of disparate tools (n8n, Python scripts, manual writing) without a cohesive "brain."
- **Decision:** Formally adopt the **Agentic OS** architectural pattern, defining clear roles (Architect, Operator) and a centralized specialized pattern library.
- **Alternatives:** Continued ad-hoc automation (rejected: too brittle, no compounding intelligence).
- **Hypothesis:** Treating the studio as a software system will increase shipping velocity by 2x within 60 days.
- **Status:** <span class="status-pill status-green">Active</span>

## 2025-12-14: Retired n8n for Simple Automation
- **Context:** We were using n8n for simple cron jobs (e.g., TikTok posting), which introduced unnecessary complexity and "black box" failure modes.
- **Decision:** Migrated core loops to pure Python modules (`admin.engineers`) running on a simple server.
- **Outcome:** Improved observability (logs in terminal) and easier debugging.
- **Status:** <span class="status-pill status-green">Validated</span>

## 2025-11-01: Shifted from "Commission" to "Advisory"
- **Context:** Commission work (done-for-you) was unscalable and misaligned with the studio's goal of building high-leverage assets.
- **Decision:** Pivoted the business model to "Advisory" (done-with-you) and "Pattern Licensing."
- **Metric:** Revenue per hour of effort.
- **Status:** <span class="status-pill status-yellow">Monitoring</span>

</div>
