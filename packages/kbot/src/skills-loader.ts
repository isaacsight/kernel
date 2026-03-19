// Skills Loader — Auto-discover and load .md skill files
//
// Skill files are Markdown documents that inject domain knowledge, tool combinations,
// and project-specific patterns into the agent's context. They're the kbot equivalent
// of Copilot's "Agent Skills" or Cursor's "Rules for AI."
//
// Discovery locations (in priority order):
//   1. ./.kbot/skills/*.md  — project-specific skills
//   2. ~/.kbot/skills/*.md  — user global skills
//
// Token budget: 2000 tokens max (~8000 characters) to leave room for
// repo map, learning context, and memory.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

const MAX_SKILL_TOKENS = 2000
const estimateTokens = (text: string) => Math.ceil(text.length / 4)

export interface SkillFile {
  name: string
  path: string
  content: string
  tokens: number
}

/**
 * Discover and load skill files from project and global directories.
 * Returns formatted string ready to inject into system prompt.
 */
export function loadSkills(projectRoot: string): string {
  const skills = discoverSkillFiles(projectRoot)
  if (skills.length === 0) return ''
  return formatSkillsForPrompt(skills)
}

/**
 * Discover .md files from both project-local and global skill directories.
 * Project skills take precedence (loaded first, consume token budget first).
 */
export function discoverSkillFiles(projectRoot: string): SkillFile[] {
  const locations = [
    join(projectRoot, '.kbot', 'skills'),       // Project-specific
    join(homedir(), '.kbot', 'skills'),          // User global
  ]

  const skills: SkillFile[] = []
  const seen = new Set<string>() // Deduplicate by filename

  for (const dir of locations) {
    if (!existsSync(dir)) continue
    try {
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .sort() // Alphabetical for deterministic ordering
      for (const file of files) {
        if (seen.has(file)) continue // Project overrides global
        seen.add(file)
        try {
          const path = join(dir, file)
          const content = readFileSync(path, 'utf-8').trim()
          if (content.length === 0) continue
          skills.push({
            name: basename(file, '.md'),
            path,
            content,
            tokens: estimateTokens(content),
          })
        } catch { /* permission denied, etc. */ }
      }
    } catch { /* directory read error */ }
  }

  return skills
}

/**
 * Format skill files for prompt injection, respecting token budget.
 */
function formatSkillsForPrompt(skills: SkillFile[], maxTokens = MAX_SKILL_TOKENS): string {
  const parts: string[] = []
  let currentTokens = 0

  for (const skill of skills) {
    if (currentTokens + skill.tokens > maxTokens) {
      // Try to fit a truncated version
      const remaining = maxTokens - currentTokens
      if (remaining > 100) {
        const truncated = skill.content.slice(0, remaining * 4) + '\n...(truncated)'
        parts.push(`## Skill: ${skill.name}\n${truncated}`)
      }
      break
    }
    parts.push(`## Skill: ${skill.name}\n${skill.content}`)
    currentTokens += skill.tokens
  }

  if (parts.length === 0) return ''
  return `\n\n[Custom Skills]\n${parts.join('\n---\n')}`
}
