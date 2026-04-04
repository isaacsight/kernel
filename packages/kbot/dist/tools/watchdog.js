// kbot Watchdog Tools — Service monitoring and system health dashboard
//
// Monitors all kbot background services running via launchd on macOS:
//   - com.kernel.email-agent
//   - com.kernel.kbot-discovery
//   - com.kernel.kbot-serve
//   - com.kernel.discord-bot
//   - com.kernel.mlx-server
//   - com.kernel.kbot-collective-sync
//   - kbot-local MCP
//   - com.kernel.kbot-daemon (15-min cycle)
//
// Tools: service_status, service_restart, system_health
import { registerTool } from './index.js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// ── Known services ──
const SERVICE_MAP = {
    'email-agent': 'com.kernel.email-agent',
    'discovery': 'com.kernel.kbot-discovery',
    'serve': 'com.kernel.kbot-serve',
    'discord': 'com.kernel.discord-bot',
    'mlx': 'com.kernel.mlx-server',
    'collective-sync': 'com.kernel.kbot-collective-sync',
    'daemon': 'com.kernel.kbot-daemon',
    'kbot-local': 'com.kernel.kbot-local',
};
// Reverse map: label -> short name
const LABEL_TO_SHORT = {};
for (const [short, label] of Object.entries(SERVICE_MAP)) {
    LABEL_TO_SHORT[label] = short;
}
// ── Helpers ──
function exec(cmd, timeout = 10_000) {
    try {
        return execSync(cmd, { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return '';
    }
}
function getUid() {
    return exec('id -u');
}
function parseServiceLine(line) {
    // launchctl list output: PID\tStatus\tLabel
    const match = line.match(/^(-?\d+|-)?\s+(\d+)\s+(.+)$/);
    if (!match)
        return null;
    const pid = match[1] === '-' || !match[1] ? null : parseInt(match[1], 10);
    const lastExitStatus = parseInt(match[2], 10);
    const label = match[3].trim();
    return { pid, lastExitStatus, label };
}
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function getProcessStats(pid) {
    const raw = exec(`ps -p ${pid} -o %cpu,%mem,etime=`);
    if (!raw)
        return { cpu: '?', mem: '?', uptime: '?' };
    // Output: " 0.1  1.2    01:23:45" or " 0.0  0.3       12:34"
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 3) {
        return { cpu: `${parts[0]}%`, mem: `${parts[1]}%`, uptime: parts[2] };
    }
    return { cpu: '?', mem: '?', uptime: '?' };
}
function formatUptime(etime) {
    // etime can be: "12:34", "01:23:45", "1-01:23:45"
    if (etime === '?')
        return etime;
    const dayMatch = etime.match(/^(\d+)-/);
    if (dayMatch) {
        const days = parseInt(dayMatch[1], 10);
        return `${days}d`;
    }
    const parts = etime.split(':');
    if (parts.length === 3) {
        const h = parseInt(parts[0], 10);
        return h > 0 ? `${h}h` : `${parseInt(parts[1], 10)}m`;
    }
    if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        return m > 0 ? `${m}m` : `${parseInt(parts[1], 10)}s`;
    }
    return etime;
}
// ── Core Functions (exported for CLI use) ──
export function getServiceStatus() {
    const raw = exec('launchctl list 2>/dev/null');
    if (!raw)
        return [];
    const lines = raw.split('\n');
    const found = new Map();
    for (const line of lines) {
        const parsed = parseServiceLine(line);
        if (!parsed)
            continue;
        // Match against known service labels or grep for kbot/kernel/email
        if (!parsed.label.match(/kbot|kernel|email/i))
            continue;
        const shortName = LABEL_TO_SHORT[parsed.label] || parsed.label.replace(/^com\.kernel\./, '');
        const alive = parsed.pid !== null && parsed.pid > 0 && isPidAlive(parsed.pid);
        const stats = alive && parsed.pid ? getProcessStats(parsed.pid) : { cpu: '-', mem: '-', uptime: '-' };
        found.set(parsed.label, {
            label: parsed.label,
            shortName,
            pid: alive ? parsed.pid : null,
            status: alive ? 'running' : 'dead',
            cpu: stats.cpu,
            mem: stats.mem,
            uptime: formatUptime(stats.uptime),
        });
    }
    // Add known services that weren't found (not loaded)
    for (const [short, label] of Object.entries(SERVICE_MAP)) {
        if (!found.has(label)) {
            found.set(label, {
                label,
                shortName: short,
                pid: null,
                status: 'not-loaded',
                cpu: '-',
                mem: '-',
                uptime: '-',
            });
        }
    }
    // Sort: running first, then dead, then not-loaded
    const order = { running: 0, dead: 1, 'not-loaded': 2 };
    return [...found.values()].sort((a, b) => order[a.status] - order[b.status]);
}
export function restartService(name) {
    // Resolve short name to label
    const label = SERVICE_MAP[name] || name;
    const uid = getUid();
    if (!uid) {
        return { success: false, message: 'Could not determine user ID' };
    }
    // Try kickstart first (restarts running services)
    const domain = `gui/${uid}`;
    const result = exec(`launchctl kickstart -k ${domain}/${label} 2>&1`, 15_000);
    if (result.includes('No such process') || result.includes('Could not find service')) {
        // Try bootstrap (load the plist)
        const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
        if (existsSync(plistPath)) {
            const loadResult = exec(`launchctl bootstrap ${domain} ${plistPath} 2>&1`, 15_000);
            if (loadResult.includes('error') || loadResult.includes('Could not')) {
                return { success: false, message: `Failed to load ${label}: ${loadResult}` };
            }
            return { success: true, message: `Loaded and started ${label}` };
        }
        return { success: false, message: `Service ${label} not found. Plist missing at ${plistPath}` };
    }
    if (result.includes('error') || result.includes('failed')) {
        return { success: false, message: `Restart failed: ${result}` };
    }
    return { success: true, message: `Restarted ${label} via kickstart` };
}
export function getSystemHealth() {
    // ── CPU load ──
    const loadRaw = exec('sysctl -n vm.loadavg');
    // Output: "{ 1.23 1.45 1.67 }"
    const loadAvg = loadRaw.replace(/[{}]/g, '').trim() || '?';
    // ── Memory ──
    let memFree = '?';
    let memTotal = '?';
    let memUsed = '?';
    const vmStatRaw = exec('vm_stat');
    const pageSize = parseInt(exec('sysctl -n hw.pagesize') || '4096', 10);
    const totalMemBytes = parseInt(exec('sysctl -n hw.memsize') || '0', 10);
    if (vmStatRaw && totalMemBytes > 0) {
        const pages = (key) => {
            const m = vmStatRaw.match(new RegExp(`${key}:\\s+(\\d+)`));
            return m ? parseInt(m[1], 10) : 0;
        };
        const freePages = pages('Pages free') + pages('Pages speculative');
        const freeBytes = freePages * pageSize;
        const usedBytes = totalMemBytes - freeBytes;
        memTotal = `${(totalMemBytes / (1024 ** 3)).toFixed(1)}GB`;
        memFree = `${(freeBytes / (1024 ** 3)).toFixed(1)}GB`;
        memUsed = `${(usedBytes / (1024 ** 3)).toFixed(1)}GB`;
    }
    // ── Disk ──
    let diskFree = '?';
    let diskUsed = '?';
    let diskTotal = '?';
    const dfRaw = exec('df -h / 2>/dev/null');
    if (dfRaw) {
        const dfLines = dfRaw.split('\n');
        if (dfLines.length >= 2) {
            const parts = dfLines[1].split(/\s+/);
            // Filesystem  Size  Used  Avail  Use%  Mounted
            if (parts.length >= 4) {
                diskTotal = parts[1];
                diskUsed = parts[2];
                diskFree = parts[3];
            }
        }
    }
    // ── Ollama ──
    let ollamaStatus = 'offline';
    let ollamaModels = [];
    try {
        const ollamaRaw = exec('curl -s --connect-timeout 2 http://localhost:11434/api/tags');
        if (ollamaRaw) {
            const data = JSON.parse(ollamaRaw);
            if (data.models) {
                ollamaStatus = 'online';
                ollamaModels = data.models.map(m => m.name);
            }
        }
    }
    catch { /* offline */ }
    // ── kbot memory ──
    const kbotMemDir = join(homedir(), '.kbot', 'memory');
    let kbotMemorySize = '0B';
    if (existsSync(kbotMemDir)) {
        const duRaw = exec(`du -sh "${kbotMemDir}" 2>/dev/null`);
        if (duRaw) {
            kbotMemorySize = duRaw.split('\t')[0] || '0B';
        }
    }
    // ── Dream state ──
    let dreamCycles = 0;
    let dreamInsights = 0;
    const dreamStateFile = join(homedir(), '.kbot', 'dream', 'state.json');
    if (existsSync(dreamStateFile)) {
        try {
            const state = JSON.parse(readFileSync(dreamStateFile, 'utf-8'));
            dreamCycles = state.cycles || 0;
            dreamInsights = state.activeInsights || 0;
        }
        catch { /* ignore */ }
    }
    // ── Services ──
    const services = getServiceStatus();
    return {
        loadAvg,
        memFree,
        memTotal,
        memUsed,
        diskFree,
        diskUsed,
        diskTotal,
        ollamaStatus,
        ollamaModels,
        kbotMemorySize,
        dreamCycles,
        dreamInsights,
        services,
    };
}
// ── Tool Registration ──
export function registerWatchdogTools() {
    // ── service_status ──
    registerTool({
        name: 'service_status',
        description: 'List all kbot background services (launchd) with PID, status, CPU%, MEM%, and uptime. Checks email-agent, discovery daemon, kbot serve, discord bot, MLX server, collective sync, kbot-local MCP, and the main daemon.',
        parameters: {},
        tier: 'free',
        timeout: 15_000,
        execute: async () => {
            const services = getServiceStatus();
            if (services.length === 0) {
                return 'No kbot services found in launchd. Run `kbot daemon start` to enable background services.';
            }
            const running = services.filter(s => s.status === 'running').length;
            const total = services.length;
            const lines = [
                `KBOT SERVICES: ${running}/${total} running`,
                '',
                'SERVICE              PID      STATUS       CPU     MEM     UPTIME',
                '─'.repeat(72),
            ];
            for (const s of services) {
                const icon = s.status === 'running' ? '[OK]' : s.status === 'dead' ? '[!!]' : '[--]';
                const pid = s.pid ? String(s.pid) : '-';
                lines.push(`${icon} ${s.shortName.padEnd(18)} ${pid.padEnd(8)} ${s.status.padEnd(12)} ${s.cpu.padEnd(7)} ${s.mem.padEnd(7)} ${s.uptime}`);
            }
            return lines.join('\n');
        },
    });
    // ── service_restart ──
    registerTool({
        name: 'service_restart',
        description: 'Restart a kbot background service by name. Use short names: email-agent, discovery, serve, discord, mlx, collective-sync, daemon, kbot-local. Runs launchctl kickstart to restart the service.',
        parameters: {
            service: {
                type: 'string',
                description: 'Service short name: email-agent, discovery, serve, discord, mlx, collective-sync, daemon, kbot-local',
                required: true,
            },
        },
        tier: 'free',
        timeout: 20_000,
        execute: async (args) => {
            const name = args.service;
            if (!name)
                return 'Error: service name required';
            // Validate
            const known = Object.keys(SERVICE_MAP);
            if (!SERVICE_MAP[name] && !name.startsWith('com.kernel.')) {
                return `Unknown service "${name}". Known services: ${known.join(', ')}`;
            }
            const result = restartService(name);
            return result.success
                ? `OK: ${result.message}`
                : `FAIL: ${result.message}`;
        },
    });
    // ── system_health ──
    registerTool({
        name: 'system_health',
        description: 'Full system health dashboard: CPU load, RAM, disk, Ollama models, kbot memory size, dream journal status, and all service statuses. Compact overview of everything running on this machine.',
        parameters: {},
        tier: 'free',
        timeout: 20_000,
        execute: async () => {
            const h = getSystemHealth();
            const running = h.services.filter(s => s.status === 'running').length;
            const total = h.services.length;
            const lines = [
                'KBOT SYSTEM HEALTH',
                '═══════════════════',
                '',
                `Services:    ${running}/${total} running`,
                `CPU Load:    ${h.loadAvg}`,
                `RAM:         ${h.memUsed} used / ${h.memTotal} total (${h.memFree} free)`,
                `Disk:        ${h.diskUsed} used / ${h.diskTotal} total (${h.diskFree} free)`,
                `Ollama:      ${h.ollamaStatus}${h.ollamaModels.length > 0 ? ` — ${h.ollamaModels.length} models: ${h.ollamaModels.join(', ')}` : ''}`,
                `Memory:      ${h.kbotMemorySize}`,
                `Dreams:      ${h.dreamCycles} cycles, ${h.dreamInsights} active insights`,
                '',
                'SERVICES',
                '─'.repeat(72),
            ];
            for (const s of h.services) {
                const icon = s.status === 'running' ? '[OK]' : s.status === 'dead' ? '[!!]' : '[--]';
                const pid = s.pid ? String(s.pid) : '-';
                lines.push(`${icon} ${s.shortName.padEnd(18)} PID ${pid.padEnd(8)} CPU ${s.cpu.padEnd(7)} MEM ${s.mem.padEnd(7)} up ${s.uptime}`);
            }
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=watchdog.js.map