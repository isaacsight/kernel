/**
 * File Library tool definitions.
 *
 * These mirror ChatGPT's File Library surface: add, list, search, get.
 * Definitions only — NOT registered here. Wire-up belongs in tools/index.ts.
 */

import {
  FileLibrary,
  getDefaultFileLibrary,
  type FileEntry,
  type FileSource,
  type SearchMode,
} from "../file-library.js";
import type { ToolDefinition } from "./index.js";

const VALID_SOURCES: FileSource[] = [
  "user-upload",
  "agent-output",
  "tool-output",
];

function lib(): FileLibrary {
  return getDefaultFileLibrary();
}

function asString(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function fmtEntry(e: FileEntry): Record<string, unknown> {
  return {
    id: e.id,
    name: e.name,
    mimeType: e.mimeType,
    size: e.size,
    createdAt: e.createdAt,
    source: e.source,
    tags: e.tags,
  };
}

export const fileLibraryAddTool: ToolDefinition = {
  name: "file_library_add",
  description:
    "Save a file into the local File Library. Provide content (utf8 string) or base64-encoded bytes. Returns the new entry id and metadata.",
  tier: "free",
  parameters: {
    name: {
      type: "string",
      description: "File name (e.g. 'report.md')",
      required: true,
    },
    mimeType: {
      type: "string",
      description: "MIME type (e.g. 'text/markdown', 'application/pdf')",
      required: true,
    },
    source: {
      type: "string",
      description: "Origin: 'user-upload' | 'agent-output' | 'tool-output'",
      required: true,
    },
    content: {
      type: "string",
      description: "UTF-8 text content. Omit if using contentBase64.",
    },
    contentBase64: {
      type: "string",
      description: "Base64-encoded bytes. Omit if using content.",
    },
    tags: {
      type: "array",
      description: "Optional tags",
      items: { type: "string" },
    },
  },
  async execute(args) {
    const name = asString(args.name);
    const mimeType = asString(args.mimeType);
    const sourceRaw = asString(args.source) as FileSource;
    if (!VALID_SOURCES.includes(sourceRaw)) {
      return `Error: source must be one of ${VALID_SOURCES.join(", ")}`;
    }
    const content =
      args.content === undefined ? undefined : asString(args.content);
    const contentBase64 =
      args.contentBase64 === undefined
        ? undefined
        : asString(args.contentBase64);
    if (
      (content === undefined && contentBase64 === undefined) ||
      (content !== undefined && contentBase64 !== undefined)
    ) {
      return "Error: provide exactly one of `content` or `contentBase64`";
    }
    const tags = Array.isArray(args.tags)
      ? args.tags.filter((t): t is string => typeof t === "string")
      : undefined;
    try {
      const entry =
        contentBase64 !== undefined
          ? await lib().addFile({
              name,
              mimeType,
              source: sourceRaw,
              buffer: Buffer.from(contentBase64, "base64"),
              tags,
            })
          : await lib().addFile({
              name,
              mimeType,
              source: sourceRaw,
              content,
              tags,
            });
      return JSON.stringify(fmtEntry(entry), null, 2);
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  },
};

export const fileLibraryListTool: ToolDefinition = {
  name: "file_library_list",
  description:
    "List files in the File Library, newest first. Optional filters: limit, since (ISO date), tag.",
  tier: "free",
  parameters: {
    limit: { type: "number", description: "Max entries to return" },
    since: {
      type: "string",
      description: "ISO 8601 date — only entries created at or after this time",
    },
    tag: { type: "string", description: "Filter to entries that have this tag" },
  },
  async execute(args) {
    const limit =
      typeof args.limit === "number" ? (args.limit as number) : undefined;
    const since = args.since === undefined ? undefined : asString(args.since);
    const tag = args.tag === undefined ? undefined : asString(args.tag);
    try {
      const entries = await lib().listFiles({ limit, since, tag });
      return JSON.stringify(
        { count: entries.length, entries: entries.map(fmtEntry) },
        null,
        2,
      );
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  },
};

export const fileLibrarySearchTool: ToolDefinition = {
  name: "file_library_search",
  description:
    "Search the File Library. Modes: 'name' (substring on name), 'content' (substring on text contents), 'both' (union).",
  tier: "free",
  parameters: {
    query: { type: "string", description: "Substring to match", required: true },
    mode: {
      type: "string",
      description: "'name' | 'content' | 'both'",
      required: true,
    },
  },
  async execute(args) {
    const query = asString(args.query);
    const mode = asString(args.mode) as SearchMode;
    if (mode !== "name" && mode !== "content" && mode !== "both") {
      return "Error: mode must be 'name' | 'content' | 'both'";
    }
    try {
      const entries = await lib().searchFiles({ query, mode });
      return JSON.stringify(
        { count: entries.length, entries: entries.map(fmtEntry) },
        null,
        2,
      );
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  },
};

export const fileLibraryGetTool: ToolDefinition = {
  name: "file_library_get",
  description:
    "Fetch a file by id. For text mimes returns utf-8 content; for binary returns base64.",
  tier: "free",
  parameters: {
    id: { type: "string", description: "File id (sha256 hex)", required: true },
    encoding: {
      type: "string",
      description: "'utf8' | 'base64' (default: auto by mimeType)",
    },
  },
  async execute(args) {
    const id = asString(args.id);
    const encodingArg =
      args.encoding === undefined ? undefined : asString(args.encoding);
    try {
      const got = await lib().getFile(id);
      if (!got) return `Error: file not found: ${id}`;
      const { entry, buffer } = got;
      const isText = /^text\//i.test(entry.mimeType) ||
        /^application\/(json|yaml|x-yaml|xml|javascript|typescript)$/i.test(
          entry.mimeType,
        );
      const encoding =
        encodingArg === "utf8" || encodingArg === "base64"
          ? encodingArg
          : isText
          ? "utf8"
          : "base64";
      const content =
        encoding === "utf8" ? buffer.toString("utf8") : buffer.toString("base64");
      return JSON.stringify(
        { entry: fmtEntry(entry), encoding, content },
        null,
        2,
      );
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  },
};
