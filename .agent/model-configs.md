# Studio OS: Model Selection Strategy

To optimize for both **Cognitive Depth** and **Operational Velocity**, the Studio OS routes tasks according to their computational and strategic weight.

## 1. Prime Selection

| Task Tier | Model Recommendation | Rationale |
| :--- | :--- | :--- |
| **Tier 1: Strategic** | Gemini 3 Pro | Architecture, ADRs, Complex Refactoring, Sovereign Strategy |
| **Tier 2: Operational** | Gemini 3 Flash | Unit Tests, Documentation, Daily Subtasks, Linting |
| **Tier 3: Local/Private** | Ollama (Llama 3 / Mistral) | PII processing, Rapid local iteration, Cost control |

## 2. Configuration (`.env`)

Standardized model naming for the environment:
- `GEMINI_MODEL_PRO=models/gemini-2.5-pro` (or latest Pro)
- `GEMINI_MODEL_FLASH=models/gemini-2.5-flash` (or latest Flash)

## 3. Override Logic

Agents should automatically escalate to **Tier 1** if a task in **Tier 2** experiences more than 2 failed attempts or reveals unexpected architectural complexity.
