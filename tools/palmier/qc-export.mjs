#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const input = resolve(process.argv[2] ?? "output/what-we-made-v3.mp4");
const profileName = process.argv[3] ?? "web";
const profiles = {
  web: { resolutions: ["1280x720", "1920x1080", "2560x1440", "3840x2160"], fps: ["24/1", "25/1", "30/1", "30000/1001", "60/1", "60000/1001"], targetI: -16, tolerance: 1, maxTruePeak: -1 },
  social: { resolutions: ["1080x1080", "1080x1920"], fps: ["30/1", "30000/1001", "60/1", "60000/1001"], targetI: -14, tolerance: 1, maxTruePeak: -1 },
  broadcast: { resolutions: ["1920x1080", "3840x2160"], fps: ["24/1", "25/1", "30/1", "30000/1001", "50/1", "60/1", "60000/1001"], targetI: -23, tolerance: 0.5, maxTruePeak: -1 },
};
const profile = profiles[profileName];
if (!profile) throw new Error(`Unknown QC profile "${profileName}". Use: ${Object.keys(profiles).join(", ")}`);

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
  "-af", `loudnorm=I=${profile.targetI}:TP=${profile.maxTruePeak}:LRA=11:print_format=json`,
  "-f", "null", "-",
], { encoding: "utf8" });
if (loudnessOutput.status !== 0) throw new Error(loudnessOutput.stderr);
const match = loudnessOutput.stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
const loudness = match ? JSON.parse(match[0]) : null;

const video = probe.streams.find((stream) => stream.codec_type === "video");
const audio = probe.streams.find((stream) => stream.codec_type === "audio");
const report = {
  input,
  profile: profileName,
  video,
  audio,
  format: probe.format,
  loudness,
  checks: {
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    approvedDimensions: profile.resolutions.includes(`${video?.width}x${video?.height}`),
    approvedFrameRate: profile.fps.includes(video?.r_frame_rate),
    durationReadable: Number(probe.format.duration) > 0,
    loudnessNearTarget: loudness ? Math.abs(Number(loudness.input_i) - profile.targetI) <= profile.tolerance : false,
    truePeakSafe: loudness ? Number(loudness.input_tp) <= profile.maxTruePeak : false,
  },
};

console.log(JSON.stringify(report, null, 2));
if (Object.values(report.checks).some((passed) => !passed)) process.exitCode = 1;
