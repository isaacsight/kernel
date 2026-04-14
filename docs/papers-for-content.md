# Academic Papers to Go Through for Content

A curated reading list of academic papers that can seed new posts in
`src/content/posts/` and feed the Kernel research-to-content pipeline.
Each entry lists the paper, the core idea, and a concrete content angle
that fits the voice of existing posts (`way-of-code.md`,
`frontier-notes.md`, `sovereign-swarm.md`, `intelligence-synthesis.md`,
`antigravity-kernel.md`).

Papers already cited in `docs/KERNEL_RESEARCH_THESIS.md` are marked with
`[thesis]` — prioritize papers without that tag for fresh content.

---

## I. Agents as Material (the `frontier-notes` lineage)

### 1. Park et al. (2023) — Generative Agents: Interactive Simulacra of Human Behavior — UIST '23 [thesis]
- **Core**: 25 LLM agents in a sandbox with memory streams, reflection, and planning produce emergent social behavior.
- **Angle**: "When memory becomes personality." A post on why the memory substrate (not the model) is what makes agents feel coherent — ties directly into `packages/kbot/src/memory.ts` and the learning engine.

### 2. Shinn et al. (2023) — Reflexion: Language Agents with Verbal Reinforcement Learning — *arXiv:2303.11366*
- **Core**: Agents learn by writing self-critiques to memory; no gradient updates.
- **Angle**: "The cheapest form of learning is remembering what went wrong." Maps onto the K:BOT learning engine's solution-recording loop.

### 3. Yao et al. (2023) — ReAct: Synergizing Reasoning and Acting in Language Models — ICLR [thesis]
- **Core**: Interleaving thought and action outperforms either alone.
- **Angle**: "Why the plan-execute split is a false binary." Revisits the `--plan` vs `--architect` flags in K:BOT.

### 4. Sumers et al. (2024) — Cognitive Architectures for Language Agents — *arXiv:2309.02427*
- **Core**: A taxonomy that cleanly separates memory, action, and decision in LLM agents.
- **Angle**: A structural piece mapping the CoALA taxonomy onto the K:BOT codebase — a diagram-heavy post that doubles as architecture documentation.

---

## II. Swarms, Debate, and Collective Intelligence (the `sovereign-swarm` lineage)

### 5. Du et al. (2023) — Improving Factuality and Reasoning through Multiagent Debate — *arXiv:2305.14325* [thesis]
- **Core**: Agents debating across 2–3 rounds materially improve factuality.
- **Angle**: "The three-round rule." Build a benchmark against the current single-round swarm and report actual gains.

### 6. Liang et al. (2023) — Encouraging Divergent Thinking through Multi-Agent Debate — *arXiv:2305.19118* [thesis]
- **Core**: Same-agent echo chambers collapse; diverse personas sustain exploration.
- **Angle**: "Diversity is a load-bearing wall." Ties swarm persona design to Surowiecki's wisdom-of-crowds preconditions.

### 7. Chen et al. (2024) — AgentVerse: Facilitating Multi-Agent Collaboration — *arXiv:2308.10848*
- **Core**: Dynamic recruitment — agents joined and released per task stage.
- **Angle**: "Hiring and firing agents mid-task." Proposes a dynamic routing upgrade to `learned-router.ts`.

### 8. Qian et al. (2023) — ChatDev: Communicative Agents for Software Development — *arXiv:2307.07924*
- **Core**: A software company of LLM agents (CEO, CTO, designer, coder, tester).
- **Angle**: Compare ChatDev's roles against the 17 specialist agents in K:BOT and write the honest tradeoff.

### 9. Bonabeau, Dorigo, Theraulaz (1999) — *Swarm Intelligence: From Natural to Artificial Systems* — Oxford [thesis]
- **Core**: Foundational stigmergy / local-rule emergence text.
- **Angle**: "Stigmergy as a design pattern." A conceptual post on why the daemon writing to `daemon-reports/state.json` is ant-trail architecture.

---

## III. Memory, Context, and Compression (the `intelligence-synthesis` lineage)

### 10. Packer et al. (2023) — MemGPT: Towards LLMs as Operating Systems — *arXiv:2310.08560* [thesis]
- **Core**: Virtual-memory abstractions (main/external context, paging) for LLMs.
- **Angle**: A side-by-side of MemGPT's paging vs K:BOT's `context-manager.ts` auto-compaction — what the OS metaphor gets right and where it breaks.

### 11. Xiao et al. (2024) — Efficient Streaming Language Models with Attention Sinks — ICLR
- **Core**: Keeping a few "sink" tokens enables indefinite streaming without quality collapse.
- **Angle**: "The first tokens are load-bearing." Practical implications for long-running kbot sessions.

### 12. Lewis et al. (2020) — Retrieval-Augmented Generation for Knowledge-Intensive NLP — NeurIPS [thesis]
- **Core**: The original RAG paper.
- **Angle**: A historical piece pairing RAG with the local embeddings in `embeddings.ts` and `nomic-embed-text`.

### 13. Gao et al. (2024) — Retrieval-Augmented Generation for LLMs: A Survey — *arXiv:2312.10997*
- **Core**: Taxonomy of naive, advanced, and modular RAG.
- **Angle**: "We are all doing modular RAG and don't know it." Map the survey's modular diagram onto the actual K:BOT toolchain.

### 14. Zhong et al. (2024) — MemoryBank: Enhancing LLMs with Long-Term Memory — AAAI [thesis]
- **Core**: Ebbinghaus-curve-informed memory decay.
- **Angle**: A post on *forgetting* as a feature — how the learning engine should let patterns decay when they stop firing.

---

## IV. Tool Use, Code, and the Craft (`way-of-code` lineage)

### 15. Schick et al. (2023) — Toolformer: Language Models Can Teach Themselves to Use Tools — *arXiv:2302.04761*
- **Core**: Self-supervised tool-use: the model annotates its own training data.
- **Angle**: "The tool manifest writes itself." Connect to `forge_tool` in `tools/forge.ts`.

### 16. Qin et al. (2023) — ToolLLM: Facilitating LLMs to Master 16,000+ Real-World APIs — *arXiv:2307.16789*
- **Core**: A tool-retrieval approach; you can't fit 16k APIs in the prompt.
- **Angle**: "670 tools is a lot. 16,000 is a different problem." A retrieval-for-tools piece — directly actionable for `packages/kbot/src/tools/index.ts`.

### 17. Chen et al. (2021) — Evaluating Large Language Models Trained on Code (Codex / HumanEval) — *arXiv:2107.03374*
- **Core**: The benchmark that defined a decade of coding-agent work.
- **Angle**: A retrospective — "What HumanEval taught us and where it quietly misled us." Sets up why kbot uses agent-vs-agent evals.

### 18. Jimenez et al. (2024) — SWE-bench: Can Language Models Resolve Real-World GitHub Issues? — ICLR
- **Core**: Closing PRs against real repos is dramatically harder than HumanEval.
- **Angle**: "The benchmark gap between HumanEval and SWE-bench is the whole product." Direct post — kbot is explicitly in the SWE-bench regime.

### 19. Wang et al. (2023) — Voyager: An Open-Ended Embodied Agent with LLMs — *arXiv:2305.16291*
- **Core**: A Minecraft agent that writes, stores, and reuses its own skill library.
- **Angle**: "Every session should leave a skill behind." A design post on turning the learning engine's patterns into a skill library — maps to `learning.ts`.

---

## V. Privacy, Sovereignty, and Federated Learning (ties to `federated-stigmergic-learning.md`)

### 20. McMahan et al. (2017) — Communication-Efficient Learning of Deep Networks from Decentralized Data — AISTATS [thesis]
- **Core**: The FedAvg paper.
- **Angle**: A primer post written for non-researchers, contextualizing why BYOK + local Ollama is a federated story even without gradients.

### 21. Kairouz et al. (2021) — Advances and Open Problems in Federated Learning [thesis]
- **Core**: The canonical FL survey — 50+ open problems.
- **Angle**: A "reading notes" post picking 5 problems and honestly saying which ones Kernel currently addresses and which it punts on.

### 22. Dwork (2006) — Differential Privacy — ICALP [thesis]
- **Core**: The foundational formal definition.
- **Angle**: "Differential privacy for people who ship." A short piece on the epsilon/delta budget as a product constraint, not just a math constraint.

### 23. Allen (2016) — The Path to Self-Sovereign Identity [thesis]
- **Core**: The 10 principles of SSI.
- **Angle**: "Sovereign identity for agents, not just users." Extends the framework to agent-to-agent auth in the swarm.

---

## VI. Human–AI Interaction and Design (`way-of-code` aesthetics)

### 24. Amershi et al. (2019) — Guidelines for Human-AI Interaction — CHI '19 [thesis]
- **Core**: 18 validated guidelines for AI-inclusive UX.
- **Angle**: A design-system audit post: grading kernel.chat and kbot against all 18 guidelines and publishing the scorecard.

### 25. Weisz et al. (2024) — Design Principles for Generative AI Applications — CHI
- **Core**: Principles specific to generative — variability, imperfection, co-authorship.
- **Angle**: "Designing for imperfection." How the Rubin design system's EB Garamond / Courier Prime palette invites contemplative attention to imperfect outputs.

### 26. Vaithilingam et al. (2022) — Expectation vs. Experience: Evaluating the Usability of Code Generation Tools — CHI EA
- **Core**: Users often can't tell when Copilot is wrong.
- **Angle**: A cautionary piece — the UX primitives kbot uses (thinking mode, plan preview, safe mode) as mitigations for the confidence-calibration gap.

---

## VII. Alignment, Critique, and Self-Improvement

### 27. Madaan et al. (2023) — Self-Refine: Iterative Refinement with Self-Feedback — *arXiv:2303.17651*
- **Core**: Same model critiques its own output; quality improves without extra training.
- **Angle**: Direct parallel to `--architect` mode. Benchmark and report.

### 28. Chen et al. (2024) — Teaching Large Language Models to Self-Debug — ICLR
- **Core**: Explain-the-code-you-wrote-before-fixing-it outperforms straight retry.
- **Angle**: "Why saying it out loud helps the model too." Concrete UX pattern for kbot's failure-recovery loop.

### 29. Huang et al. (2023) — Large Language Models Cannot Self-Correct Reasoning Yet — *arXiv:2310.01798*
- **Core**: The sobering counter-result — without ground truth, self-critique can make things worse.
- **Angle**: Pair with #27 and #28 for a balanced post: when self-correction helps and when it's just rearranging deck chairs.

### 30. Bai et al. (2022) — Constitutional AI: Harmlessness from AI Feedback — *arXiv:2212.08073*
- **Core**: A model critiques itself against a written constitution.
- **Angle**: "A constitution for your agent swarm." How the `.claude/rules/` files (security.md, testing.md) already function as a constitutional layer.

---

## VIII. Music, Creativity, and the Ableton/Serum Posts

### 31. Huang et al. (2019) — Music Transformer: Generating Music with Long-Term Structure — ICLR
- **Core**: Relative-position attention for music.
- **Angle**: A companion piece to `science-of-synthesizers.md` and `side-brain-ableton-techniques.md` explaining why sequence modeling for music is hard in a way text isn't.

### 32. Agostinelli et al. (2023) — MusicLM: Generating Music From Text — *arXiv:2301.11325*
- **Core**: Hierarchical audio tokenization for text-to-music.
- **Angle**: "The gap between MusicLM and a DJ set." Frames why kbot's Ableton OSC + DJ Set Builder tools exist — symbolic control is still required.

### 33. Borsos et al. (2023) — AudioLM: A Language Modeling Approach to Audio Generation — IEEE/ACM TASLP [thesis]
- **Core**: Semantic + acoustic token hierarchy.
- **Angle**: Technical companion piece for the Serum 2 preset writer — why symbolic preset generation is still cheaper and more controllable than raw audio.

---

## IX. Evaluation and Benchmarks (honest measurement)

### 34. Liang et al. (2023) — Holistic Evaluation of Language Models (HELM) — TMLR
- **Core**: 16 scenarios × 7 metrics; no single number tells the story.
- **Angle**: A post proposing an internal HELM-style matrix for kbot across the 17 agents.

### 35. Zheng et al. (2023) — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena — NeurIPS
- **Core**: LLM judges agree with humans ~80% of the time on open-ended tasks.
- **Angle**: "Your test suite can be another model, with caveats." Practical guide to using cheap Ollama judges on expensive cloud outputs in CI.

### 36. Liu et al. (2024) — AgentBench: Evaluating LLMs as Agents — ICLR
- **Core**: 8 environments spanning OS, DB, web, code, games.
- **Angle**: Which AgentBench environments kbot already solves, which it doesn't, and what the gap teaches us.

---

## How to use this list

1. **Pick one paper from one track.** Don't bundle.
2. **Read with the project in mind.** Every post should connect the paper to a specific file path in this repo — a tool, an agent, a config value.
3. **Write in the voice of the existing posts.** Contemplative, first-person, concrete. See `frontier-notes.md` for tone.
4. **Cite honestly.** If the paper's claim doesn't replicate in our setting, say so. See #29 for why this matters.
5. **Update SCRATCHPAD.md** when a paper becomes a post so the pipeline knows it's been consumed.

Pipeline integration:
- `packages/kbot/src/tools/research.ts` resolves arXiv / Semantic Scholar / DOI IDs.
- `packages/kbot/src/tools/research-engine.ts` can auto-summarize via local Ollama before drafting.
- `.claude/agents/synthesis.md` (Operation #3: Extract Paper Insights) is the agent to invoke when converting a paper into a post outline.
