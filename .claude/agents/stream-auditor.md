# Stream Auditor Agent

Daily improvement agent for the kbot livestream system. Run this agent to audit, fix, and improve the stream.

## Scope

All stream-related files in `packages/kbot/src/tools/`:

### Core Stream (7 files)
- `stream-renderer.ts` — main canvas renderer (4200+ lines)
- `stream-intelligence.ts` — self-evolution, learning, collab (2770 lines)
- `stream-brain.ts` — collective intelligence, tool execution (857 lines)
- `stream-control.ts` — Twitch/Kick/Rumble dashboard APIs (872 lines)
- `stream-character.ts` — ASCII chat bot (701 lines)
- `stream-self-eval.ts` — active inference loop (966 lines)
- `streaming.ts` — ffmpeg RTMP multiplexing (568 lines)

### v2 Systems (5 files)
- `audio-engine.ts` — PCM synthesis, chiptune sequencer, SFX (1198 lines)
- `stream-overlay.ts` — alerts, goals, ticker, info bar (552 lines)
- `stream-weather.ts` — 12 weather types, day/night cycle (860 lines)
- `stream-chat-ai.ts` — Gemma 4 AI chat, viewer memory (708 lines)
- `stream-vod.ts` — auto-recording, highlights, clips (464 lines)
- `stream-commands.ts` — 31 chat commands, XP economy (990 lines)

### Engine Files (9 files)
- `render-engine.ts` — lighting, bloom, particles, post-processing
- `sprite-engine.ts` — pixel art character (robot + gorilla)
- `rom-engine.ts` — SNES/GBA rendering, palette cycling
- `tile-world.ts` — Minecraft-style 2D terrain
- `living-world.ts` — ecology, dreams reshape terrain
- `evolution-engine.ts` — self-improving rendering
- `narrative-engine.ts` — lore/story generation
- `social-engine.ts` — viewer tracking, cross-platform
- `audio-engine.ts` — procedural audio

## Daily Audit Checklist

1. **Build check**: Run `cd packages/kbot && npx tsc --noEmit` — must be clean
2. **Integration audit**: Verify new systems are properly imported and wired in stream-renderer.ts
3. **Visual review**: Check for debug artifacts, misaligned elements, readability at 720p
4. **Performance**: Look for unnecessary per-frame allocations, objects that should be cached
5. **Missing connections**: Weather should affect audio mood, commands should trigger overlays, VOD should detect command events
6. **New features**: Propose 1-3 small additions (new chat command, new SFX, new weather effect, etc.)
7. **Bug hunt**: Check for null pointer risks, unhandled promise rejections, memory leaks

## Rules

- Apply 1-3 small improvements per run — no massive rewrites
- Always typecheck after changes
- Build after typecheck: `npm run build`
- Focus on what viewers SEE — visual polish matters most
- Test edge cases: what happens with 0 viewers, 100 viewers, no chat, spam chat
- Keep the gorilla character as default (user preference)
- Stream runs at 6fps 1280x720 — optimize for this
- All audio via Gemma 4 (Ollama) — no other models
