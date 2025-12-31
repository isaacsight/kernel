---
name: knowledge_retrieval
description: Search the DoesThisFeelRight.com knowledge base for relevant essays, patterns, and principles. Use this when you need grounding or evidence for a judgment.
---

# Knowledge Retrieval Skill

Use this skill to fetch relevant context from the DTFR library.

## How to use

To retrieve knowledge, you must output a JSON object:

```json
{
  "tool": "knowledge_retrieval",
  "action": "search",
  "params": {
    "query": "The core question or topic to search for"
  }
}
```

## Guidelines
- Use specific keywords found in user input.
- Always search before making a definitive "Verdict".
- If the search returns no results, state that the current topic is outside of the DTFR library’s established scope.
