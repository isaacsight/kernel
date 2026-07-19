#!/usr/bin/env node
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const output = resolve(process.argv[2] ?? "output/audio/what-we-made-workshop-bed.wav");
const duration = Number(process.argv[3] ?? 57.733333);
const targetLufs = Number(process.env.PALMIER_BED_LUFS ?? -42);

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited with ${result.status}`);
  return result;
}

function parseLoudnorm(stderr) {
  const blocks = [...stderr.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^\"]+"[\s\S]*?\}/g)];
  if (blocks.length === 0) throw new Error("Could not parse loudnorm measurements");
  return JSON.parse(blocks.at(-1)[0]);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "palmier-room-bed-"));
const raw = join(temporaryDirectory, "room-bed-raw.wav");
const mastered = join(temporaryDirectory, "room-bed-mastered.wav");
const noise = (color, seed) =>
  `anoisesrc=color=${color}:amplitude=0.15:sample_rate=44100:duration=${duration}:seed=${seed}`;

try {
  ffmpeg([
    "-y",
    "-f", "lavfi", "-i", noise("pink", 31415),
    "-f", "lavfi", "-i", noise("pink", 92653),
    "-f", "lavfi", "-i", `sine=frequency=55:sample_rate=44100:duration=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=82.41:sample_rate=44100:duration=${duration}`,
    "-filter_complex", [
      "[0:a]highpass=f=90,lowpass=f=3600,volume=0.30,tremolo=f=0.10:d=0.20[left]",
      "[1:a]highpass=f=110,lowpass=f=3000,volume=0.27,tremolo=f=0.11:d=0.18[right]",
      "[left][right]amerge=inputs=2[air]",
      "[2:a]volume=0.010,tremolo=f=0.12:d=0.35[hum]",
      "[3:a]volume=0.004,tremolo=f=0.10:d=0.25[tone]",
      "[hum][tone]amix=inputs=2:normalize=0,pan=stereo|c0=c0|c1=c0[drone]",
      `[air][drone]amix=inputs=2:normalize=0,highpass=f=28,lowpass=f=4800,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, duration - 2)}:d=2,alimiter=limit=0.5[out]`,
    ].join(";"),
    "-map", "[out]",
    "-c:a", "pcm_s24le",
    raw,
  ]);

  const firstPass = ffmpeg([
    "-i", raw,
    "-af", `loudnorm=I=${targetLufs}:TP=-6:LRA=7:print_format=json`,
    "-f", "null", "-",
  ]);
  const measured = parseLoudnorm(firstPass.stderr);
  const filter = [
    `loudnorm=I=${targetLufs}`,
    "TP=-6",
    "LRA=7",
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
  ].join(":");
  ffmpeg(["-y", "-i", raw, "-af", filter, "-c:a", "pcm_s24le", mastered]);

  mkdirSync(dirname(output), { recursive: true });
  renameSync(mastered, output);
  console.log(JSON.stringify({ output, duration, targetLufs, measured }, null, 2));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
