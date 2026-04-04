// kbot Memory Scanner Tools — Agent-accessible controls for the passive scanner
//
// Two tools:
//   - memory_scan_status: Show scanner stats (moments detected, memories saved, etc.)
//   - memory_scan_toggle: Enable/disable the passive scanner
import { registerTool } from './index.js';
import { getMemoryScannerStats, getCumulativeScannerStats, startMemoryScanner, stopMemoryScanner, isScannerEnabled, } from '../memory-scanner.js';
export function registerMemoryScannerTools() {
    // ── memory_scan_status ──
    registerTool({
        name: 'memory_scan_status',
        description: 'Show memory scanner status — how many turns observed, scans performed, memory-worthy moments detected, memories saved, and breakdown by signal kind (corrections, preferences, project facts, emotional). Includes cumulative stats across all sessions.',
        parameters: {},
        tier: 'free',
        timeout: 5_000,
        async execute() {
            const stats = getMemoryScannerStats();
            const cumulative = getCumulativeScannerStats();
            const lines = [
                'Memory Scanner Status',
                '═════════════════════',
                `State: ${stats.enabled ? 'ACTIVE' : 'PAUSED'}`,
                `Session start: ${stats.sessionStart.split('T')[0]} ${stats.sessionStart.split('T')[1]?.slice(0, 8) || ''}`,
                '',
                '── This Session ──',
                `Turns observed: ${stats.turnsObserved}`,
                `Scans performed: ${stats.scansPerformed}`,
                `Moments detected: ${stats.momentsDetected}`,
                `Memories saved: ${stats.memoriesSaved}`,
                '',
                'Signal breakdown:',
                `  Corrections:   ${stats.byKind.correction}`,
                `  Preferences:   ${stats.byKind.preference}`,
                `  Project facts: ${stats.byKind.project_fact}`,
                `  Emotional:     ${stats.byKind.emotional}`,
            ];
            if (stats.recentDetections.length > 0) {
                lines.push('', 'Recent detections:');
                for (const d of stats.recentDetections.slice(-5)) {
                    const time = d.detectedAt.split('T')[1]?.slice(0, 8) || '';
                    lines.push(`  [${time}] [${d.kind}] (${Math.round(d.confidence * 100)}%) ${d.content.slice(0, 100)}${d.content.length > 100 ? '...' : ''}`);
                }
            }
            lines.push('', '── Cumulative (all sessions) ──', `Total scans: ${cumulative.totalScans + stats.scansPerformed}`, `Total detections: ${cumulative.totalDetections + stats.momentsDetected}`, `Total saved: ${cumulative.totalSaved + stats.memoriesSaved}`, `Last scan: ${cumulative.lastScan || 'this session'}`, '', 'Cumulative by kind:', `  Corrections:   ${(cumulative.cumulativeByKind.correction || 0) + stats.byKind.correction}`, `  Preferences:   ${(cumulative.cumulativeByKind.preference || 0) + stats.byKind.preference}`, `  Project facts: ${(cumulative.cumulativeByKind.project_fact || 0) + stats.byKind.project_fact}`, `  Emotional:     ${(cumulative.cumulativeByKind.emotional || 0) + stats.byKind.emotional}`);
            return lines.join('\n');
        },
    });
    // ── memory_scan_toggle ──
    registerTool({
        name: 'memory_scan_toggle',
        description: 'Enable or disable the passive memory scanner. When enabled, the scanner watches conversation turns and auto-saves memory-worthy moments (corrections, preferences, project facts, emotional reactions). Disabling it stops detection but preserves already-saved memories.',
        parameters: {
            action: {
                type: 'string',
                description: '"enable" to start scanning, "disable" to stop, or "status" to check current state',
                required: true,
            },
        },
        tier: 'free',
        timeout: 5_000,
        async execute(args) {
            const action = String(args.action || '').toLowerCase().trim();
            if (action === 'enable' || action === 'on' || action === 'start') {
                if (isScannerEnabled()) {
                    return 'Memory scanner is already active.';
                }
                startMemoryScanner();
                return 'Memory scanner enabled. Now passively watching for memory-worthy moments in conversation.';
            }
            if (action === 'disable' || action === 'off' || action === 'stop') {
                if (!isScannerEnabled()) {
                    return 'Memory scanner is already paused.';
                }
                const stats = getMemoryScannerStats();
                stopMemoryScanner();
                return `Memory scanner paused. Session summary: ${stats.momentsDetected} moments detected, ${stats.memoriesSaved} memories saved.`;
            }
            if (action === 'status') {
                const active = isScannerEnabled();
                const stats = getMemoryScannerStats();
                return `Scanner is ${active ? 'ACTIVE' : 'PAUSED'}. This session: ${stats.turnsObserved} turns observed, ${stats.memoriesSaved} memories saved.`;
            }
            return 'Invalid action. Use "enable", "disable", or "status".';
        },
    });
} // end registerMemoryScannerTools
//# sourceMappingURL=memory-scanner-tools.js.map