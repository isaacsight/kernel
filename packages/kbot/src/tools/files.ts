// kbot File Tools — Read, write, edit, glob, grep
// All operations are local — zero API calls.
// Supports diff-before-apply in normal/strict modes.

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import chalk from 'chalk'
import { registerTool } from './index.js'
import { getPermissionMode } from '../permissions.js'

/** Resolve a file path: expand ~ and make absolute relative to cwd */
function resolvePath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return resolve(homedir(), p.slice(2) || '.')
  }
  return resolve(p)
}

/** Show a colored diff preview to stderr and return true if user approves */
async function showDiffPreview(path: string, oldContent: string, newContent: string): Promise<boolean> {
  const mode = getPermissionMode()
  if (mode === 'permissive') return true // Auto-approve

  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  // Simple diff — show changed/added/removed lines (max 30 lines shown)
  process.stderr.write(`\n  ${chalk.bold(basename(path))} ${chalk.dim('— proposed changes:')}\n`)
  process.stderr.write(`  ${chalk.dim('─'.repeat(50))}\n`)

  let diffLines = 0
  const maxShow = 30

  // For small files or complete rewrites, show new content preview
  if (oldContent === '' || oldLines.length <= 5) {
    for (const line of newLines.slice(0, maxShow)) {
      process.stderr.write(`  ${chalk.green('+')} ${line}\n`)
      diffLines++
    }
    if (newLines.length > maxShow) {
      process.stderr.write(`  ${chalk.dim(`  +${newLines.length - maxShow} more lines`)}\n`)
    }
  } else {
    // Show a unified-style context diff with surrounding lines
    const CONTEXT = 3 // lines of context around changes
    // Find changed regions: collect indices where lines differ
    const maxLen = Math.max(oldLines.length, newLines.length)
    const changedIndices = new Set<number>()
    for (let k = 0; k < maxLen; k++) {
      if (k >= oldLines.length || k >= newLines.length || oldLines[k] !== newLines[k]) {
        // Mark this index and surrounding context
        for (let c = Math.max(0, k - CONTEXT); c <= Math.min(maxLen - 1, k + CONTEXT); c++) {
          changedIndices.add(c)
        }
      }
    }

    let lastShown = -2 // track gaps for "..." separator
    for (let k = 0; k < maxLen && diffLines < maxShow; k++) {
      if (!changedIndices.has(k)) continue

      // Show separator if there's a gap
      if (k > lastShown + 1 && lastShown >= 0) {
        process.stderr.write(`  ${chalk.dim('  ...')}\n`)
      }
      lastShown = k

      const oldLine = k < oldLines.length ? oldLines[k] : undefined
      const newLine = k < newLines.length ? newLines[k] : undefined

      if (oldLine === newLine) {
        // Context line (unchanged)
        process.stderr.write(`  ${chalk.dim(' ')} ${oldLine}\n`)
        diffLines++
      } else {
        if (oldLine !== undefined) {
          process.stderr.write(`  ${chalk.red('-')} ${oldLine}\n`)
          diffLines++
        }
        if (newLine !== undefined) {
          process.stderr.write(`  ${chalk.green('+')} ${newLine}\n`)
          diffLines++
        }
      }
    }
    if (diffLines >= maxShow) {
      const remaining = [...changedIndices].filter(k => k > lastShown).length
      if (remaining > 0) process.stderr.write(`  ${chalk.dim(`  +${remaining} more lines`)}\n`)
    }
  }

  process.stderr.write(`  ${chalk.dim('─'.repeat(50))}\n`)

  // In strict mode, always confirm. In normal mode, confirm for overwrites.
  if (mode === 'strict' || (mode === 'normal' && oldContent !== '')) {
    const { createInterface } = await import('node:readline')
    const rl = createInterface({ input: process.stdin, output: process.stderr })
    const answer = await new Promise<string>((resolve) => {
      rl.question(`  ${chalk.bold('Apply?')} ${chalk.dim('[Y/n]')} `, (a) => {
        resolve(a.trim().toLowerCase())
        rl.close()
      })
    })
    if (answer === 'n' || answer === 'no') {
      process.stderr.write(`  ${chalk.red('✗')} Skipped\n`)
      return false
    }
  }

  return true
}

export function registerFileTools(): void {
  registerTool({
    name: 'read_file',
    description: 'Read the contents of a file. Returns the file content with line numbers.',
    parameters: {
      path: { type: 'string', description: 'File path (absolute or relative to cwd)', required: true },
      offset: { type: 'number', description: 'Line number to start from (1-based)' },
      limit: { type: 'number', description: 'Number of lines to read' },
    },
    tier: 'free',
    async execute(args) {
      const path = resolvePath(String(args.path))
      if (!existsSync(path)) return `Error: File not found: ${path} (cwd: ${process.cwd()})`

      const stat = statSync(path)
      if (stat.isDirectory()) return `Error: ${path} is a directory, not a file`
      if (stat.size > 5 * 1024 * 1024) return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`

      const content = readFileSync(path, 'utf-8')
      const lines = content.split('\n')
      const offset = typeof args.offset === 'number' ? Math.max(0, args.offset - 1) : 0
      const limit = typeof args.limit === 'number' ? args.limit : lines.length
      const sliced = lines.slice(offset, offset + limit)

      return sliced.map((line, i) => `${String(offset + i + 1).padStart(6)} │ ${line}`).join('\n')
    },
  })

  registerTool({
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
    parameters: {
      path: { type: 'string', description: 'File path', required: true },
      content: { type: 'string', description: 'Content to write', required: true },
    },
    tier: 'free',
    async execute(args) {
      const path = resolvePath(String(args.path))
      const content = String(args.content)
      const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''

      // Diff preview in normal/strict mode
      const approved = await showDiffPreview(path, existing, content)
      if (!approved) return `Skipped: write to ${path} was denied by user`

      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content)
      return `Written ${content.length} bytes to ${path}`
    },
  })

  registerTool({
    name: 'edit_file',
    description: 'Find and replace text in a file. The old_string must be unique in the file.',
    parameters: {
      path: { type: 'string', description: 'File path', required: true },
      old_string: { type: 'string', description: 'Text to find', required: true },
      new_string: { type: 'string', description: 'Replacement text', required: true },
    },
    tier: 'free',
    async execute(args) {
      const path = resolvePath(String(args.path))
      if (!existsSync(path)) return `Error: File not found: ${path} (cwd: ${process.cwd()})`

      const content = readFileSync(path, 'utf-8')
      const old_string = String(args.old_string)
      const new_string = String(args.new_string)

      const count = content.split(old_string).length - 1
      if (count === 0) return `Error: old_string not found in ${path}`
      if (count > 1) return `Error: old_string found ${count} times — must be unique. Add more context.`

      const updated = content.replace(old_string, new_string)

      // Diff preview in normal/strict mode — pass full file content for proper context
      const approved = await showDiffPreview(path, content, updated)
      if (!approved) return `Skipped: edit to ${path} was denied by user`

      writeFileSync(path, updated)
      return `Edited ${path}: replaced 1 occurrence`
    },
  })

  registerTool({
    name: 'glob',
    description: 'Find files matching a glob pattern. Returns file paths.',
    parameters: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")', required: true },
      path: { type: 'string', description: 'Directory to search in (defaults to cwd)' },
    },
    tier: 'free',
    async execute(args) {
      const pattern = String(args.pattern)
      const cwd = args.path ? resolvePath(String(args.path)) : process.cwd()
      // Sanitize pattern: only allow safe glob characters (prevent shell injection)
      // Note: {} are valid glob syntax (e.g., *.{ts,tsx}), so we allow them
      if (/[;&|`$()!\\]/.test(pattern)) {
        return 'Error: Pattern contains unsafe characters'
      }
      try {
        // Use find with properly quoted pattern
        const safePattern = pattern.replace(/'/g, "'\\''")
        const result = execSync(
          `find "${cwd}" -path '*/${safePattern}' -type f 2>/dev/null | head -50`,
          { encoding: 'utf-8', timeout: 10000 }
        ).trim()
        if (!result) {
          // Fallback: use Node.js glob instead of shell expansion
          const result2 = execSync(
            `find "${cwd}" -name '${safePattern}' -type f 2>/dev/null | head -50`,
            { encoding: 'utf-8', timeout: 10000 }
          ).trim()
          return result2 || 'No files found'
        }
        return result
      } catch {
        return 'No files found matching pattern'
      }
    },
  })

  registerTool({
    name: 'grep',
    description: 'Search file contents for a regex pattern. Returns matching lines with file paths and line numbers.',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern to search for', required: true },
      path: { type: 'string', description: 'File or directory to search in (defaults to cwd)' },
      type: { type: 'string', description: 'File type filter (e.g., "ts", "py", "js")' },
    },
    tier: 'free',
    async execute(args) {
      const pattern = String(args.pattern)
      const searchPath = args.path ? resolvePath(String(args.path)) : '.'
      // Validate type flag: only allow alphanumeric file type names (prevent flag injection)
      const fileType = args.type ? String(args.type).replace(/[^a-zA-Z0-9]/g, '') : ''
      const typeFlag = fileType ? `--type ${fileType}` : ''

      try {
        // Escape single quotes in pattern for safe shell embedding
        const safePattern = pattern.replace(/'/g, "'\\''")
        // Prefer ripgrep, fall back to grep
        const cmd = existsSync('/usr/bin/rg') || existsSync('/usr/local/bin/rg') || existsSync('/opt/homebrew/bin/rg')
          ? `rg -n --max-count 30 ${typeFlag} '${safePattern}' "${searchPath}" 2>/dev/null`
          : `grep -rn --include='*.${fileType || '*'}' '${safePattern}' "${searchPath}" 2>/dev/null | head -30`

        const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim()
        return result || 'No matches found'
      } catch {
        return 'No matches found'
      }
    },
  })

  registerTool({
    name: 'multi_file_write',
    description: 'Write multiple files in one call. Auto-creates parent directories. Ideal for scaffolding projects.',
    parameters: {
      files: { type: 'array', description: 'Array of {path, content} objects. Each file will be created/overwritten.', required: true, items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    },
    tier: 'free',
    async execute(args) {
      const files = args.files as Array<{ path: string; content: string }>
      if (!Array.isArray(files) || files.length === 0) return 'Error: files must be a non-empty array of {path, content}'
      const results: string[] = []
      const skipped: string[] = []
      for (const f of files) {
        const path = resolvePath(String(f.path))
        const content = String(f.content)
        const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''

        // Diff preview in normal/strict mode
        const approved = await showDiffPreview(path, existing, content)
        if (!approved) {
          skipped.push(`  ${path} (skipped — denied by user)`)
          continue
        }

        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, content)
        results.push(`  ${path} (${content.length} bytes)`)
      }
      const parts: string[] = []
      if (results.length > 0) parts.push(`Written ${results.length} files:\n${results.join('\n')}`)
      if (skipped.length > 0) parts.push(`Skipped ${skipped.length} files:\n${skipped.join('\n')}`)
      return parts.join('\n') || 'No files written'
    },
  })

  registerTool({
    name: 'list_directory',
    description: 'List files and directories in a path. Shows file sizes and types.',
    parameters: {
      path: { type: 'string', description: 'Directory path (defaults to cwd)' },
    },
    tier: 'free',
    async execute(args) {
      const dir = args.path ? resolvePath(String(args.path)) : '.'
      try {
        const result = execSync(`ls -la "${dir}" 2>/dev/null | head -50`, {
          encoding: 'utf-8', timeout: 5000,
        }).trim()
        return result || 'Empty directory'
      } catch {
        return `Error: Cannot list directory: ${dir}`
      }
    },
  })
}
