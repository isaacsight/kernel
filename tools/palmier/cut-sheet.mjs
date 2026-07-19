#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PalmierClient } from "./mcp-client.mjs";

const input = resolve(process.argv[2] ?? "output/what-we-made-v3.mp4");
const projectName = process.argv[3] ?? "what-we-made-v3";
const outputDirectory = resolve(
  process.argv[4] ?? `${dirname(input)}/${basename(input, extname(input))}-cut-review`,
);
const offsets = [-12, -6, -1, 0, 5, 11];
const cutsPerPage = 6;

const client = await PalmierClient.connect();
await client.call("manage_project", { action: "open", name: projectName });
const timeline = await client.call("get_timeline", {});
const sceneTrack = timeline.tracks
  .filter((track) => track.type === "video")
  .sort((a, b) => (b.clips?.length ?? 0) - (a.clips?.length ?? 0))[0];
const scenes = (sceneTrack?.clips ?? [])
  .filter((clip) => clip.mediaType !== "text")
  .sort((a, b) => a.frames[0] - b.frames[0]);
const boundaries = scenes.slice(1).map((clip) => clip.frames[0]);

if (boundaries.length === 0) throw new Error("No scene boundaries found");
mkdirSync(outputDirectory, { recursive: true });

const pages = [];
for (let pageStart = 0; pageStart < boundaries.length; pageStart += cutsPerPage) {
  const pageCuts = boundaries.slice(pageStart, pageStart + cutsPerPage);
  const frames = pageCuts.flatMap((boundary) => offsets.map((offset) => boundary + offset));
  const selection = frames.map((frame) => `eq(n,${frame})`).join("+");
  const pageNumber = Math.floor(pageStart / cutsPerPage) + 1;
  const output = `${outputDirectory}/cuts-${String(pageNumber).padStart(2, "0")}.jpg`;
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vf", `select='${selection}',scale=256:144,tile=6x${pageCuts.length}:padding=5:margin=10:color=0x111111`,
    "-frames:v", "1", output,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited with ${result.status}`);
  pages.push({ output, cuts: pageCuts });
}

console.log(JSON.stringify({ input, project: projectName, offsets, pages }, null, 2));
