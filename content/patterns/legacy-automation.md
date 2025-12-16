---
title: "Legacy Automation"
date: 2024-01-15
description: "Why we stopped using fragile n8n webhooks for core logic."
type: pattern
canonical: true
intelligence:
  adoption_date: "2024-01-15"
  status: "retired"
  metric_target: "Velocity"
  metric_impact: "Negative (Maintenance High)"
  decision_id: "DEC-002"
---

# Legacy Automation (Retired)

**This pattern has been retired in favor of the [Frontier Agents OS](frontier-agents-os.html).**

## The Problem
We initially used visual no-code tools (n8n, Zapier) to orchestrate our agents.
While easy to start, they became "black boxes" that were hard to debug and even harder to version control.

## The Failure Mode
- **Hidden Logic:** Business logic was trapped in JSON blobs inside the tool.
- **No Diff:** You couldn't run `git diff` on a workflow change.
- **Fragility:** Webhooks would fail silently.

## The Replacement
We shifted to the **Frontier Agents OS** pattern: pure Python code, running in a structured environment, with full logging and observability.
