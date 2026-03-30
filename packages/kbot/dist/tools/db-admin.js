// kbot DB Admin — Database management from the terminal
//
// Commands:
//   db_backup     — Dump database to file
//   db_tables     — List all tables with row counts
//   db_inspect    — Inspect table schema and sample data
//   db_sql        — Run raw SQL query
//   db_migrations — List and run migrations
//   db_health     — Database health check (size, connections, slow queries)
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { registerTool } from './index.js';
// ── Helpers ──────────────────────────────────────────────────────────
const PROJECT_REF = 'eoxxpyixdieprsxlpwcs';
function shell(cmd, timeout = 60_000) {
    try {
        const output = execSync(cmd, {
            encoding: 'utf-8', timeout,
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return { ok: true, output };
    }
    catch (e) {
        const err = e;
        return { ok: false, output: err.stderr || err.stdout || err.message || 'unknown error' };
    }
}
function supabaseQuery(table, query) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return execSync(`curl -sS "${url}/rest/v1/${table}?${query}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -H "Prefer: count=exact"`, {
        encoding: 'utf-8', timeout: 30_000,
    }).trim();
}
function supabaseRpc(fnName, body = {}) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return execSync(`curl -sS -X POST "${url}/rest/v1/rpc/${fnName}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(body)}'`, {
        encoding: 'utf-8', timeout: 30_000,
    }).trim();
}
function findProjectRoot() {
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (existsSync(join(dir, 'supabase')))
            return dir;
        dir = join(dir, '..');
    }
    return process.cwd();
}
// ── Tools ────────────────────────────────────────────────────────────
export function registerDbAdminTools() {
    let count = 0;
    registerTool({
        name: 'db_backup',
        description: 'Create a database dump (schema + data) and save to a local file.',
        parameters: {
            output: { type: 'string', description: 'Output file path (default: ./backups/db-YYYY-MM-DD.sql)' },
            schema_only: { type: 'string', description: 'If "true", dump schema only (no data)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const date = new Date().toISOString().slice(0, 10);
            const backupDir = join(root, 'backups');
            if (!existsSync(backupDir))
                mkdirSync(backupDir, { recursive: true });
            const outputPath = String(args.output || join(backupDir, `db-${date}.sql`));
            const schemaFlag = String(args.schema_only) === 'true' ? '--schema-only' : '';
            // Use supabase db dump
            const { ok, output } = shell(`npx supabase db dump ${schemaFlag} --project-ref ${PROJECT_REF} -f "${outputPath}"`, 180_000);
            if (!ok) {
                // Fallback: try pg_dump via DATABASE_URL
                const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
                if (dbUrl) {
                    const { ok: pgOk, output: pgOut } = shell(`pg_dump "${dbUrl}" ${schemaFlag ? '--schema-only' : ''} > "${outputPath}"`, 180_000);
                    if (pgOk)
                        return `✓ Backup saved to ${outputPath} (via pg_dump)`;
                    return `Error: both supabase db dump and pg_dump failed.\n\nSupabase: ${output}\npg_dump: ${pgOut}`;
                }
                return `Error: ${output}\n\nTip: Set DATABASE_URL or SUPABASE_DB_URL for pg_dump fallback.`;
            }
            return `✓ Backup saved to ${outputPath}`;
        },
    });
    count++;
    registerTool({
        name: 'db_tables',
        description: 'List all database tables with row counts and size estimates.',
        parameters: {},
        tier: 'pro',
        execute: async () => {
            // Query via Supabase REST - list known tables
            const knownTables = [
                'users', 'subscriptions', 'user_memory', 'conversations', 'messages',
                'audit_log', 'message_states', 'moderation_queue', 'usage_costs',
                'notifications', 'shared_conversations', 'feedback', 'tasks',
            ];
            const results = [];
            for (const table of knownTables) {
                try {
                    const raw = supabaseQuery(table, 'select=id&limit=0');
                    // If we get an array back, table exists
                    const parsed = JSON.parse(raw);
                    // Try to get count
                    const countRaw = supabaseQuery(table, 'select=count&limit=1');
                    let rowCount = 'exists';
                    try {
                        const rows = JSON.parse(countRaw);
                        rowCount = Array.isArray(rows) ? String(rows.length) : 'exists';
                    }
                    catch { /* */ }
                    results.push({ table, rows: rowCount, status: '✓' });
                }
                catch {
                    results.push({ table, rows: '-', status: '✗ not found' });
                }
            }
            // Also check via information_schema RPC if available
            try {
                const raw = supabaseRpc('get_table_sizes');
                const sizes = JSON.parse(raw);
                return `── Database Tables ──\n\n` +
                    `  ${'TABLE'.padEnd(30)} ${'ROWS'.padStart(8)} ${'SIZE'.padStart(10)}\n` +
                    `  ${'─'.repeat(50)}\n` +
                    sizes.map(s => `  ${s.table_name.padEnd(30)} ${String(Math.round(s.row_estimate)).padStart(8)} ${s.total_size.padStart(10)}`).join('\n');
            }
            catch {
                // Fallback: use the REST API probing results
                return `── Database Tables ──\n\n` +
                    `  ${'TABLE'.padEnd(30)} ${'STATUS'.padEnd(15)} ROWS\n` +
                    `  ${'─'.repeat(50)}\n` +
                    results.map(r => `  ${r.table.padEnd(30)} ${r.status.padEnd(15)} ${r.rows}`).join('\n') +
                    `\n\n  Tip: Create get_table_sizes() RPC for accurate counts.`;
            }
        },
    });
    count++;
    registerTool({
        name: 'db_inspect',
        description: 'Inspect a table: show columns, types, constraints, and sample rows.',
        parameters: {
            table: { type: 'string', description: 'Table name', required: true },
            sample: { type: 'string', description: 'Number of sample rows (default: 5)', default: '5' },
        },
        tier: 'pro',
        execute: async (args) => {
            const table = String(args.table);
            const sampleSize = parseInt(String(args.sample || '5'));
            // Get sample data (which also reveals column structure)
            const raw = supabaseQuery(table, `select=*&limit=${sampleSize}&order=created_at.desc`);
            let rows;
            try {
                rows = JSON.parse(raw);
            }
            catch {
                return `Error accessing table "${table}": ${raw}`;
            }
            if (!rows.length)
                return `Table "${table}" exists but is empty.`;
            // Infer columns from first row
            const columns = Object.keys(rows[0]);
            const types = columns.map(col => {
                const val = rows[0][col];
                if (val === null)
                    return 'nullable';
                if (typeof val === 'number')
                    return Number.isInteger(val) ? 'integer' : 'numeric';
                if (typeof val === 'boolean')
                    return 'boolean';
                if (typeof val === 'string') {
                    if (/^\d{4}-\d{2}-\d{2}/.test(val))
                        return 'timestamp';
                    if (/^[0-9a-f]{8}-/.test(val))
                        return 'uuid';
                    return val.length > 100 ? 'text' : 'varchar';
                }
                if (typeof val === 'object')
                    return 'jsonb';
                return typeof val;
            });
            let output = `── Table: ${table} ──\n\n`;
            output += `  Columns (${columns.length}):\n`;
            for (let i = 0; i < columns.length; i++) {
                output += `    ${columns[i].padEnd(30)} ${types[i]}\n`;
            }
            output += `\n  Sample rows (${Math.min(sampleSize, rows.length)}):\n`;
            // Show compact version of each row
            for (const row of rows) {
                const compact = columns.map(col => {
                    const val = row[col];
                    if (val === null)
                        return 'null';
                    const str = String(val);
                    return str.length > 30 ? str.slice(0, 27) + '...' : str;
                });
                output += `    ${compact.join(' | ')}\n`;
            }
            return output;
        },
    });
    count++;
    registerTool({
        name: 'db_sql',
        description: 'Run a raw SQL query via Supabase RPC. Read-only queries recommended.',
        parameters: {
            query: { type: 'string', description: 'SQL query to execute', required: true },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const query = String(args.query);
            // Safety: warn on destructive queries
            const lower = query.toLowerCase().trim();
            if (lower.startsWith('drop') || lower.startsWith('truncate') || lower.startsWith('delete')) {
                return '⚠ Destructive query blocked. Use the Supabase dashboard for DROP/TRUNCATE/DELETE operations.';
            }
            try {
                const result = supabaseRpc('run_sql', { sql: query });
                const parsed = JSON.parse(result);
                if (Array.isArray(parsed) && parsed.length) {
                    const cols = Object.keys(parsed[0]);
                    const header = cols.map(c => c.padEnd(20)).join('  ');
                    const sep = cols.map(() => '─'.repeat(20)).join('──');
                    const body = parsed.slice(0, 50).map((row) => cols.map(c => String(row[c] ?? 'null').slice(0, 20).padEnd(20)).join('  ')).join('\n');
                    return `${header}\n${sep}\n${body}` +
                        (parsed.length > 50 ? `\n\n... ${parsed.length - 50} more rows` : '') +
                        `\n\n${parsed.length} row(s)`;
                }
                return `Query executed. Result:\n${JSON.stringify(parsed, null, 2).slice(0, 2000)}`;
            }
            catch (e) {
                // Fallback: the run_sql RPC may not exist
                return `Error: ${e.message}\n\nTip: Create a run_sql(sql text) function in Supabase, or use:\n  npx supabase db query --project-ref ${PROJECT_REF}`;
            }
        },
    });
    count++;
    registerTool({
        name: 'db_migrations',
        description: 'List database migrations and their status. Can also run pending migrations.',
        parameters: {
            action: { type: 'string', description: 'Action: "list", "run", "new"', default: 'list' },
            name: { type: 'string', description: 'Migration name (for "new" action)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const action = String(args.action || 'list');
            const migrationsDir = join(root, 'supabase', 'migrations');
            switch (action) {
                case 'list': {
                    if (!existsSync(migrationsDir))
                        return 'No migrations directory found at supabase/migrations/';
                    // List local migration files
                    const { ok, output } = shell(`ls -1 "${migrationsDir}" | sort`, 10_000);
                    if (!ok)
                        return `Error listing migrations: ${output}`;
                    const files = output.split('\n').filter(f => f.endsWith('.sql'));
                    // Check remote status
                    const { ok: remoteOk, output: remoteOut } = shell(`npx supabase migration list --project-ref ${PROJECT_REF}`, 30_000);
                    return [
                        `── Local Migrations (${files.length}) ──`,
                        files.map(f => `  ${f}`).join('\n'),
                        '',
                        remoteOk ? `── Remote Status ──\n${remoteOut}` : '── Remote ──\n  Could not fetch (run: npx supabase login)',
                    ].join('\n');
                }
                case 'run': {
                    const { ok, output } = shell(`npx supabase db push --project-ref ${PROJECT_REF}`, 120_000);
                    return ok
                        ? `✓ Migrations applied:\n${output}`
                        : `Error applying migrations: ${output}`;
                }
                case 'new': {
                    const name = String(args.name || 'unnamed');
                    const { ok, output } = shell(`npx supabase migration new "${name}"`, 10_000);
                    return ok
                        ? `✓ Created migration: ${output}\n\nEdit the file, then run: kbot db migrations --action run`
                        : `Error: ${output}`;
                }
                default:
                    return `Unknown action: ${action}. Options: list, run, new`;
            }
        },
    });
    count++;
    registerTool({
        name: 'db_health',
        description: 'Database health check: size, connection count, replication lag, slow queries.',
        parameters: {},
        tier: 'enterprise',
        execute: async () => {
            const sections = [];
            // Try to get DB stats via RPC
            try {
                const raw = supabaseRpc('get_db_health');
                const health = JSON.parse(raw);
                sections.push([
                    `── Database Health ──`,
                    `  Size:          ${health.db_size || 'unknown'}`,
                    `  Connections:   ${health.active_connections || 'unknown'} / ${health.max_connections || 'unknown'}`,
                    `  Cache hit:     ${health.cache_hit_ratio || 'unknown'}`,
                    `  Uptime:        ${health.uptime || 'unknown'}`,
                ].join('\n'));
            }
            catch {
                // Fallback: basic connectivity check
                const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
                const start = Date.now();
                try {
                    supabaseQuery('users', 'select=id&limit=1');
                    sections.push([
                        `── Database Health ──`,
                        `  Status:     ✓ Connected`,
                        `  Latency:    ${Date.now() - start}ms`,
                        `  Note:       Create get_db_health() RPC for detailed metrics`,
                    ].join('\n'));
                }
                catch {
                    sections.push(`── Database Health ──\n  Status: ✗ Connection failed`);
                }
            }
            // Check edge function health
            const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
            if (url) {
                const start = Date.now();
                try {
                    execSync(`curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "${url}/rest/v1/"`, {
                        encoding: 'utf-8', timeout: 10_000,
                    });
                    sections.push(`── REST API ──\n  Status: ✓ UP (${Date.now() - start}ms)`);
                }
                catch {
                    sections.push(`── REST API ──\n  Status: ✗ DOWN`);
                }
            }
            // Check recent errors
            try {
                const raw = supabaseQuery('audit_log', `select=id&status=eq.error&created_at=gte.${new Date(Date.now() - 3600_000).toISOString()}&limit=100`);
                const errors = JSON.parse(raw);
                sections.push(`── Errors (1h) ──\n  Count: ${errors.length}${errors.length > 10 ? ' ⚠ HIGH' : ''}`);
            }
            catch { /* */ }
            return sections.join('\n\n');
        },
    });
    count++;
    return count;
}
//# sourceMappingURL=db-admin.js.map