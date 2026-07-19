#!/usr/bin/env node
import { PalmierClient } from "./mcp-client.mjs";

const projectName = process.argv[2] ?? "what-we-made-v3";
const client = await PalmierClient.connect();
await client.call("manage_project", { action: "open", name: projectName });
const timeline = await client.call("get_timeline", {});

const visualTracks = timeline.tracks.filter((track) => track.type === "video");
const sceneTrack = visualTracks
  .filter((track) => (track.clips?.length ?? 0) > 1)
  .sort((a, b) => (b.clips?.length ?? 0) - (a.clips?.length ?? 0))[0];

const sceneClips = (sceneTrack?.clips ?? [])
  .filter((clip) => clip.mediaType !== "text")
  .sort((a, b) => a.frames[0] - b.frames[0]);
const gaps = [];
const overlaps = [];
for (let index = 1; index < sceneClips.length; index += 1) {
  const previousEnd = sceneClips[index - 1].frames[1];
  const currentStart = sceneClips[index].frames[0];
  if (previousEnd < currentStart) gaps.push([previousEnd, currentStart]);
  if (previousEnd > currentStart) overlaps.push([currentStart, previousEnd]);
}

const speedWarnings = sceneClips
  .filter((clip) => (clip.speed ?? 1) < 0.75 || (clip.speed ?? 1) > 1.35)
  .map((clip) => ({ id: clip.id, frames: clip.frames, speed: clip.speed ?? 1 }));

const linkedAudio = sceneClips
  .filter((clip) => clip.audio)
  .map((clip) => ({
    videoClipId: clip.id,
    audioClipId: clip.audio.id,
    frames: clip.frames,
    audioFrames: clip.audio.frames ?? clip.frames,
    volume: clip.audio.volume ?? clip.volume ?? 1,
    volumeKeyframes: clip.audio.keyframes?.volume ?? clip.keyframes?.volume ?? null,
  }));

const textClips = visualTracks.flatMap((track) =>
  (track.clips ?? [])
    .filter((clip) => clip.mediaType === "text")
    .map((clip) => ({
      id: clip.id,
      track: track.label,
      frames: clip.frames,
      content: clip.textContent,
      animation: clip.textAnimation?.preset ?? "off",
    })),
);

const report = {
  project: projectName,
  timeline: {
    id: timeline.id,
    fps: timeline.fps,
    resolution: `${timeline.width}x${timeline.height}`,
    totalFrames: timeline.totalFrames,
    durationSeconds: timeline.durationSeconds,
  },
  sceneTrack: sceneTrack
    ? { trackId: sceneTrack.trackId, label: sceneTrack.label, sceneCount: sceneClips.length }
    : null,
  sceneSpans: sceneClips.map((clip) => ({
    id: clip.id,
    frames: clip.frames,
    durationFrames: clip.frames[1] - clip.frames[0],
    speed: clip.speed ?? 1,
  })),
  gaps,
  overlaps,
  speedWarnings,
  linkedAudio,
  audioTracks: timeline.tracks
    .filter((track) => track.type === "audio")
    .map((track) => ({
      trackId: track.trackId,
      label: track.label,
      muted: track.muted ?? false,
      clips: track.clips?.length ?? 0,
      linkedClips: track.linkedClips ?? 0,
    })),
  textClips,
};

console.log(JSON.stringify(report, null, 2));
if (!sceneTrack || gaps.length > 0 || overlaps.length > 0) process.exitCode = 1;
