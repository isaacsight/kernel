---
name: web-scout
description: Search the web, get news, and verify facts. Use when you need up-to-date information, news, or fact-checking.
---

# Web Scout Skills

You have access to the "Web Scout", a tool capable of real-time web research.

## Capabilities

1.  **Search**: General web search for any topic or question.
2.  **News**: Find the latest news articles about a specific topic.
3.  **Verify**: Fact-check a specific claim by searching for supporting or refuting evidence.
4.  **Trending**: Find out what is trending in technology, AI, or other categories.

## How to use

To use these skills, you must output a JSON object describing the action you want to take.

### Search
```json
{
  "tool": "web_scout",
  "action": "search",
  "params": {
    "query": "current status of quantum computing",
    "num_results": 5
  }
}
```

### News
```json
{
  "tool": "web_scout",
  "action": "news",
  "params": {
    "query": "SpaceX launch",
    "num_results": 3
  }
}
```

### Verify Claim
```json
{
  "tool": "web_scout",
  "action": "verify",
  "params": {
    "claim": "The moon is made of green cheese"
  }
}
```

### Get Trending Topics
```json
{
  "tool": "web_scout",
  "action": "trending",
  "params": {
    "category": "ai"
  }
}
```
