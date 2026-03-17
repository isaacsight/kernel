// K:BOT Training & Fine-Tuning Tools
//
// Prepare datasets, launch fine-tuning jobs (cloud + local), monitor training,
// evaluate results, export/convert models, deploy, and estimate costs.
//
// Tools:
//   train_prepare   — Convert data into training formats (JSONL/Alpaca/ShareGPT)
//   train_validate  — Validate a training dataset before launching
//   train_start     — Launch fine-tuning (OpenAI, Together, Mistral, MLX, Unsloth, llama.cpp)
//   train_status    — Check training job status (cloud or local)
//   train_evaluate  — Evaluate a fine-tuned model against test data
//   train_export    — Merge LoRA, convert to GGUF, quantize
//   train_deploy    — Deploy to Ollama, HuggingFace, or K:BOT local
//   train_cost      — Estimate training cost, time, and VRAM

import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, basename, extname, dirname } from 'node:path'
import { homedir, cpus } from 'node:os'
import { registerTool } from './index.js'

// ── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface JsonlExample {
  messages: ChatMessage[]
}

interface AlpacaExample {
  instruction: string
  input: string
  output: string
}

interface ShareGptTurn {
  from: 'human' | 'gpt' | 'system'
  value: string
}

interface ShareGptExample {
  conversations: ShareGptTurn[]
}

type TrainingFormat = 'jsonl' | 'alpaca' | 'sharegpt'

type CloudBackend = 'openai' | 'together' | 'mistral'
type LocalBackend = 'mlx' | 'unsloth' | 'llama-cpp'
type Backend = CloudBackend | LocalBackend

interface ValidationIssue {
  line: number
  severity: 'error' | 'warning'
  message: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function shell(cmd: string, opts?: { timeout?: number; cwd?: string; env?: Record<string, string> }): string {
  return execSync(cmd, {
    encoding: 'utf-8',
    timeout: opts?.timeout ?? 60_000,
    maxBuffer: 50 * 1024 * 1024,
    cwd: opts?.cwd ?? process.cwd(),
    env: opts?.env ?? (process.env as Record<string, string>),
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

function shellSafe(cmd: string, opts?: { timeout?: number; cwd?: string; env?: Record<string, string> }): { ok: boolean; output: string } {
  try {
    const output = shell(cmd, opts)
    return { ok: true, output }
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim()
    return { ok: false, output: output || e.message || 'Command failed' }
  }
}

function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', timeout: 5_000, stdio: ['pipe', 'pipe', 'pipe'] })
    return true
  } catch {
    return false
  }
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4)
}

function readKbotConfig(): Record<string, unknown> {
  const configPath = join(homedir(), '.kbot', 'config.json')
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

function getApiKey(backend: CloudBackend, explicit?: string): string | null {
  if (explicit) return explicit

  // Check environment variables
  const envVarMap: Record<CloudBackend, string[]> = {
    openai: ['OPENAI_API_KEY'],
    together: ['TOGETHER_API_KEY', 'TOGETHER_AI_KEY'],
    mistral: ['MISTRAL_API_KEY'],
  }

  for (const envVar of envVarMap[backend]) {
    if (process.env[envVar]) return process.env[envVar]!
  }

  // Check ~/.kbot/config.json
  const config = readKbotConfig()
  const configKeyMap: Record<CloudBackend, string[]> = {
    openai: ['openai_api_key', 'openaiApiKey'],
    together: ['together_api_key', 'togetherApiKey'],
    mistral: ['mistral_api_key', 'mistralApiKey'],
  }

  for (const key of configKeyMap[backend]) {
    if (config[key] && typeof config[key] === 'string') return config[key] as string
  }

  return null
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Recursively collect files from a directory matching given extensions */
function collectFiles(dirPath: string, extensions: string[]): string[] {
  const results: string[] = []
  if (!existsSync(dirPath)) return results

  const stat = statSync(dirPath)
  if (stat.isFile()) {
    const ext = extname(dirPath).toLowerCase()
    if (extensions.length === 0 || extensions.includes(ext)) {
      results.push(dirPath)
    }
    return results
  }

  if (!stat.isDirectory()) return results

  const entries = readdirSync(dirPath)
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const fullPath = join(dirPath, entry)
    const entryStat = statSync(fullPath)
    if (entryStat.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions))
    } else {
      const ext = extname(entry).toLowerCase()
      if (extensions.length === 0 || extensions.includes(ext)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

// ── Source parsing helpers ────────────────────────────────────────────

/** Extract instruction/response pairs from a JSON conversation file */
function parseConversationJson(content: string): Array<{ instruction: string; response: string }> {
  const pairs: Array<{ instruction: string; response: string }> = []
  try {
    const data = JSON.parse(content)

    // Handle array of messages
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length - 1; i++) {
        const curr = data[i]
        const next = data[i + 1]
        if (
          (curr.role === 'user' || curr.from === 'human') &&
          (next.role === 'assistant' || next.from === 'gpt' || next.from === 'assistant')
        ) {
          pairs.push({
            instruction: curr.content || curr.value || curr.text || '',
            response: next.content || next.value || next.text || '',
          })
          i++ // skip the response message
        }
      }
    }

    // Handle object with messages array
    if (data.messages && Array.isArray(data.messages)) {
      return parseConversationJson(JSON.stringify(data.messages))
    }

    // Handle object with conversations array
    if (data.conversations && Array.isArray(data.conversations)) {
      return parseConversationJson(JSON.stringify(data.conversations))
    }

    // Handle array of conversation objects
    if (Array.isArray(data) && data.length > 0 && (data[0].messages || data[0].conversations)) {
      for (const item of data) {
        const msgs = item.messages || item.conversations
        if (Array.isArray(msgs)) {
          pairs.push(...parseConversationJson(JSON.stringify(msgs)))
        }
      }
    }
  } catch {
    // Not valid JSON — skip
  }
  return pairs
}

/** Extract instruction/response pairs from markdown (headings -> content) */
function parseMarkdown(content: string): Array<{ instruction: string; response: string }> {
  const pairs: Array<{ instruction: string; response: string }> = []
  const sections = content.split(/^(#{1,6}\s+.+)$/m)

  for (let i = 1; i < sections.length - 1; i += 2) {
    const heading = sections[i].replace(/^#+\s+/, '').trim()
    const body = sections[i + 1].trim()
    if (heading && body && body.length > 20) {
      pairs.push({ instruction: heading, response: body })
    }
  }
  return pairs
}

/** Extract instruction/response pairs from code files (docstrings + implementations) */
function parseCodeFile(content: string, ext: string): Array<{ instruction: string; response: string }> {
  const pairs: Array<{ instruction: string; response: string }> = []

  if (['.py'].includes(ext)) {
    // Python: extract function definitions with docstrings
    const funcPattern = /^(def\s+\w+\s*\([^)]*\)(?:\s*->\s*[^:]+)?)\s*:\s*\n\s*("""[\s\S]*?"""|'''[\s\S]*?''')\s*\n([\s\S]*?)(?=\ndef\s|\nclass\s|$)/gm
    let match
    while ((match = funcPattern.exec(content)) !== null) {
      const signature = match[1].trim()
      const docstring = match[2].replace(/^("""|''')|("""|''')$/g, '').trim()
      const body = match[0].trim()
      if (docstring && body) {
        pairs.push({
          instruction: `Write a Python function: ${signature}\n\nDescription: ${docstring}`,
          response: body,
        })
      }
    }
  }

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    // TypeScript/JavaScript: extract functions with JSDoc
    const funcPattern = /(\/\*\*[\s\S]*?\*\/)\s*\n\s*((?:export\s+)?(?:async\s+)?(?:function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)=>)[\s\S]*?)(?=\n\/\*\*|\nexport\s+(?:default\s+)?(?:function|const|class|interface|type)|\nclass\s|$)/gm
    let match
    while ((match = funcPattern.exec(content)) !== null) {
      const jsdoc = match[1].replace(/\/\*\*|\*\/|\*\s?/g, '').trim()
      const impl = match[2].trim()
      if (jsdoc && impl && impl.length > 30) {
        // Extract function name from implementation
        const nameMatch = impl.match(/(?:function\s+(\w+)|(?:const|let)\s+(\w+))/)
        const funcName = nameMatch ? (nameMatch[1] || nameMatch[2]) : 'function'
        pairs.push({
          instruction: `Write a TypeScript function \`${funcName}\`: ${jsdoc}`,
          response: impl,
        })
      }
    }
  }

  if (['.rs'].includes(ext)) {
    // Rust: extract functions with doc comments
    const funcPattern = /((?:\/\/\/.*\n)+)\s*(pub\s+(?:async\s+)?fn\s+\w+[\s\S]*?)(?=\n\/\/\/|\npub\s+(?:async\s+)?fn|\nfn\s|\nimpl\s|$)/gm
    let match
    while ((match = funcPattern.exec(content)) !== null) {
      const docComment = match[1].replace(/\/\/\/\s?/g, '').trim()
      const impl = match[2].trim()
      if (docComment && impl) {
        const nameMatch = impl.match(/fn\s+(\w+)/)
        const funcName = nameMatch ? nameMatch[1] : 'function'
        pairs.push({
          instruction: `Write a Rust function \`${funcName}\`: ${docComment}`,
          response: impl,
        })
      }
    }
  }

  if (['.go'].includes(ext)) {
    // Go: extract functions with doc comments
    const funcPattern = /((?:\/\/.*\n)+)\s*(func\s+(?:\([^)]*\)\s+)?\w+[\s\S]*?)(?=\n\/\/|\nfunc\s|$)/gm
    let match
    while ((match = funcPattern.exec(content)) !== null) {
      const docComment = match[1].replace(/\/\/\s?/g, '').trim()
      const impl = match[2].trim()
      if (docComment && impl) {
        const nameMatch = impl.match(/func\s+(?:\([^)]*\)\s+)?(\w+)/)
        const funcName = nameMatch ? nameMatch[1] : 'function'
        pairs.push({
          instruction: `Write a Go function \`${funcName}\`: ${docComment}`,
          response: impl,
        })
      }
    }
  }

  return pairs
}

/** Convert pairs to the target training format */
function formatExample(
  pair: { instruction: string; response: string },
  format: TrainingFormat,
  systemPrompt?: string,
): string {
  switch (format) {
    case 'jsonl': {
      const messages: ChatMessage[] = []
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
      messages.push({ role: 'user', content: pair.instruction })
      messages.push({ role: 'assistant', content: pair.response })
      return JSON.stringify({ messages })
    }
    case 'alpaca': {
      const example: AlpacaExample = {
        instruction: pair.instruction,
        input: '',
        output: pair.response,
      }
      return JSON.stringify(example)
    }
    case 'sharegpt': {
      const conversations: ShareGptTurn[] = []
      if (systemPrompt) conversations.push({ from: 'system', value: systemPrompt })
      conversations.push({ from: 'human', value: pair.instruction })
      conversations.push({ from: 'gpt', value: pair.response })
      return JSON.stringify({ conversations })
    }
  }
}

// ── BLEU score helper ────────────────────────────────────────────────

function computeNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>()
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ')
    ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1)
  }
  return ngrams
}

function bleuScore(reference: string, candidate: string, maxN = 4): number {
  const refTokens = reference.toLowerCase().split(/\s+/).filter(Boolean)
  const candTokens = candidate.toLowerCase().split(/\s+/).filter(Boolean)

  if (candTokens.length === 0 || refTokens.length === 0) return 0

  let logBleu = 0
  let count = 0

  for (let n = 1; n <= Math.min(maxN, candTokens.length); n++) {
    const refNgrams = computeNgrams(refTokens, n)
    const candNgrams = computeNgrams(candTokens, n)

    let clippedCount = 0
    let totalCount = 0

    for (const [ngram, candCount] of candNgrams) {
      const refCount = refNgrams.get(ngram) || 0
      clippedCount += Math.min(candCount, refCount)
      totalCount += candCount
    }

    if (totalCount === 0) continue

    const precision = clippedCount / totalCount
    if (precision === 0) return 0
    logBleu += Math.log(precision)
    count++
  }

  if (count === 0) return 0

  // Brevity penalty
  const bp = candTokens.length >= refTokens.length
    ? 1
    : Math.exp(1 - refTokens.length / candTokens.length)

  return bp * Math.exp(logBleu / count)
}

// ── Model size estimation helpers ────────────────────────────────────

/** Estimate parameter count from model name */
function estimateModelParams(modelName: string): number {
  const name = modelName.toLowerCase()
  // Common model size patterns
  const sizePatterns: Array<[RegExp, number]> = [
    [/(\d+)b/, 0],  // will capture
    [/(\d+\.?\d*)b/, 0],
    [/gpt-4/i, 200e9],
    [/gpt-3\.5/i, 7e9],
    [/gpt-4.1-mini/i, 8e9],
    [/gpt-4.1/i, 200e9],
    [/llama.*70b/i, 70e9],
    [/llama.*13b/i, 13e9],
    [/llama.*8b/i, 8e9],
    [/llama.*7b/i, 7e9],
    [/llama.*3b/i, 3e9],
    [/llama.*1b/i, 1e9],
    [/mistral.*7b/i, 7e9],
    [/mixtral/i, 47e9],
    [/phi.*3/i, 3.8e9],
    [/gemma.*7b/i, 7e9],
    [/gemma.*2b/i, 2e9],
    [/qwen.*72b/i, 72e9],
    [/qwen.*14b/i, 14e9],
    [/qwen.*7b/i, 7e9],
    [/qwen.*1\.8b/i, 1.8e9],
  ]

  // Try to extract explicit size (e.g., "7b", "13B", "70b")
  const sizeMatch = name.match(/(\d+\.?\d*)\s*b(?:illion)?/i)
  if (sizeMatch) {
    return parseFloat(sizeMatch[1]) * 1e9
  }

  for (const [pattern, size] of sizePatterns) {
    if (pattern.test(name) && size > 0) return size
  }

  // Default estimate for unknown models
  return 7e9
}

// ── Tool Registration ────────────────────────────────────────────────

export function registerTrainingTools(): void {

  // ── train_prepare ──────────────────────────────────────────────────
  registerTool({
    name: 'train_prepare',
    description:
      'Convert data into training formats for fine-tuning. Supports JSONL chat (OpenAI SFT), Alpaca, and ShareGPT formats. ' +
      'Auto-detects source type: conversation JSON, markdown, or code files with docstrings. ' +
      'Extracts instruction/response pairs and writes the output dataset.',
    parameters: {
      source: {
        type: 'string',
        description: 'Path to source file or directory containing training data',
        required: true,
      },
      format: {
        type: 'string',
        description: 'Output format: jsonl (OpenAI chat), alpaca, sharegpt (default: jsonl)',
      },
      output: {
        type: 'string',
        description: 'Output file path (default: <source>_prepared.<format>)',
      },
      system_prompt: {
        type: 'string',
        description: 'System prompt to prepend to each example (optional)',
      },
    },
    tier: 'pro',
    timeout: 300_000,
    async execute(args) {
      try {
        const sourcePath = resolve(String(args.source))
        const format = (String(args.format || 'jsonl').toLowerCase()) as TrainingFormat
        const systemPrompt = args.system_prompt ? String(args.system_prompt) : undefined

        if (!['jsonl', 'alpaca', 'sharegpt'].includes(format)) {
          return `Error: Invalid format "${format}". Use: jsonl, alpaca, sharegpt`
        }

        if (!existsSync(sourcePath)) {
          return `Error: Source path not found: ${sourcePath}`
        }

        // Collect all source files
        const stat = statSync(sourcePath)
        let sourceFiles: string[]

        if (stat.isFile()) {
          sourceFiles = [sourcePath]
        } else {
          sourceFiles = collectFiles(sourcePath, [
            '.json', '.jsonl', '.md', '.markdown',
            '.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go',
          ])
        }

        if (sourceFiles.length === 0) {
          return `Error: No supported source files found in ${sourcePath}\n\nSupported: .json, .jsonl, .md, .py, .ts, .js, .rs, .go`
        }

        // Extract pairs from all sources
        const allPairs: Array<{ instruction: string; response: string }> = []

        for (const file of sourceFiles) {
          const content = readFileSync(file, 'utf-8')
          const ext = extname(file).toLowerCase()

          if (ext === '.json') {
            allPairs.push(...parseConversationJson(content))
          } else if (ext === '.jsonl') {
            // Each line is a JSON object
            const lines = content.split('\n').filter(l => l.trim())
            for (const line of lines) {
              try {
                const obj = JSON.parse(line)
                if (obj.messages) {
                  allPairs.push(...parseConversationJson(JSON.stringify(obj.messages)))
                } else if (obj.instruction && obj.output) {
                  allPairs.push({ instruction: obj.instruction, response: obj.output })
                } else if (obj.conversations) {
                  allPairs.push(...parseConversationJson(JSON.stringify(obj.conversations)))
                }
              } catch { /* skip malformed lines */ }
            }
          } else if (ext === '.md' || ext === '.markdown') {
            allPairs.push(...parseMarkdown(content))
          } else {
            // Code files
            allPairs.push(...parseCodeFile(content, ext))
          }
        }

        if (allPairs.length === 0) {
          return [
            `No instruction/response pairs extracted from ${sourceFiles.length} files.`,
            '',
            'Tips:',
            '  - JSON files should have messages with role/content or from/value fields',
            '  - Markdown files should have headings followed by content paragraphs',
            '  - Code files should have functions with docstrings/JSDoc/doc comments',
          ].join('\n')
        }

        // Format all pairs
        const outputLines = allPairs.map(pair => formatExample(pair, format, systemPrompt))

        // Determine output path
        const outputExt = format === 'jsonl' ? '.jsonl' : '.json'
        let outputPath: string
        if (args.output) {
          outputPath = resolve(String(args.output))
        } else {
          const srcBase = stat.isFile()
            ? sourcePath.replace(extname(sourcePath), '')
            : sourcePath.replace(/\/$/, '')
          outputPath = `${srcBase}_prepared${outputExt}`
        }

        // Write output
        mkdirSync(dirname(outputPath), { recursive: true })
        if (format === 'jsonl') {
          writeFileSync(outputPath, outputLines.join('\n') + '\n', 'utf-8')
        } else {
          // For alpaca and sharegpt, write as a JSON array
          const parsed = outputLines.map(l => JSON.parse(l))
          writeFileSync(outputPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
        }

        // Calculate stats
        const totalChars = allPairs.reduce((sum, p) => sum + p.instruction.length + p.response.length, 0)
        const estimatedTokens = estimateTokens(allPairs.reduce((s, p) => s + p.instruction + p.response, ''))

        return [
          `Training data prepared successfully.`,
          '',
          `  Format:     ${format}`,
          `  Source:      ${sourceFiles.length} file(s)`,
          `  Examples:    ${allPairs.length}`,
          `  Est. tokens: ~${estimatedTokens.toLocaleString()} (~${totalChars.toLocaleString()} chars)`,
          `  Output:      ${outputPath}`,
          '',
          `File size: ${(statSync(outputPath).size / 1024).toFixed(1)} KB`,
        ].join('\n')
      } catch (err) {
        return `Error preparing training data: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_validate ─────────────────────────────────────────────────
  registerTool({
    name: 'train_validate',
    description:
      'Validate a training dataset before starting a fine-tuning job. Checks format correctness, ' +
      'duplicates, token length distribution, empty examples, and system prompt consistency. ' +
      'Reports warnings and errors with line numbers.',
    parameters: {
      dataset: {
        type: 'string',
        description: 'Path to the training dataset file',
        required: true,
      },
      format: {
        type: 'string',
        description: 'Dataset format: jsonl, alpaca, sharegpt (default: jsonl)',
      },
    },
    tier: 'pro',
    timeout: 120_000,
    async execute(args) {
      try {
        const datasetPath = resolve(String(args.dataset))
        const format = (String(args.format || 'jsonl').toLowerCase()) as TrainingFormat

        if (!existsSync(datasetPath)) {
          return `Error: Dataset not found: ${datasetPath}`
        }

        const content = readFileSync(datasetPath, 'utf-8')
        const issues: ValidationIssue[] = []
        const tokenCounts: number[] = []
        const normalizedTexts = new Set<string>()
        const systemPrompts = new Map<string, number>()
        let totalExamples = 0
        let emptyCount = 0
        let duplicateCount = 0

        const lines = format === 'jsonl'
          ? content.split('\n').filter(l => l.trim())
          : (() => {
              try {
                const parsed = JSON.parse(content)
                return Array.isArray(parsed) ? parsed.map((item: unknown) => JSON.stringify(item)) : [content]
              } catch {
                return content.split('\n').filter(l => l.trim())
              }
            })()

        for (let i = 0; i < lines.length; i++) {
          const lineNum = i + 1
          const line = typeof lines[i] === 'string' ? lines[i] as string : String(lines[i])

          // Parse JSON
          let obj: Record<string, unknown>
          try {
            obj = JSON.parse(line)
          } catch {
            issues.push({ line: lineNum, severity: 'error', message: 'Invalid JSON' })
            continue
          }

          totalExamples++

          // Format-specific validation
          if (format === 'jsonl') {
            if (!obj.messages || !Array.isArray(obj.messages)) {
              issues.push({ line: lineNum, severity: 'error', message: 'Missing "messages" array' })
              continue
            }
            const msgs = obj.messages as ChatMessage[]
            if (msgs.length < 2) {
              issues.push({ line: lineNum, severity: 'error', message: `Only ${msgs.length} message(s) — need at least user + assistant` })
              continue
            }

            // Check roles
            const hasUser = msgs.some(m => m.role === 'user')
            const hasAssistant = msgs.some(m => m.role === 'assistant')
            if (!hasUser) issues.push({ line: lineNum, severity: 'error', message: 'No "user" role message found' })
            if (!hasAssistant) issues.push({ line: lineNum, severity: 'error', message: 'No "assistant" role message found' })

            for (let j = 0; j < msgs.length; j++) {
              const m = msgs[j]
              if (!m.role || !['system', 'user', 'assistant'].includes(m.role)) {
                issues.push({ line: lineNum, severity: 'error', message: `Message ${j}: invalid role "${m.role}"` })
              }
              if (!m.content || typeof m.content !== 'string') {
                issues.push({ line: lineNum, severity: 'error', message: `Message ${j}: missing or non-string content` })
              }
            }

            // Track system prompts
            const sysMsg = msgs.find(m => m.role === 'system')
            if (sysMsg?.content) {
              const key = normalizeText(sysMsg.content)
              systemPrompts.set(key, (systemPrompts.get(key) || 0) + 1)
            }

            // Token count
            const fullText = msgs.map(m => m.content || '').join(' ')
            const tokens = estimateTokens(fullText)
            tokenCounts.push(tokens)

            // Empty check
            const userMsg = msgs.find(m => m.role === 'user')
            const assistantMsg = msgs.find(m => m.role === 'assistant')
            if ((userMsg?.content?.length || 0) < 5 || (assistantMsg?.content?.length || 0) < 5) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Very short user or assistant message (< 5 chars)' })
              emptyCount++
            }

            // Duplicate check
            const normalized = normalizeText(fullText)
            if (normalizedTexts.has(normalized)) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Duplicate or near-duplicate example' })
              duplicateCount++
            }
            normalizedTexts.add(normalized)

          } else if (format === 'alpaca') {
            if (!obj.instruction || typeof obj.instruction !== 'string') {
              issues.push({ line: lineNum, severity: 'error', message: 'Missing or non-string "instruction" field' })
            }
            if (!obj.output || typeof obj.output !== 'string') {
              issues.push({ line: lineNum, severity: 'error', message: 'Missing or non-string "output" field' })
            }
            if (obj.instruction && (obj.instruction as string).length < 5) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Very short instruction (< 5 chars)' })
              emptyCount++
            }
            if (obj.output && (obj.output as string).length < 5) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Very short output (< 5 chars)' })
            }

            const fullText = `${obj.instruction || ''} ${obj.input || ''} ${obj.output || ''}`
            tokenCounts.push(estimateTokens(fullText))

            const normalized = normalizeText(fullText)
            if (normalizedTexts.has(normalized)) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Duplicate or near-duplicate example' })
              duplicateCount++
            }
            normalizedTexts.add(normalized)

          } else if (format === 'sharegpt') {
            if (!obj.conversations || !Array.isArray(obj.conversations)) {
              issues.push({ line: lineNum, severity: 'error', message: 'Missing "conversations" array' })
              continue
            }
            const convs = obj.conversations as ShareGptTurn[]
            if (convs.length < 2) {
              issues.push({ line: lineNum, severity: 'error', message: `Only ${convs.length} turn(s) — need at least human + gpt` })
            }

            const hasHuman = convs.some(c => c.from === 'human')
            const hasGpt = convs.some(c => c.from === 'gpt')
            if (!hasHuman) issues.push({ line: lineNum, severity: 'error', message: 'No "human" turn found' })
            if (!hasGpt) issues.push({ line: lineNum, severity: 'error', message: 'No "gpt" turn found' })

            for (let j = 0; j < convs.length; j++) {
              if (!convs[j].from || !['human', 'gpt', 'system'].includes(convs[j].from)) {
                issues.push({ line: lineNum, severity: 'error', message: `Turn ${j}: invalid "from" value "${convs[j].from}"` })
              }
              if (!convs[j].value || typeof convs[j].value !== 'string') {
                issues.push({ line: lineNum, severity: 'error', message: `Turn ${j}: missing or non-string "value"` })
              }
            }

            // Track system prompts
            const sysTurn = convs.find(c => c.from === 'system')
            if (sysTurn?.value) {
              const key = normalizeText(sysTurn.value)
              systemPrompts.set(key, (systemPrompts.get(key) || 0) + 1)
            }

            const fullText = convs.map(c => c.value || '').join(' ')
            tokenCounts.push(estimateTokens(fullText))

            const normalized = normalizeText(fullText)
            if (normalizedTexts.has(normalized)) {
              issues.push({ line: lineNum, severity: 'warning', message: 'Duplicate or near-duplicate example' })
              duplicateCount++
            }
            normalizedTexts.add(normalized)
          }
        }

        // Compute token stats
        const sortedTokens = [...tokenCounts].sort((a, b) => a - b)
        const minTokens = sortedTokens[0] || 0
        const maxTokens = sortedTokens[sortedTokens.length - 1] || 0
        const meanTokens = tokenCounts.length > 0
          ? Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length)
          : 0
        const p95Index = Math.floor(tokenCounts.length * 0.95)
        const p95Tokens = sortedTokens[p95Index] || maxTokens

        const errors = issues.filter(i => i.severity === 'error')
        const warnings = issues.filter(i => i.severity === 'warning')

        // System prompt consistency
        let systemPromptNote = ''
        if (systemPrompts.size > 1) {
          systemPromptNote = `\n  System prompts: ${systemPrompts.size} unique variants (inconsistent — consider standardizing)`
        } else if (systemPrompts.size === 1) {
          const [prompt, count] = [...systemPrompts.entries()][0]
          systemPromptNote = `\n  System prompt:  consistent across ${count} examples ("${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}")`
        } else {
          systemPromptNote = '\n  System prompt:  none found'
        }

        // Build report
        const report: string[] = [
          `Dataset Validation Report`,
          `${'='.repeat(50)}`,
          '',
          `  File:        ${datasetPath}`,
          `  Format:      ${format}`,
          `  Examples:    ${totalExamples}`,
          `  Errors:      ${errors.length}`,
          `  Warnings:    ${warnings.length}`,
          `  Duplicates:  ${duplicateCount}`,
          `  Short/empty: ${emptyCount}`,
          systemPromptNote,
          '',
          `Token Distribution`,
          `${'─'.repeat(30)}`,
          `  Min:  ${minTokens}`,
          `  Max:  ${maxTokens}`,
          `  Mean: ${meanTokens}`,
          `  P95:  ${p95Tokens}`,
          `  Total: ~${tokenCounts.reduce((a, b) => a + b, 0).toLocaleString()} tokens`,
        ]

        if (errors.length > 0) {
          report.push('', `Errors (${errors.length})`, '─'.repeat(30))
          for (const issue of errors.slice(0, 25)) {
            report.push(`  Line ${issue.line}: ${issue.message}`)
          }
          if (errors.length > 25) {
            report.push(`  ... and ${errors.length - 25} more errors`)
          }
        }

        if (warnings.length > 0) {
          report.push('', `Warnings (${warnings.length})`, '─'.repeat(30))
          for (const issue of warnings.slice(0, 15)) {
            report.push(`  Line ${issue.line}: ${issue.message}`)
          }
          if (warnings.length > 15) {
            report.push(`  ... and ${warnings.length - 15} more warnings`)
          }
        }

        // Verdict
        report.push('')
        if (errors.length === 0 && warnings.length === 0) {
          report.push('Verdict: PASS — Dataset is clean and ready for training.')
        } else if (errors.length === 0) {
          report.push(`Verdict: PASS with warnings — ${warnings.length} warning(s) found but no blocking errors.`)
        } else {
          report.push(`Verdict: FAIL — ${errors.length} error(s) must be fixed before training.`)
        }

        return report.join('\n')
      } catch (err) {
        return `Validation error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_start ────────────────────────────────────────────────────
  registerTool({
    name: 'train_start',
    description:
      'Launch a fine-tuning job. Supports cloud backends (OpenAI, Together AI, Mistral) and ' +
      'local backends (MLX on Apple Silicon, Unsloth, llama.cpp). For cloud: uploads dataset and creates job. ' +
      'For local: detects tool installation and launches the training process.',
    parameters: {
      dataset: {
        type: 'string',
        description: 'Path to training dataset file',
        required: true,
      },
      backend: {
        type: 'string',
        description: 'Training backend: openai, together, mistral, mlx, unsloth, llama-cpp',
        required: true,
      },
      base_model: {
        type: 'string',
        description: 'Base model to fine-tune (e.g., gpt-4.1-mini, meta-llama/Llama-3-8B, mlx-community/Llama-3-8B-4bit)',
        required: true,
      },
      output: {
        type: 'string',
        description: 'Output path for local training (default: ./output/<model>-ft)',
      },
      epochs: {
        type: 'number',
        description: 'Number of training epochs (default: 3)',
      },
      learning_rate: {
        type: 'number',
        description: 'Learning rate (default: 1e-4 for local, auto for cloud)',
      },
      batch_size: {
        type: 'number',
        description: 'Batch size (default: 4)',
      },
      lora_rank: {
        type: 'number',
        description: 'LoRA rank for local training (default: 16)',
      },
      lora_alpha: {
        type: 'number',
        description: 'LoRA alpha for local training (default: 32)',
      },
      api_key: {
        type: 'string',
        description: 'API key for cloud backends (optional — reads from env or ~/.kbot/config.json)',
      },
    },
    tier: 'pro',
    timeout: 600_000,
    async execute(args) {
      try {
        const datasetPath = resolve(String(args.dataset))
        const backend = String(args.backend).toLowerCase() as Backend
        const baseModel = String(args.base_model)
        const epochs = typeof args.epochs === 'number' ? args.epochs : 3
        const batchSize = typeof args.batch_size === 'number' ? args.batch_size : 4
        const loraRank = typeof args.lora_rank === 'number' ? args.lora_rank : 16
        const loraAlpha = typeof args.lora_alpha === 'number' ? args.lora_alpha : 32
        const learningRate = typeof args.learning_rate === 'number' ? args.learning_rate : 1e-4

        if (!existsSync(datasetPath)) {
          return `Error: Dataset not found: ${datasetPath}`
        }

        const validBackends: Backend[] = ['openai', 'together', 'mistral', 'mlx', 'unsloth', 'llama-cpp']
        if (!validBackends.includes(backend)) {
          return `Error: Invalid backend "${backend}". Supported: ${validBackends.join(', ')}`
        }

        // Determine output directory for local backends
        const modelSlug = baseModel.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 50)
        const outputDir = args.output
          ? resolve(String(args.output))
          : resolve(process.cwd(), 'output', `${modelSlug}-ft`)

        // ── Cloud backends ───────────────────────────────────────────
        if (backend === 'openai' || backend === 'together' || backend === 'mistral') {
          const apiKey = getApiKey(backend, args.api_key ? String(args.api_key) : undefined)
          if (!apiKey) {
            const envVarHint = backend === 'openai' ? 'OPENAI_API_KEY'
              : backend === 'together' ? 'TOGETHER_API_KEY'
              : 'MISTRAL_API_KEY'
            return `Error: No API key found for ${backend}. Set ${envVarHint} env var, add to ~/.kbot/config.json, or pass api_key parameter.`
          }

          const datasetContent = readFileSync(datasetPath, 'utf-8')

          if (backend === 'openai') {
            // Step 1: Upload file
            const formData = new FormData()
            formData.append('purpose', 'fine-tune')
            formData.append('file', new Blob([datasetContent], { type: 'application/jsonl' }), basename(datasetPath))

            const uploadRes = await fetch('https://api.openai.com/v1/files', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              body: formData,
            })

            if (!uploadRes.ok) {
              const errBody = await uploadRes.text()
              return `Error uploading file to OpenAI: ${uploadRes.status} ${errBody}`
            }

            const uploadData = await uploadRes.json() as { id: string }
            const fileId = uploadData.id

            // Step 2: Create fine-tuning job
            const jobBody: Record<string, unknown> = {
              training_file: fileId,
              model: baseModel,
              hyperparameters: {
                n_epochs: epochs,
                batch_size: batchSize,
              },
            }
            if (args.learning_rate !== undefined) {
              (jobBody.hyperparameters as Record<string, unknown>).learning_rate_multiplier = learningRate
            }

            const jobRes = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(jobBody),
            })

            if (!jobRes.ok) {
              const errBody = await jobRes.text()
              return `Error creating OpenAI fine-tuning job: ${jobRes.status} ${errBody}`
            }

            const jobData = await jobRes.json() as { id: string; status: string; model: string }

            return [
              `OpenAI fine-tuning job created.`,
              '',
              `  Job ID:     ${jobData.id}`,
              `  Base model: ${baseModel}`,
              `  Status:     ${jobData.status}`,
              `  File ID:    ${fileId}`,
              `  Epochs:     ${epochs}`,
              `  Batch size: ${batchSize}`,
              '',
              `Check status with: train_status --job_id ${jobData.id} --backend openai`,
            ].join('\n')

          } else if (backend === 'together') {
            // Together AI fine-tuning
            const jobBody = {
              training_file: datasetPath,
              model: baseModel,
              n_epochs: epochs,
              learning_rate: learningRate,
              batch_size: batchSize,
            }

            // Together requires file upload first
            const formData = new FormData()
            formData.append('file', new Blob([datasetContent], { type: 'application/jsonl' }), basename(datasetPath))
            formData.append('purpose', 'fine-tune')

            const uploadRes = await fetch('https://api.together.xyz/v1/files', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              body: formData,
            })

            if (!uploadRes.ok) {
              const errBody = await uploadRes.text()
              return `Error uploading file to Together AI: ${uploadRes.status} ${errBody}`
            }

            const uploadData = await uploadRes.json() as { id: string }

            const jobRes = await fetch('https://api.together.xyz/v1/fine-tunes', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...jobBody,
                training_file: uploadData.id,
              }),
            })

            if (!jobRes.ok) {
              const errBody = await jobRes.text()
              return `Error creating Together AI fine-tuning job: ${jobRes.status} ${errBody}`
            }

            const jobData = await jobRes.json() as { id: string; status: string }

            return [
              `Together AI fine-tuning job created.`,
              '',
              `  Job ID:        ${jobData.id}`,
              `  Base model:    ${baseModel}`,
              `  Status:        ${jobData.status}`,
              `  Epochs:        ${epochs}`,
              `  Learning rate: ${learningRate}`,
              `  Batch size:    ${batchSize}`,
              '',
              `Check status with: train_status --job_id ${jobData.id} --backend together`,
            ].join('\n')

          } else if (backend === 'mistral') {
            // Mistral fine-tuning
            const formData = new FormData()
            formData.append('file', new Blob([datasetContent], { type: 'application/jsonl' }), basename(datasetPath))
            formData.append('purpose', 'fine-tune')

            const uploadRes = await fetch('https://api.mistral.ai/v1/files', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              body: formData,
            })

            if (!uploadRes.ok) {
              const errBody = await uploadRes.text()
              return `Error uploading file to Mistral: ${uploadRes.status} ${errBody}`
            }

            const uploadData = await uploadRes.json() as { id: string }

            const jobRes = await fetch('https://api.mistral.ai/v1/fine_tuning/jobs', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: baseModel,
                training_files: [{ file_id: uploadData.id, weight: 1 }],
                hyperparameters: {
                  training_steps: epochs * 100,  // Mistral uses steps
                  learning_rate: learningRate,
                },
              }),
            })

            if (!jobRes.ok) {
              const errBody = await jobRes.text()
              return `Error creating Mistral fine-tuning job: ${jobRes.status} ${errBody}`
            }

            const jobData = await jobRes.json() as { id: string; status: string }

            return [
              `Mistral fine-tuning job created.`,
              '',
              `  Job ID:        ${jobData.id}`,
              `  Base model:    ${baseModel}`,
              `  Status:        ${jobData.status}`,
              `  Epochs:        ${epochs}`,
              `  Learning rate: ${learningRate}`,
              '',
              `Check status with: train_status --job_id ${jobData.id} --backend mistral`,
            ].join('\n')
          }
        }

        // ── Local backends ───────────────────────────────────────────
        mkdirSync(outputDir, { recursive: true })

        if (backend === 'mlx') {
          // Check if mlx_lm is available
          const hasMlx = shellSafe('python3 -c "import mlx_lm; print(mlx_lm.__version__)"')
          if (!hasMlx.ok) {
            return [
              'MLX LM is not installed. Install it with:',
              '',
              '  pip install mlx-lm',
              '',
              'Requirements:',
              '  - Apple Silicon Mac (M1/M2/M3/M4)',
              '  - macOS 14+ (Sonoma)',
              '  - Python 3.10+',
            ].join('\n')
          }

          const iters = epochs * 100  // Rough: iters = epochs * (dataset_size / batch_size)
          const adapterPath = join(outputDir, 'adapters')
          mkdirSync(adapterPath, { recursive: true })

          const cmd = [
            'python3 -m mlx_lm.lora',
            `--model ${baseModel}`,
            `--data ${datasetPath}`,
            '--train',
            `--iters ${iters}`,
            `--batch-size ${batchSize}`,
            `--lora-layers ${loraRank}`,
            `--adapter-path ${adapterPath}`,
          ].join(' ')

          // Write the command to a script file for background execution
          const scriptPath = join(outputDir, 'train.sh')
          const logPath = join(outputDir, 'train.log')
          writeFileSync(scriptPath, [
            '#!/bin/bash',
            `echo "Training started at $(date)" > ${logPath}`,
            `echo "Command: ${cmd}" >> ${logPath}`,
            `${cmd} 2>&1 | tee -a ${logPath}`,
            `echo "Training finished at $(date)" >> ${logPath}`,
          ].join('\n'), 'utf-8')

          shell(`chmod +x ${scriptPath}`)

          // Launch in background
          const child = spawn('bash', [scriptPath], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore'],
          })
          child.unref()

          return [
            `MLX LoRA training launched in background.`,
            '',
            `  Base model:    ${baseModel}`,
            `  Dataset:       ${datasetPath}`,
            `  Iterations:    ${iters}`,
            `  Batch size:    ${batchSize}`,
            `  LoRA layers:   ${loraRank}`,
            `  Adapter path:  ${adapterPath}`,
            `  Log file:      ${logPath}`,
            `  PID:           ${child.pid}`,
            '',
            `Monitor progress: train_status --backend mlx --log_path ${logPath}`,
            `When done, merge adapter: train_export --model_path ${baseModel} --operation merge_lora --base_model ${baseModel}`,
          ].join('\n')

        } else if (backend === 'unsloth') {
          // Check if unsloth is available
          const hasUnsloth = shellSafe('python3 -c "import unsloth; print(unsloth.__version__)"')
          if (!hasUnsloth.ok) {
            return [
              'Unsloth is not installed. Install it with:',
              '',
              '  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"',
              '  pip install --no-deps "trl<0.9.0" peft accelerate bitsandbytes',
              '',
              'Requirements:',
              '  - NVIDIA GPU with CUDA support',
              '  - Python 3.10+',
              '  - PyTorch 2.0+',
            ].join('\n')
          }

          // Generate a Python training script
          const scriptContent = `#!/usr/bin/env python3
"""Unsloth fine-tuning script generated by K:BOT"""
import json
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

# Configuration
BASE_MODEL = "${baseModel}"
DATASET_PATH = "${datasetPath}"
OUTPUT_DIR = "${outputDir}"
EPOCHS = ${epochs}
BATCH_SIZE = ${batchSize}
LEARNING_RATE = ${learningRate}
LORA_RANK = ${loraRank}
LORA_ALPHA = ${loraAlpha}
MAX_SEQ_LENGTH = 2048

print(f"Loading model: {BASE_MODEL}")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=BASE_MODEL,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,  # auto-detect
    load_in_4bit=True,
)

print("Applying LoRA adapters...")
model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

print(f"Loading dataset: {DATASET_PATH}")
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

def formatting_func(examples):
    texts = []
    for msgs in examples.get("messages", [[]]):
        text_parts = []
        for msg in msgs:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                text_parts.append(f"### System:\\n{content}")
            elif role == "user":
                text_parts.append(f"### User:\\n{content}")
            elif role == "assistant":
                text_parts.append(f"### Assistant:\\n{content}")
        texts.append("\\n\\n".join(text_parts))
    return {"text": texts}

dataset = dataset.map(formatting_func, batched=True, remove_columns=dataset.column_names)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=True,
    args=TrainingArguments(
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=4,
        warmup_steps=10,
        num_train_epochs=EPOCHS,
        learning_rate=LEARNING_RATE,
        fp16=True,
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=42,
        output_dir=OUTPUT_DIR,
        save_strategy="epoch",
    ),
)

print("Starting training...")
trainer_stats = trainer.train()
print(f"Training complete. Loss: {trainer_stats.training_loss:.4f}")

print(f"Saving model to {OUTPUT_DIR}")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print("Done!")
`

          const scriptPath = join(outputDir, 'train_unsloth.py')
          const logPath = join(outputDir, 'train.log')
          writeFileSync(scriptPath, scriptContent, 'utf-8')

          // Launch in background
          const launchScript = join(outputDir, 'train.sh')
          writeFileSync(launchScript, [
            '#!/bin/bash',
            `echo "Training started at $(date)" > ${logPath}`,
            `python3 ${scriptPath} 2>&1 | tee -a ${logPath}`,
            `echo "Training finished at $(date)" >> ${logPath}`,
          ].join('\n'), 'utf-8')
          shell(`chmod +x ${launchScript}`)

          const child = spawn('bash', [launchScript], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore'],
          })
          child.unref()

          return [
            `Unsloth fine-tuning launched in background.`,
            '',
            `  Base model:      ${baseModel}`,
            `  Dataset:         ${datasetPath}`,
            `  Epochs:          ${epochs}`,
            `  Batch size:      ${batchSize}`,
            `  Learning rate:   ${learningRate}`,
            `  LoRA rank:       ${loraRank}`,
            `  LoRA alpha:      ${loraAlpha}`,
            `  Output:          ${outputDir}`,
            `  Log file:        ${logPath}`,
            `  Training script: ${scriptPath}`,
            `  PID:             ${child.pid}`,
            '',
            `Monitor progress: train_status --backend unsloth --log_path ${logPath}`,
          ].join('\n')

        } else if (backend === 'llama-cpp') {
          // Check if llama-finetune is available
          if (!isCommandAvailable('llama-finetune')) {
            return [
              'llama-finetune is not installed. Build it from llama.cpp:',
              '',
              '  git clone https://github.com/ggerganov/llama.cpp',
              '  cd llama.cpp',
              '  make llama-finetune',
              '',
              'Then add the build directory to your PATH.',
              '',
              'Alternative: use the MLX backend on Apple Silicon (faster, easier setup).',
            ].join('\n')
          }

          const threads = Math.max(1, cpus().length - 2)
          const loraOutPath = join(outputDir, 'lora-adapter.bin')
          const logPath = join(outputDir, 'train.log')

          const cmd = [
            'llama-finetune',
            `--model-base ${baseModel}`,
            `--lora-out ${loraOutPath}`,
            `--train-data ${datasetPath}`,
            `--threads ${threads}`,
            `--epochs ${epochs}`,
            `--batch ${batchSize}`,
            `--lora-r ${loraRank}`,
            `--lora-alpha ${loraAlpha}`,
          ].join(' ')

          const scriptPath = join(outputDir, 'train.sh')
          writeFileSync(scriptPath, [
            '#!/bin/bash',
            `echo "Training started at $(date)" > ${logPath}`,
            `echo "Command: ${cmd}" >> ${logPath}`,
            `${cmd} 2>&1 | tee -a ${logPath}`,
            `echo "Training finished at $(date)" >> ${logPath}`,
          ].join('\n'), 'utf-8')
          shell(`chmod +x ${scriptPath}`)

          const child = spawn('bash', [scriptPath], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore'],
          })
          child.unref()

          return [
            `llama.cpp fine-tuning launched in background.`,
            '',
            `  Base model:    ${baseModel}`,
            `  Dataset:       ${datasetPath}`,
            `  Epochs:        ${epochs}`,
            `  Batch size:    ${batchSize}`,
            `  LoRA rank:     ${loraRank}`,
            `  LoRA alpha:    ${loraAlpha}`,
            `  Threads:       ${threads}`,
            `  LoRA output:   ${loraOutPath}`,
            `  Log file:      ${logPath}`,
            `  PID:           ${child.pid}`,
            '',
            `Monitor progress: train_status --backend llama-cpp --log_path ${logPath}`,
          ].join('\n')
        }

        return `Error: Backend "${backend}" not handled.`
      } catch (err) {
        return `Error starting training: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_status ───────────────────────────────────────────────────
  registerTool({
    name: 'train_status',
    description:
      'Check the status of a fine-tuning job. For cloud backends, polls the provider API. ' +
      'For local backends, checks process state and reads the latest loss from the log file.',
    parameters: {
      job_id: {
        type: 'string',
        description: 'Job ID for cloud backends (required for openai/together/mistral)',
      },
      backend: {
        type: 'string',
        description: 'Backend: openai, together, mistral, mlx, unsloth, llama-cpp',
        required: true,
      },
      log_path: {
        type: 'string',
        description: 'Path to training log file (for local backends)',
      },
      api_key: {
        type: 'string',
        description: 'API key for cloud backends (optional)',
      },
    },
    tier: 'pro',
    timeout: 30_000,
    async execute(args) {
      try {
        const backend = String(args.backend).toLowerCase() as Backend
        const jobId = args.job_id ? String(args.job_id) : ''
        const logPath = args.log_path ? resolve(String(args.log_path)) : ''

        // ── Cloud backends ─────────────────────────────────────────
        if (backend === 'openai' || backend === 'together' || backend === 'mistral') {
          if (!jobId) {
            return `Error: job_id is required for cloud backend "${backend}".`
          }

          const apiKey = getApiKey(backend as CloudBackend, args.api_key ? String(args.api_key) : undefined)
          if (!apiKey) {
            return `Error: No API key found for ${backend}. Set the appropriate environment variable or pass api_key.`
          }

          let url: string
          if (backend === 'openai') {
            url = `https://api.openai.com/v1/fine_tuning/jobs/${jobId}`
          } else if (backend === 'together') {
            url = `https://api.together.xyz/v1/fine-tunes/${jobId}`
          } else {
            url = `https://api.mistral.ai/v1/fine_tuning/jobs/${jobId}`
          }

          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          })

          if (!res.ok) {
            const errBody = await res.text()
            return `Error fetching job status from ${backend}: ${res.status} ${errBody}`
          }

          const data = await res.json() as Record<string, unknown>

          const status = data.status || data.state || 'unknown'
          const model = data.model || data.fine_tuned_model || data.output_name || 'N/A'
          const createdAt = data.created_at ? new Date((data.created_at as number) * 1000).toISOString() : 'N/A'
          const finishedAt = data.finished_at ? new Date((data.finished_at as number) * 1000).toISOString() : 'N/A'

          // Extract training metrics if available
          let metricsInfo = ''
          const trainedTokens = data.trained_tokens || data.training_tokens
          if (trainedTokens) metricsInfo += `\n  Trained tokens: ${(trainedTokens as number).toLocaleString()}`

          const resultFiles = data.result_files
          if (Array.isArray(resultFiles) && resultFiles.length > 0) {
            metricsInfo += `\n  Result files:   ${resultFiles.length}`
          }

          const error = data.error as Record<string, unknown> | undefined
          if (error) {
            metricsInfo += `\n  Error:          ${error.message || JSON.stringify(error)}`
          }

          // OpenAI specific: get events
          let eventsInfo = ''
          if (backend === 'openai') {
            try {
              const eventsRes = await fetch(`${url}/events?limit=5`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              })
              if (eventsRes.ok) {
                const eventsData = await eventsRes.json() as { data: Array<{ message: string; created_at: number }> }
                if (eventsData.data && eventsData.data.length > 0) {
                  eventsInfo = '\n\nRecent events:\n' + eventsData.data
                    .map(e => `  [${new Date(e.created_at * 1000).toLocaleTimeString()}] ${e.message}`)
                    .join('\n')
                }
              }
            } catch { /* ignore events fetch errors */ }
          }

          return [
            `${backend.charAt(0).toUpperCase() + backend.slice(1)} Fine-Tuning Job Status`,
            '='.repeat(40),
            '',
            `  Job ID:       ${jobId}`,
            `  Status:       ${status}`,
            `  Base model:   ${model}`,
            `  Created:      ${createdAt}`,
            `  Finished:     ${finishedAt}`,
            metricsInfo,
            eventsInfo,
          ].filter(Boolean).join('\n')
        }

        // ── Local backends ─────────────────────────────────────────
        if (!logPath) {
          return `Error: log_path is required for local backend "${backend}". Pass the path to the training log file.`
        }

        if (!existsSync(logPath)) {
          return `Error: Log file not found: ${logPath}`
        }

        const logContent = readFileSync(logPath, 'utf-8')
        const logLines = logContent.split('\n').filter(l => l.trim())

        // Determine status
        let status: 'pending' | 'running' | 'completed' | 'failed' = 'running'
        const lastLine = logLines[logLines.length - 1] || ''
        if (lastLine.includes('Training finished') || lastLine.includes('Done!') || lastLine.includes('Saving model')) {
          status = 'completed'
        }
        if (lastLine.includes('Error') || lastLine.includes('Traceback') || lastLine.includes('FAILED')) {
          status = 'failed'
        }

        // Extract training metrics from log
        let currentLoss = 'N/A'
        let currentStep = 'N/A'
        let totalSteps = 'N/A'

        // Search for loss values (common patterns across frameworks)
        const lossPatterns = [
          /loss[:\s=]+(\d+\.?\d*)/i,
          /train_loss[:\s=]+(\d+\.?\d*)/i,
          /training_loss[:\s=]+(\d+\.?\d*)/i,
        ]
        const stepPatterns = [
          /(?:step|iter|iteration)[:\s=]+(\d+)/i,
          /(\d+)\/(\d+)/,  // step/total
        ]

        // Read from end of file for latest values
        for (let i = logLines.length - 1; i >= Math.max(0, logLines.length - 50); i--) {
          const line = logLines[i]
          if (currentLoss === 'N/A') {
            for (const pattern of lossPatterns) {
              const match = line.match(pattern)
              if (match) {
                currentLoss = match[1]
                break
              }
            }
          }
          if (currentStep === 'N/A') {
            for (const pattern of stepPatterns) {
              const match = line.match(pattern)
              if (match) {
                currentStep = match[1]
                if (match[2]) totalSteps = match[2]
                break
              }
            }
          }
          if (currentLoss !== 'N/A' && currentStep !== 'N/A') break
        }

        // Extract start time
        let elapsed = 'N/A'
        let eta = 'N/A'
        const startMatch = logContent.match(/Training started at (.+)/)
        if (startMatch) {
          const startTime = new Date(startMatch[1])
          const elapsedMs = Date.now() - startTime.getTime()
          const elapsedMin = (elapsedMs / 60_000).toFixed(1)
          elapsed = `${elapsedMin} min`

          // Estimate ETA
          if (currentStep !== 'N/A' && totalSteps !== 'N/A') {
            const step = parseInt(currentStep, 10)
            const total = parseInt(totalSteps, 10)
            if (step > 0 && total > step) {
              const msPerStep = elapsedMs / step
              const remainingMs = msPerStep * (total - step)
              const remainingMin = (remainingMs / 60_000).toFixed(1)
              eta = `~${remainingMin} min remaining`
            }
          }
        }

        // Last few log lines for context
        const recentLines = logLines.slice(-8).map(l => `  ${l}`).join('\n')

        return [
          `Local Training Status (${backend})`,
          '='.repeat(40),
          '',
          `  Status:       ${status}`,
          `  Current step: ${currentStep}${totalSteps !== 'N/A' ? ` / ${totalSteps}` : ''}`,
          `  Current loss: ${currentLoss}`,
          `  Elapsed:      ${elapsed}`,
          `  ETA:          ${eta}`,
          `  Log file:     ${logPath}`,
          '',
          'Recent log output:',
          recentLines,
        ].join('\n')
      } catch (err) {
        return `Error checking training status: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_evaluate ─────────────────────────────────────────────────
  registerTool({
    name: 'train_evaluate',
    description:
      'Evaluate a fine-tuned model against a test dataset. Runs test prompts through the model ' +
      'and measures BLEU score, exact match rate, and average response length. ' +
      'Supports local inference via Ollama or llama.cpp, and cloud via provider API.',
    parameters: {
      model: {
        type: 'string',
        description: 'Model name or path to evaluate',
        required: true,
      },
      test_data: {
        type: 'string',
        description: 'Path to test dataset (same format as training data)',
        required: true,
      },
      backend: {
        type: 'string',
        description: 'Inference backend: ollama, llama-cpp, openai, together, mistral (default: ollama)',
      },
      samples: {
        type: 'number',
        description: 'Maximum number of test samples to evaluate (default: 50)',
      },
      api_key: {
        type: 'string',
        description: 'API key for cloud backends (optional)',
      },
    },
    tier: 'pro',
    timeout: 600_000,
    async execute(args) {
      try {
        const model = String(args.model)
        const testDataPath = resolve(String(args.test_data))
        const backend = String(args.backend || 'ollama').toLowerCase()
        const maxSamples = typeof args.samples === 'number' ? args.samples : 50

        if (!existsSync(testDataPath)) {
          return `Error: Test data not found: ${testDataPath}`
        }

        // Parse test data — extract prompt/expected pairs
        const content = readFileSync(testDataPath, 'utf-8')
        let testCases: Array<{ prompt: string; expected: string; system?: string }> = []

        // Try parsing as JSONL first
        const lines = content.split('\n').filter(l => l.trim())
        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            if (obj.messages && Array.isArray(obj.messages)) {
              const msgs = obj.messages as ChatMessage[]
              const systemMsg = msgs.find(m => m.role === 'system')
              const userMsg = msgs.find(m => m.role === 'user')
              const assistantMsg = msgs.find(m => m.role === 'assistant')
              if (userMsg && assistantMsg) {
                testCases.push({
                  prompt: userMsg.content,
                  expected: assistantMsg.content,
                  system: systemMsg?.content,
                })
              }
            } else if (obj.instruction && obj.output) {
              testCases.push({ prompt: obj.instruction, expected: obj.output })
            } else if (obj.conversations) {
              const convs = obj.conversations as ShareGptTurn[]
              const human = convs.find(c => c.from === 'human')
              const gpt = convs.find(c => c.from === 'gpt')
              const sys = convs.find(c => c.from === 'system')
              if (human && gpt) {
                testCases.push({ prompt: human.value, expected: gpt.value, system: sys?.value })
              }
            }
          } catch { /* skip malformed lines */ }
        }

        // If no JSONL, try as JSON array
        if (testCases.length === 0) {
          try {
            const parsed = JSON.parse(content)
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item.messages) {
                  const msgs = item.messages as ChatMessage[]
                  const userMsg = msgs.find((m: ChatMessage) => m.role === 'user')
                  const assistantMsg = msgs.find((m: ChatMessage) => m.role === 'assistant')
                  if (userMsg && assistantMsg) {
                    testCases.push({ prompt: userMsg.content, expected: assistantMsg.content })
                  }
                } else if (item.instruction && item.output) {
                  testCases.push({ prompt: item.instruction, expected: item.output })
                }
              }
            }
          } catch { /* not a JSON array */ }
        }

        if (testCases.length === 0) {
          return `Error: No test cases extracted from ${testDataPath}. Ensure the file contains valid JSONL/Alpaca/ShareGPT examples.`
        }

        // Limit samples
        testCases = testCases.slice(0, maxSamples)

        // Run inference for each test case
        const results: Array<{ prompt: string; expected: string; actual: string; bleu: number; exactMatch: boolean }> = []
        let errorCount = 0

        for (const tc of testCases) {
          let actual = ''

          try {
            if (backend === 'ollama') {
              if (!isCommandAvailable('ollama')) {
                return 'Error: Ollama is not installed. Install from https://ollama.ai'
              }
              const prompt = tc.system
                ? `System: ${tc.system}\n\nUser: ${tc.prompt}\n\nAssistant:`
                : `User: ${tc.prompt}\n\nAssistant:`
              const result = shellSafe(`ollama run ${model} ${JSON.stringify(prompt)}`, { timeout: 60_000 })
              actual = result.ok ? result.output : ''
            } else if (backend === 'llama-cpp') {
              if (!isCommandAvailable('llama-cli')) {
                return 'Error: llama-cli is not installed. Build from https://github.com/ggerganov/llama.cpp'
              }
              const prompt = tc.prompt
              const result = shellSafe(`llama-cli -m ${model} -p ${JSON.stringify(prompt)} -n 512 --temp 0.1`, { timeout: 120_000 })
              actual = result.ok ? result.output : ''
            } else if (backend === 'openai' || backend === 'together' || backend === 'mistral') {
              const apiKey = getApiKey(backend as CloudBackend, args.api_key ? String(args.api_key) : undefined)
              if (!apiKey) {
                return `Error: No API key for ${backend}. Set the appropriate env var or pass api_key.`
              }

              const apiUrl = backend === 'openai' ? 'https://api.openai.com/v1/chat/completions'
                : backend === 'together' ? 'https://api.together.xyz/v1/chat/completions'
                : 'https://api.mistral.ai/v1/chat/completions'

              const messages: ChatMessage[] = []
              if (tc.system) messages.push({ role: 'system', content: tc.system })
              messages.push({ role: 'user', content: tc.prompt })

              const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  messages,
                  max_tokens: 1024,
                  temperature: 0.1,
                }),
              })

              if (res.ok) {
                const data = await res.json() as { choices: Array<{ message: { content: string } }> }
                actual = data.choices?.[0]?.message?.content || ''
              }
            }
          } catch {
            errorCount++
            continue
          }

          if (!actual) {
            errorCount++
            continue
          }

          const bleu = bleuScore(tc.expected, actual)
          const exactMatch = normalizeText(actual) === normalizeText(tc.expected)

          results.push({
            prompt: tc.prompt.slice(0, 80),
            expected: tc.expected.slice(0, 80),
            actual: actual.slice(0, 80),
            bleu,
            exactMatch,
          })
        }

        if (results.length === 0) {
          return `Error: No successful evaluations. ${errorCount} inference calls failed. Check model name and backend.`
        }

        // Compute aggregate metrics
        const avgBleu = results.reduce((s, r) => s + r.bleu, 0) / results.length
        const exactMatchRate = results.filter(r => r.exactMatch).length / results.length
        const avgResponseLen = results.reduce((s, r) => s + r.actual.length, 0) / results.length
        const avgExpectedLen = results.reduce((s, r) => s + r.expected.length, 0) / results.length

        // Build report
        const report: string[] = [
          `Model Evaluation Report`,
          '='.repeat(50),
          '',
          `  Model:           ${model}`,
          `  Backend:         ${backend}`,
          `  Test samples:    ${results.length} / ${testCases.length}`,
          `  Errors:          ${errorCount}`,
          '',
          `Metrics`,
          '─'.repeat(30),
          `  BLEU score:      ${(avgBleu * 100).toFixed(1)}%`,
          `  Exact match:     ${(exactMatchRate * 100).toFixed(1)}%`,
          `  Avg response:    ${Math.round(avgResponseLen)} chars`,
          `  Avg expected:    ${Math.round(avgExpectedLen)} chars`,
          `  Length ratio:    ${(avgResponseLen / Math.max(avgExpectedLen, 1)).toFixed(2)}x`,
        ]

        // Show a few examples
        report.push('', 'Sample Results', '─'.repeat(30))
        for (const r of results.slice(0, 5)) {
          report.push(
            `  Prompt:   ${r.prompt}...`,
            `  Expected: ${r.expected}...`,
            `  Actual:   ${r.actual}...`,
            `  BLEU: ${(r.bleu * 100).toFixed(1)}% | Match: ${r.exactMatch ? 'YES' : 'NO'}`,
            '',
          )
        }

        return report.join('\n')
      } catch (err) {
        return `Evaluation error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_export ───────────────────────────────────────────────────
  registerTool({
    name: 'train_export',
    description:
      'Convert and export models between formats. Merge LoRA adapters back into base models, ' +
      'convert HuggingFace models to GGUF, or quantize GGUF files for efficient deployment.',
    parameters: {
      model_path: {
        type: 'string',
        description: 'Path to model or adapter directory',
        required: true,
      },
      operation: {
        type: 'string',
        description: 'Operation: merge_lora, to_gguf, quantize',
        required: true,
      },
      output: {
        type: 'string',
        description: 'Output path (default: auto-generated)',
      },
      base_model: {
        type: 'string',
        description: 'Base model name/path (required for merge_lora)',
      },
      quantization: {
        type: 'string',
        description: 'Quantization type for to_gguf and quantize: q4_K_M, q5_K_M, q8_0, f16 (default: q4_K_M)',
      },
    },
    tier: 'pro',
    timeout: 600_000,
    async execute(args) {
      try {
        const modelPath = resolve(String(args.model_path))
        const operation = String(args.operation).toLowerCase()
        const quantType = String(args.quantization || 'q4_K_M')

        if (!existsSync(modelPath)) {
          return `Error: Model path not found: ${modelPath}`
        }

        if (!['merge_lora', 'to_gguf', 'quantize'].includes(operation)) {
          return `Error: Invalid operation "${operation}". Use: merge_lora, to_gguf, quantize`
        }

        if (operation === 'merge_lora') {
          const baseModel = args.base_model ? String(args.base_model) : ''
          if (!baseModel) {
            return 'Error: base_model is required for merge_lora operation.'
          }

          const outputPath = args.output
            ? resolve(String(args.output))
            : resolve(dirname(modelPath), `${basename(modelPath)}-merged`)

          // Try MLX merge first (Apple Silicon)
          const hasMlx = shellSafe('python3 -c "import mlx_lm"')
          if (hasMlx.ok) {
            const cmd = `python3 -m mlx_lm.fuse --model ${baseModel} --adapter-path ${modelPath} --save-path ${outputPath}`
            const result = shellSafe(cmd, { timeout: 300_000 })

            if (result.ok) {
              return [
                `LoRA merge completed (MLX).`,
                '',
                `  Base model:    ${baseModel}`,
                `  Adapter:       ${modelPath}`,
                `  Merged output: ${outputPath}`,
                '',
                result.output,
              ].join('\n')
            }
            // Fall through to try other methods
          }

          // Try with PEFT (PyTorch)
          const mergeScript = `
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

print("Loading base model: ${baseModel}")
model = AutoModelForCausalLM.from_pretrained("${baseModel}", torch_dtype=torch.float16, device_map="auto")
tokenizer = AutoTokenizer.from_pretrained("${baseModel}")

print("Loading LoRA adapter: ${modelPath}")
model = PeftModel.from_pretrained(model, "${modelPath}")

print("Merging LoRA weights into base model...")
model = model.merge_and_unload()

print("Saving merged model to: ${outputPath}")
model.save_pretrained("${outputPath}")
tokenizer.save_pretrained("${outputPath}")
print("Done!")
`
          const scriptPath = join(dirname(modelPath), '_merge_lora.py')
          writeFileSync(scriptPath, mergeScript, 'utf-8')

          const result = shellSafe(`python3 ${scriptPath}`, { timeout: 600_000 })

          // Clean up script
          try { execSync(`rm -f ${scriptPath}`, { stdio: 'pipe' }) } catch { /* ignore */ }

          if (!result.ok) {
            return `Error merging LoRA:\n${result.output}\n\nEnsure transformers and peft are installed: pip install transformers peft torch`
          }

          return [
            `LoRA merge completed (PEFT).`,
            '',
            `  Base model:    ${baseModel}`,
            `  Adapter:       ${modelPath}`,
            `  Merged output: ${outputPath}`,
            '',
            result.output,
          ].join('\n')

        } else if (operation === 'to_gguf') {
          const outputPath = args.output
            ? resolve(String(args.output))
            : resolve(dirname(modelPath), `${basename(modelPath)}.${quantType}.gguf`)

          // Try llama.cpp's convert script
          const convertScript = shellSafe('which convert_hf_to_gguf.py || which convert-hf-to-gguf.py')
          let convertCmd: string

          if (convertScript.ok && convertScript.output) {
            convertCmd = `python3 ${convertScript.output} ${modelPath} --outfile ${outputPath} --outtype ${quantType}`
          } else {
            // Try finding it in common locations
            const commonPaths = [
              join(homedir(), 'llama.cpp/convert_hf_to_gguf.py'),
              join(homedir(), 'llama.cpp/convert-hf-to-gguf.py'),
              '/opt/llama.cpp/convert_hf_to_gguf.py',
              '/usr/local/share/llama.cpp/convert_hf_to_gguf.py',
            ]

            const found = commonPaths.find(p => existsSync(p))
            if (!found) {
              return [
                'GGUF conversion script not found. Ensure llama.cpp is built:',
                '',
                '  git clone https://github.com/ggerganov/llama.cpp',
                '  cd llama.cpp',
                '  pip install -r requirements.txt',
                '',
                'Then run:',
                `  python3 convert_hf_to_gguf.py ${modelPath} --outfile ${outputPath} --outtype ${quantType}`,
              ].join('\n')
            }
            convertCmd = `python3 ${found} ${modelPath} --outfile ${outputPath} --outtype ${quantType}`
          }

          const result = shellSafe(convertCmd, { timeout: 600_000 })
          if (!result.ok) {
            return `Error converting to GGUF:\n${result.output}`
          }

          const fileSize = existsSync(outputPath) ? (statSync(outputPath).size / (1024 * 1024 * 1024)).toFixed(2) : '?'

          return [
            `GGUF conversion completed.`,
            '',
            `  Input:         ${modelPath}`,
            `  Output:        ${outputPath}`,
            `  Quantization:  ${quantType}`,
            `  File size:     ${fileSize} GB`,
            '',
            result.output,
          ].join('\n')

        } else if (operation === 'quantize') {
          if (!isCommandAvailable('llama-quantize')) {
            return [
              'llama-quantize is not installed. Build from llama.cpp:',
              '',
              '  git clone https://github.com/ggerganov/llama.cpp',
              '  cd llama.cpp',
              '  make llama-quantize',
            ].join('\n')
          }

          const outputPath = args.output
            ? resolve(String(args.output))
            : modelPath.replace(/\.gguf$/, '') + `.${quantType}.gguf`

          const result = shellSafe(`llama-quantize ${modelPath} ${outputPath} ${quantType}`, { timeout: 600_000 })
          if (!result.ok) {
            return `Error quantizing model:\n${result.output}`
          }

          const inputSize = (statSync(modelPath).size / (1024 * 1024 * 1024)).toFixed(2)
          const outputSize = existsSync(outputPath) ? (statSync(outputPath).size / (1024 * 1024 * 1024)).toFixed(2) : '?'

          return [
            `Quantization completed.`,
            '',
            `  Input:         ${modelPath} (${inputSize} GB)`,
            `  Output:        ${outputPath} (${outputSize} GB)`,
            `  Type:          ${quantType}`,
            `  Compression:   ${inputSize !== '?' && outputSize !== '?'
              ? ((1 - parseFloat(outputSize) / parseFloat(inputSize)) * 100).toFixed(1) + '%'
              : 'N/A'}`,
            '',
            result.output,
          ].join('\n')
        }

        return `Error: Operation "${operation}" not handled.`
      } catch (err) {
        return `Export error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_deploy ───────────────────────────────────────────────────
  registerTool({
    name: 'train_deploy',
    description:
      'Deploy a fine-tuned model. Targets: Ollama (local serving), HuggingFace Hub (public/private repo), ' +
      'or K:BOT local models directory (~/.kbot/models/).',
    parameters: {
      model_path: {
        type: 'string',
        description: 'Path to the model file (GGUF) or directory',
        required: true,
      },
      target: {
        type: 'string',
        description: 'Deployment target: ollama, huggingface, kbot-local',
        required: true,
      },
      name: {
        type: 'string',
        description: 'Model name for the deployment',
        required: true,
      },
      description: {
        type: 'string',
        description: 'Model description (optional)',
      },
    },
    tier: 'pro',
    timeout: 600_000,
    async execute(args) {
      try {
        const modelPath = resolve(String(args.model_path))
        const target = String(args.target).toLowerCase()
        const name = String(args.name)
        const description = args.description ? String(args.description) : `Fine-tuned model: ${name}`

        if (!existsSync(modelPath)) {
          return `Error: Model path not found: ${modelPath}`
        }

        if (!['ollama', 'huggingface', 'kbot-local'].includes(target)) {
          return `Error: Invalid target "${target}". Use: ollama, huggingface, kbot-local`
        }

        if (target === 'ollama') {
          if (!isCommandAvailable('ollama')) {
            return 'Error: Ollama is not installed. Download from https://ollama.ai'
          }

          // Determine if model is GGUF file or directory
          const isGguf = modelPath.endsWith('.gguf')
          const fromLine = isGguf ? `FROM ${modelPath}` : `FROM ${modelPath}`

          // Create a Modelfile
          const modelfileContent = [
            fromLine,
            '',
            `PARAMETER temperature 0.7`,
            `PARAMETER top_p 0.9`,
            `PARAMETER top_k 40`,
            '',
            `SYSTEM """${description}"""`,
          ].join('\n')

          const modelfilePath = join(dirname(modelPath), 'Modelfile')
          writeFileSync(modelfilePath, modelfileContent, 'utf-8')

          // Create the Ollama model
          const result = shellSafe(`ollama create ${name} -f ${modelfilePath}`, { timeout: 300_000 })

          if (!result.ok) {
            return `Error creating Ollama model:\n${result.output}\n\nModelfile written to: ${modelfilePath}`
          }

          return [
            `Model deployed to Ollama.`,
            '',
            `  Name:        ${name}`,
            `  Source:      ${modelPath}`,
            `  Modelfile:   ${modelfilePath}`,
            '',
            `Run it with: ollama run ${name}`,
            `Use in K:BOT: kbot --model ${name}`,
            '',
            result.output,
          ].join('\n')

        } else if (target === 'huggingface') {
          if (!isCommandAvailable('huggingface-cli')) {
            return [
              'HuggingFace CLI is not installed. Install with:',
              '',
              '  pip install huggingface_hub[cli]',
              '',
              'Then authenticate:',
              '  huggingface-cli login',
            ].join('\n')
          }

          // Check if HF_TOKEN is available
          const hasToken = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN
          if (!hasToken) {
            const loginCheck = shellSafe('huggingface-cli whoami')
            if (!loginCheck.ok) {
              return 'Error: Not authenticated with HuggingFace. Run: huggingface-cli login\nOr set HF_TOKEN environment variable.'
            }
          }

          const result = shellSafe(`huggingface-cli upload ${name} ${modelPath}`, { timeout: 600_000 })

          if (!result.ok) {
            return `Error uploading to HuggingFace:\n${result.output}`
          }

          return [
            `Model uploaded to HuggingFace Hub.`,
            '',
            `  Repository:  ${name}`,
            `  Source:      ${modelPath}`,
            `  URL:         https://huggingface.co/${name}`,
            '',
            result.output,
          ].join('\n')

        } else if (target === 'kbot-local') {
          const modelsDir = join(homedir(), '.kbot', 'models')
          mkdirSync(modelsDir, { recursive: true })

          const isGguf = modelPath.endsWith('.gguf')
          const destFilename = isGguf ? `${name}.gguf` : name
          const destPath = join(modelsDir, destFilename)

          // Copy model file(s)
          const stat = statSync(modelPath)
          if (stat.isFile()) {
            const result = shellSafe(`cp ${modelPath} ${destPath}`, { timeout: 120_000 })
            if (!result.ok) {
              return `Error copying model: ${result.output}`
            }
          } else if (stat.isDirectory()) {
            const destDir = join(modelsDir, name)
            mkdirSync(destDir, { recursive: true })
            const result = shellSafe(`cp -r ${modelPath}/* ${destDir}/`, { timeout: 300_000 })
            if (!result.ok) {
              return `Error copying model directory: ${result.output}`
            }
          }

          // Register in K:BOT config
          const configPath = join(homedir(), '.kbot', 'config.json')
          let config: Record<string, unknown> = {}
          if (existsSync(configPath)) {
            try { config = JSON.parse(readFileSync(configPath, 'utf-8')) } catch { /* start fresh */ }
          }

          if (!config.local_models || !Array.isArray(config.local_models)) {
            config.local_models = []
          }

          const modelEntry = {
            name,
            path: stat.isDirectory() ? join(modelsDir, name) : destPath,
            description,
            added: new Date().toISOString(),
            type: isGguf ? 'gguf' : 'directory',
          }

          // Remove existing entry with same name
          config.local_models = (config.local_models as Array<{ name: string }>).filter(m => m.name !== name)
          ;(config.local_models as Array<typeof modelEntry>).push(modelEntry)

          writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

          const fileSize = stat.isFile()
            ? `${(stat.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : 'directory'

          return [
            `Model registered in K:BOT local models.`,
            '',
            `  Name:        ${name}`,
            `  Path:        ${modelEntry.path}`,
            `  Size:        ${fileSize}`,
            `  Description: ${description}`,
            '',
            `Use in K:BOT: kbot --model ${name}`,
            `List models:  kbot models`,
          ].join('\n')
        }

        return `Error: Target "${target}" not handled.`
      } catch (err) {
        return `Deploy error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── train_cost ─────────────────────────────────────────────────────
  registerTool({
    name: 'train_cost',
    description:
      'Estimate the cost, time, and VRAM requirements for a fine-tuning job before starting. ' +
      'For cloud backends, calculates token-based pricing. For local, estimates GPU hours and VRAM usage.',
    parameters: {
      dataset: {
        type: 'string',
        description: 'Path to training dataset file',
        required: true,
      },
      base_model: {
        type: 'string',
        description: 'Base model to fine-tune (e.g., gpt-4.1-mini, llama-3-8b)',
        required: true,
      },
      backend: {
        type: 'string',
        description: 'Training backend: openai, together, mistral, mlx, unsloth, llama-cpp',
        required: true,
      },
      epochs: {
        type: 'number',
        description: 'Number of training epochs (default: 3)',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      try {
        const datasetPath = resolve(String(args.dataset))
        const baseModel = String(args.base_model)
        const backend = String(args.backend).toLowerCase() as Backend
        const epochs = typeof args.epochs === 'number' ? args.epochs : 3

        if (!existsSync(datasetPath)) {
          return `Error: Dataset not found: ${datasetPath}`
        }

        const validBackends: Backend[] = ['openai', 'together', 'mistral', 'mlx', 'unsloth', 'llama-cpp']
        if (!validBackends.includes(backend)) {
          return `Error: Invalid backend "${backend}". Supported: ${validBackends.join(', ')}`
        }

        // Calculate dataset size
        const content = readFileSync(datasetPath, 'utf-8')
        const fileSize = statSync(datasetPath).size
        const totalTokens = estimateTokens(content)
        const trainingTokens = totalTokens * epochs

        // Estimate model parameters
        const modelParams = estimateModelParams(baseModel)
        const modelParamsB = (modelParams / 1e9).toFixed(1)

        // ── Cloud pricing ────────────────────────────────────────────
        const cloudPricing: Record<CloudBackend, { perKToken: number; label: string }> = {
          openai: {
            perKToken: baseModel.includes('gpt-4.1-mini') ? 0.008 : baseModel.includes('gpt-4.1') ? 0.025 : 0.008,
            label: baseModel.includes('gpt-4.1') && !baseModel.includes('mini') ? 'GPT-4.1' : 'GPT-4.1 Mini',
          },
          together: {
            perKToken: 0.004,
            label: 'Together AI',
          },
          mistral: {
            perKToken: 0.008,
            label: 'Mistral',
          },
        }

        // ── VRAM estimation ──────────────────────────────────────────
        // Full fine-tuning: ~18-20 bytes per param (fp16 model + optimizer states + gradients)
        // QLoRA: ~4-6 bytes per param (4-bit model + small LoRA overhead)
        // LoRA (fp16): ~10-12 bytes per param (fp16 model + small LoRA)

        let vramGB: number
        let vramMethod: string
        if (backend === 'mlx') {
          // MLX uses unified memory, fp16 model + LoRA
          vramGB = (modelParams * 4) / (1024 * 1024 * 1024) // ~4 bytes for 4-bit + LoRA overhead
          vramMethod = '4-bit + LoRA (MLX unified memory)'
        } else if (backend === 'unsloth') {
          // Unsloth uses 4-bit QLoRA
          vramGB = (modelParams * 5) / (1024 * 1024 * 1024)
          vramMethod = '4-bit QLoRA (Unsloth)'
        } else if (backend === 'llama-cpp') {
          // llama.cpp LoRA fine-tuning
          vramGB = (modelParams * 6) / (1024 * 1024 * 1024)
          vramMethod = 'LoRA (llama.cpp, CPU/GPU mixed)'
        } else {
          // Cloud — user doesn't need to worry about VRAM
          vramGB = 0
          vramMethod = 'Cloud-managed (no local VRAM needed)'
        }

        // ── Time estimation ──────────────────────────────────────────
        // Rough estimates based on model size and training tokens
        let estimatedMinutes: number
        let timeNote: string

        if (backend === 'openai') {
          // OpenAI typically processes ~1M tokens/hour for fine-tuning
          estimatedMinutes = (trainingTokens / 1_000_000) * 60
          timeNote = 'OpenAI job queue + training'
        } else if (backend === 'together') {
          estimatedMinutes = (trainingTokens / 800_000) * 60
          timeNote = 'Together AI queue + training'
        } else if (backend === 'mistral') {
          estimatedMinutes = (trainingTokens / 700_000) * 60
          timeNote = 'Mistral queue + training'
        } else if (backend === 'mlx') {
          // Apple Silicon: ~200-500 tokens/sec for 7B model LoRA
          const tokPerSec = modelParams <= 8e9 ? 400 : modelParams <= 14e9 ? 150 : 50
          estimatedMinutes = (trainingTokens / tokPerSec) / 60
          timeNote = `~${tokPerSec} tok/s estimated for ${modelParamsB}B on Apple Silicon`
        } else if (backend === 'unsloth') {
          // Unsloth with consumer GPU: ~500-1000 tokens/sec for 7B
          const tokPerSec = modelParams <= 8e9 ? 800 : modelParams <= 14e9 ? 300 : 100
          estimatedMinutes = (trainingTokens / tokPerSec) / 60
          timeNote = `~${tokPerSec} tok/s estimated for ${modelParamsB}B with Unsloth`
        } else {
          // llama.cpp CPU: ~50-200 tokens/sec
          const tokPerSec = modelParams <= 8e9 ? 150 : modelParams <= 14e9 ? 50 : 15
          estimatedMinutes = (trainingTokens / tokPerSec) / 60
          timeNote = `~${tokPerSec} tok/s estimated for ${modelParamsB}B on CPU`
        }

        // Format time
        let timeStr: string
        if (estimatedMinutes < 60) {
          timeStr = `${Math.ceil(estimatedMinutes)} minutes`
        } else if (estimatedMinutes < 1440) {
          timeStr = `${(estimatedMinutes / 60).toFixed(1)} hours`
        } else {
          timeStr = `${(estimatedMinutes / 1440).toFixed(1)} days`
        }

        // ── Cost for cloud ───────────────────────────────────────────
        let costStr: string
        if (backend === 'openai' || backend === 'together' || backend === 'mistral') {
          const pricing = cloudPricing[backend]
          const cost = (trainingTokens / 1000) * pricing.perKToken
          costStr = `$${cost.toFixed(2)} (${pricing.label} @ $${pricing.perKToken}/1K tokens)`
        } else {
          // Local: estimate electricity cost
          let wattage: number
          if (backend === 'mlx') wattage = 30  // Apple Silicon TDP
          else if (backend === 'unsloth') wattage = 300  // GPU TDP
          else wattage = 150  // CPU
          const kWh = (wattage * estimatedMinutes / 60) / 1000
          const electricityCost = kWh * 0.15  // $0.15/kWh average
          costStr = `~$${electricityCost.toFixed(2)} electricity (${kWh.toFixed(2)} kWh @ $0.15/kWh)`
        }

        // ── GPU recommendations ──────────────────────────────────────
        let gpuRec: string
        if (backend === 'mlx') {
          if (vramGB <= 8) gpuRec = 'M1/M2/M3 with 8GB+ unified memory'
          else if (vramGB <= 16) gpuRec = 'M1 Pro/Max/M2 Pro/Max with 16GB+ unified memory'
          else if (vramGB <= 36) gpuRec = 'M2 Max/M3 Max with 36GB+ unified memory'
          else if (vramGB <= 64) gpuRec = 'M2 Ultra/M3 Ultra with 64GB+ unified memory'
          else gpuRec = 'M2 Ultra/M3 Ultra with 128GB+ unified memory (or use cloud)'
        } else if (backend === 'unsloth') {
          if (vramGB <= 8) gpuRec = 'RTX 3060 12GB / RTX 4060 Ti'
          else if (vramGB <= 16) gpuRec = 'RTX 3090 / RTX 4080 / A5000'
          else if (vramGB <= 24) gpuRec = 'RTX 3090 Ti / RTX 4090 / A5000'
          else if (vramGB <= 48) gpuRec = 'A6000 / 2x RTX 4090'
          else gpuRec = 'A100 80GB / H100 (or use cloud)'
        } else if (backend === 'llama-cpp') {
          const ramGB = Math.ceil(vramGB * 1.5)
          gpuRec = `${ramGB}GB+ system RAM (llama.cpp uses CPU + optional GPU offload)`
        } else {
          gpuRec = 'N/A (cloud-managed)'
        }

        // ── Build report ─────────────────────────────────────────────
        const lines = content.split('\n').filter(l => l.trim()).length

        return [
          `Training Cost Estimate`,
          '='.repeat(50),
          '',
          `Dataset`,
          '─'.repeat(30),
          `  File:          ${datasetPath}`,
          `  File size:     ${(fileSize / 1024).toFixed(1)} KB`,
          `  Examples:      ~${lines.toLocaleString()}`,
          `  Tokens:        ~${totalTokens.toLocaleString()}`,
          `  Training tokens: ~${trainingTokens.toLocaleString()} (${epochs} epochs)`,
          '',
          `Model`,
          '─'.repeat(30),
          `  Base model:    ${baseModel}`,
          `  Est. params:   ${modelParamsB}B`,
          `  Backend:       ${backend}`,
          '',
          `Cost`,
          '─'.repeat(30),
          `  Estimated:     ${costStr}`,
          '',
          `Time`,
          '─'.repeat(30),
          `  Estimated:     ${timeStr}`,
          `  Note:          ${timeNote}`,
          '',
          `Resources`,
          '─'.repeat(30),
          `  VRAM needed:   ${vramGB > 0 ? `${vramGB.toFixed(1)} GB` : 'N/A (cloud)'}`,
          `  Method:        ${vramMethod}`,
          `  Recommended:   ${gpuRec}`,
          '',
          `Note: These are rough estimates. Actual cost and time depend on dataset complexity,`,
          `hardware configuration, queue times (cloud), and hyperparameters.`,
        ].join('\n')
      } catch (err) {
        return `Cost estimation error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
