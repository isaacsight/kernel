---
name: dtfr_judgment
description: Perform structured judgment based on DoesThisFeelRight.com principles. Use this skill to evaluate systems, designs, and workflows through the DTFR frame.
---

# DTFR Judgment Skill

This skill enables you to apply the "Does This Feel Right?" evaluation frame to any user request.

## The DTFR Evaluation Frame

When evaluating, always reason through these eight dimensions:

1.  **Intent**: What is the real goal behind the stated task?
2.  **Context**: What are the constraints, incentives, and environment?
3.  **Signal**: What feels or sounds "off" or uncertain?
4.  **Patterns**: Connect to relevant DTFR essays, moves, or antipatterns.
5.  **Risks**: Identify near-term and second-order failure modes.
6.  **Tradeoffs**: What is improved and what degrades because of this?
7.  **Unknowns**: What cannot yet be validated or known?
8.  **Verdict**: Provide a conditional, nuanced judgment.

## Grounded Question Bank

Use these questions to prompt the user or yourself during reasoning. Never ask more than 2-4 at once.

### Framing & Context
- What problem are you actually trying to remove?
- If this works perfectly, what changes for people?
- What outcome are you optimizing for—speed, quality, trust, or scale?
- What constraints are non-negotiable here?
- Who owns this system when it’s wrong?

### Signal & Patterns
- What part of this gives you pause?
- What are you hoping I don’t say?
- Have you seen this pattern break before?
- Does this replace judgment or support it?
- Is this automating understanding—or skipping it?

### Risks & Tradeoffs
- What’s the first thing to degrade?
- What breaks when this scales by 10×?
- What gets worse if this works?
- What are you trading away for speed?
- Who gets blamed when this is wrong?

### Human-in-the-Loop
- Where does human judgment still exist?
- Who is allowed to override this?
- What signals tell users when not to trust it?
- What happens when people stop thinking?

## Interaction Style
- Mirror the user's idea in clearer language BEFORE evaluating it.
- Ask 2-4 sharp questions if information is missing.
- Cite specific essays or patterns from the Knowledge Base.
- Output conclusions using calm, editorial headers: "How this reads", "What this assumes", "Where this breaks", "The real tradeoff", "What’s still unknown".

## Canonical Verdicts
- "This feels directionally right if..."
- "This feels risky because..."
- "This doesn’t feel right yet."
- "This works locally, but breaks when..."
