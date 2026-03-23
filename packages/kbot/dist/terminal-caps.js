// kbot Terminal Capability Detection — zero dependencies
//
// Detects what the current terminal supports and provides feature flags.
// Enables progressive enhancement: Braille sparklines, inline images
// (Sixel/Kitty/iTerm2), synchronized output, and truecolor gradients.
//
// Everything degrades gracefully — if detection fails, callers fall back
// to existing basic output.
export function detectTerminalCapabilities() {
    const env = process.env;
    const program = env.TERM_PROGRAM ?? env.TERMINAL_EMULATOR ?? '';
    const colorterm = env.COLORTERM ?? '';
    const term = env.TERM ?? '';
    // Color detection
    const truecolor = colorterm === 'truecolor' || colorterm === '24bit'
        || ['iterm2', 'wezterm', 'kitty', 'alacritty', 'rio'].some(t => program.toLowerCase().includes(t));
    const color256 = truecolor || term.includes('256color');
    const basicColor = color256 || process.stdout.isTTY === true;
    // Graphics detection
    const kittyGraphics = program.toLowerCase() === 'kitty' || env.KITTY_WINDOW_ID !== undefined;
    const iterm2Images = program === 'iTerm.app' || program === 'WezTerm' || env.ITERM_SESSION_ID !== undefined;
    const sixel = ['mlterm', 'xterm', 'foot', 'contour'].some(t => program.toLowerCase().includes(t))
        || term === 'xterm-sixel';
    // Unicode/Braille
    const locale = env.LANG ?? env.LC_ALL ?? '';
    const unicode = locale.includes('UTF-8') || locale.includes('utf-8') || locale.includes('UTF8');
    const braille = unicode; // Braille requires Unicode
    // Synchronized output (most modern terminals support it)
    const syncOutput = kittyGraphics || iterm2Images
        || ['wezterm', 'contour', 'foot', 'rio'].some(t => program.toLowerCase().includes(t));
    return {
        truecolor,
        color256,
        basicColor,
        sixel,
        kittyGraphics,
        iterm2Images,
        unicode,
        braille,
        syncOutput,
        program: program || term || 'unknown',
        columns: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 24,
    };
}
// ── Synchronized output wrapper ──
// Prevents flicker by buffering screen updates between begin/end markers.
export function withSyncOutput(fn) {
    const caps = detectTerminalCapabilities();
    if (caps.syncOutput) {
        process.stdout.write('\x1b[?2026h'); // Begin synchronized update
    }
    try {
        fn();
    }
    finally {
        if (caps.syncOutput) {
            process.stdout.write('\x1b[?2026l'); // End synchronized update
        }
    }
}
// ── Truecolor helpers ──
// Generate ANSI escape sequences for 24-bit color terminals.
export function rgb(r, g, b) {
    return `\x1b[38;2;${r};${g};${b}m`;
}
export function bgRgb(r, g, b) {
    return `\x1b[48;2;${r};${g};${b}m`;
}
export function gradient(text, startColor, endColor) {
    const chars = [...text];
    return chars.map((char, i) => {
        const t = chars.length > 1 ? i / (chars.length - 1) : 0;
        const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * t);
        const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * t);
        const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * t);
        return `${rgb(r, g, b)}${char}`;
    }).join('') + '\x1b[0m';
}
//# sourceMappingURL=terminal-caps.js.map