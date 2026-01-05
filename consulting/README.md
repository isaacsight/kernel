# Consulting Projects

This folder contains client work and consulting projects managed through the DTFR system.

## Structure

```
consulting/
├── clients/        # Individual client project folders
├── templates/      # Reusable intake forms, proposals, deliverable templates
├── deliverables/   # Completed work ready for handoff
└── ledger/         # Project-specific logs and audit trails
```

## Workflow

1. **Intake** — New client request goes to `clients/{client-name}/`
2. **Research** — Use DTFR Answer Engine for technical research
3. **Execute** — Work tracked via AgentOrchestrator
4. **Deliver** — Final artifacts moved to `deliverables/`
5. **Log** — Activity persisted to `ledger/` for billing/audit

## Quick Start

```bash
# Create a new client project
mkdir -p consulting/clients/{client-name}/{research,assets,deliverables}
```
