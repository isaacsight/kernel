#!/usr/bin/env npx tsx
// ─── Obsidian MCP Server ─────────────────────────────────────────
// Bidirectional sync between Kernel memory and Obsidian vault.
//
// Reads:  vault_search, vault_read, vault_list, vault_recent
// Writes: vault_write, vault_append
// Sync:   sync_memory_to_vault, sync_insights_to_vault,
//         sync_vault_to_kernel, sync_briefing_to_vault
//
// Config in .env:
//   OBSIDIAN_VAULT_PATH=/Users/isaachernandez/Desktop/kernel.chat/kernelchat
//
// Run: npx tsx tools/obsidian-mcp.ts
// ──────────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  readdirSync, statSync, appendFileSync,
} from 'fs'
import { join, relative, extname, basename } from 'path'

config()

// ── Config ───────────────────────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH
  || '/Users/isaachernandez/Desktop/kernel.chat/kernelchat'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

// Vault folder conventions
const FOLDERS = {
  kernel: 'Kernel',           // Memory, insights, briefings from Kernel
  memory: 'Kernel/Memory',    // User memory profiles
  insights: 'Kernel/Insights', // Conversation insights + convergence
  briefings: 'Kernel/Briefings', // Daily briefings
  conversations: 'Kernel/Conversations', // Conversation summaries
}

// ── Helpers ──────────────────────────────────────────────────────

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true as const }
}

function ensureFolder(folder: string) {
  const fullPath = join(VAULT_PATH, folder)
  if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true })
  return fullPath
}

function ensureAllFolders() {
  Object.values(FOLDERS).forEach(f => ensureFolder(f))
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0]
}

/** Recursively list all .md files in a directory */
function walkMd(dir: string, root: string = dir): { path: string; relPath: string; mtime: Date; size: number }[] {
  const results: { path: string; relPath: string; mtime: Date; size: number }[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkMd(full, root))
    } else if (extname(entry.name) === '.md') {
      const stat = statSync(full)
      results.push({
        path: full,
        relPath: relative(root, full),
        mtime: stat.mtime,
        size: stat.size,
      })
    }
  }
  return results
}

/** Extract YAML frontmatter tags from a note */
function extractTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return []
  const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/)
  if (tagsMatch) return tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''))
  const tagsMatch2 = fmMatch[1].match(/tags:\s*\n((?:\s*-\s*\S+\n?)+)/)
  if (tagsMatch2) return tagsMatch2[1].split('\n').map(t => t.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
  return []
}

/** Simple full-text search across vault */
function searchVault(query: string, maxResults: number = 20): { relPath: string; matches: string[]; score: number }[] {
  const files = walkMd(VAULT_PATH)
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)
  const results: { relPath: string; matches: string[]; score: number }[] = []

  for (const file of files) {
    const content = readFileSync(file.path, 'utf-8')
    const lines = content.split('\n')
    const matchingLines: string[] = []
    let score = 0

    // Title match gets extra weight
    const title = basename(file.relPath, '.md').toLowerCase()
    for (const term of queryTerms) {
      if (title.includes(term)) score += 5
    }

    for (const line of lines) {
      const lineLower = line.toLowerCase()
      for (const term of queryTerms) {
        if (lineLower.includes(term)) {
          score += 1
          if (!matchingLines.includes(line.trim()) && matchingLines.length < 5) {
            matchingLines.push(line.trim())
          }
        }
      }
    }

    if (score > 0) {
      results.push({ relPath: file.relPath, matches: matchingLines, score })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults)
}

/** Call Kernel claude-proxy for AI extraction */
async function callProxy(
  prompt: string,
  opts: { system?: string; model?: 'sonnet' | 'haiku'; max_tokens?: number } = {}
): Promise<string> {
  const proxyUrl = `${SUPABASE_URL}/functions/v1/claude-proxy`
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode: 'text',
      model: opts.model ?? 'haiku',
      system: opts.system,
      max_tokens: opts.max_tokens ?? 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Proxy error (${res.status}): ${await res.text()}`)
  const { text } = await res.json()
  return text
}

/** Call Supabase RPC */
async function rpc(fnName: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`RPC ${fnName} error (${res.status}): ${await res.text()}`)
  return res.json()
}

// ── MCP Server ───────────────────────────────────────────────────

const server = new McpServer({ name: 'kernel-obsidian', version: '1.0.0' })

// ═══════════════════════════════════════════════════════════════
//  READ — Vault Access
// ═══════════════════════════════════════════════════════════════

server.tool(
  'vault_search',
  'Full-text search across all Obsidian vault notes',
  { query: z.string().describe('Search terms'), max_results: z.number().optional().describe('Max results (default 20)') },
  async ({ query, max_results }) => {
    const results = searchVault(query, max_results ?? 20)
    if (results.length === 0) return ok(`No results for "${query}"`)
    const text = results.map(r =>
      `**${r.relPath}** (score: ${r.score})\n${r.matches.map(m => `  > ${m}`).join('\n')}`
    ).join('\n\n')
    return ok(`Found ${results.length} results for "${query}":\n\n${text}`)
  }
)

server.tool(
  'vault_read',
  'Read a specific note from the Obsidian vault',
  { path: z.string().describe('Relative path within vault (e.g. "Kernel/Memory/profile.md")') },
  async ({ path }) => {
    const fullPath = join(VAULT_PATH, path)
    if (!existsSync(fullPath)) return fail(`Note not found: ${path}`)
    const content = readFileSync(fullPath, 'utf-8')
    return ok(content)
  }
)

server.tool(
  'vault_list',
  'List notes in the vault, optionally filtered by folder',
  {
    folder: z.string().optional().describe('Folder to list (e.g. "Kernel/Memory"). Omit for root.'),
    include_content_preview: z.boolean().optional().describe('Include first 200 chars of each note'),
  },
  async ({ folder, include_content_preview }) => {
    const dir = folder ? join(VAULT_PATH, folder) : VAULT_PATH
    if (!existsSync(dir)) return fail(`Folder not found: ${folder}`)
    const files = walkMd(dir)
    if (files.length === 0) return ok('No notes found.')

    const lines = files
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .map(f => {
        let line = `- **${f.relPath}** (${(f.size / 1024).toFixed(1)}KB, ${f.mtime.toISOString().split('T')[0]})`
        if (include_content_preview) {
          const content = readFileSync(f.path, 'utf-8')
          const preview = content.replace(/^---[\s\S]*?---\n?/, '').trim().substring(0, 200)
          if (preview) line += `\n  > ${preview.replace(/\n/g, ' ')}`
        }
        return line
      })
    return ok(`${files.length} notes${folder ? ` in ${folder}` : ''}:\n\n${lines.join('\n')}`)
  }
)

server.tool(
  'vault_recent',
  'Get recently modified notes from the vault',
  { count: z.number().optional().describe('How many (default 10)') },
  async ({ count }) => {
    const files = walkMd(VAULT_PATH)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, count ?? 10)
    if (files.length === 0) return ok('No notes found.')
    const lines = files.map(f =>
      `- **${f.relPath}** — ${f.mtime.toISOString().replace('T', ' ').split('.')[0]} (${(f.size / 1024).toFixed(1)}KB)`
    )
    return ok(`Recent notes:\n\n${lines.join('\n')}`)
  }
)

// ═══════════════════════════════════════════════════════════════
//  WRITE — Vault Modification
// ═══════════════════════════════════════════════════════════════

server.tool(
  'vault_write',
  'Create or overwrite a note in the Obsidian vault',
  {
    path: z.string().describe('Relative path (e.g. "Projects/my-project.md")'),
    content: z.string().describe('Full markdown content'),
    frontmatter: z.record(z.unknown()).optional().describe('YAML frontmatter fields'),
  },
  async ({ path, content, frontmatter }) => {
    const fullPath = join(VAULT_PATH, path)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    let body = content
    if (frontmatter) {
      const fm = Object.entries(frontmatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n')
      body = `---\n${fm}\n---\n\n${content}`
    }

    writeFileSync(fullPath, body, 'utf-8')
    return ok(`Written: ${path} (${body.length} bytes)`)
  }
)

server.tool(
  'vault_append',
  'Append content to an existing note (creates if missing)',
  {
    path: z.string().describe('Relative path'),
    content: z.string().describe('Content to append'),
    heading: z.string().optional().describe('Optional heading to append under'),
  },
  async ({ path, content, heading }) => {
    const fullPath = join(VAULT_PATH, path)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    let block = ''
    if (heading) {
      block = `\n\n## ${heading}\n\n${content}`
    } else {
      block = `\n\n${content}`
    }

    if (existsSync(fullPath)) {
      appendFileSync(fullPath, block, 'utf-8')
    } else {
      writeFileSync(fullPath, block.trimStart(), 'utf-8')
    }
    return ok(`Appended to: ${path}`)
  }
)

// ═══════════════════════════════════════════════════════════════
//  SYNC — Kernel → Obsidian
// ═══════════════════════════════════════════════════════════════

server.tool(
  'sync_memory_to_vault',
  'Export Kernel user memory profile to Obsidian vault as structured markdown',
  { user_id: z.string().describe('Supabase user ID') },
  async ({ user_id }) => {
    ensureAllFolders()

    // Fetch user memory from Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${user_id}&select=profile,updated_at`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY },
    })
    if (!res.ok) return fail(`Failed to fetch memory: ${res.status}`)
    const rows = await res.json()
    if (!rows.length || !rows[0].profile) return fail('No memory profile found for this user.')

    const profile = rows[0].profile
    const updatedAt = rows[0].updated_at

    // Build markdown
    const sections: string[] = []
    sections.push(`---\ntags: [kernel, memory, auto-sync]\nsynced_at: "${timestamp()}"\nuser_id: "${user_id}"\n---\n`)
    sections.push(`# Kernel Memory Profile\n\n*Last synced: ${timestamp()}*\n*Last updated in Kernel: ${updatedAt}*\n`)

    if (profile.interests?.length) {
      sections.push(`## Interests\n\n${profile.interests.map((i: any) =>
        typeof i === 'string' ? `- ${i}` : `- **${i.item}** (warmth: ${i.warmth?.toFixed(2) ?? '?'})`
      ).join('\n')}`)
    }

    if (profile.goals?.length) {
      sections.push(`## Goals\n\n${profile.goals.map((g: any) =>
        typeof g === 'string' ? `- ${g}` : `- **${g.item}** (warmth: ${g.warmth?.toFixed(2) ?? '?'})`
      ).join('\n')}`)
    }

    if (profile.facts?.length) {
      sections.push(`## Known Facts\n\n${profile.facts.map((f: any) =>
        typeof f === 'string' ? `- ${f}` : `- **${f.item}** (warmth: ${f.warmth?.toFixed(2) ?? '?'})`
      ).join('\n')}`)
    }

    if (profile.preferences?.length) {
      sections.push(`## Preferences\n\n${profile.preferences.map((p: any) =>
        typeof p === 'string' ? `- ${p}` : `- **${p.item}** (warmth: ${p.warmth?.toFixed(2) ?? '?'})`
      ).join('\n')}`)
    }

    if (profile.communication_style) {
      const cs = profile.communication_style
      sections.push(`## Communication Style\n\n- Formality: ${cs.formality ?? '?'}\n- Detail: ${cs.detail_level ?? '?'}\n- Humor: ${cs.humor ?? '?'}\n- Emoji: ${cs.emoji_use ?? '?'}`)
    }

    const notePath = join(FOLDERS.memory, 'Profile.md')
    writeFileSync(join(VAULT_PATH, notePath), sections.join('\n\n'), 'utf-8')
    return ok(`Memory profile synced to ${notePath}`)
  }
)

server.tool(
  'sync_insights_to_vault',
  'Export Kernel conversation insights and convergence data to Obsidian',
  { user_id: z.string().describe('Supabase user ID') },
  async ({ user_id }) => {
    ensureAllFolders()

    // Fetch convergence/facet data from user_memory
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${user_id}&select=agent_facets,user_theory,growth_state`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY },
    })
    if (!res.ok) return fail(`Failed to fetch insights: ${res.status}`)
    const rows = await res.json()
    if (!rows.length) return fail('No data found.')

    const { agent_facets, user_theory, growth_state } = rows[0]
    const sections: string[] = []
    sections.push(`---\ntags: [kernel, insights, auto-sync]\nsynced_at: "${timestamp()}"\n---\n`)
    sections.push(`# Kernel Insights\n\n*Synced: ${timestamp()}*\n`)

    if (agent_facets && Object.keys(agent_facets).length) {
      sections.push(`## Agent Facet Observations\n`)
      for (const [agent, data] of Object.entries(agent_facets)) {
        const facet = data as any
        sections.push(`### ${agent}\n`)
        if (facet.observations?.length) {
          sections.push(facet.observations.map((o: string) => `- ${o}`).join('\n'))
        }
        if (facet.convergence) {
          sections.push(`\n**Convergence:** ${facet.convergence}`)
        }
      }
    }

    if (user_theory) {
      sections.push(`## User Theory (Belief Calibration)\n\n\`\`\`json\n${JSON.stringify(user_theory, null, 2)}\n\`\`\``)
    }

    if (growth_state) {
      sections.push(`## Growth State\n\n\`\`\`json\n${JSON.stringify(growth_state, null, 2)}\n\`\`\``)
    }

    // Also fetch knowledge graph entities
    const kgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/knowledge_graph_entities?user_id=eq.${user_id}&order=mention_count.desc&limit=50`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY } },
    )
    if (kgRes.ok) {
      const entities = await kgRes.json()
      if (entities.length) {
        sections.push(`## Knowledge Graph (Top ${entities.length} Entities)\n`)
        sections.push('| Entity | Type | Mentions | Confidence |')
        sections.push('|--------|------|----------|------------|')
        for (const e of entities) {
          sections.push(`| ${e.name} | ${e.entity_type} | ${e.mention_count} | ${(e.confidence * 100).toFixed(0)}% |`)
        }
      }
    }

    const notePath = join(FOLDERS.insights, `Insights ${today()}.md`)
    writeFileSync(join(VAULT_PATH, notePath), sections.join('\n\n'), 'utf-8')
    return ok(`Insights synced to ${notePath}`)
  }
)

server.tool(
  'sync_briefing_to_vault',
  'Export a Kernel daily briefing to Obsidian',
  {
    user_id: z.string().describe('Supabase user ID'),
    briefing_text: z.string().describe('The briefing content to sync'),
  },
  async ({ user_id, briefing_text }) => {
    ensureAllFolders()

    const content = [
      `---`,
      `tags: [kernel, briefing, auto-sync]`,
      `date: "${today()}"`,
      `synced_at: "${timestamp()}"`,
      `---`,
      ``,
      `# Daily Briefing — ${today()}`,
      ``,
      briefing_text,
    ].join('\n')

    const notePath = join(FOLDERS.briefings, `${today()}.md`)
    writeFileSync(join(VAULT_PATH, notePath), content, 'utf-8')
    return ok(`Briefing synced to ${notePath}`)
  }
)

server.tool(
  'sync_conversation_to_vault',
  'Export a conversation summary to Obsidian',
  {
    title: z.string().describe('Conversation title'),
    summary: z.string().describe('Conversation summary markdown'),
    agents_used: z.array(z.string()).optional().describe('Which agents were involved'),
  },
  async ({ title, summary, agents_used }) => {
    ensureAllFolders()

    const safeName = title.replace(/[/\\:*?"<>|]/g, '-').substring(0, 80)
    const content = [
      `---`,
      `tags: [kernel, conversation, auto-sync]`,
      `date: "${today()}"`,
      `agents: [${(agents_used || []).map(a => `"${a}"`).join(', ')}]`,
      `---`,
      ``,
      `# ${title}`,
      ``,
      `*${timestamp()}*`,
      ``,
      summary,
    ].join('\n')

    const notePath = join(FOLDERS.conversations, `${safeName}.md`)
    writeFileSync(join(VAULT_PATH, notePath), content, 'utf-8')
    return ok(`Conversation synced to ${notePath}`)
  }
)

// ═══════════════════════════════════════════════════════════════
//  SYNC — Obsidian → Kernel
// ═══════════════════════════════════════════════════════════════

server.tool(
  'sync_vault_to_kernel',
  'Read vault notes and extract entities/facts to inject into Kernel knowledge graph',
  {
    user_id: z.string().describe('Supabase user ID'),
    folder: z.string().optional().describe('Specific folder to sync (default: entire vault)'),
    dry_run: z.boolean().optional().describe('Preview extractions without writing to DB'),
  },
  async ({ user_id, folder, dry_run }) => {
    const dir = folder ? join(VAULT_PATH, folder) : VAULT_PATH
    const files = walkMd(dir)
      .filter(f => !f.relPath.startsWith('Kernel/')) // Skip Kernel-generated notes
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, 30) // Process max 30 notes per sync

    if (files.length === 0) return ok('No user notes to sync.')

    // Build a digest of vault content for AI extraction
    const digest = files.map(f => {
      const content = readFileSync(f.path, 'utf-8')
      const tags = extractTags(content)
      const body = content.replace(/^---[\s\S]*?---\n?/, '').trim().substring(0, 1000)
      return `## ${f.relPath}${tags.length ? ` [${tags.join(', ')}]` : ''}\n${body}`
    }).join('\n\n---\n\n')

    // Use Haiku to extract structured entities
    const extraction = await callProxy(
      `Extract entities from these Obsidian vault notes. Return ONLY valid JSON, no markdown fences.\n\nFormat:\n{"entities": [{"name": "...", "type": "person|project|concept|company|preference|location|tool", "properties": {...}, "confidence": 0.5-1.0}], "facts": ["...", "..."], "interests": ["...", "..."]}\n\nNotes:\n${digest}`,
      {
        system: 'You are an entity extraction engine. Extract named entities, facts about the user, and interests from their personal notes. Return ONLY valid JSON.',
        model: 'haiku',
        max_tokens: 4096,
      }
    )

    let parsed: { entities?: any[]; facts?: string[]; interests?: string[] }
    try {
      const jsonStr = extraction.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      return fail(`AI extraction returned invalid JSON: ${extraction.substring(0, 500)}`)
    }

    if (dry_run) {
      return ok(`Dry run — would sync:\n\n**Entities:** ${parsed.entities?.length ?? 0}\n${parsed.entities?.map(e => `- ${e.name} (${e.type}, ${(e.confidence * 100).toFixed(0)}%)`).join('\n') || 'none'}\n\n**Facts:** ${parsed.facts?.length ?? 0}\n${parsed.facts?.map(f => `- ${f}`).join('\n') || 'none'}\n\n**Interests:** ${parsed.interests?.length ?? 0}\n${parsed.interests?.map(i => `- ${i}`).join('\n') || 'none'}`)
    }

    // Upsert entities to knowledge graph
    let entityCount = 0
    for (const entity of (parsed.entities || [])) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_graph_entities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SUPABASE_KEY,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id,
            name: entity.name,
            entity_type: entity.type || 'concept',
            properties: { ...entity.properties, source: 'obsidian' },
            confidence: entity.confidence || 0.7,
            mention_count: 1,
          }),
        })
        entityCount++
      } catch (e) {
        // Continue on individual entity errors
      }
    }

    // Merge facts/interests into user memory profile
    if ((parsed.facts?.length || 0) + (parsed.interests?.length || 0) > 0) {
      const memRes = await fetch(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${user_id}&select=profile`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY },
      })
      if (memRes.ok) {
        const memRows = await memRes.json()
        const profile = memRows[0]?.profile || {}

        // Deduplicate facts
        const existingFacts = new Set((profile.facts || []).map((f: any) =>
          (typeof f === 'string' ? f : f.item).toLowerCase()
        ))
        const newFacts = (parsed.facts || [])
          .filter(f => !existingFacts.has(f.toLowerCase()))
          .map(f => ({ item: f, warmth: 0.6, mentionCount: 1, source: 'obsidian' }))

        const existingInterests = new Set((profile.interests || []).map((i: any) =>
          (typeof i === 'string' ? i : i.item).toLowerCase()
        ))
        const newInterests = (parsed.interests || [])
          .filter(i => !existingInterests.has(i.toLowerCase()))
          .map(i => ({ item: i, warmth: 0.5, mentionCount: 1, source: 'obsidian' }))

        if (newFacts.length + newInterests.length > 0) {
          const updatedProfile = {
            ...profile,
            facts: [...(profile.facts || []), ...newFacts],
            interests: [...(profile.interests || []), ...newInterests],
          }
          await fetch(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${user_id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SERVICE_KEY}`,
              apikey: SUPABASE_KEY,
            },
            body: JSON.stringify({ profile: updatedProfile, updated_at: new Date().toISOString() }),
          })
        }
      }
    }

    return ok(`Vault → Kernel sync complete:\n- ${entityCount} entities upserted to knowledge graph\n- ${parsed.facts?.length ?? 0} facts extracted\n- ${parsed.interests?.length ?? 0} interests extracted\n- Source: ${files.length} notes processed`)
  }
)

server.tool(
  'sync_status',
  'Check sync status: last sync times, vault stats, memory profile age',
  { user_id: z.string().describe('Supabase user ID') },
  async ({ user_id }) => {
    const files = walkMd(VAULT_PATH)
    const kernelFiles = files.filter(f => f.relPath.startsWith('Kernel/'))
    const userFiles = files.filter(f => !f.relPath.startsWith('Kernel/'))

    // Check last memory sync
    const profilePath = join(VAULT_PATH, FOLDERS.memory, 'Profile.md')
    let lastMemorySync = 'never'
    if (existsSync(profilePath)) {
      lastMemorySync = statSync(profilePath).mtime.toISOString().replace('T', ' ').split('.')[0]
    }

    // Check last insights sync
    const insightsDir = join(VAULT_PATH, FOLDERS.insights)
    let lastInsightsSync = 'never'
    if (existsSync(insightsDir)) {
      const insightFiles = walkMd(insightsDir)
      if (insightFiles.length) {
        lastInsightsSync = insightFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0].mtime.toISOString().split('T')[0]
      }
    }

    // Check Kernel memory age
    let memoryAge = 'unknown'
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${user_id}&select=updated_at`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY },
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows.length) memoryAge = rows[0].updated_at
      }
    } catch { /* ignore */ }

    return ok([
      `## Obsidian ↔ Kernel Sync Status`,
      ``,
      `**Vault:** ${VAULT_PATH}`,
      `**Total notes:** ${files.length} (${userFiles.length} user, ${kernelFiles.length} Kernel-generated)`,
      `**Last memory → vault sync:** ${lastMemorySync}`,
      `**Last insights → vault sync:** ${lastInsightsSync}`,
      `**Kernel memory last updated:** ${memoryAge}`,
      ``,
      `**Vault folders:**`,
      ...Object.entries(FOLDERS).map(([k, v]) => {
        const count = files.filter(f => f.relPath.startsWith(v)).length
        return `- ${v}/ — ${count} notes`
      }),
    ].join('\n'))
  }
)

// ── Start ────────────────────────────────────────────────────────

ensureAllFolders()

const transport = new StdioServerTransport()
await server.connect(transport)
