# 50 AI Prompts for Developers

**The prompts senior engineers actually use. Tested, refined, ready to paste.**

*By K:BOT / kernel.chat*

---

## Debugging & Bug Fixing

### 1. Systematic Debugger
```
I have a bug. Here's what I know:

**Expected behavior:** [what should happen]
**Actual behavior:** [what actually happens]
**Steps to reproduce:** [how to trigger it]
**Code:** [paste relevant code]

Walk me through debugging this systematically. Start with the most likely cause, explain your reasoning, then suggest specific fixes. Don't guess — ask me for more information if you need it.
```
**Best model:** Claude Sonnet, GPT-4, or qwen2.5-coder:32b locally
**Pro tip:** The more specific your "expected vs actual" is, the better the output.

### 2. Stack Trace Analyzer
```
Analyze this stack trace. Tell me:
1. What exactly went wrong (one sentence)
2. Which line in MY code (not library code) is the root cause
3. Why it happened
4. The fix

Stack trace:
[paste full stack trace]

Relevant code:
[paste the file referenced in the trace]
```
**Best model:** Any coding model
**Pro tip:** Always include the code file referenced in the trace, not just the trace itself.

### 3. Race Condition Detector
```
Review this code for race conditions, deadlocks, and concurrency bugs. Consider:
- Shared mutable state accessed from multiple threads/coroutines
- Missing locks or incorrect lock ordering
- Time-of-check-to-time-of-use (TOCTOU) bugs
- Async operations that assume sequential execution

Code:
[paste code]

For each issue found, show the exact sequence of events that triggers the bug.
```
**Best model:** Claude Sonnet or GPT-4
**Pro tip:** Mention your concurrency model (threads, async/await, goroutines, etc.)

### 4. Memory Leak Finder
```
Analyze this code for memory leaks. Look for:
- Event listeners never removed
- Closures holding references to large objects
- Growing caches without eviction
- Circular references preventing GC
- Subscriptions never unsubscribed
- DOM nodes detached but referenced

Code:
[paste code]

For each leak, show exactly where memory is retained and how to fix it.
```
**Best model:** Claude Sonnet, qwen2.5-coder
**Pro tip:** Include the lifecycle of the component/module — creation, usage, and teardown.

### 5. Type Error Resolver
```
I have a TypeScript type error I can't figure out. Here's the error:

[paste error message]

Here's the code:
[paste code]

Here are the relevant type definitions:
[paste types/interfaces]

Explain why this type error occurs, what TypeScript is actually checking, and give me the minimal fix. Don't just add "as any" — give me the proper typed solution.
```
**Best model:** qwen2.5-coder, Claude Sonnet
**Pro tip:** Always include the type definitions, not just the usage code.

### 6. Regex Debugger
```
This regex isn't matching what I expect:

Pattern: [your regex]
Test string: [string that should/shouldn't match]
Expected: [match/no match + capture groups]
Actual: [what you're getting]
Language: [JS/Python/Go/etc]

Explain step by step what the regex engine is doing, why it fails, and give me the corrected pattern with an explanation of each part.
```
**Best model:** Any model
**Pro tip:** Include 3-4 test strings — ones that should match AND ones that shouldn't.

### 7. API Error Interpreter
```
I'm getting this error from an API call:

**Endpoint:** [URL]
**Method:** [GET/POST/etc]
**Request headers:** [paste]
**Request body:** [paste]
**Response status:** [code]
**Response body:** [paste]

What does this error mean? What's the most likely cause? Give me the exact fix — whether it's a header, auth, payload format, or something else.
```
**Best model:** Any model
**Pro tip:** Always include the full response body, not just the status code.

### 8. Performance Bottleneck Identifier
```
This code is slow. Profile data shows [describe what's slow — render time, query time, etc].

Code:
[paste code]

Identify the performance bottlenecks in order of impact. For each:
1. What's slow and why
2. Big-O complexity if relevant
3. Specific fix with code
4. Expected improvement

Don't suggest micro-optimizations. Focus on algorithmic improvements and I/O reduction.
```
**Best model:** Claude Sonnet, GPT-4
**Pro tip:** Include actual performance numbers (response times, render durations) if you have them.

### 9. Security Vulnerability Scanner
```
Review this code for security vulnerabilities. Check for:
- Injection (SQL, XSS, command, template)
- Authentication/authorization bypasses
- Insecure data exposure
- SSRF / open redirects
- Path traversal
- Insecure deserialization
- Hardcoded secrets
- Missing input validation at trust boundaries

Code:
[paste code]

For each vulnerability: severity (critical/high/medium/low), exploit scenario, and fix.
```
**Best model:** Claude Sonnet
**Pro tip:** Specify the context — is this a public API endpoint, internal tool, or client-side code?

### 10. Database Query Optimizer
```
This query is slow on a table with [X] rows:

```sql
[paste query]
```

Table schema:
[paste CREATE TABLE or describe columns + indexes]

Current execution time: [time]
EXPLAIN output (if available): [paste]

Optimize this query. Show me:
1. Why it's slow (missing index, full table scan, etc.)
2. The optimized query
3. Any indexes to add
4. Expected improvement
```
**Best model:** Claude Sonnet, GPT-4
**Pro tip:** Always include your table size and existing indexes.

---

## Code Generation

### 11. Function from Description
```
Write a [language] function that [detailed description].

Requirements:
- [requirement 1]
- [requirement 2]
- [edge cases to handle]

Return type: [type]
Error handling: [throw/return null/Result type/etc]

Include 3 usage examples as comments.
```
**Best model:** qwen2.5-coder, Claude Sonnet

### 12. Test Suite Generator
```
Write a comprehensive test suite for this function using [framework: vitest/jest/pytest/go test].

Function:
[paste function]

Cover:
- Happy path (3+ cases)
- Edge cases (empty input, null, boundary values)
- Error cases (invalid input, thrown exceptions)
- If async: test both resolved and rejected paths

Use descriptive test names that explain the behavior being tested, not the implementation.
```
**Best model:** qwen2.5-coder, Claude Sonnet

### 13. API Endpoint Scaffolder
```
Create a [framework: Express/Fastify/Hono/Flask/Gin] API endpoint:

Method: [GET/POST/PUT/DELETE]
Path: [/api/resource]
Auth: [none/JWT/API key]
Request body: [describe or paste type]
Response: [describe or paste type]
Database: [Postgres/Supabase/Prisma/etc]
Validation: [Zod/Joi/Pydantic/etc]

Include: input validation, error handling, proper status codes. No over-engineering.
```
**Best model:** qwen2.5-coder, Claude Sonnet

### 14. Database Schema Designer
```
Design a PostgreSQL schema for [describe the domain].

Entities: [list entities and their relationships]
Key constraints: [unique fields, required fields, etc]

Output:
1. CREATE TABLE statements with proper types, constraints, foreign keys
2. Indexes for common query patterns
3. Brief explanation of normalization decisions
```
**Best model:** Claude Sonnet, GPT-4

### 15. React Component Generator
```
Create a React component: [component name]

Props: [list props with types]
Behavior: [describe what it does]
State: [describe internal state if any]
Styling: [CSS modules/Tailwind/vanilla CSS/styled-components]

Requirements:
- TypeScript
- Accessible (proper ARIA attributes)
- Responsive
- No unnecessary re-renders

Keep it simple. No over-abstraction.
```
**Best model:** qwen2.5-coder, Claude Sonnet

### 16. CLI Tool Creator
```
Create a CLI tool in [TypeScript/Python/Go] that [description].

Commands:
- [command 1]: [what it does]
- [command 2]: [what it does]

Options/flags: [list them]
Library: [commander/click/cobra/argparse]

Include help text and error messages. Keep it under 200 lines.
```
**Best model:** qwen2.5-coder

### 17. Dockerfile Generator
```
Create a production Dockerfile for:

App: [language/framework]
Build step: [command]
Output: [what the build produces]
Runtime: [what's needed to run]
Port: [port number]

Use multi-stage build. Minimize image size. Don't run as root. Include .dockerignore recommendations.
```
**Best model:** Any coding model

### 18. GitHub Actions Workflow
```
Create a GitHub Actions workflow that:

Trigger: [push to main / PR / manual / schedule]
Steps:
1. [step 1]
2. [step 2]
3. [step 3]

Environment: [Node 20/Python 3.12/Go 1.22/etc]
Secrets needed: [list]
Caching: [yes — for node_modules/pip/go mod]

Keep it minimal. No unnecessary jobs or steps.
```
**Best model:** Any coding model

### 19. Migration Script Writer
```
Write a database migration for [Postgres/MySQL/SQLite]:

Current schema: [describe or paste current state]
Desired change: [what needs to change]
Framework: [raw SQL/Prisma/Drizzle/Alembic/Knex]

Include both UP and DOWN migrations. Handle data migration if existing rows need updating. Make it idempotent where possible.
```
**Best model:** Claude Sonnet

### 20. Utility Library Generator
```
Create a utility module in [language] for [domain: dates/strings/arrays/crypto/validation/etc].

Functions needed:
1. [function name]: [what it does]
2. [function name]: [what it does]
3. [function name]: [what it does]

Requirements: no external dependencies, fully typed, pure functions where possible. Include JSDoc/docstrings.
```
**Best model:** qwen2.5-coder

---

## Code Review & Refactoring

### 21. PR Reviewer
```
Review this diff as a senior engineer. Be direct and specific.

Focus on:
- Bugs or logic errors
- Security issues
- Performance problems
- Missing edge cases
- Naming and readability

Don't nitpick style or formatting. Only flag things that could cause problems in production.

Diff:
[paste diff]
```
**Best model:** Claude Sonnet, GPT-4

### 22. Complexity Reducer
```
This function is too complex. Simplify it while keeping the exact same behavior.

[paste function]

Rules:
- Don't change the function signature or return type
- Don't add dependencies
- Reduce cognitive complexity (nesting, branching)
- Extract only if it genuinely improves readability
```
**Best model:** Claude Sonnet, qwen2.5-coder

### 23. Dead Code Finder
```
Analyze this codebase for dead code:

[paste code or file list]

Find:
- Unused functions/methods
- Unused imports
- Unreachable branches
- Variables assigned but never read
- Exported symbols never imported elsewhere

For each finding, explain why you believe it's dead and the confidence level (certain/likely/possible).
```
**Best model:** Claude Sonnet

### 24. Naming Improver
```
Improve the naming in this code. Current names are unclear or misleading.

[paste code]

For each rename:
- Old name → New name
- Why the new name is better (1 sentence)

Rules: Follow [language] conventions. Names should reveal intent, not implementation. Don't rename things that are already clear.
```
**Best model:** Any model

### 25. Error Handling Auditor
```
Audit the error handling in this code:

[paste code]

Check for:
- Swallowed errors (catch blocks that do nothing)
- Generic catches that hide specific errors
- Missing error handling on I/O operations
- Error messages that don't help debugging
- Inconsistent error handling patterns

For each issue, show the fix.
```
**Best model:** Claude Sonnet, qwen2.5-coder

### 26-30: Architecture Prompts
*(Type Safety Enforcer, Performance Optimizer, Accessibility Checker, DRY Enforcer, Documentation Generator — each follows the same pattern: paste code, specific focus area, actionable output.)*

---

## Architecture & Design

### 31. System Design Interview
```
Design a system for [describe feature/product].

Requirements:
- [functional requirement 1]
- [functional requirement 2]
- Scale: [users/requests per second/data volume]

Walk through:
1. High-level architecture (which services, how they communicate)
2. Data model (key tables/collections and relationships)
3. API design (key endpoints)
4. Scaling bottlenecks and how to address them
5. Trade-offs you're making and why

Keep it practical. I'm building this, not writing a textbook.
```
**Best model:** Claude Sonnet, GPT-4

### 32. API Design Consultant
```
Review this API design:

Endpoints:
[list endpoints with methods, paths, request/response]

Check for:
- RESTful consistency (proper HTTP methods, status codes, resource naming)
- Missing endpoints (CRUD gaps)
- Pagination strategy
- Error response format
- Versioning approach
- Authentication/authorization model

Suggest improvements with specific examples.
```
**Best model:** Claude Sonnet

### 33-40: More Architecture Prompts
*(Database Schema Reviewer, Microservices Decomposer, State Management Advisor, Caching Strategy, Auth Flow Designer, Event-Driven Planner, Scaling Advisor, Tech Debt Prioritizer)*

---

## DevOps & Deployment

### 41. Kubernetes Manifest Generator
```
Create Kubernetes manifests for:

App: [name]
Image: [registry/image:tag]
Replicas: [count]
Port: [port]
Resources: [CPU/memory limits]
Env vars: [list, mark which are secrets]
Health check: [endpoint]
Ingress: [domain]

Include: Deployment, Service, Ingress, ConfigMap, and Secret. Use recommended labels.
```
**Best model:** Any coding model

### 42. CI/CD Pipeline Designer
```
Design a CI/CD pipeline for:

Repo: [mono/multi-repo]
Language: [language/framework]
Deploy target: [Vercel/AWS/GCP/self-hosted/etc]
Environments: [dev/staging/prod]

Include:
- Trigger rules (when does each stage run?)
- Quality gates (what must pass before deploy?)
- Rollback strategy
- Secret management
- Notification on failure

Output as [GitHub Actions/GitLab CI/Jenkins/etc] config.
```
**Best model:** Claude Sonnet

### 43-50: More DevOps Prompts
*(Monitoring Alert Writer, Infra Cost Optimizer, Container Optimization, SSL Troubleshooter, DNS Helper, Load Balancer Setup, Backup Strategy, Incident Response Template)*

---

*All prompts tested with K:BOT (`npx kbot`) and kernel.chat.*
*Works with any AI — Claude, GPT-4, Llama, Gemini, or local models via Ollama.*
