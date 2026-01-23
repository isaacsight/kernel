# /review - Code Review Command

Perform systematic code review with security, performance, and maintainability analysis.

## Usage
```
/review [file or PR]
/review --security [file]
/review --perf [file]
```

## Review Dimensions

### 1. Correctness
- Logic verification
- Edge case handling
- Error handling
- Type safety

### 2. Security
- Input validation (SQL injection, XSS)
- Authentication/authorization
- Secrets management
- Dependency vulnerabilities

### 3. Performance
- Algorithmic complexity
- Database query efficiency
- Memory usage
- Async handling

### 4. Maintainability
- Code clarity and naming
- DRY violations
- Single responsibility
- Testability

## Output Format
```markdown
## Code Review: [File/PR]

### Blockers (Must Fix)
- [Critical issues]

### Issues (Should Fix)
- [Significant problems]

### Suggestions (Consider)
- [Improvements]

### Highlights
- [Good patterns]

### Verdict
[ ] Approved
[ ] Request changes
```

## Related Skills
- Gemini: `code_review`
- See: `.gemini/skills/code_review.md`
