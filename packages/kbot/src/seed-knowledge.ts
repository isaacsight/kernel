// kbot Seed Knowledge — Ships with the npm package
//
// Universal patterns and knowledge that every kbot user benefits from.
// Extracted from real usage across 50+ sessions of building software.
// NOT personal data — these are general engineering patterns.
//
// On first run, kbot loads these into the learning engine if no
// existing knowledge exists. Users who already have patterns keep theirs.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

export interface SeedPattern {
  intent: string
  keywords: string[]
  toolSequence: string[]
  category: string
}

export interface SeedKnowledge {
  fact: string
  category: 'context' | 'fact' | 'preference' | 'workflow'
}

// ── Seed Patterns: tool sequences that work ──

export const SEED_PATTERNS: SeedPattern[] = [
  // Build & Deploy
  {
    intent: 'build and publish npm package',
    keywords: ['npm', 'publish', 'build', 'package', 'release'],
    toolSequence: ['read_file', 'edit_file', 'bash', 'bash', 'bash'],
    category: 'build',
  },
  {
    intent: 'type check typescript project',
    keywords: ['typescript', 'type', 'check', 'tsc', 'errors'],
    toolSequence: ['bash'],
    category: 'build',
  },
  {
    intent: 'deploy edge function supabase',
    keywords: ['supabase', 'deploy', 'edge', 'function'],
    toolSequence: ['read_file', 'edit_file', 'bash'],
    category: 'deploy',
  },
  {
    intent: 'build and push docker image',
    keywords: ['docker', 'build', 'push', 'image', 'container'],
    toolSequence: ['read_file', 'edit_file', 'bash', 'bash'],
    category: 'deploy',
  },

  // Code Changes
  {
    intent: 'add new cli command',
    keywords: ['cli', 'command', 'add', 'new', 'subcommand'],
    toolSequence: ['read_file', 'read_file', 'edit_file', 'bash'],
    category: 'build',
  },
  {
    intent: 'fix bug in code',
    keywords: ['fix', 'bug', 'error', 'broken', 'failing'],
    toolSequence: ['grep', 'read_file', 'edit_file', 'bash'],
    category: 'debug',
  },
  {
    intent: 'add new feature module',
    keywords: ['new', 'feature', 'module', 'create', 'add'],
    toolSequence: ['read_file', 'write_file', 'edit_file', 'bash'],
    category: 'build',
  },
  {
    intent: 'write tests for module',
    keywords: ['test', 'write', 'tests', 'vitest', 'jest'],
    toolSequence: ['read_file', 'write_file', 'bash'],
    category: 'test',
  },
  {
    intent: 'refactor existing code',
    keywords: ['refactor', 'clean', 'improve', 'restructure'],
    toolSequence: ['read_file', 'read_file', 'edit_file', 'edit_file', 'bash'],
    category: 'build',
  },

  // Research & Understanding
  {
    intent: 'explain project or codebase',
    keywords: ['explain', 'what', 'does', 'project', 'how', 'works'],
    toolSequence: ['read_file', 'read_file', 'glob', 'read_file'],
    category: 'explain',
  },
  {
    intent: 'find where something is defined',
    keywords: ['find', 'where', 'defined', 'located', 'search'],
    toolSequence: ['grep', 'read_file'],
    category: 'explain',
  },
  {
    intent: 'research topic on web',
    keywords: ['research', 'search', 'find', 'look', 'what', 'latest'],
    toolSequence: ['web_search', 'url_fetch'],
    category: 'search',
  },

  // Git & Version Control
  {
    intent: 'commit and push changes',
    keywords: ['commit', 'push', 'git', 'save', 'ship'],
    toolSequence: ['bash', 'bash', 'bash'],
    category: 'build',
  },
  {
    intent: 'review git changes',
    keywords: ['diff', 'changes', 'what', 'changed', 'review'],
    toolSequence: ['bash', 'bash'],
    category: 'explain',
  },
]

// ── Seed Knowledge: universal engineering facts ──

export const SEED_KNOWLEDGE: SeedKnowledge[] = [
  // Build workflows
  { fact: 'Always type-check (tsc --noEmit) before publishing to npm', category: 'workflow' },
  { fact: 'npm publish requires: version bump → build → type-check → publish', category: 'workflow' },
  { fact: 'Docker images should be tagged with version AND latest', category: 'workflow' },
  { fact: 'Supabase edge functions deploy via: npx supabase functions deploy <name> --project-ref <ref>', category: 'workflow' },
  { fact: 'Git commits should be atomic — one logical change per commit', category: 'workflow' },

  // TypeScript/Node patterns
  { fact: 'package.json "files" field controls what ships to npm — only listed dirs are included', category: 'fact' },
  { fact: 'Commander.js subcommands need explicit process.exit(0) or they fall through to the default action', category: 'fact' },
  { fact: 'Dynamic imports (await import()) are better than static imports for CLI tools — faster startup', category: 'fact' },
  { fact: 'vitest tests use describe/it/expect — same API as Jest but faster', category: 'fact' },

  // Architecture patterns
  { fact: 'New CLI commands go in cli.ts and must be added to the subcommand exit list', category: 'context' },
  { fact: 'New specialist agents must be added to BUILTIN_AGENTS in matrix.ts', category: 'context' },
  { fact: 'Agent count in README, share.ts, cli.ts status, and package.json description must all match', category: 'context' },
  { fact: 'The learning engine only records data from kbot sessions — external agent activity needs the observer', category: 'context' },

  // Testing
  { fact: 'Write tests for new modules before publishing — untested code erodes trust', category: 'workflow' },
  { fact: 'Test edge cases and error paths, not just happy paths', category: 'workflow' },

  // Distribution
  { fact: 'README is the npm landing page — it must be accurate and compelling for new users', category: 'workflow' },
  { fact: 'Docker Hub images go stale if not rebuilt after npm updates — check after every release', category: 'workflow' },
  { fact: 'Shields.io badges in README increase perceived professionalism and click-through', category: 'fact' },
]

// ── Seed Loading ──

/**
 * Load seed knowledge into kbot's learning engine on first run.
 * Only runs if no existing patterns/knowledge exist (new install).
 */
export async function loadSeedKnowledge(): Promise<{ seeded: boolean; patterns: number; facts: number }> {
  const memDir = join(homedir(), '.kbot', 'memory')
  const patternsFile = join(memDir, 'patterns.json')
  const knowledgeFile = join(memDir, 'knowledge.json')

  // Check if user already has learning data — don't overwrite
  const hasPatterns = existsSync(patternsFile) && JSON.parse(readFileSync(patternsFile, 'utf8')).length > 0
  const hasKnowledge = existsSync(knowledgeFile) && JSON.parse(readFileSync(knowledgeFile, 'utf8')).length > 2

  if (hasPatterns && hasKnowledge) {
    return { seeded: false, patterns: 0, facts: 0 }
  }

  // Load learning engine and seed
  const { learnFact, flushPendingWrites } = await import('./learning.js')

  let factsSeeded = 0
  if (!hasKnowledge) {
    for (const k of SEED_KNOWLEDGE) {
      learnFact(k.fact, k.category as any, 'observed')
      factsSeeded++
    }
  }

  // Seed patterns by writing directly (the learning engine API expects runtime usage)
  let patternsSeeded = 0
  if (!hasPatterns) {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true })

    const seedPatterns = SEED_PATTERNS.map(p => ({
      intent: p.intent,
      keywords: p.keywords,
      toolSequence: p.toolSequence,
      hits: 3, // pretend each was used 3x so they have weight
      successRate: 0.9,
      lastUsed: new Date().toISOString(),
      avgTokensSaved: 0,
    }))

    if (!existsSync(patternsFile) || JSON.parse(readFileSync(patternsFile, 'utf8')).length === 0) {
      writeFileSync(patternsFile, JSON.stringify(seedPatterns, null, 2))
      patternsSeeded = seedPatterns.length
    }
  }

  flushPendingWrites()
  return { seeded: true, patterns: patternsSeeded, facts: factsSeeded }
}
