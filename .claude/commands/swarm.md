# /swarm - Agent Orchestration Command

Coordinate multi-agent tasks across the Sovereign Laboratory agent ecosystem.

## Usage
```
/swarm [task description]
/swarm --council [decision topic]
/swarm --parallel [subtasks]
```

## Orchestration Patterns

### Sequential Pipeline
```
Research → Analyze → Execute
(Oracle) → (Critic) → (Engineer)
```

### Parallel Fan-Out
```
Decompose → [Agent A, Agent B, Agent C] → Aggregate
```

### Council Mode (Consensus)
```
Multiple agents deliberate → Vote → Consensus decision
```

### Supervisor Pattern
```
Kernel Commander oversees Worker agents with error recovery
```

## Agent Roster
| Agent | Role |
|-------|------|
| Architect | System design, planning |
| Alchemist | Data transformation |
| Librarian | Knowledge management |
| Critic | Quality assurance |
| Oracle | Research |
| Scribe | Documentation |

## Handover Protocol
When delegating:
1. Summarize completed work
2. List open questions
3. Provide artifacts
4. Specify expected output
5. Set constraints

## Output
All swarm operations generate residue in `/brain/`:
- `/brain/conversations/` - Session logs
- `/brain/decisions/` - Decision records
- `/brain/artifacts/` - Generated code/docs

## Related Skills
- Gemini: `agent_swarm`
- See: `.gemini/skills/agent_swarm.md`
