#!/usr/bin/env npx tsx
// K:BOT Local MCP Server — gives Claude Code access to local AI models via K:BOT
// Delegate tasks to local AI for $0: code review, research, quick completions
// Models run on your machine via Ollama — no API costs
//
// ── SECURITY BOUNDARY ──────────────────────────────────────────
// K:BOT Local is SANDBOXED. It may ONLY communicate with localhost Ollama.
// It has NO access to:
//   - Supabase (no client, no service key, no database)
//   - Stripe or any payment systems
//   - User data, admin endpoints, or authenticated APIs
//   - The filesystem (no fs/path imports)
//   - Environment variables / secrets
// All inputs are text-in, text-out through Ollama. Nothing leaves localhost.
// ────────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const OLLAMA_URL = 'http://localhost:11434' as const

// Validate that all fetch calls stay on localhost — defense in depth
function assertLocalhost(url: string): void {
  const parsed = new URL(url)
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error(`Security: K:BOT Local may only connect to localhost, not ${parsed.hostname}`)
  }
}

// ── Helper: call Ollama ─────────────────────────────────────
async function callOllama(
  prompt: string,
  opts: { model?: string; system?: string; max_tokens?: number; images?: string[] } = {}
): Promise<{ content: string; model: string; tokens: number }> {
  const model = opts.model ?? 'auto'
  // Sanitize model name — only allow alphanumeric, dots, colons, dashes, underscores
  if (model !== 'auto' && !/^[a-zA-Z0-9._:\-]+$/.test(model)) {
    throw new Error(`Invalid model name: ${model}`)
  }
  const selectedModel = model === 'auto' ? await pickBestModel(prompt, { hasImages: !!opts.images?.length }) : model

  // Build message content — text only or multimodal
  const userMessage: Record<string, unknown> = { role: 'user', content: prompt }
  if (opts.images && opts.images.length > 0) {
    userMessage.images = opts.images
  }

  const endpoint = `${OLLAMA_URL}/api/chat`
  assertLocalhost(endpoint)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        userMessage,
      ],
      stream: false,
      options: {
        num_predict: opts.max_tokens ?? 2048,
      },
    }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const tokens = (data.prompt_eval_count || 0) + (data.eval_count || 0)
  return {
    content: data.message?.content || '',
    model: selectedModel,
    tokens,
  }
}

// ── Helper: call Ollama embeddings ──────────────────────────
async function callEmbeddings(text: string, model = 'nomic-embed-text'): Promise<number[]> {
  const endpoint = `${OLLAMA_URL}/api/embed`
  assertLocalhost(endpoint)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`)
  const data = await res.json()
  return data.embeddings?.[0] || []
}

// ── Helper: list available models ───────────────────────────
async function listModels(): Promise<string[]> {
  try {
    const tagsUrl = `${OLLAMA_URL}/api/tags`
    assertLocalhost(tagsUrl)
    const res = await fetch(tagsUrl, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.models || []).map((m: any) => m.name)
  } catch {
    return []
  }
}

// ── Helper: pick best model for task ────────────────────────
async function pickBestModel(prompt: string, opts: { hasImages?: boolean } = {}): Promise<string> {
  const available = await listModels()
  if (available.length === 0) throw new Error('No Ollama models available. Run: ollama pull qwen2.5-coder:7b')

  // Vision tasks require a vision model
  if (opts.hasImages) {
    const visionModels = ['llava:13b', 'llava:7b', 'llava-llama3', 'bakllava', 'moondream']
    for (const m of visionModels) {
      const match = available.find(a => a.startsWith(m.split(':')[0]))
      if (match) return match
    }
    throw new Error('No vision model available. Run: ollama pull llava:13b')
  }

  const lower = prompt.toLowerCase()
  const isCode = /\b(code|function|class|refactor|debug|typescript|javascript|python|rust|react|api|sql|test|import|export|bug|fix|implement|generate|unit\s*test|spec)\b/.test(lower)
  const isReasoning = /\b(reason|think|why|explain|analyze|compare|evaluate|proof|logic|math|tradeoff|decision)\b/.test(lower)

  const codeModels = ['qwen2.5-coder:7b', 'codestral:22b', 'deepseek-coder-v2:16b', 'codellama:13b', 'codegemma:7b', 'starcoder2:7b']
  const reasonModels = ['phi3:14b', 'deepseek-r1:8b', 'nemotron-mini', 'gemma2:9b', 'gemma3:12b', 'mistral:7b']
  const generalModels = ['gemma2:9b', 'gemma3:12b', 'llama3.1:8b', 'mistral:7b', 'nemotron-mini']

  const preferred = isCode ? codeModels : isReasoning ? reasonModels : generalModels

  for (const m of preferred) {
    const match = available.find(a => a.startsWith(m.split(':')[0]))
    if (match) return match
  }

  const usable = available.filter(m => !m.includes('embed') && !m.includes('nomic'))
  return usable[0] || available[0]
}

// ── Helper: wrap tool handler with error handling ───────────
function safeHandler(fn: (...args: any[]) => Promise<any>) {
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message.replace(/https?:\/\/[^\s]+/g, '[URL]').replace(/\/Users\/[^\s]+/g, '[PATH]').replace(/\/home\/[^\s]+/g, '[PATH]')
        : 'An unexpected error occurred'
      return {
        content: [{ type: 'text' as const, text: `K:BOT Local error: ${msg}` }],
        isError: true,
      }
    }
  }
}

// ── MCP Server ──────────────────────────────────────────────
const server = new McpServer({
  name: 'kbot-local',
  version: '2.19.0',
})

// ═══════════════════════════════════════════════════════════════
// TIER 0: Original tools (ask, review, generate, explain, models)
// ═══════════════════════════════════════════════════════════════

server.tool(
  'local_ask',
  'Send a question or task to a local Ollama AI model and receive a text response. Runs entirely on localhost at zero cost with no data leaving your machine. Auto-selects the best available model based on task type (code, reasoning, or general). Use this for quick research, brainstorming, explanations, or second opinions when you do not need cloud AI quality. Each call is stateless with no conversation history. Returns the response with model name and token count.',
  {
    prompt: z.string().min(1).max(50000).describe('The question or task for the local model. Non-empty string.'),
    model: z.string().max(100).regex(/^[a-zA-Z0-9._:\-]*$/).optional().describe('Specific Ollama model name (e.g., "gemma2:9b", "qwen2.5-coder:7b"). Default: auto-selects best model for the task type.'),
    system: z.string().max(10000).optional().describe('System prompt to set behavioral context for the model (e.g., "You are a Python expert")'),
  },
  safeHandler(async ({ prompt, model, system }) => {
    const result = await callOllama(prompt, { model, system })
    return {
      content: [{ type: 'text' as const, text: `[${result.model} · ${result.tokens} tokens · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_review',
  'Get a code review from a local AI model specialized for code analysis. Pass source code or a git diff and receive feedback on bugs, security issues, performance, and style. Runs on localhost at zero cost. Use this for pre-commit review, PR prep, or quick quality checks. Does not modify any files. Returns a rating (SHIP / MINOR FIXES / NEEDS REWORK) with specific line references. Code is truncated to 6000 characters if longer.',
  {
    code: z.string().min(1).max(50000).describe('The source code or git diff to review'),
    language: z.string().max(50).optional().describe('Programming language for syntax-aware review (e.g., "typescript", "python"). Default: auto-detect from code content.'),
    focus: z.string().max(100).optional().describe('Review focus area: "bugs", "security", "performance", "style", or "all". Default: "all".'),
  },
  safeHandler(async ({ code, language, focus }) => {
    const lang = language || 'auto-detect'
    const focusArea = focus || 'all'
    const systemPrompt = `You are an expert code reviewer. Review the following ${lang} code. Focus on: ${focusArea}. Be specific with line references. Rate: SHIP / MINOR FIXES / NEEDS REWORK.`
    const truncated = code.length > 6000 ? code.slice(0, 6000) + '\n\n[... truncated]' : code
    const result = await callOllama(
      `Review this code:\n\n\`\`\`${lang}\n${truncated}\n\`\`\``,
      { system: systemPrompt, model: 'auto' }
    )
    return {
      content: [{ type: 'text' as const, text: `[Code Review · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_generate',
  'Generate code from a natural language description using a local code-specialized AI model. Runs on localhost at zero cost. Use this for scaffolding boilerplate, utilities, tests, or prototypes. Does not write files — returns the generated code as text for review. Provide existing types or API signatures as context for more accurate output.',
  {
    task: z.string().min(1).max(10000).describe('Natural language description of the code to generate (e.g., "a function that validates email addresses")'),
    language: z.string().max(50).optional().describe('Target programming language (e.g., "TypeScript", "Python", "Rust"). Default: TypeScript.'),
    context: z.string().max(10000).optional().describe('Additional context such as existing type definitions, API signatures, or framework conventions'),
  },
  safeHandler(async ({ task, language, context }) => {
    const lang = language || 'TypeScript'
    const contextStr = context ? `\n\nExisting context:\n${context}` : ''
    const result = await callOllama(
      `Generate ${lang} code for: ${task}${contextStr}\n\nOutput only the code, no explanations.`,
      { system: `You are an expert ${lang} programmer. Generate clean, production-ready code. No markdown wrapping unless asked.`, model: 'auto' }
    )
    return {
      content: [{ type: 'text' as const, text: `[Generated · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_models',
  'List all locally available Ollama models and verify Ollama is running. Read-only operation with no side effects. Use this to check which models are available before calling other local_* tools, or to diagnose connectivity issues. Returns model names or an error if Ollama is not running.',
  {},
  safeHandler(async () => {
    const models = await listModels()
    if (models.length === 0) {
      return { content: [{ type: 'text' as const, text: 'Ollama is not running or has no models. Start with: ollama serve' }] }
    }
    return {
      content: [{ type: 'text' as const, text: `Ollama models (${models.length}):\n${models.map(m => `  - ${m}`).join('\n')}` }],
    }
  })
)

server.tool(
  'local_explain',
  'Get a plain-language explanation of code, concepts, error messages, or stack traces from a local AI model. Runs on localhost at zero cost. Use this when you need to understand unfamiliar code, debug cryptic errors, or learn about library APIs. Does not modify any files or state. Returns a structured explanation at the requested depth.',
  {
    topic: z.string().min(1).max(20000).describe('What to explain — a code snippet, error message, stack trace, concept name, or library API'),
    depth: z.enum(['brief', 'detailed']).optional().describe('"brief" returns 2-4 paragraphs. "detailed" includes examples and deeper context. Default: "brief".'),
  },
  safeHandler(async ({ topic, depth }) => {
    const depthStr = depth === 'detailed' ? 'Give a thorough explanation with examples.' : 'Explain concisely in 2-4 paragraphs.'
    const result = await callOllama(
      `Explain this:\n\n${topic}\n\n${depthStr}`,
      { system: 'You are a patient, clear technical educator. Explain concepts so they stick.', model: 'auto' }
    )
    return {
      content: [{ type: 'text' as const, text: `[Explanation · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

// ═══════════════════════════════════════════════════════════════
// TIER 1: High-value new tools
// ═══════════════════════════════════════════════════════════════

server.tool(
  'local_vision',
  'Analyze an image using a local vision model (e.g., llava) running on Ollama. Processes base64-encoded images to describe content, read diagrams, identify UI elements, or extract text. Runs on localhost at zero cost with no data leaving your machine. Requires a vision-capable model to be installed (e.g., llava:13b). Use this for screenshot analysis, diagram reading, or OCR-like tasks. Does not modify any files.',
  {
    image: z.string().min(1).describe('Base64-encoded image data. Supports PNG, JPG, and WebP formats. Data URL prefix (data:image/...) is automatically stripped if present.'),
    prompt: z.string().max(5000).optional().describe('Specific question about the image (e.g., "What text is visible?" or "Describe the UI layout"). Default: "Describe this image in detail."'),
  },
  safeHandler(async ({ image, prompt }) => {
    const question = prompt || 'Describe this image in detail.'
    // Strip data URL prefix if present
    const base64 = image.replace(/^data:image\/\w+;base64,/, '')
    const result = await callOllama(question, {
      model: 'auto',
      images: [base64],
      max_tokens: 4096,
    })
    return {
      content: [{ type: 'text' as const, text: `[Vision · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_commit_message',
  'Generate a git commit message from a diff using a local AI model. Analyzes the changes and produces a well-formatted message. Runs on localhost at zero cost. Use this after staging changes to generate a commit message before committing. Does not execute git commands or modify any files — returns text only. Diffs longer than 8000 characters are truncated.',
  {
    diff: z.string().min(1).max(50000).describe('Git diff output (e.g., from "git diff --staged") to generate a commit message for'),
    style: z.enum(['conventional', 'simple', 'detailed']).optional().describe('"conventional" uses type(scope): format. "simple" produces a one-liner. "detailed" includes a body with bullet points. Default: "conventional".'),
  },
  safeHandler(async ({ diff, style }) => {
    const styleGuide = style === 'simple'
      ? 'Write a simple one-line commit message.'
      : style === 'detailed'
      ? 'Write a detailed commit message with a subject line, blank line, and bullet-point body explaining each change.'
      : 'Write a conventional commit message (type(scope): description). Types: feat, fix, refactor, docs, test, chore, style, perf.'

    const truncated = diff.length > 8000 ? diff.slice(0, 8000) + '\n\n[... diff truncated]' : diff
    const result = await callOllama(
      `Generate a commit message for this diff:\n\n${truncated}`,
      {
        system: `You are a git commit message generator. ${styleGuide}\nOutput ONLY the commit message, nothing else. No quotes, no markdown, no explanation.`,
        model: 'auto',
        max_tokens: 512,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Commit Message · ${result.model} · $0]\n\n${result.content.trim()}` }],
    }
  })
)

server.tool(
  'local_test_gen',
  'Generate unit test scaffolding for a function, class, or module using a local code-specialized AI model. Runs on localhost at zero cost. Use this when you need to quickly scaffold tests with happy path, edge cases, and error scenarios. Does not write files — returns the generated test code for review. Code is truncated to 6000 characters if longer.',
  {
    code: z.string().min(1).max(50000).describe('The source code (function, class, or module) to generate tests for'),
    framework: z.string().max(50).optional().describe('Test framework to use: "vitest", "jest", "pytest", "go", "rust". Default: auto-detect from language.'),
    language: z.string().max(50).optional().describe('Programming language of the source code. Default: auto-detect from code content.'),
  },
  safeHandler(async ({ code, framework, language }) => {
    const fw = framework || 'auto-detect'
    const lang = language || 'auto-detect'
    const truncated = code.length > 6000 ? code.slice(0, 6000) + '\n\n[... truncated]' : code
    const result = await callOllama(
      `Generate comprehensive unit tests for this ${lang} code using ${fw}:\n\n\`\`\`${lang}\n${truncated}\n\`\`\`\n\nInclude: happy path, edge cases, error cases. Output only the test code.`,
      {
        system: `You are an expert test engineer. Generate thorough, well-structured tests. Use descriptive test names. Include edge cases and error scenarios. Output only code, no explanations.`,
        model: 'auto',
        max_tokens: 4096,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Tests · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_refactor',
  'Refactor code toward a specific goal using a local code-specialized AI model. Preserves behavior while improving structure. Runs on localhost at zero cost. Use this for extracting functions, simplifying logic, adding error handling, or reducing duplication. Does not write files — returns the refactored code with an explanation of changes. Code is truncated to 6000 characters if longer.',
  {
    code: z.string().min(1).max(50000).describe('The source code to refactor'),
    intent: z.string().min(1).max(500).describe('Refactoring goal: "simplify", "extract function", "add types", "reduce duplication", "improve readability", "add error handling"'),
    language: z.string().max(50).optional().describe('Programming language of the source code. Default: auto-detect from code content.'),
  },
  safeHandler(async ({ code, intent, language }) => {
    const lang = language || 'auto-detect'
    const truncated = code.length > 6000 ? code.slice(0, 6000) + '\n\n[... truncated]' : code
    const result = await callOllama(
      `Refactor this ${lang} code. Goal: ${intent}\n\n\`\`\`${lang}\n${truncated}\n\`\`\`\n\nShow the refactored code first, then briefly explain what changed and why.`,
      {
        system: 'You are an expert software engineer focused on clean code. Refactor precisely to match the stated goal. Preserve behavior. Show the full refactored code.',
        model: 'auto',
        max_tokens: 4096,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Refactor · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_regex',
  'Generate a regular expression pattern from a natural language description, with an explanation of each component. Runs on localhost at zero cost. Use this when you need a regex for validation, parsing, or extraction and want to understand the pattern. Does not execute the regex — returns the pattern, explanation, and example matches for review.',
  {
    description: z.string().min(1).max(2000).describe('What the regex should match (e.g., "email addresses", "ISO 8601 dates", "URLs with query params")'),
    flavor: z.enum(['javascript', 'python', 'go', 'rust', 'pcre']).optional().describe('Regex flavor/dialect for syntax compatibility. Default: "javascript".'),
    test_strings: z.string().max(5000).optional().describe('Sample strings to test against, one per line. The model will show which match and which do not.'),
  },
  safeHandler(async ({ description, flavor, test_strings }) => {
    const flav = flavor || 'javascript'
    const testStr = test_strings ? `\n\nTest against these strings:\n${test_strings}` : ''
    const result = await callOllama(
      `Create a ${flav} regex pattern that matches: ${description}${testStr}\n\nProvide:\n1. The regex pattern\n2. Explanation of each part\n3. Example matches and non-matches`,
      {
        system: 'You are a regex expert. Provide precise, well-tested patterns. Always explain each component of the regex.',
        model: 'auto',
        max_tokens: 1024,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Regex · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

// ═══════════════════════════════════════════════════════════════
// TIER 2: Developer workflow tools
// ═══════════════════════════════════════════════════════════════

server.tool(
  'local_diff',
  'Analyze a code diff and explain what changed, flag potential bugs, and identify side effects using a local AI model. Runs on localhost at zero cost. Use this for PR review preparation, post-merge audits, or understanding unfamiliar changes. Does not modify any files. Diffs longer than 8000 characters are truncated. Returns a structured analysis with summary, issues, side effects, and suggestions.',
  {
    diff: z.string().min(1).max(50000).describe('The diff to analyze — git diff output or before/after code comparison'),
    context: z.string().max(5000).optional().describe('Additional context about the codebase, change intent, or related components to improve analysis accuracy'),
  },
  safeHandler(async ({ diff, context }) => {
    const contextStr = context ? `\nContext: ${context}` : ''
    const truncated = diff.length > 8000 ? diff.slice(0, 8000) + '\n\n[... truncated]' : diff
    const result = await callOllama(
      `Analyze this diff:${contextStr}\n\n${truncated}\n\nProvide:\n1. Summary of changes\n2. Potential bugs or issues\n3. Side effects to watch for\n4. Suggestions for improvement`,
      {
        system: 'You are a senior engineer reviewing a code change. Be thorough but concise. Flag real issues, not style nitpicks.',
        model: 'auto',
        max_tokens: 2048,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Diff Analysis · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_docs',
  'Generate documentation for code using a local AI model. Produces JSDoc comments, Python docstrings, README sections, or API reference depending on the format. Runs on localhost at zero cost. Use this to add documentation to undocumented functions, classes, or modules. Does not write files — returns generated documentation text for review. Code is truncated to 6000 characters if longer.',
  {
    code: z.string().min(1).max(50000).describe('The source code to generate documentation for'),
    format: z.enum(['jsdoc', 'docstring', 'readme', 'api']).optional().describe('"jsdoc" for JSDoc comments, "docstring" for Python docstrings, "readme" for README sections, "api" for API reference. Default: "jsdoc".'),
    language: z.string().max(50).optional().describe('Programming language of the source code. Default: auto-detect from code content.'),
  },
  safeHandler(async ({ code, format, language }) => {
    const fmt = format || 'jsdoc'
    const lang = language || 'auto-detect'
    const formatGuide = {
      jsdoc: 'Generate JSDoc comments with @param, @returns, @throws, and @example tags.',
      docstring: 'Generate Python-style docstrings with Args, Returns, Raises, and Examples sections.',
      readme: 'Generate a README section explaining what this code does, how to use it, and API reference.',
      api: 'Generate API documentation with endpoint descriptions, parameters, request/response examples.',
    }
    const truncated = code.length > 6000 ? code.slice(0, 6000) + '\n\n[... truncated]' : code
    const result = await callOllama(
      `Generate ${fmt} documentation for this ${lang} code:\n\n\`\`\`${lang}\n${truncated}\n\`\`\``,
      {
        system: `You are a technical writer. ${formatGuide[fmt]} Be accurate — infer types and behavior from the code. Output only the documentation.`,
        model: 'auto',
        max_tokens: 4096,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Docs · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_convert',
  'Convert data between formats (JSON, YAML, TOML, CSV, XML) or infer TypeScript interfaces, Zod schemas, and JSON Schema from data. Runs on localhost at zero cost. Use this for config format migration, type generation from API responses, or data transformation. Does not write files — returns the converted data as text. Input is truncated to 6000 characters if longer.',
  {
    input: z.string().min(1).max(50000).describe('The data to convert in the source format'),
    from: z.string().min(1).max(20).describe('Source format: "json", "yaml", "toml", "csv", "xml", or "auto" for auto-detection'),
    to: z.string().min(1).max(20).describe('Target format: "json", "yaml", "toml", "csv", "xml", "typescript", "zod", or "jsonschema"'),
  },
  safeHandler(async ({ input, from, to }) => {
    const truncated = input.length > 6000 ? input.slice(0, 6000) + '\n\n[... truncated]' : input
    const result = await callOllama(
      `Convert this ${from} data to ${to}:\n\n${truncated}\n\nOutput only the converted data, no explanation.`,
      {
        system: `You are a data format expert. Convert precisely between formats. Preserve all data. For TypeScript/Zod, infer proper types from the data values. Output only the result.`,
        model: 'auto',
        max_tokens: 4096,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Convert ${from} → ${to} · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_sql',
  'Generate SQL queries from natural language descriptions using a local AI model. Optionally provide a database schema for accurate table and column references. Runs on localhost at zero cost. Use this when you need to write a query but are unsure of the syntax, or to translate business requirements into SQL. Does not execute the query — returns SQL text with parameterized placeholders for review.',
  {
    question: z.string().min(1).max(5000).describe('Natural language description of the query (e.g., "all users who signed up last week with more than 3 orders")'),
    schema: z.string().max(20000).optional().describe('Database schema context — CREATE TABLE statements or table/column descriptions for accurate references'),
    dialect: z.enum(['postgresql', 'mysql', 'sqlite', 'mssql']).optional().describe('SQL dialect for syntax compatibility. Default: "postgresql".'),
  },
  safeHandler(async ({ question, schema, dialect }) => {
    const d = dialect || 'postgresql'
    const schemaStr = schema ? `\n\nDatabase schema:\n${schema}` : ''
    const result = await callOllama(
      `Write a ${d} SQL query for: ${question}${schemaStr}\n\nOutput the SQL query, then briefly explain what it does.`,
      {
        system: `You are a database expert. Write efficient, correct ${d} SQL. Use proper JOINs, avoid N+1 patterns, use appropriate indexes. Always use parameterized placeholders ($1, $2) for user input values.`,
        model: 'auto',
        max_tokens: 1024,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[SQL · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_translate',
  'Translate text between natural languages using a local AI model. Preserves formatting (markdown, HTML tags, placeholders). Runs on localhost at zero cost with no data leaving your machine. Use this for i18n string localization, documentation translation, or user-facing copy. Does not write files — returns translated text only. Provide context for idiomatic translation of short phrases.',
  {
    text: z.string().min(1).max(20000).describe('The text to translate. Formatting (markdown, HTML, placeholders like {{name}}) is preserved.'),
    to: z.string().min(1).max(50).describe('Target language name or code (e.g., "Spanish", "Japanese", "zh-CN", "de")'),
    from: z.string().max(50).optional().describe('Source language. Default: auto-detect from text content.'),
    context: z.string().max(500).optional().describe('Usage context for better idiomatic translation (e.g., "UI button label", "error message", "marketing copy", "legal text")'),
  },
  safeHandler(async ({ text, to, from, context }) => {
    const fromStr = from ? ` from ${from}` : ''
    const contextStr = context ? ` Context: ${context}.` : ''
    const result = await callOllama(
      `Translate${fromStr} to ${to}:${contextStr}\n\n${text}\n\nOutput only the translation, nothing else.`,
      {
        system: 'You are a professional translator. Translate naturally — adapt idioms and tone for the target language. Preserve formatting (markdown, HTML tags, placeholders like {{name}}).',
        model: 'auto',
        max_tokens: 2048,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Translate → ${to} · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

// ═══════════════════════════════════════════════════════════════
// TIER 3: Advanced tools
// ═══════════════════════════════════════════════════════════════

server.tool(
  'local_summarize',
  'Summarize long text, logs, documentation, or articles using a local AI model. Handles large inputs by truncating to the first 6000 characters. Runs on localhost at zero cost. Use this to quickly understand long documents, review logs, or create executive summaries. Does not modify any files. Never fabricates information not present in the source text.',
  {
    text: z.string().min(1).max(100000).describe('The text to summarize — articles, logs, documentation, or any long-form content'),
    style: z.enum(['bullets', 'paragraph', 'tldr', 'technical']).optional().describe('"bullets" for key points list, "paragraph" for prose, "tldr" for 1-2 sentences, "technical" for implementation details. Default: "bullets".'),
    max_length: z.number().int().min(10).max(2000).optional().describe('Approximate maximum word count for the summary. Default: 200.'),
  },
  safeHandler(async ({ text, style, max_length }) => {
    const s = style || 'bullets'
    const len = max_length || 200
    const styleGuide = {
      bullets: 'Summarize as a bulleted list of key points.',
      paragraph: 'Summarize as a concise paragraph.',
      tldr: 'Give a 1-2 sentence TL;DR.',
      technical: 'Summarize focusing on technical details, architecture decisions, and implementation specifics.',
    }
    // Chunk large inputs
    const maxChunkSize = 6000
    const truncated = text.length > maxChunkSize ? text.slice(0, maxChunkSize) + '\n\n[... text truncated, summarizing first portion]' : text
    const result = await callOllama(
      `Summarize the following (max ~${len} words):\n\n${truncated}`,
      {
        system: `You are an expert summarizer. ${styleGuide[s]} Be concise and accurate. Never fabricate information not present in the source.`,
        model: 'auto',
        max_tokens: 1024,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Summary · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_shell_explain',
  'Explain what a shell command does by breaking down each component: commands, flags, pipes, redirections, and subshells. Runs on localhost at zero cost. Use this to understand unfamiliar or complex shell commands before running them. Does not execute the command — purely explanatory with no side effects. Warns about dangerous patterns (rm -rf, sudo, etc.).',
  {
    command: z.string().min(1).max(5000).describe('The shell command or pipeline to explain (e.g., "find . -name *.log -mtime +7 -exec rm {} \\;")'),
  },
  safeHandler(async ({ command }) => {
    const result = await callOllama(
      `Explain what this shell command does, step by step:\n\n\`${command}\`\n\nBreak down each part: the command, flags, pipes, redirections, and any subshells. Explain what the full pipeline accomplishes.`,
      {
        system: 'You are a Unix/Linux expert. Explain shell commands clearly. Break down each component. Note any potential dangers (rm -rf, sudo, etc.).',
        model: 'auto',
        max_tokens: 1024,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Shell Explain · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_diagram',
  'Generate Mermaid or PlantUML diagram code from a natural language description using a local AI model. Runs on localhost at zero cost. Use this to create architecture diagrams, sequence flows, ER diagrams, or state machines from descriptions. Does not render the diagram — returns the diagram source code in a code block for pasting into any Mermaid/PlantUML renderer.',
  {
    description: z.string().min(1).max(5000).describe('What to diagram (e.g., "OAuth 2.0 login flow", "database schema for a blog with users, posts, and comments")'),
    type: z.enum(['flowchart', 'sequence', 'class', 'er', 'state', 'gantt']).optional().describe('Diagram type. Default: auto-detect from description.'),
    format: z.enum(['mermaid', 'plantuml']).optional().describe('Output syntax format. Default: "mermaid".'),
  },
  safeHandler(async ({ description, type, format }) => {
    const fmt = format || 'mermaid'
    const diagramType = type ? ` as a ${type} diagram` : ''
    const result = await callOllama(
      `Create a ${fmt} diagram${diagramType} for: ${description}\n\nOutput only the ${fmt} code, wrapped in a code block.`,
      {
        system: `You are a diagram expert. Generate valid ${fmt} syntax. Keep diagrams clean and readable. Use descriptive labels. Output only the diagram code in a code block.`,
        model: 'auto',
        max_tokens: 2048,
      }
    )
    return {
      content: [{ type: 'text' as const, text: `[Diagram · ${result.model} · $0]\n\n${result.content}` }],
    }
  })
)

server.tool(
  'local_embeddings',
  'Generate a dense vector embedding for text using a local embedding model (default: nomic-embed-text). Runs on localhost at zero cost. Use this for semantic search, document clustering, similarity comparison, or building RAG pipelines. Does not store the embedding — returns the vector as an array of floats. Requires the embedding model to be installed in Ollama.',
  {
    text: z.string().min(1).max(20000).describe('The text to generate an embedding vector for'),
    model: z.string().max(100).regex(/^[a-zA-Z0-9._:\-]*$/).optional().describe('Ollama embedding model name. Default: "nomic-embed-text".'),
  },
  safeHandler(async ({ text, model }) => {
    const m = model || 'nomic-embed-text'
    if (!/^[a-zA-Z0-9._:\-]+$/.test(m)) throw new Error(`Invalid model name: ${m}`)
    const embedding = await callEmbeddings(text, m)
    return {
      content: [{
        type: 'text' as const,
        text: `[Embedding · ${m} · ${embedding.length} dimensions · $0]\n\n[${embedding.slice(0, 10).map(n => n.toFixed(4)).join(', ')}, ... (${embedding.length} total)]`,
      }],
    }
  })
)

// ═══════════════════════════════════════════════════════════════
// K:BOT AGENT — route messages through kbot's specialist agents
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)

async function callKbot(
  message: string,
  opts: { agent?: string; model?: string } = {}
): Promise<{ content: string; agent: string; model: string }> {
  const args = ['--quiet', '--pipe', '--json']
  if (opts.agent) args.push('--agent', opts.agent)
  if (opts.model) args.push('--model', opts.model)
  args.push(message)

  const { stdout } = await execFileAsync('kbot', args, {
    timeout: 120_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })

  // kbot --json prints text then a JSON line — grab the last line
  const lines = stdout.trim().split('\n')
  const jsonLine = lines[lines.length - 1]
  try {
    const data = JSON.parse(jsonLine)
    return { content: data.content || stdout, agent: data.agent || 'auto', model: data.model || 'unknown' }
  } catch {
    return { content: stdout.trim(), agent: 'auto', model: 'unknown' }
  }
}

server.tool(
  'local_kbot',
  'Send a message to the K:BOT agent running locally via the kbot CLI. Routes to the best specialist agent or you can specify one. Uses local Ollama models at $0 cost. Use this for getting a second opinion, delegating subtasks, or accessing K:BOT\'s specialist knowledge without any API charges. Each call spawns a kbot process with a 2-minute timeout. Does not retain conversation history between calls.',
  {
    message: z.string().min(1).max(50000).describe('The message or task for K:BOT'),
    agent: z.string().max(50).regex(/^[a-zA-Z0-9_-]*$/).optional().describe('Force a specific agent: kernel, researcher, coder, writer, analyst, hacker, operator, dreamer (default: auto-route based on message content)'),
    model: z.string().max(50).regex(/^[a-zA-Z0-9._:-]*$/).optional().describe('Override model name (default: auto-selects best local Ollama model for the task)'),
  },
  safeHandler(async ({ message, agent, model }) => {
    const result = await callKbot(message, { agent, model })
    return {
      content: [{
        type: 'text' as const,
        text: `[K:BOT · ${result.agent} · ${result.model} · $0]\n\n${result.content}`,
      }],
    }
  })
)

server.tool(
  'local_kbot_agents',
  'List all available K:BOT specialist agents with their IDs and descriptions. Runs the kbot CLI agents command locally. Read-only operation with no side effects. Use this to discover which agents are available before calling local_kbot with a specific agent.',
  {},
  safeHandler(async () => {
    const { stdout } = await execFileAsync('kbot', ['agents'], {
      timeout: 10_000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })
    return {
      content: [{ type: 'text' as const, text: `[K:BOT Agents]\n\n${stdout.trim()}` }],
    }
  })
)

// ── Start ───────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
