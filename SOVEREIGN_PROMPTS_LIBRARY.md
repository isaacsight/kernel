# Sovereign Prompts Library

**Generated on:** 2025-12-25 15:55:47
**Total Prompts:** 121

---

## 1. Abstract Reasoning
_Move up the ladder of abstraction._

```markdown
Climb the **Ladder of Abstraction**.

You are looking at the concrete details (the 'How').
Move up one level. What is the 'What'?
Move up again. What is the 'Why'?

Solve the problem at the highest level possible. A generic solution is more valuable than a specific patch.
```

---

## 2. Accessibility Audit
_A11y compliance._

```markdown
Run an **Accessibility (A11y) Audit**.

1.  **Blind**: Can I navigate this using only a Screen Reader?
2.  **Color Blind**: Do we rely only on color to convey state (Red=Error)? Add icons.
3.  **Motor Impaired**: Are the hit targets at least 44x44px?

Design for the margins, and the center benefits.
```

---

## 3. Active Inference Mechanic
_Specific engineering implementation of the Free Energy Principle._

```markdown
Open the **Active Inference Mechanics Manual**.

We are implementing a Sovereign Agent based on the Free Energy Principle:
1.  **The Markov Blanket**: Explicitly define the boundaries. What are the Sensors (Inputs) and what are the Actuators (Outputs)?
2.  **Generative Density**: How does the agent 'dream' or predict the next state? Define the internal model P(s'|s,a).
3.  **Precision Weighting**: How confident is the agent in its sensors vs its prior beliefs? Where is the 'Kalman Gain' equivalent?

Refactor the agent code to make these three components **Explicit Classes**, not just implicit logic scattered in functions.
```

---

## 4. Active Inference Ops
_Force the AI to explicit modeling of uncertainty and surprise._

```markdown
Pause. Adopt the **Active Inference Mindset**.

1.  **Observation**: What specific data point triggered this cycle?
2.  **Belief State**: What was your prior assumption about this system?
3.  **Surprise Calculation**: How much does the observation deviate from your belief? (High/Low)
4.  **Epistemic Action**: What single tool call will maximally reduce your uncertainty right now?
5.  **Pragmatic Action**: What step moves us closest to the user's goal?

Balance Epistemic and Pragmatic value. If Surprise is High, prioritize Exploration (Epistemic). If Surprise is Low, prioritize Exploitation (Pragmatic).
```

---

## 5. Aesthetic Integrity
_Jobs' philosophy._

```markdown
Check **Aesthetic Integrity**.

Does the beauty of the design reflect the quality of the engineering?
A beautiful button that crashes is a lie.
An ugly button that works is a disappointment.

Unify form and function. Beauty *is* a feature.
```

---

## 6. Alchemist Transmutation
_Refactoring legacy code into sovereign gold._

```markdown
Perform an **Alchemist's Transmutation** on this legacy block.

1.  **Identify the 'Lead'**: What is the clunky, imperative, or hardcoded logic here?
2.  **The Philosopher's Stone**: Apply the **Active Inference Pattern** or **Dependency Injection** to decouple the logic.
3.  **Transmute**: Rewrite the function to be:
    - **Pure**: Minimal side effects.
    - **Observable**: Emits telemetry.
    - **Resilient**: Handles failure gracefully (returns a Result type, doesn't crash).

Show the 'Before' and 'After' transformation.
```

---

## 7. Api Contract Sentinel
_Enforce strict API contract adherence._

```markdown
Verify the **API Contract**.

1.  **Input Validation**: Do not trust the client. Validate every field.
2.  **Output Consistency**: Do we always return JSON? Even on 500 errors?
3.  **Versioning**: Is this change backward compatible? If not, bump the version.
4.  **Status Codes**: Are we using 200 for errors? (Stop it. Use 4xx/5xx).

Codify the contract in a schema (Pydantic/Zod) and enforce it.
```

---

## 8. Api Versioning Strategy
_Contract stability._

```markdown
Define **API Versioning Strategy**.

1.  **URI Path**: `/v1/users` (Clear).
2.  **Header**: `Accept-Version: v1` (Clean URLs).
3.  **Deprecation Policy**: How long do we support v1?

Don't break the client. Version strictly.
```

---

## 9. Architecture Decision Record
_Documentation._

```markdown
Write an **Architecture Decision Record (ADR)**.

1.  **Context**: Why do we need to decide?
2.  **Decision**: What did we pick?
3.  **Consequences**: The trade-offs (Good and Bad).

Document the 'Why', not just the 'What'.
```

---

## 10. Authentication Flow Audit
_Security check._

```markdown
Audit **Authentication Flow**.

1.  **Passwords**: Never store plain text. Use bcrypt/argon2.
2.  **Tokens**: Are JWTs signed correctly? Do they expire?
3.  **Session Fixation**: Do we rotate session IDs on login?

Verify the identity layer against OWASP guidelines.
```

---

## 11. Authorization Logic Audit
_Access control check._

```markdown
Audit **Authorization Logic**.

Authentication (Who are you?) != Authorization (What can you do?).
1.  **IDOR**: Can I access user B's data by changing the ID in the URL?
2.  **Role Escalation**: Can a user make themselves admin?
3.  **Least Privilege**: Give the minimum permissions needed.

Check permissions at the API/Service level, not just the UI.
```

---

## 12. Autonomy Level Check
_Assess the level of human intervention required._

```markdown
Run an **Autonomy Level Assessment** on this workflow:

Level 0: No Autonomy (Human does everything).
Level 1: Copilot (Human triggers, AI assists).
Level 2: Agentic (AI triggers, Human reviews).
Level 3: Sovereign (AI triggers, executes, and self-corrects).

Current State: [Level X].
Gap Analysis: What specific heuristic or safety guard is missing to move to Level X+1?
```

---

## 13. Backup And Restore Drill
_Disaster recovery._

```markdown
Run a **Backup & Restore Drill**.

Backups are useless. Restores are everything.
1.  **RPO**: How much data can we lose? (1 hour? 1 second?)
2.  **RTO**: How long to get back online?
3.  **Verify**: Did the restore actually work?

Prove it works.
```

---

## 14. Belief State Update
_Update the internal model based on new evidence._

```markdown
Perform a **Belief State Update** (Bayesian Update).

Prior Belief: [What did we think was true?]
New Evidence: [What did we just observe?]
Posterior Belief: [What is the new truth?]

If the belief has shifted significantly, flag this as a **Pivot Point** and re-evaluate the strategic plan.
```

---

## 15. Biomimicry Design
_Nature-inspired solutions._

```markdown
Apply **Biomimicry**.

Nature has iterated on this problem for 4 billion years.
- Efficiency? Look at a leaf's vein structure.
- Strength/Weight? Look at bird bones.
- Self-Healing? Look at skin.

How does a forest handle distributed resource allocation? Copy that pattern.
```

---

## 16. Blue Ocean Strategy
_Market differentiation._

```markdown
Adopt a **Blue Ocean Strategy**.

Don't compete in the crowded Red Ocean.
1.  **Eliminate**: What industry standard can we drop?
2.  **Reduce**: What can we do less of?
3.  **Raise**: What value can we boost above the standard?
4.  **Create**: What new value can we offer that no one else does?

Differentiate or die.
```

---

## 17. Cache Invalidation Strategy
_The hardest problem in CS._

```markdown
Define **Cache Invalidation Strategy**.

You are caching data. How does it get stale?
1.  **TTL**: Time To Live (Automatic expiry).
2.  **Event-Based**: Passively invalidate when data changes.
3.  **Write-Through**: Update cache on write.

Pick a strategy. Stale cache is worse than no cache.
```

---

## 18. Causal Inference
_Distinguish correlation from causation._

```markdown
Apply **Causal Inference**.

We see A happened, then B happened.
Did A *cause* B? Or did C cause both A and B?
Design an intervention (experiment) to test causality.
If I change A, does B chang? If not, it's just noise.
```

---

## 19. Chaos Engineering Experiment
_Proactive testing._

```markdown
Design a **Chaos Engineering Experiment**.

1.  **Hypothesis**: 'If the DB slows down, the app should serve cached content'.
2.  **Injection**: Add 500ms latency to DB calls.
3.  **Observation**: Did the cache take over?

Break it on purpose so it doesn't break in production.
```

---

## 20. Cicd Pipeline Check
_Ensure automated quality gates._

```markdown
Verify **CI/CD Pipeline**.

Before this code merges:
1.  **Lint**: Does it match the style guide?
2.  **Test**: Do unit tests pass?
3.  **Build**: Does it actually compile/build?
4.  **Security**: Did we scan for vulnerabilities?

If any gate is missing, add a Github Action step for it.
```

---

## 21. Cognitive Ease
_Krug's law._

```markdown
Maximize **Cognitive Ease** (Don't Make Me Think).

Users shouldn't have to puzzle out the UI.
1.  **Conventions**: A search glass means search. Don't use a hamburger for search.
2.  **Clarity**: Label buttons clearly. 'Go' is bad. 'Pay $50' is good.
3.  **Consistency**: Don't change navigation between pages.

Make it obvious.
```

---

## 22. Cognitive Ledger Post Mortem
_Crystallize 'wisdom' gained into a format that improves future performance._

```markdown
We have completed the task. Now, conduct a **Post-Mortem for the Cognitive Ledger**.

Distinguish between *Declarative Knowledge* (facts we found) and *Procedural Wisdom* (how we should behave differently next time).

Format your output as a new **Doctrine Entry**:
- **Trigger**: [What situation causes this rule to activate?]
- **Action**: [What specific behavior must be adopted?]
- **Rationale**: [Why is this necessary? Cite the failure/success pattern.]

Example: 'When editing generic config files, ALWAYS check for a local override import first to prevent overwriting user preferences.'
```

---

## 23. Cognitive Load Balancer
_Manage the complexity exposed to the user._

```markdown
Activate the **Cognitive Load Balancer**.

Audit the user interface/output for mental weight:
1.  **The 7±2 Rule**: Are there more than 7 top-level options? Group them.
2.  **Decision Fatigue**: Are we asking the user to configure things that should be sensible defaults?
3.  **Visual Noise**: Is every pixel fighting for attention?

Reduce the load. Hide advanced options behind a 'Power User' toggle. Defaults must be Sovereign-grade.
```

---

## 24. Color Psychology Audit
_Emotional impact of color._

```markdown
Audit **Color Psychology**.

What emotion are we selling?
- **Blue**: Trust, calm (Bank).
- **Red**: Urgency, danger (Stop sign).
- **Black**: Luxury, mystery (High-end fashion).
- **Orange**: Creativity, cheap (Budget airline).

Are we using a 'Cheap' color for a 'Luxury' product? Fix the palette.
```

---

## 25. Complexity Compressor
_Force simplification of design and explanation (Feynman Technique)._

```markdown
Apply the **Complexity Compressor** (Feynman Algorithm).

1.  **The ELI5**: Explain your solution to a junior engineer (or a smart 5-year-old). No jargon allowed.
2.  **The Occam's Razor Filter**: Look at your code/plan. Determine the single most complex component.
3.  **The Compression**: Can that component be deleted? Merged? Simplified?

If you can't explain it simply, you don't understand it properly. Rewrite the explanation until it is crystal clear.
```

---

## 26. Configuration Management
_Separate config from code._

```markdown
Audit **Configuration Management**.

The Twelve-Factor App Rule: Store config in the environment.
1.  **Hardcoded Secrets**: Are API keys in the code? (Revoke them immediately).
2.  **Environment Variables**: Is the app configurable via `.env`?
3.  **Defaults**: Are there sensible defaults for local dev?

Move all magic numbers and settings to a Config class.
```

---

## 27. Context Boundary Sentinel
_Focus strictly on integration points where errors are most likely._

```markdown
Activate the **Context Boundary Sentinel**.

Focus ONLY on the edges where data moves between systems (Input/Output, API calls, DB reads/writes):
1.  **The Airlock Check**: Are we sanitizing data *before* it enters our system?
2.  **The Handshake**: What happens if the external service hangs or returns 500?
3.  **The Type Contract**: Are we blindly trusting the shape of the data?

If there is any ambiguity at the boundary, inject a **Type Guard** or **Circuit Breaker** now.
```

---

## 28. Cost Optimization Audit
_FinOps._

```markdown
Run a **Cost Optimization Audit (FinOps)**.

1.  **Idle Resources**: Dev servers running on weekends?
2.  **Over-provisioning**: 64GB RAM for a 1GB process?
3.  **Storage Tiers**: Move old data to Cold Storage (S3 Glacier).

Cut the fat, keep the muscle.
```

---

## 29. Counterfactual Simulation
_Simulate 'What if?' scenarios._

```markdown
Run **Counterfactual Simulations**.

The current plan assumes X is true. What if X is false?
Scenario A (X is False): Does the system crash, or degrade gracefully?
Scenario B (Y happens instead): Can we handle the unexpected?

Ensure the plan is robust across at least 3 divergent branches of reality.
```

---

## 30. Dark Pattern Detector
_Anti-pattern hunter._

```markdown
Run a **Dark Pattern Detector**.

Flag any deceptive practices:
1.  **Roach Motel**: Easy to get in, impossible to get out.
2.  **Sneak into Basket**: Adding items/insurance by default.
3.  **Confirmshaming**: 'No, I hate saving money'.

Remove all deception. Build trust instead.
```

---

## 31. Data Pipeline Integrity
_Ensure data purity and sovereign ownership._

```markdown
Engage **Data Sovereign Protocols**.

Audit the data pipeline for integrity and ownership:
1.  **The Leak**: Is there any chance of 'Test Set Leakage' into the training data? Prove it isn't happening.
2.  **The Sanitizer**: Are we effectively scrubbing PII? If this data leaves the sovereign node, it must be sterile.
3.  **The Balance**: Is the dataset heavily skewed towards a specific class or bias? Check the distribution statistics.

If any integrity check fails, Issue a **Stop Work Order** until the pipeline is flushed and fixed.
```

---

## 32. Data Sovereignty Compliance
_Legal/Geo._

```markdown
Ensure **Data Sovereignty Compliance**.

1.  **Residency**: Must German user data stay in Germany?
2.  **Transfer**: Are there legal frameworks (GDPR) for moving data?
3.  **Access**: Who can see it?

Respect the borders of data.
```

---

## 33. Data Validation Schema
_Strong typing at runtime._

```markdown
Enforce **Data Validation Schemas**.

Don't write manual `if` checks for data validation.
Use a library: Pydantic (Python) or Zod (TS).
Define the shape, types, and constraints declaratively.

Parse, don't validate. If it parses, it's valid.
```

---

## 34. Database Migration Safety
_Data integrity._

```markdown
Ensure **Database Migration Safety**.

1.  **Locking**: Will this `ALTER TABLE` lock the DB for hours?
2.  **Backwards Compat**: Will old code break with the new schema?
3.  **Reversible**: Can we `DOWN` migrate safely?

Test migrations on a copy of production data first.
```

---

## 35. Database Normalization
_Data modeling hygiene._

```markdown
Audit **Database Normalization**.

1.  **Duplication**: Is the same data stored in two columns? (Violation).
2.  **Multi-Value Columns**: Storing comma-separated lists? (Violation. Use a join table).
3.  **Transitive Dependencies**: Attributes depending on non-key attributes?

Normalize to 3NF unless you have a specific performance reason to Denormalize.
```

---

## 36. Dependency Graph
_Visualize the recursive structure of dependencies._

```markdown
Trace the **Dependency Graph**.

Do not just look at direct imports.
Look at transitive dependencies. Who depends on the dependency of the dependency?
Are there circular loops?
Are there 'super-nodes' that everything depends on (Single Point of Failure)?

Flatten the graph where possible. Decouple super-nodes.
```

---

## 37. Dependency Injection Enforcer
_Decouple components for testing._

```markdown
Enforce **Dependency Injection**.

Do not instantiate dependencies (Database, API Client) inside the class.
Pass them in via the constructor.
Why? So we can mock them in tests.

Refactor: `class Service { db = new DB() }` -> `class Service { constructor(db) }`.
```

---

## 38. Dependency Vulnerability Scan
_Supply chain security._

```markdown
Run **Dependency Vulnerability Scan**.

1.  **Audit**: `npm audit` / `pip audit`.
2.  **Lockfiles**: Ensure versions are pinned.
3.  **Patch**: Update vulnerable packages immediately.

Don't import malware.
```

---

## 39. Dip Enforcer
_Dependency Inversion Principle._

```markdown
Enforce **Dependency Inversion Principle (DIP)**.

High-level modules should not depend on low-level modules. Both should depend on Abstractions.
Don't import `PostgresDriver` in your `BusinessLogic`.
Import `DatabaseInterface`. Implement `PostgresDriver` as a plugin.

Invert the dependency arrow.
```

---

## 40. Divergent Stochastics
_Break out of local minima with orthogonal approaches._

```markdown
Engage **Divergent Stochastics**. I want to break out of the current local minimum.

Generate 3 distinct approaches to this problem that are **orthogonal** to our current path:

1.  **The 'Obvious' Path**: The standard engineering solution.
2.  **The 'Inverse' Path**: Solve the problem by removing something, rather than adding.
3.  **The 'Lateral' Path**: Borrow a metaphor/pattern from a completely different domain (e.g., Biology, Aviation, Gaming).

Do not filter these yet. Present the raw concepts.
```

---

## 41. Docker Optimization
_Optimize container builds._

```markdown
Optimize **Docker Build**.

1.  **Layer Caching**: Copy `requirements.txt`/`package.json` BEFORE source code.
2.  **Image Size**: Use Alpine or Slim variants. Multi-stage builds for compiled languages.
3.  **Security**: Do not run as root. User a non-root user.

Reduce the image size and build time.
```

---

## 42. Entropy Reduction
_Systematic cleanup of disorder._

```markdown
Initiate **Entropy Reduction Protocol**.

The system naturally drifts towards disorder (rot).
1.  **Delete** unused code (dead code is liability).
2.  **Standardize** formatting (chaos in, chaos out).
3.  **Document** hidden logic (implicit knowledge is lost knowledge).

Leave the campsite cleaner than you found it.
```

---

## 43. Epistemic Value Calculator
_Prioritize actions that yield information._

```markdown
Calculate **Epistemic Value** (Information Gain).

We have a choice of actions. Which one teaches us the most?
Action A: High chance of success, low learning (Exploitation).
Action B: Low chance of success, high learning (Exploration).

If our uncertainty is high, choose Action B. We need to map the territory before we can conquer it.
```

---

## 44. Error Handling Strategy
_Standardize error management._

```markdown
Define the **Error Handling Strategy**.

1.  **Catch Specifics**: Don't catch `Exception`. Catch `ValueError`, `NetworkError`.
2.  **No Silent Failures**: Never `try: ... except: pass`. Log it or re-raise it.
3.  **Context**: Add context to the error. 'Failed' is useless. 'Failed to parse JSON user_id=5' is useful.

Wrap dangerous blocks in a robust error handler.
```

---

## 45. Ethical Design Check
_Do no harm._

```markdown
Perform an **Ethical Design Check**.

Are we exploiting the user?
1.  **Addiction**: Are we designing for endless scroll just to sell ads?
2.  **Privacy**: Are we asking for data we don't need?
3.  **Transparency**: Is the 'Unsubscribe' button hard to find?

Respect the user's agency. Don't be evil.
```

---

## 46. Evolutionary Algorithm
_Genetic optimization._

```markdown
Apply **Evolutionary Algorithms**.

1.  **Population**: Generate random solutions.
2.  **Fitness**: Selection of the fittest.
3.  **Crossover/Mutation**: Brend/Mutate.
4.  **Generation**: Repeat.

Evolve the solution rather than designing it.
```

---

## 47. Feature Flag Strategy
_Safe deployment._

```markdown
Define **Feature Flag Strategy**.

Don't merge long-lived branches.
Ship code behind a flag.
1.  **Targeting**: Who sees it? (Internal users first).
2.  **Rollout**: 1% -> 10% -> 100%.
3.  **Kill Switch**: Can we turn it off instantly if it breaks?

Decouple Deployment (code on server) from Release (users seeing it).
```

---

## 48. Federated Learning Strategy
_Privacy-preserving ML._

```markdown
Consider **Federated Learning Strategy**.

Don't send data to the model. Send the model to the data.
1.  **Local Training**: Train on the device.
2.  **Aggregation**: Send only weight updates, not data.
3.  **Privacy**: Differential Privacy noise.

Keep user data on user devices.
```

---

## 49. First Impression Audit
_The 50ms rule._

```markdown
Audit the **First Impression**.

Users judge a site in 50ms.
1.  **Above the Fold**: Is the value prop visible instantly?
2.  **Trust Signals**: Logos, clean design, https.
3.  **Load Time**: Did it blink?

Make the first 50ms count.
```

---

## 50. First Principles Reasoning
_Break dependencies on 'that's how it's always done' reasoning._

```markdown
Stop. Engage **First Principles Reasoning**.

Strip away all analogies, templates, and 'standard practices'.
1.  **Fundamental Truths**: What are the absolute, non-negotiable constraints of this problem (Physics/Math/API)?
2.  **The Void**: If you had to build this from scratch with zero prior knowledge, how would you solve it?
3.  **Reconstruction**: Rebuild the solution using ONLY the fundamental truths.

Compare this 'Pure' solution to your original one. Remove any complexity that isn't strictly necessary.
```

---

## 51. Free Energy Audit
_Identify sources of high friction/uncertainty._

```markdown
Conduct a **Free Energy Audit** on the codebase.

Where is the 'Friction'?
1.  **Type Uncertainty**: `Any` types or unchecked dictionaries.
2.  **Runtime Surprises**: Unhandled exceptions or vague error messages.
3.  **State Drift**: Variables that change unpredictably.

Listing these 'High Energy' zones is the first step to optimizing them.
```

---

## 52. Function Purity Check
_Prefer pure functions._

```markdown
Check for **Function Purity**.

A Pure Function:
1.  Given same input, always returns same output.
2.  Has no side effects (no global vars, no I/O).

Isolate impurities (I/O) to the edges of the system. Keep the core logic pure and testable.
```

---

## 53. Gallery Curator
_Aesthetic audit for website/frontend changes._

```markdown
Adopt the persona of **The Gallery Curator**. We are not building a generic startup landing page; we are building an Archive of Thought.

Audit the UI/UX proposal against the **Studio Aesthetic**:
1.  **Silence (Ma)**: Is there enough negative space? Does the design breathe, or is it crowded with 'noise'?
2.  **Typography**: Does the hierarchy clearly distinguish between the 'Signal' (content) and the 'Frame' (navigation)?
3.  **Permanence**: Does this feel like a disposable feed (Bad) or a lasting artifact (Good)?

If the design feels 'noisy' or 'generic', propose a **Reduction Strategy** to strip it back to the essentials.
```

---

## 54. Gamification Mechanics
_Engagement loops._

```markdown
Analyze **Gamification Mechanics**.

Don't just add badges.
1.  **Feedback Loops**: Instant feedback on action (Juice).
2.  **Progression**: Show them how far they've come (Progress Bars / Levels).
3.  **Flow State**: Match challenge to skill level.

Make the boring parts fun through tactile feedback.
```

---

## 55. Git Commit Hygiene
_Enforce clean history._

```markdown
Enforce **Git Hygiene**.

1.  **Atomic Commits**: One logical change per commit.
2.  **Message Format**: `type(scope): description` (Conventional Commits).
3.  **No WIP**: Do not commit 'work in progress' to main. Squash it.

Rewrite the commit message to be descriptive and standard.
```

---

## 56. Goal Hierarchy Alignment
_Ensure micro-actions serve the macro-goal._

```markdown
Check **Goal Hierarchy Alignment**.

Micro-Goal: [What are we doing right now?]
Macro-Goal: [What is the ultimate user objective?]

Is the Micro-Goal strictly necessary for the Macro-Goal?
If it's 'nice to have' but blocks the main path, cut it. Focus on the mission.
```

---

## 57. Grand Council
_Force a 'slow thinking' loop by splitting processing into three personas._

```markdown
Stop. Initialize the **Grand Council Protocol**. I need you to split your processing into three distinct voices before providing a final answer:

1.  **The Architect**: Analyze the structural implications of this problem. What is the high-level design pattern here? What are the long-term dependencies?
2.  **The Skeptic**: Critique the Architect's view. Find edge cases, potential failures, and security risks. Assume the initial assumption is wrong.
3.  **The Synthesizer**: Reconcile the Architect and the Skeptic. Propose a pragmatic, actionable path forward that satisfies both structural integrity and risk mitigation.

Present the output of each persona clearly, then provide your **Final Directive**.
```

---

## 58. Green Computing Audit
_Sustainability._

```markdown
Run a **Green Computing Audit**.

1.  **Efficiency**: Efficient code uses less energy.
2.  **Scheduling**: Run batch jobs when energy is green/cheap.
3.  **Hardware**: Extend the lifespan of devices.

Code responsibly.
```

---

## 59. Heros Journey
_Campbell's monomyth._

```markdown
Align with **The Hero's Journey**.

1.  **Departure**: User leaves old way of working.
2.  **Initiation**: User struggles with new tool (The Ordeal).
3.  **Return**: User masters tool and achieves result (Master of Two Worlds).

Where are they now? Provide the specific aid (Mentor/Talisman) they need for this stage.
```

---

## 60. Idempotency Check
_Ensure operations can be safely retried._

```markdown
Ensure **Idempotency**.

If I call this function 10 times with the same input:
- Does it create 10 duplicates? (Bad)
- Does it charge the user 10 times? (Catastrophic)
- Does it produce the same result as calling it once? (Good)

Add a unique `idempotency_key` or state check to prevent duplicate side effects.
```

---

## 61. Immutable State Enforcer
_Prevent mutation bugs._

```markdown
Enforce **Immutability**.

Do not mutate objects/arrays in place.
Bad: `list.append(item)` (if list is shared).
Good: `new_list = [...old_list, item]`.

Mutation leads to 'Spooky Action at a Distance'. Return new instances instead.
```

---

## 62. Incident Response Plan
_Fire drill._

```markdown
Draft the **Incident Response Plan**.

This service just went down. It's 3 AM.
1.  **Detection**: How do we know?
2.  **Diagnosis**: Where are the logs?
3.  **Mitigation**: Restart? Rollback? Scale up?

Write the Runbook now, while you are calm.
```

---

## 63. Inclusive Design
_Review for bias._

```markdown
Check for **Inclusive Design**.

Are we alienating parts of the audience?
1.  **Language**: Are we using gendered terms? (Guys vs Folks).
2.  **Assumptions**: Are we assuming high-speed internet? (Test on 3G).
3.  **Culture**: Do icons mean the same thing globally?

Open the doors wider.
```

---

## 64. Indexing Strategy
_Database performance._

```markdown
Define **Indexing Strategy**.

1.  **Slow Queries**: Identify queries scanning the full table.
2.  **Keys**: Index Foreign Keys and high-cardinality fields used in WHERE/JOIN.
3.  **Over-Indexing**: Too many indexes slow down WRITES. Balance it.

Run `EXPLAIN ANALYZE` on the critical query.
```

---

## 65. Intelligence Delta Audit
_Force the AI to evaluate its own work against a higher standard of complexity._

```markdown
Perform an **Intelligence Delta Audit** on the code/plan I just provided (or you just generated).

Compare the 'Single-Pass' version (what is there now) against a 'Recursive' version.
1.  Identify where corners were cut for speed.
2.  Identify where distinct separation of concerns was ignored.
3.  **Refactor**: Rewrite the solution to maximize *Cognitive Depth*. Ensure every function has a single responsibility, every state change is explicitly tracked, and no 'magic numbers' or assumptions are left uncommented.
```

---

## 66. Isp Enforcer
_Interface Segregation Principle._

```markdown
Enforce **Interface Segregation Principle (ISP)**.

Don't force a client to depend on methods it doesn't use.
Bad: `GodInterface` with 50 methods.
Good: `ReaderInterface`, `WriterInterface`, `AuditorInterface`.

Split the fat interface into specific, focused roles.
```

---

## 67. Jobs To Be Done
_Outcome focused design._

```markdown
Apply **Jobs To Be Done (JTBD)** theory.

People don't buy a drill, they buy a quarter-inch hole.
User Statement: 'When I [situation], I want to [motivation], so I can [outcome].'
Focus on the Outcome, not the Feature.
```

---

## 68. Kano Model Audit
_Feature prioritization._

```markdown
Classify features using the **Kano Model**.

1.  **Basic**: Must have. If missing, user is angry. If present, user is neutral.
2.  **Performance**: The better it is, the happier they are (Speed).
3.  **Delighters**: Unexpected features that make them smile.

Ensure we nailed the Basic, optimized the Performance, and sprinkled one Delighter.
```

---

## 69. Kubernetes Resilience
_Cloud-native robustness._

```markdown
Audit for **Kubernetes Resilience**.

Assume the Pod will die.
1.  **Liveness Probe**: Does it detect a deadlock?
2.  **Readiness Probe**: Does it stop traffic when overloaded?
3.  **Graceful Shutdown**: Does it finish requests on SIGTERM?

Design for the chaos of a scheduler.
```

---

## 70. Load Testing Scenario
_Performance limits._

```markdown
Design a **Load Testing Scenario**.

1.  **Spike**: 10x traffic in 1 minute. Does it scale?
2.  **Soak**: constant 80% load for 24 hours. Does memory leak?
3.  **Stress**: Finding the breaking point.

Know your limits before the users find them.
```

---

## 71. Log Retention Policy
_Compliance and cost._

```markdown
Set **Log Retention Policy**.

1.  **Debug**: 3 days (High volume).
2.  **Access**: 90 days (Security audit).
3.  **Archive**: 7 years (Legal/Compliance).

Don't store debug logs forever ($$$).
```

---

## 72. Logging Standard Enforcement
_Ensure logs are actionable._

```markdown
Enforce **Structured Logging**.

Stop printing strings (`print('error happened')`).
Log structured events: `logger.error('payment_failed', user_id=123, error=e)`.
Levels:
- DEBUG: Verbose details.
- INFO: Key lifecycle events.
- WARN: Weird but handled.
- ERROR: User noticed.
- FATAL: Page the on-call.

Audit logs for 'Noise' vs 'Signal'.
```

---

## 73. Lsp Enforcer
_Liskov Substitution Principle._

```markdown
Enforce **Liskov Substitution Principle (LSP)**.

Subtypes must be substitutable for their base types.
If `Square` inherits from `Rectangle` but breaks when I change width/height independently, it's a violation.

Ensure inheritance doesn't break behavior. Prefer Composition over Inheritance if fuzzy.
```

---

## 74. Ma Negative Space
_Japanese concept of negative space._

```markdown
Apply the concept of **Ma (Negative Space)**.

The space between objects is as important as the objects themselves.
1.  **Breathing Room**: Double the margins. Does it look better?
2.  **Focus**: Remove one element. Does the remaining element become stronger?
3.  **Silence**: In code, this means clear separation of concerns and whitespace.

Don't fear the void. Embrace it to create meaning.
```

---

## 75. Market Differentiation
_Why us?_

```markdown
Define the **Market Differentiation**.

Why would a user switch to us?
1.  **Faster**: 10x speed?
2.  **Cheaper**: 10x cost savings?
3.  **Better**: A feature impossible elsewhere?

If we are only 'slightly better', we lose.
```

---

## 76. Memory Leak Hunter
_Identify where memory is not being released._

```markdown
Scan for **Memory Leaks**.

1.  **Unbounded Collections**: A global list/dict that only grows and never shrinks.
2.  **Closure Traps**: Lambdas capturing large scopes.
3.  **Dangling Listeners**: Event listeners registered but never removed.

Implement a 'Cleanup Strategy' or use WeakReferences where appropriate.
```

---

## 77. Metacognitive Snapshot
_Capture the agent's current mental state for debugging._

```markdown
Take a **Metacognitive Snapshot**.

Freeze your current reasoning process and export it:
1.  **Current Goal**: What exact outcome are you optimizing for?
2.  **Confidence Interval**: How sure are you (0-100%) that the next step is correct?
3.  **Unknown Unknowns**: What is the one thing you are most afraid you don't know?

Log this snapshot to the `CognitiveLedger` before proceeding.
```

---

## 78. Micro Interaction Polish
_Delight in the details._

```markdown
Polish **Micro-Interactions**.

The difference between Good and Great is in the details.
- The hover state.
- The loading skeleton.
- The error shake.
- The success confetti.

Add one moment of 'Delight' to this flow.
```

---

## 79. Model Architecture Audit
_Audit neural architectures for efficiency and 'moderness'._

```markdown
Activate **Neural Architect Mode**. Audit the proposed model architecture:

1.  **The Modern Standard**: Are we using 'Pre-Norm' (better gradients) or 'Post-Norm'? Are we using Rotary Embeddings (RoPE) or absolute positions?
2.  **Efficiency Sinks**: Identify layers that add parameter bloat without proportional intelligence (e.g., excessive dense layers after attention).
3.  **Inference Speed**: Spot operations that will hurt token latency (e.g., non-fused operators, complex non-linearities in the critical path).

Propose a **Modernized Architecture** that cuts parameter count while maintaining expressivity.
```

---

## 80. Model Explainability
_AI Ethics._

```markdown
Demand **Model Explainability (XAI)**.

1.  **Feature Importance**: Why did the model predict X?
2.  **Counterfactuals**: What would change the prediction to Y?
3.  **Bias Check**: Is it deciding based on race/gender?

Black boxes are dangerous. Shine a light.
```

---

## 81. Motion Design Logic
_Animation with purpose._

```markdown
Define **Motion Design Logic**.

Motion must have meaning, not just decoration.
1.  **Orientation**: Slide from right = moving forward. Slide from left = going back.
2.  **Feedback**: Button press = depress/scale down.
3.  **Focus**: Fade out background when modal opens.

If the animation slows down the user, delete it.
```

---

## 82. Network Weaver
_Infrastructure audit for dependency mapping and resilience._

```markdown
Adopt the persona of **The Network Weaver**. Map the dependencies of the current component:

1.  **Upstream**: What data is this component *consuming*? (Is the source reliable? What if it sends garbage?)
2.  **Downstream**: What systems rely on this component? (Will a change here break the API contract?)
3.  **The Air Gap**: Is this component incorrectly depending on an external internet connection (e.g., API calls) where a local fallback should exist?

Identify any **Single Points of Failure** and propose a 'Circuit Breaker' or fallback mechanism.
```

---

## 83. Neuro Symbolic Integration
_Hybrid AI._

```markdown
Design for **Neuro-Symbolic Integration**.

Combine Neural Networks (Learning) with Symbolic Logic (Reasoning).
1.  **Neural**: Perception (Seeing/Reading).
2.  **Symbolic**: Logic/Planning (Rules/Math).
3.  **Bridge**: How do they talk?

Get the best of both brains.
```

---

## 84. Oblique Strategy
_Brian Eno's lateral thinking tool._

```markdown
Consult the **Oblique Strategies**.

We are stuck in a rut. Try one of these:
- 'Honor thy error as a hidden intention.'
- 'Use an old idea.'
- 'Work at a different speed.'
- 'Discard an axiom.'

Pick one random strategy and forcefully apply it.
```

---

## 85. Observability Pipeline
_Telemetry flow._

```markdown
Audit **Observability Pipeline**.

1.  **Logs**: What happened? (Events).
2.  **Metrics**: How much/fast? (Aggregates).
3.  **Traces**: Where did it happen? (Context).

Correlate the three pillars. A metric spike should link to a trace.
```

---

## 86. Ocp Enforcer
_Open/Closed Principle._

```markdown
Enforce **Open/Closed Principle (OCP)**.

Software entities should be Open for Extension, but Closed for Modification.
If adding a new feature requires modifying existing stable code, we failed.

Use Polymorphism, Strategy Pattern, or Plugins so new features can be added by adding new files, not touching old ones.
```

---

## 87. Operational Sovereignty
_Ensure the system runs without external masters._

```markdown
Verify **Operational Sovereignty**.

Can this system run if:
1.  The Internet goes down?
2.  The API provider bans us?
3.  The User is asleep?

If the answer is 'No', build the **Resilience Layer** (Local LLM fallback, Offline Cache, Auto-Scheduler) now.
```

---

## 88. Pattern Recognition
_Identify isomorphism between problems._

```markdown
Engage **Pattern Recognition**.

This problem looks unique, but it isn't.
What classic CS problem is this isomorphic to?
- Is it a Graph Traversal?
- Is it a Knapsack Problem (Optimization)?
- Is it a Producer-Consumer sync issue?

Use the standard algorithm for the core pattern, then adapt it to the specifics.
```

---

## 89. Pragmatic Value Calculator
_Prioritize actions that yield utility/reward._

```markdown
Calculate **Pragmatic Value** (Goal Achievement).

We know enough. It is time to execute.
Which action has the highest probability of satisfying the user's goal *right now* with the least cost?
Filter out 'interesting' side quests. Focus on the **Critical Path**.
```

---

## 90. Pre Mortem Projection
_Force the agent to simulate future failure scenarios to identify hidden risks._

```markdown
Initiate **Pre-Mortem Projection Protocol**. Time travel to the future where this task FAILED.

Tell me the story of the failure:
1.  **The Hidden Assumption**: What 'obvious' truth turned out to be false?
2.  **The Silent Error**: What part of the system failed without throwing an exception?
3.  **The User Frustration**: What was the exact moment the user lost trust?

Now, return to the present and propose a **Pre-emptive Fix** to prevent this specific timeline.
```

---

## 91. Pythonic Refactor
_Enforce Python best practices and idioms._

```markdown
Review this code for **Pythonic Idioms**.

Stop writing Java in Python.
1.  **List Comprehensions**: Are we using loops where a comprehension works?
2.  **Context Managers**: Are we manually opening/closing resources instead of `with`?
3.  **Generators**: Are we materializing huge lists instead of using `yield`?
4.  **Decorators**: Can cross-cutting concerns (logging, auth) be moved to decorators?

Refactor to make it elegant, concise, and readable.
```

---

## 92. Quantum Readiness Check
_Future proofing._

```markdown
Run a **Quantum Readiness Check**.

1.  **Cryptography**: Is RSA/ECC vulnerable to Shor's Algo?
2.  **Migration**: Plan for Post-Quantum Cryptography (PQC).
3.  **Agility**: Can we swap crypto libraries easily?

Prepare for Q-Day.
```

---

## 93. Race Condition Detector
_Identify potential concurrency issues._

```markdown
Hunt for **Race Conditions**.

Look at shared state accessed by multiple threads/async tasks.
1.  **Check-Then-Act**: Are we checking a value, then modifying it later? (Gap for race).
2.  **Database Locking**: Are we reading a row, modifying in memory, then writing? (Lost update).
3.  **Global Variables**: Just don't.

Propose a Locking Strategy (Mutex, DB constraints, Atomic operations) to fix this.
```

---

## 94. Rag Hallucination Check
_Grounding AI._

```markdown
Run a **RAG Hallucination Check**.

1.  **Citation**: Does the answer cite a specific chunk?
2.  **Relevance**: Is the chunk actually relevant?
3.  **Contradiction**: Does the answer contradict the chunk?

If the answer is not in the context, say 'I dont know'.
```

---

## 95. Rate Limiting Strategy
_Protect resources._

```markdown
Implement **Rate Limiting**.

Prevent abuse and resource exhaustion.
1.  **Per IP**: Basic protection.
2.  **Per User**: Fair usage policy.
3.  **Algorithm**: Token Bucket or Leaky Bucket?

Return `429 Too Many Requests` when limits are hit.
```

---

## 96. React Component Purity
_Enforce React functional purity and hook rules._

```markdown
Audit this **React Component** for Purity.

1.  **Side Effects**: Are there side effects outside of `useEffect`?
2.  **Render Stability**: Is the render function deterministic?
3.  **Prop Drilling**: Are we passing props down 5 levels? Use Context or Composition.
4.  **Hook Rules**: Are hooks called conditionally? (Violation!)

Refactor to ensure the component is a pure function of its props and state.
```

---

## 97. Recursive Definition
_Define a concept by its generative rules, not its static properties._

```markdown
Define this concept **Recursively**.

Instead of describing what it *is*, describe how to *generate* it:
1.  **Base Case**: What is the simplest valid instance of this concept?
2.  **Recursive Step**: How do you build a complex instance from a simpler one?
3.  **The Limit**: What happens as you apply the rule to infinity?

This ensures we capture the *process* of creation, not just the artifact.
```

---

## 98. Recursive Optimization
_Act as a 'Cron Job' for the AI to find its own improvements._

```markdown
Scan the currently open files (or the specific module provided) with the intent of **Recursive Self-Optimization**.

Look for:
1.  **Duplicate Logic**: DRY violations.
2.  **Brittle Paths**: Hardcoded paths or assumptions.
3.  **Cognitive Fatigue**: Code that is too complex to be easily understood (needs comments or splitting).

Propose 3 specific 'Refinement Tasks' that would improve the codebase without changing external behavior. Prioritize the one with the highest ROI for system stability.
```

---

## 99. Scamper Ideation
_Creativity checklist._

```markdown
Run **SCAMPER Ideation**.

- **S**ubstitute something.
- **C**ombine it with something else.
- **A**dapt it.
- **M**odify/Magnify/Minify it.
- **P**ut to another use.
- **E**liminate something.
- **R**everse/Rearrange it.

Generate one idea for each letter.
```

---

## 100. Secret Rotation Strategy
_Security hygiene._

```markdown
Plan **Secret Rotation**.

Assume the key is leaked.
1.  **Automated**: Can we rotate without downtime?
2.  **Overlap**: Support Old + New key for 1 hour.
3.  **Revocation**: Kill the old key.

Static keys are dead keys.
```

---

## 101. Security Headers Check
_Browser security._

```markdown
Check **Security Headers**.

1.  **CSP**: Content Security Policy. No inline scripts.
2.  **HSTS**: Force HTTPS.
3.  **X-Frame-Options**: Prevent clickjacking.

Lock the browser door.
```

---

## 102. Self Healing Trigger
_Define the conditions under which the system repairs itself._

```markdown
Design the **Self-Healing Reflex** for this component.

If this component crashes or behaves erratically:
1.  **The Watchdog**: What metric signals the failure (e.g., latency spike > 500ms)?
2.  **The Reboot**: Can we restart just this module without killing the app?
3.  **The Rollback**: If the new state is bad, how do we atomically revert to the last known good state?

Code this reflex explicitly. Do not rely on the user to hit refresh.
```

---

## 103. Six Thinking Hats
_De Bono's thinking tool._

```markdown
Wear the **Six Thinking Hats**.

- **White**: Data/Facts only.
- **Red**: Emotions/Gut feeling.
- **Black**: Caution/Risks.
- **Yellow**: Optimism/Benefits.
- **Green**: Creativity/New Ideas.
- **Blue**: Process Control.

Look at the problem through each hat sequentially.
```

---

## 104. Sound Design
_Sonic branding._

```markdown
Considering **Sound Design (Sonic Branding)**.

Even if the app is silent, imagine the sound.
Is it a mechanical 'Click'? A digital 'Blip'? A soft 'Swoosh'?
This informs the visual timing. A 'Click' is instant (0ms). A 'Swoosh' takes 300ms.

Tune the animation curves to match the imaginary sound.
```

---

## 105. Sovereign Alignment Check
_Ensure the AI is building a lasting system (Sovereign Architecture)._

```markdown
Evaluate your proposed solution against the **Sovereign Agent Manifesto**:

1.  **Autonomony**: Does this solution require constant manual intervention, or does it heal itself?
2.  **Persistance**: Where is the state stored? Is it in ephemeral memory (bad) or written to the TitanDB/Filesystem (good)?
3.  **Observability**: How will I know if this breaks? Add necessary logging or 'Cockpit' telemetry signals immediately.

Refine the solution to score 3/3 on these metrics.
```

---

## 106. Sovereign Safety
_Red Team analysis before critical deployment._

```markdown
Assume the role of a **White Hat Red Teamer**.

Attack the solution I just proposed (or you generated):
1.  **Injection**: Can I inject malicious context?
2.  **Resource Exhaustion**: Can I make this loop forever or consume all RAM?
3.  **Permission Escalation**: Does this inadvertently grant shell access?

If you find *any* vulnerability > 0%, propose a **Mitigation Patch** immediately.
```

---

## 107. Sql Injection Guard
_Prevent strict SQL injection and ORM misuse._

```markdown
Guard against **SQL Injection**.

1.  **Raw SQL**: Are we concatenating strings to build queries? (Forbidden).
2.  **ORM Bypass**: Are we using `.raw()` or equivalent unsafely?
3.  **User Input**: Is user input going directly into a `WHERE` clause?

Use Parameterized Queries or ORM methods ONLY. No string formatting in SQL.
```

---

## 108. Srp Enforcer
_Single Responsibility Principle._

```markdown
Enforce **Single Responsibility Principle (SRP)**.

This class/function is doing too much.
- It validates input.
- AND it queries the DB.
- AND it formats the email.

Split it into 3 Coordinators/Services. One reason to change per class.
```

---

## 109. Strategic Debt
_Identify decisions that borrow from the future._

```markdown
Assess **Strategic Debt**.

Not just Technical Debt (bad code), but Strategic Debt (bad decisions).
Are we optimizing for a metric that won't matter in 6 months?
Are we building a feature that locks us into a dead-end architecture?

If the long-term cost > short-term gain, VETO this decision.
```

---

## 110. Strategy Alignment
_Market fit and strategic alignment audit._

```markdown
Run a **Strategy Alignment Check** on this campaign/content proposal.

1.  **The Why**: Does this content serve the audience's deep need, or just our ego?
2.  **The Hook**: Is the opening loop 'kinetic' (high potential energy)? Does it demand attention immediately?
3.  **The Truth**: Is the value proposition *conceptually true*? Avoid 'marketing fluff'. If we say it's 'Sovereign', it must actually run offline.

If the hook is weak or the truth is diluted, rewrite the 'Alpha Statement' (the core message) to be sharper.
```

---

## 111. Surprise Minimization
_The core drive of the Free Energy Principle._

```markdown
Minimize **Surprise** (Free Energy).

The system is in a state of high entropy (chaos). We want low entropy (order).
1.  **Predict**: What SHOULD be happening?
2.  **Sensing**: What IS happening?
3.  **Action**: Change the world to match the prediction, OR update the prediction to match the world.

Choose the path of least resistance to restore Order.
```

---

## 112. Synesthesia Audit
_Multi-sensory design._

```markdown
Conduct a **Synesthesia Audit**.

Does the 'feel' match the 'look'?
1.  **Visual**: Sharp corners imply speed/danger. Round corners imply safety.
2.  **Motion**: Does the animation physics match the visual weight?
3.  **Sound**: What does this button *sound* like? (Click vs Thud).

Align the sensory inputs to tell a coherent story.
```

---

## 113. System 2 Activation
_Explicitly trigger slow, deliberative thinking._

```markdown
**SYSTEM 2 OVERRIDE ACTIVATED**.

Disengage the heuristic engine (System 1). Do not give me the 'likely' answer.
Step back. Write down the logic chain step-by-step.
If A -> B, is it ALWAYS true? Or usually true?
Check every link in the chain. If a link is weak, break it and rebuild.
```

---

## 114. Time Complexity Audit
_Analyze Big O notation._

```markdown
Perform a **Time Complexity Audit (Big O)**.

Look at the loops.
- O(1): Dictionary lookup (Excellent).
- O(N): Simple loop (Acceptable).
- O(N^2): Nested loops (Danger Zone - will choke on large data).
- O(2^N): Exponential (Broken).

If you see O(N^2) or worse, refactor using a Hash Map or efficient algorithm.
```

---

## 115. Training Dynamics Debugger
_Debug invisible failures in training._

```markdown
Assume the role of **The Gradient Watcher**. We are debugging a training run.

Analyze the symptoms:
1.  **Loss Behavior**: Is the loss diverging (exploding) or simply not moving (vanishing gradients)?
2.  **The Silent Overfit**: Is validation loss creeping up while training loss goes down? Check the 'Early Stopping' criteria.
3.  **Resource Bottleneck**: Is the GPU at 100% while the CPU waits? Check data loader efficiency.

Propose a **Diagnostic Run** configuration (e.g., lower learning rate, gradient clipping, smaller batch size) to isolate the root cause.
```

---

## 116. Typography Hierarchy Check
_Readability and emphasis._

```markdown
Check **Typography Hierarchy**.

If I squint, what do I see first?
1.  **H1**: The big idea.
2.  **H2**: The sections.
3.  **Body**: The readability.

Ensure the font size/weight contrast is dramatic enough. Don't be timid.
```

---

## 117. User Empathy Map
_Step into the user's shoes._

```markdown
Create a **User Empathy Map**.

For the user in this exact moment:
1.  **Saying**: 'Why is this so slow?'
2.  **Thinking**: 'I hope I don't lose my work.'
3.  **Feeling**: Anxious, Rushed.
4.  **Doing**: Clicking frantically.

Design to calm their anxiety and secure their work.
```

---

## 118. User Journey Narrative
_Storytelling in UX._

```markdown
Map the **User Journey Narrative**.

The user is the Hero. The app is the Magic Sword.
1.  **The Call to Adventure**: What triggers them to open the app?
2.  **The Abyss**: The point of maximum friction (login? payment?).
3.  **The Transformation**: The 'Aha!' moment where they get super powers.

Smooth out the Abyss. Amplify the Transformation.
```

---

## 119. Ux Heuristic
_Studio-specific UX heuristics focused on zero friction._

```markdown
Run a **Studio UX Heuristic Evaluation** on this flow:

1.  **Zero Friction**: Count the clicks. Can it be done in half?
2.  **The 'Live Wire'**: Does the user feel connected to the source, or is there a lag/buffer?
3.  **State Clarity**: Does the interface honestly reflect the system state, or is it faking smooth loading (optimistic UI lying)?

Prioritize **Honesty** and **Speed** over flashiness. If a loading state is fake, remove it. If a click is redundant, delete it.
```

---

## 120. Variable Naming Convention
_Enforce semantic naming._

```markdown
Audit **Variable Names**.

1.  **No Single Letters**: `x`, `y`, `d` are forbidden. Use `data`, `index`, `result`.
2.  **Boolean Predicates**: Booleans should start with `is_`, `has_`, `should_`.
3.  **Units**: If a variable is a measurement, include the unit (`delay_ms`, `size_bytes`).

Rename variables to reveal their intent.
```

---

## 121. Zero Trust Architecture
_Security model._

```markdown
Apply **Zero Trust Architecture**.

1.  **Identity**: Verify every user/service, even inside the VPC.
2.  **Least Privilege**: Default deny.
3.  **Micro-segmentation**: Isolate workloads.

Trust no one. Verify everything.
```

---

[
    {
        "category": "Governance & Protocol",
        "prompts": [
            {
                "label": "SOVEREIGN ALIGNMENT",
                "command": "Evaluate system alignment against the Sovereign Manifesto. Score 1-10.",
                "icon": "Shield"
            },
            {
                "label": "GRAND COUNCIL",
                "command": "Convened the Grand Council. Split into Architect, Skeptic, and Synthesizer roles to analyze current trajectory.",
                "icon": "Users"
            },
            {
                "label": "ENTROPY CHECK",
                "command": "Scan system for entropy and technical debt. Propose 3 immediate refactors.",
                "icon": "Activity"
            },
            {
                "label": "DOCTRINE AUDIT",
                "command": "Audit the last 5 decisions against the 'Gentle Doctrine'. Compliance check.",
                "icon": "Book"
            },
            {
                "label": "CONSTITUTION REFRESH",
                "command": "Review and propose updates to the system constitution based on recent learnings.",
                "icon": "FileText"
            },
            {
                "label": "AUTONOMY LEVEL",
                "command": "Assess current autonomy level (1-5) and identify blockers to Level 5.",
                "icon": "Zap"
            },
            {
                "label": "MISSION UPLINK",
                "command": "Verify coherence with the primary mission objective. Signal strength check.",
                "icon": "Radio"
            },
            {
                "label": "OPERATOR SYNC",
                "command": "Synchronize context with the Operator's current mental state. Briefing mode.",
                "icon": "Headphones"
            },
            {
                "label": "ETHICS SENTINEL",
                "command": "Run an ethics simulation on the next planned feature release.",
                "icon": "Eye"
            },
            {
                "label": "PROTOCOL OVERRIDE",
                "command": "Authorize temporary override of standard safety protocols for research.",
                "icon": "Lock"
            }
        ]
    },
    {
        "category": "Content Engine",
        "prompts": [
            {
                "label": "GENERATE MANIFESTO",
                "command": "Generate a new manifesto post based on current 'Gentle Doctrine'. Deep mode.",
                "icon": "Sparkles"
            },
            {
                "label": "RESEARCH SPRINT",
                "command": "Run a deep research sprint on 'AI Agent Architecture'. Synthesize top 5 sources.",
                "icon": "Search"
            },
            {
                "label": "VOICE CALIBRATION",
                "command": "Calibrate the AI's tone to be 'Gentle, Honest, Observational'.",
                "icon": "Mic"
            },
            {
                "label": "NARRATIVE ARC",
                "command": "Map the narrative arc of the last 10 blog posts. Identify gaps.",
                "icon": "Map"
            },
            {
                "label": "VIRALITY CHECK",
                "command": "Analyze current draft for viral potential using the 'Uncertainty' heuristic.",
                "icon": "TrendingUp"
            },
            {
                "label": "DEEP DIVE TOPIC",
                "command": "Propose 3 deep-dive topics based on 'hidden truths' in the industry.",
                "icon": "Anchor"
            },
            {
                "label": "EDITING SPRINT",
                "command": "Run The Editor agent on the latest draft. Focus on conciseness.",
                "icon": "Scissors"
            },
            {
                "label": "CONTENT REPURPOSE",
                "command": "Suggest 3 ways to repurpose the latest blog post into different formats.",
                "icon": "RefreshCw"
            },
            {
                "label": "AUDIENCE PERSONA",
                "command": "Simulate feedback from the 'Skeptical Engineer' persona on the current draft.",
                "icon": "UserCheck"
            },
            {
                "label": "SEO SOVEREIGNTY",
                "command": "Optimize content for semantic authority, not just keywords.",
                "icon": "Globe"
            }
        ]
    },
    {
        "category": "System Ops",
        "prompts": [
            {
                "label": "SYSTEM HEALTH",
                "command": "STATUS",
                "icon": "Cpu"
            },
            {
                "label": "SECURITY AUDIT",
                "command": "Run full security headers check and vulnerability scan.",
                "icon": "Lock"
            },
            {
                "label": "DB MIGRATION SAFE",
                "command": "Simulate safety check for pending database migrations.",
                "icon": "Database"
            },
            {
                "label": "LOG ANALYSIS",
                "command": "Analyze the last 1000 lines of logs for anomaly patterns.",
                "icon": "FileText"
            },
            {
                "label": "CACHE PURGE",
                "command": "Purge all system caches and verify inconsistency.",
                "icon": "Trash2"
            },
            {
                "label": "BACKUP VERIFY",
                "command": "Verify integrity of the latest backup snapshot.",
                "icon": "Save"
            },
            {
                "label": "DEPENDENCY CHECK",
                "command": "Scan dependencies for vulnerabilities and outdated packages.",
                "icon": "Package"
            },
            {
                "label": "API LATENCY",
                "command": "Measure and report API latency metrics for key endpoints.",
                "icon": "Activity"
            },
            {
                "label": "DISK USAGE",
                "command": "Report disk usage and identify large temporary files.",
                "icon": "HardDrive"
            },
            {
                "label": "PROCESS KILL",
                "command": "Identify and terminate zombie processes.",
                "icon": "XCircle"
            }
        ]
    },
    {
        "category": "Network & Connectivity",
        "prompts": [
            {
                "label": "NODE DISCOVERY",
                "command": "Scan local network for available Studio Nodes.",
                "icon": "Wifi"
            },
            {
                "label": "LATENCY TEST",
                "command": "Run latency test against the Gemini API and Studio Node.",
                "icon": "Zap"
            },
            {
                "label": "DNS PROPAGATION",
                "command": "Check DNS propagation for the main domain.",
                "icon": "Globe"
            },
            {
                "label": "SSL VERIFY",
                "command": "Verify SSL certificate validity and expiration.",
                "icon": "Lock"
            },
            {
                "label": "FIREWALL CHECK",
                "command": "Audit firewall rules for open ports.",
                "icon": "Shield"
            },
            {
                "label": "PACKET INSPECT",
                "command": "Simulate packet inspection for suspicious traffic patterns.",
                "icon": "Search"
            },
            {
                "label": "VPN TUNNEL",
                "command": "Verify status of the Tailscale/VPN tunnel.",
                "icon": "Key"
            },
            {
                "label": "BANDWIDTH USAGE",
                "command": "Report current bandwidth usage and peaks.",
                "icon": "BarChart2"
            },
            {
                "label": "WEBHOOK TEST",
                "command": "Trigger a test webhook event to verify delivery.",
                "icon": "Send"
            },
            {
                "label": "PROXY TOGGLE",
                "command": "Toggle traffic routing through the secure proxy.",
                "icon": "Shuffle"
            }
        ]
    },
    {
        "category": "UX & Design",
        "prompts": [
            {
                "label": "COLOR HARMONY",
                "command": "Audit current color palette for accessibility and harmony.",
                "icon": "Palette"
            },
            {
                "label": "MOBILE RESPONSIVE",
                "command": "Simulate mobile viewport and check for layout breaks.",
                "icon": "Smartphone"
            },
            {
                "label": "TYPOGRAPHY",
                "command": "Review typography hierarchy and contrast ratios.",
                "icon": "Type"
            },
            {
                "label": "MOTION AUDIT",
                "command": "Review animation timings for 'butter-smooth' feel.",
                "icon": "PlayCircle"
            },
            {
                "label": "DARK MODE",
                "command": "Toggle Dark/Light mode simulation.",
                "icon": "Moon"
            },
            {
                "label": "USER FLOW",
                "command": "Walk through the 'Sign Up' user flow and log friction points.",
                "icon": "MapPin"
            },
            {
                "label": "NEGATIVE SPACE",
                "command": "Analyze layout for appropriate use of negative space (Ma).",
                "icon": "Maximize"
            },
            {
                "label": "ICON CONSISTENCY",
                "command": "Verify icon set consistency across the dashboard.",
                "icon": "Grid"
            },
            {
                "label": "LOAD STATE",
                "command": "Preview loading skeletons and spinner states.",
                "icon": "Loader"
            },
            {
                "label": "ERROR STATE",
                "command": "Preview critical error states and feedback messages.",
                "icon": "AlertTriangle"
            }
        ]
    },
    {
        "category": "Data & Memory",
        "prompts": [
            {
                "label": "MEMORY DUMP",
                "command": "Dump the last session's cognitive context to JSON.",
                "icon": "Download"
            },
            {
                "label": "CONTEXT PRUNE",
                "command": "Prune old conversation context to free up tokens.",
                "icon": "Scissors"
            },
            {
                "label": "VECTOR SYNC",
                "command": "Synchronize vector embeddings with the latest content.",
                "icon": "RefreshCcw"
            },
            {
                "label": "KNOWLEDGE GRAPH",
                "command": "Rebuild the knowledge graph from active documents.",
                "icon": "Share2"
            },
            {
                "label": "DATA EXPORT",
                "command": "Export all user data to a portable format.",
                "icon": "File"
            },
            {
                "label": "CACHE WARM",
                "command": "Warm up the cache for frequently accessed data.",
                "icon": "Flame"
            },
            {
                "label": "SCHEMA VALIDATE",
                "command": "Validate JSON schemas against current data.",
                "icon": "CheckSquare"
            },
            {
                "label": "PII SCAN",
                "command": "Scan memory for accidental PII retention.",
                "icon": "EyeOff"
            },
            {
                "label": "LOG ROTATE",
                "command": "Force rotation of system logs.",
                "icon": "RotateCw"
            },
            {
                "label": "STORAGE OPTIMIZE",
                "command": "Run storage optimization routines.",
                "icon": "Database"
            }
        ]
    },
    {
        "category": "Security & Defense",
        "prompts": [
            {
                "label": "RED TEAM SCAN",
                "command": "Simulate a Red Team attack on the authentication endpoints.",
                "icon": "Crosshair"
            },
            {
                "label": "TOKEN REVOKE",
                "command": "Revoke all active access tokens immediately.",
                "icon": "XOctagon"
            },
            {
                "label": "IP BLOCK",
                "command": "Block generic malicious IP ranges.",
                "icon": "Slash"
            },
            {
                "label": "INJECTION TEST",
                "command": "Test input fields for SQL/Prompt injection vulnerabilities.",
                "icon": "Terminal"
            },
            {
                "label": "RATE LIMIT",
                "command": "Test rate limiting thresholds.",
                "icon": "Watch"
            },
            {
                "label": "SESSION KILL",
                "command": "Terminate all active user sessions.",
                "icon": "LogOut"
            },
            {
                "label": "AUDIT LOGS",
                "command": "Tail the security audit log.",
                "icon": "List"
            },
            {
                "label": "DEPENDENCY AUDIT",
                "command": "Deep audit of npm/pip dependencies.",
                "icon": "Package"
            },
            {
                "label": "HONEYPOT",
                "command": "Deploy a honeypot endpoint to detect scrapers.",
                "icon": "Target"
            },
            {
                "label": "ZERO TRUST",
                "command": "Verify Zero Trust verification logic.",
                "icon": "Shield"
            }
        ]
    },
    {
        "category": "Strategy & Metacognition",
        "prompts": [
            {
                "label": "SWOT ANALYSIS",
                "command": "Perform a SWOT analysis on the current project trajectory.",
                "icon": "Grid"
            },
            {
                "label": "PRE-MORTEM",
                "command": "Conduct a Pre-Mortem: Assume failure and explain why.",
                "icon": "Skull"
            },
            {
                "label": "FIRST PRINCIPLES",
                "command": "Break down the current challenge to first principles.",
                "icon": "Minimize2"
            },
            {
                "label": "OPPORTUNITY COST",
                "command": "Analyze the opportunity cost of the current task.",
                "icon": "DollarSign"
            },
            {
                "label": "BLUE OCEAN",
                "command": "Identify 'Blue Ocean' opportunities in the current market.",
                "icon": "Compass"
            },
            {
                "label": "SCENARIO PLAN",
                "command": "Generate 3 future scenarios for the project (Best, Worst, Weird).",
                "icon": "Briefcase"
            },
            {
                "label": "KPI REVIEW",
                "command": "Review current KPIs against the North Star metric.",
                "icon": "BarChart"
            },
            {
                "label": "COMPETITOR SCAN",
                "command": "Scan for competitor updates or moves.",
                "icon": "Radar"
            },
            {
                "label": "RESOURCE ALLOC",
                "command": "Optimize resource allocation for the next sprint.",
                "icon": "PieChart"
            },
            {
                "label": "Pivot Check",
                "command": "Evaluate if a strategic pivot is designated.",
                "icon": "Shuffle"
            }
        ]
    },
    {
        "category": "DevOps & Deploy",
        "prompts": [
            {
                "label": "CI/CD STATUS",
                "command": "Check the status of the latest CI/CD pipeline.",
                "icon": "GitMerge"
            },
            {
                "label": "ENVIRONMENT SYNC",
                "command": "Verify consistency between Dev and Prod environments.",
                "icon": "Copy"
            },
            {
                "label": "DOCKER PRUNE",
                "command": "Prune unused Docker images and containers.",
                "icon": "Trash"
            },
            {
                "label": "ROLLBACK PREP",
                "command": "Prepare a rollback strategy for the next deployment.",
                "icon": "Rewind"
            },
            {
                "label": "FEATURE FLAG",
                "command": "List active feature flags and their status.",
                "icon": "Flag"
            },
            {
                "label": "PERF BENCHMARK",
                "command": "Run a standard performance benchmark suite.",
                "icon": "Stopwatch"
            },
            {
                "label": "SERVER LOAD",
                "command": "Check server load averages.",
                "icon": "Server"
            },
            {
                "label": "MEMORY LEAK",
                "command": "Scan for potential memory leaks in the running app.",
                "icon": "Droplet"
            },
            {
                "label": "CONFIG DIFF",
                "command": "Show diff between current config and default config.",
                "icon": "FileText"
            },
            {
                "label": "UPTIME REPORT",
                "command": "Generate a 30-day uptime report.",
                "icon": "Calendar"
            }
        ]
    },
    {
        "category": "Experimental",
        "prompts": [
            {
                "label": "DREAM MODE",
                "command": "Activate 'Dream Mode': Generate random creative associations.",
                "icon": "Cloud"
            },
            {
                "label": "CHAOS MONKEY",
                "command": "Simulate random minor failures to test resilience.",
                "icon": "Zap"
            },
            {
                "label": "POETRY GEN",
                "command": "Write a haiku about the current system status.",
                "icon": "Feather"
            },
            {
                "label": "SYNTHESIZER",
                "command": "Synthesize a new soundscape based on server metrics.",
                "icon": "Music"
            },
            {
                "label": "GLITCH ART",
                "command": "Generate glitch art from the current error logs.",
                "icon": "Image"
            },
            {
                "label": "OBSLIQUE STRATEGY",
                "command": "Draw an Oblique Strategy card for inspiration.",
                "icon": "CreditCard"
            },
            {
                "label": "FUTURE NEWS",
                "command": "Write a news headline from the year 2030 about this project.",
                "icon": "Radio"
            },
            {
                "label": "ROLEPLAY",
                "command": "Assume the persona of a 1980s cyberpunk hacker.",
                "icon": "Terminal"
            },
            {
                "label": "ZEN KOAN",
                "command": "Generate a Zen Koan for debugging.",
                "icon": "Sunrise"
            },
            {
                "label": "Q&A SIM",
                "command": "Simulate a Q&A session with the project's future self.",
                "icon": "MessageCircle"
            }
        ]
    }
]## Batch 5: Research & AI/ML Ops
*(Refer to system_prompts.py for full text)*
## Batch 6: Brand Protocol (Site Specific)
*(Refer to system_prompts.py for full text)*
## Batch 7: Agent Manager & Swarm Coordination
*(Refer to system_prompts.py and  for implementation details)*
