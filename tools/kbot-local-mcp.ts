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
      return {
        content: [{ type: 'text' as const, text: `K:BOT Local error: ${err instanceof Error ? err.message : String(err)}` }],
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
  'Ask a question to a local AI model running on Ollama. Free, private, instant. Use for quick research, explanations, brainstorming, or getting a second opinion. Auto-selects the best model for the task.',
  {
    prompt: z.string().describe('The question or task for the local model'),
    model: z.string().optional().describe('Specific model to use (default: auto-selects best model for task)'),
    system: z.string().optional().describe('Optional system prompt to set context'),
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
  'Get a free code review from a local AI model. Pass code or a diff and get feedback on quality, bugs, security, and style. Uses a code-specialized model.',
  {
    code: z.string().describe('The code or diff to review'),
    language: z.string().optional().describe('Programming language (default: auto-detect)'),
    focus: z.string().optional().describe('What to focus on: bugs, security, performance, style, all (default: all)'),
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
  'Generate code using a local AI model. Free code generation for boilerplate, utilities, tests, and prototypes. Uses a code-specialized model.',
  {
    task: z.string().describe('What code to generate'),
    language: z.string().optional().describe('Target language (default: TypeScript)'),
    context: z.string().optional().describe('Additional context like existing types or API signatures'),
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
  'List all locally available Ollama models and check if Ollama is running.',
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
  'Get a free explanation of code, concepts, or errors from a local AI model. Great for understanding stack traces, library APIs, or complex logic.',
  {
    topic: z.string().describe('What to explain — code snippet, error message, concept, etc.'),
    depth: z.enum(['brief', 'detailed']).optional().describe('How deep the explanation should go (default: brief)'),
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
  'Analyze an image using a local vision model (llava). Describe screenshots, read diagrams, identify UI elements, extract text from images. Pass base64-encoded image data.',
  {
    image: z.string().describe('Base64-encoded image data (PNG, JPG, WebP)'),
    prompt: z.string().optional().describe('What to look for or analyze (default: "Describe this image in detail")'),
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
  'Generate a conventional commit message from a git diff. Pass the diff output and get back a well-formatted commit message with type, scope, and description.',
  {
    diff: z.string().describe('The git diff output to generate a commit message for'),
    style: z.enum(['conventional', 'simple', 'detailed']).optional().describe('Commit message style (default: conventional)'),
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
  'Generate unit tests for code. Pass a function, class, or module and get back test scaffolding. Uses code-specialized models.',
  {
    code: z.string().describe('The code to generate tests for'),
    framework: z.string().optional().describe('Test framework: vitest, jest, pytest, go, rust (default: auto-detect)'),
    language: z.string().optional().describe('Programming language (default: auto-detect from code)'),
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
  'Refactor code with a specific goal. Pass code and an intent like "extract function", "simplify", "add error handling". Returns refactored version with explanation.',
  {
    code: z.string().describe('The code to refactor'),
    intent: z.string().describe('What to improve: "simplify", "extract function", "add types", "reduce duplication", "improve readability"'),
    language: z.string().optional().describe('Programming language (default: auto-detect)'),
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
  'Generate and explain regex patterns. Describe what you want to match and get back a tested regex with explanation.',
  {
    description: z.string().describe('What the regex should match, e.g. "email addresses" or "ISO dates"'),
    flavor: z.enum(['javascript', 'python', 'go', 'rust', 'pcre']).optional().describe('Regex flavor (default: javascript)'),
    test_strings: z.string().optional().describe('Sample strings to test against (one per line)'),
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
  'Analyze a code diff and explain what changed, potential issues, and side effects. Great for PR review prep.',
  {
    diff: z.string().describe('The diff to analyze (git diff output or before/after code)'),
    context: z.string().optional().describe('Additional context about the codebase or change intent'),
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
  'Generate documentation from code. Pass a function, class, or module and get JSDoc, docstrings, or README sections.',
  {
    code: z.string().describe('The code to document'),
    format: z.enum(['jsdoc', 'docstring', 'readme', 'api']).optional().describe('Documentation format (default: jsdoc)'),
    language: z.string().optional().describe('Programming language (default: auto-detect)'),
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
  'Convert data between formats: JSON, YAML, TOML, CSV, XML, TypeScript interfaces. Also infers schemas from data.',
  {
    input: z.string().describe('The data to convert'),
    from: z.string().describe('Source format: json, yaml, toml, csv, xml, or "auto"'),
    to: z.string().describe('Target format: json, yaml, toml, csv, xml, typescript, zod, jsonschema'),
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
  'Generate SQL queries from natural language. Optionally provide a schema for accurate table/column references.',
  {
    question: z.string().describe('What you want to query, e.g. "all users who signed up last week"'),
    schema: z.string().optional().describe('Database schema (CREATE TABLE statements or table descriptions)'),
    dialect: z.enum(['postgresql', 'mysql', 'sqlite', 'mssql']).optional().describe('SQL dialect (default: postgresql)'),
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
  'Translate text between natural languages. Great for i18n strings, documentation, or user-facing copy.',
  {
    text: z.string().describe('The text to translate'),
    to: z.string().describe('Target language (e.g. "Spanish", "Japanese", "French", "zh-CN")'),
    from: z.string().optional().describe('Source language (default: auto-detect)'),
    context: z.string().optional().describe('Context for better translation (e.g. "UI button label", "error message", "marketing copy")'),
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
  'Summarize long text, logs, docs, or articles. Handles large inputs by chunking.',
  {
    text: z.string().describe('The text to summarize'),
    style: z.enum(['bullets', 'paragraph', 'tldr', 'technical']).optional().describe('Summary style (default: bullets)'),
    max_length: z.number().optional().describe('Approximate max words for the summary (default: 200)'),
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
  'Explain what a shell command does. Break down flags, pipes, and redirections. Never executes — only explains.',
  {
    command: z.string().describe('The shell command to explain'),
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
  'Generate Mermaid or PlantUML diagrams from natural language descriptions. Outputs diagram code you can render anywhere.',
  {
    description: z.string().describe('What to diagram, e.g. "OAuth login flow" or "database schema for a blog"'),
    type: z.enum(['flowchart', 'sequence', 'class', 'er', 'state', 'gantt']).optional().describe('Diagram type (default: auto-detect)'),
    format: z.enum(['mermaid', 'plantuml']).optional().describe('Output format (default: mermaid)'),
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
  'Generate text embeddings using a local embedding model (nomic-embed-text). Returns a vector for semantic search, clustering, or similarity comparison.',
  {
    text: z.string().describe('The text to embed'),
    model: z.string().optional().describe('Embedding model (default: nomic-embed-text)'),
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
  'Send a message to K:BOT agent. Routes to the best specialist (coder, researcher, writer, analyst, hacker, etc.) or specify one. Uses local Ollama models — $0 cost. Great for getting a second opinion, delegating subtasks, or accessing K:BOT specialist knowledge.',
  {
    message: z.string().describe('The message or task for K:BOT'),
    agent: z.string().optional().describe('Force a specific agent: kernel, researcher, coder, writer, analyst, hacker, operator, dreamer (default: auto-route)'),
    model: z.string().optional().describe('Override model (default: auto-selects best local model)'),
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
  'List all available K:BOT specialist agents with descriptions.',
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
