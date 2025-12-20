---
title: "Brand Voice Consistency in Large Models"
date: 2025-12-19
category: Digital_Consultancy
tags: [Branding, LLM, Marketing]
---

# Taming the Generic

The default voice of ChatGPT is "Helpful Corporate HR."
This is the death of a brand.
To use AI for real work, you must break this default.

## The Style Guide as Code
We don't just say "Be funny."
We feed the model a `BRAND.md` file containing:
*   **Vocabulary**: words we use ("Swarm", "Tether") and words we ban ("Delve", "Synergy").
*   **Sentence Structure**: "Short sentences. Punchy."
*   **Few-Shot Examples**: 10 examples of our best writing.

## The Tone Police
The **Editor** agent audits every draft against `BRAND.md`.
If a sentence sounds too generic, it flags it.
"This sounds like GPT-4. Make it sound like Isaac."

## Fine-Tuning vs Context
We found that rigorous Context Injection (System Prompts) is often better than Fine-Tuning for voice.
It allows us to pivot the brand voice instanty by updating one markdown file.
The brand is software.
