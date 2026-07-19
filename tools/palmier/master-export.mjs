#!/usr/bin/env node
import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const input = resolve(process.argv[2] ?? "output/what-we-made-v3-raw-ambience.mp4");
const output = resolve(process.argv[3] ?? input);
const targetI = Number(process.env.PALMIER_TARGET_I ?? -16);
const targetTp = Number(process.env.PALMIER_TARGET_TP ?? -1.5);
const targetLra = Number(process.env.PALMIER_TARGET_LRA ?? 11);

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg exited with ${result.status}`);
  }
  return result;
}

function parseLoudnorm(stderr) {
  const blocks = [...stderr.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^\"]+"[\s\S]*?\}/g)];
  if (blocks.length === 0) throw new Error("Could not parse loudnorm measurements");
  return JSON.parse(blocks.at(-1)[0]);
}

const firstPass = ffmpeg([
  "-i", input,
  "-map", "0:a:0",
  "-af", `loudnorm=I=${targetI}:TP=${targetTp}:LRA=${targetLra}:print_format=json`,
  "-f", "null",
  "-",
]);
const measured = parseLoudnorm(firstPass.stderr);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "palmier-master-"));
const extension = extname(output) || ".mp4";
const temporaryOutput = join(temporaryDirectory, `${basename(output, extension)}-mastered${extension}`);
const filter = [
  `loudnorm=I=${targetI}`,
  `TP=${targetTp}`,
  `LRA=${targetLra}`,
  `measured_I=${measured.input_i}`,
  `measured_TP=${measured.input_tp}`,
  `measured_LRA=${measured.input_lra}`,
  `measured_thresh=${measured.input_thresh}`,
  `offset=${measured.target_offset}`,
  "linear=true",
  "print_format=summary",
].join(":");

try {
  ffmpeg([
    "-y",
    "-i", input,
    "-map", "0:v:0",
    "-map", "0:a:0",
    "-c:v", "copy",
    "-af", filter,
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-movflags", "+faststart",
    temporaryOutput,
  ]);
  renameSync(temporaryOutput, output);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({
  input,
  output,
  target: { integratedLufs: targetI, truePeakDb: targetTp, loudnessRangeLu: targetLra },
  measured,
}, null, 2));
