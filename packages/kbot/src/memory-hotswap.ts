// kbot Memory Hot-Swap — Swap learning modules at runtime
//
// Load different expertise profiles for different projects
// without restarting kbot. Profiles contain patterns, solutions,
// user profile, and routing data.
//
// Stored at ~/.kbot/memory-profiles/{name}/

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, cpSync, rmSync, statSync,
} from 'node:fs'

const KBOT_DIR = join(homedir(), '.kbot')
const MEMORY_DIR = join(KBOT_DIR, 'memory')
const PROFILES_DIR = join(KBOT_DIR, 'memory-profiles')
const ACTIVE_PROFILE_FILE = join(MEMORY_DIR, 'active-profile.json')
const BACKUP_NAME = '_backup'

/** Files that constitute a memory profile */
const PROFILE_FILES = [
  'patterns.json',
  'solutions.json',
  'profile.json',
  'routing-history.json',
  'knowledge.json',
  'corrections.json',
  'context.md',
]

/** Metadata stored alongside each profile */
interface ProfileMetadata {
  name: string
  description: string
  expertise: string
  created_at: string
  updated_at: string
}

/** Profile info returned by listing */
export interface MemoryProfile {
  name: string
  description: string
  patterns_count: number
  created_at: string
}

/** Active profile marker */
interface ActiveProfileMarker {
  name: string
  loaded_at: string
  previous_backup: string | null
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function ensureProfilesDir(): void {
  ensureDir(PROFILES_DIR)
}

function ensureMemoryDir(): void {
  ensureDir(MEMORY_DIR)
}

function profileDir(name: string): string {
  return join(PROFILES_DIR, name)
}

function loadJSON<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return fallback
  }
}

function countPatterns(dir: string): number {
  const patternsPath = join(dir, 'patterns.json')
  const patterns = loadJSON<unknown[]>(patternsPath, [])
  return Array.isArray(patterns) ? patterns.length : 0
}

/** Copy memory files from source directory to target directory */
function copyMemoryFiles(sourceDir: string, targetDir: string): number {
  ensureDir(targetDir)
  let copied = 0
  for (const file of PROFILE_FILES) {
    const src = join(sourceDir, file)
    if (existsSync(src)) {
      cpSync(src, join(targetDir, file))
      copied++
    }
  }
  return copied
}

/**
 * Scan ~/.kbot/memory-profiles/ for saved profiles.
 * Returns array of profile metadata.
 */
export function listMemoryProfiles(): MemoryProfile[] {
  ensureProfilesDir()
  const entries = readdirSync(PROFILES_DIR, { withFileTypes: true })
  const profiles: MemoryProfile[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // Skip the internal backup directory
    if (entry.name === BACKUP_NAME) continue

    const dir = profileDir(entry.name)
    const metaPath = join(dir, 'metadata.json')
    const meta = loadJSON<ProfileMetadata>(metaPath, {
      name: entry.name,
      description: '',
      expertise: '',
      created_at: '',
      updated_at: '',
    })

    // If no created_at in metadata, use directory stat
    let createdAt = meta.created_at
    if (!createdAt) {
      try {
        const stat = statSync(dir)
        createdAt = stat.birthtime.toISOString()
      } catch {
        createdAt = new Date().toISOString()
      }
    }

    profiles.push({
      name: meta.name || entry.name,
      description: meta.description || '',
      patterns_count: countPatterns(dir),
      created_at: createdAt,
    })
  }

  return profiles.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Snapshot current ~/.kbot/memory/ into a named profile.
 * Saves all learning data (patterns, solutions, profile, routing).
 */
export function saveCurrentAsProfile(
  name: string,
  description?: string,
): { name: string; patterns_saved: number } {
  ensureMemoryDir()
  ensureProfilesDir()

  const sanitized = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60)
  const targetDir = profileDir(sanitized)

  // Copy current memory files into the profile directory
  copyMemoryFiles(MEMORY_DIR, targetDir)

  // Count patterns in the snapshot
  const patternsCount = countPatterns(targetDir)

  // Write metadata
  const meta: ProfileMetadata = {
    name: sanitized,
    description: description || `Profile snapshot of ${name}`,
    expertise: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  writeFileSync(join(targetDir, 'metadata.json'), JSON.stringify(meta, null, 2))

  return { name: sanitized, patterns_saved: patternsCount }
}

/**
 * Load a named profile into ~/.kbot/memory/.
 * Backs up current memory to _backup first.
 */
export function loadProfile(name: string): {
  name: string
  patterns_loaded: number
  previous_backup: string
} {
  ensureProfilesDir()
  ensureMemoryDir()

  const sanitized = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60)
  const sourceDir = profileDir(sanitized)

  if (!existsSync(sourceDir)) {
    throw new Error(`Profile "${sanitized}" not found in ${PROFILES_DIR}`)
  }

  // Backup current memory
  const backupDir = profileDir(BACKUP_NAME)
  copyMemoryFiles(MEMORY_DIR, backupDir)

  // Write backup metadata
  const backupMeta: ProfileMetadata = {
    name: BACKUP_NAME,
    description: 'Auto-backup before profile load',
    expertise: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  writeFileSync(join(backupDir, 'metadata.json'), JSON.stringify(backupMeta, null, 2))

  // Copy profile files into memory directory
  copyMemoryFiles(sourceDir, MEMORY_DIR)

  const patternsLoaded = countPatterns(MEMORY_DIR)

  // Mark the active profile
  const marker: ActiveProfileMarker = {
    name: sanitized,
    loaded_at: new Date().toISOString(),
    previous_backup: BACKUP_NAME,
  }
  writeFileSync(ACTIVE_PROFILE_FILE, JSON.stringify(marker, null, 2))

  return {
    name: sanitized,
    patterns_loaded: patternsLoaded,
    previous_backup: BACKUP_NAME,
  }
}

/**
 * Unload the current profile, restoring from _backup.
 * Returns to the previous state before loadProfile was called.
 */
export function unloadProfile(): { restored: boolean; previous_profile: string | null } {
  ensureMemoryDir()
  ensureProfilesDir()

  const active = getActiveProfile()
  if (!active) {
    return { restored: false, previous_profile: null }
  }

  const backupDir = profileDir(BACKUP_NAME)
  if (!existsSync(backupDir)) {
    throw new Error('No backup found. Cannot unload profile without a previous backup.')
  }

  const previousName = active.name

  // Restore backup into memory
  copyMemoryFiles(backupDir, MEMORY_DIR)

  // Remove the active profile marker
  if (existsSync(ACTIVE_PROFILE_FILE)) {
    rmSync(ACTIVE_PROFILE_FILE)
  }

  // Clean up backup
  rmSync(backupDir, { recursive: true, force: true })

  return { restored: true, previous_profile: previousName }
}

/**
 * Create a new empty profile with metadata.
 * Seeds initial routing preferences based on expertise string.
 */
export function createProfile(
  name: string,
  description: string,
  expertise: string,
): { name: string; created: boolean } {
  ensureProfilesDir()

  const sanitized = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60)
  const targetDir = profileDir(sanitized)

  if (existsSync(targetDir)) {
    throw new Error(`Profile "${sanitized}" already exists`)
  }

  ensureDir(targetDir)

  // Write metadata
  const meta: ProfileMetadata = {
    name: sanitized,
    description,
    expertise,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  writeFileSync(join(targetDir, 'metadata.json'), JSON.stringify(meta, null, 2))

  // Seed empty patterns and solutions
  writeFileSync(join(targetDir, 'patterns.json'), JSON.stringify([], null, 2))
  writeFileSync(join(targetDir, 'solutions.json'), JSON.stringify([], null, 2))

  // Seed routing preferences based on expertise
  const routingPrefs = buildRoutingPreferences(expertise)
  writeFileSync(join(targetDir, 'routing-history.json'), JSON.stringify(routingPrefs, null, 2))

  // Seed profile with expertise info
  const userProfile = {
    expertise,
    preferred_languages: [expertise],
    created_at: new Date().toISOString(),
  }
  writeFileSync(join(targetDir, 'profile.json'), JSON.stringify(userProfile, null, 2))

  return { name: sanitized, created: true }
}

/**
 * Returns which profile is currently loaded.
 * Reads ~/.kbot/memory/active-profile.json.
 */
export function getActiveProfile(): ActiveProfileMarker | null {
  ensureMemoryDir()
  if (!existsSync(ACTIVE_PROFILE_FILE)) return null
  try {
    return JSON.parse(readFileSync(ACTIVE_PROFILE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

/** Build initial routing preferences from an expertise keyword */
function buildRoutingPreferences(expertise: string): unknown[] {
  const agentMap: Record<string, string> = {
    python: 'coder',
    react: 'coder',
    typescript: 'coder',
    rust: 'coder',
    go: 'coder',
    java: 'coder',
    swift: 'coder',
    ruby: 'coder',
    devops: 'infrastructure',
    docker: 'infrastructure',
    terraform: 'infrastructure',
    kubernetes: 'infrastructure',
    security: 'guardian',
    design: 'aesthete',
    writing: 'writer',
    research: 'researcher',
    data: 'quant',
    trading: 'quant',
    strategy: 'strategist',
  }

  const agent = agentMap[expertise.toLowerCase()] || 'coder'
  const now = new Date().toISOString()

  return [
    {
      intent: expertise.toLowerCase(),
      keywords: [expertise.toLowerCase()],
      agent,
      method: 'category',
      success: true,
      count: 1,
      lastUsed: now,
    },
  ]
}
