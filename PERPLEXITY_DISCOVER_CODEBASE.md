# Perplexity Discover Codebase – What Is Known

There is no public, official description of the exact codebase or tech stack used specifically for **Perplexity Discover**, so only high‑level architecture patterns can be described, not concrete repositories or frameworks.

## Publicly Known vs Unknown

- **Unknown (proprietary):**  
  - Exact internal repositories and service names.  
  - Specific front‑end framework (e.g., Next.js, Remix) and backend language choices for Discover as a distinct surface.

- **Known at a high level:**  
  - Perplexity uses a hybrid retrieval plus multi‑stage RAG architecture with multi‑model orchestration, citation modules, and feedback loops; Discover appears to sit on top of the same core stack.  
  - The engine coordinates multiple web searches in parallel, fuses retrieved context, and enforces citation‑backed answers, which matches how Discover pages present longform, source‑linked content.

## Likely Architectural Patterns Used by Discover

> Note: These are reasonable inferences based on public architecture overviews of Perplexity as a whole, not confirmed implementation details for Discover itself.

### Backend and Orchestration

- Internal services for: query parsing, retrieval, ranking, LLM orchestration, and citation formatting, exposed via internal APIs that Discover can call to pre‑generate or cache page content.  
- Hybrid retrieval engine (dense + sparse search with distributed indexes) that surfaces the sources cited on Discover pages.

### LLM / Agent Layer

- Multi‑stage RAG pipeline that:  
  - Drafts longform narrative answers.  
  - Selects and formats citations.  
  - Generates related questions or topics shown alongside the main answer.  
- Multi‑model routing across several frontier LLMs, consistent with Perplexity's broader stack strategy.

### Product and Monetization Layer

- Discover pages function as a curated, SEO‑indexable "answer surface" on top of the core engine.  
- Some Discover URLs experiment with affiliate or commercial links integrated into the answer content.

## Limits of What Can Be Known

- There is no public repo, whitepaper, or official doc that states "Discover is built with technology X at repository Y," so the exact codebase cannot be cloned or reproduced from open information.  
- Any precise framework‑level claim (for example, "Next.js + Go microservices") would be speculative and should not be treated as fact without direct confirmation.

## Implication for Building a Similar Surface

For someone building a Discover‑like product, the key replicable ideas are:

- A robust RAG pipeline with citation enforcement and multi‑model routing.  
- A layer that turns RAG outputs into durable, SEO‑friendly pages with light editorial control and commercial link insertion.

---

*Source: [Perplexity Discover](https://www.perplexity.ai/discover)*
