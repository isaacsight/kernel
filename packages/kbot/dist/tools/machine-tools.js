// kbot Machine Tools — Runtime system-awareness tools
//
// Exposes live machine metrics as tools the agent can call:
//   system_profile, memory_pressure, gpu_status, process_top,
//   thermal_state, disk_health, network_check
//
// Cross-platform: macOS + Linux. Each tool handles errors gracefully.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { totalmem, freemem, platform as osPlatform } from 'node:os';
import { registerTool } from './index.js';
const plat = osPlatform();
/** Safe exec — returns stdout or empty string on failure */
function exec(cmd, timeoutMs = 5000) {
    try {
        return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return '';
    }
}
/** Format bytes to human-readable */
function fmtBytes(bytes) {
    if (bytes >= 1024 ** 4)
        return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
    if (bytes >= 1024 ** 3)
        return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2)
        return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
    if (bytes >= 1024)
        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
}
export function registerMachineTools() {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. system_profile — Full machine profile (cached via probeMachine)
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'system_profile',
        description: 'Returns the full machine profile: CPU, GPU, memory, disk, OS, displays, battery, network, dev tools, and AI capability assessment. ' +
            'Cached after first call — fast on subsequent invocations. Use this to understand what hardware and software the user has.',
        parameters: {},
        tier: 'free',
        async execute() {
            try {
                const { probeMachine, formatMachineProfile } = await import('../machine.js');
                const profile = await probeMachine();
                return formatMachineProfile(profile);
            }
            catch (err) {
                return `Error probing machine: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 2. memory_pressure — Live memory check (not cached)
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'memory_pressure',
        description: 'Returns live memory usage: total, free, used, and pressure level (low/moderate/high). ' +
            'On macOS, also returns detailed vm_stat page statistics (active, inactive, wired, compressed, speculative pages). ' +
            'On Linux, reads /proc/meminfo for detailed breakdown. Not cached — always returns current state.',
        parameters: {},
        tier: 'free',
        async execute() {
            try {
                const totalBytes = totalmem();
                const freeBytes = freemem();
                const usedBytes = totalBytes - freeBytes;
                const freePercent = (freeBytes / totalBytes) * 100;
                const pressure = freePercent > 25 ? 'low' : freePercent > 10 ? 'moderate' : 'high';
                const lines = [
                    'Memory Status',
                    `  Total:     ${fmtBytes(totalBytes)}`,
                    `  Used:      ${fmtBytes(usedBytes)} (${(100 - freePercent).toFixed(1)}%)`,
                    `  Free:      ${fmtBytes(freeBytes)} (${freePercent.toFixed(1)}%)`,
                    `  Pressure:  ${pressure}`,
                ];
                if (plat === 'darwin') {
                    // vm_stat gives detailed page-level memory breakdown
                    const vmstat = exec('vm_stat');
                    if (vmstat) {
                        lines.push('');
                        lines.push('vm_stat Page Statistics:');
                        const pageSize = parseInt(exec('sysctl -n hw.pagesize') || '16384');
                        const getPages = (label) => {
                            const match = vmstat.match(new RegExp(`${label}:\\s+(\\d+)`, 'i'));
                            return match ? parseInt(match[1]) : 0;
                        };
                        const active = getPages('Pages active');
                        const inactive = getPages('Pages inactive');
                        const wired = getPages('Pages wired down');
                        const compressed = getPages('Pages occupied by compressor');
                        const speculative = getPages('Pages speculative');
                        const pageFree = getPages('Pages free');
                        const pageins = getPages('Pageins');
                        const pageouts = getPages('Pageouts');
                        const swapins = getPages('Swapins');
                        const swapouts = getPages('Swapouts');
                        lines.push(`  Page size:     ${pageSize} bytes`);
                        lines.push(`  Active:        ${fmtBytes(active * pageSize)}`);
                        lines.push(`  Inactive:      ${fmtBytes(inactive * pageSize)}`);
                        lines.push(`  Wired:         ${fmtBytes(wired * pageSize)}`);
                        lines.push(`  Compressed:    ${fmtBytes(compressed * pageSize)}`);
                        lines.push(`  Speculative:   ${fmtBytes(speculative * pageSize)}`);
                        lines.push(`  Free pages:    ${fmtBytes(pageFree * pageSize)}`);
                        lines.push(`  Pageins:       ${pageins}`);
                        lines.push(`  Pageouts:      ${pageouts}`);
                        lines.push(`  Swapins:       ${swapins}`);
                        lines.push(`  Swapouts:      ${swapouts}`);
                        // Memory pressure from macOS memory_pressure command
                        const mpressure = exec('memory_pressure 2>/dev/null | head -1', 3000);
                        if (mpressure) {
                            lines.push(`  System:        ${mpressure}`);
                        }
                    }
                }
                else if (plat === 'linux') {
                    // /proc/meminfo for detailed breakdown
                    try {
                        const meminfo = readFileSync('/proc/meminfo', 'utf-8');
                        lines.push('');
                        lines.push('/proc/meminfo:');
                        const getValue = (key) => {
                            const match = meminfo.match(new RegExp(`${key}:\\s+(.+)`, 'i'));
                            return match ? match[1].trim() : 'N/A';
                        };
                        lines.push(`  MemTotal:      ${getValue('MemTotal')}`);
                        lines.push(`  MemFree:       ${getValue('MemFree')}`);
                        lines.push(`  MemAvailable:  ${getValue('MemAvailable')}`);
                        lines.push(`  Buffers:       ${getValue('Buffers')}`);
                        lines.push(`  Cached:        ${getValue('Cached')}`);
                        lines.push(`  SwapTotal:     ${getValue('SwapTotal')}`);
                        lines.push(`  SwapFree:      ${getValue('SwapFree')}`);
                        lines.push(`  Dirty:         ${getValue('Dirty')}`);
                        lines.push(`  Shmem:         ${getValue('Shmem')}`);
                    }
                    catch {
                        lines.push('  (Could not read /proc/meminfo)');
                    }
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error checking memory: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 3. gpu_status — Live GPU utilization
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'gpu_status',
        description: 'Returns live GPU utilization and status. ' +
            'macOS: uses ioreg to query GPU activity, power state, and performance statistics. ' +
            'Linux: uses nvidia-smi for NVIDIA GPUs (utilization, memory, temperature, power draw). ' +
            'Useful for checking if the GPU is available for local model inference.',
        parameters: {},
        tier: 'free',
        async execute() {
            try {
                const lines = ['GPU Status'];
                if (plat === 'darwin') {
                    // ioreg for GPU activity info
                    const gpuInfo = exec('ioreg -rc IOAccelerator 2>/dev/null | head -80', 5000);
                    if (gpuInfo) {
                        // Extract key GPU metrics
                        const perfStats = exec('ioreg -rc IOAccelerator -d 1 2>/dev/null', 5000);
                        // Get GPU model from system_profiler (more reliable)
                        const spDisplay = exec('system_profiler SPDisplaysDataType 2>/dev/null', 5000);
                        const chipsetMatch = spDisplay.match(/Chipset Model:\s*(.+)/i);
                        const metalMatch = spDisplay.match(/Metal Support:\s*(.+)/i);
                        const coresMatch = spDisplay.match(/Total Number of Cores:\s*(\d+)/i);
                        if (chipsetMatch)
                            lines.push(`  Model:       ${chipsetMatch[1].trim()}`);
                        if (coresMatch)
                            lines.push(`  GPU Cores:   ${coresMatch[1].trim()}`);
                        if (metalMatch)
                            lines.push(`  Metal:       ${metalMatch[1].trim()}`);
                        // Device utilization from ioreg
                        const utilizationMatch = perfStats.match(/"Device Utilization %"\s*=\s*(\d+)/i);
                        if (utilizationMatch) {
                            lines.push(`  Utilization: ${utilizationMatch[1]}%`);
                        }
                        // Power state
                        const powerMatch = perfStats.match(/"PerformanceStatistics"[\s\S]*?"GPU Activity\(\%\)"\s*=\s*(\d+)/);
                        if (powerMatch) {
                            lines.push(`  Activity:    ${powerMatch[1]}%`);
                        }
                        // Check if GPU is in use by any process
                        const gpuProcesses = exec('ioreg -rc IOGPUDevice 2>/dev/null | grep -c "IOGPUDevice"', 3000);
                        if (gpuProcesses) {
                            lines.push(`  GPU Devices: ${gpuProcesses}`);
                        }
                    }
                    else {
                        lines.push('  (Could not query GPU via ioreg)');
                    }
                    // Also check for eGPU
                    const egpu = exec('system_profiler SPThunderboltDataType 2>/dev/null | grep -i gpu', 3000);
                    if (egpu) {
                        lines.push('');
                        lines.push('  eGPU detected via Thunderbolt');
                    }
                }
                else if (plat === 'linux') {
                    // Try nvidia-smi first (NVIDIA GPUs)
                    const nvidiaSmi = exec('nvidia-smi --query-gpu=name,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,power.draw,power.limit --format=csv,noheader 2>/dev/null', 5000);
                    if (nvidiaSmi) {
                        for (const line of nvidiaSmi.split('\n').filter(Boolean)) {
                            const parts = line.split(',').map(s => s.trim());
                            if (parts.length >= 9) {
                                lines.push(`  Model:         ${parts[0]}`);
                                lines.push(`  GPU Util:      ${parts[1]}`);
                                lines.push(`  Memory Util:   ${parts[2]}`);
                                lines.push(`  VRAM Total:    ${parts[3]}`);
                                lines.push(`  VRAM Used:     ${parts[4]}`);
                                lines.push(`  VRAM Free:     ${parts[5]}`);
                                lines.push(`  Temperature:   ${parts[6]} C`);
                                lines.push(`  Power Draw:    ${parts[7]}`);
                                lines.push(`  Power Limit:   ${parts[8]}`);
                            }
                        }
                        // Running GPU processes
                        const procs = exec('nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv,noheader 2>/dev/null', 3000);
                        if (procs) {
                            lines.push('');
                            lines.push('  GPU Processes:');
                            for (const proc of procs.split('\n').filter(Boolean)) {
                                lines.push(`    ${proc.trim()}`);
                            }
                        }
                    }
                    else {
                        // Fallback: check lspci for any GPU
                        const lspci = exec('lspci 2>/dev/null | grep -iE "VGA|3D|Display"', 3000);
                        if (lspci) {
                            lines.push('  Detected GPUs (no live stats available):');
                            for (const line of lspci.split('\n').filter(Boolean)) {
                                const match = line.match(/:\s*(.+)/);
                                if (match)
                                    lines.push(`    ${match[1].trim()}`);
                            }
                        }
                        else {
                            lines.push('  No GPU detected');
                        }
                    }
                }
                else {
                    lines.push(`  Unsupported platform: ${plat}`);
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error checking GPU: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 4. process_top — Top N processes by CPU or memory
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'process_top',
        description: 'Returns the top N processes sorted by CPU usage or memory usage. ' +
            'Useful for diagnosing performance issues, finding runaway processes, or checking resource consumption. ' +
            'Defaults to top 10 by CPU.',
        parameters: {
            sort_by: {
                type: 'string',
                description: 'Sort criteria: "cpu" (default) or "memory"',
            },
            count: {
                type: 'number',
                description: 'Number of processes to return (default: 10, max: 50)',
            },
        },
        tier: 'free',
        async execute(args) {
            try {
                const sortBy = args.sort_by === 'memory' ? 'memory' : 'cpu';
                const count = Math.min(Math.max(parseInt(String(args.count || '10')), 1), 50);
                let output;
                if (plat === 'darwin') {
                    // macOS ps doesn't support --sort, use pipe to sort
                    const sortFlag = sortBy === 'memory' ? '-m' : '-r';
                    // Use top in logging mode for accurate stats on macOS
                    const psOutput = exec(`ps aux ${sortFlag} | head -${count + 1}`, 5000);
                    if (psOutput) {
                        output = `Top ${count} processes by ${sortBy}:\n\n${psOutput}`;
                    }
                    else {
                        output = `Could not retrieve process list`;
                    }
                }
                else {
                    // Linux ps supports --sort
                    const sortFlag = sortBy === 'memory' ? '--sort=-pmem' : '--sort=-pcpu';
                    const psOutput = exec(`ps aux ${sortFlag} | head -${count + 1}`, 5000);
                    if (psOutput) {
                        output = `Top ${count} processes by ${sortBy}:\n\n${psOutput}`;
                    }
                    else {
                        output = `Could not retrieve process list`;
                    }
                }
                // Add load average
                const loadAvg = exec('uptime');
                if (loadAvg) {
                    output += `\n\nSystem load: ${loadAvg}`;
                }
                return output;
            }
            catch (err) {
                return `Error listing processes: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 5. thermal_state — CPU thermal throttling detection
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'thermal_state',
        description: 'Detects CPU thermal throttling state. ' +
            'macOS: reads pmset thermal log and CPU die temperature via powermetrics (if available). ' +
            'Linux: reads /sys/class/thermal/ zone temperatures and throttle counts. ' +
            'Useful for diagnosing performance issues caused by overheating.',
        parameters: {},
        tier: 'free',
        async execute() {
            try {
                const lines = ['Thermal State'];
                if (plat === 'darwin') {
                    // pmset -g thermlog shows thermal throttling events
                    const thermLog = exec('pmset -g thermlog 2>/dev/null', 3000);
                    if (thermLog) {
                        lines.push('');
                        lines.push('Thermal Log (pmset):');
                        // Only include the last few lines to keep it concise
                        const thermLines = thermLog.split('\n').filter(Boolean);
                        for (const line of thermLines.slice(-10)) {
                            lines.push(`  ${line}`);
                        }
                    }
                    else {
                        lines.push('  No thermal log available from pmset');
                    }
                    // Try to get CPU temperature via thermal sensor
                    // Note: powermetrics requires sudo, so we try ioreg instead
                    const thermalSensors = exec('ioreg -rc AppleSmartBattery 2>/dev/null | grep Temperature', 3000);
                    if (thermalSensors) {
                        const tempMatch = thermalSensors.match(/"Temperature"\s*=\s*(\d+)/);
                        if (tempMatch) {
                            // Battery temperature is reported in centi-degrees
                            const tempC = parseInt(tempMatch[1]) / 100;
                            lines.push(`  Battery temp:  ${tempC.toFixed(1)} C`);
                        }
                    }
                    // CPU thermal pressure (macOS 12+)
                    const thermalPressure = exec('sysctl -n kern.thermal_state 2>/dev/null', 2000);
                    if (thermalPressure) {
                        const states = {
                            '0': 'nominal (no throttling)',
                            '1': 'fair (minor throttling)',
                            '2': 'serious (significant throttling)',
                            '3': 'critical (maximum throttling)',
                        };
                        lines.push(`  Thermal state: ${states[thermalPressure] || thermalPressure}`);
                    }
                    // CPU speed via sysctl
                    const cpuFreq = exec('sysctl -n hw.cpufrequency_max 2>/dev/null', 2000);
                    if (cpuFreq) {
                        const freqGHz = (parseInt(cpuFreq) / 1e9).toFixed(2);
                        lines.push(`  CPU max freq:  ${freqGHz} GHz`);
                    }
                }
                else if (plat === 'linux') {
                    // Read thermal zones
                    const thermalZonesExist = existsSync('/sys/class/thermal/thermal_zone0');
                    if (thermalZonesExist) {
                        lines.push('');
                        lines.push('Thermal Zones:');
                        for (let i = 0; i < 10; i++) {
                            const zonePath = `/sys/class/thermal/thermal_zone${i}`;
                            if (!existsSync(zonePath))
                                break;
                            try {
                                const type = readFileSync(`${zonePath}/type`, 'utf-8').trim();
                                const temp = parseInt(readFileSync(`${zonePath}/temp`, 'utf-8').trim());
                                const tempC = (temp / 1000).toFixed(1);
                                // Check for trip points
                                let tripInfo = '';
                                const tripPath = `${zonePath}/trip_point_0_temp`;
                                if (existsSync(tripPath)) {
                                    const tripTemp = parseInt(readFileSync(tripPath, 'utf-8').trim());
                                    tripInfo = ` (trip: ${(tripTemp / 1000).toFixed(0)} C)`;
                                }
                                lines.push(`  Zone ${i} (${type}): ${tempC} C${tripInfo}`);
                            }
                            catch {
                                // Skip unreadable zones
                            }
                        }
                    }
                    else {
                        lines.push('  No thermal zones found in /sys/class/thermal/');
                    }
                    // Check CPU frequency scaling (throttling indicator)
                    const scalingGovernor = exec('cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null', 2000);
                    if (scalingGovernor) {
                        lines.push(`  CPU governor:  ${scalingGovernor}`);
                    }
                    const curFreq = exec('cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null', 2000);
                    const maxFreq = exec('cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq 2>/dev/null', 2000);
                    if (curFreq && maxFreq) {
                        const curMHz = (parseInt(curFreq) / 1000).toFixed(0);
                        const maxMHz = (parseInt(maxFreq) / 1000).toFixed(0);
                        const throttled = parseInt(curFreq) < parseInt(maxFreq) * 0.9;
                        lines.push(`  CPU freq:      ${curMHz} MHz / ${maxMHz} MHz${throttled ? ' [THROTTLED]' : ''}`);
                    }
                    // Check for GPU thermal throttling (NVIDIA)
                    const gpuTemp = exec('nvidia-smi --query-gpu=temperature.gpu,temperature.gpu.tlimit --format=csv,noheader 2>/dev/null', 3000);
                    if (gpuTemp) {
                        lines.push(`  GPU temp:      ${gpuTemp.trim()}`);
                    }
                }
                else {
                    lines.push(`  Unsupported platform: ${plat}`);
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error checking thermal state: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 6. disk_health — Disk space + I/O stats
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'disk_health',
        description: 'Returns disk space usage for all mounted filesystems (df -h) plus disk I/O statistics. ' +
            'macOS: uses iostat for I/O throughput. Linux: reads /proc/diskstats for I/O counters. ' +
            'Useful for diagnosing storage issues, full disks, or I/O bottlenecks.',
        parameters: {
            path: {
                type: 'string',
                description: 'Specific path to check (default: all mounted filesystems)',
            },
        },
        tier: 'free',
        async execute(args) {
            try {
                const targetPath = args.path || '';
                const lines = ['Disk Health'];
                // Disk space usage
                lines.push('');
                lines.push('Disk Space:');
                const dfCmd = targetPath ? `df -h "${targetPath}"` : 'df -h';
                const dfOutput = exec(dfCmd, 5000);
                if (dfOutput) {
                    for (const line of dfOutput.split('\n')) {
                        lines.push(`  ${line}`);
                    }
                }
                else {
                    lines.push('  Could not read disk space (df failed)');
                }
                // I/O statistics
                lines.push('');
                lines.push('Disk I/O:');
                if (plat === 'darwin') {
                    // iostat on macOS
                    const iostat = exec('iostat -d -c 2 -w 1 2>/dev/null', 8000);
                    if (iostat) {
                        const iostatLines = iostat.split('\n').filter(Boolean);
                        // Take the last set of readings (second sample for delta)
                        for (const line of iostatLines.slice(-5)) {
                            lines.push(`  ${line}`);
                        }
                    }
                    else {
                        lines.push('  iostat not available');
                    }
                }
                else if (plat === 'linux') {
                    // /proc/diskstats for I/O counters
                    try {
                        const diskstats = readFileSync('/proc/diskstats', 'utf-8');
                        lines.push('  Device         Reads      Writes     In-progress');
                        // Filter to show only interesting devices (sd*, nvme*, vd*)
                        for (const line of diskstats.split('\n')) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length >= 14) {
                                const device = parts[2];
                                if (/^(sd[a-z]|nvme\d+n\d+|vd[a-z])$/.test(device)) {
                                    const reads = parts[3];
                                    const writes = parts[7];
                                    const inProgress = parts[11];
                                    lines.push(`  ${device.padEnd(13)}${reads.padStart(10)} ${writes.padStart(10)} ${inProgress.padStart(13)}`);
                                }
                            }
                        }
                    }
                    catch {
                        // Fallback to iostat
                        const iostat = exec('iostat -d 2>/dev/null', 5000);
                        if (iostat) {
                            for (const line of iostat.split('\n').filter(Boolean)) {
                                lines.push(`  ${line}`);
                            }
                        }
                        else {
                            lines.push('  No I/O stats available');
                        }
                    }
                }
                // Warn about critically full disks
                if (dfOutput) {
                    const criticalDisks = [];
                    for (const line of dfOutput.split('\n').slice(1)) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 5) {
                            const usedPercent = parseInt(parts[4]);
                            if (usedPercent >= 90) {
                                criticalDisks.push(`${parts[5] || parts[0]}: ${parts[4]} used`);
                            }
                        }
                    }
                    if (criticalDisks.length > 0) {
                        lines.push('');
                        lines.push('WARNING — Critical disk usage:');
                        for (const d of criticalDisks) {
                            lines.push(`  ${d}`);
                        }
                    }
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error checking disk health: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─────────────────────────────────────────────────────────────────────────
    // 7. network_check — Connectivity check
    // ─────────────────────────────────────────────────────────────────────────
    registerTool({
        name: 'network_check',
        description: 'Performs a connectivity check: ping test (1.1.1.1 and 8.8.8.8), DNS resolution, WiFi signal strength, ' +
            'and active connection count. Useful for diagnosing network issues or verifying internet access before API calls.',
        parameters: {
            host: {
                type: 'string',
                description: 'Optional host to ping (default: 1.1.1.1)',
            },
        },
        tier: 'free',
        async execute(args) {
            try {
                const host = args.host || '1.1.1.1';
                const lines = ['Network Check'];
                // Ping test
                lines.push('');
                lines.push('Connectivity:');
                const pingResult = exec(`ping -c 3 -W 3 ${host} 2>/dev/null`, 10000);
                if (pingResult) {
                    // Extract summary line
                    const summaryMatch = pingResult.match(/(\d+) packets transmitted.*?(\d+) (?:packets )?received/);
                    const rttMatch = pingResult.match(/(?:rtt|round-trip).*?=\s*([^\n]+)/);
                    if (summaryMatch) {
                        const sent = summaryMatch[1];
                        const recv = summaryMatch[2];
                        const loss = sent !== recv ? ` (${parseInt(sent) - parseInt(recv)} lost)` : '';
                        lines.push(`  Ping ${host}: ${recv}/${sent} packets received${loss}`);
                    }
                    if (rttMatch) {
                        lines.push(`  RTT:         ${rttMatch[1].trim()}`);
                    }
                }
                else {
                    lines.push(`  Ping ${host}: FAILED (no response)`);
                }
                // DNS resolution test
                lines.push('');
                lines.push('DNS Resolution:');
                const dnsTargets = ['google.com', 'cloudflare.com', 'github.com'];
                for (const target of dnsTargets) {
                    const dnsResult = exec(`dig +short ${target} A 2>/dev/null | head -1`, 3000);
                    if (dnsResult) {
                        lines.push(`  ${target.padEnd(18)} ${dnsResult}`);
                    }
                    else {
                        // Fallback to host command
                        const hostResult = exec(`host -W 2 ${target} 2>/dev/null | head -1`, 3000);
                        if (hostResult && hostResult.includes('has address')) {
                            const ip = hostResult.match(/has address\s+(.+)/)?.[1] || 'resolved';
                            lines.push(`  ${target.padEnd(18)} ${ip}`);
                        }
                        else {
                            lines.push(`  ${target.padEnd(18)} FAILED`);
                        }
                    }
                }
                // WiFi signal strength
                lines.push('');
                lines.push('WiFi:');
                if (plat === 'darwin') {
                    const wifiInfo = exec('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null', 3000);
                    if (wifiInfo) {
                        const ssid = wifiInfo.match(/\bSSID:\s*(.+)/i)?.[1]?.trim();
                        const rssi = wifiInfo.match(/agrCtlRSSI:\s*(-?\d+)/)?.[1];
                        const noise = wifiInfo.match(/agrCtlNoise:\s*(-?\d+)/)?.[1];
                        const channel = wifiInfo.match(/channel:\s*(.+)/i)?.[1]?.trim();
                        const txRate = wifiInfo.match(/lastTxRate:\s*(\d+)/)?.[1];
                        if (ssid)
                            lines.push(`  SSID:        ${ssid}`);
                        if (rssi) {
                            const rssiNum = parseInt(rssi);
                            const quality = rssiNum >= -50 ? 'excellent' : rssiNum >= -60 ? 'good' : rssiNum >= -70 ? 'fair' : 'poor';
                            lines.push(`  Signal:      ${rssi} dBm (${quality})`);
                        }
                        if (noise)
                            lines.push(`  Noise:       ${noise} dBm`);
                        if (channel)
                            lines.push(`  Channel:     ${channel}`);
                        if (txRate)
                            lines.push(`  Tx Rate:     ${txRate} Mbps`);
                    }
                    else {
                        // Fallback: networksetup
                        const ssid = exec('networksetup -getairportnetwork en0 2>/dev/null', 3000);
                        const ssidName = ssid.match(/Current Wi-Fi Network:\s*(.+)/)?.[1];
                        lines.push(`  SSID:        ${ssidName || 'not connected'}`);
                    }
                }
                else if (plat === 'linux') {
                    const iwconfig = exec('iwconfig 2>/dev/null | grep -A5 "ESSID"', 3000);
                    if (iwconfig) {
                        const ssid = iwconfig.match(/ESSID:"(.+?)"/)?.[1];
                        const signalMatch = iwconfig.match(/Signal level[=:](-?\d+)/i);
                        const bitRate = iwconfig.match(/Bit Rate[=:](\S+)/i)?.[1];
                        if (ssid)
                            lines.push(`  SSID:        ${ssid}`);
                        if (signalMatch) {
                            const rssi = parseInt(signalMatch[1]);
                            const quality = rssi >= -50 ? 'excellent' : rssi >= -60 ? 'good' : rssi >= -70 ? 'fair' : 'poor';
                            lines.push(`  Signal:      ${signalMatch[1]} dBm (${quality})`);
                        }
                        if (bitRate)
                            lines.push(`  Bit Rate:    ${bitRate}`);
                    }
                    else {
                        const nmcli = exec('nmcli -t -f active,ssid,signal dev wifi 2>/dev/null | grep "^yes"', 3000);
                        if (nmcli) {
                            const parts = nmcli.split(':');
                            if (parts.length >= 3) {
                                lines.push(`  SSID:        ${parts[1]}`);
                                lines.push(`  Signal:      ${parts[2]}%`);
                            }
                        }
                        else {
                            lines.push('  WiFi info not available');
                        }
                    }
                }
                // Active connections count
                lines.push('');
                lines.push('Active Connections:');
                if (plat === 'darwin') {
                    const established = exec('netstat -an 2>/dev/null | grep -c ESTABLISHED', 3000);
                    const listening = exec('netstat -an 2>/dev/null | grep -c LISTEN', 3000);
                    lines.push(`  Established: ${established || '0'}`);
                    lines.push(`  Listening:   ${listening || '0'}`);
                }
                else {
                    const established = exec('ss -t state established 2>/dev/null | tail -n +2 | wc -l', 3000);
                    const listening = exec('ss -t state listening 2>/dev/null | tail -n +2 | wc -l', 3000);
                    lines.push(`  Established: ${established?.trim() || '0'}`);
                    lines.push(`  Listening:   ${listening?.trim() || '0'}`);
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error checking network: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=machine-tools.js.map