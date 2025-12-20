---
title: "Testing in the Age of Probabilistic Code"
date: 2025-12-19
category: Future_of_Code
tags: [QA, Testing, AI]
---

# Flaky by Design

Traditional code is deterministic. Run it twice, get the same result.
AI code is probabilistic. Run it twice, get different results.
How do you Unit Test a vague vibe?

## Eval Driven Development (EDD)
We don't write "Tests", we write "Evals."
*   **Prompt**: "Summarize this article."
*   **Eval**: "Does the summary contain the 3 key points? Is it neutral tone?"
The Eval is usually *another* AI agent.

## The Judge Model
We use a bigger, smarter model (GPT-4) to judge the output of smaller, faster models (Llama-3).
It is "AI watching AI."
We build a Supreme Court of validation.

## Acceptance Criteria
The definition of "Done" changes from "Passes Tests" to "Passes Threshold."
"If 95/100 evals pass, ship it."
We are moving from Boolean Engineering (True/False) to Statistical Engineering (Confidence Intervals).
