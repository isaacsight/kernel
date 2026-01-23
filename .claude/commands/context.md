# /context - Context Management Command

Optimize context window usage, generate residue, and manage session state.

## Usage
```
/context status          # Show current context usage
/context save [topic]    # Save conversation residue
/context prune           # Clear dead weight, keep essentials
/context load [file]     # Load previous session state
```

## Context Strategies

### Surgical Loading
Load only specific functions/sections needed:
```
view_file_outline → grep_search → Read specific section
```

### Wide Scan
Map codebase without loading everything:
```
List directories → Read CLAUDE.md, README → Outline entry points
```

### Deep Dive
Full context for debugging:
```
Load file + tests + dependencies + logs
```

## Residue Generation

### Decision Residue (`/brain/decisions/`)
```markdown
# Decision: [Title]
Date: YYYY-MM-DD

## Context
[Why needed]

## Options Considered
1. Option A - Pros/Cons
2. Option B - Pros/Cons

## Decision
Chose [X] because [reasoning]
```

### Conversation Residue (`/brain/conversations/`)
```markdown
# Session: [Date] - [Topic]

## Summary
[What was accomplished]

## Artifacts Created
- [file paths]

## Next Steps
- [ ] Task 1
```

## Token Budget (~200K available)
- 100 lines code ≈ 1,500 tokens
- Full Python file ≈ 2,000-5,000 tokens
- Average project ≈ 50,000-100,000 tokens

## Related Skills
- Gemini: `context_architect`
- See: `.gemini/skills/context_architect.md`
