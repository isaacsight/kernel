// kbot Cross-Device Sync — Same kbot, same memory, same learning, everywhere.
//
// Syncs all learning data (patterns, solutions, profile, routing, memory, forge)
// across devices. Creates compressed snapshots, uploads/downloads via sync endpoint.
//
// Device identity: SHA-256 of hostname + username (not reversible).
// Merge strategy: prefer newer timestamps, higher confidence.
//
// Uses only Node built-ins + fetch. No external dependencies.
import { homedir, hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
const KBOT_DIR = join(homedir(), '.kbot');
const MEMORY_DIR = join(KBOT_DIR, 'memory');
const FORGE_DIR = join(KBOT_DIR, 'forge');
const SYNC_DIR = join(KBOT_DIR, 'sync');
const SYNC_STATE_FILE = join(SYNC_DIR, 'cross-device-state.json');
const SYNC_URL = process.env.KBOT_SYNC_URL || 'https://kernel.chat/api/sync';
// ── Helpers ──
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
function loadJSON(path, fallback) {
    try {
        if (existsSync(path)) {
            return JSON.parse(readFileSync(path, 'utf-8'));
        }
    }
    catch {
        // Corrupt file — return fallback
    }
    return fallback;
}
function saveJSON(path, data) {
    const dir = join(path, '..');
    ensureDir(dir);
    writeFileSync(path, JSON.stringify(data, null, 2));
}
function loadSyncState() {
    return loadJSON(SYNC_STATE_FILE, {
        lastPush: null,
        lastPull: null,
        cloudPatternCount: 0,
        localSnapshotHash: null,
        cloudSnapshotHash: null,
    });
}
function saveSyncState(state) {
    ensureDir(SYNC_DIR);
    writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}
// ── Device Fingerprint ──
/** SHA-256 of hostname + username — deterministic, non-reversible identity */
function getDeviceFingerprint() {
    const raw = `${hostname()}:${userInfo().username}`;
    return createHash('sha256').update(raw).digest('hex');
}
// ── Data Collection ──
/** Read all learning data from ~/.kbot/ into a unified structure */
function collectAllData() {
    ensureDir(MEMORY_DIR);
    ensureDir(FORGE_DIR);
    // Patterns, solutions, routing — JSON arrays
    const patterns = loadJSON(join(MEMORY_DIR, 'patterns.json'), []);
    const solutions = loadJSON(join(MEMORY_DIR, 'solutions.json'), []);
    const routing = loadJSON(join(MEMORY_DIR, 'routing.json'), []);
    // Profile — JSON object
    const profile = loadJSON(join(MEMORY_DIR, 'profile.json'), {});
    // Memory — markdown text
    let memory = '';
    const contextPath = join(MEMORY_DIR, 'context.md');
    try {
        if (existsSync(contextPath)) {
            memory = readFileSync(contextPath, 'utf-8');
        }
    }
    catch {
        // Not critical
    }
    // Forge tools — read all JSON files from forge directory
    const forge = [];
    try {
        const files = readdirSync(FORGE_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const tool = JSON.parse(readFileSync(join(FORGE_DIR, file), 'utf-8'));
                forge.push(tool);
            }
            catch {
                // Skip corrupt tool files
            }
        }
    }
    catch {
        // Forge dir might not exist yet
    }
    return { patterns, solutions, profile, routing, memory, forge };
}
/** Build per-entry metadata for merge decisions */
function buildMetadata(data) {
    const meta = {};
    const now = new Date().toISOString();
    // Pattern metadata — use each pattern's own timestamps if available
    for (let i = 0; i < data.patterns.length; i++) {
        const p = data.patterns[i];
        meta[`patterns:${i}`] = {
            updatedAt: (typeof p.updatedAt === 'string' ? p.updatedAt : now),
            confidence: typeof p.successRate === 'number' ? p.successRate : undefined,
        };
    }
    // Solution metadata
    for (let i = 0; i < data.solutions.length; i++) {
        const s = data.solutions[i];
        meta[`solutions:${i}`] = {
            updatedAt: (typeof s.updatedAt === 'string' ? s.updatedAt : now),
            confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
        };
    }
    // Routing metadata
    for (let i = 0; i < data.routing.length; i++) {
        const r = data.routing[i];
        meta[`routing:${i}`] = {
            updatedAt: (typeof r.updatedAt === 'string' ? r.updatedAt : now),
            confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
        };
    }
    // Profile — single entry
    meta['profile'] = { updatedAt: now };
    // Memory — single entry
    meta['memory'] = { updatedAt: now };
    // Forge tools
    for (let i = 0; i < data.forge.length; i++) {
        const f = data.forge[i];
        meta[`forge:${i}`] = {
            updatedAt: (typeof f.created === 'string' ? f.created : now),
        };
    }
    return meta;
}
/** Hash a snapshot's data for change detection */
function hashSnapshot(data) {
    const content = JSON.stringify(data);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
// ── Auth Token Resolution ──
/** Resolve auth token from options, env, or config file */
function resolveToken(options) {
    if (options?.token)
        return options.token;
    if (process.env.KBOT_CLOUD_TOKEN)
        return process.env.KBOT_CLOUD_TOKEN;
    // Try loading from config
    try {
        const configPath = join(KBOT_DIR, 'config.json');
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.kernel_token)
                return config.kernel_token;
        }
    }
    catch {
        // Config might be encrypted or corrupt
    }
    return null;
}
// ── Core API ──
/** Collect all learning data, compress, and upload to sync endpoint.
 *  Returns upload stats. */
export async function runCrossDeviceSync(options) {
    const syncUrl = options?.url || SYNC_URL;
    const token = resolveToken(options);
    const data = collectAllData();
    const currentHash = hashSnapshot(data);
    const state = loadSyncState();
    // Skip if nothing changed (unless forced)
    if (!options?.force && state.localSnapshotHash === currentHash) {
        return {
            uploaded_bytes: 0,
            patterns_synced: 0,
            last_sync: state.lastPush || 'never',
        };
    }
    const snapshot = {
        device_fingerprint: getDeviceFingerprint(),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data,
        metadata: buildMetadata(data),
    };
    // Compress with gzip
    const jsonBytes = Buffer.from(JSON.stringify(snapshot), 'utf-8');
    const compressed = gzipSync(jsonBytes);
    const headers = {
        'Content-Type': 'application/octet-stream',
        'X-Device-Fingerprint': snapshot.device_fingerprint,
        'X-Snapshot-Version': snapshot.version,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    try {
        const res = await fetch(`${syncUrl}/push`, {
            method: 'POST',
            headers,
            body: compressed,
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            if (process.env.KBOT_DEBUG) {
                console.error(`[cross-device-sync] push failed: ${res.status}`);
            }
            return {
                uploaded_bytes: 0,
                patterns_synced: 0,
                last_sync: state.lastPush || 'never',
            };
        }
        const now = new Date().toISOString();
        state.lastPush = now;
        state.localSnapshotHash = currentHash;
        saveSyncState(state);
        return {
            uploaded_bytes: compressed.byteLength,
            patterns_synced: data.patterns.length,
            last_sync: now,
        };
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            console.error('[cross-device-sync] push error:', err.message);
        }
        return {
            uploaded_bytes: 0,
            patterns_synced: 0,
            last_sync: state.lastPush || 'never',
        };
    }
}
/** Download latest snapshot from cloud and merge with local data.
 *  Merge strategy: prefer newer timestamps, higher confidence.
 *  Returns download stats. */
export async function pullFromCloud(options) {
    const syncUrl = options?.url || SYNC_URL;
    const token = resolveToken(options);
    const fingerprint = getDeviceFingerprint();
    const headers = {
        'X-Device-Fingerprint': fingerprint,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    try {
        const res = await fetch(`${syncUrl}/pull`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            if (process.env.KBOT_DEBUG) {
                console.error(`[cross-device-sync] pull failed: ${res.status}`);
            }
            return { downloaded_bytes: 0, new_patterns: 0, conflicts_resolved: 0 };
        }
        const compressedBuffer = Buffer.from(await res.arrayBuffer());
        const downloadedBytes = compressedBuffer.byteLength;
        // Decompress
        const jsonBuffer = gunzipSync(compressedBuffer);
        const remote = JSON.parse(jsonBuffer.toString('utf-8'));
        if (!remote.data) {
            return { downloaded_bytes: downloadedBytes, new_patterns: 0, conflicts_resolved: 0 };
        }
        // Merge with local data
        const local = collectAllData();
        const mergeResult = mergeSnapshots(local, remote);
        // Write merged data back to local files
        writeLocalData(mergeResult.merged);
        // Update sync state
        const state = loadSyncState();
        state.lastPull = new Date().toISOString();
        state.cloudSnapshotHash = hashSnapshot(remote.data);
        state.cloudPatternCount = remote.data.patterns.length;
        saveSyncState(state);
        return {
            downloaded_bytes: downloadedBytes,
            new_patterns: mergeResult.newPatterns,
            conflicts_resolved: mergeResult.conflictsResolved,
        };
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            console.error('[cross-device-sync] pull error:', err.message);
        }
        return { downloaded_bytes: 0, new_patterns: 0, conflicts_resolved: 0 };
    }
}
/** Get current sync status across local and cloud. */
export async function getSyncStatus(options) {
    const state = loadSyncState();
    const localData = collectAllData();
    const localPatternCount = localData.patterns.length;
    const currentHash = hashSnapshot(localData);
    const inSync = state.localSnapshotHash === currentHash
        && state.cloudSnapshotHash !== null
        && state.localSnapshotHash === state.cloudSnapshotHash;
    return {
        last_push: state.lastPush,
        last_pull: state.lastPull,
        local_patterns: localPatternCount,
        cloud_patterns: state.cloudPatternCount,
        in_sync: inSync,
    };
}
/** Merge remote snapshot data into local data.
 *  Strategy: deduplicate by stable key, prefer newer timestamps, higher confidence. */
function mergeSnapshots(local, remote) {
    let newPatterns = 0;
    let conflictsResolved = 0;
    // Merge arrays with dedup and conflict resolution
    const mergedPatterns = mergeArrays(local.patterns, remote.data.patterns, remote.metadata, 'patterns', patternKey);
    newPatterns += mergedPatterns.added;
    conflictsResolved += mergedPatterns.conflicts;
    const mergedSolutions = mergeArrays(local.solutions, remote.data.solutions, remote.metadata, 'solutions', solutionKey);
    newPatterns += mergedSolutions.added;
    conflictsResolved += mergedSolutions.conflicts;
    const mergedRouting = mergeArrays(local.routing, remote.data.routing, remote.metadata, 'routing', routingKey);
    conflictsResolved += mergedRouting.conflicts;
    // Merge profile: deep-merge, prefer newer values
    const mergedProfile = mergeProfile(local.profile, remote.data.profile);
    // Merge memory: append unique sections from remote
    const mergedMemory = mergeMemory(local.memory, remote.data.memory);
    // Merge forge tools: deduplicate by name, prefer newer version
    const mergedForge = mergeForgeTools(local.forge, remote.data.forge);
    newPatterns += mergedForge.added;
    return {
        merged: {
            patterns: mergedPatterns.result,
            solutions: mergedSolutions.result,
            profile: mergedProfile,
            routing: mergedRouting.result,
            memory: mergedMemory,
            forge: mergedForge.result,
        },
        newPatterns,
        conflictsResolved,
    };
}
/** Merge two arrays with dedup, using a key function for identity. */
function mergeArrays(localArr, remoteArr, remoteMeta, prefix, keyFn) {
    const localMap = new Map();
    for (const item of localArr) {
        localMap.set(keyFn(item), item);
    }
    let added = 0;
    let conflicts = 0;
    for (let i = 0; i < remoteArr.length; i++) {
        const remoteItem = remoteArr[i];
        const key = keyFn(remoteItem);
        const localItem = localMap.get(key);
        if (!localItem) {
            // New entry from remote
            localMap.set(key, remoteItem);
            added++;
        }
        else {
            // Conflict — resolve by timestamp then confidence
            const meta = remoteMeta[`${prefix}:${i}`];
            if (meta && shouldPreferRemote(localItem, remoteItem, meta)) {
                localMap.set(key, remoteItem);
                conflicts++;
            }
        }
    }
    return { result: Array.from(localMap.values()), added, conflicts };
}
/** Decide whether remote entry should replace local entry */
function shouldPreferRemote(local, _remote, remoteMeta) {
    const localRecord = local;
    const localTime = typeof localRecord.updatedAt === 'string'
        ? new Date(localRecord.updatedAt).getTime()
        : 0;
    const remoteTime = new Date(remoteMeta.updatedAt).getTime();
    // Prefer newer timestamp
    if (remoteTime > localTime)
        return true;
    if (remoteTime < localTime)
        return false;
    // Same timestamp — prefer higher confidence
    const localConf = typeof localRecord.confidence === 'number' ? localRecord.confidence : 0;
    const localSuccess = typeof localRecord.successRate === 'number' ? localRecord.successRate : 0;
    const remoteConf = remoteMeta.confidence ?? 0;
    return remoteConf > Math.max(localConf, localSuccess);
}
/** Merge two profiles by preferring non-empty, newer values */
function mergeProfile(local, remote) {
    const merged = { ...local };
    for (const [key, value] of Object.entries(remote)) {
        if (value === null || value === undefined)
            continue;
        if (!(key in merged) || merged[key] === null || merged[key] === undefined) {
            // Local is empty — take remote
            merged[key] = value;
        }
        // If both have values, keep local (local-first philosophy)
    }
    return merged;
}
/** Merge memory markdown: append unique date-sections from remote */
function mergeMemory(local, remote) {
    if (!remote.trim())
        return local;
    if (!local.trim())
        return remote;
    // Extract date sections (## YYYY-MM-DD)
    const localSections = new Set();
    const dateRegex = /^## (\d{4}-\d{2}-\d{2})$/gm;
    let match;
    match = dateRegex.exec(local);
    while (match !== null) {
        localSections.add(match[1]);
        match = dateRegex.exec(local);
    }
    // Find remote sections not in local
    const remoteLines = remote.split('\n');
    const newSections = [];
    let inNewSection = false;
    let currentSection = [];
    for (const line of remoteLines) {
        const dateMatch = /^## (\d{4}-\d{2}-\d{2})$/.exec(line);
        if (dateMatch) {
            // Flush previous section if it was new
            if (inNewSection && currentSection.length > 0) {
                newSections.push(currentSection.join('\n'));
            }
            inNewSection = !localSections.has(dateMatch[1]);
            currentSection = inNewSection ? [line] : [];
        }
        else if (inNewSection) {
            currentSection.push(line);
        }
    }
    // Flush last section
    if (inNewSection && currentSection.length > 0) {
        newSections.push(currentSection.join('\n'));
    }
    if (newSections.length === 0)
        return local;
    return local.trimEnd() + '\n' + newSections.join('\n');
}
/** Merge forge tool lists: deduplicate by name, prefer newer version */
function mergeForgeTools(local, remote) {
    const localMap = new Map();
    for (const tool of local) {
        const t = tool;
        if (typeof t.name === 'string') {
            localMap.set(t.name, tool);
        }
    }
    let added = 0;
    for (const tool of remote) {
        const t = tool;
        if (typeof t.name !== 'string')
            continue;
        const existing = localMap.get(t.name);
        if (!existing) {
            localMap.set(t.name, tool);
            added++;
        }
        else {
            // Prefer newer version or newer creation date
            const localVersion = typeof existing.version === 'string' ? existing.version : '0.0.0';
            const remoteVersion = typeof t.version === 'string' ? t.version : '0.0.0';
            if (remoteVersion > localVersion) {
                localMap.set(t.name, tool);
            }
        }
    }
    return { result: Array.from(localMap.values()), added };
}
// ── Key Functions for Dedup ──
function patternKey(item) {
    const p = item;
    const intent = typeof p.intent === 'string' ? p.intent : '';
    const tools = Array.isArray(p.toolSequence) ? p.toolSequence.sort().join(',') : '';
    const keywords = Array.isArray(p.keywords) ? p.keywords.sort().join(',') : '';
    return `pattern:${intent}:${tools}:${keywords}`;
}
function solutionKey(item) {
    const s = item;
    const problem = typeof s.problem === 'string' ? s.problem : '';
    const approach = typeof s.approach === 'string' ? s.approach : '';
    return `solution:${problem}:${approach}`;
}
function routingKey(item) {
    const r = item;
    const pattern = typeof r.pattern === 'string' ? r.pattern : '';
    const agent = typeof r.agent === 'string' ? r.agent : '';
    return `routing:${pattern}:${agent}`;
}
// ── Write Back ──
/** Write merged data back to local ~/.kbot/ files */
function writeLocalData(data) {
    ensureDir(MEMORY_DIR);
    ensureDir(FORGE_DIR);
    // Write JSON data files
    if (data.patterns.length > 0) {
        saveJSON(join(MEMORY_DIR, 'patterns.json'), data.patterns);
    }
    if (data.solutions.length > 0) {
        saveJSON(join(MEMORY_DIR, 'solutions.json'), data.solutions);
    }
    if (Object.keys(data.profile).length > 0) {
        saveJSON(join(MEMORY_DIR, 'profile.json'), data.profile);
    }
    if (data.routing.length > 0) {
        saveJSON(join(MEMORY_DIR, 'routing.json'), data.routing);
    }
    // Write memory markdown
    if (data.memory.trim()) {
        writeFileSync(join(MEMORY_DIR, 'context.md'), data.memory);
    }
    // Write forge tools — one file per tool
    for (const tool of data.forge) {
        const t = tool;
        if (typeof t.name === 'string') {
            writeFileSync(join(FORGE_DIR, `${t.name}.json`), JSON.stringify(tool, null, 2));
        }
    }
}
//# sourceMappingURL=cross-device-sync.js.map