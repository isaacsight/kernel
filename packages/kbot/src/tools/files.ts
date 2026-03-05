// K:BOT File Tools — Read, write, edit, glob, grep
// All operations are local — zero API calls.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

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
      const path = String(args.path)
      if (!existsSync(path)) return `Error: File not found: ${path}`

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
      const path = String(args.path)
      const content = String(args.content)
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
      const path = String(args.path)
      if (!existsSync(path)) return `Error: File not found: ${path}`

      const content = readFileSync(path, 'utf-8')
      const old_string = String(args.old_string)
      const new_string = String(args.new_string)

      const count = content.split(old_string).length - 1
      if (count === 0) return `Error: old_string not found in ${path}`
      if (count > 1) return `Error: old_string found ${count} times — must be unique. Add more context.`

      const updated = content.replace(old_string, new_string)
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
      const cwd = args.path ? String(args.path) : process.cwd()
      try {
        // Use find for simple patterns, or shell glob expansion
        const result = execSync(
          `find "${cwd}" -path '*/${pattern}' -type f 2>/dev/null | head -50`,
          { encoding: 'utf-8', timeout: 10000 }
        ).trim()
        if (!result) {
          // Fallback to using shell expansion
          const result2 = execSync(
            `ls -1 "${cwd}"/${pattern} 2>/dev/null | head -50`,
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
      const searchPath = args.path ? String(args.path) : '.'
      const typeFlag = args.type ? `--type ${args.type}` : ''

      try {
        // Prefer ripgrep, fall back to grep
        const cmd = existsSync('/usr/bin/rg') || existsSync('/usr/local/bin/rg') || existsSync('/opt/homebrew/bin/rg')
          ? `rg -n --max-count 30 ${typeFlag} '${pattern.replace(/'/g, "\\'")}' "${searchPath}" 2>/dev/null`
          : `grep -rn --include='*.${args.type || '*'}' '${pattern.replace(/'/g, "\\'")}' "${searchPath}" 2>/dev/null | head -30`

        const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim()
        return result || 'No matches found'
      } catch {
        return 'No matches found'
      }
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
      const dir = args.path ? String(args.path) : '.'
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
