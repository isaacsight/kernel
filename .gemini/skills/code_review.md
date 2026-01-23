---
name: code_review
description: Systematic code review methodology with security auditing, performance analysis, and architectural assessment.
---

# Code Review Skill

This skill provides a structured framework for comprehensive code review, combining automated analysis with expert-level manual inspection.

## Review Dimensions

### 1. Correctness
- **Logic Verification**: Does the code do what it claims?
- **Edge Cases**: Null handling, empty collections, boundary conditions
- **Error Handling**: Are exceptions caught and handled appropriately?
- **Type Safety**: Are types consistent and validated?

### 2. Security
- **Input Validation**: SQL injection, XSS, command injection vectors
- **Authentication/Authorization**: Proper access controls
- **Secrets Management**: No hardcoded credentials, proper env vars
- **Dependency Vulnerabilities**: Known CVEs in packages
- **OWASP Top 10**: Systematic security checklist

### 3. Performance
- **Algorithmic Complexity**: O(n) analysis of critical paths
- **Database Queries**: N+1 problems, missing indexes, query optimization
- **Memory Usage**: Leaks, unnecessary allocations, caching opportunities
- **Async/Concurrency**: Proper handling of async operations, race conditions

### 4. Maintainability
- **Code Clarity**: Naming, comments, documentation
- **DRY Violations**: Duplicated logic that should be abstracted
- **Single Responsibility**: Functions/classes doing too much
- **Testability**: Can this code be unit tested?

### 5. Architecture
- **Design Patterns**: Appropriate use of patterns
- **Coupling/Cohesion**: Module boundaries and dependencies
- **Scalability**: Will this design scale with load?
- **Backwards Compatibility**: API contracts, migration paths

## Review Process

### Phase 1: Automated Analysis
```bash
# Python
ruff check .
mypy --strict .
bandit -r . -ll

# TypeScript
eslint . --ext .ts,.tsx
tsc --noEmit

# General
detect-secrets scan
npm audit / pip-audit
```

### Phase 2: Manual Inspection
1. **Read the PR description** - Understand intent before code
2. **Check the diff size** - Large PRs should be split
3. **Start with tests** - They document expected behavior
4. **Follow the data flow** - Trace inputs to outputs
5. **Question assumptions** - "What if this is null?"

### Phase 3: Feedback Delivery
- **Be specific**: Point to exact lines
- **Explain why**: Not just "change this" but "because..."
- **Suggest alternatives**: Offer solutions, not just problems
- **Prioritize**: Blockers vs. suggestions vs. nitpicks
- **Praise good code**: Reinforce positive patterns

## Instructions

### Review Comment Templates
```markdown
# Blocker
🔴 **BLOCKER**: [Issue description]
This could cause [consequence]. Suggested fix: [solution]

# Major Issue
🟠 **ISSUE**: [Description]
Consider [alternative approach] because [reason].

# Minor Suggestion
🟡 **SUGGESTION**: [Description]
This would improve [aspect] by [benefit].

# Nitpick
💭 **NITPICK**: [Description]
Optional style preference.

# Praise
✅ **NICE**: [Description]
This pattern is excellent because [reason].
```

### Security Checklist
- [ ] No secrets in code (API keys, passwords, tokens)
- [ ] User input is validated/sanitized
- [ ] SQL queries use parameterization
- [ ] Authentication required on sensitive endpoints
- [ ] Authorization checks for data access
- [ ] HTTPS enforced for sensitive data
- [ ] Rate limiting on public endpoints
- [ ] Logging doesn't include sensitive data

### Performance Checklist
- [ ] No N+1 database queries
- [ ] Heavy computations are cached
- [ ] Pagination for list endpoints
- [ ] Async operations don't block
- [ ] Images/assets are optimized
- [ ] Database indexes exist for frequent queries

## Tools Integrated
- `view_file_outline` (understand structure)
- `grep_search` (find related code)
- `view_content_chunk` (examine specific sections)
- `shell` (run linters/analyzers)

## Output Format

When delivering a code review, structure it as:

```markdown
## Code Review: [PR/File Name]

### Summary
[1-2 sentence overview of changes]

### Blockers (Must Fix)
- [List of critical issues]

### Issues (Should Fix)
- [List of significant problems]

### Suggestions (Consider)
- [List of improvements]

### Questions
- [Clarifications needed]

### Highlights
- [Good patterns to recognize]

### Verdict
[ ] Approved
[ ] Approved with minor changes
[ ] Request changes
[ ] Needs discussion
```

---
*Skill v1.0 | Sovereign Laboratory OS | Code Review*
