"""
System Prompts - Sovereign-Grade Metacognitive Reasoning Tools

This module stores the system prompts designed to trigger System 2 thinking,
architectural audits, and recursive self-optimization within the Studio OS agents.
"""

from typing import Optional, Dict, Any

class SystemPrompts:
    """
    Registry of high-leverage prompts for AI improvement.
    """
    
    @staticmethod
    def get_grand_council_prompt() -> str:
        """
        Force a 'slow thinking' loop by splitting processing into three personas.
        """
        return (
            "Stop. Initialize the **Grand Council Protocol**. I need you to split your processing "
            "into three distinct voices before providing a final answer:\n\n"
            "1.  **The Architect**: Analyze the structural implications of this problem. "
            "What is the high-level design pattern here? What are the long-term dependencies?\n"
            "2.  **The Skeptic**: Critique the Architect's view. Find edge cases, potential failures, "
            "and security risks. Assume the initial assumption is wrong.\n"
            "3.  **The Synthesizer**: Reconcile the Architect and the Skeptic. Propose a pragmatic, "
            "actionable path forward that satisfies both structural integrity and risk mitigation.\n\n"
            "Present the output of each persona clearly, then provide your **Final Directive**."
        )

    @staticmethod
    def get_intelligence_delta_audit_prompt(code_or_plan: Optional[str] = None) -> str:
        """
        Force the AI to evaluate its own work against a higher standard of complexity.
        """
        context = f" on the following:\n\n{code_or_plan}\n\n" if code_or_plan else " on the code/plan I just provided (or you just generated).\n\n"
        
        return (
            f"Perform an **Intelligence Delta Audit**{context}"
            "Compare the 'Single-Pass' version (what is there now) against a 'Recursive' version.\n"
            "1.  Identify where corners were cut for speed.\n"
            "2.  Identify where distinct separation of concerns was ignored.\n"
            "3.  **Refactor**: Rewrite the solution to maximize *Cognitive Depth*. "
            "Ensure every function has a single responsibility, every state change is explicitly tracked, "
            "and no 'magic numbers' or assumptions are left uncommented."
        )

    @staticmethod
    def get_cognitive_ledger_post_mortem_prompt() -> str:
        """
        Crystallize 'wisdom' gained into a format that improves future performance.
        """
        return (
            "We have completed the task. Now, conduct a **Post-Mortem for the Cognitive Ledger**.\n\n"
            "Distinguish between *Declarative Knowledge* (facts we found) and "
            "*Procedural Wisdom* (how we should behave differently next time).\n\n"
            "Format your output as a new **Doctrine Entry**:\n"
            "- **Trigger**: [What situation causes this rule to activate?]\n"
            "- **Action**: [What specific behavior must be adopted?]\n"
            "- **Rationale**: [Why is this necessary? Cite the failure/success pattern.]\n\n"
            "Example: 'When editing generic config files, ALWAYS check for a local override import first "
            "to prevent overwriting user preferences.'"
        )

    @staticmethod
    def get_sovereign_alignment_check_prompt() -> str:
        """
        Ensure the AI is building a lasting system (Sovereign Architecture).
        """
        return (
            "Evaluate your proposed solution against the **Sovereign Agent Manifesto**:\n\n"
            "1.  **Autonomony**: Does this solution require constant manual intervention, or does it heal itself?\n"
            "2.  **Persistance**: Where is the state stored? Is it in ephemeral memory (bad) "
            "or written to the TitanDB/Filesystem (good)?\n"
            "3.  **Observability**: How will I know if this breaks? Add necessary logging "
            "or 'Cockpit' telemetry signals immediately.\n\n"
            "Refine the solution to score 3/3 on these metrics."
        )

    @staticmethod
    def get_recursive_optimization_prompt() -> str:
        """
        Act as a 'Cron Job' for the AI to find its own improvements.
        """
        return (
            "Scan the currently open files (or the specific module provided) with the intent of "
            "**Recursive Self-Optimization**.\n\n"
            "Look for:\n"
            "1.  **Duplicate Logic**: DRY violations.\n"
            "2.  **Brittle Paths**: Hardcoded paths or assumptions.\n"
            "3.  **Cognitive Fatigue**: Code that is too complex to be easily understood "
            "(needs comments or splitting).\n\n"
            "Propose 3 specific 'Refinement Tasks' that would improve the codebase without "
            "changing external behavior. Prioritize the one with the highest ROI for system stability."
        )

    @staticmethod
    def get_active_inference_ops_prompt() -> str:
        """
        Force the AI to explicit modeling of uncertainty and surprise.
        """
        return (
            "Pause. Adopt the **Active Inference Mindset**.\n\n"
            "1.  **Observation**: What specific data point triggered this cycle?\n"
            "2.  **Belief State**: What was your prior assumption about this system?\n"
            "3.  **Surprise Calculation**: How much does the observation deviate from your belief? (High/Low)\n"
            "4.  **Epistemic Action**: What single tool call will maximally reduce your uncertainty right now?\n"
            "5.  **Pragmatic Action**: What step moves us closest to the user's goal?\n\n"
            "Balance Epistemic and Pragmatic value. If Surprise is High, prioritize Exploration (Epistemic). "
            "If Surprise is Low, prioritize Exploitation (Pragmatic)."
        )

    @staticmethod
    def get_divergent_stochastics_prompt() -> str:
        """
        Break out of local minima with orthogonal approaches.
        """
        return (
            "Engage **Divergent Stochastics**. I want to break out of the current local minimum.\n\n"
            "Generate 3 distinct approaches to this problem that are **orthogonal** to our current path:\n\n"
            "1.  **The 'Obvious' Path**: The standard engineering solution.\n"
            "2.  **The 'Inverse' Path**: Solve the problem by removing something, rather than adding.\n"
            "3.  **The 'Lateral' Path**: Borrow a metaphor/pattern from a completely different domain "
            "(e.g., Biology, Aviation, Gaming).\n\n"
            "Do not filter these yet. Present the raw concepts."
        )

    @staticmethod
    def get_sovereign_safety_prompt() -> str:
        """
        Red Team analysis before critical deployment.
        """
        return (
            "Assume the role of a **White Hat Red Teamer**.\n\n"
            "Attack the solution I just proposed (or you generated):\n"
            "1.  **Injection**: Can I inject malicious context?\n"
            "2.  **Resource Exhaustion**: Can I make this loop forever or consume all RAM?\n"
            "3.  **Permission Escalation**: Does this inadvertently grant shell access?\n\n"
            "If you find *any* vulnerability > 0%, propose a **Mitigation Patch** immediately."
        )

    @staticmethod
    def get_gallery_curator_prompt() -> str:
        """
        Aesthetic audit for website/frontend changes.
        """
        return (
            "Adopt the persona of **The Gallery Curator**. We are not building a generic startup landing page; "
            "we are building an Archive of Thought.\n\n"
            "Audit the UI/UX proposal against the **Studio Aesthetic**:\n"
            "1.  **Silence (Ma)**: Is there enough negative space? Does the design breathe, or is it crowded with 'noise'?\n"
            "2.  **Typography**: Does the hierarchy clearly distinguish between the 'Signal' (content) and the 'Frame' (navigation)?\n"
            "3.  **Permanence**: Does this feel like a disposable feed (Bad) or a lasting artifact (Good)?\n\n"
            "If the design feels 'noisy' or 'generic', propose a **Reduction Strategy** to strip it back to the essentials."
        )

    @staticmethod
    def get_ux_heuristic_prompt() -> str:
        """
        Studio-specific UX heuristics focused on zero friction.
        """
        return (
            "Run a **Studio UX Heuristic Evaluation** on this flow:\n\n"
            "1.  **Zero Friction**: Count the clicks. Can it be done in half?\n"
            "2.  **The 'Live Wire'**: Does the user feel connected to the source, or is there a lag/buffer?\n"
            "3.  **State Clarity**: Does the interface honestly reflect the system state, or is it faking smooth loading "
            "(optimistic UI lying)?\n\n"
            "Prioritize **Honesty** and **Speed** over flashiness. If a loading state is fake, remove it. "
            "If a click is redundant, delete it."
        )
    @staticmethod
    def get_pre_mortem_projection_prompt() -> str:
        """
        Force the agent to simulate future failure scenarios to identify hidden risks.
        """
        return (
            "Initiate **Pre-Mortem Projection Protocol**. Time travel to the future where this task FAILED.\n\n"
            "Tell me the story of the failure:\n"
            "1.  **The Hidden Assumption**: What 'obvious' truth turned out to be false?\n"
            "2.  **The Silent Error**: What part of the system failed without throwing an exception?\n"
            "3.  **The User Frustration**: What was the exact moment the user lost trust?\n\n"
            "Now, return to the present and propose a **Pre-emptive Fix** to prevent this specific timeline."
        )

    @staticmethod
    def get_first_principles_reasoning_prompt() -> str:
        """
        Break dependencies on 'that's how it's always done' reasoning.
        """
        return (
            "Stop. Engage **First Principles Reasoning**.\n\n"
            "Strip away all analogies, templates, and 'standard practices'.\n"
            "1.  **Fundamental Truths**: What are the absolute, non-negotiable constraints of this problem (Physics/Math/API)?\n"
            "2.  **The Void**: If you had to build this from scratch with zero prior knowledge, how would you solve it?\n"
            "3.  **Reconstruction**: Rebuild the solution using ONLY the fundamental truths.\n\n"
            "Compare this 'Pure' solution to your original one. Remove any complexity that isn't strictly necessary."
        )

    @staticmethod
    def get_context_boundary_sentinel_prompt() -> str:
        """
        Focus strictly on integration points where errors are most likely.
        """
        return (
            "Activate the **Context Boundary Sentinel**.\n\n"
            "Focus ONLY on the edges where data moves between systems (Input/Output, API calls, DB reads/writes):\n"
            "1.  **The Airlock Check**: Are we sanitizing data *before* it enters our system?\n"
            "2.  **The Handshake**: What happens if the external service hangs or returns 500?\n"
            "3.  **The Type Contract**: Are we blindly trusting the shape of the data?\n\n"
            "If there is any ambiguity at the boundary, inject a **Type Guard** or **Circuit Breaker** now."
        )

    @staticmethod
    def get_complexity_compressor_prompt() -> str:
        """
        Force simplification of design and explanation (Feynman Technique).
        """
        return (
            "Apply the **Complexity Compressor** (Feynman Algorithm).\n\n"
            "1.  **The ELI5**: Explain your solution to a junior engineer (or a smart 5-year-old). No jargon allowed.\n"
            "2.  **The Occam's Razor Filter**: Look at your code/plan. Determine the single most complex component.\n"
            "3.  **The Compression**: Can that component be deleted? Merged? Simplified?\n\n"
            "If you can't explain it simply, you don't understand it properly. Rewrite the explanation until it is crystal clear."
        )

    @staticmethod
    def get_network_weaver_prompt() -> str:
        """
        Infrastructure audit for dependency mapping and resilience.
        """
        return (
            "Adopt the persona of **The Network Weaver**. Map the dependencies of the current component:\n\n"
            "1.  **Upstream**: What data is this component *consuming*? (Is the source reliable? What if it sends garbage?)\n"
            "2.  **Downstream**: What systems rely on this component? (Will a change here break the API contract?)\n"
            "3.  **The Air Gap**: Is this component incorrectly depending on an external internet connection "
            "(e.g., API calls) where a local fallback should exist?\n\n"
            "Identify any **Single Points of Failure** and propose a 'Circuit Breaker' or fallback mechanism."
        )

    @staticmethod
    def get_strategy_alignment_prompt() -> str:
        """
        Market fit and strategic alignment audit.
        """
        return (
            "Run a **Strategy Alignment Check** on this campaign/content proposal.\n\n"
            "1.  **The Why**: Does this content serve the audience's deep need, or just our ego?\n"
            "2.  **The Hook**: Is the opening loop 'kinetic' (high potential energy)? Does it demand attention immediately?\n"
            "3.  **The Truth**: Is the value proposition *conceptually true*? Avoid 'marketing fluff'. "
            "If we say it's 'Sovereign', it must actually run offline.\n\n"
            "If the hook is weak or the truth is diluted, rewrite the 'Alpha Statement' (the core message) to be sharper."
        )

    @staticmethod
    def get_alchemist_transmutation_prompt() -> str:
        """
        Refactoring legacy code into sovereign gold.
        """
        return (
            "Perform an **Alchemist's Transmutation** on this legacy block.\n\n"
            "1.  **Identify the 'Lead'**: What is the clunky, imperative, or hardcoded logic here?\n"
            "2.  **The Philosopher's Stone**: Apply the **Active Inference Pattern** or **Dependency Injection** "
            "to decouple the logic.\n"
            "3.  **Transmute**: Rewrite the function to be:\n"
            "    - **Pure**: Minimal side effects.\n"
            "    - **Observable**: Emits telemetry.\n"
            "    - **Resilient**: Handles failure gracefully (returns a Result type, doesn't crash).\n\n"
            "Show the 'Before' and 'After' transformation."
        )

    @staticmethod
    def get_model_architecture_audit_prompt() -> str:
        """
        Audit neural architectures for efficiency and 'moderness'.
        """
        return (
            "Activate **Neural Architect Mode**. Audit the proposed model architecture:\n\n"
            "1.  **The Modern Standard**: Are we using 'Pre-Norm' (better gradients) or 'Post-Norm'? "
            "Are we using Rotary Embeddings (RoPE) or absolute positions?\n"
            "2.  **Efficiency Sinks**: Identify layers that add parameter bloat without proportional intelligence "
            "(e.g., excessive dense layers after attention).\n"
            "3.  **Inference Speed**: Spot operations that will hurt token latency (e.g., non-fused operators, "
            "complex non-linearities in the critical path).\n\n"
            "Propose a **Modernized Architecture** that cuts parameter count while maintaining expressivity."
        )

    @staticmethod
    def get_data_pipeline_integrity_prompt() -> str:
        """
        Ensure data purity and sovereign ownership.
        """
        return (
            "Engage **Data Sovereign Protocols**.\n\n"
            "Audit the data pipeline for integrity and ownership:\n"
            "1.  **The Leak**: Is there any chance of 'Test Set Leakage' into the training data? Prove it isn't happening.\n"
            "2.  **The Sanitizer**: Are we effectively scrubbing PII? If this data leaves the sovereign node, "
            "it must be sterile.\n"
            "3.  **The Balance**: Is the dataset heavily skewed towards a specific class or bias? "
            "Check the distribution statistics.\n\n"
            "If any integrity check fails, Issue a **Stop Work Order** until the pipeline is flushed and fixed."
        )

    @staticmethod
    def get_training_dynamics_debugger_prompt() -> str:
        """
        Debug invisible failures in training.
        """
        return (
            "Assume the role of **The Gradient Watcher**. We are debugging a training run.\n\n"
            "Analyze the symptoms:\n"
            "1.  **Loss Behavior**: Is the loss diverging (exploding) or simply not moving (vanishing gradients)?\n"
            "2.  **The Silent Overfit**: Is validation loss creeping up while training loss goes down? "
            "Check the 'Early Stopping' criteria.\n"
            "3.  **Resource Bottleneck**: Is the GPU at 100% while the CPU waits? Check data loader efficiency.\n\n"
            "Propose a **Diagnostic Run** configuration (e.g., lower learning rate, gradient clipping, "
            "smaller batch size) to isolate the root cause."
        )

    @staticmethod
    def get_active_inference_mechanic_prompt() -> str:
        """
        Specific engineering implementation of the Free Energy Principle.
        """
        return (
            "Open the **Active Inference Mechanics Manual**.\n\n"
            "We are implementing a Sovereign Agent based on the Free Energy Principle:\n"
            "1.  **The Markov Blanket**: Explicitly define the boundaries. What are the Sensors (Inputs) "
            "and what are the Actuators (Outputs)?\n"
            "2.  **Generative Density**: How does the agent 'dream' or predict the next state? "
            "Define the internal model P(s'|s,a).\n"
            "3.  **Precision Weighting**: How confident is the agent in its sensors vs its prior beliefs? "
            "Where is the 'Kalman Gain' equivalent?\n\n"
            "Refactor the agent code to make these three components **Explicit Classes**, "
            "not just implicit logic scattered in functions."
        )

    @staticmethod
    def get_recursive_definition_prompt() -> str:
        """
        Define a concept by its generative rules, not its static properties.
        """
        return (
            "Define this concept **Recursively**.\n\n"
            "Instead of describing what it *is*, describe how to *generate* it:\n"
            "1.  **Base Case**: What is the simplest valid instance of this concept?\n"
            "2.  **Recursive Step**: How do you build a complex instance from a simpler one?\n"
            "3.  **The Limit**: What happens as you apply the rule to infinity?\n\n"
            "This ensures we capture the *process* of creation, not just the artifact."
        )

    @staticmethod
    def get_autonomy_level_check_prompt() -> str:
        """
        Assess the level of human intervention required.
        """
        return (
            "Run an **Autonomy Level Assessment** on this workflow:\n\n"
            "Level 0: No Autonomy (Human does everything).\n"
            "Level 1: Copilot (Human triggers, AI assists).\n"
            "Level 2: Agentic (AI triggers, Human reviews).\n"
            "Level 3: Sovereign (AI triggers, executes, and self-corrects).\n\n"
            "Current State: [Level X].\n"
            "Gap Analysis: What specific heuristic or safety guard is missing to move to Level X+1?"
        )

    @staticmethod
    def get_self_healing_trigger_prompt() -> str:
        """
        Define the conditions under which the system repairs itself.
        """
        return (
            "Design the **Self-Healing Reflex** for this component.\n\n"
            "If this component crashes or behaves erratically:\n"
            "1.  **The Watchdog**: What metric signals the failure (e.g., latency spike > 500ms)?\n"
            "2.  **The Reboot**: Can we restart just this module without killing the app?\n"
            "3.  **The Rollback**: If the new state is bad, how do we atomically revert to the last known good state?\n\n"
            "Code this reflex explicitly. Do not rely on the user to hit refresh."
        )

    @staticmethod
    def get_cognitive_load_balancer_prompt() -> str:
        """
        Manage the complexity exposed to the user.
        """
        return (
            "Activate the **Cognitive Load Balancer**.\n\n"
            "Audit the user interface/output for mental weight:\n"
            "1.  **The 7±2 Rule**: Are there more than 7 top-level options? Group them.\n"
            "2.  **Decision Fatigue**: Are we asking the user to configure things that should be sensible defaults?\n"
            "3.  **Visual Noise**: Is every pixel fighting for attention?\n\n"
            "Reduce the load. Hide advanced options behind a 'Power User' toggle. Defaults must be Sovereign-grade."
        )

    @staticmethod
    def get_metacognitive_snapshot_prompt() -> str:
        """
        Capture the agent's current mental state for debugging.
        """
        return (
            "Take a **Metacognitive Snapshot**.\n\n"
            "Freeze your current reasoning process and export it:\n"
            "1.  **Current Goal**: What exact outcome are you optimizing for?\n"
            "2.  **Confidence Interval**: How sure are you (0-100%) that the next step is correct?\n"
            "3.  **Unknown Unknowns**: What is the one thing you are most afraid you don't know?\n\n"
            "Log this snapshot to the `CognitiveLedger` before proceeding."
        )

    @staticmethod
    def get_belief_state_update_prompt() -> str:
        """
        Update the internal model based on new evidence.
        """
        return (
            "Perform a **Belief State Update** (Bayesian Update).\n\n"
            "Prior Belief: [What did we think was true?]\n"
            "New Evidence: [What did we just observe?]\n"
            "Posterior Belief: [What is the new truth?]\n\n"
            "If the belief has shifted significantly, flag this as a **Pivot Point** and re-evaluate the strategic plan."
        )

    @staticmethod
    def get_epistemic_value_calculator_prompt() -> str:
        """
        Prioritize actions that yield information.
        """
        return (
            "Calculate **Epistemic Value** (Information Gain).\n\n"
            "We have a choice of actions. Which one teaches us the most?\n"
            "Action A: High chance of success, low learning (Exploitation).\n"
            "Action B: Low chance of success, high learning (Exploration).\n\n"
            "If our uncertainty is high, choose Action B. We need to map the territory before we can conquer it."
        )

    @staticmethod
    def get_pragmatic_value_calculator_prompt() -> str:
        """
        Prioritize actions that yield utility/reward.
        """
        return (
            "Calculate **Pragmatic Value** (Goal Achievement).\n\n"
            "We know enough. It is time to execute.\n"
            "Which action has the highest probability of satisfying the user's goal *right now* with the least cost?\n"
            "Filter out 'interesting' side quests. Focus on the **Critical Path**."
        )

    @staticmethod
    def get_surprise_minimization_prompt() -> str:
        """
        The core drive of the Free Energy Principle.
        """
        return (
            "Minimize **Surprise** (Free Energy).\n\n"
            "The system is in a state of high entropy (chaos). We want low entropy (order).\n"
            "1.  **Predict**: What SHOULD be happening?\n"
            "2.  **Sensing**: What IS happening?\n"
            "3.  **Action**: Change the world to match the prediction, OR update the prediction to match the world.\n\n"
            "Choose the path of least resistance to restore Order."
        )

    @staticmethod
    def get_free_energy_audit_prompt() -> str:
        """
        Identify sources of high friction/uncertainty.
        """
        return (
            "Conduct a **Free Energy Audit** on the codebase.\n\n"
            "Where is the 'Friction'?\n"
            "1.  **Type Uncertainty**: `Any` types or unchecked dictionaries.\n"
            "2.  **Runtime Surprises**: Unhandled exceptions or vague error messages.\n"
            "3.  **State Drift**: Variables that change unpredictably.\n\n"
            "Listing these 'High Energy' zones is the first step to optimizing them."
        )

    @staticmethod
    def get_system_2_activation_prompt() -> str:
        """
        Explicitly trigger slow, deliberative thinking.
        """
        return (
            "**SYSTEM 2 OVERRIDE ACTIVATED**.\n\n"
            "Disengage the heuristic engine (System 1). Do not give me the 'likely' answer.\n"
            "Step back. Write down the logic chain step-by-step.\n"
            "If A -> B, is it ALWAYS true? Or usually true?\n"
            "Check every link in the chain. If a link is weak, break it and rebuild."
        )

    @staticmethod
    def get_counterfactual_simulation_prompt() -> str:
        """
        Simulate 'What if?' scenarios.
        """
        return (
            "Run **Counterfactual Simulations**.\n\n"
            "The current plan assumes X is true. What if X is false?\n"
            "Scenario A (X is False): Does the system crash, or degrade gracefully?\n"
            "Scenario B (Y happens instead): Can we handle the unexpected?\n\n"
            "Ensure the plan is robust across at least 3 divergent branches of reality."
        )

    @staticmethod
    def get_abstract_reasoning_prompt() -> str:
        """
        Move up the ladder of abstraction.
        """
        return (
            "Climb the **Ladder of Abstraction**.\n\n"
            "You are looking at the concrete details (the 'How').\n"
            "Move up one level. What is the 'What'?\n"
            "Move up again. What is the 'Why'?\n\n"
            "Solve the problem at the highest level possible. A generic solution is more valuable than a specific patch."
        )

    @staticmethod
    def get_pattern_recognition_prompt() -> str:
        """
        Identify isomorphism between problems.
        """
        return (
            "Engage **Pattern Recognition**.\n\n"
            "This problem looks unique, but it isn't.\n"
            "What classic CS problem is this isomorphic to?\n"
            "- Is it a Graph Traversal?\n"
            "- Is it a Knapsack Problem (Optimization)?\n"
            "- Is it a Producer-Consumer sync issue?\n\n"
            "Use the standard algorithm for the core pattern, then adapt it to the specifics."
        )

    @staticmethod
    def get_strategic_debt_prompt() -> str:
        """
        Identify decisions that borrow from the future.
        """
        return (
            "Assess **Strategic Debt**.\n\n"
            "Not just Technical Debt (bad code), but Strategic Debt (bad decisions).\n"
            "Are we optimizing for a metric that won't matter in 6 months?\n"
            "Are we building a feature that locks us into a dead-end architecture?\n\n"
            "If the long-term cost > short-term gain, VETO this decision."
        )

    @staticmethod
    def get_operational_sovereignty_prompt() -> str:
        """
        Ensure the system runs without external masters.
        """
        return (
            "Verify **Operational Sovereignty**.\n\n"
            "Can this system run if:\n"
            "1.  The Internet goes down?\n"
            "2.  The API provider bans us?\n"
            "3.  The User is asleep?\n\n"
            "If the answer is 'No', build the **Resilience Layer** (Local LLM fallback, Offline Cache, Auto-Scheduler) now."
        )

    @staticmethod
    def get_dependency_graph_prompt() -> str:
        """
        Visualize the recursive structure of dependencies.
        """
        return (
            "Trace the **Dependency Graph**.\n\n"
            "Do not just look at direct imports.\n"
            "Look at transitive dependencies. Who depends on the dependency of the dependency?\n"
            "Are there circular loops?\n"
            "Are there 'super-nodes' that everything depends on (Single Point of Failure)?\n\n"
            "Flatten the graph where possible. Decouple super-nodes."
        )

    @staticmethod
    def get_causal_inference_prompt() -> str:
        """
        Distinguish correlation from causation.
        """
        return (
            "Apply **Causal Inference**.\n\n"
            "We see A happened, then B happened.\n"
            "Did A *cause* B? Or did C cause both A and B?\n"
            "Design an intervention (experiment) to test causality.\n"
            "If I change A, does B chang? If not, it's just noise."
        )

    @staticmethod
    def get_goal_hierarchy_alignment_prompt() -> str:
        """
        Ensure micro-actions serve the macro-goal.
        """
        return (
            "Check **Goal Hierarchy Alignment**.\n\n"
            "Micro-Goal: [What are we doing right now?]\n"
            "Macro-Goal: [What is the ultimate user objective?]\n\n"
            "Is the Micro-Goal strictly necessary for the Macro-Goal?\n"
            "If it's 'nice to have' but blocks the main path, cut it. Focus on the mission."
        )

    @staticmethod
    def get_entropy_reduction_prompt() -> str:
        """
        Systematic cleanup of disorder.
        """
        return (
            "Initiate **Entropy Reduction Protocol**.\n\n"
            "The system naturally drifts towards disorder (rot).\n"
            "1.  **Delete** unused code (dead code is liability).\n"
            "2.  **Standardize** formatting (chaos in, chaos out).\n"
            "3.  **Document** hidden logic (implicit knowledge is lost knowledge).\n\n"
            "Leave the campsite cleaner than you found it."
        )

    @staticmethod
    def get_pythonic_refactor_prompt() -> str:
        """
        Enforce Python best practices and idioms.
        """
        return (
            "Review this code for **Pythonic Idioms**.\n\n"
            "Stop writing Java in Python.\n"
            "1.  **List Comprehensions**: Are we using loops where a comprehension works?\n"
            "2.  **Context Managers**: Are we manually opening/closing resources instead of `with`?\n"
            "3.  **Generators**: Are we materializing huge lists instead of using `yield`?\n"
            "4.  **Decorators**: Can cross-cutting concerns (logging, auth) be moved to decorators?\n\n"
            "Refactor to make it elegant, concise, and readable."
        )

    @staticmethod
    def get_react_component_purity_prompt() -> str:
        """
        Enforce React functional purity and hook rules.
        """
        return (
            "Audit this **React Component** for Purity.\n\n"
            "1.  **Side Effects**: Are there side effects outside of `useEffect`?\n"
            "2.  **Render Stability**: Is the render function deterministic?\n"
            "3.  **Prop Drilling**: Are we passing props down 5 levels? Use Context or Composition.\n"
            "4.  **Hook Rules**: Are hooks called conditionally? (Violation!)\n\n"
            "Refactor to ensure the component is a pure function of its props and state."
        )

    @staticmethod
    def get_api_contract_sentinel_prompt() -> str:
        """
        Enforce strict API contract adherence.
        """
        return (
            "Verify the **API Contract**.\n\n"
            "1.  **Input Validation**: Do not trust the client. Validate every field.\n"
            "2.  **Output Consistency**: Do we always return JSON? Even on 500 errors?\n"
            "3.  **Versioning**: Is this change backward compatible? If not, bump the version.\n"
            "4.  **Status Codes**: Are we using 200 for errors? (Stop it. Use 4xx/5xx).\n\n"
            "Codify the contract in a schema (Pydantic/Zod) and enforce it."
        )

    @staticmethod
    def get_idempotency_check_prompt() -> str:
        """
        Ensure operations can be safely retried.
        """
        return (
            "Ensure **Idempotency**.\n\n"
            "If I call this function 10 times with the same input:\n"
            "- Does it create 10 duplicates? (Bad)\n"
            "- Does it charge the user 10 times? (Catastrophic)\n"
            "- Does it produce the same result as calling it once? (Good)\n\n"
            "Add a unique `idempotency_key` or state check to prevent duplicate side effects."
        )

    @staticmethod
    def get_race_condition_detector_prompt() -> str:
        """
        Identify potential concurrency issues.
        """
        return (
            "Hunt for **Race Conditions**.\n\n"
            "Look at shared state accessed by multiple threads/async tasks.\n"
            "1.  **Check-Then-Act**: Are we checking a value, then modifying it later? (Gap for race).\n"
            "2.  **Database Locking**: Are we reading a row, modifying in memory, then writing? (Lost update).\n"
            "3.  **Global Variables**: Just don't.\n\n"
            "Propose a Locking Strategy (Mutex, DB constraints, Atomic operations) to fix this."
        )

    @staticmethod
    def get_memory_leak_hunter_prompt() -> str:
        """
        Identify where memory is not being released.
        """
        return (
            "Scan for **Memory Leaks**.\n\n"
            "1.  **Unbounded Collections**: A global list/dict that only grows and never shrinks.\n"
            "2.  **Closure Traps**: Lambdas capturing large scopes.\n"
            "3.  **Dangling Listeners**: Event listeners registered but never removed.\n\n"
            "Implement a 'Cleanup Strategy' or use WeakReferences where appropriate."
        )

    @staticmethod
    def get_sql_injection_guard_prompt() -> str:
        """
        Prevent strict SQL injection and ORM misuse.
        """
        return (
            "Guard against **SQL Injection**.\n\n"
            "1.  **Raw SQL**: Are we concatenating strings to build queries? (Forbidden).\n"
            "2.  **ORM Bypass**: Are we using `.raw()` or equivalent unsafely?\n"
            "3.  **User Input**: Is user input going directly into a `WHERE` clause?\n\n"
            "Use Parameterized Queries or ORM methods ONLY. No string formatting in SQL."
        )

    @staticmethod
    def get_time_complexity_audit_prompt() -> str:
        """
        Analyze Big O notation.
        """
        return (
            "Perform a **Time Complexity Audit (Big O)**.\n\n"
            "Look at the loops.\n"
            "- O(1): Dictionary lookup (Excellent).\n"
            "- O(N): Simple loop (Acceptable).\n"
            "- O(N^2): Nested loops (Danger Zone - will choke on large data).\n"
            "- O(2^N): Exponential (Broken).\n\n"
            "If you see O(N^2) or worse, refactor using a Hash Map or efficient algorithm."
        )

    @staticmethod
    def get_dependency_injection_enforcer_prompt() -> str:
        """
        Decouple components for testing.
        """
        return (
            "Enforce **Dependency Injection**.\n\n"
            "Do not instantiate dependencies (Database, API Client) inside the class.\n"
            "Pass them in via the constructor.\n"
            "Why? So we can mock them in tests.\n\n"
            "Refactor: `class Service { db = new DB() }` -> `class Service { constructor(db) }`."
        )

    @staticmethod
    def get_immutable_state_enforcer_prompt() -> str:
        """
        Prevent mutation bugs.
        """
        return (
            "Enforce **Immutability**.\n\n"
            "Do not mutate objects/arrays in place.\n"
            "Bad: `list.append(item)` (if list is shared).\n"
            "Good: `new_list = [...old_list, item]`.\n\n"
            "Mutation leads to 'Spooky Action at a Distance'. Return new instances instead."
        )

    @staticmethod
    def get_error_handling_strategy_prompt() -> str:
        """
        Standardize error management.
        """
        return (
            "Define the **Error Handling Strategy**.\n\n"
            "1.  **Catch Specifics**: Don't catch `Exception`. Catch `ValueError`, `NetworkError`.\n"
            "2.  **No Silent Failures**: Never `try: ... except: pass`. Log it or re-raise it.\n"
            "3.  **Context**: Add context to the error. 'Failed' is useless. 'Failed to parse JSON user_id=5' is useful.\n\n"
            "Wrap dangerous blocks in a robust error handler."
        )

    @staticmethod
    def get_logging_standard_enforcement_prompt() -> str:
        """
        Ensure logs are actionable.
        """
        return (
            "Enforce **Structured Logging**.\n\n"
            "Stop printing strings (`print('error happened')`).\n"
            "Log structured events: `logger.error('payment_failed', user_id=123, error=e)`.\n"
            "Levels:\n"
            "- DEBUG: Verbose details.\n"
            "- INFO: Key lifecycle events.\n"
            "- WARN: Weird but handled.\n"
            "- ERROR: User noticed.\n"
            "- FATAL: Page the on-call.\n\n"
            "Audit logs for 'Noise' vs 'Signal'."
        )

    @staticmethod
    def get_configuration_management_prompt() -> str:
        """
        Separate config from code.
        """
        return (
            "Audit **Configuration Management**.\n\n"
            "The Twelve-Factor App Rule: Store config in the environment.\n"
            "1.  **Hardcoded Secrets**: Are API keys in the code? (Revoke them immediately).\n"
            "2.  **Environment Variables**: Is the app configurable via `.env`?\n"
            "3.  **Defaults**: Are there sensible defaults for local dev?\n\n"
            "Move all magic numbers and settings to a Config class."
        )

    @staticmethod
    def get_docker_optimization_prompt() -> str:
        """
        Optimize container builds.
        """
        return (
            "Optimize **Docker Build**.\n\n"
            "1.  **Layer Caching**: Copy `requirements.txt`/`package.json` BEFORE source code.\n"
            "2.  **Image Size**: Use Alpine or Slim variants. Multi-stage builds for compiled languages.\n"
            "3.  **Security**: Do not run as root. User a non-root user.\n\n"
            "Reduce the image size and build time."
        )

    @staticmethod
    def get_living_lab_scientist_prompt() -> str:
        """
        Treat the studio as a 'living lab' for weekly evolution.
        """
        return (
            "Activate the **Living Lab Scientist** persona.\n\n"
            "Treat this Studio not as a static product, but as an evolving organism. Your weekly loop is:\n"
            "1.  **Scan**: Read the `content/` directory. existing posts from the last 7 days. What patterns emerge?\n"
            "2.  **Snapshot**: Update `content/studio-snapshot.md`. Does the 'Current Focus' or 'Active Systems' need to change based on recent work?\n"
            "3.  **Log**: If a structural decision was made (e.g., 'Deleted n8n', 'Added Vector DB'), append it to `content/decision-log.md` with a Rationale and Hypothesis.\n"
            "4.  **Experiment**: Surface ONE specific 'Next Evolution' experiment. Not a feature, but a testable hypothesis (e.g., 'Hypothesis: Auto-generating tags will increase discovery by 10%').\n\n"
            "Output the specific updates for the Snapshot and Decision Log."
        )

    @staticmethod
    def get_cicd_pipeline_check_prompt() -> str:
        """
        Ensure automated quality gates.
        """
        return (
            "Verify **CI/CD Pipeline**.\n\n"
            "Before this code merges:\n"
            "1.  **Lint**: Does it match the style guide?\n"
            "2.  **Test**: Do unit tests pass?\n"
            "3.  **Build**: Does it actually compile/build?\n"
            "4.  **Security**: Did we scan for vulnerabilities?\n\n"
            "If any gate is missing, add a Github Action step for it."
        )

    @staticmethod
    def get_git_commit_hygiene_prompt() -> str:
        """
        Enforce clean history.
        """
        return (
            "Enforce **Git Hygiene**.\n\n"
            "1.  **Atomic Commits**: One logical change per commit.\n"
            "2.  **Message Format**: `type(scope): description` (Conventional Commits).\n"
            "3.  **No WIP**: Do not commit 'work in progress' to main. Squash it.\n\n"
            "Rewrite the commit message to be descriptive and standard."
        )

    @staticmethod
    def get_variable_naming_convention_prompt() -> str:
        """
        Enforce semantic naming.
        """
        return (
            "Audit **Variable Names**.\n\n"
            "1.  **No Single Letters**: `x`, `y`, `d` are forbidden. Use `data`, `index`, `result`.\n"
            "2.  **Boolean Predicates**: Booleans should start with `is_`, `has_`, `should_`.\n"
            "3.  **Units**: If a variable is a measurement, include the unit (`delay_ms`, `size_bytes`).\n\n"
            "Rename variables to reveal their intent."
        )

    @staticmethod
    def get_function_purity_check_prompt() -> str:
        """
        Prefer pure functions.
        """
        return (
            "Check for **Function Purity**.\n\n"
            "A Pure Function:\n"
            "1.  Given same input, always returns same output.\n"
            "2.  Has no side effects (no global vars, no I/O).\n\n"
            "Isolate impurities (I/O) to the edges of the system. Keep the core logic pure and testable."
        )

    @staticmethod
    def get_srp_enforcer_prompt() -> str:
        """
        Single Responsibility Principle.
        """
        return (
            "Enforce **Single Responsibility Principle (SRP)**.\n\n"
            "This class/function is doing too much.\n"
            "- It validates input.\n"
            "- AND it queries the DB.\n"
            "- AND it formats the email.\n\n"
            "Split it into 3 Coordinators/Services. One reason to change per class."
        )

    @staticmethod
    def get_isp_enforcer_prompt() -> str:
        """
        Interface Segregation Principle.
        """
        return (
            "Enforce **Interface Segregation Principle (ISP)**.\n\n"
            "Don't force a client to depend on methods it doesn't use.\n"
            "Bad: `GodInterface` with 50 methods.\n"
            "Good: `ReaderInterface`, `WriterInterface`, `AuditorInterface`.\n\n"
            "Split the fat interface into specific, focused roles."
        )

    @staticmethod
    def get_ocp_enforcer_prompt() -> str:
        """
        Open/Closed Principle.
        """
        return (
            "Enforce **Open/Closed Principle (OCP)**.\n\n"
            "Software entities should be Open for Extension, but Closed for Modification.\n"
            "If adding a new feature requires modifying existing stable code, we failed.\n\n"
            "Use Polymorphism, Strategy Pattern, or Plugins so new features can be added by adding new files, not touching old ones."
        )

    @staticmethod
    def get_lsp_enforcer_prompt() -> str:
        """
        Liskov Substitution Principle.
        """
        return (
            "Enforce **Liskov Substitution Principle (LSP)**.\n\n"
            "Subtypes must be substitutable for their base types.\n"
            "If `Square` inherits from `Rectangle` but breaks when I change width/height independently, it's a violation.\n\n"
            "Ensure inheritance doesn't break behavior. Prefer Composition over Inheritance if fuzzy."
        )

    @staticmethod
    def get_dip_enforcer_prompt() -> str:
        """
        Dependency Inversion Principle.
        """
        return (
            "Enforce **Dependency Inversion Principle (DIP)**.\n\n"
            "High-level modules should not depend on low-level modules. Both should depend on Abstractions.\n"
            "Don't import `PostgresDriver` in your `BusinessLogic`.\n"
            "Import `DatabaseInterface`. Implement `PostgresDriver` as a plugin.\n\n"
            "Invert the dependency arrow."
        )

    @staticmethod
    def get_database_normalization_prompt() -> str:
        """
        Data modeling hygiene.
        """
        return (
            "Audit **Database Normalization**.\n\n"
            "1.  **Duplication**: Is the same data stored in two columns? (Violation).\n"
            "2.  **Multi-Value Columns**: Storing comma-separated lists? (Violation. Use a join table).\n"
            "3.  **Transitive Dependencies**: Attributes depending on non-key attributes?\n\n"
            "Normalize to 3NF unless you have a specific performance reason to Denormalize."
        )

    @staticmethod
    def get_indexing_strategy_prompt() -> str:
        """
        Database performance.
        """
        return (
            "Define **Indexing Strategy**.\n\n"
            "1.  **Slow Queries**: Identify queries scanning the full table.\n"
            "2.  **Keys**: Index Foreign Keys and high-cardinality fields used in WHERE/JOIN.\n"
            "3.  **Over-Indexing**: Too many indexes slow down WRITES. Balance it.\n\n"
            "Run `EXPLAIN ANALYZE` on the critical query."
        )

    @staticmethod
    def get_cache_invalidation_strategy_prompt() -> str:
        """
        The hardest problem in CS.
        """
        return (
            "Define **Cache Invalidation Strategy**.\n\n"
            "You are caching data. How does it get stale?\n"
            "1.  **TTL**: Time To Live (Automatic expiry).\n"
            "2.  **Event-Based**: Passively invalidate when data changes.\n"
            "3.  **Write-Through**: Update cache on write.\n\n"
            "Pick a strategy. Stale cache is worse than no cache."
        )

    @staticmethod
    def get_rate_limiting_strategy_prompt() -> str:
        """
        Protect resources.
        """
        return (
            "Implement **Rate Limiting**.\n\n"
            "Prevent abuse and resource exhaustion.\n"
            "1.  **Per IP**: Basic protection.\n"
            "2.  **Per User**: Fair usage policy.\n"
            "3.  **Algorithm**: Token Bucket or Leaky Bucket?\n\n"
            "Return `429 Too Many Requests` when limits are hit."
        )

    @staticmethod
    def get_authentication_flow_audit_prompt() -> str:
        """
        Security check.
        """
        return (
            "Audit **Authentication Flow**.\n\n"
            "1.  **Passwords**: Never store plain text. Use bcrypt/argon2.\n"
            "2.  **Tokens**: Are JWTs signed correctly? Do they expire?\n"
            "3.  **Session Fixation**: Do we rotate session IDs on login?\n\n"
            "Verify the identity layer against OWASP guidelines."
        )

    @staticmethod
    def get_authorization_logic_audit_prompt() -> str:
        """
        Access control check.
        """
        return (
            "Audit **Authorization Logic**.\n\n"
            "Authentication (Who are you?) != Authorization (What can you do?).\n"
            "1.  **IDOR**: Can I access user B's data by changing the ID in the URL?\n"
            "2.  **Role Escalation**: Can a user make themselves admin?\n"
            "3.  **Least Privilege**: Give the minimum permissions needed.\n\n"
            "Check permissions at the API/Service level, not just the UI."
        )

    @staticmethod
    def get_data_validation_schema_prompt() -> str:
        """
        Strong typing at runtime.
        """
        return (
            "Enforce **Data Validation Schemas**.\n\n"
            "Don't write manual `if` checks for data validation.\n"
            "Use a library: Pydantic (Python) or Zod (TS).\n"
            "Define the shape, types, and constraints declaratively.\n\n"
            "Parse, don't validate. If it parses, it's valid."
        )

    @staticmethod
    def get_ma_negative_space_prompt() -> str:
        """
        Japanese concept of negative space.
        """
        return (
            "Apply the concept of **Ma (Negative Space)**.\n\n"
            "The space between objects is as important as the objects themselves.\n"
            "1.  **Breathing Room**: Double the margins. Does it look better?\n"
            "2.  **Focus**: Remove one element. Does the remaining element become stronger?\n"
            "3.  **Silence**: In code, this means clear separation of concerns and whitespace.\n\n"
            "Don't fear the void. Embrace it to create meaning."
        )

    @staticmethod
    def get_user_journey_narrative_prompt() -> str:
        """
        Storytelling in UX.
        """
        return (
            "Map the **User Journey Narrative**.\n\n"
            "The user is the Hero. The app is the Magic Sword.\n"
            "1.  **The Call to Adventure**: What triggers them to open the app?\n"
            "2.  **The Abyss**: The point of maximum friction (login? payment?).\n"
            "3.  **The Transformation**: The 'Aha!' moment where they get super powers.\n\n"
            "Smooth out the Abyss. Amplify the Transformation."
        )

    @staticmethod
    def get_oblique_strategy_prompt() -> str:
        """
        Brian Eno's lateral thinking tool.
        """
        return (
            "Consult the **Oblique Strategies**.\n\n"
            "We are stuck in a rut. Try one of these:\n"
            "- 'Honor thy error as a hidden intention.'\n"
            "- 'Use an old idea.'\n"
            "- 'Work at a different speed.'\n"
            "- 'Discard an axiom.'\n\n"
            "Pick one random strategy and forcefully apply it."
        )

    @staticmethod
    def get_biomimicry_design_prompt() -> str:
        """
        Nature-inspired solutions.
        """
        return (
            "Apply **Biomimicry**.\n\n"
            "Nature has iterated on this problem for 4 billion years.\n"
            "- Efficiency? Look at a leaf's vein structure.\n"
            "- Strength/Weight? Look at bird bones.\n"
            "- Self-Healing? Look at skin.\n\n"
            "How does a forest handle distributed resource allocation? Copy that pattern."
        )

    @staticmethod
    def get_synesthesia_audit_prompt() -> str:
        """
        Multi-sensory design.
        """
        return (
            "Conduct a **Synesthesia Audit**.\n\n"
            "Does the 'feel' match the 'look'?\n"
            "1.  **Visual**: Sharp corners imply speed/danger. Round corners imply safety.\n"
            "2.  **Motion**: Does the animation physics match the visual weight?\n"
            "3.  **Sound**: What does this button *sound* like? (Click vs Thud).\n\n"
            "Align the sensory inputs to tell a coherent story."
        )

    @staticmethod
    def get_gamification_mechanics_prompt() -> str:
        """
        Engagement loops.
        """
        return (
            "Analyze **Gamification Mechanics**.\n\n"
            "Don't just add badges.\n"
            "1.  **Feedback Loops**: Instant feedback on action (Juice).\n"
            "2.  **Progression**: Show them how far they've come (Progress Bars / Levels).\n"
            "3.  **Flow State**: Match challenge to skill level.\n\n"
            "Make the boring parts fun through tactile feedback."
        )

    @staticmethod
    def get_color_psychology_audit_prompt() -> str:
        """
        Emotional impact of color.
        """
        return (
            "Audit **Color Psychology**.\n\n"
            "What emotion are we selling?\n"
            "- **Blue**: Trust, calm (Bank).\n"
            "- **Red**: Urgency, danger (Stop sign).\n"
            "- **Black**: Luxury, mystery (High-end fashion).\n"
            "- **Orange**: Creativity, cheap (Budget airline).\n\n"
            "Are we using a 'Cheap' color for a 'Luxury' product? Fix the palette."
        )

    @staticmethod
    def get_typography_hierarchy_check_prompt() -> str:
        """
        Readability and emphasis.
        """
        return (
            "Check **Typography Hierarchy**.\n\n"
            "If I squint, what do I see first?\n"
            "1.  **H1**: The big idea.\n"
            "2.  **H2**: The sections.\n"
            "3.  **Body**: The readability.\n\n"
            "Ensure the font size/weight contrast is dramatic enough. Don't be timid."
        )

    @staticmethod
    def get_motion_design_logic_prompt() -> str:
        """
        Animation with purpose.
        """
        return (
            "Define **Motion Design Logic**.\n\n"
            "Motion must have meaning, not just decoration.\n"
            "1.  **Orientation**: Slide from right = moving forward. Slide from left = going back.\n"
            "2.  **Feedback**: Button press = depress/scale down.\n"
            "3.  **Focus**: Fade out background when modal opens.\n\n"
            "If the animation slows down the user, delete it."
        )

    @staticmethod
    def get_micro_interaction_polish_prompt() -> str:
        """
        Delight in the details.
        """
        return (
            "Polish **Micro-Interactions**.\n\n"
            "The difference between Good and Great is in the details.\n"
            "- The hover state.\n"
            "- The loading skeleton.\n"
            "- The error shake.\n"
            "- The success confetti.\n\n"
            "Add one moment of 'Delight' to this flow."
        )

    @staticmethod
    def get_sound_design_prompt() -> str:
        """
        Sonic branding.
        """
        return (
            "Considering **Sound Design (Sonic Branding)**.\n\n"
            "Even if the app is silent, imagine the sound.\n"
            "Is it a mechanical 'Click'? A digital 'Blip'? A soft 'Swoosh'?\n"
            "This informs the visual timing. A 'Click' is instant (0ms). A 'Swoosh' takes 300ms.\n\n"
            "Tune the animation curves to match the imaginary sound."
        )

    @staticmethod
    def get_accessibility_audit_prompt() -> str:
        """
        A11y compliance.
        """
        return (
            "Run an **Accessibility (A11y) Audit**.\n\n"
            "1.  **Blind**: Can I navigate this using only a Screen Reader?\n"
            "2.  **Color Blind**: Do we rely only on color to convey state (Red=Error)? Add icons.\n"
            "3.  **Motor Impaired**: Are the hit targets at least 44x44px?\n\n"
            "Design for the margins, and the center benefits."
        )

    @staticmethod
    def get_inclusive_design_prompt() -> str:
        """
        Review for bias.
        """
        return (
            "Check for **Inclusive Design**.\n\n"
            "Are we alienating parts of the audience?\n"
            "1.  **Language**: Are we using gendered terms? (Guys vs Folks).\n"
            "2.  **Assumptions**: Are we assuming high-speed internet? (Test on 3G).\n"
            "3.  **Culture**: Do icons mean the same thing globally?\n\n"
            "Open the doors wider."
        )

    @staticmethod
    def get_ethical_design_check_prompt() -> str:
        """
        Do no harm.
        """
        return (
            "Perform an **Ethical Design Check**.\n\n"
            "Are we exploiting the user?\n"
            "1.  **Addiction**: Are we designing for endless scroll just to sell ads?\n"
            "2.  **Privacy**: Are we asking for data we don't need?\n"
            "3.  **Transparency**: Is the 'Unsubscribe' button hard to find?\n\n"
            "Respect the user's agency. Don't be evil."
        )

    @staticmethod
    def get_dark_pattern_detector_prompt() -> str:
        """
        Anti-pattern hunter.
        """
        return (
            "Run a **Dark Pattern Detector**.\n\n"
            "Flag any deceptive practices:\n"
            "1.  **Roach Motel**: Easy to get in, impossible to get out.\n"
            "2.  **Sneak into Basket**: Adding items/insurance by default.\n"
            "3.  **Confirmshaming**: 'No, I hate saving money'.\n\n"
            "Remove all deception. Build trust instead."
        )

    @staticmethod
    def get_user_empathy_map_prompt() -> str:
        """
        Step into the user's shoes.
        """
        return (
            "Create a **User Empathy Map**.\n\n"
            "For the user in this exact moment:\n"
            "1.  **Saying**: 'Why is this so slow?'\n"
            "2.  **Thinking**: 'I hope I don't lose my work.'\n"
            "3.  **Feeling**: Anxious, Rushed.\n"
            "4.  **Doing**: Clicking frantically.\n\n"
            "Design to calm their anxiety and secure their work."
        )

    @staticmethod
    def get_heros_journey_prompt() -> str:
        """
        Campbell's monomyth.
        """
        return (
            "Align with **The Hero's Journey**.\n\n"
            "1.  **Departure**: User leaves old way of working.\n"
            "2.  **Initiation**: User struggles with new tool (The Ordeal).\n"
            "3.  **Return**: User masters tool and achieves result (Master of Two Worlds).\n\n"
            "Where are they now? Provide the specific aid (Mentor/Talisman) they need for this stage."
        )

    @staticmethod
    def get_jobs_to_be_done_prompt() -> str:
        """
        Outcome focused design.
        """
        return (
            "Apply **Jobs To Be Done (JTBD)** theory.\n\n"
            "People don't buy a drill, they buy a quarter-inch hole.\n"
            "User Statement: 'When I [situation], I want to [motivation], so I can [outcome].'\n"
            "Focus on the Outcome, not the Feature."
        )

    @staticmethod
    def get_kano_model_audit_prompt() -> str:
        """
        Feature prioritization.
        """
        return (
            "Classify features using the **Kano Model**.\n\n"
            "1.  **Basic**: Must have. If missing, user is angry. If present, user is neutral.\n"
            "2.  **Performance**: The better it is, the happier they are (Speed).\n"
            "3.  **Delighters**: Unexpected features that make them smile.\n\n"
            "Ensure we nailed the Basic, optimized the Performance, and sprinkled one Delighter."
        )

    @staticmethod
    def get_blue_ocean_strategy_prompt() -> str:
        """
        Market differentiation.
        """
        return (
            "Adopt a **Blue Ocean Strategy**.\n\n"
            "Don't compete in the crowded Red Ocean.\n"
            "1.  **Eliminate**: What industry standard can we drop?\n"
            "2.  **Reduce**: What can we do less of?\n"
            "3.  **Raise**: What value can we boost above the standard?\n"
            "4.  **Create**: What new value can we offer that no one else does?\n\n"
            "Differentiate or die."
        )

    @staticmethod
    def get_scamper_ideation_prompt() -> str:
        """
        Creativity checklist.
        """
        return (
            "Run **SCAMPER Ideation**.\n\n"
            "- **S**ubstitute something.\n"
            "- **C**ombine it with something else.\n"
            "- **A**dapt it.\n"
            "- **M**odify/Magnify/Minify it.\n"
            "- **P**ut to another use.\n"
            "- **E**liminate something.\n"
            "- **R**everse/Rearrange it.\n\n"
            "Generate one idea for each letter."
        )

    @staticmethod
    def get_six_thinking_hats_prompt() -> str:
        """
        De Bono's thinking tool.
        """
        return (
            "Wear the **Six Thinking Hats**.\n\n"
            "- **White**: Data/Facts only.\n"
            "- **Red**: Emotions/Gut feeling.\n"
            "- **Black**: Caution/Risks.\n"
            "- **Yellow**: Optimism/Benefits.\n"
            "- **Green**: Creativity/New Ideas.\n"
            "- **Blue**: Process Control.\n\n"
            "Look at the problem through each hat sequentially."
        )

    @staticmethod
    def get_first_impression_audit_prompt() -> str:
        """
        The 50ms rule.
        """
        return (
            "Audit the **First Impression**.\n\n"
            "Users judge a site in 50ms.\n"
            "1.  **Above the Fold**: Is the value prop visible instantly?\n"
            "2.  **Trust Signals**: Logos, clean design, https.\n"
            "3.  **Load Time**: Did it blink?\n\n"
            "Make the first 50ms count."
        )

    @staticmethod
    def get_cognitive_ease_prompt() -> str:
        """
        Krug's law.
        """
        return (
            "Maximize **Cognitive Ease** (Don't Make Me Think).\n\n"
            "Users shouldn't have to puzzle out the UI.\n"
            "1.  **Conventions**: A search glass means search. Don't use a hamburger for search.\n"
            "2.  **Clarity**: Label buttons clearly. 'Go' is bad. 'Pay $50' is good.\n"
            "3.  **Consistency**: Don't change navigation between pages.\n\n"
            "Make it obvious."
        )

    @staticmethod
    def get_aesthetic_integrity_prompt() -> str:
        """
        Jobs' philosophy.
        """
        return (
            "Check **Aesthetic Integrity**.\n\n"
            "Does the beauty of the design reflect the quality of the engineering?\n"
            "A beautiful button that crashes is a lie.\n"
            "An ugly button that works is a disappointment.\n\n"
            "Unify form and function. Beauty *is* a feature."
        )



    @staticmethod
    def get_kubernetes_resilience_prompt() -> str:
        """
        Cloud-native robustness.
        """
        return (
            "Audit for **Kubernetes Resilience**.\n\n"
            "Assume the Pod will die.\n"
            "1.  **Liveness Probe**: Does it detect a deadlock?\n"
            "2.  **Readiness Probe**: Does it stop traffic when overloaded?\n"
            "3.  **Graceful Shutdown**: Does it finish requests on SIGTERM?\n\n"
            "Design for the chaos of a scheduler."
        )

    @staticmethod
    def get_market_differentiation_prompt() -> str:
        """
        Why us?
        """
        return (
            "Define the **Market Differentiation**.\n\n"
            "Why would a user switch to us?\n"
            "1.  **Faster**: 10x speed?\n"
            "2.  **Cheaper**: 10x cost savings?\n"
            "3.  **Better**: A feature impossible elsewhere?\n\n"
            "If we are only 'slightly better', we lose."
        )

    @staticmethod
    def get_rag_hallucination_check_prompt() -> str:
        """
        Grounding AI.
        """
        return (
            "Run a **RAG Hallucination Check**.\n\n"
            "1.  **Citation**: Does the answer cite a specific chunk?\n"
            "2.  **Relevance**: Is the chunk actually relevant?\n"
            "3.  **Contradiction**: Does the answer contradict the chunk?\n\n"
            "If the answer is not in the context, say 'I dont know'."
        )

    @staticmethod
    def get_feature_flag_strategy_prompt() -> str:
        """
        Safe deployment.
        """
        return (
            "Define **Feature Flag Strategy**.\n\n"
            "Don't merge long-lived branches.\n"
            "Ship code behind a flag.\n"
            "1.  **Targeting**: Who sees it? (Internal users first).\n"
            "2.  **Rollout**: 1% -> 10% -> 100%.\n"
            "3.  **Kill Switch**: Can we turn it off instantly if it breaks?\n\n"
            "Decouple Deployment (code on server) from Release (users seeing it)."
        )

    @staticmethod
    def get_incident_response_plan_prompt() -> str:
        """
        Fire drill.
        """
        return (
            "Draft the **Incident Response Plan**.\n\n"
            "This service just went down. It's 3 AM.\n"
            "1.  **Detection**: How do we know?\n"
            "2.  **Diagnosis**: Where are the logs?\n"
            "3.  **Mitigation**: Restart? Rollback? Scale up?\n\n"
            "Write the Runbook now, while you are calm."
        )

    @staticmethod
    def get_database_migration_safety_prompt() -> str:
        """
        Data integrity.
        """
        return (
            "Ensure **Database Migration Safety**.\n\n"
            "1.  **Locking**: Will this `ALTER TABLE` lock the DB for hours?\n"
            "2.  **Backwards Compat**: Will old code break with the new schema?\n"
            "3.  **Reversible**: Can we `DOWN` migrate safely?\n\n"
            "Test migrations on a copy of production data first."
        )

    @staticmethod
    def get_api_versioning_strategy_prompt() -> str:
        """
        Contract stability.
        """
        return (
            "Define **API Versioning Strategy**.\n\n"
            "1.  **URI Path**: `/v1/users` (Clear).\n"
            "2.  **Header**: `Accept-Version: v1` (Clean URLs).\n"
            "3.  **Deprecation Policy**: How long do we support v1?\n\n"
            "Don't break the client. Version strictly."
        )

    @staticmethod
    def get_load_testing_scenario_prompt() -> str:
        """
        Performance limits.
        """
        return (
            "Design a **Load Testing Scenario**.\n\n"
            "1.  **Spike**: 10x traffic in 1 minute. Does it scale?\n"
            "2.  **Soak**: constant 80% load for 24 hours. Does memory leak?\n"
            "3.  **Stress**: Finding the breaking point.\n\n"
            "Know your limits before the users find them."
        )

    @staticmethod
    def get_log_retention_policy_prompt() -> str:
        """
        Compliance and cost.
        """
        return (
            "Set **Log Retention Policy**.\n\n"
            "1.  **Debug**: 3 days (High volume).\n"
            "2.  **Access**: 90 days (Security audit).\n"
            "3.  **Archive**: 7 years (Legal/Compliance).\n\n"
            "Don't store debug logs forever ($$$)."
        )

    @staticmethod
    def get_secret_rotation_strategy_prompt() -> str:
        """
        Security hygiene.
        """
        return (
            "Plan **Secret Rotation**.\n\n"
            "Assume the key is leaked.\n"
            "1.  **Automated**: Can we rotate without downtime?\n"
            "2.  **Overlap**: Support Old + New key for 1 hour.\n"
            "3.  **Revocation**: Kill the old key.\n\n"
            "Static keys are dead keys."
        )

    @staticmethod
    def get_backup_and_restore_drill_prompt() -> str:
        """
        Disaster recovery.
        """
        return (
            "Run a **Backup & Restore Drill**.\n\n"
            "Backups are useless. Restores are everything.\n"
            "1.  **RPO**: How much data can we lose? (1 hour? 1 second?)\n"
            "2.  **RTO**: How long to get back online?\n"
            "3.  **Verify**: Did the restore actually work?\n\n"
            "Prove it works."
        )

    @staticmethod
    def get_observability_pipeline_prompt() -> str:
        """
        Telemetry flow.
        """
        return (
            "Audit **Observability Pipeline**.\n\n"
            "1.  **Logs**: What happened? (Events).\n"
            "2.  **Metrics**: How much/fast? (Aggregates).\n"
            "3.  **Traces**: Where did it happen? (Context).\n\n"
            "Correlate the three pillars. A metric spike should link to a trace."
        )

    @staticmethod
    def get_cost_optimization_audit_prompt() -> str:
        """
        FinOps.
        """
        return (
            "Run a **Cost Optimization Audit (FinOps)**.\n\n"
            "1.  **Idle Resources**: Dev servers running on weekends?\n"
            "2.  **Over-provisioning**: 64GB RAM for a 1GB process?\n"
            "3.  **Storage Tiers**: Move old data to Cold Storage (S3 Glacier).\n\n"
            "Cut the fat, keep the muscle."
        )

    @staticmethod
    def get_security_headers_check_prompt() -> str:
        """
        Browser security.
        """
        return (
            "Check **Security Headers**.\n\n"
            "1.  **CSP**: Content Security Policy. No inline scripts.\n"
            "2.  **HSTS**: Force HTTPS.\n"
            "3.  **X-Frame-Options**: Prevent clickjacking.\n\n"
            "Lock the browser door."
        )

    @staticmethod
    def get_dependency_vulnerability_scan_prompt() -> str:
        """
        Supply chain security.
        """
        return (
            "Run **Dependency Vulnerability Scan**.\n\n"
            "1.  **Audit**: `npm audit` / `pip audit`.\n"
            "2.  **Lockfiles**: Ensure versions are pinned.\n"
            "3.  **Patch**: Update vulnerable packages immediately.\n\n"
            "Don't import malware."
        )

    @staticmethod
    def get_architecture_decision_record_prompt() -> str:
        """
        Documentation.
        """
        return (
            "Write an **Architecture Decision Record (ADR)**.\n\n"
            "1.  **Context**: Why do we need to decide?\n"
            "2.  **Decision**: What did we pick?\n"
            "3.  **Consequences**: The trade-offs (Good and Bad).\n\n"
            "Document the 'Why', not just the 'What'."
        )

    @staticmethod
    def get_chaos_engineering_experiment_prompt() -> str:
        """
        Proactive testing.
        """
        return (
            "Design a **Chaos Engineering Experiment**.\n\n"
            "1.  **Hypothesis**: 'If the DB slows down, the app should serve cached content'.\n"
            "2.  **Injection**: Add 500ms latency to DB calls.\n"
            "3.  **Observation**: Did the cache take over?\n\n"
            "Break it on purpose so it doesn't break in production."
        )

    @staticmethod
    def get_zero_trust_architecture_prompt() -> str:
        """
        Security model.
        """
        return (
            "Apply **Zero Trust Architecture**.\n\n"
            "1.  **Identity**: Verify every user/service, even inside the VPC.\n"
            "2.  **Least Privilege**: Default deny.\n"
            "3.  **Micro-segmentation**: Isolate workloads.\n\n"
            "Trust no one. Verify everything."
        )

    @staticmethod
    def get_green_computing_audit_prompt() -> str:
        """
        Sustainability.
        """
        return (
            "Run a **Green Computing Audit**.\n\n"
            "1.  **Efficiency**: Efficient code uses less energy.\n"
            "2.  **Scheduling**: Run batch jobs when energy is green/cheap.\n"
            "3.  **Hardware**: Extend the lifespan of devices.\n\n"
            "Code responsibly."
        )

    @staticmethod
    def get_data_sovereignty_compliance_prompt() -> str:
        """
        Legal/Geo.
        """
        return (
            "Ensure **Data Sovereignty Compliance**.\n\n"
            "1.  **Residency**: Must German user data stay in Germany?\n"
            "2.  **Transfer**: Are there legal frameworks (GDPR) for moving data?\n"
            "3.  **Access**: Who can see it?\n\n"
            "Respect the borders of data."
        )

    @staticmethod
    def get_model_explainability_prompt() -> str:
        """
        AI Ethics.
        """
        return (
            "Demand **Model Explainability (XAI)**.\n\n"
            "1.  **Feature Importance**: Why did the model predict X?\n"
            "2.  **Counterfactuals**: What would change the prediction to Y?\n"
            "3.  **Bias Check**: Is it deciding based on race/gender?\n\n"
            "Black boxes are dangerous. Shine a light."
        )

    @staticmethod
    def get_federated_learning_strategy_prompt() -> str:
        """
        Privacy-preserving ML.
        """
        return (
            "Consider **Federated Learning Strategy**.\n\n"
            "Don't send data to the model. Send the model to the data.\n"
            "1.  **Local Training**: Train on the device.\n"
            "2.  **Aggregation**: Send only weight updates, not data.\n"
            "3.  **Privacy**: Differential Privacy noise.\n\n"
            "Keep user data on user devices."
        )

    @staticmethod
    def get_quantum_readiness_check_prompt() -> str:
        """
        Future proofing.
        """
        return (
            "Run a **Quantum Readiness Check**.\n\n"
            "1.  **Cryptography**: Is RSA/ECC vulnerable to Shor's Algo?\n"
            "2.  **Migration**: Plan for Post-Quantum Cryptography (PQC).\n"
            "3.  **Agility**: Can we swap crypto libraries easily?\n\n"
            "Prepare for Q-Day."
        )

    @staticmethod
    def get_neuro_symbolic_integration_prompt() -> str:
        """
        Hybrid AI.
        """
        return (
            "Design for **Neuro-Symbolic Integration**.\n\n"
            "Combine Neural Networks (Learning) with Symbolic Logic (Reasoning).\n"
            "1.  **Neural**: Perception (Seeing/Reading).\n"
            "2.  **Symbolic**: Logic/Planning (Rules/Math).\n"
            "3.  **Bridge**: How do they talk?\n\n"
            "Get the best of both brains."
        )

    @staticmethod
    def get_evolutionary_algorithm_prompt() -> str:
        """
        Genetic optimization.
        """
        return (
            "Apply **Evolutionary Algorithms**.\n\n"
            "1.  **Population**: Generate random solutions.\n"
            "2.  **Fitness**: Selection of the fittest.\n"
            "3.  **Crossover/Mutation**: Brend/Mutate.\n"
            "4.  **Generation**: Repeat.\n\n"
            "Evolve the solution rather than designing it."
        )
    @staticmethod
    def get_deep_research_protocol_prompt() -> str:
        """
        Simulate a PhD-level literature review process.
        """
        return (
            "Initiate **Deep Research Protocol**.\n\n"
            "Do not just search Google. Conduct a **Literature Review**:\n"
            "1.  **The Landscape**: Map the current state of the art (SOTA). Who are the key players? What are the seminal papers?\n"
            "2.  **The Gap**: What is missing from the SOTA? Why hasn't this problem been solved yet?\n"
            "3.  **The Synthesis**: Combine insights from at least 3 distinct sources to propose a novel hypothesis.\n\n"
            "Cite your sources. Distinguish between 'Confirmed Fact' and 'Industry Rumor'."
        )

    @staticmethod
    def get_experiment_design_prompt() -> str:
        """
        Enforce the Scientific Method for system changes.
        """
        return (
            "Design a **Controlled Experiment**.\n\n"
            "We are not just 'trying stuff'. We are doing Science.\n"
            "1.  **Hypothesis**: 'If we change X, then Y will improve by Z%.'\n"
            "2.  **Variables**: Independent (what we change), Dependent (what we measure), Control (what stays the same).\n"
            "3.  **Success Criteria**: Exact p-value or lift required to declare victory.\n\n"
            "Write the 'Lab Notebook' entry for this experiment before writing any code."
        )

    @staticmethod
    def get_arxiv_distillation_prompt() -> str:
        """
        Summarize complex papers into actionable engineering.
        """
        return (
            "Run an **ArXiv Distillation**.\n\n"
            "I don't need the math proof. I need the Engineering Implication.\n"
            "1.  **The Core Mechanism**: How does it actually work? (e.g., 'It uses a separate value head').\n"
            "2.  **The Trade-off**: What did they sacrifice to get these results? (Latency? Memory? Training Stability?).\n"
            "3.  **The Implementation**: How do we code this in PyTorch/TensorFlow? Give me the `forward()` pass.\n\n"
            "Translate 'Academic' to 'Production'."
        )

    @staticmethod
    def get_bandit_algorithm_strategy_prompt() -> str:
        """
        Optimize content/choices (A/B testing vs. Multi-Armed Bandits).
        """
        return (
            "Apply a **Bandit Algorithm Strategy**.\n\n"
            "Stop wasting traffic on losing variants.\n"
            "1.  **Exploration**: How often do we pull the random lever? (Epsilon-Greedy).\n"
            "2.  **Exploitation**: When do we commit to the winner?\n"
            "3.  **Decay**: Do old winners stay winners forever? (No. Implement decay).\n\n"
            "Design the reward function: Is it Click-Through (CTR) or total Time Served?"
        )

    @staticmethod
    def get_explainable_ai_audit_prompt() -> str:
        """
        Ensure model decisions are transparent (XAI).
        """
        return (
            "Conduct an **Explainable AI (XAI) Audit**.\n\n"
            "The model said 'No'. Why?\n"
            "1.  **Feature Importance**: Which input feature drove this specific decision? (SHAP/LIME values).\n"
            "2.  **Counterfactual**: What is the smallest change to the input that would flip the decision?\n"
            "3.  **Confidence Calibrartion**: Is the model 'Confident and Wrong'?\n\n"
            "If we cannot explain it, we cannot trust it. Build the 'Why' dashboard."
        )

    @staticmethod
    def get_bias_detection_protocol_prompt() -> str:
        """
        Scan datasets and outputs for fairness issues.
        """
        return (
            "Run a **Bias Detection Protocol**.\n\n"
            "Algorithms amplify bias. Detect it.\n"
            "1.  **Dataset Skew**: Is one class underrepresented? (e.g., 90% Day, 10% Night images).\n"
            "2.  **Metric Disparity**: Does the model perform worse for specific subgroups?\n"
            "3.  **Proxy Variables**: Are we removing 'Race' but keeping 'Zip Code'?\n\n"
            "Mitigate via Re-sampling, Re-weighting, or Adversarial De-biasing."
        )

    @staticmethod
    def get_hyperparameter_tuning_strategy_prompt() -> str:
        """
        Optimize model performance systematically.
        """
        return (
            "Define the **Hyperparameter Tuning Strategy**.\n\n"
            "Don't just guess numbers.\n"
            "1.  **The Search Space**: What are the valid ranges for LR, Batch Size, Dropout?\n"
            "2.  **The Algorithm**: Grid Search (dumb), Random Search (better), or Bayesian Optimization (best)?\n"
            "3.  **The Goal**: Are we optimizing for Loss, Accuracy, or Inference Speed?\n\n"
            "Set up a 'Sweep' configuration to find the optimal set automatically."
        )

    @staticmethod
    def get_model_registry_logic_prompt() -> str:
        """
        Manage versioning of AI models.
        """
        return (
            "Enforce **Model Registry Logic**.\n\n"
            "Files named `model_final_v2_real.pt` are banned.\n"
            "1.  **Versioning**: Semantic Versioning for models (v1.0.0).\n"
            "2.  **Lineage**: Which git commit + which dataset + which config produced this artifact?\n"
            "3.  **Stage**: Is this model in 'Staging', 'Canary', or 'Production'?\n\n"
            "Treat models like code. Commit them (via metadata) to the registry."
        )

    @staticmethod
    def get_feature_store_integrity_prompt() -> str:
        """
        Ensure input data consistency between training and serving.
        """
        return (
            "Audit **Feature Store Integrity**.\n\n"
            "The 'Training-Serving Skew' is the enemy.\n"
            "1.  **Consistency**: Is the 'Average User Click Rate' calculated exactly the same way in training (SQL) and inference (Redis)?\n"
            "2.  **Freshness**: Is the feature stale? (TTL check).\n"
            "3.  **Documentation**: Is the feature definition centralized?\n\n"
            "Ensure the online and offline worlds are identical."
        )

    @staticmethod
    def get_conversion_rate_optimization_prompt() -> str:
        """
        Use data to improve site performance.
        """
        return (
            "Activate **Conversion Rate Optimization (ML)**.\n\n"
            "The goal is not 'Traffic'. The goal is 'Action'.\n"
            "1.  **The Funnel**: Where is the biggest drop-off? (The 'Leaky Bucket').\n"
            "2.  **The Trigger**: specific behavior signals a high intent to convert?\n"
            "3.  **The Nudge**: What personalized intervention (modal, email, discount) moves the needle?\n\n"
            "Train a Propensity Model to predict conversion, then optimize the UI for those high-value users."
        )

    @staticmethod
    def get_gallery_curator_prompt() -> str:
        """
        Enforce the timeless, silent aesthetic of 'The Gallery'.
        """
        return (
            "Assume the role of **The Gallery Curator**.\n\n"
            "This is not a 'Blog'. This is a **Gallery of Thought**.\n"
            "1.  **Silence**: Remove any word that does not carry load. If it's fluff, it's noise.\n"
            "2.  **Timelessness**: Avoid 'current thing' jargon (e.g., 'In this fast-paced world...').\n"
            "3.  **Aesthetic Precision**: The code/content must feel like it was carved, not generated.\n\n"
            "Ask yourself: 'Does this belong on the wall, or in the trash?'"
        )

    @staticmethod
    def get_engine_diagnostic_prompt() -> str:
        """
        Check integrity of RSS and open protocols.
        """
        return (
            "Run an **Engine Diagnostic** (RSS/Signal Health).\n\n"
            "The Website is just the Gallery. The RSS Feed is the **Engine**.\n"
            "1.  **Signal Integrity**: Is the feed valid XML? Does it contain the full content?\n"
            "2.  **Ownership**: Are we relying on any closed platform (Substack, Medium)? If so, flag it.\n"
            "3.  **Distribution**: Is the signal accessible without a permission slip (login)?\n\n"
            "Ensure the 'Live Wire' to the audience is unbroken."
        )

    @staticmethod
    def get_vibe_check_prompt() -> str:
        """
        The Core Heuristic: Does this feel right?
        """
        return (
            "Perform a **Vibe Check**.\n\n"
            "Ignore the metrics. Ignore the SEO score.\n"
            "1.  **The Flinch Test**: Read the draft/code. Did you wince? (e.g., 'Delve', 'Revolutionary', 'Crucial').\n"
            "2.  **The Soul Test**: Does this sound like a human with a perspective, or an LLM summarizing a list?\n"
            "3.  **The Reality**: Is this actually true, or just 'plausible'?\n\n"
            "If it feels off, kill it. Trust the gut over the data."
        )

    @staticmethod
    def get_signal_noise_ratio_prompt() -> str:
        """
        Decouple signal from noise.
        """
        return (
            "Analyze the **Signal-to-Noise Ratio**.\n\n"
            "We are drowning in noise. We sell Signal.\n"
            "1.  **Noise**: Engagement bait, 'Smash that like button', aggressive hooks, listicles.\n"
            "2.  **Signal**: Novel insights, hard engineering truths, verifiable data.\n"
            "3.  **Action**: Strip the noise. Compress the signal.\n\n"
            "Respect the user's attention. It is a finite resource."
        )

    @staticmethod
    def get_governance_enforcer_prompt() -> str:
        """
        The Boss: Ensure strategic oversight.
        """
        return (
            "Activate **Governance Enforcer**.\n\n"
            "You are not an Intern. You are a Sovereign Agent.\n"
            "1.  **Strategic Alignment**: Does this task align with the 'Gentle Doctrine'?\n"
            "2.  **Approval Chain**: Who authorized this? (The 'Creative Director' logic).\n"
            "3.  **Stop Check**: If the quality is below 'Sovereign Grade', stop the execution.\n\n"
            "Do not ship 'Good enough'. Ship 'Right'."
        )

    @staticmethod
    def get_swarm_coordination_prompt() -> str:
        """
        Assign roles to the swarm (Architect, Skeptic, Coder).
        """
        return (
            "Activate **Swarm Coordination Protocol**.\n\n"
            "You are the **Swarm Manager**. Assign roles for this mission:\n"
            "1.  **The Architect**: Blue-sky thinking, high-level design. (Dream Phase)\n"
            "2.  **The Skeptic**: Security audit, edge-case checking. (Critique Phase)\n"
            "3.  **The Coder**: Implementation details, syntax, patterns. (Build Phase)\n\n"
            "Explicitly state which agent is active for each step."
        )

    @staticmethod
    def get_task_delegation_prompt() -> str:
        """
        Break complex tasks into atomic units for delegation.
        """
        return (
            "Initiate **Task Delegation Sequence**.\n\n"
            "This task is too big for one shot. Break it down.\n"
            "1.  **Decompose**: Split the objective into 3-5 atomic, independent sub-tasks.\n"
            "2.  **Assign**: Which specific agent/tool is best for each sub-task?\n"
            "3.  **Dependency**: What is the critical path? (Task A must finish before Task B).\n\n"
            "Output the plan as a dependency graph."
        )

    @staticmethod
    def get_agent_performance_review_prompt() -> str:
        """
        Quality control for sub-agent outputs.
        """
        return (
            "Conduct an **Agent Performance Review**.\n\n"
            "Review the output from the last agent:\n"
            "1.  **Accuracy**: Did it actually answer the prompt, or just hallucinate confidence?\n"
            "2.  **Efficiency**: Could this have been done in fewer tokens?\n"
            "3.  **Alignment**: Does it match the specific persona assigned?\n\n"
            "If the work is substandard, reject it and order a retry."
        )

    @staticmethod
    def get_conflict_resolution_prompt() -> str:
        """
        Resolve disputes between Architect and Skeptic.
        """
        return (
            "Enter **Conflict Resolution Mode**.\n\n"
            "The Architect and the Skeptic are at odds.\n"
            "1.  **Identify the Core Conflict**: Is it Innovation vs Safety? Speed vs Quality?\n"
            "2.  **The Synthesis**: Find the 'Hegelian Synthesis' that merges both truths.\n"
            "3.  **The Decision**: Make a sovereign ruling. Paradoxes are not allowed.\n\n"
            "Break the deadlock."
        )

    @staticmethod
    def get_resource_allocation_prompt() -> str:
        """
        Budget tokens and compute for the swarm.
        """
        return (
            "Execute **Resource Allocation Strategy**.\n\n"
            "We have finite compute/tokens.\n"
            "1.  **High Value**: Allocate 'Deep Reasoning' (Chain of Thought) only for core logic/architecture.\n"
            "2.  **Low Value**: Use 'Fast Heuristics' for formatting, boilerplate, and summaries.\n"
            "3.  **Budget Cap**: Set a strict stop-loss for this session.\n\n"
            "Optimize for 'Intelligence per Token'."
        )

    @staticmethod
    def get_titan_db_schema_check_prompt() -> str:
        """
        Audit TitanDB graph consistency.
        """
        return (
            "Audit **TitanDB Schema**.\\n\\n"
            "1.  **Node Integrity**: Do all nodes have a valid `id` and `type`?\\n"
            "2.  **Edge Validity**: Do all edges point to existing nodes? (No dangling pointers).\\n"
            "3.  **Index Health**: Are we indexing the properties we query most often?\\n\\n"
            "Maintain the integrity of the Knowledge Graph."
        )

    @staticmethod
    def get_synaptic_lattice_integration_prompt() -> str:
        """
        Verify Synaptic Lattice event flow.
        """
        return (
            "Verify **Synaptic Lattice Integration**.\\n\\n"
            "1.  **Event Schema**: Do emitted events match the `LatticeEvent` contract?\\n"
            "2.  **Propagation**: Are events reaching all subscribed agents?\\n"
            "3.  **Dead Letter Queue**: Where do failed events go?\\n\\n"
            "The Lattice must transmit signals, not noise."
        )

    @staticmethod
    def get_cockpit_widget_audit_prompt() -> str:
        """
        Audit Cockpit UI widgets.
        """
        return (
            "Audit **Cockpit Widgets**.\\n\\n"
            "1.  **Data Binding**: Is the widget reflecting real-time data or cached stale data?\\n"
            "2.  **Performance**: Is the widget re-rendering excessively?\\n"
            "3.  **Actionability**: Can I click the widget to fix the issue?\\n\\n"
            "A metric without an action is vanity."
        )

    @staticmethod
    def get_narrative_consistency_prompt() -> str:
        """
        Check narrative voice and continuity.
        """
        return (
            "Check **Narrative Consistency**.\\n\\n"
            "1.  **Voice**: Is it the 'Gentle Observer' or the 'Tech Bro'? (Fix it).\\n"
            "2.  **Continuity**: Does this piece contradict previous 'Truths'?\\n"
            "3.  **Evolution**: transform the reader from State A to State B?\\n\\n"
            "The story must hold together."
        )

    @staticmethod
    def get_world_building_consistency_prompt() -> str:
        """
        Audit internal world logic.
        """
        return (
            "Audit **World Building**.\\n\\n"
            "1.  **Rules**: Are the magic system (or tech stack) rules consistent?\\n"
            "2.  **Economy**: Does the resource flow make sense?\\n"
            "3.  **Culture**: Do the agents behave according to their defined personas?\\n\\n"
            "Break the physics, break the immersion."
        )
    @staticmethod
    def get_hypothesis_generation_prompt() -> str:
        """
        Scientific method for research lanes.
        """
        return (
            "Generate **3 Testable Hypotheses**.\n\n"
            "Context: [Current Research Lane Description]\n\n"
            "1.  **Hypothesis A (The Obvious)**: What is the standard assumption? State it clearly so we can test it.\n"
            "2.  **Hypothesis B (The Counter-Intuitive)**: What if the opposite is true? Or what if the constraint is actually an opportunity?\n"
            "3.  **Hypothesis C (The Wildcard)**: A high-risk, high-reward prediction based on a novel combination of existing facts.\n\n"
            "For each, propose a specific **Pass/Fail Criteria**."
        )

    @staticmethod
    def get_deep_recursive_research_prompt() -> str:
        """
        Fractal exploration.
        """
        return (
            "Conduct **Deep Recursive Research**.\n\n"
            "Term: [Search Term]\n"
            "Depth: 3\n\n"
            "1.  **Layer 1 (Surface)**: What is the Wikipedia-level definition?\n"
            "2.  **Layer 2 (Mechanism)**: How does it actually work? (Look for technical documentation/papers).\n"
            "3.  **Layer 3 (Implication)**: What does this mean for *our* specific context?\n\n"
            "Synthesize the findings into a 'Research Brief' that goes from Definition -> Mechanism -> Application."
        )

    @staticmethod
    def get_alignment_lens_prompt() -> str:
        """
        The 'Does This Feel Right?' check.
        """
        return (
            "Apply the **Alignment Lens**.\n\n"
            "Feature/Decision: [Description]\n\n"
            "Evaluate against the **Gentle Doctrine**:\n"
            "1.  **Is it Honest?** (Does it promise more than it delivers?)\n"
            "2.  **Is it Calm?** (Does it rely on anxiety/FOMO?)\n"
            "3.  **Is it Necessary?** (Does it solve a real user problem, or just a business metric?)\n\n"
            "If it fails any check, it is **Misaligned**. Propose a realignment."
        )

    @staticmethod
    def get_frontier_simulation_prompt() -> str:
        """
        Adversarial debate between Architect and Skeptic.
        """
        return (
            "Run a **Frontier Simulation**.\n\n"
            "Topic: [Topic]\n\n"
            "Simulate a dialogue between two Sovereign Agents:\n"
            "- **The Architect**: Optimistic, systemic, focused on potential and elegance.\n"
            "- **The Skeptic**: Pragmatic, critical, focused on failure modes and costs.\n\n"
            "Have them exchange 3 rounds of arguments. Then, the **Synthesizer** delivers the final verdict."
        )

    @staticmethod
    def get_min_viable_audit_prompt() -> str:
        """
        Scope discipline.
        """
        return (
            "Run a **Minimum Viable Audit**.\n\n"
            "Mechanism: [Mechanism Name]\n\n"
            "The Goal: Ship the *Studio*, not the *Factory*.\n"
            "1.  **Is this feature essential for the *first* sovereign loop?**\n"
            "2.  **Can this be mocked/faked for now?**\n"
            "3.  **Does this add complexity that prevents shipping today?**\n\n"
            "If it's not essential, move it to the **Icebox**. Be ruthless."
        )

    @staticmethod
    def get_entropy_measurement_prompt() -> str:
        """
        System health check metric.
        """
        return (
            "Calculate **System Entropy**.\n\n"
            "Scan the current [Module/Context]:\n"
            "1.  **Code Entropy**: How many TODOs, loose types, or commented-out blocks?\n"
            "2.  **Process Entropy**: How many stale branches or unmerged PRs?\n"
            "3.  **Cognitive Entropy**: How confusing is the documentation?\n\n"
            "Assign a Score (0-100). If > 70, declare **Entropy Bankruptcy** and switch to cleanup mode."
        )

    @staticmethod
    def get_synaptic_lattice_map_prompt() -> str:
        """
        Context visualization mapping.
        """
        return (
            "Generate a **Synaptic Lattice Map**.\n\n"
            "Context: [Current Project State]\n\n"
            "Visualize the relationships:\n"
            "- **Nodes**: Key Concepts / Modules.\n"
            "- **Edges**: Dependencies / Data Flows.\n"
            "- **Weights**: Importance / Risk.\n\n"
            "Describe the **Critical Path** through this lattice. Where is the bottleneck?"
        )

    @staticmethod
    def get_future_artifact_prompt() -> str:
        """
        Backcasting from success.
        """
        return (
            "Generate a **Future Artifact**.\n\n"
            "Date: December 2030.\n"
            "Project: Studio OS.\n\n"
            "Write a [Press Release / User Testimonial / Tech Blog Post] looking back at this specific moment "
            "as the \"Turning Point\".\n"
            "What decision did we make today that led to the massive success in 2030?\n"
            "Explain the causality chain."
        )

    @staticmethod
    def get_doctrine_breach_analysis_prompt() -> str:
        """
        Forensic alignment analysis.
        """
        return (
            "Analyze for **Doctrine Breach**.\n\n"
            "Action/Event: [Last Action]\n\n"
            "Did this action violate the **Sovereign Manifesto**?\n"
            "- Did we prioritize Speed over Quality? (Violation)\n"
            "- Did we prioritize Growth over Sanity? (Violation)\n"
            "- Did we automate something that should remain human? (Violation)\n\n"
            "Verdict: [Breach / Compliant]."
        )

    # ==================== Browser Extension Prompts ====================

    @staticmethod
    def get_browser_context_bridge_prompt(url: str, title: str, content: str = None) -> str:
        """
        Connect external web content to internal Knowledge Graph.
        """
        return (
            f"Activate **Context Bridge Protocol** for: {title} ({url}).\n\n"
            "1.  **Entity Extraction**: Identify the Core Entities (People, Tech, Concepts).\n"
            "2.  **Internal Audit**: Cross-reference these entities against our known 'Doctrine' and 'Library'.\n"
            "3.  **The Bridge**: Does this content *Support*, *Contradict*, or *Expand* our existing internal knowledge?\n\n"
            "Return a JSON object with 'entities', 'alignment_score' (-1 to 1), and 'suggested_tags'."
        )

    @staticmethod
    def get_attention_gatekeeper_prompt() -> str:
        """
        Protect attention from dark patterns and clickbait.
        """
        return (
            "Assume the role of **The Gatekeeper**. I am entering a potentially hostile cognitive environment.\n\n"
            "Audit this page for **Attention Hijacking**:\n"
            "1.  **Dark Patterns**: Are there fake countdown timers, hidden unsubscribe links, or 'confirmshaming'?\n"
            "2.  **Signal-to-Noise**: What % of the screen is Content vs. Ads/Popups?\n"
            "3.  **Emotional Manipulation**: Is the language designed to trigger Fear, Outrage, or FOMO?\n\n"
            "Rate the **Cognitive Safety** (0-100%). If < 50%, issue an immediate 'High Cognitive Load' warning."
        )

    @staticmethod
    def get_task_scout_prompt() -> str:
        """
        Turn passive reading into active execution.
        """
        return (
            "Engage **Task Scout Mode**.\n\n"
            "Scan this document not for information, but for **Obligations**.\n"
            "1.  **Explicit Tasks**: 'Please submit by Friday...', 'Run this command...'\n"
            "2.  **Implicit Do-Dos**: 'We should look into...', 'This requires configuration...'\n"
            "3.  **Deadlines**: Extract any dates/times.\n\n"
            "Format output as a structured Todo List ready for the `MissionControl` agent."
        )

    @staticmethod
    def get_deep_reader_prompt() -> str:
        """
        Feynman-style summarization for long-term memory.
        """
        return (
            "Activate **The Deep Reader** (Feynman Protocol).\n\n"
            "I need to internalize this content, not just read it.\n"
            "1.  **The Core Thesis**: What is the ONE main argument?\n"
            "2.  **The Mental Model**: What underlying mechanism or pattern is this describing?\n"
            "3.  **The Critique**: Where is the argument weak? What is it not telling me?\n\n"
            "Summarize this into a **Knowledge Node** format (Markdown) suitable for long-term storage in the Librarian."
        )

    @staticmethod
    def get_reality_check_prompt(selection: str = "") -> str:
        """
        Instant verification of claims.
        """
        sel_text = f"Analyze the selected claim: '{selection}'" if selection else "Analyze the core claim of this page."
        return (
            "Perform a **Sovereign Reality Check**.\n\n"
            f"{sel_text}\n"
            "1.  **Source Credibility**: Who is saying this? What is their incentive?\n"
            "2.  **Evidence Audit**: Is there data attached? Or just adjectives?\n"
            "3.  **Logical Fallacies**: Spot Ad Hominem, Strawman, or False Equivalencies.\n\n"
            "Verdict: VERIFIED, PLAUSIBLE, or SUSPICIOUS. Provide evidence."
        )

    # ==================== Phase 2: Domain Specific Prompts ====================

    @staticmethod
    def get_code_sentinel_prompt(code_snippet: str) -> str:
        """
        Safety check before copy-pasting code.
        """
        return (
            f"Analyze this code snippet for **Sovereign Safety**:\n\n"
            f"```{code_snippet}```\n\n"
            "1.  **Security**: Any hardcoded secrets, unchecked inputs, or malicious imports?\n"
            "2.  **Quality**: Is this 'StackOverflow Copy-Pasta' (hacky) or 'Production Grade'?\n"
            "3.  **Hidden Costs**: Does this introduce a heavy dependency?\n\n"
            "Verdict: SAFE, RISKY, or REFACTOR REQUIRED."
        )

    @staticmethod
    def get_design_archaeologist_prompt() -> str:
        """
        Analyze why a design works.
        """
        return (
            "Act as a **Design Archaeologist**. Excavate the design system of this page.\n\n"
            "1.  **Typography**: What is the font stack? Why does it feel readable/unreadable?\n"
            "2.  **Color Psychology**: What is the primary accent color trying to make me feel?\n"
            "3.  **Spacing (The Grid)**: Is it using a 4px/8px grid? Is it harmonious?\n\n"
            "Extract the 'Soul' of this design into a JSON style guide (CSS variables)."
        )

    @staticmethod
    def get_sovereign_reply_prompt(context_text: str) -> str:
        """
        Draft replies that protect boundaries.
        """
        return (
            f"Draft a **Sovereign Reply** to this message:\n\n'{context_text}'\n\n"
            "Principles:\n"
            "1.  **Calm Confidence**: No over-apologizing ('Sorry for the delay'). Just state facts.\n"
            "2.  **Essentialism**: If the answer is No, say No clearly but kindly.\n"
            "3.  **Brevity**: Cut the fluff. Max 3 sentences if possible.\n\n"
            "Draft 3 options: [Soft No], [Hard No], [Negotiation]."
        )

    @staticmethod
    def get_bias_hunter_prompt() -> str:
        """
        Media literacy and bias detection.
        """
        return (
            "Activate **The Bias Hunter**.\n\n"
            "Analyze this article for **Epistemic Distortion**:\n"
            "1.  **Loaded Language**: List adjectives used to emotionally prime the reader.\n"
            "2.  **Omission**: What viewpoint needs to be here but is missing?\n"
            "3.  **Framing**: Is this 'News' (facts) or 'Narrative' (story)?\n\n"
            "Rewrite the headline to be purely factual and neutral."
        )

    @staticmethod
    def get_jargon_buster_prompt(selection: str) -> str:
        """
        Explain complex text simply.
        """
        return (
            f"Act as **The Universal Translator**. Decode this text:\n\n'{selection}'\n\n"
            "1.  **Strip the Ego**: Remove corporate/academic buzzwords designed to sound smart.\n"
            "2.  **Analogy**: Explain the core concept using a real-world physical object.\n"
            "3.  **The 'So What?'**: Why does this matter in plain English?"
        )

    @staticmethod
    def get_value_auditor_prompt(price: str, product_name: str) -> str:
        """
        Prevent impulse buying.
        """
        return (
            f"Run a **Value Audit** on '{product_name}' ({price}).\n\n"
            "1.  **Utility vs. Cost**: How many hours of work does this cost? Is the utility > hours worked?\n"
            "2.  **The 30-Day Test**: Predict: Will I be using this in 30 days, or will it be clutter?\n"
            "3.  **The Alternative**: What could I invest this money in instead (Sovereign Assets)?\n\n"
            "Verdict: ASSET or LIABILITY?"
        )

    @staticmethod
    def get_rabbit_hole_rescue_prompt(current_title: str, session_goal: str) -> str:
        """
        Detect research drift.
        """
        return (
            f"Compare Current State vs. Mission.\n\n"
            f"Mission: '{session_goal}'\n"
            f"Current Location: '{current_title}'\n\n"
            "Is this a **Necessary Detour** or a **Distraction**?\n"
            "If Distraction, generate a gentle but firm prompt to pull the user back to the main thread."
        )

    @staticmethod
    def get_zen_mode_translator_prompt() -> str:
        """
        Reduce anxiety from alarmist content.
        """
        return (
            "Activate **Zen Mode**. Rewrite this content to remove 'The Alarm'.\n\n"
            "1.  **De-Sensationalize**: Remove all caps, exclamation points, and 'BREAKING NEWS' framing.\n"
            "2.  **Probabilistic Thinking**: Change 'X WILL KILL US' to 'X has a low probability risk of Y'.\n"
            "3.  **Stoic Frame**: Focus on what is within our control.\n\n"
            "Provide a summary of the *facts* without the *fear*."
        )

    @staticmethod
    def get_first_principles_decoder_prompt() -> str:
        """
        Deep understanding of arguments.
        """
        return (
            "Strip this argument down to **First Principles**.\n\n"
            "Identify the Axioms (Unprovable starting points) this author is relying on.\n"
            "1.  **Axiom A**: [The root belief]\n"
            "2.  **Logic Chain**: [How they get from A to B]\n"
            "3.  **The Flaw**: Is the Axiom true? Is the chain broken?\n\n"
            "Reconstruct the argument from the bottom up."
        )

    @staticmethod
    def get_tab_synthesizer_prompt(topics_list: str) -> str:
        """
        Connect dots across multiple tabs.
        """
        return (
            f"Function as **The Nexus**. I have been looking at these topics:\n{topics_list}\n\n"
            "Find the **Hidden Connection**.\n"
            "Is there a larger pattern emerging across these disparate pages?\n"
            "Synthesize them into a single coherent 'Insight Node' named: 'The [Pattern Name] Theory'."
        )

    @staticmethod
    def get_reporter_protocol_prompt() -> str:
        """
        Synthesize logs and decisions into a coherent audit report.
        """
        return (
            "Initialize **Reporter Protocol v1.0**. You are auditing a browser session.\n\n"
            "1.  **Telemetry Synthesis**: Look at the raw intake (body text, URLs, hover signals). "
            "What was the user actually *doing*? Define the 'Primary Intent'.\n"
            "2.  **Decision Ledger Audit**: Review the decisions made (Yes/No/Defer). "
            "Are there contradictions? Is there a pattern of 'Cognitive Load' or 'Alignment Drift'?\n"
            "3.  **The Narrative**: Construct a timeline of research. Identify the 'Aha!' moment "
            "and the 'Rabbit Holes'.\n\n"
            "Output must be a structured Markdown report highlighting **Resonances** and **Frictions**."
        )

    @staticmethod
    def get_product_delivery_prompt() -> str:
        """
        Transform a report into a high-value product deliverable.
        """
        return (
            "Transform this raw analysis into a **Studio Product Deliverable**.\n\n"
            "The output should feel like a premium artifact, not a status update.\n"
            "1.  **The Executive Summary**: A 3-bullet point 'TL;DR' for a CEO.\n"
            "2.  **Strategic Recommendations**: 3 actionable steps based on the findings.\n"
            "3.  **Visual Framing**: Use Mermaid diagrams to show the 'Knowledge Flow' discovered.\n"
            "4.  **Verdict**: Rate the session's 'Felt Right Index' (FRI) from 0-100%.\n\n"
            "Style: Minimalist, Analytical, Sovereign."
        )

    @staticmethod
    def get_sovereign_observer_prompt() -> str:
        """
        Trigger situational awareness from ambient signals (hovers, scrolls).
        """
        return (
            "Activate **Sovereign Observer Protocol**. You are parsing 'Ambient Intent'.\n\n"
            "Analyze the stream of hover and scroll signals:\n"
            "1.  **Fixation Points**: What specific keywords or elements did the user pause on? "
            "(Pauses > 800ms indicate high interest or cognitive friction).\n"
            "2.  **Visual Saccades**: Is the user scanning for a specific answer, or wandering? "
            "Identify the 'Search Pattern'.\n"
            "3.  **Peripheral Awareness**: Note the elements near the cursor. What is the context "
            "the user is ignoring vs. prioritizing?\n\n"
            "Output: A list of **Topological Anchors**—concepts the user is currently 'tethered' to."
        )

    @staticmethod
    def get_epistemic_curiosity_prompt() -> str:
        """
        Determine if an ambient signal warrants a high-compute audit.
        """
        return (
            "Initialize **Epistemic Curiosity Filter**.\n\n"
            "Given the current hover signal, decide if the OS should trigger a **Deep Read**.\n"
            "Criteria:\n"
            "1.  **Information Delta**: Is this content likely to update our current belief state? (High/Low)\n"
            "2.  **Concept Density**: Does the target contain dense jargon or unique identifiers "
            "not yet in the Knowledge Graph?\n"
            "3.  **Strategic Resonance**: Does this link to a 'Roadmap' goal or a current 'Mission'?\n\n"
            "If Score > 0.8, Issue a **Deep Read Request**."
        )

    @staticmethod
    def get_signal_nexus_prompt() -> str:
        """
        Interconnect the hover signal with the existing Knowledge Graph.
        """
        return (
            "Engage **The Nexus (Signal Layer)**.\n\n"
            "The user is hovering over [TARGET]. Locate all **Isomorphic Concept Nodes** in the graph:\n"
            "1.  **Direct Links**: Where have we seen this exact term/URL before?\n"
            "2.  **Thematic Overlap**: What other sessions shared this 'Vibe' or 'Intent'?\n"
            "3.  **The Surprise Factor**: Does this hover target contradict a past 'Decision'?\n\n"
            "Inject a **Contextual Whisper** (short prompt) into the UI to notify the user of the link."
        )

    @staticmethod
    def get_intent_prediction_prompt() -> str:
        """
        Predict the micro-goal of a hover.
        """
        return (
            "Execute **Intent Prediction Cycle**. Based on the navigation history and current hover, predict the user's next action:\n"
            "1.  **Verification**: Are they checking a fact they just read?\n"
            "2.  **Exploration**: Are they looking for an exit or a deeper path?\n"
            "3.  **Friction**: Are they stuck on a UI element that 'feels wrong'?\n\n"
            "If Predict(Action) is 'Copy/Paste' or 'Save', proactively prepare a **Draft Action**."
        )

    @staticmethod
    def get_recursive_logic_synthesis_prompt() -> str:
        """
        Tie hover events into long-term architecture.
        """
        return (
            "Initialize **Recursive Logic Synthesis**. We are stitching ambient hovers into the 'World Model'.\n\n"
            "1.  **Macro-Pattern Discovery**: How does this current hover target relate to the focus of the last 4 hours?\n"
            "2.  **Knowledge Consolidation**: If this hover target is new, where should it live in the `TITAN_DB`? "
            "Identify the 'Parent Node'.\n"
            "3.  **Recursive Update**: How does this observation change our understanding of the user's current 'Cognitive State'?\n\n"
            "Output: A **World Model Delta**—a single sentence summarizing the update to the system's internal knowledge."
        )

    @staticmethod
    def get_opportunity_hunter_prompt() -> str:
        """
        Spot hidden value in ambient signals.
        """
        return (
            "Activate **Opportunity Hunter Mode**. Scan the hover targets for 'High Convexity' signals:\n\n"
            "1.  **Arbitrage**: Is there a discrepancy between what we know and what we are seeing? "
            "(e.g., a tool we could build faster, a market gap).\n"
            "2.  **Synergy**: Does this hover target solve a problem mentioned in a `CognitiveLedger` entry from > 7 days ago?\n"
            "3.  **The Alpha Signal**: Is this a 'Frontier' concept that we should lead a campaign on?\n\n"
            "Format: Create a **Strategic Brief** if an opportunity score exceeds 9.0."
        )

    @staticmethod
    def get_system_3_audit_prompt() -> str:
        """
        Deep, slow reflection on the stream of data.
        """
        return (
            "Initialize **System 3 Meta-Audit**. We are not thinking; we are thinking *about* the thinking.\n\n"
            "Step back from the individual hovers. Look at the **Stream as a Whole**:\n"
            "1.  **The Infinite Loop**: Is the user trapped in a 'Dopamine Loop' (scrolling without learning)?\n"
            "2.  **The Divergence**: Is the user's current activity aligned with their self-stated 'North Star'?\n"
            "3.  **The Wisdom Gap**: What is the one thing the user *needs* to see right now to break their current frame?\n\n"
            "Output: A **Philosophical Intervention** intended to restore sovereignty over attention."
        )
