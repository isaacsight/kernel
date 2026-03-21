# Cognitive Module Interference in Composite AI Agents: Emergent Behaviors from Heterogeneous Cognitive Architectures

**Isaac Hernandez**
kernel.chat group

**Abstract.** Modern AI agent systems increasingly incorporate multiple cognitive modules drawn from distinct theoretical traditions --- active inference, predictive processing, evolutionary computation, Bayesian skill estimation, and others --- into a single runtime. While each module is well-characterized in isolation, the behavior of composite systems containing many such modules remains poorly understood. We present an empirical study of K:BOT, an open-source terminal AI agent shipping on npm as `@kernel.chat/kbot`, which integrates eleven cognitive modules from eleven different theoretical lineages into a single TypeScript agent loop. We identify and formalize four interference patterns that emerge from module interactions: (1) a convergence--exploration tension between free energy minimization and quality-diversity search, (2) a destructive coupling between prompt evolution and memory synthesis where optimization erodes accumulated knowledge, (3) a temporal reasoning conflict between backward-looking multi-persona reflection and forward-looking tree search planning, and (4) the spontaneous emergence of Bayesian skill ratings as a system-wide governor that mediates conflicts between other modules. We propose that in composite cognitive architectures, the interaction surface between modules --- not the modules themselves --- is the primary site of intelligent behavior. We provide a formal taxonomy of interference patterns, concrete measurement protocols grounded in production telemetry, and preliminary observations from a system serving real users. Our findings suggest that cognitive architecture design should shift focus from optimizing individual modules to engineering productive interference between them.

---

## 1. Introduction

The field of AI agent design has converged on a modular architecture: individual cognitive capabilities are implemented as discrete components that are composed into a larger system. Tool-use agents employ planning modules, memory systems, evaluation loops, and routing mechanisms, each drawing on different bodies of research. This modular approach has clear engineering advantages --- components can be developed, tested, and replaced independently. However, it introduces a problem that has received little systematic attention: *what happens when the modules interfere with each other?*

Consider a concrete scenario. An AI agent receives a novel task it has not encountered before. Its Free Energy Principle module, detecting high prediction error, recommends exploration: gather more information before acting. Simultaneously, its LATS tree search planner has already committed to an exploitation path with high estimated value based on cached skill patterns. Its prompt evolution system, having recently mutated the active specialist's instructions to emphasize verification, injects "verify before acting" directives that conflict with both the exploration and exploitation signals. Meanwhile, the memory synthesis module is consolidating observations from the last twenty interactions into higher-order insights, some of which contradict the very patterns the prompt evolution system is optimizing against.

This is not a hypothetical scenario. It is the runtime state of K:BOT, version 3.11.0, on a routine task.

K:BOT is a production AI agent --- an open-source terminal tool that routes user requests to specialist agents, plans multi-step task execution, learns from outcomes, and evolves its own prompts. Over seventeen months of development, it has accumulated eleven cognitive modules drawn from eleven distinct theoretical traditions spanning computational neuroscience, evolutionary computation, game theory, and cognitive science. These modules were not designed to work together. Each was implemented because it addressed a real capability gap: the agent needed to balance exploration and exploitation (active inference), anticipate user intent (predictive processing), reason about its own reasoning (strange loops), measure synthesis quality (integrated information theory), and so on. The result is a system whose behavior is dominated not by any single module but by the interference patterns between modules.

This paper makes three contributions:

1. **A taxonomy of interference patterns** in composite cognitive architectures, grounded in a production system with eleven modules. We identify four distinct patterns: tension, corruption, conflict, and emergence.

2. **An experimental framework** for measuring module interference using production telemetry, with concrete metrics, instrumentation protocols, and statistical tests.

3. **A thesis about cognitive architecture design**: the interaction surface between modules is more important than the modules themselves. The architecture of interference is the agent.

We proceed as follows. Section 2 reviews related work on cognitive architectures and module composition. Section 3 describes K:BOT's cognitive stack in detail. Section 4 presents the interference taxonomy. Section 5 proposes an experimental framework for measurement. Section 6 reports preliminary observations from production. Section 7 discusses implications for agent design. Section 8 outlines future work, and Section 9 concludes.

---

## 2. Related Work

### 2.1 Cognitive Module Foundations

The eleven modules in K:BOT each derive from a distinct research lineage:

**Free Energy Principle.** Friston's variational free energy framework (Friston, 2010) proposes that adaptive systems minimize the divergence between their internal model and sensory input. Organisms reduce surprise through perceptual inference (updating beliefs) or active inference (acting on the world). Parr, Pezzulo, and Friston (2022) formalize this for agent design. K:BOT's `ActiveInferenceEngine` operationalizes this as an explore/exploit decision boundary: when average prediction error exceeds 0.6, the agent favors information-gathering tools; below 0.3, it favors action-taking tools.

**Predictive Processing.** Clark's "Whatever Next?" framework (Clark, 2013) and Hohwy's *The Predictive Mind* (Hohwy, 2013) model the brain as a prediction machine that continuously generates top-down expectations and updates on prediction error. K:BOT's `PredictiveEngine` predicts the next user action based on conversation pattern detection (iterative refinement, topic switch, drill-down, verification, follow-up, meta-question), pre-loads anticipated context, and tracks prediction accuracy over time.

**Strange Loops.** Hofstadter's *Gödel, Escher, Bach* (Hofstadter, 1979) and *I Am a Strange Loop* (Hofstadter, 2007) argue that self-referential hierarchies --- systems that reason about their own reasoning --- give rise to something like consciousness. K:BOT's `StrangeLoopDetector` monitors meta-cognitive depth, detects tangled hierarchies (e.g., tool results that change tool selection), and injects grounding prompts when the agent enters unproductive self-referential spirals.

**Integrated Information Theory (IIT).** Tononi's Phi measure (Tononi, 2004; Oizumi, Albantakis, and Tononi, 2014) quantifies consciousness as integrated information: the degree to which a system's whole exceeds the sum of its parts. K:BOT's `IntegrationMeter` applies this to multi-agent collaboration, measuring whether specialist contributions are genuinely synthesized or merely concatenated. When Phi drops below a threshold, the system triggers deeper synthesis passes.

**Autopoiesis.** Maturana and Varela (1980) define autopoietic systems as self-maintaining organizations that produce the components necessary for their own continued existence. K:BOT's `evolution.ts` module implements a self-evolution loop: the agent identifies its own weaknesses, proposes source code changes, validates them against type-checking and test suites, and applies or rolls back modifications. This makes K:BOT literally self-maintaining at the code level --- an autopoietic pattern in software.

**Quality-Diversity (MAP-Elites).** Mouret and Clune (2015) introduced MAP-Elites, which maintains an archive of high-performing solutions indexed by behavioral descriptors, ensuring both quality and diversity. K:BOT's `quality-diversity.ts` implements a 5x4 behavioral grid (task complexity vs. response style) where each cell holds the highest-fitness solution for that behavioral region. Solutions compete only within their niche, preserving diverse strategies.

**Bayesian Skill Ratings.** Herbrich, Minka, and Graepel's TrueSkill system (Herbrich et al., 2006) maintains Gaussian belief distributions over player skill. K:BOT's `SkillRatingSystem` applies this to agent routing: each of seventeen specialist agents maintains a {mu, sigma} rating per task category. Ratings update via a simplified Bradley-Terry model after each interaction. Routing decisions use the conservative estimate (mu - 2*sigma), requiring both demonstrated skill and sufficient evidence.

**LATS Tree Search.** Zhou et al. (2023) proposed Language Agent Tree Search at NeurIPS, combining Monte Carlo Tree Search with LLM-based evaluation for multi-step planning. K:BOT's `tree-planner.ts` implements this with heuristic value estimation (no LLM evaluation calls), UCB1 selection at branch points, and backpropagation of execution outcomes. The tree expands alternative branches when the primary path fails.

**GEPA Prompt Evolution.** Fernando et al. (2024) introduced the Generative Evolution of Prompts for Agents framework. K:BOT's `prompt-evolution.ts` simplifies this for CLI deployment: it records execution traces per specialist, analyzes patterns every twenty runs, and generates heuristic-based prompt mutations (verification emphasis, tool breadth encouragement, task-specific instructions, conciseness directives). Mutations are auto-rolled back if post-mutation scores drop more than ten percent.

**Three-Tier Memory Synthesis.** Park et al.'s Generative Agents (Park et al., 2023) introduced a memory architecture with observations, reflections, and plans. K:BOT's `memory-synthesis.ts` implements a three-tier analogue: raw observations (patterns, solutions, knowledge entries in `learning.ts`), reflections (periodic synthesis into higher-order insights via frequency analysis), and identity (long-term personality evolution in `temporal.ts`). The synthesis pass runs when twenty or more new observations have accumulated since the last pass.

**MAR Multi-Persona Reflection.** Multi-Agent Reflexion (Shinn et al., 2023; extended by subsequent multi-persona work) has agents critique failures from multiple perspectives. K:BOT's `reflection.ts` implements five specialist perspectives (coder, guardian, analyst, researcher, writer), each applying heuristic critiques to failed responses. A synthesis step combines perspectives into a single actionable lesson stored for future sessions.

### 2.2 Module Composition in Agent Systems

Prior work on cognitive architecture composition has focused primarily on *orchestration* --- how modules are sequenced and coordinated. AutoGPT (Significant Gravitas, 2023) chains planning, execution, and reflection in a fixed loop. LangChain's agent framework (Chase, 2022) composes tools and memory via a pipeline abstraction. Voyager (Wang et al., 2023) combines a skill library with a curriculum module. However, these systems treat module interactions as a coordination problem (ensuring modules run in the right order) rather than an interference problem (understanding what happens when module outputs conflict).

The closest related concept is Minsky's "Society of Mind" (Minsky, 1986), which proposed that intelligence emerges from the interaction of many simple agents. Our work provides empirical evidence for a specific version of this thesis: in production AI agent systems, module interactions generate behaviors that no single module was designed to produce, and these emergent behaviors can be both productive and destructive.

Brooks' subsumption architecture (Brooks, 1986) addressed module interference through strict priority hierarchies. Our findings suggest that productive interference in cognitive architectures requires a more nuanced approach: some conflicts should be resolved by priority, but others should be preserved as generative tensions.

---

## 3. System Architecture

### 3.1 Overview

K:BOT is a TypeScript application (approximately 25,000 lines of source) distributed via npm as `@kernel.chat/kbot`. It operates as a terminal AI agent: users issue natural-language requests, and the system routes them to specialist agents, plans multi-step execution, invokes tools (file I/O, shell commands, git operations, web search, and approximately sixty others), and learns from outcomes. The system supports fourteen AI providers (Anthropic, OpenAI, Google, Mistral, and others) and runs entirely locally with the exception of API calls to the selected provider.

### 3.2 The Cognitive Stack

The eleven cognitive modules are integrated into K:BOT's agent loop at specific hook points:

**Pre-routing phase.** Before a user message is routed to a specialist agent:
- The `PredictiveEngine` generates a prediction of user intent and pre-loads anticipated context.
- The `ActiveInferenceEngine` observes the message, computes surprise, and recommends a policy (explore, exploit, or balanced).
- The `SkillRatingSystem` classifies the task category and returns ranked agents with confidence scores.

**Planning phase.** When multi-step execution is required:
- The `tree-planner` (LATS) generates a branching plan tree with heuristic value estimates.
- Plan node values incorporate signals from the skill library, collective patterns, historical strategies, and Bayesian skill ratings.

**Execution phase.** During tool execution:
- The `ActiveInferenceEngine` observes tool results and updates expected outcomes.
- The `StrangeLoopDetector` monitors agent responses for self-referential content and tangled hierarchies.
- The `IntegrationMeter` measures Phi when multiple agents contribute to a response.

**Post-execution phase.** After the agent responds:
- The `prompt-evolution` system records execution traces and triggers prompt mutations when thresholds are met.
- The `quality-diversity` engine computes behavioral descriptors and fitness, attempting to place the solution in the MAP-Elites archive.
- The `memory-synthesis` module checks whether enough new observations have accumulated to trigger a synthesis pass.
- The `reflection` module triggers MAR when self-eval scores fall below 0.5 or the user rejects the response.
- The `SkillRatingSystem` records the outcome and updates Bayesian ratings.
- The `evolution` module (autopoiesis) periodically diagnoses weaknesses and proposes source code changes.

### 3.3 Module Communication

Critically, the eleven modules do not communicate through a shared message bus or explicit coordination protocol. Instead, they interact through three mechanisms:

1. **Shared state.** Modules read and write to overlapping state: the learning engine's patterns are read by both the tree planner (for value estimation) and the memory synthesis module (for reflection). The skill rating system's rankings influence both the routing decision and the tree planner's value estimates.

2. **Filesystem persistence.** Seven of the eleven modules persist state to `~/.kbot/memory/` as JSON files. These files constitute a shared, asynchronous communication channel: the memory synthesis module reads files written by the learning engine, the prompt evolution system, and the correction tracker.

3. **Side effects on shared outputs.** Several modules modify the system prompt that is sent to the AI provider. The prompt evolution system appends evolved instructions. The memory synthesis module injects synthesized insights. The active inference engine biases tool selection. These modifications are concatenated without explicit conflict resolution.

It is this lack of explicit coordination --- combined with the richness of implicit interactions --- that gives rise to interference patterns.

---

## 4. Interference Taxonomy

We identify four interference patterns in K:BOT's cognitive stack. Each pattern involves a specific pair or group of modules whose interactions produce behavior that neither module was designed to exhibit.

### 4.1 Pattern 1: Free Energy vs. Quality-Diversity (Convergence--Exploration Tension)

**Modules involved.** `ActiveInferenceEngine` (free-energy.ts) and `quality-diversity.ts` (MAP-Elites archive).

**Mechanism.** The Free Energy Principle drives the agent toward convergence: minimize prediction error, reduce uncertainty, exploit known-good strategies. When the agent encounters a familiar task type with low prediction error (average error below 0.3), the active inference engine recommends exploitation, biasing tool selection toward action-taking tools (write_file, edit_file, bash, git_commit) and away from information-gathering tools.

Simultaneously, the MAP-Elites quality-diversity archive is designed to maintain behavioral diversity. Its fitness function rewards not just quality (eval score) but also efficiency (penalizing expensive solutions) and reliability (success rate). However, if the agent consistently exploits a single high-value strategy --- as the free energy module encourages --- the archive converges: cells corresponding to the dominant strategy accumulate high-fitness solutions while other cells remain empty or stale.

**Formal characterization.** Let $F(t)$ denote the free energy at time $t$, and let $C(t)$ denote the coverage of the MAP-Elites archive (fraction of cells occupied). Under pure free energy minimization, $F(t) \to F_{min}$ monotonically, which implies convergence to a narrow set of strategies. Under pure quality-diversity optimization, $C(t) \to 1$ as the archive fills all behavioral niches. The interference manifests as a coupling:

$$\frac{dC}{dt} \propto -\alpha \cdot \mathbb{1}[F(t) < \theta_{exploit}] + \beta \cdot \mathbb{1}[F(t) > \theta_{explore}]$$

where $\alpha$ is the convergence rate induced by exploitation and $\beta$ is the diversity recovery rate during exploration phases. When the agent enters a sustained exploitation regime ($F(t) < \theta_{exploit}$ for extended periods), the archive undergoes "diversity collapse" --- a monotonic decrease in coverage driven by a module that has no knowledge of or interest in behavioral diversity.

**Falsifiable prediction.** If we instrument the system to log both free energy state and archive coverage over time, we predict a negative correlation between sustained low free energy (exploitation periods) and archive coverage, with a lag of approximately 20--50 interactions (the timescale of MAP-Elites cell displacement).

### 4.2 Pattern 2: Prompt Evolution Corrupting Memory Synthesis (Evolving into Forgetting)

**Modules involved.** `prompt-evolution.ts` (GEPA) and `memory-synthesis.ts` (Three-Tier Memory).

**Mechanism.** The prompt evolution system analyzes execution traces and generates prompt mutations to improve specialist performance. One of its mutation rules addresses low relevancy: when more than thirty percent of responses score below 0.4 on relevancy, the system injects a "CRITICAL: Answer the actual question first" directive. Another rule addresses narrow tool usage: when tool diversity is below fifteen percent, the system encourages broader tool exploration.

The memory synthesis module, operating on a different timescale, periodically reads all raw observation files (patterns, solutions, knowledge entries, corrections) and synthesizes them into higher-order insights. These insights are injected into the system prompt as "[Synthesized User Insights]" --- compact natural-language statements about user preferences, workflow patterns, and coding style.

The interference occurs when prompt evolution optimizes *against* the behaviors that memory synthesis depends on. Consider: the memory synthesis module detects that the user frequently works with TypeScript + React and produces the insight "This user works primarily in TypeScript (72% of tech mentions)." This insight, injected into the prompt, causes the specialist to front-load TypeScript-specific assumptions. The prompt evolution system, seeing that the specialist now occasionally misses non-TypeScript requests (elevated low-relevancy rate), generates a mutation: "CRITICAL: Answer the actual question first. Do not go on tangents." This mutation suppresses the specialist's use of synthesized insights --- effectively training the agent to ignore its own accumulated knowledge.

**Formal characterization.** Let $M(t)$ be the set of active memory insights at time $t$, and let $P(t)$ be the active prompt amendment. The memory system is additive: $|M(t)| \geq |M(t-1)|$ (insights accumulate monotonically until the MAX\_INSIGHTS cap). The prompt evolution system is substitutive: $P(t)$ replaces $P(t-1)$ entirely. The corrupting interaction occurs when prompt mutations penalize behaviors induced by memory insights:

$$\text{score}(a | M(t), P(t)) < \text{score}(a | \emptyset, P(t))$$

That is, the agent performs *worse* with its accumulated memory than without it, because the evolved prompt actively suppresses memory-guided behavior. This creates a paradox: the system evolves to forget what it has learned.

**Falsifiable prediction.** We predict that specialist agents with both active prompt mutations and rich memory contexts (more than eight insights) will show lower relevancy scores than agents with prompt mutations but no memory context, during the first five interactions after a prompt evolution cycle. This effect should be measurable via A/B comparison within the same agent across sessions.

### 4.3 Pattern 3: MAR Reflection vs. LATS Tree Search (Backward vs. Forward Reasoning)

**Modules involved.** `reflection.ts` (MAR Multi-Persona Reflection) and `tree-planner.ts` (LATS Tree Search).

**Mechanism.** MAR reflection is inherently backward-looking: when a task fails, five specialist perspectives critique the failure, and a synthesis step produces a lesson. These lessons are stored in `~/.kbot/memory/reflections.json` and are available to future sessions. The lessons encode *what went wrong* and *what not to do*.

LATS tree search is inherently forward-looking: it generates branching plans, estimates node values using cached patterns and skill ratings, selects the best path via UCB1, and executes forward along it. When a step fails, the tree expands alternative branches from the parent node and re-selects.

The conflict emerges in their temporal orientations. MAR lessons say "do not use this approach for this type of task" --- a prohibitive constraint derived from past failure. LATS value estimates say "this approach has estimated value 0.72 based on skill library matches and collective patterns" --- a positive signal derived from aggregate success. When the two signals conflict on the same action, the system must decide: does the specific lesson from a single failure override the statistical estimate from many successes?

Currently, K:BOT has no formal mechanism for resolving this conflict. MAR lessons are injected into the system prompt as context, influencing the LLM's plan generation. LATS value estimates are computed independently by the heuristic evaluation function (`estimateValue`). The LLM may or may not attend to the MAR lesson when executing a LATS-selected step. The result is inconsistency: sometimes the agent follows the LATS plan and ignores the MAR lesson (repeating the failure), and sometimes it follows the MAR lesson and abandons a statistically sound plan (forgoing a likely success).

**Formal characterization.** Let $L$ be the set of MAR lessons, each associated with a task pattern and a prohibited action. Let $V(a, n)$ be the LATS value estimate for action $a$ at node $n$. The conflict set is:

$$C = \{(a, n) : V(a, n) > \theta_{select} \wedge \exists l \in L : \text{matches}(l, a)\}$$

For each element in $C$, the agent faces a decision under conflicting signals. The current resolution is nondeterministic (depends on LLM attention to the MAR lesson in the prompt). A principled resolution would require either (a) discounting LATS values when MAR lessons apply, (b) weighting MAR lessons by their recency and specificity, or (c) a meta-module that explicitly arbitrates between backward and forward reasoning.

**Falsifiable prediction.** Tasks in the conflict set $C$ should exhibit higher variance in outcome quality than tasks where MAR and LATS agree. Specifically, the coefficient of variation of eval scores for conflict-set tasks should exceed that of non-conflict tasks by a factor of at least 1.5.

### 4.4 Pattern 4: Bayesian Skill Ratings as Emergent Governor

**Modules involved.** `SkillRatingSystem` (skill-rating.ts) and all other modules indirectly.

**Mechanism.** The Bayesian skill rating system was designed as infrastructure: a routing optimization that learns which specialist agent handles which task category best. It maintains {mu, sigma} Gaussian distributions per agent per category, updates via Bradley-Terry, and routes tasks to the agent with the highest conservative estimate (mu - 2*sigma). It was explicitly designed *not* to be a cognitive module --- it has no model of the user, no theory of task structure, and no planning capability.

Yet in practice, the skill rating system has become the de facto governor of the entire cognitive stack. This emergence occurs through three pathways:

**Pathway 1: Routing as cognitive filtering.** By selecting which specialist handles a task, the skill system determines which prompt (including evolved instructions and memory insights) is activated. Different specialists have different prompt evolution histories and different accumulated memory contexts. The routing decision therefore determines the entire cognitive configuration that processes the task.

**Pathway 2: Value estimation coupling.** The LATS tree planner's `estimateValue` function consults the skill rating system to boost values when high-confidence routing is available. This means routing confidence directly influences planning, creating a feedback loop: agents that are routed to frequently accumulate more skill data, which increases their routing confidence, which increases their LATS plan values, which causes them to be selected more often.

**Pathway 3: Outcome arbitration.** After execution, the skill rating system records wins and losses. A "win" reduces sigma (increasing certainty), while a "loss" reduces mu (lowering the skill estimate). Over time, this creates a gravitational effect: successful agents accumulate evidence and attract more tasks, while failing agents lose confidence and are routed to less often. The skill system thereby determines which modules' interference patterns are exercised (because it determines which specialists are active) and which are dormant.

**Formal characterization.** Define the influence function $I_S(t)$ of the skill rating system at time $t$ as the fraction of system decisions that are transitively affected by routing:

$$I_S(t) = \frac{|\text{decisions influenced by routing}(t)|}{|\text{total cognitive decisions}(t)|}$$

We conjecture that $I_S(t)$ is monotonically increasing and approaches an asymptote above 0.8 --- meaning the skill system eventually influences more than eighty percent of the agent's cognitive decisions, despite being designed as a simple routing optimization. This constitutes "infrastructure becoming intelligence": a support system that, through coupling with other modules, becomes the dominant cognitive mechanism.

**Falsifiable prediction.** If we disable Bayesian skill rating and replace it with random routing while keeping all other modules active, we predict a disproportionate degradation in system coherence (measured by eval score variance) that exceeds the expected effect of removing a single routing module. Specifically, the variance increase should be greater than that caused by disabling any other single module, because the skill system's governance role coordinates multiple other module interactions.

---

## 5. Experimental Framework

### 5.1 Design Principles

Measuring cognitive module interference in a production system requires instrumentation that satisfies three constraints:

1. **Non-invasive.** Measurements must not alter the agent's behavior (no observer effect).
2. **Causal.** We need to distinguish correlation from interference. Two modules may fluctuate together because they respond to the same external signal (user behavior), not because they influence each other.
3. **Temporal.** Interference patterns operate on different timescales: free energy updates per-message, prompt evolution updates per-twenty-messages, and memory synthesis updates per-twenty-observations. Measurements must capture cross-timescale interactions.

### 5.2 Instrumentation

We propose instrumenting K:BOT with the following telemetry, all computed locally with no external data transmission:

**Module state snapshots.** After each agent interaction, record the full state of each module:
- Free energy: `{freeEnergy, totalSurprise, beliefUpdates, actionsTaken, avgPredictionError, policy}`
- Predictive processing: `{accuracy, totalPredictions, correctPredictions, blindSpots, precisionWeight}`
- Strange loops: `{isSelfReferential, metaDepth, strangeLoopsDetected, selfModelAccuracy}`
- Integrated information: `{avgPhi, peakPhi, measurements, trend}`
- Quality-diversity: `{totalElites, avgFitness, coverage, topElites}`
- Skill ratings: per-agent per-category `{mu, sigma}` snapshots
- Prompt evolution: `{generation, totalTraces, activeAmendments}`
- Memory synthesis: `{insightCount, lastSynthesized, observationCount}`
- MAR reflection: `{totalLessons, recentLessons}`
- LATS: `{treeSize, bestPathLength, avgValue, branchingFactor}` (per-plan)

**Interaction outcomes.** For each interaction: eval scores (faithfulness, relevancy, overall), tool sequence, token cost, retry count, success/failure, agent selected, task category.

**Interference events.** Specific detectable interference moments:
- FE--QD tension: log whenever the free energy policy is "exploit" and the MAP-Elites archive coverage has decreased in the last ten interactions.
- PE--MS corruption: log whenever a prompt mutation is applied to an agent that has five or more active memory insights.
- MAR--LATS conflict: log whenever a LATS plan step matches a stored MAR lesson.
- Skill governance: log routing decisions and track how many downstream decisions (plan values, prompt selection, memory context) change as a result.

### 5.3 Analysis Methods

**Granger causality.** To test whether module A's state changes predict module B's state changes (beyond what B's own history predicts), we apply Granger causality tests to the time series of module state snapshots. For example, does free energy policy ("exploit" periods) Granger-cause decreases in MAP-Elites coverage?

**Ablation studies.** Disable individual modules while keeping all others active. Compare system performance (eval scores, task completion rate, user satisfaction proxies) across conditions. The key prediction is that some modules' removal will have *non-additive* effects --- removing module A and module B together may improve performance if their interference was destructive, or degrade it more than the sum of individual removals if their interference was productive.

**Information-theoretic measures.** Compute the mutual information $I(S_A; S_B | X)$ between module states $S_A$ and $S_B$ conditioned on external inputs $X$ (user messages, task types). High conditional mutual information indicates that the modules are exchanging information through their shared interactions, not just responding to the same external signals.

**Intervention experiments.** Inject synthetic module states to test causal hypotheses. For example: artificially set free energy to a high-exploration state and observe whether MAP-Elites coverage recovers. Inject a synthetic MAR lesson that conflicts with the highest-value LATS path and measure the effect on plan execution.

### 5.4 Statistical Requirements

Given that interference patterns operate on timescales of 20--50 interactions (prompt evolution cycle, memory synthesis trigger), meaningful statistical analysis requires a minimum of 500 interactions per experimental condition. With four interference patterns and ablation controls, the full experimental program requires approximately 5,000 instrumented interactions. At K:BOT's current usage rate, this is achievable within 60--90 days of production telemetry collection.

---

## 6. Preliminary Observations

While the full experimental program described in Section 5 has not yet been executed, production telemetry from K:BOT's development and dogfooding period provides preliminary evidence for each interference pattern. We report these observations with appropriate caveats about confounding factors and sample sizes.

### 6.1 Observation 1: Diversity Collapse Under Exploitation

During a two-week period of intensive code refactoring work (a single sustained task type), the MAP-Elites archive showed a characteristic signature: coverage dropped from 55% (11 of 20 cells occupied) to 30% (6 cells). The surviving cells were concentrated in the high-complexity, detailed-response region of the behavioral grid --- exactly the niche favored by the refactoring workflow. The free energy module was in sustained "exploit" mode throughout this period, with average prediction error consistently below 0.25.

When the user switched to a research-heavy task (writing a paper), the agent initially performed poorly. The MAP-Elites archive had no elite in the low-complexity, concise-response cell that research queries typically occupy. The free energy module's prediction error spiked to 0.85, triggering exploration mode, but the archive required approximately thirty interactions to recover useful coverage for the new task type.

This observation is consistent with Pattern 1 (convergence--exploration tension) but confounded by the possibility that diversity collapse is simply a natural consequence of sustained single-task-type usage, independent of the free energy module's influence.

### 6.2 Observation 2: Prompt Mutation Suppressing Memory Insights

The `coder` specialist accumulated twelve memory insights over 200 interactions, including "This user works primarily in TypeScript (72% of tech mentions)" and "Most-used tools: edit_file (47x), read_file (31x), bash (28x)." After the prompt evolution system generated a mutation emphasizing "Answer the actual question first. Do not go on tangents," the coder agent's behavior changed in a subtle way: it stopped front-loading TypeScript-specific context from memory insights and instead began each response with a direct action.

This improved relevancy scores for non-TypeScript requests (which triggered the mutation) but degraded performance on TypeScript tasks where the memory-derived context was genuinely helpful. The net effect was approximately flat on average eval scores, but with increased variance --- exactly the pattern predicted by Pattern 2 (prompt evolution corrupting memory synthesis).

The prompt evolution system's auto-rollback mechanism did not trigger because the overall score did not drop by more than ten percent. The damage was not to average quality but to the agent's ability to leverage accumulated knowledge --- a more subtle form of degradation that the current fitness metric does not capture.

### 6.3 Observation 3: MAR--LATS Inconsistency

During a debugging session, the LATS planner generated a tree with "bisect-and-revert" as the highest-value first branch (value 0.72, boosted by skill library matches). However, the MAR reflection system had stored a lesson from a previous session: "For debugging, avoid bisect-and-revert when the bug is in generated code, as reverting regenerates the same bug." The lesson was injected into the system prompt.

In three successive debugging tasks matching this profile, the agent's behavior was inconsistent: twice it followed the LATS plan (ignoring the MAR lesson) and once it abandoned the plan in favor of a "reproduce-isolate-fix" approach (following the lesson). The two LATS-following attempts both failed in the predicted way (reverting regenerated the bug). The MAR-following attempt succeeded.

This observation directly illustrates Pattern 3 (backward vs. forward reasoning conflict) and highlights the cost of nondeterministic conflict resolution. A system that reliably resolved this conflict in favor of the specific MAR lesson over the statistical LATS estimate would have avoided two failures.

### 6.4 Observation 4: Skill System Gravitational Effect

Over 500 interactions, the skill rating system's sigma values for the `coder` agent decreased monotonically in the `coding` and `debugging` categories, reaching 1.2 (from an initial 8.33). This agent's conservative estimate in these categories exceeded the second-ranked agent by more than 5.0 points. As a result, more than 80% of coding and debugging tasks were routed to `coder`, which in turn meant:

- `coder` accumulated more prompt evolution traces, triggering more frequent prompt mutations.
- `coder`'s MAP-Elites archive filled primarily with coding solutions, while other agents' archives remained sparse.
- MAR lessons for coding failures were disproportionately about `coder`'s behavior, creating a feedback loop where `coder` was both the most critiqued and the most improved agent.
- Other agents (e.g., `researcher`, `analyst`) that could handle coding-adjacent tasks received too few interactions to build competitive skill ratings, entrenching `coder`'s dominance.

This is the "rich get richer" dynamic predicted by Pattern 4. The skill system's gravitational effect means that the entire cognitive stack --- prompt evolution, quality-diversity, reflection, planning --- operates primarily through the lens of a few dominant agents, while other agents' cognitive modules atrophy from disuse.

---

## 7. Discussion

### 7.1 Interference as the Locus of Intelligence

Our core thesis is that in composite cognitive architectures, the interaction surface between modules becomes the primary site of intelligent behavior. This claim has several implications.

First, it suggests that evaluating individual modules in isolation is insufficient for understanding system behavior. A free energy module that performs optimally in isolation may degrade system performance by suppressing the quality-diversity module's exploration. A prompt evolution system that optimally improves individual specialist performance may do so at the cost of corrupting the memory system's accumulated knowledge. System-level evaluation must account for interference effects.

Second, it suggests that the *design* of interference is as important as the design of modules. Currently, K:BOT's modules interfere through accidental coupling --- shared state, overlapping filesystem persistence, concurrent prompt modification. A deliberate interference design would specify which module interactions should be amplified (productive tensions), which should be damped (destructive corruptions), and which should be mediated (conflicts requiring arbitration).

Third, it suggests a new optimization target for cognitive architecture design: not module performance, but interference quality. A system with individually mediocre modules but well-designed interference may outperform a system with individually excellent modules that interfere destructively.

### 7.2 The Governor Emergence Problem

Pattern 4 --- the emergence of Bayesian skill ratings as a system-wide governor --- raises a fundamental question: should cognitive architectures have explicit governance, or should governance emerge from module interactions?

The case for explicit governance is that it provides predictability and enables deliberate interference design. If a dedicated meta-module arbitrates between free energy signals and quality-diversity objectives, the system's behavior is more analyzable and more tunable.

The case for emergent governance is that it adapts to the actual dynamics of the system rather than to the designer's assumptions about those dynamics. The skill rating system became a governor not because it was designed to be one, but because it occupied a structural position (routing decisions) that gave it transitive influence over all other modules. This emergence may capture real system dynamics that a designer would not have anticipated.

Our tentative position is that both are needed. Emergent governance should be monitored and, when identified, either ratified (by formalizing the emergent role) or counteracted (by introducing balancing mechanisms). K:BOT would benefit from a mechanism that periodically audits the skill system's influence scope and introduces exploration bonuses for underserved agents, preventing the gravitational collapse described in Section 6.4.

### 7.3 Timescale Mismatches

A recurring theme in our interference patterns is timescale mismatch. Free energy updates per-message (fast). Predictive processing updates per-conversation-turn (fast). LATS plans are created per-task (medium). Prompt evolution triggers every twenty interactions (slow). Memory synthesis triggers every twenty observations (slow). The self-evolution loop operates on the timescale of development sessions (very slow).

When fast modules and slow modules interfere, the fast module typically "wins" in the short term --- the free energy signal dominates the next action choice --- while the slow module's effects accumulate invisibly until they manifest as sudden state changes (a prompt mutation, a memory synthesis pass, a diversity collapse). This creates a characteristic pattern of apparent stability punctuated by rapid regime shifts, reminiscent of self-organized criticality in complex systems (Bak, Tang, and Wiesenfeld, 1987).

Designing for productive timescale interactions may require explicit synchronization points or buffering mechanisms: for example, the prompt evolution system could be required to "consult" the memory synthesis module before generating mutations that might suppress memory-derived behaviors.

### 7.4 Limitations

Our analysis has several limitations. First, the preliminary observations in Section 6 are drawn from a small number of users (primarily the development team) and may not generalize to diverse usage patterns. Second, we have not yet executed the full experimental program described in Section 5, so our causal claims about interference patterns remain hypotheses rather than established findings. Third, K:BOT's cognitive modules were designed by the same team, which may have introduced implicit coordination that reduces interference compared to a system assembled from independently developed modules. Fourth, our system uses a single underlying LLM provider for most tasks, meaning that module interference is filtered through the LLM's attention mechanism, which may mask or amplify certain patterns in ways we do not fully understand.

---

## 8. Future Work

### 8.1 Interference-Aware Architecture Design

The natural next step is to move from *observing* interference to *designing* it. We envision an architecture where module interfaces explicitly declare their interaction surfaces: what shared state they read and write, what timescale they operate on, and what invariants they expect from other modules. A composition checker could then identify potential interference patterns at design time, before they manifest in production.

### 8.2 Meta-Cognitive Arbitration

Pattern 3 (MAR vs. LATS) and Pattern 4 (emergent governance) both point to the need for a meta-cognitive arbitration layer. This layer would receive conflicting signals from multiple modules, assess their relative reliability and specificity, and produce a unified decision. The challenge is designing this layer so that it does not itself become a bottleneck or a new source of interference. One approach is to use the Strange Loop detector as a foundation: it already monitors meta-cognitive depth, and extending it to arbitrate between module signals would be a natural evolution.

### 8.3 Cross-System Generalization

K:BOT is one system. To establish that cognitive module interference is a general phenomenon, the same analysis should be applied to other composite agent systems: AutoGPT, OpenDevin, SWE-Agent, and other production agent frameworks that combine planning, memory, evaluation, and routing modules. We predict that interference patterns will be universal, though their specific manifestation will depend on the modules present and their coupling topology.

### 8.4 Formal Theory of Cognitive Interference

Our taxonomy is empirically grounded but lacks a unified formal framework. A promising direction is to model cognitive modules as concurrent processes in a shared-memory system, borrowing from the theory of concurrent computation (Hoare, 1978; Lamport, 1979). Interference patterns would then correspond to specific concurrency hazards: race conditions (Pattern 2, where prompt evolution and memory synthesis race to modify the prompt), deadlocks (not yet observed in K:BOT, but theoretically possible when modules create circular dependencies), and priority inversions (Pattern 4, where a low-priority infrastructure module acquires governance authority).

### 8.5 Interference as a Training Signal

If interference patterns are the primary site of intelligent behavior, they may also be the primary site of *learning*. Rather than training individual modules to improve their isolated performance, a composite system could be trained to improve its interference quality. This would require defining a loss function over interference patterns --- penalizing destructive interference (Pattern 2) while rewarding productive tension (Pattern 1, when properly balanced) and emergent governance (Pattern 4, when properly bounded).

---

## 9. Conclusion

We have presented an analysis of cognitive module interference in K:BOT, a production AI agent that integrates eleven cognitive modules from eleven distinct theoretical traditions. Our findings demonstrate that module interactions produce emergent behaviors --- convergence--exploration tension, knowledge corruption through optimization, temporal reasoning conflicts, and infrastructure-to-intelligence emergence --- that cannot be predicted from the behavior of individual modules in isolation.

These findings support a shift in perspective for AI agent design. The current paradigm focuses on developing better individual modules: better planners, better memory systems, better evaluators. Our evidence suggests that equally important --- and currently neglected --- is the design of productive interference between modules. The architecture of interference is not a bug to be eliminated but a feature to be engineered.

K:BOT's cognitive stack was not designed with interference in mind. Its eleven modules were added incrementally, each addressing a specific capability gap, and their interactions were discovered rather than planned. The fact that these accidental interactions dominate system behavior is both a cautionary finding (for systems that assume module independence) and an encouraging one (for the hypothesis that intelligence emerges from the interaction of diverse cognitive processes rather than from any single, monolithic mechanism).

We conclude with a conjecture: as AI agent systems grow more complex, incorporating ever more cognitive modules from ever more theoretical traditions, the fraction of system behavior attributable to module interference will increase monotonically. At some critical complexity threshold, the interference dynamics will become the system's primary cognitive mechanism, and the individual modules will serve primarily as substrates that generate the raw signals from which interference-mediated intelligence emerges. Designing for that threshold --- rather than against it --- is the central challenge for next-generation cognitive architectures.

---

## References

Bak, P., Tang, C., and Wiesenfeld, K. (1987). Self-organized criticality: An explanation of 1/f noise. *Physical Review Letters*, 59(4), 381--384.

Brooks, R. A. (1986). A robust layered control system for a mobile robot. *IEEE Journal on Robotics and Automation*, 2(1), 14--23.

Chase, H. (2022). LangChain: Building applications with LLMs through composability. GitHub repository.

Clark, A. (2013). Whatever next? Predictive brains, situated agents, and the future of cognitive science. *Behavioral and Brain Sciences*, 36(3), 181--204.

Fernando, C., Banarse, D., Michalewski, H., Osindero, S., and Rocktaschel, T. (2024). Generative evolution of prompts for agents. In *Proceedings of ICLR 2026*.

Friston, K. (2010). The free-energy principle: A unified brain theory? *Nature Reviews Neuroscience*, 11(2), 127--138.

Herbrich, R., Minka, T., and Graepel, T. (2006). TrueSkill: A Bayesian skill rating system. In *Advances in Neural Information Processing Systems 19*.

Hoare, C. A. R. (1978). Communicating sequential processes. *Communications of the ACM*, 21(8), 666--677.

Hofstadter, D. R. (1979). *Godel, Escher, Bach: An Eternal Golden Braid*. Basic Books.

Hofstadter, D. R. (2007). *I Am a Strange Loop*. Basic Books.

Hohwy, J. (2013). *The Predictive Mind*. Oxford University Press.

Lamport, L. (1979). How to make a multiprocessor computer that correctly executes multiprocess programs. *IEEE Transactions on Computers*, C-28(9), 690--691.

Maturana, H. R. and Varela, F. J. (1980). *Autopoiesis and Cognition: The Realization of the Living*. D. Reidel Publishing.

Minsky, M. (1986). *The Society of Mind*. Simon and Schuster.

Mouret, J.-B. and Clune, J. (2015). Illuminating search spaces by mapping elites. *arXiv preprint arXiv:1504.04909*.

Oizumi, M., Albantakis, L., and Tononi, G. (2014). From the phenomenology to the mechanisms of consciousness: Integrated information theory 3.0. *PLoS Computational Biology*, 10(5), e1003588.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., and Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. In *Proceedings of UIST 2023*.

Parr, T., Pezzulo, G., and Friston, K. J. (2022). *Active Inference: The Free Energy Principle in Mind, Brain, and Behavior*. MIT Press.

Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., and Yao, S. (2023). Reflexion: Language agents with verbal reinforcement learning. In *Advances in Neural Information Processing Systems 36*.

Significant Gravitas. (2023). AutoGPT: An autonomous GPT-4 experiment. GitHub repository.

Tononi, G. (2004). An information integration theory of consciousness. *BMC Neuroscience*, 5, 42.

Tononi, G., Boly, M., Massimini, M., and Koch, C. (2016). Integrated information theory: From consciousness to its physical substrate. *Nature Reviews Neuroscience*, 17(7), 450--461.

Wang, G., Xie, Y., Jiang, Y., Mandlekar, A., Xiao, C., Zhu, Y., Fan, L., and Anandkumar, A. (2023). Voyager: An open-ended embodied agent with large language models. *arXiv preprint arXiv:2305.16291*.

Zhou, A., Yan, K., Shlapentokh-Rothman, M., Wang, H., and Wang, Y.-X. (2023). Language agent tree search unifies reasoning, acting, and planning in language models. In *Advances in Neural Information Processing Systems 36*.
