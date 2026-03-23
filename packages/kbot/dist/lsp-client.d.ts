export interface LspLocation {
    uri: string;
    range: LspRange;
}
export interface LspRange {
    start: LspPosition;
    end: LspPosition;
}
export interface LspPosition {
    line: number;
    character: number;
}
export interface LspDiagnostic {
    range: LspRange;
    severity?: number;
    code?: string | number;
    source?: string;
    message: string;
}
export interface LspSymbol {
    name: string;
    kind: number;
    range: LspRange;
    selectionRange: LspRange;
    children?: LspSymbol[];
}
export interface LspCompletionItem {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: string | {
        kind: string;
        value: string;
    };
    insertText?: string;
}
export interface LspHoverResult {
    contents: string | {
        kind: string;
        value: string;
    } | Array<string | {
        kind: string;
        value: string;
    }>;
    range?: LspRange;
}
export interface LspWorkspaceEdit {
    changes?: Record<string, Array<{
        range: LspRange;
        newText: string;
    }>>;
    documentChanges?: Array<{
        textDocument: {
            uri: string;
            version?: number | null;
        };
        edits: Array<{
            range: LspRange;
            newText: string;
        }>;
    }>;
}
declare class LspConnection {
    private language;
    private command;
    private workspaceRoot;
    private process;
    private buffer;
    private nextId;
    private pending;
    private notificationHandlers;
    private diagnosticsStore;
    private initialized;
    private rootUri;
    constructor(language: string, command: string[], workspaceRoot: string);
    /** Parse complete JSON-RPC messages from the buffer */
    private drainBuffer;
    /** Dispatch an incoming message to the right handler */
    private handleMessage;
    /** Register a handler for a server notification */
    onNotification(method: string, handler: (params: unknown) => void): void;
    /** Send a JSON-RPC request and wait for the response */
    request(method: string, params: unknown): Promise<unknown>;
    /** Send a JSON-RPC notification (no response expected) */
    notify(method: string, params: unknown): void;
    /** Perform the LSP initialize handshake */
    initialize(): Promise<void>;
    /** Tell the server about an opened file */
    didOpen(uri: string, languageId: string, text: string): void;
    /** Get stored diagnostics for a URI */
    getDiagnostics(uri: string): LspDiagnostic[];
    /** Graceful shutdown */
    shutdown(): Promise<void>;
    get isAlive(): boolean;
}
/** Detect language from file extension */
export declare function detectLanguage(filePath: string): string | null;
/**
 * Start or retrieve an LSP server for a given language.
 * Returns null if no server is available.
 */
export declare function startLspServer(language: string): Promise<LspConnection | null>;
/**
 * Get an LSP connection for a file, auto-detecting the language.
 * Opens the file on the server if not already opened.
 */
export declare function getConnectionForFile(filePath: string): Promise<{
    conn: LspConnection;
    uri: string;
    language: string;
} | null>;
/**
 * Go to definition at position.
 * Returns location(s) where the symbol is defined.
 */
export declare function gotoDefinition(filePath: string, line: number, character: number): Promise<LspLocation[]>;
/**
 * Find all references to the symbol at position.
 */
export declare function findReferences(filePath: string, line: number, character: number, includeDeclaration?: boolean): Promise<LspLocation[]>;
/**
 * Get hover information (type, docs) at position.
 */
export declare function hover(filePath: string, line: number, character: number): Promise<string | null>;
/**
 * Get completions at position.
 */
export declare function completions(filePath: string, line: number, character: number): Promise<LspCompletionItem[]>;
/**
 * Rename a symbol across the project.
 * Returns a workspace edit describing all changes.
 */
export declare function rename(filePath: string, line: number, character: number, newName: string): Promise<LspWorkspaceEdit | null>;
/**
 * Get diagnostics for a file.
 * Note: diagnostics arrive asynchronously via notifications.
 * This opens the file and waits briefly for diagnostics to arrive.
 */
export declare function getDiagnostics(filePath: string): Promise<LspDiagnostic[]>;
/**
 * Get document symbols (functions, classes, variables, etc.).
 */
export declare function documentSymbols(filePath: string): Promise<LspSymbol[]>;
/**
 * Shutdown all active LSP servers.
 */
export declare function shutdownAll(): Promise<void>;
/**
 * Get the list of active LSP server languages.
 */
export declare function getActiveServers(): string[];
/** Format an LspLocation for display */
export declare function formatLocation(loc: LspLocation): string;
/** Format locations array for display */
export declare function formatLocations(locations: LspLocation[]): string;
/** Format a diagnostic severity number to a string */
export declare function formatSeverity(severity?: number): string;
/** Format diagnostics for display */
export declare function formatDiagnosticsList(filePath: string, diagnostics: LspDiagnostic[]): string;
/** Format a symbol for display, with indentation for hierarchy */
export declare function formatSymbol(sym: LspSymbol, indent?: number): string;
/** Format a completion item for display */
export declare function formatCompletion(item: LspCompletionItem): string;
/** Format workspace edits into a human-readable summary */
export declare function formatWorkspaceEdit(edit: LspWorkspaceEdit): string;
export {};
//# sourceMappingURL=lsp-client.d.ts.map