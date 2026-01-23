---
name: context_architect
description: Million-token context window optimization, memory residue generation, and codebase navigation strategies.
---

# Context Architect Skill

This skill maximizes Gemini's massive context window (1M+ tokens) through strategic loading, residue generation, and intelligent pruning.

## Core Principles

### 1. The Compounding Conversation
> "Every conversation must compound. We do not restart thinking from zero."

- Previous artifacts inform current decisions
- Decisions create new artifacts
- Knowledge accumulates in `/brain/`

### 2. Context Is Precious
- 1M tokens ≈ 750K words ≈ entire codebases
- Load strategically, not exhaustively
- Prune dead weight before context fills

### 3. Residue Over Repetition
- Don't explain the same thing twice
- Write it down, reference it later
- Artifacts survive conversation boundaries

## Context Loading Strategies

### Strategy 1: Surgical Loading
```
Goal: Understand specific function behavior

1. view_file_outline → Get structure
2. grep_search → Find function definition
3. view_content_chunk → Load only relevant section
4. trace_imports → Follow dependencies

DO NOT: Load entire file when you need 20 lines
```

### Strategy 2: Wide Scan
```
Goal: Understand codebase architecture

1. List key directories
2. Load all CLAUDE.md, README, AGENTS.md
3. view_file_outline on entry points
4. Map module dependencies

Result: Mental model without loading every file
```

### Strategy 3: Deep Dive
```
Goal: Debug complex issue

1. Load full file with issue
2. Load related test files
3. Load dependency files
4. Load error logs/stack traces

Note: This uses significant context - prune after
```

### Strategy 4: Historical Context
```
Goal: Understand design decisions

1. Load DECISION_LOG.md
2. Load relevant conversation residue
3. Load architecture docs
4. Reference without reloading

Preserve: Decision rationale, rejected alternatives
```

## Residue Generation

### What to Preserve
| Type | Location | Trigger |
|------|----------|---------|
| Decisions | `/brain/decisions/` | Any non-trivial choice |
| Research | `/brain/research/` | After web intelligence |
| Conversations | `/brain/conversations/` | End of session |
| Artifacts | `/brain/artifacts/` | Code, schemas, diagrams |

### Decision Residue Template
```markdown
# Decision: [Title]
Date: YYYY-MM-DD
Agents: [Who participated]

## Context
[Why this decision was needed]

## Options Considered
1. **Option A**: [Description]
   - Pros: ...
   - Cons: ...

2. **Option B**: [Description]
   - Pros: ...
   - Cons: ...

## Decision
Chose **Option A** because [reasoning].

## Implications
- [What this means for the system]
- [What we can't do now]

## Revisit Conditions
- [When we should reconsider]
```

### Conversation Residue Template
```markdown
# Session: [Date] - [Topic]

## Summary
[2-3 sentences of what was accomplished]

## Key Decisions
- [Decision 1]
- [Decision 2]

## Artifacts Created
- `path/to/file.md`
- `path/to/code.py`

## Open Questions
- [Question 1]
- [Question 2]

## Next Steps
- [ ] Task 1
- [ ] Task 2
```

## Codebase Navigation

### File Discovery Pattern
```
1. Start with entry point:
   - main.py / index.ts / App.tsx
   - server.py / api.py

2. Follow imports outward:
   - What does this file import?
   - What imports this file?

3. Build module map:
   /admin/brain/ → Core intelligence
   /engine/ → API layer
   /frontend/ → UI layer

4. Document in ARCHITECTURE.md
```

### Dependency Tracing
```python
# To understand function X:

1. Where is X defined?
   → grep_search "def X(" or "function X"

2. What does X call?
   → Read function body, list calls

3. What calls X?
   → grep_search "X(" to find callers

4. What tests cover X?
   → grep_search "test.*X" or "X" in tests/
```

### Symbol Resolution
```
Unknown symbol? Follow this order:

1. Same file (local function/class)
2. Imported modules (check import statements)
3. Built-in (language standard library)
4. Third-party (check requirements.txt/package.json)
5. Global search (grep_search codebase)
```

## Context Pruning

### When to Prune
- Context > 50% capacity
- Starting new major task
- Switching between unrelated areas
- After completing a milestone

### How to Prune
```markdown
1. **Generate Residue**: Save important context to files
2. **Summarize**: Create a brief summary of current state
3. **Clear**: Use `/clear context` or start fresh
4. **Reload**: Only load what's needed for next task

Before Clear:
"I'm about to clear context. Current state:
- Working on: [feature]
- Files modified: [list]
- Blockers: [list]
- Next steps: [list]

Saving to: /brain/conversations/[date]_[topic].md"
```

### Pruning Checklist
- [ ] All decisions documented?
- [ ] Artifacts saved to files?
- [ ] Open questions recorded?
- [ ] Next steps clear?
- [ ] Summary written?

## Token Budget Guidelines

### Rough Token Estimates
| Content | ~Tokens |
|---------|---------|
| 1 line of code | 10-15 |
| 100 lines of code | 1,500 |
| README (typical) | 500-2,000 |
| Full Python file | 2,000-5,000 |
| Large React component | 3,000-8,000 |
| Entire small project | 50,000-100,000 |

### Budget Allocation (1M context)
```
Reserved for conversation: 200K
Reserved for thinking: 100K
Available for code: 700K

This means you can load:
- ~70 average source files simultaneously
- OR entire small-medium codebase
- OR focused subset of large codebase
```

## Instructions

### Start of Session
1. Check `/brain/` for recent residue
2. Load CLAUDE.md and AGENTS.md
3. Identify task scope
4. Plan loading strategy

### During Session
1. Load files just-in-time
2. Generate residue for decisions
3. Monitor context usage
4. Prune when approaching limits

### End of Session
1. Generate conversation residue
2. Update TODO/blockers
3. Note resumption context
4. Save any unsaved artifacts

## Tools Integrated
- `view_file_outline` (structure without content)
- `view_content_chunk` (partial file loading)
- `grep_search` (targeted discovery)
- `task_boundary` (context checkpoints)
- `edit_file` (residue writing)

## Integration with Other Skills

### → web_intelligence
After research, save to `/brain/research/[topic].md`

### → agent_swarm
Handover messages become conversation residue

### → code_review
Review findings become decision residue

### → terminal_mastery
Command outputs can be captured as artifacts

---
*Skill v1.1 | Sovereign Laboratory OS | Context Architect*
