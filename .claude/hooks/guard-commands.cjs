#!/usr/bin/env node
// Hook: PreToolUse (bash) — block dangerous shell commands
// Exit code 2 = block action and send feedback to Claude
// Exit code 0 = allow action

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        const event = JSON.parse(input);
        const command = event?.tool_input?.command || '';

        // Dangerous patterns
        const blocked = [
            /rm\s+-rf\s+[\/~]/,          // rm -rf / or ~
            /rm\s+-rf\s+\./,              // rm -rf . (current dir)
            /DROP\s+(TABLE|DATABASE)/i,   // SQL drops
            /TRUNCATE\s+TABLE/i,          // SQL truncate
            />\s*\/dev\/sd/,              // Write to disk devices
            /mkfs\./,                     // Format filesystem
            /dd\s+if=/,                   // Disk destroyer
            /chmod\s+-R\s+777/,           // World-writable permissions
            /curl.*\|\s*(ba)?sh/,         // Pipe curl to shell
        ];

        for (const pattern of blocked) {
            if (pattern.test(command)) {
                console.log(`🛑 BLOCKED: Dangerous command detected.\nPattern: ${pattern}\nCommand: ${command}`);
                process.exit(2); // Block
            }
        }

        process.exit(0); // Allow
    } catch {
        process.exit(0); // Allow on parse error (safe default)
    }
});
