---
name: agent_swarm
description: Multi-agent orchestration patterns for the Sovereign Laboratory 46+ agent ecosystem.
---

# Agent Swarm Skill

This skill provides coordination protocols for the Sovereign Laboratory's multi-agent system, enabling complex task decomposition and parallel execution.

## Agent Roster Overview

### Core Agents (/admin/brain)
| Agent | Role | Specialty |
|-------|------|-----------|
| **Architect** | System design | High-level planning, dependency mapping |
| **Alchemist** | Data transformation | ETL, format conversion, enrichment |
| **Librarian** | Knowledge management | Indexing, retrieval, semantic search |
| **Critic** | Quality assurance | Code review, testing, validation |
| **Oracle** | Research | Web intelligence, documentation parsing |
| **Scribe** | Documentation | Writing, formatting, changelog |

### Specialized Agents (/admin/engineers)
| Agent | Role | Tools |
|-------|------|-------|
| **Mobbin Scout** | Design intelligence | Playwright, BeautifulSoup4 |
| **Revenue Engine** | Business analysis | Financial modeling, metrics |
| **Context Weaver** | Memory management | Vector search, embeddings |
| **Kernel Commander** | Orchestration | Agent routing, task distribution |

## Orchestration Patterns

### 1. Sequential Pipeline
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Research │───▶│ Analyze  │───▶│ Execute  │
│ (Oracle) │    │ (Critic) │    │(Engineer)│
└──────────┘    └──────────┘    └──────────┘
```

**Use case**: Complex tasks requiring research before implementation.

### 2. Parallel Fan-Out
```
                ┌──────────┐
            ┌──▶│ Agent A  │──┐
┌─────────┐ │   └──────────┘  │   ┌─────────┐
│Decompose│─┼──▶┌──────────┐──┼──▶│Aggregate│
└─────────┘ │   │ Agent B  │  │   └─────────┘
            └──▶└──────────┘──┘
                ┌──────────┐
            └──▶│ Agent C  │──┘
                └──────────┘
```

**Use case**: Independent subtasks that can run concurrently.

### 3. Council Mode (Consensus)
```
     ┌─────────────────────────────────────┐
     │           COUNCIL CHAMBER            │
     │  ┌─────┐  ┌─────┐  ┌─────┐          │
     │  │ A1  │  │ A2  │  │ A3  │          │
     │  └──┬──┘  └──┬──┘  └──┬──┘          │
     │     │       │       │               │
     │     └───────┼───────┘               │
     │             ▼                       │
     │      ┌───────────┐                  │
     │      │ CONSENSUS │                  │
     │      └───────────┘                  │
     └─────────────────────────────────────┘
```

**Use case**: High-stakes decisions requiring multiple perspectives.

### 4. Supervisor Pattern
```
              ┌───────────────┐
              │  SUPERVISOR   │
              │ (Kernel Cmdr) │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Worker1 │  │ Worker2 │  │ Worker3 │
   └─────────┘  └─────────┘  └─────────┘
```

**Use case**: Tasks requiring oversight and error recovery.

## Communication Protocol

### Message Format
```json
{
  "from": "oracle",
  "to": "architect",
  "type": "handover",
  "priority": "high",
  "context": {
    "task_id": "uuid",
    "research_complete": true,
    "findings": ["..."],
    "recommended_action": "..."
  },
  "artifacts": [
    {"type": "markdown", "path": "/brain/research/..."},
    {"type": "json", "data": {...}}
  ]
}
```

### Handover Checklist
When transferring control between agents:

1. **Summarize completed work** (bullet points)
2. **List open questions** (blockers)
3. **Provide relevant artifacts** (paths/data)
4. **Specify expected output** (deliverable)
5. **Set constraints** (time, scope, resources)

### Example Handover
```markdown
## Handover: Oracle → Architect

### Completed
- Researched 5 competing approaches to vector search
- Analyzed Pinecone, Weaviate, pgvector, Qdrant, Milvus
- Documented cost/performance tradeoffs

### Findings
1. pgvector best for our scale (< 1M vectors)
2. Qdrant best if we need filtering
3. Pinecone best for managed service

### Artifacts
- `/brain/research/vector_db_comparison.md`
- `/brain/research/benchmark_results.json`

### Recommended Action
Design schema for pgvector integration with existing Supabase.

### Open Questions
- What's our expected query rate?
- Do we need real-time updates or batch?
```

## Task Decomposition

### Complexity Assessment
```
Task Complexity Matrix:
┌─────────────────────────────────────────┐
│ High    │ Council + │ Supervisor │      │
│         │ Pipeline  │ + Workers  │      │
├─────────┼───────────┼────────────┤      │
│ Medium  │ Pipeline  │ Fan-Out    │      │
│         │           │            │      │
├─────────┼───────────┼────────────┤      │
│ Low     │ Single    │ Single     │      │
│         │ Agent     │ Agent      │      │
└─────────┴───────────┴────────────┘      │
           Low         High
           Independence
```

### Decomposition Template
```markdown
## Task: [Name]

### Subtasks
1. [ ] Research phase (Oracle)
   - Deliverable: Research doc
   - Time: 15 min

2. [ ] Design phase (Architect)
   - Depends on: #1
   - Deliverable: Design doc
   - Time: 30 min

3. [ ] Implementation (Engineer)
   - Depends on: #2
   - Deliverable: Code + tests
   - Time: 2 hours

4. [ ] Review (Critic)
   - Depends on: #3
   - Deliverable: Approval/feedback
   - Time: 20 min

### Parallel Opportunities
- Subtasks 1a and 1b can run concurrently
- Subtasks 3a and 3b are independent

### Risk Points
- Blocking on external API documentation
- May need Council if design has tradeoffs
```

## Memory & State Management

### Residue Generation
Every agent interaction must leave artifacts:

```
/brain/
├── conversations/
│   └── 2026-01-21_feature_planning.md
├── decisions/
│   └── decision_vector_db_choice.md
├── artifacts/
│   └── schema_v2.sql
└── state/
    └── swarm_state.json
```

### State File Format
```json
{
  "active_tasks": [
    {
      "id": "uuid",
      "agent": "architect",
      "status": "in_progress",
      "started": "2026-01-21T10:00:00Z"
    }
  ],
  "completed_today": 12,
  "pending_handovers": [],
  "blocked_tasks": []
}
```

## Instructions

### Before Starting a Swarm Task
1. **Assess complexity** using the matrix
2. **Choose orchestration pattern**
3. **Identify parallel opportunities**
4. **Set checkpoints** for validation

### During Execution
1. **Log all handovers** to `/brain/conversations/`
2. **Update swarm state** after each phase
3. **Generate residue** for every decision
4. **Flag blockers** immediately

### After Completion
1. **Run Critic review** on deliverables
2. **Update documentation** if architecture changed
3. **Record learnings** for future tasks
4. **Clean up temp artifacts**

## Tools Integrated
- `task_boundary` (phase transitions)
- `view_file_outline` (artifact inspection)
- `shell` (script execution)
- `web_intelligence` (external research)
- `context_architect` (memory management)

---
*Skill v1.0 | Sovereign Laboratory OS | Agent Swarm Orchestration*
