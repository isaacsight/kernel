/**
 * File Library — local-first per-user file store.
 *
 * Mirrors ChatGPT's File Library: auto-saves uploaded and created files,
 * lists, searches by name/content, fetches by id. Content-addressed (sha256).
 *
 * Storage layout:
 *   <root>/index.json           — atomic JSON index of entries
 *   <root>/blobs/<id>           — raw file bytes (id = sha256 of contents)
 *
 * Default root: ~/.kbot/files (overridable via KBOT_FILE_LIBRARY_ROOT or ctor opt).
 */
export declare const MAX_FILE_BYTES: number;
export type FileSource = "user-upload" | "agent-output" | "tool-output";
export interface FileEntry {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
    source: FileSource;
    tags: string[];
    path: string;
}
export interface AddFileInput {
    name: string;
    mimeType: string;
    source: FileSource;
    content?: string;
    buffer?: Buffer;
    tags?: string[];
}
export interface ListOptions {
    limit?: number;
    since?: string | Date;
    tag?: string;
}
export type SearchMode = "name" | "content" | "both";
export interface SearchOptions {
    query: string;
    mode: SearchMode;
}
export interface FileLibraryOptions {
    root?: string;
}
export declare class FileLibrary {
    private readonly root;
    private readonly blobsDir;
    private readonly indexPath;
    private writeLock;
    constructor(opts?: FileLibraryOptions);
    getRoot(): string;
    private ensureDirs;
    private readIndex;
    /**
     * Atomic write: serialize → write to <indexPath>.tmp.<rand> → rename.
     */
    private writeIndexAtomic;
    /**
     * Run a read-modify-write of the index under the writeLock so concurrent
     * mutations don't lose updates. The mutator may return a fresh IndexFile
     * (or undefined to skip the write).
     */
    private mutateIndex;
    addFile(input: AddFileInput): Promise<FileEntry>;
    listFiles(opts?: ListOptions): Promise<FileEntry[]>;
    getFile(id: string): Promise<{
        entry: FileEntry;
        buffer: Buffer;
    } | null>;
    removeFile(id: string): Promise<boolean>;
    searchFiles(opts: SearchOptions): Promise<FileEntry[]>;
}
export declare function getDefaultFileLibrary(): FileLibrary;
export declare function _resetDefaultFileLibrary(): void;
//# sourceMappingURL=file-library.d.ts.map