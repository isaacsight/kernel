---
title: "The Librarian's Index: Semantic Search in Practice"
date: 2025-12-19
category: Swarm_Architecture
tags: [RAG, Search, Knowledge Management]
---

# The Needle in the Vector Element

We have thousands of files, research notes, and chat logs.
Finding relevant context is the hardest problem in AI.
Keyword search fails because it misses synonyms.
Naive Vector Search fails because it misses structure.

## The Librarian Agent
We created a dedicated role: **The Librarian**.
It uses a hybrid approach:
1.  **Dense Retrieval**: Embeddings for "vibe" matches.
2.  **Sparse Retrieval**: BM25 for keyword precision.
3.  **Graph Traversal**: Looking at file imports and dependencies.

## Dynamic Context Injection
The Librarian's job is to prepare the "briefcase" for the other agents.
When the **Writer** says, "I'm writing about CSS," the Librarian doesn't just return `style.css`.
It returns:
*   `style.css`
*   The `design_system.md` doc.
*   The last 3 conversations about color palettes.

## The Forgetting Curve
Equally important is knowing what *not* to retrieve.
Stale data poisons the model. The Librarian actively archives old "memories" to cold storage, keeping the working context fresh.
Ignorance is strength (when it prevents token overflow).
