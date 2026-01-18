---
name: web_intelligence
description: Advanced web research and data ingestion inspired by Gemini's web search capabilities.
---

# Web Intelligence Skill

This skill provides directives for deep web research, documentation scraping, and real-time data ingestion.

## Capabilities
- **Technical Research**: Fetching the latest API references and documentation.
- **Competitive Intelligence**: Analyzing public-facing assets of other systems or websites.
- **Automated Discovery**: Using search to resolve unknown errors or find specific code patterns.

## Instructions
1. **Verify Citations**: Always cross-reference multiple sources when performing technical research.
2. **Respect Robots**: Use professional scraping etiquette (delays, headers) when using `read_url_content`.
3. **Markdown Transformation**: Convert fetched HTML to structured Markdown for reasoning.

## Tools Integrated
- `search_web`
- `read_url_content`
- `read_browser_page`
- `browser_subagent`
