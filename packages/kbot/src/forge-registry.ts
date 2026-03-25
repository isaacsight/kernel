// kbot Forge Registry — Community Tool Sharing
//
// Users forge tools → publish them → others discover and install.
// "The npm of AI tools."

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const FORGE_DIR = join(homedir(), '.kbot', 'forge')
const REGISTRY_URL = process.env.KBOT_FORGE_REGISTRY || 'https://kernel.chat/api/forge'

interface ForgedTool {
  name: string
  description: string
  code: string
  author?: string
  version: string
  created: string
  tags: string[]
}

function ensureForgeDir(): void {
  if (!existsSync(FORGE_DIR)) mkdirSync(FORGE_DIR, { recursive: true })
}

export function listForgedTools(): ForgedTool[] {
  ensureForgeDir()
  const files = readdirSync(FORGE_DIR).filter(f => f.endsWith('.json'))
  return files.map(f => {
    try {
      return JSON.parse(readFileSync(join(FORGE_DIR, f), 'utf-8')) as ForgedTool
    } catch { return null }
  }).filter((t): t is ForgedTool => t !== null)
}

export async function searchForgeRegistry(query: string): Promise<string> {
  try {
    const res = await fetch(`${REGISTRY_URL}/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error(`Registry returned ${res.status}`)
    const tools = await res.json() as Array<{ name: string; description: string; downloads: number }>
    if (!tools.length) return `No tools found for "${query}".`
    return tools.map(t => `${t.name} — ${t.description} (${t.downloads} installs)`).join('\n')
  } catch {
    // Fallback: search local forge
    const local = listForgedTools().filter(t =>
      t.name.includes(query) || t.description.toLowerCase().includes(query.toLowerCase()) ||
      t.tags.some(tag => tag.includes(query))
    )
    if (!local.length) return `No tools found for "${query}". Forge registry may be offline.`
    return local.map(t => `${t.name} — ${t.description} [local]`).join('\n')
  }
}

export async function publishForgedTool(name: string): Promise<string> {
  const toolPath = join(FORGE_DIR, `${name}.json`)
  if (!existsSync(toolPath)) return `Tool "${name}" not found in local forge. Path: ${toolPath}`

  const tool = JSON.parse(readFileSync(toolPath, 'utf-8')) as ForgedTool
  try {
    const res = await fetch(`${REGISTRY_URL}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool),
    })
    if (!res.ok) throw new Error(`Registry returned ${res.status}`)
    return `Published "${name}" to the Forge Registry. Others can install with: kbot forge install ${name}`
  } catch (err) {
    return `Could not publish to registry: ${err instanceof Error ? err.message : String(err)}. Tool saved locally at ${toolPath}.`
  }
}

export async function installForgedTool(name: string): Promise<string> {
  ensureForgeDir()
  try {
    const res = await fetch(`${REGISTRY_URL}/tools/${encodeURIComponent(name)}`)
    if (!res.ok) throw new Error(`Tool "${name}" not found in registry`)
    const tool = await res.json() as ForgedTool
    writeFileSync(join(FORGE_DIR, `${name}.json`), JSON.stringify(tool, null, 2))
    return `Installed "${name}" — ${tool.description}. Available in your next kbot session.`
  } catch (err) {
    return `Could not install "${name}": ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function runForge(action: string, arg?: string): Promise<void> {
  switch (action) {
    case 'list': {
      const tools = listForgedTools()
      if (!tools.length) { console.log('No forged tools yet. kbot will forge tools automatically when needed.'); return }
      console.log(`${tools.length} forged tools:\n`)
      tools.forEach(t => console.log(`  ${t.name} — ${t.description}`))
      break
    }
    case 'search':
      console.log(await searchForgeRegistry(arg || ''))
      break
    case 'publish':
      console.log(await publishForgedTool(arg || ''))
      break
    case 'install':
      console.log(await installForgedTool(arg || ''))
      break
    default:
      console.log('Usage: kbot forge <list|search|publish|install> [name/query]')
  }
}
