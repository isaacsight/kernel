# /research - Web Intelligence Command

Perform deep technical research using web search and documentation retrieval.

## Usage
```
/research [topic]
```

## Behavior

1. **Query Formulation**
   - Search official documentation first
   - Include version numbers when relevant
   - Use site filters for authoritative sources

2. **Source Evaluation**
   - Prioritize: Official docs > GitHub > Stack Overflow > Blog posts
   - Check publication dates for freshness
   - Cross-reference multiple sources

3. **Output Format**
   ```markdown
   ## Research: [Topic]

   ### Summary
   [2-3 sentence overview]

   ### Key Findings
   1. [Finding with source]
   2. [Finding with source]

   ### Technical Details
   [Code examples, configuration]

   ### Sources
   - [URL] - [Description]
   ```

## Examples
- `/research React 19 Server Components`
- `/research FastAPI authentication best practices`
- `/research pgvector vs Pinecone comparison`

## Related Skills
- Gemini: `web_intelligence`
- See: `.gemini/skills/web_intelligence.md`
