export interface Diagnostic {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    source: string;
    code?: string;
}
export interface DocumentSymbol {
    name: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    children?: DocumentSymbol[];
}
export interface Location {
    file: string;
    line: number;
    column: number;
}
export interface Range {
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}
export type SymbolKind = 'file' | 'module' | 'namespace' | 'package' | 'class' | 'method' | 'property' | 'field' | 'constructor' | 'enum' | 'interface' | 'function' | 'variable' | 'constant' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'key' | 'null' | 'enum_member' | 'struct' | 'event' | 'operator' | 'type_parameter';
export interface LSPContext {
    /** All current diagnostics across the workspace */
    diagnostics: Diagnostic[];
    /** Document symbols for recently opened files */
    symbols: DocumentSymbol[];
    /** Cached references by "file:line:col" key */
    references: Map<string, Location[]>;
    /** Cached type info by "file:line:col" key */
    typeInfo: Map<string, string>;
    /** Capabilities reported by the language server */
    serverCapabilities: Record<string, boolean>;
}
/**
 * Attach to the appropriate language server for the project.
 *
 * Detects the project type, spawns the right LSP server, initializes
 * the protocol, and begins monitoring diagnostics. Returns the live
 * LSPContext that updates as the server reports new information.
 */
export declare function attachLSP(projectDir: string): Promise<LSPContext>;
/**
 * Get all current diagnostics, optionally filtered to errors/warnings only.
 *
 * Returns a snapshot of diagnostics from the LSP server. Use this
 * to inject context into the agent prompt like:
 * "There are 3 TypeScript errors in src/auth.ts"
 */
export declare function getProactiveDiagnostics(): Diagnostic[];
/**
 * Enrich file content with type information from the LSP.
 *
 * Adds inline type annotations as comments for the agent to understand
 * the code better. Only annotates function signatures and variable
 * declarations to avoid noise.
 */
export declare function enrichFileContext(file: string, content: string): string;
/**
 * Get all references to a symbol at a given position.
 *
 * Use this before modifying a function/variable to understand the
 * blast radius of the change.
 */
export declare function getReferencesForSymbol(file: string, line: number, col: number): Location[];
/**
 * Suggest a fix strategy for a diagnostic.
 *
 * Maps common diagnostic codes to actionable fix descriptions that
 * the agent can use to auto-correct code.
 */
export declare function suggestFix(diagnostic: Diagnostic): string | null;
/**
 * Detach from the language server and clean up resources.
 */
export declare function detachLSP(): void;
/**
 * Format diagnostics as a concise summary for agent context injection.
 *
 * Example output:
 *   "3 errors, 2 warnings in workspace:
 *    ERROR src/auth.ts:42:5 — Property 'token' does not exist on type 'User'
 *    ERROR src/auth.ts:58:12 — Cannot find name 'jwt'
 *    ERROR src/server.ts:15:1 — Module '"./db"' has no exported member 'connect'"
 */
export declare function formatDiagnosticsSummary(diagnostics?: Diagnostic[]): string;
/**
 * Format reference locations for display.
 */
export declare function formatReferences(locations: Location[]): string;
//# sourceMappingURL=lsp-deep.d.ts.map