#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const input = resolve(process.argv[2] ?? "output/what-we-made-v3.mp4");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} failed`);
  }
  return result.stdout;
}

const probe = JSON.parse(run("ffprobe", [
  "-v", "error",
  "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,duration,nb_frames",
  "-show_entries", "format=duration,size,bit_rate",
  "-of", "json",
  input,
]));

const loudnessOutput = spawnSync("ffmpeg", [
  "-hide_banner", "-nostats", "-i", input,
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
  "-f", "null", "-",
], { encoding: "utf8" });
if (loudnessOutput.status !== 0) throw new Error(loudnessOutput.stderr);
const match = loudnessOutput.stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
const loudness = match ? JSON.parse(match[0]) : null;

const video = probe.streams.find((stream) => stream.codec_type === "video");
const audio = probe.streams.find((stream) => stream.codec_type === "audio");
const report = {
  input,
  video,
  audio,
  format: probe.format,
  loudness,
  checks: {
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    is720p: video?.width === 1280 && video?.height === 720,
    is30fps: video?.r_frame_rate === "30/1",
    is1732Frames: video?.nb_frames === "1732",
    loudnessNearTarget: loudness ? Math.abs(Number(loudness.input_i) + 16) <= 0.5 : false,
    truePeakSafe: loudness ? Number(loudness.input_tp) <= -1 : false,
  },
};

console.log(JSON.stringify(report, null, 2));
if (Object.values(report.checks).some((passed) => !passed)) process.exitCode = 1;
