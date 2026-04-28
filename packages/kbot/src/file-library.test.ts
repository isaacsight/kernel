// File Library tests
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  FileLibrary,
  MAX_FILE_BYTES,
  type FileEntry,
} from "./file-library.js";

let tmpRoot: string;
let lib: FileLibrary;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kbot-file-lib-"));
  lib = new FileLibrary({ root: tmpRoot });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("FileLibrary.addFile / getFile round-trip", () => {
  it("round-trips a UTF-8 string", async () => {
    const entry = await lib.addFile({
      name: "hello.txt",
      mimeType: "text/plain",
      source: "user-upload",
      content: "hello world",
    });
    expect(entry.id).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.size).toBe(Buffer.byteLength("hello world", "utf8"));
    expect(entry.path.startsWith(tmpRoot)).toBe(true);

    const got = await lib.getFile(entry.id);
    expect(got).not.toBeNull();
    expect(got!.entry.id).toBe(entry.id);
    expect(got!.buffer.toString("utf8")).toBe("hello world");
  });

  it("round-trips a Buffer (binary)", async () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const entry = await lib.addFile({
      name: "blob.bin",
      mimeType: "application/octet-stream",
      source: "tool-output",
      buffer: buf,
    });
    const got = await lib.getFile(entry.id);
    expect(got).not.toBeNull();
    expect(Buffer.compare(got!.buffer, buf)).toBe(0);
  });

  it("rejects when both content and buffer are provided", async () => {
    await expect(
      lib.addFile({
        name: "x",
        mimeType: "text/plain",
        source: "user-upload",
        content: "a",
        buffer: Buffer.from("b"),
      }),
    ).rejects.toThrow(/content OR buffer/);
  });

  it("rejects when neither content nor buffer is provided", async () => {
    await expect(
      lib.addFile({
        name: "x",
        mimeType: "text/plain",
        source: "user-upload",
      }),
    ).rejects.toThrow(/content or buffer/);
  });

  it("returns null for unknown id", async () => {
    const got = await lib.getFile("0".repeat(64));
    expect(got).toBeNull();
  });
});

describe("FileLibrary.listFiles", () => {
  it("filters by tag and respects `since`", async () => {
    const a = await lib.addFile({
      name: "a.md",
      mimeType: "text/markdown",
      source: "agent-output",
      content: "# A",
      tags: ["draft"],
    });
    // ensure ordering by createdAt
    await new Promise((r) => setTimeout(r, 5));
    const b = await lib.addFile({
      name: "b.md",
      mimeType: "text/markdown",
      source: "agent-output",
      content: "# B",
      tags: ["final"],
    });
    await new Promise((r) => setTimeout(r, 5));
    const c = await lib.addFile({
      name: "c.md",
      mimeType: "text/markdown",
      source: "agent-output",
      content: "# C",
      tags: ["draft", "v2"],
    });

    const drafts = await lib.listFiles({ tag: "draft" });
    expect(drafts.map((e) => e.id).sort()).toEqual([a.id, c.id].sort());

    const sinceB = await lib.listFiles({ since: b.createdAt });
    const ids = sinceB.map((e) => e.id);
    expect(ids).toContain(b.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(a.id);

    const all = await lib.listFiles({});
    // newest first
    expect(all[0].id).toBe(c.id);
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      // distinct content => distinct ids
      // eslint-disable-next-line no-await-in-loop
      await lib.addFile({
        name: `f${i}.txt`,
        mimeType: "text/plain",
        source: "user-upload",
        content: `payload-${i}`,
      });
    }
    const first2 = await lib.listFiles({ limit: 2 });
    expect(first2).toHaveLength(2);
  });
});

describe("FileLibrary.searchFiles", () => {
  let mdEntry: FileEntry;
  let pngEntry: FileEntry;
  let textWithFooEntry: FileEntry;

  beforeEach(async () => {
    mdEntry = await lib.addFile({
      name: "Meeting-Notes.md",
      mimeType: "text/markdown",
      source: "user-upload",
      content: "Action items:\n- ship the FOO feature\n- tidy code",
    });
    pngEntry = await lib.addFile({
      name: "diagram-foo.png",
      mimeType: "image/png",
      source: "user-upload",
      // arbitrary bytes — content search must skip non-text mimes
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]),
    });
    textWithFooEntry = await lib.addFile({
      name: "log.txt",
      mimeType: "text/plain",
      source: "tool-output",
      content: "the FOO bar baz",
    });
  });

  it("name mode: substring case-insensitive", async () => {
    const hits = await lib.searchFiles({ query: "meeting", mode: "name" });
    expect(hits.map((e) => e.id)).toEqual([mdEntry.id]);
  });

  it("content mode: matches text mimes, skips binary", async () => {
    const hits = await lib.searchFiles({ query: "foo", mode: "content" });
    const ids = hits.map((e) => e.id).sort();
    expect(ids).toEqual([mdEntry.id, textWithFooEntry.id].sort());
    expect(ids).not.toContain(pngEntry.id);
  });

  it("both mode: union deduped by id", async () => {
    const hits = await lib.searchFiles({ query: "foo", mode: "both" });
    const ids = hits.map((e) => e.id);
    // png matches by name, md+txt match by content; all three appear
    expect(new Set(ids)).toEqual(
      new Set([mdEntry.id, pngEntry.id, textWithFooEntry.id]),
    );
    // dedup: each id once
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("empty query returns nothing", async () => {
    const hits = await lib.searchFiles({ query: "", mode: "both" });
    expect(hits).toEqual([]);
  });
});

describe("FileLibrary 50 MB cap", () => {
  it("rejects buffers larger than 50 MB with a clear error", async () => {
    // Allocate just over the cap. Use Buffer.alloc with a fill to avoid uninitialized memory cost.
    const oversized = Buffer.alloc(MAX_FILE_BYTES + 1, 0);
    await expect(
      lib.addFile({
        name: "huge.bin",
        mimeType: "application/octet-stream",
        source: "user-upload",
        buffer: oversized,
      }),
    ).rejects.toThrow(/50 MB cap/);
  });

  it("accepts buffers exactly at the cap", async () => {
    // Allocate exactly the cap; should succeed but is heavy. Skip the round-trip read for speed.
    const atCap = Buffer.alloc(MAX_FILE_BYTES, 0);
    const entry = await lib.addFile({
      name: "cap.bin",
      mimeType: "application/octet-stream",
      source: "user-upload",
      buffer: atCap,
    });
    expect(entry.size).toBe(MAX_FILE_BYTES);
  });
});

describe("FileLibrary atomic index update", () => {
  it("index.json remains valid JSON after sequential writes", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      const e = await lib.addFile({
        name: `seq-${i}.txt`,
        mimeType: "text/plain",
        source: "agent-output",
        content: `seq-${i}-${Math.random()}`,
      });
      ids.push(e.id);
    }
    const raw = await fs.readFile(path.join(tmpRoot, "index.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.length).toBe(10);
  });

  it("concurrent adds all land safely in the index (no corruption)", async () => {
    const adds = Array.from({ length: 12 }).map((_, i) =>
      lib.addFile({
        name: `c-${i}.txt`,
        mimeType: "text/plain",
        source: "agent-output",
        content: `concurrent-${i}-${Math.random()}`,
      }),
    );
    const entries = await Promise.all(adds);
    const raw = await fs.readFile(path.join(tmpRoot, "index.json"), "utf8");
    const parsed = JSON.parse(raw); // must be parseable
    expect(parsed.version).toBe(1);
    const indexedIds = new Set<string>(
      parsed.entries.map((e: FileEntry) => e.id),
    );
    for (const e of entries) {
      expect(indexedIds.has(e.id)).toBe(true);
    }
    // No leftover .tmp files
    const rootFiles = await fs.readdir(tmpRoot);
    expect(rootFiles.some((f) => f.startsWith("index.json.tmp"))).toBe(false);
  });

  it("survives a simulated mid-write: pre-existing tmp file does not corrupt readable index", async () => {
    // Seed a real entry first so index.json exists.
    await lib.addFile({
      name: "seed.txt",
      mimeType: "text/plain",
      source: "user-upload",
      content: "seed",
    });
    // Drop a junk tmp file as if a previous write was interrupted.
    const junkTmp = path.join(tmpRoot, "index.json.tmp.broken");
    await fs.writeFile(junkTmp, "{ this is not valid json", "utf8");
    // Subsequent add must still produce a parseable index.json.
    await lib.addFile({
      name: "after.txt",
      mimeType: "text/plain",
      source: "user-upload",
      content: "after",
    });
    const raw = await fs.readFile(path.join(tmpRoot, "index.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.entries.length).toBe(2);
  });
});

describe("FileLibrary.removeFile", () => {
  it("removes the entry from the index and the blob from disk", async () => {
    const entry = await lib.addFile({
      name: "to-remove.txt",
      mimeType: "text/plain",
      source: "user-upload",
      content: "bye",
    });
    // blob should exist
    await expect(fs.access(entry.path)).resolves.toBeUndefined();

    const removed = await lib.removeFile(entry.id);
    expect(removed).toBe(true);

    // blob gone
    await expect(fs.access(entry.path)).rejects.toThrow();

    // index no longer lists it
    const list = await lib.listFiles({});
    expect(list.find((e) => e.id === entry.id)).toBeUndefined();

    // get returns null
    const got = await lib.getFile(entry.id);
    expect(got).toBeNull();
  });

  it("returns false for unknown id", async () => {
    const removed = await lib.removeFile("0".repeat(64));
    expect(removed).toBe(false);
  });
});

describe("FileLibrary env override", () => {
  it("respects KBOT_FILE_LIBRARY_ROOT for default-rooted instances", async () => {
    const customRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "kbot-file-lib-env-"),
    );
    try {
      const prev = process.env.KBOT_FILE_LIBRARY_ROOT;
      process.env.KBOT_FILE_LIBRARY_ROOT = customRoot;
      try {
        const envLib = new FileLibrary();
        expect(envLib.getRoot()).toBe(customRoot);
      } finally {
        if (prev === undefined) delete process.env.KBOT_FILE_LIBRARY_ROOT;
        else process.env.KBOT_FILE_LIBRARY_ROOT = prev;
      }
    } finally {
      await fs.rm(customRoot, { recursive: true, force: true });
    }
  });
});
