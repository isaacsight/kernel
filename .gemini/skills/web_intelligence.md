---
name: web_intelligence
description: Advanced web research, data ingestion, and real-time documentation retrieval with Gemini's native search grounding.
---

# Web Intelligence Skill

This skill leverages Gemini's native Google Search grounding to perform deep web research, documentation scraping, and competitive intelligence gathering.

## Capabilities

### 1. Technical Research
- **API Documentation**: Fetch latest SDK/API references
- **Stack Overflow Mining**: Find solutions to specific error messages
- **GitHub Discovery**: Search repositories, issues, discussions
- **Package Registry**: npm, PyPI, crates.io version/changelog lookup

### 2. Competitive Intelligence
- **Public Website Analysis**: Structure, technology stack, features
- **Product Hunt/HN Discovery**: Trending tools and launches
- **Pricing Research**: Compare SaaS pricing tiers
- **Feature Matrices**: Build comparison tables

### 3. Real-Time Data
- **News/Blog Aggregation**: Latest industry developments
- **Documentation Updates**: Detect API changes
- **Security Advisories**: CVE lookups, vulnerability alerts
- **Status Page Monitoring**: Service availability checks

### 4. Content Extraction
- **Article Parsing**: Clean text from news/blog posts
- **Table Extraction**: Structured data from web tables
- **Code Block Collection**: Gather examples from tutorials
- **Image/Asset URLs**: Collect media references

## Research Methodology

### Phase 1: Query Formulation
```
Goal: Find information about [topic]

Search Strategy:
1. Primary query: "[exact phrase]"
2. Technical query: "[topic] site:github.com OR site:stackoverflow.com"
3. Documentation query: "[topic] API reference documentation"
4. Recent query: "[topic] 2025 OR 2026"
```

### Phase 2: Source Evaluation

**Credibility Hierarchy:**
1. ✅ Official documentation (highest trust)
2. ✅ GitHub repositories (verify stars/activity)
3. ✅ Peer-reviewed/academic sources
4. ⚠️ Stack Overflow (check votes/dates)
5. ⚠️ Blog posts (verify author expertise)
6. ❌ SEO content farms (avoid)

**Freshness Check:**
- Documentation: Check version numbers
- Blog posts: Must be < 2 years old for technical content
- GitHub: Check last commit date

### Phase 3: Information Synthesis

**Output Structure:**
```markdown
## Research: [Topic]

### Summary
[2-3 sentence overview]

### Key Findings
1. [Finding with source link]
2. [Finding with source link]
3. [Finding with source link]

### Technical Details
[Code examples, API snippets, configuration]

### Considerations
- [Tradeoff or caveat]
- [Alternative approach]

### Sources
- [URL 1] - [Description]
- [URL 2] - [Description]
```

## Instructions

### Search Grounding Best Practices
1. **Be specific**: "React 19 useTransition hook" not "React hooks"
2. **Include version numbers**: "Python 3.12 type hints"
3. **Use site filters**: `site:docs.python.org` for official docs
4. **Add date constraints**: "2025" for recent content
5. **Quote exact phrases**: `"Error: Cannot find module"`

### Rate Limiting & Ethics
- **Respect robots.txt**: Check before scraping
- **Use delays**: 2-5 seconds between requests to same domain
- **Cache results**: Don't re-fetch identical queries
- **Attribute sources**: Always link back to original content

### Error Handling
```markdown
If search returns no results:
1. Broaden the query (remove specific terms)
2. Try alternative phrasings
3. Check for typos in technical terms
4. Search related concepts instead

If content is paywalled:
1. Check for free alternatives
2. Look for official summaries
3. Note the limitation in output
4. Suggest user access if critical
```

## Specialized Research Templates

### API Documentation Lookup
```
Query: "[library name] [method name] documentation"
Verify: Official docs > GitHub README > Tutorial sites

Output:
- Function signature
- Parameters (types, defaults)
- Return value
- Example usage
- Common errors
```

### Error Message Research
```
Query: "[exact error message]" site:stackoverflow.com OR site:github.com
Filter: Answers with > 5 upvotes, accepted answers

Output:
- Root cause explanation
- Solution steps
- Related issues
- Prevention tips
```

### Technology Comparison
```
Queries:
- "[Tech A] vs [Tech B] comparison"
- "[Tech A] pros cons"
- "[Tech B] pros cons"
- "[Tech A] [Tech B] benchmark"

Output:
| Criteria | Tech A | Tech B |
|----------|--------|--------|
| Performance | ... | ... |
| Ecosystem | ... | ... |
| Learning curve | ... | ... |
```

### Security Research
```
Query: "[package name] CVE" OR "[package name] vulnerability"
Sources: NVD, Snyk, GitHub Security Advisories

Output:
- CVE identifiers
- Affected versions
- Severity (CVSS)
- Mitigation steps
- Patch version
```

## Integration Points

### With Other Skills
- **context_architect**: Store research in `/brain/research/`
- **code_review**: Lookup best practices for review feedback
- **deployment_ops**: Check service documentation before deploy
- **agent_swarm**: Research phase in pipeline orchestration

### Tools Integrated
- `google_search` (primary)
- `read_url_content` (page parsing)
- `read_browser_page` (JavaScript-rendered content)
- `browser_subagent` (complex navigation)

## Quick Reference

### Search Operators
```
"exact phrase"         - Match exactly
site:example.com       - Limit to domain
-exclude              - Remove term
filetype:pdf          - File type filter
intitle:keyword       - Title contains
inurl:keyword         - URL contains
before:2025-01-01     - Date range
after:2024-01-01      - Date range
```

### Useful Site Filters
```
site:docs.python.org      - Python official docs
site:developer.mozilla.org - Web standards (MDN)
site:react.dev            - React official docs
site:github.com           - GitHub repos/issues
site:stackoverflow.com    - Q&A
site:news.ycombinator.com - Hacker News
site:arxiv.org            - Academic papers
```

---
*Skill v1.1 | Sovereign Laboratory OS | Web Intelligence*
