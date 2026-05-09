// futures/persona/registry — example personas. Hand-curated, not auto-generated.
//
// These three exist as concrete starting points for integration work; the
// next session will wire them into permissions.ts. Until then they're
// import-and-use values for tests and ad-hoc experimentation.
/**
 * Researcher: read-only research tools. Cannot mutate filesystem, repo, or
 * external state. Web fetches and grep are fine; writes are not.
 */
export const RESEARCHER = {
    id: 'researcher',
    description: 'Read-only research and search tools. No filesystem writes, no shell execution.',
    maxBlastRadius: 'read-only',
    scopes: [
        { toolPattern: 'read_file', blastRadius: 'read-only' },
        { toolPattern: 'list_directory', blastRadius: 'read-only' },
        { toolPattern: 'grep', blastRadius: 'read-only' },
        { toolPattern: 'glob', blastRadius: 'read-only' },
        { toolPattern: 'web_search', blastRadius: 'read-only' },
        { toolPattern: 'papers_search', blastRadius: 'read-only' },
        { toolPattern: 'kbot_search', blastRadius: 'read-only' },
        { toolPattern: 'arxiv_search', blastRadius: 'read-only' },
        { toolPattern: /^github_(read_file|repo_info|search|trending|activity|issues)$/, blastRadius: 'read-only' },
    ],
};
/**
 * Coder: read-write inside the workspace. Bash allowed but the most common
 * destructive forms are denied via deny-pattern argRules. No force pushes.
 * Rate limit on bash so a runaway loop can't burn 10k commands.
 */
export const CODER = {
    id: 'coder',
    description: 'Read-write code tools. Bash allowed but rm -rf and force-push denied. Bash 60/min.',
    maxBlastRadius: 'sandboxed',
    scopes: [
        { toolPattern: 'read_file', blastRadius: 'read-only' },
        { toolPattern: 'list_directory', blastRadius: 'read-only' },
        { toolPattern: 'grep', blastRadius: 'read-only' },
        { toolPattern: 'glob', blastRadius: 'read-only' },
        { toolPattern: 'write_file', blastRadius: 'sandboxed' },
        { toolPattern: 'edit_file', blastRadius: 'sandboxed' },
        { toolPattern: 'multi_file_write', blastRadius: 'sandboxed' },
        {
            toolPattern: 'bash',
            blastRadius: 'sandboxed',
            argConstraints: {
                // deny rm -rf at /, ~, or anywhere with force; deny sudo; deny curl|sh
                command: {
                    type: 'string',
                    denyPattern: true,
                    pattern: /(\brm\s+-[rRfF]+\s+(\/|~|\$HOME)|sudo\s+|curl\s+[^|]*\|\s*(sh|bash)|:\(\)\s*\{)/,
                },
            },
            rateLimit: { max: 60, windowMs: 60_000 },
        },
        { toolPattern: /^git_(status|log|diff|branch|commit)$/, blastRadius: 'sandboxed' },
        {
            toolPattern: 'git_push',
            blastRadius: 'sandboxed',
            argConstraints: {
                // forbid --force, --force-with-lease, -f
                args: {
                    type: 'string',
                    denyPattern: true,
                    pattern: /(^|\s)(--force(-with-lease)?|-f)(\s|$)/,
                },
            },
        },
        { toolPattern: /^npm_/, blastRadius: 'sandboxed' },
        { toolPattern: /^pip_/, blastRadius: 'sandboxed' },
    ],
};
/**
 * Computer-use: explicit destructive opt-in. GUI tools that drive the user's
 * physical desktop. Rate-limited so a hung loop can't spam clicks.
 */
export const COMPUTER_USE = {
    id: 'computer-use',
    description: 'Desktop control: mouse, keyboard, app launch. Destructive blast radius. 30/min.',
    maxBlastRadius: 'destructive',
    scopes: [
        {
            toolPattern: 'mouse_click',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        {
            toolPattern: 'mouse_move',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        {
            toolPattern: 'mouse_drag',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        {
            toolPattern: 'keyboard_type',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        {
            toolPattern: 'keyboard_shortcut',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        {
            toolPattern: 'app_launch',
            blastRadius: 'destructive',
            rateLimit: { max: 30, windowMs: 60_000 },
        },
        { toolPattern: 'screenshot', blastRadius: 'read-only' },
        { toolPattern: 'window_list', blastRadius: 'read-only' },
    ],
};
/**
 * Default registry. Add to this when wiring more personas.
 */
export const PERSONA_REGISTRY = {
    researcher: RESEARCHER,
    coder: CODER,
    'computer-use': COMPUTER_USE,
};
//# sourceMappingURL=registry.js.map