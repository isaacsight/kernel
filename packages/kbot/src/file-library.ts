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

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type FileSource = "user-upload" | "agent-output" | "tool-output";

export interface FileEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string; // ISO 8601
  source: FileSource;
  tags: string[];
  path: string; // absolute path on disk
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

interface IndexFile {
  version: 1;
  entries: FileEntry[];
}

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "application/xml",
  "application/javascript",
  "application/typescript",
]);

function isTextMime(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  if (TEXT_MIME_EXACT.has(m)) return true;
  return TEXT_MIME_PREFIXES.some((p) => m.startsWith(p));
}

function defaultRoot(): string {
  const env = process.env.KBOT_FILE_LIBRARY_ROOT;
  if (env && env.length > 0) return env;
  return path.join(os.homedir(), ".kbot", "files");
}

export class FileLibrary {
  private readonly root: string;
  private readonly blobsDir: string;
  private readonly indexPath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(opts: FileLibraryOptions = {}) {
    this.root = opts.root ?? defaultRoot();
    this.blobsDir = path.join(this.root, "blobs");
    this.indexPath = path.join(this.root, "index.json");
  }

  getRoot(): string {
    return this.root;
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.blobsDir, { recursive: true });
  }

  private async readIndex(): Promise<IndexFile> {
    try {
      const raw = await fs.readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw) as IndexFile;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
        return { version: 1, entries: [] };
      }
      return parsed;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return { version: 1, entries: [] };
      throw err;
    }
  }

  /**
   * Atomic write: serialize → write to <indexPath>.tmp.<rand> → rename.
   */
  private async writeIndexAtomic(idx: IndexFile): Promise<void> {
    await this.ensureDirs();
    const tmp = `${this.indexPath}.tmp.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const data = JSON.stringify(idx, null, 2);
    await fs.writeFile(tmp, data, { encoding: "utf8" });
    await fs.rename(tmp, this.indexPath);
  }

  /**
   * Run a read-modify-write of the index under the writeLock so concurrent
   * mutations don't lose updates. The mutator may return a fresh IndexFile
   * (or undefined to skip the write).
   */
  private async mutateIndex<T>(
    fn: (idx: IndexFile) => Promise<{ next?: IndexFile; result: T }> | { next?: IndexFile; result: T },
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const idx = await this.readIndex();
      const out = await fn(idx);
      if (out.next) await this.writeIndexAtomic(out.next);
      return out.result;
    };
    const next = this.writeLock.then(run, run);
    // Don't poison the lock chain on error.
    this.writeLock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async addFile(input: AddFileInput): Promise<FileEntry> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("file-library: name is required");
    }
    if (!input.mimeType) {
      throw new Error("file-library: mimeType is required");
    }
    if (input.content === undefined && input.buffer === undefined) {
      throw new Error("file-library: provide content or buffer");
    }
    if (input.content !== undefined && input.buffer !== undefined) {
      throw new Error("file-library: provide content OR buffer, not both");
    }

    const buf =
      input.buffer !== undefined
        ? input.buffer
        : Buffer.from(input.content as string, "utf8");

    if (buf.byteLength > MAX_FILE_BYTES) {
      throw new Error(
        `file-library: file exceeds 50 MB cap (${buf.byteLength} bytes > ${MAX_FILE_BYTES})`,
      );
    }

    const id = createHash("sha256").update(buf).digest("hex");
    await this.ensureDirs();
    const blobPath = path.join(this.blobsDir, id);

    // Write blob if not already present (content-addressed dedup).
    try {
      await fs.access(blobPath);
    } catch {
      const tmp = `${blobPath}.tmp.${process.pid}.${Date.now()}`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, blobPath);
    }

    const entry: FileEntry = {
      id,
      name: input.name,
      mimeType: input.mimeType,
      size: buf.byteLength,
      createdAt: new Date().toISOString(),
      source: input.source,
      tags: [...(input.tags ?? [])],
      path: blobPath,
    };

    return this.mutateIndex((idx) => {
      // If an entry with this id already exists, replace it (latest metadata wins,
      // since the blob bytes are identical by id).
      const filtered = idx.entries.filter((e) => e.id !== id);
      filtered.push(entry);
      return { next: { version: 1, entries: filtered }, result: entry };
    });
  }

  async listFiles(opts: ListOptions = {}): Promise<FileEntry[]> {
    const idx = await this.readIndex();
    let entries = idx.entries.slice();

    if (opts.tag) {
      const tag = opts.tag;
      entries = entries.filter((e) => e.tags.includes(tag));
    }
    if (opts.since !== undefined) {
      const sinceMs =
        opts.since instanceof Date
          ? opts.since.getTime()
          : new Date(opts.since).getTime();
      if (!Number.isNaN(sinceMs)) {
        entries = entries.filter(
          (e) => new Date(e.createdAt).getTime() >= sinceMs,
        );
      }
    }
    // Newest first.
    entries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (typeof opts.limit === "number" && opts.limit >= 0) {
      entries = entries.slice(0, opts.limit);
    }
    return entries;
  }

  async getFile(
    id: string,
  ): Promise<{ entry: FileEntry; buffer: Buffer } | null> {
    const idx = await this.readIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    try {
      const buffer = await fs.readFile(entry.path);
      return { entry, buffer };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return null;
      throw err;
    }
  }

  async removeFile(id: string): Promise<boolean> {
    const removedEntry = await this.mutateIndex<FileEntry | null>((idx) => {
      const entry = idx.entries.find((e) => e.id === id);
      if (!entry) return { result: null };
      const remaining = idx.entries.filter((e) => e.id !== id);
      return {
        next: { version: 1, entries: remaining },
        result: entry,
      };
    });
    if (!removedEntry) return false;
    try {
      await fs.unlink(removedEntry.path);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "ENOENT") throw err;
    }
    return true;
  }

  async searchFiles(opts: SearchOptions): Promise<FileEntry[]> {
    const q = (opts.query ?? "").toLowerCase();
    if (q.length === 0) return [];
    const idx = await this.readIndex();
    const entries = idx.entries;

    const matchName = (e: FileEntry) => e.name.toLowerCase().includes(q);

    const matchContent = async (e: FileEntry): Promise<boolean> => {
      if (!isTextMime(e.mimeType)) return false;
      try {
        const buf = await fs.readFile(e.path);
        return buf.toString("utf8").toLowerCase().includes(q);
      } catch (err) {
        const ne = err as NodeJS.ErrnoException;
        if (ne.code === "ENOENT") return false;
        throw err;
      }
    };

    const seen = new Set<string>();
    const out: FileEntry[] = [];

    if (opts.mode === "name" || opts.mode === "both") {
      for (const e of entries) {
        if (matchName(e) && !seen.has(e.id)) {
          seen.add(e.id);
          out.push(e);
        }
      }
    }
    if (opts.mode === "content" || opts.mode === "both") {
      for (const e of entries) {
        if (seen.has(e.id)) continue;
        // eslint-disable-next-line no-await-in-loop
        const hit = await matchContent(e);
        if (hit) {
          seen.add(e.id);
          out.push(e);
        }
      }
    }

    out.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return out;
  }
}

// Singleton helper for default root usage.
let _default: FileLibrary | null = null;
export function getDefaultFileLibrary(): FileLibrary {
  if (!_default) _default = new FileLibrary();
  return _default;
}

// Reset the cached default — primarily for tests that mutate env.
export function _resetDefaultFileLibrary(): void {
  _default = null;
}
