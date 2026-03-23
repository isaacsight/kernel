// kbot Cloud Sync — Persist learning data across machines via kbot-engine
//
// Syncs patterns, solutions, profile, and knowledge to the cloud.
// Pull on startup (if cloud has newer data), push after learning.
// Requires a kernel.chat account token in config.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig, saveConfig } from './auth.js';
const KBOT_DIR = join(homedir(), '.kbot');
const LEARN_DIR = join(KBOT_DIR, 'memory');
const SYNC_STATE_FILE = join(LEARN_DIR, 'sync-state.json');
const ENGINE_URL = 'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kbot-engine';
function loadSyncState() {
    try {
        if (existsSync(SYNC_STATE_FILE)) {
            return JSON.parse(readFileSync(SYNC_STATE_FILE, 'utf-8'));
        }
    }
    catch (err) {
        if (process.env.KBOT_DEBUG)
            console.error('[cloud-sync] load state failed:', err.message);
    }
    return { lastPush: '', lastPull: '', cloudUpdatedAt: '' };
}
function saveSyncState(state) {
    try {
        writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
    }
    catch (err) {
        if (process.env.KBOT_DEBUG)
            console.error('[cloud-sync] save state failed:', err.message);
    }
}
/** Get the kernel.chat token from config */
export function getCloudToken() {
    const config = loadConfig();
    return config?.kernel_token || null;
}
/** Set the kernel.chat token */
export function setCloudToken(token) {
    const config = loadConfig() || { default_model: 'auto', default_agent: 'auto' };
    config.kernel_token = token;
    saveConfig(config);
}
/** Check if cloud sync is configured */
export function isCloudSyncEnabled() {
    return !!getCloudToken();
}
/** Load local learning data files */
function loadLocalData() {
    const load = (file) => {
        const path = join(LEARN_DIR, file);
        try {
            if (existsSync(path))
                return JSON.parse(readFileSync(path, 'utf-8'));
        }
        catch (err) {
            if (process.env.KBOT_DEBUG)
                console.error(`[cloud-sync] load ${file} failed:`, err.message);
        }
        return file.endsWith('.json') ? (file.includes('patterns') || file.includes('solutions') || file.includes('knowledge') ? [] : {}) : {};
    };
    return {
        patterns: load('patterns.json'),
        solutions: load('solutions.json'),
        profile: load('profile.json'),
        knowledge: load('knowledge.json'),
    };
}
/** Save cloud data to local files */
function saveCloudDataLocally(data) {
    const save = (file, content) => {
        if (content && (Array.isArray(content) ? content.length > 0 : Object.keys(content).length > 0)) {
            writeFileSync(join(LEARN_DIR, file), JSON.stringify(content, null, 2));
        }
    };
    if (data.patterns)
        save('patterns.json', data.patterns);
    if (data.solutions)
        save('solutions.json', data.solutions);
    if (data.profile)
        save('profile.json', data.profile);
    if (data.knowledge)
        save('knowledge.json', data.knowledge);
}
/** Pull learning data from cloud (if newer than local) */
export async function pullFromCloud() {
    const token = getCloudToken();
    if (!token)
        return { synced: false, source: 'none' };
    try {
        const res = await fetch(`${ENGINE_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ action: 'get' }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok)
            return { synced: false, source: 'none' };
        const { memory } = await res.json();
        if (!memory)
            return { synced: false, source: 'none' };
        const state = loadSyncState();
        const cloudTime = new Date(memory.updated_at || 0).getTime();
        const lastPull = state.lastPull ? new Date(state.lastPull).getTime() : 0;
        // Only overwrite local if cloud is newer than our last pull
        if (cloudTime > lastPull) {
            saveCloudDataLocally(memory);
            state.lastPull = new Date().toISOString();
            state.cloudUpdatedAt = memory.updated_at;
            saveSyncState(state);
            return { synced: true, source: 'cloud' };
        }
        return { synced: false, source: 'local' };
    }
    catch (err) {
        if (process.env.KBOT_DEBUG)
            console.error('[cloud-sync] pull failed:', err.message);
        return { synced: false, source: 'none' };
    }
}
/** Push local learning data to cloud */
export async function pushToCloud() {
    const token = getCloudToken();
    if (!token)
        return false;
    try {
        const data = loadLocalData();
        const res = await fetch(`${ENGINE_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                action: 'push',
                ...data,
            }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok)
            return false;
        const state = loadSyncState();
        state.lastPush = new Date().toISOString();
        saveSyncState(state);
        return true;
    }
    catch {
        return false;
    }
}
/** Sync on startup: pull if cloud has newer data */
export async function syncOnStartup() {
    if (!isCloudSyncEnabled())
        return null;
    try {
        const result = await pullFromCloud();
        if (result.synced && result.source === 'cloud') {
            return 'Synced learning data from cloud';
        }
        return null;
    }
    catch {
        return null;
    }
}
/** Sync after learning: push local data to cloud (debounced — call after interactions) */
let pushTimer = null;
const PUSH_DEBOUNCE_MS = 30_000; // Push at most every 30 seconds
export function schedulePush() {
    if (!isCloudSyncEnabled())
        return;
    if (pushTimer)
        return; // Already scheduled
    pushTimer = setTimeout(() => {
        pushTimer = null;
        pushToCloud().catch(() => { }); // Fire and forget
    }, PUSH_DEBOUNCE_MS);
}
/** Force an immediate push (call on exit) */
export function flushCloudSync() {
    if (pushTimer) {
        clearTimeout(pushTimer);
        pushTimer = null;
    }
    if (isCloudSyncEnabled()) {
        // Synchronous-ish push — best effort on exit
        pushToCloud().catch(() => { });
    }
}
//# sourceMappingURL=cloud-sync.js.map