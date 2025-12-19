---
title: AI Janitor System
date: 2025-12-18
status: proposed
---


---

## Request for Comments: RFC-0042

**Title:** The AI Janitor System (AJS): An Autonomous QA Agent for Proactive Codebase Maintenance

**Author(s):** The Maintenance Working Group (MWG)
**Date:** October 26, 2023
**Status:** Proposed Draft
**Target Audience:** Infrastructure Engineers, Development Leads, and QA Professionals

---

## 1. Abstract

This Request for Comments (RFC) proposes the architecture and implementation strategy for the **AI Janitor System (AJS)**. The AJS is defined as a specialized, autonomous Quality Assurance agent designed to proactively identify and resolve low-stakes, repeatable codebase hygiene issues, including but not limited to linting violations, broken external links, outdated documentation references, and stylistic inconsistencies.

The primary objective of the AJS is to significantly reduce developer context switching costs associated with minor technical debt, minimize noise during human code reviews, and ensure a higher, standardized level of codebase health without requiring synchronous human intervention. The AJS operates by observing repository changes, diagnosing fixable issues, and submitting verified Pull Requests (PRs) that are designed for streamlined, often autonomous, merging.

---

## 2. Motivation

Modern software development pipelines utilize Continuous Integration (CI) extensively to catch critical errors. However, many pipelines stop short of automatically fixing issues, defaulting the correction burden back onto the developer. While trivial in isolation, the cumulative cost of managing minor technical debt manifests in several costly ways:

### 2.1. Cognitive Load and Context Switching

Developers frequently interrupt complex feature work to address minor CI failures (e.g., fixing a whitespace error, updating an outdated link). This necessary context switch severely impacts deep work productivity. By automating the fix, the AJS ensures that CI failures represent *true* logical or architectural issues requiring human analysis, rather than mechanical compliance issues.

### 2.2. Reviewer Fatigue and PR Noise

Code review time is a critical bottleneck. Reviewers often spend disproportionate time commenting on style (e.g., “Please use camelCase here,” “This link is 404”), distracting from the core logic changes. The AJS ensures that PRs are stylistically sound *before* the primary human review cycle begins, focusing human effort on security, architectural integrity, and business logic.

### 2.3. Standardization Drift

Even with rigorous linting tools, style drift occurs over time, particularly in older modules or during cross-team contributions. The AJS acts as a persistent, standardized enforcer, applying the agreed-upon style guide across the entire repository uniformly and continuously, reducing the need for costly, disruptive "style janitorial" sprints.

---

## 3. Proposed Design

The AI Janitor System is structured around a multi-agent, asynchronous architecture, operating in a three-phase cycle: **Observe, Diagnose & Resolve, and Submit & Validate.**

### 3.1. Architecture Overview

The AJS resides as an autonomous service, subscribing to repository events (e.g., `push`, `merge`, timed nightly scans). It utilizes a core dispatcher to route identified issues to specialized sub-agents.

| Agent Name | Primary Function | Tools/Techniques Utilized |
| :--- | :--- | :--- |
| **Linting Agent** | Resolves code format and syntax violations (e.g., missing semicolons, improper indentation). | Language-specific AST parsing (e.g., ESLint/Prettier API calls), deterministic rules. |
| **Link Agent** | Scans documentation, markdown, and code comments for broken external/internal URLs. | HTTP status code checks, recursive internal link verification. |
| **Style Agent** | Resolves high-level, context-aware stylistic issues (e.g., overly verbose comments, refactoring minor variable names for clarity, documentation generation). | Fine-tuned Large Language Model (LLM) utilizing repository history for style inference. |

### 3.2. Phase 1: Observation and Isolation

1.  **Event Trigger:** AJS is triggered by a configured event (e.g., post-merge hook).
2.  **Scope Determination:** The system identifies the specific files or sections that require analysis.
3.  **Specialized Scanning:** Each agent runs its respective checks concurrently.
    *   *Safety Constraint:* The AJS must only operate on non-critical files and must have an explicit allow-list or deny-list for sensitive business logic modules.

### 3.3. Phase 2: Diagnosis and Resolution

1.  **Issue Triage:** Identified issues are categorized by severity and fixability. Only issues that can be fixed deterministically or with high confidence (e.g., >99% confidence score from the LLM) are prioritized.
2.  **Idempotent Correction:** The fix applied by the AJS must be idempotent. Rerunning the AJS on the corrected code should produce no new fixes.
3.  **LLM Application (Style Agent):** The Style Agent utilizes a specialized LLM, constrained by system prompts that include the project’s specific style guide and tenured examples from the codebase. The LLM’s output is treated as a proposed patch file, not a direct write operation.
4.  **Verification Sandbox:** Before writing any changes, the proposed fix is applied to a temporary branch, and a minimal internal CI check (e.g., compiling, running unit tests directly related to the changed files) is executed to ensure the fix did not introduce a regression.

### 3.4. Phase 3: Submission and Validation

1.  **PR Submission:** The AJS submits a PR, clearly labeled (e.g., `[AJS-FIX] Hygiene: Auto-Resolved 12 Broken Links in Documentation`). The commit history must explicitly identify the AJS as the author.
2.  **Auto-Merge Strategy:** To minimize human overhead, AJS PRs should target auto-merge eligibility based on two criteria:
    *   **Trivial Fixes (Type 1):** Deterministic fixes (Linting Agent, Link Agent) that pass mandatory CI checks and affect non-logic files (e.g., READMEs, YAML configs) are automatically merged after a configurable short delay (e.g., 1 hour).
    *   **Contextual Fixes (Type 2):** LLM-generated fixes (Style Agent) require a single, lightweight human approval from a non-maintainer or an elected Style Reviewer to confirm contextual correctness.
3.  **Rollback Mechanism:** Should an AJS-introduced PR fail subsequent canary deployments or be flagged by human reviewers as incorrect, an immediate, automated rollback branch must be generated, reverting the specific AJS commit.

---

## 4. Drawbacks and Alternatives

### 4.1. Drawbacks of AJS

*   **Trust and Hallucination Risk:** While deterministic agents are reliable, the LLM-powered Style Agent poses a risk of "hallucinating" semantically incorrect fixes or introducing subtle bugs, especially in complex code structures.
*   **Commit History Noise:** The continuous submission of minor PRs could clutter the repository’s commit history and notification channels, potentially masking critical human-submitted work. Mitigation requires highly specific filtering for AJS PRs.
*   **Cost Management:** Running a high volume of LLM queries, while often necessary for true contextual style fixing, introduces non-trivial API costs and must be meticulously budgeted and monitored.

### 4.2. Alternatives Considered

#### 4.2.1. Alternative 1: Strict Pre-Commit Hooks

*   **Description:** Enforce all style and linting rules locally before code can be committed.
*   **Drawback:** This shifts the burden entirely back to the developer, increasing development friction and merge contention, especially on large, inherited codebases. It solves linting but cannot handle post-deployment issues like broken links or stale documentation updates.

#### 4.2.2. Alternative 2: Dedicated Human Janitorial Team

*   **Description:** Assign a rotating group of QA engineers to manually fix style and link issues in dedicated maintenance sprints.
*   **Drawback:** Expensive, non-scalable, and suffers from human inconsistency. The feedback loop is slow (weeks or months), allowing technical debt to accrue significantly before resolution.

**Conclusion:** The AJS represents a critical balance, offering the scalability and speed of full automation without imposing undue friction on the core development workflow, unlike Alternatives 1 and 2.

---

## 5. Unresolved Questions and Community Feedback

This RFC is being circulated to solicit specific feedback on the practical deployment and governance of the AJS. We require community input on the following key decisions:

### 5.1. Auto-Merge Thresholds

What criteria should define a PR as "Trivial" (Type 1) and thus eligible for auto-merging? Should auto-merging be disabled entirely for projects categorized as high-security or mission-critical, regardless of the fix type?

### 5.2. LLM Scope and Training

How extensive should the LLM’s context window be? Should the Style Agent be fine-tuned specifically on only the repository’s accepted PR history, or should it leverage broader, general LLM knowledge to propose novel style improvements (riskier, but potentially more innovative)?

### 5.3. Governance and Kill Switch

What organizational structure must approve the AJS’s initial deployment and subsequent updates? What specific failure mode (e.g., three reported human rollbacks in 24 hours) should trigger an immediate, automated "kill switch" that temporarily deactivates the AJS service until human maintenance can intervene?

### 5.4. Resource Allocation Model

What is the projected acceptable cost envelope for running the AJS (in terms of compute resources or third-party API usage)? Should cost tracking be visible directly in AJS PRs to justify the automation value?

---
*End of RFC-0042 Draft.*