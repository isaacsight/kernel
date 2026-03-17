// K:BOT Database Tools — SQL queries, schema inspection, migrations, Prisma, ER diagrams, seeding
// Bridges kbot to Postgres, MySQL, and SQLite databases via CLI tools.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { registerTool } from './index.js'

// ── Helpers ──────────────────────────────────────────────────────────

type DbType = 'postgres' | 'mysql' | 'sqlite'

interface DbConnection {
  type: DbType
  url: string
}

/** Detect database type from a connection string */
function detectDbType(url: string): DbType {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres'
  if (url.startsWith('mysql://')) return 'mysql'
  if (url.startsWith('sqlite:') || url.endsWith('.db') || url.endsWith('.sqlite') || url.endsWith('.sqlite3')) return 'sqlite'
  throw new Error(`Cannot detect database type from URL: ${url.slice(0, 30)}... — expected postgres://, mysql://, or sqlite: prefix`)
}

/** Resolve a database connection from explicit arg or environment variables */
function resolveConnection(connectionString?: string): DbConnection {
  if (connectionString) {
    return { type: detectDbType(connectionString), url: connectionString }
  }

  // Check environment variables in priority order
  const envVars = ['DATABASE_URL', 'POSTGRES_URL', 'MYSQL_URL', 'SQLITE_PATH']
  for (const envVar of envVars) {
    const val = process.env[envVar]
    if (val) {
      if (envVar === 'SQLITE_PATH') {
        return { type: 'sqlite', url: val }
      }
      return { type: detectDbType(val), url: val }
    }
  }

  throw new Error('No database connection found. Pass a connection_string or set DATABASE_URL, POSTGRES_URL, MYSQL_URL, or SQLITE_PATH.')
}

/** Extract SQLite file path from connection string */
function sqlitePath(url: string): string {
  return url.replace(/^sqlite:\/?\/?/, '').replace(/^sqlite:/, '')
}

/** Parse a Postgres connection string into psql-compatible env vars */
function pgEnv(url: string): Record<string, string> {
  try {
    const u = new URL(url)
    return {
      ...process.env as Record<string, string>,
      PGHOST: u.hostname,
      PGPORT: u.port || '5432',
      PGUSER: u.username,
      PGPASSWORD: decodeURIComponent(u.password),
      PGDATABASE: u.pathname.slice(1),
      PGSSLMODE: u.searchParams.get('sslmode') || 'prefer',
    }
  } catch {
    return process.env as Record<string, string>
  }
}

/** Parse a MySQL connection string for CLI usage */
function mysqlArgs(url: string): string[] {
  try {
    const u = new URL(url)
    const args: string[] = []
    if (u.hostname) args.push('-h', u.hostname)
    if (u.port) args.push('-P', u.port)
    if (u.username) args.push('-u', u.username)
    if (u.password) args.push(`-p${decodeURIComponent(u.password)}`)
    const db = u.pathname.slice(1)
    if (db) args.push(db)
    return args
  } catch {
    return []
  }
}

/** Execute a shell command and return stdout, with timeout */
function shell(cmd: string, opts?: { timeout?: number; env?: Record<string, string>; cwd?: string }): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      timeout: opts?.timeout ?? 30_000,
      maxBuffer: 10 * 1024 * 1024,
      env: opts?.env ?? process.env as Record<string, string>,
      cwd: opts?.cwd ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    const msg = e.stderr?.trim() || e.stdout?.trim() || e.message || 'Command failed'
    throw new Error(msg)
  }
}

/** Execute a SQL query against the resolved database */
function execQuery(conn: DbConnection, sql: string, timeout = 30_000): string {
  switch (conn.type) {
    case 'postgres': {
      const env = pgEnv(conn.url)
      return shell(`psql -A -t -c ${JSON.stringify(sql)}`, { env, timeout })
    }
    case 'mysql': {
      const args = mysqlArgs(conn.url)
      return shell(`mysql ${args.map(a => JSON.stringify(a)).join(' ')} -e ${JSON.stringify(sql)}`, { timeout })
    }
    case 'sqlite': {
      const dbPath = sqlitePath(conn.url)
      return shell(`sqlite3 ${JSON.stringify(dbPath)} ${JSON.stringify(sql)}`, { timeout })
    }
  }
}

// ── Fake data generators for seeding ─────────────────────────────────

const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Ruby', 'Sam', 'Tina']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
const DOMAINS = ['example.com', 'mail.com', 'test.io', 'demo.org', 'corp.net']
const LOREM = ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor incididunt', 'Ut labore et dolore magna aliqua', 'Ut enim ad minim veniam', 'Quis nostrud exercitation ullamco', 'Duis aute irure dolor in reprehenderit', 'Excepteur sint occaecat cupidatat', 'Sunt in culpa qui officia', 'Mollit anim id est laborum']
const CITIES = ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Mumbai', 'Seoul', 'Mexico City']
const COUNTRIES = ['US', 'UK', 'JP', 'FR', 'DE', 'AU', 'CA', 'IN', 'KR', 'MX']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randDate(startYear = 2020, endYear = 2026): string {
  const y = randInt(startYear, endYear)
  const m = String(randInt(1, 12)).padStart(2, '0')
  const d = String(randInt(1, 28)).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function randTimestamp(): string {
  return `${randDate()} ${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`
}

function randBool(): string {
  return Math.random() > 0.5 ? 'true' : 'false'
}

function randUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

/** Generate a realistic fake value based on column name and type */
function fakeValue(colName: string, colType: string, rowIndex: number): string {
  const name = colName.toLowerCase()
  const type = colType.toLowerCase()

  // UUID / ID columns
  if (name === 'id' || name === 'uuid' || type.includes('uuid')) return `'${randUuid()}'`
  if (name === 'id' && (type.includes('int') || type.includes('serial'))) return String(rowIndex + 1)

  // Name patterns
  if (name.includes('first_name') || name === 'fname') return `'${pick(FIRST_NAMES)}'`
  if (name.includes('last_name') || name === 'lname' || name === 'surname') return `'${pick(LAST_NAMES)}'`
  if (name === 'name' || name === 'full_name' || name === 'display_name' || name === 'username') return `'${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}'`

  // Email
  if (name.includes('email')) return `'${pick(FIRST_NAMES).toLowerCase()}${randInt(1, 999)}@${pick(DOMAINS)}'`

  // Phone
  if (name.includes('phone') || name.includes('tel')) return `'+1${randInt(200, 999)}${randInt(100, 999)}${randInt(1000, 9999)}'`

  // URLs
  if (name.includes('url') || name.includes('website') || name.includes('link')) return `'https://${pick(DOMAINS)}/page/${randInt(1, 1000)}'`
  if (name.includes('avatar') || name.includes('image') || name.includes('photo')) return `'https://${pick(DOMAINS)}/img/${randInt(1, 500)}.jpg'`

  // Location
  if (name.includes('city')) return `'${pick(CITIES)}'`
  if (name.includes('country') || name.includes('country_code')) return `'${pick(COUNTRIES)}'`
  if (name.includes('address') || name.includes('street')) return `'${randInt(1, 9999)} ${pick(LAST_NAMES)} St'`
  if (name.includes('zip') || name.includes('postal')) return `'${String(randInt(10000, 99999))}'`
  if (name.includes('lat')) return String((Math.random() * 180 - 90).toFixed(6))
  if (name.includes('lng') || name.includes('lon')) return String((Math.random() * 360 - 180).toFixed(6))

  // Text / description
  if (name.includes('title') || name === 'subject') return `'${pick(LOREM)}'`
  if (name.includes('description') || name.includes('body') || name.includes('content') || name.includes('text') || name.includes('bio') || name.includes('note')) return `'${pick(LOREM)}. ${pick(LOREM)}.'`

  // Status / enums
  if (name.includes('status')) return `'${pick(['active', 'inactive', 'pending', 'archived'])}'`
  if (name.includes('role')) return `'${pick(['admin', 'user', 'editor', 'viewer'])}'`
  if (name.includes('type') || name.includes('category') || name.includes('kind')) return `'${pick(['standard', 'premium', 'basic', 'enterprise'])}'`

  // Boolean
  if (type.includes('bool') || name.startsWith('is_') || name.startsWith('has_') || name.startsWith('can_')) return randBool()

  // Dates / timestamps
  if (name.includes('created') || name.includes('updated') || name.includes('deleted') || name.includes('_at') || type.includes('timestamp')) return `'${randTimestamp()}'`
  if (type.includes('date')) return `'${randDate()}'`

  // Numeric
  if (name.includes('price') || name.includes('amount') || name.includes('cost') || name.includes('total') || name.includes('balance')) return (Math.random() * 1000).toFixed(2)
  if (name.includes('count') || name.includes('quantity') || name.includes('qty')) return String(randInt(1, 100))
  if (name.includes('age')) return String(randInt(18, 80))
  if (name.includes('score') || name.includes('rating')) return (Math.random() * 5).toFixed(1)
  if (name.includes('percent') || name.includes('rate')) return (Math.random() * 100).toFixed(1)
  if (type.includes('int') || type.includes('serial')) return String(randInt(1, 10000))
  if (type.includes('float') || type.includes('double') || type.includes('decimal') || type.includes('numeric') || type.includes('real')) return (Math.random() * 1000).toFixed(2)

  // JSON columns
  if (type.includes('json')) return `'${JSON.stringify({ key: pick(FIRST_NAMES).toLowerCase(), value: randInt(1, 100) })}'`

  // Default: short text
  return `'${pick(LOREM).slice(0, 50)}'`
}

// ── Schema query helpers ─────────────────────────────────────────────

interface ColumnInfo {
  table: string
  column: string
  type: string
  nullable: string
  default_val: string
  is_pk: boolean
  fk_ref: string
}

function getPostgresSchema(conn: DbConnection, tableFilter?: string): ColumnInfo[] {
  const tableClause = tableFilter ? `AND c.table_name = '${tableFilter}'` : ''
  const sql = `
    SELECT
      c.table_name,
      c.column_name,
      c.data_type || COALESCE('(' || c.character_maximum_length || ')', ''),
      c.is_nullable,
      COALESCE(c.column_default, ''),
      CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END,
      COALESCE(fk.ref, '')
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    LEFT JOIN (
      SELECT
        kcu.table_name,
        kcu.column_name,
        ccu.table_name || '.' || ccu.column_name AS ref
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
    WHERE c.table_schema = 'public' ${tableClause}
    ORDER BY c.table_name, c.ordinal_position;
  `
  const raw = execQuery(conn, sql)
  if (!raw.trim()) return []
  return raw.split('\n').filter(l => l.trim()).map(line => {
    const parts = line.split('|')
    return {
      table: parts[0]?.trim() || '',
      column: parts[1]?.trim() || '',
      type: parts[2]?.trim() || '',
      nullable: parts[3]?.trim() || '',
      default_val: parts[4]?.trim() || '',
      is_pk: parts[5]?.trim() === 'YES',
      fk_ref: parts[6]?.trim() || '',
    }
  })
}

function getMysqlSchema(conn: DbConnection, tableFilter?: string): ColumnInfo[] {
  // Extract database name from URL
  let dbName = ''
  try { dbName = new URL(conn.url).pathname.slice(1) } catch {}
  const tableClause = tableFilter ? `AND c.TABLE_NAME = '${tableFilter}'` : ''
  const sql = `
    SELECT
      c.TABLE_NAME,
      c.COLUMN_NAME,
      c.COLUMN_TYPE,
      c.IS_NULLABLE,
      IFNULL(c.COLUMN_DEFAULT, ''),
      CASE WHEN c.COLUMN_KEY = 'PRI' THEN 'YES' ELSE 'NO' END,
      IFNULL(
        (SELECT CONCAT(kcu.REFERENCED_TABLE_NAME, '.', kcu.REFERENCED_COLUMN_NAME)
         FROM information_schema.KEY_COLUMN_USAGE kcu
         WHERE kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
           AND kcu.TABLE_NAME = c.TABLE_NAME
           AND kcu.COLUMN_NAME = c.COLUMN_NAME
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
         LIMIT 1), ''
      )
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = '${dbName}' ${tableClause}
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
  `
  const raw = execQuery(conn, sql)
  if (!raw.trim()) return []
  return raw.split('\n').filter(l => l.trim() && !l.startsWith('+')).map(line => {
    const parts = line.split('\t')
    return {
      table: parts[0]?.trim() || '',
      column: parts[1]?.trim() || '',
      type: parts[2]?.trim() || '',
      nullable: parts[3]?.trim() || '',
      default_val: parts[4]?.trim() || '',
      is_pk: parts[5]?.trim() === 'YES',
      fk_ref: parts[6]?.trim() || '',
    }
  })
}

function getSqliteSchema(conn: DbConnection, tableFilter?: string): ColumnInfo[] {
  const dbPath = sqlitePath(conn.url)
  // Get table list
  let tables: string[]
  if (tableFilter) {
    tables = [tableFilter]
  } else {
    const raw = shell(`sqlite3 ${JSON.stringify(dbPath)} ".tables"`)
    tables = raw.split(/\s+/).filter(t => t.trim() && !t.startsWith('sqlite_'))
  }

  const columns: ColumnInfo[] = []
  for (const table of tables) {
    const info = shell(`sqlite3 ${JSON.stringify(dbPath)} "PRAGMA table_info('${table}')"`)
    if (!info.trim()) continue

    // Get foreign keys for this table
    const fkRaw = shell(`sqlite3 ${JSON.stringify(dbPath)} "PRAGMA foreign_key_list('${table}')"`)
    const fkMap = new Map<string, string>()
    if (fkRaw.trim()) {
      for (const fkLine of fkRaw.split('\n')) {
        const fkParts = fkLine.split('|')
        // Format: id|seq|table|from|to|on_update|on_delete|match
        if (fkParts[3] && fkParts[2]) {
          fkMap.set(fkParts[3], `${fkParts[2]}.${fkParts[4] || 'id'}`)
        }
      }
    }

    for (const line of info.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split('|')
      // Format: cid|name|type|notnull|dflt_value|pk
      columns.push({
        table,
        column: parts[1] || '',
        type: parts[2] || '',
        nullable: parts[3] === '1' ? 'NO' : 'YES',
        default_val: parts[4] || '',
        is_pk: parts[5] === '1',
        fk_ref: fkMap.get(parts[1] || '') || '',
      })
    }
  }
  return columns
}

function getSchema(conn: DbConnection, tableFilter?: string): ColumnInfo[] {
  switch (conn.type) {
    case 'postgres': return getPostgresSchema(conn, tableFilter)
    case 'mysql': return getMysqlSchema(conn, tableFilter)
    case 'sqlite': return getSqliteSchema(conn, tableFilter)
  }
}

/** Format schema info into a readable table */
function formatSchema(columns: ColumnInfo[]): string {
  if (columns.length === 0) return 'No tables found or no columns returned.'

  const tables = new Map<string, ColumnInfo[]>()
  for (const col of columns) {
    if (!tables.has(col.table)) tables.set(col.table, [])
    tables.get(col.table)!.push(col)
  }

  const lines: string[] = []
  for (const [tableName, cols] of tables) {
    lines.push(`\n### ${tableName}`)
    lines.push('')
    lines.push('| Column | Type | Nullable | PK | Default | FK |')
    lines.push('|--------|------|----------|----|---------|----|')
    for (const c of cols) {
      lines.push(`| ${c.column} | ${c.type} | ${c.nullable} | ${c.is_pk ? 'YES' : ''} | ${c.default_val || ''} | ${c.fk_ref || ''} |`)
    }
  }
  return lines.join('\n')
}

/** Generate Mermaid ER diagram from schema columns */
function generateMermaidDiagram(columns: ColumnInfo[]): string {
  if (columns.length === 0) return 'No schema data to diagram.'

  const tables = new Map<string, ColumnInfo[]>()
  for (const col of columns) {
    if (!tables.has(col.table)) tables.set(col.table, [])
    tables.get(col.table)!.push(col)
  }

  const lines: string[] = ['erDiagram']

  // Collect relationships (deduplicated)
  const relationships = new Set<string>()
  for (const [tableName, cols] of tables) {
    for (const col of cols) {
      if (col.fk_ref) {
        const [refTable] = col.fk_ref.split('.')
        // table }o--|| refTable : "column"
        relationships.add(`    ${refTable} ||--o{ ${tableName} : "${col.column}"`)
      }
    }
  }

  // Write relationships
  for (const rel of relationships) {
    lines.push(rel)
  }

  // Write entities
  for (const [tableName, cols] of tables) {
    lines.push(`    ${tableName} {`)
    for (const col of cols) {
      const mermaidType = col.type.replace(/\s+/g, '_').replace(/[()]/g, '')
      const pk = col.is_pk ? ' PK' : ''
      const fk = col.fk_ref ? ' FK' : ''
      lines.push(`        ${mermaidType} ${col.column}${pk}${fk}`)
    }
    lines.push('    }')
  }

  return lines.join('\n')
}

// ── Tool Registration ────────────────────────────────────────────────

export function registerDatabaseTools(): void {

  // ── db_query ─────────────────────────────────────────────────────
  registerTool({
    name: 'db_query',
    description: 'Execute a SQL query against a database (Postgres, MySQL, SQLite). Returns formatted results. Use for SELECT, INSERT, UPDATE, DELETE.',
    parameters: {
      sql: { type: 'string', description: 'SQL query to execute', required: true },
      connection_string: { type: 'string', description: 'Database connection string (e.g., postgres://user:pass@host/db). If omitted, reads from DATABASE_URL env.' },
      timeout: { type: 'number', description: 'Query timeout in ms (default: 30000)' },
    },
    tier: 'pro',
    timeout: 60_000,
    async execute(args) {
      try {
        const conn = resolveConnection(args.connection_string ? String(args.connection_string) : undefined)
        const sql = String(args.sql)
        const timeout = typeof args.timeout === 'number' ? args.timeout : 30_000

        // Basic safety: warn on destructive operations
        const trimmedSql = sql.trim().toUpperCase()
        if (trimmedSql.startsWith('DROP') || trimmedSql.startsWith('TRUNCATE')) {
          return `Warning: Destructive operation detected (${trimmedSql.split(/\s+/)[0]}). Re-run with explicit confirmation if intended.\n\nQuery: ${sql}`
        }

        const result = execQuery(conn, sql, timeout)
        if (!result.trim()) return `Query executed successfully. (no output)`
        return `**${conn.type}** query result:\n\n${result}`
      } catch (err) {
        return `Database query error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── db_schema ────────────────────────────────────────────────────
  registerTool({
    name: 'db_schema',
    description: 'Inspect database schema — tables, columns, types, nullable, primary keys, foreign keys. Works with Postgres, MySQL, SQLite.',
    parameters: {
      connection_string: { type: 'string', description: 'Database connection string. If omitted, reads from DATABASE_URL env.' },
      table: { type: 'string', description: 'Specific table name to inspect (default: all tables)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      try {
        const conn = resolveConnection(args.connection_string ? String(args.connection_string) : undefined)
        const tableFilter = args.table ? String(args.table) : undefined
        const columns = getSchema(conn, tableFilter)
        const formatted = formatSchema(columns)

        const tableCount = new Set(columns.map(c => c.table)).size
        const header = tableFilter
          ? `**${conn.type}** — table \`${tableFilter}\` (${columns.length} columns)`
          : `**${conn.type}** — ${tableCount} tables, ${columns.length} columns`

        return `${header}\n${formatted}`
      } catch (err) {
        return `Schema inspection error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── db_migrate ───────────────────────────────────────────────────
  registerTool({
    name: 'db_migrate',
    description: 'Generate and optionally run a SQL migration. Writes timestamped .sql file to ./migrations/ or ./supabase/migrations/. Supports --dry-run.',
    parameters: {
      sql: { type: 'string', description: 'Migration SQL statements (ALTER TABLE, CREATE TABLE, etc.)', required: true },
      name: { type: 'string', description: 'Migration name (e.g., "add_users_table")', required: true },
      connection_string: { type: 'string', description: 'Database connection string. If omitted, reads from DATABASE_URL env.' },
      dry_run: { type: 'boolean', description: 'If true, only show the SQL without executing or writing (default: false)' },
      migrations_dir: { type: 'string', description: 'Custom migrations directory path (default: auto-detect ./supabase/migrations/ or ./migrations/)' },
    },
    tier: 'pro',
    timeout: 60_000,
    async execute(args) {
      try {
        const sql = String(args.sql)
        const name = String(args.name).replace(/[^a-zA-Z0-9_-]/g, '_')
        const dryRun = args.dry_run === true

        if (dryRun) {
          return `**Dry run** — migration \`${name}\`:\n\n\`\`\`sql\n${sql}\n\`\`\`\n\nNo changes made.`
        }

        // Determine migrations directory
        let migrationsDir: string
        if (args.migrations_dir) {
          migrationsDir = resolve(String(args.migrations_dir))
        } else if (existsSync(resolve(process.cwd(), 'supabase/migrations'))) {
          migrationsDir = resolve(process.cwd(), 'supabase/migrations')
        } else {
          migrationsDir = resolve(process.cwd(), 'migrations')
        }

        // Ensure directory exists
        mkdirSync(migrationsDir, { recursive: true })

        // Generate timestamped filename
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
        const filename = `${timestamp}_${name}.sql`
        const filepath = join(migrationsDir, filename)

        // Write migration file
        const header = `-- Migration: ${name}\n-- Generated by K:BOT at ${new Date().toISOString()}\n-- Run: apply with db_query or your migration tool\n\n`
        writeFileSync(filepath, header + sql + '\n', 'utf-8')

        // Optionally execute
        let execResult = ''
        if (args.connection_string || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.MYSQL_URL || process.env.SQLITE_PATH) {
          try {
            const conn = resolveConnection(args.connection_string ? String(args.connection_string) : undefined)
            execQuery(conn, sql, 60_000)
            execResult = '\n\nMigration **executed successfully** against the database.'
          } catch (execErr) {
            execResult = `\n\nMigration file saved but **execution failed**: ${execErr instanceof Error ? execErr.message : String(execErr)}`
          }
        }

        return `Migration file created: \`${filepath}\`\n\n\`\`\`sql\n${sql}\n\`\`\`${execResult}`
      } catch (err) {
        return `Migration error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── db_seed ──────────────────────────────────────────────────────
  registerTool({
    name: 'db_seed',
    description: 'Generate realistic seed data for a database table. Queries the schema, then generates INSERT statements with fake but plausible data.',
    parameters: {
      table: { type: 'string', description: 'Table name to seed', required: true },
      count: { type: 'number', description: 'Number of rows to generate (default: 10)' },
      connection_string: { type: 'string', description: 'Database connection string. If omitted, reads from DATABASE_URL env.' },
      execute: { type: 'boolean', description: 'If true, execute the INSERT statements against the database (default: false — just returns SQL)' },
    },
    tier: 'pro',
    async execute(args) {
      try {
        const tableName = String(args.table)
        const count = typeof args.count === 'number' ? Math.min(args.count, 1000) : 10
        const conn = resolveConnection(args.connection_string ? String(args.connection_string) : undefined)

        // Get schema for this table
        const columns = getSchema(conn, tableName)
        if (columns.length === 0) {
          return `Table \`${tableName}\` not found or has no columns.`
        }

        // Filter out auto-generated columns (serial/autoincrement PKs with defaults)
        const seedColumns = columns.filter(c => {
          // Skip serial / auto-increment columns
          if (c.is_pk && (c.default_val.includes('nextval') || c.type.toLowerCase().includes('serial') || c.type.toLowerCase().includes('autoincrement'))) {
            return false
          }
          // Skip columns with generated defaults that should be left alone
          if (c.default_val.includes('gen_random_uuid') || c.default_val.includes('now()') || c.default_val.includes('CURRENT_TIMESTAMP')) {
            return false
          }
          return true
        })

        if (seedColumns.length === 0) {
          return `All columns in \`${tableName}\` appear to be auto-generated. No seed data needed.`
        }

        const colNames = seedColumns.map(c => c.column)
        const inserts: string[] = []

        for (let i = 0; i < count; i++) {
          const values = seedColumns.map(c => fakeValue(c.column, c.type, i))
          inserts.push(`INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${values.join(', ')});`)
        }

        const fullSql = inserts.join('\n')

        // Optionally execute
        if (args.execute === true) {
          try {
            execQuery(conn, fullSql, 60_000)
            return `**Seeded ${count} rows** into \`${tableName}\`.\n\n\`\`\`sql\n${fullSql}\n\`\`\``
          } catch (execErr) {
            return `Seed SQL generated but **execution failed**: ${execErr instanceof Error ? execErr.message : String(execErr)}\n\n\`\`\`sql\n${fullSql}\n\`\`\``
          }
        }

        return `**${count} INSERT statements** for \`${tableName}\` (${colNames.length} columns):\n\n\`\`\`sql\n${fullSql}\n\`\`\`\n\nSet \`execute: true\` to run these against the database.`
      } catch (err) {
        return `Seed generation error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── prisma_introspect ────────────────────────────────────────────
  registerTool({
    name: 'prisma_introspect',
    description: 'Run Prisma introspect (db pull) on an existing database to generate schema.prisma from the live schema.',
    parameters: {
      path: { type: 'string', description: 'Project directory containing package.json (default: cwd)', },
      connection_string: { type: 'string', description: 'Database URL to introspect. If omitted, uses DATABASE_URL from .env or env.' },
    },
    tier: 'pro',
    timeout: 60_000,
    async execute(args) {
      try {
        const cwd = args.path ? resolve(String(args.path)) : process.cwd()

        // Check if Prisma is available
        const hasPrisma = checkPrisma(cwd)
        if (!hasPrisma) {
          return 'Prisma not found in this project. Install it with:\n\n```\nnpm install prisma @prisma/client --save-dev\nnpx prisma init\n```'
        }

        const env = { ...process.env as Record<string, string> }
        if (args.connection_string) {
          env.DATABASE_URL = String(args.connection_string)
        }

        const result = shell('npx prisma db pull', { cwd, env, timeout: 60_000 })
        return `**Prisma introspect** completed:\n\n${result}\n\nSchema written to \`prisma/schema.prisma\`.`
      } catch (err) {
        return `Prisma introspect error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── prisma_generate ──────────────────────────────────────────────
  registerTool({
    name: 'prisma_generate',
    description: 'Generate Prisma client from schema.prisma. Creates typed database client in node_modules/@prisma/client.',
    parameters: {
      path: { type: 'string', description: 'Project directory containing package.json (default: cwd)' },
    },
    tier: 'pro',
    timeout: 60_000,
    async execute(args) {
      try {
        const cwd = args.path ? resolve(String(args.path)) : process.cwd()

        const hasPrisma = checkPrisma(cwd)
        if (!hasPrisma) {
          return 'Prisma not found in this project. Install it with:\n\n```\nnpm install prisma @prisma/client --save-dev\nnpx prisma init\n```'
        }

        // Check if schema.prisma exists
        const schemaPath = join(cwd, 'prisma', 'schema.prisma')
        if (!existsSync(schemaPath)) {
          return `No \`prisma/schema.prisma\` found in ${cwd}. Run \`prisma_introspect\` first or create a schema with \`npx prisma init\`.`
        }

        const result = shell('npx prisma generate', { cwd, timeout: 60_000 })
        return `**Prisma generate** completed:\n\n${result}\n\nClient available at \`@prisma/client\`.`
      } catch (err) {
        return `Prisma generate error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── prisma_migrate ───────────────────────────────────────────────
  registerTool({
    name: 'prisma_migrate',
    description: 'Run Prisma migration (prisma migrate dev). Creates a migration from schema changes and applies it to the database.',
    parameters: {
      name: { type: 'string', description: 'Migration name (e.g., "add_posts_table")', required: true },
      path: { type: 'string', description: 'Project directory containing package.json (default: cwd)' },
      connection_string: { type: 'string', description: 'Database URL. If omitted, uses DATABASE_URL from .env or env.' },
      create_only: { type: 'boolean', description: 'If true, create migration files without applying (default: false)' },
    },
    tier: 'pro',
    timeout: 120_000,
    async execute(args) {
      try {
        const cwd = args.path ? resolve(String(args.path)) : process.cwd()
        const migrationName = String(args.name).replace(/[^a-zA-Z0-9_-]/g, '_')

        const hasPrisma = checkPrisma(cwd)
        if (!hasPrisma) {
          return 'Prisma not found in this project. Install it with:\n\n```\nnpm install prisma @prisma/client --save-dev\nnpx prisma init\n```'
        }

        const schemaPath = join(cwd, 'prisma', 'schema.prisma')
        if (!existsSync(schemaPath)) {
          return `No \`prisma/schema.prisma\` found in ${cwd}. Create a schema first.`
        }

        const env = { ...process.env as Record<string, string> }
        if (args.connection_string) {
          env.DATABASE_URL = String(args.connection_string)
        }

        const createOnly = args.create_only === true ? ' --create-only' : ''
        const result = shell(`npx prisma migrate dev --name ${migrationName}${createOnly}`, { cwd, env, timeout: 120_000 })
        return `**Prisma migrate** completed:\n\n${result}`
      } catch (err) {
        return `Prisma migrate error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── db_diagram ───────────────────────────────────────────────────
  registerTool({
    name: 'db_diagram',
    description: 'Generate an ER diagram in Mermaid format from database schema. Outputs entities, attributes, types, and relationships.',
    parameters: {
      connection_string: { type: 'string', description: 'Database connection string. If omitted, reads from DATABASE_URL env.' },
      table: { type: 'string', description: 'Specific table to include (default: all tables)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      try {
        const conn = resolveConnection(args.connection_string ? String(args.connection_string) : undefined)
        const tableFilter = args.table ? String(args.table) : undefined
        const columns = getSchema(conn, tableFilter)
        const mermaid = generateMermaidDiagram(columns)

        const tableCount = new Set(columns.map(c => c.table)).size
        const relCount = columns.filter(c => c.fk_ref).length

        return `**ER Diagram** — ${tableCount} tables, ${columns.length} columns, ${relCount} relationships\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``
      } catch (err) {
        return `ER diagram error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}

// ── Prisma helper ────────────────────────────────────────────────────

/** Check if Prisma is available in the project */
function checkPrisma(cwd: string): boolean {
  try {
    const pkgPath = join(cwd, 'package.json')
    if (!existsSync(pkgPath)) return false
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    }
    return 'prisma' in allDeps || '@prisma/client' in allDeps
  } catch {
    return false
  }
}
