// kbot LSP Tools — Language intelligence for the agent
//
// Exposes LSP capabilities as kbot tools so the agent can:
//   - Navigate code (go-to-definition, find-references)
//   - Understand types (hover, completions)
//   - Refactor safely (rename across project)
//   - Detect issues (diagnostics)
//   - Explore structure (document symbols)
//
// All operations are local — zero API calls, zero cost.
import { registerTool } from './index.js';
import { gotoDefinition, findReferences, hover, completions, rename, getDiagnostics, documentSymbols, detectLanguage, formatLocations, formatDiagnosticsList, formatSymbol, formatCompletion, formatWorkspaceEdit, } from '../lsp-client.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
/** Validate file path and return absolute path, or throw */
function validateFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('file parameter is required and must be a string');
    }
    const absPath = resolve(String(filePath));
    if (!existsSync(absPath)) {
        throw new Error(`File not found: ${absPath}`);
    }
    return absPath;
}
/** Validate and parse a line number (1-indexed from user, 0-indexed for LSP) */
function parseLine(line) {
    const n = Number(line);
    if (isNaN(n) || n < 1) {
        throw new Error('line must be a positive integer (1-indexed)');
    }
    return n - 1; // Convert to 0-indexed for LSP
}
/** Validate and parse a column number (1-indexed from user, 0-indexed for LSP) */
function parseCol(col) {
    const n = Number(col);
    if (isNaN(n) || n < 1) {
        throw new Error('col must be a positive integer (1-indexed)');
    }
    return n - 1; // Convert to 0-indexed for LSP
}
/** Check that the file has a supported language and return an error message if not */
function checkLanguageSupport(filePath) {
    const lang = detectLanguage(filePath);
    if (!lang) {
        const ext = filePath.split('.').pop() || 'unknown';
        return `No LSP support for .${ext} files. Supported: .ts, .tsx, .js, .jsx, .py, .go, .rs`;
    }
    return null;
}
export function registerLspTools() {
    // ── Go to Definition ──
    registerTool({
        name: 'lsp_goto_definition',
        description: 'Go to the definition of a symbol at a given position in a file. Returns the file path(s) and location(s) where the symbol is defined. Positions are 1-indexed (line 1, col 1 = first character of first line).',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            col: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            const line = parseLine(args.line);
            const col = parseCol(args.col);
            try {
                const locations = await gotoDefinition(filePath, line, col);
                if (locations.length === 0) {
                    return 'No definition found at this position.';
                }
                return `Definition location(s):\n${formatLocations(locations)}`;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Find References ──
    registerTool({
        name: 'lsp_find_references',
        description: 'Find all references to a symbol at a given position across the project. Returns file paths and locations of every usage. Positions are 1-indexed.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            col: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            const line = parseLine(args.line);
            const col = parseCol(args.col);
            try {
                const locations = await findReferences(filePath, line, col);
                if (locations.length === 0) {
                    return 'No references found at this position.';
                }
                return `${locations.length} reference(s) found:\n${formatLocations(locations)}`;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Hover ──
    registerTool({
        name: 'lsp_hover',
        description: 'Get hover information (type signature, documentation) for a symbol at a given position. Useful for checking the type of a variable, function signature, or reading inline docs. Positions are 1-indexed.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            col: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            const line = parseLine(args.line);
            const col = parseCol(args.col);
            try {
                const result = await hover(filePath, line, col);
                if (!result) {
                    return 'No hover information available at this position.';
                }
                return result;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Completions ──
    registerTool({
        name: 'lsp_completions',
        description: 'Get code completions at a given position. Useful for checking available methods, properties, or API surface of an object. Returns up to 30 completions. Positions are 1-indexed.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            col: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            const line = parseLine(args.line);
            const col = parseCol(args.col);
            try {
                const items = await completions(filePath, line, col);
                if (items.length === 0) {
                    return 'No completions available at this position.';
                }
                const maxShow = 30;
                const shown = items.slice(0, maxShow);
                const formatted = shown.map(formatCompletion).join('\n');
                const suffix = items.length > maxShow
                    ? `\n\n(showing ${maxShow} of ${items.length} completions)`
                    : '';
                return `${shown.length} completion(s):\n${formatted}${suffix}`;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Rename ──
    registerTool({
        name: 'lsp_rename',
        description: 'Rename a symbol across the entire project. Returns a list of all files and edits that would be made. Does NOT apply the edits automatically — review them first. Positions are 1-indexed.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            col: { type: 'number', description: 'Column number (1-indexed)', required: true },
            new_name: { type: 'string', description: 'New name for the symbol', required: true },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            const line = parseLine(args.line);
            const col = parseCol(args.col);
            if (!args.new_name || typeof args.new_name !== 'string') {
                return 'new_name parameter is required and must be a string.';
            }
            const newName = String(args.new_name);
            try {
                const edit = await rename(filePath, line, col, newName);
                if (!edit) {
                    return 'Rename not supported at this position (symbol may not be renameable).';
                }
                const formatted = formatWorkspaceEdit(edit);
                if (formatted === 'No edits.') {
                    return 'No edits produced — the symbol may already have this name or is not renameable.';
                }
                return `Rename edits (preview only — not applied):\n${formatted}`;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Diagnostics ──
    registerTool({
        name: 'lsp_diagnostics',
        description: 'Get diagnostics (errors, warnings, hints) for a source file from the language server. More accurate than text-based linting because it uses the full type system.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            try {
                const diagnostics = await getDiagnostics(filePath);
                return formatDiagnosticsList(filePath, diagnostics);
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Document Symbols ──
    registerTool({
        name: 'lsp_symbols',
        description: 'Get all symbols (functions, classes, interfaces, variables, etc.) defined in a file. Useful for understanding file structure without reading the entire file. Returns a hierarchical list.',
        parameters: {
            file: { type: 'string', description: 'Path to the source file', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const filePath = validateFile(args.file);
            const langErr = checkLanguageSupport(filePath);
            if (langErr)
                return langErr;
            try {
                const symbols = await documentSymbols(filePath);
                if (symbols.length === 0) {
                    return 'No symbols found in this file.';
                }
                const formatted = symbols.map(s => formatSymbol(s)).join('\n');
                return `${symbols.length} top-level symbol(s):\n${formatted}`;
            }
            catch (err) {
                return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=lsp-tools.js.map