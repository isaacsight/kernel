// kbot Arrangement Engine — Turn any loop into a full song structure
//
// Takes whatever clips exist in slot 0 (scene 1) and builds a complete
// arrangement by duplicating, muting/unmuting, and automating across scenes.
//
// Tool: arrange_song
//
// Supported styles: trap, pop, edm, ambient
// Energy curves: build_drop, steady, wave, climax_end
//
// Requires: AbletonOSC loaded in Ableton Live
import { registerTool } from './index.js';
import { ensureAbleton, formatAbletonError } from '../integrations/ableton-osc.js';
// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function extractArgs(args) {
    return args.map(a => {
        if (a.type === 'b')
            return '[blob]';
        return a.value;
    });
}
const ROLE_KEYWORDS = {
    drums: ['drum', 'kick', 'snare', 'hat', 'hihat', 'hi-hat', 'clap', 'kit', '808', 'perc', 'break'],
    bass: ['bass', 'sub', '808', 'low', 'reese'],
    melody: ['melody', 'lead', 'synth', 'keys', 'piano', 'pluck', 'bell', 'arp'],
    chords: ['chord', 'harmony', 'stab', 'organ'],
    pad: ['pad', 'atmosphere', 'atmo', 'string', 'texture', 'ambient', 'wash'],
    vocal: ['vocal', 'vox', 'voice', 'acapella', 'chant', 'choir'],
    perc: ['perc', 'shaker', 'tamb', 'conga', 'bongo', 'rim', 'wood', 'snap', 'click'],
    fx: ['fx', 'riser', 'sweep', 'impact', 'noise', 'transition', 'reverse', 'whoosh'],
    unknown: [],
};
function classifyTrack(name) {
    const lower = name.toLowerCase();
    // Specific check: "808" alone is bass, not drums
    if (lower === '808' || lower === 'sub 808' || lower === '808 bass')
        return 'bass';
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
        if (role === 'unknown')
            continue;
        for (const kw of keywords) {
            if (lower.includes(kw))
                return role;
        }
    }
    return 'unknown';
}
// ── Song Structures ─────────────────────────────────────────────────────────
function getTrapStructure(totalBars) {
    // Scale sections proportionally if not 64 bars
    const scale = totalBars / 64;
    return [
        {
            name: 'Intro',
            bars: Math.round(4 * scale),
            active: ['melody', 'pad', 'chords', 'fx'],
            volumeOverrides: { melody: 0.6, pad: 0.5 },
            filterSweep: 'up',
            fade: 'in',
            energy: 0.2,
        },
        {
            name: 'Verse 1',
            bars: Math.round(8 * scale),
            active: ['drums', 'bass', 'melody', 'chords'],
            energy: 0.5,
        },
        {
            name: 'Hook',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 0.85,
        },
        {
            name: 'Verse 2',
            bars: Math.round(8 * scale),
            active: ['drums', 'bass', 'melody', 'chords', 'perc', 'vocal'],
            energy: 0.6,
        },
        {
            name: 'Hook 2',
            bars: Math.round(8 * scale),
            active: 'all',
            volumeOverrides: { pad: 0.9, fx: 0.8 },
            energy: 0.95,
        },
        {
            name: 'Bridge',
            bars: Math.round(4 * scale),
            active: ['melody', 'pad', 'chords', 'vocal', 'fx'],
            filterSweep: 'down',
            energy: 0.3,
        },
        {
            name: 'Final Hook',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 1.0,
        },
        {
            name: 'Outro',
            bars: Math.max(Math.round(4 * scale), 2),
            active: ['melody', 'pad'],
            volumeOverrides: { melody: 0.5, pad: 0.4 },
            fade: 'out',
            energy: 0.15,
        },
    ];
}
function getPopStructure(totalBars) {
    const scale = totalBars / 64;
    return [
        {
            name: 'Intro',
            bars: Math.round(4 * scale),
            active: ['chords', 'pad', 'melody'],
            volumeOverrides: { chords: 0.7, melody: 0.5 },
            fade: 'in',
            energy: 0.2,
        },
        {
            name: 'Verse 1',
            bars: Math.round(8 * scale),
            active: ['drums', 'bass', 'chords', 'vocal'],
            volumeOverrides: { drums: 0.8 },
            energy: 0.45,
        },
        {
            name: 'Pre-Chorus',
            bars: Math.round(4 * scale),
            active: ['drums', 'bass', 'chords', 'melody', 'vocal', 'pad'],
            filterSweep: 'up',
            energy: 0.65,
        },
        {
            name: 'Chorus',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 0.9,
        },
        {
            name: 'Verse 2',
            bars: Math.round(8 * scale),
            active: ['drums', 'bass', 'chords', 'vocal', 'perc'],
            energy: 0.5,
        },
        {
            name: 'Pre-Chorus 2',
            bars: Math.round(4 * scale),
            active: ['drums', 'bass', 'chords', 'melody', 'vocal', 'pad', 'perc'],
            filterSweep: 'up',
            energy: 0.7,
        },
        {
            name: 'Chorus 2',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 1.0,
        },
        {
            name: 'Bridge',
            bars: Math.round(4 * scale),
            active: ['pad', 'vocal', 'melody'],
            energy: 0.3,
        },
        {
            name: 'Final Chorus',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 1.0,
        },
        {
            name: 'Outro',
            bars: Math.max(Math.round(4 * scale), 2),
            active: ['chords', 'pad', 'melody'],
            fade: 'out',
            energy: 0.15,
        },
    ];
}
function getEdmStructure(totalBars) {
    const scale = totalBars / 64;
    return [
        {
            name: 'Intro',
            bars: Math.round(8 * scale),
            active: ['drums', 'perc'],
            volumeOverrides: { drums: 0.6 },
            fade: 'in',
            energy: 0.3,
        },
        {
            name: 'Build 1',
            bars: Math.round(4 * scale),
            active: ['drums', 'bass', 'melody', 'fx', 'perc'],
            filterSweep: 'up',
            energy: 0.65,
        },
        {
            name: 'Drop 1',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 1.0,
        },
        {
            name: 'Breakdown',
            bars: Math.round(8 * scale),
            active: ['melody', 'pad', 'chords'],
            volumeOverrides: { melody: 0.7, pad: 0.6 },
            energy: 0.25,
        },
        {
            name: 'Build 2',
            bars: Math.round(4 * scale),
            active: ['drums', 'bass', 'melody', 'pad', 'fx', 'perc'],
            filterSweep: 'up',
            energy: 0.7,
        },
        {
            name: 'Drop 2',
            bars: Math.round(8 * scale),
            active: 'all',
            energy: 1.0,
        },
        {
            name: 'Outro',
            bars: Math.round(8 * scale),
            active: ['drums', 'pad', 'melody'],
            volumeOverrides: { drums: 0.7, pad: 0.5, melody: 0.4 },
            fade: 'out',
            energy: 0.2,
        },
    ];
}
function getAmbientStructure(totalBars) {
    const scale = totalBars / 64;
    return [
        {
            name: 'Emergence',
            bars: Math.round(8 * scale),
            active: ['pad', 'fx'],
            volumeOverrides: { pad: 0.3, fx: 0.2 },
            fade: 'in',
            energy: 0.1,
        },
        {
            name: 'Texture A',
            bars: Math.round(12 * scale),
            active: ['pad', 'melody', 'fx'],
            volumeOverrides: { melody: 0.5 },
            energy: 0.3,
        },
        {
            name: 'Bloom',
            bars: Math.round(8 * scale),
            active: ['pad', 'melody', 'chords', 'fx', 'vocal'],
            energy: 0.5,
        },
        {
            name: 'Peak',
            bars: Math.round(8 * scale),
            active: 'all',
            volumeOverrides: { drums: 0.4, bass: 0.4 },
            energy: 0.7,
        },
        {
            name: 'Texture B',
            bars: Math.round(12 * scale),
            active: ['pad', 'melody', 'chords', 'fx'],
            volumeOverrides: { melody: 0.6 },
            energy: 0.4,
        },
        {
            name: 'Dissolve',
            bars: Math.round(8 * scale),
            active: ['pad', 'fx'],
            volumeOverrides: { pad: 0.4, fx: 0.3 },
            fade: 'out',
            energy: 0.1,
        },
    ];
}
const STRUCTURES = {
    trap: getTrapStructure,
    pop: getPopStructure,
    edm: getEdmStructure,
    ambient: getAmbientStructure,
};
/**
 * Adjust section energies based on a global energy curve.
 * This modulates the volume/intensity of each section relative to its position.
 */
function applyEnergyCurve(sections, curve) {
    const total = sections.length;
    return sections.map((section, i) => {
        const position = i / (total - 1 || 1); // 0 to 1
        let multiplier = 1.0;
        switch (curve) {
            case 'build_drop':
                // Linear build to 75%, then full energy, then sharp drop at end
                if (position < 0.75)
                    multiplier = 0.5 + position * 0.67;
                else if (position < 0.9)
                    multiplier = 1.0;
                else
                    multiplier = 0.4;
                break;
            case 'steady':
                // Minimal variation — keep everything close to the section's natural energy
                multiplier = 0.85 + position * 0.15;
                break;
            case 'wave':
                // Sinusoidal — two energy peaks
                multiplier = 0.6 + 0.4 * Math.sin(position * Math.PI * 2);
                break;
            case 'climax_end':
                // Steady build toward maximum energy at the end
                multiplier = 0.4 + position * 0.6;
                break;
        }
        return {
            ...section,
            energy: Math.max(0.05, Math.min(1.0, section.energy * multiplier)),
        };
    });
}
/**
 * Scan the current Ableton session to discover tracks and their contents.
 */
async function scanSession(osc) {
    const countResult = await osc.query('/live/song/get/num_tracks');
    const trackCount = Number(extractArgs(countResult)[0]) || 0;
    const tracks = [];
    for (let i = 0; i < Math.min(trackCount, 32); i++) {
        try {
            const nameResult = await osc.query('/live/track/get/name', i);
            const name = String(extractArgs(nameResult)[1] || `Track ${i + 1}`);
            const volResult = await osc.query('/live/track/get/volume', i);
            const baseVolume = Number(extractArgs(volResult)[1]) || 0.85;
            let hasClip = false;
            try {
                const clipResult = await osc.query('/live/clip_slot/get/has_clip', i, 0);
                hasClip = Boolean(extractArgs(clipResult)[2]);
            }
            catch { /* no clip */ }
            tracks.push({
                index: i,
                name,
                role: classifyTrack(name),
                hasClipInSlot0: hasClip,
                baseVolume,
            });
        }
        catch {
            break;
        }
    }
    return tracks;
}
// ── Scene Builder ───────────────────────────────────────────────────────────
/**
 * Ensure we have enough scenes. AbletonOSC creates scenes at the end.
 */
async function ensureScenes(osc, needed) {
    const countResult = await osc.query('/live/song/get/num_scenes');
    const current = Number(extractArgs(countResult)[0]) || 1;
    const toCreate = needed - current;
    for (let i = 0; i < toCreate; i++) {
        osc.send('/live/song/create_scene', -1);
        await sleep(100);
    }
}
/**
 * Duplicate a clip from slot 0 to a target slot on a given track.
 * Uses the AbletonOSC duplicate_clip_to endpoint.
 */
async function duplicateClipToSlot(osc, trackIndex, targetSlot) {
    osc.send('/live/clip_slot/duplicate_clip_to', trackIndex, 0, trackIndex, targetSlot);
    await sleep(50);
}
/**
 * Build the full arrangement: duplicate clips, set up mutes, name scenes.
 */
async function buildArrangement(osc, tracks, sections) {
    const tracksWithClips = tracks.filter(t => t.hasClipInSlot0);
    if (tracksWithClips.length === 0) {
        throw new Error('No clips found in scene 1 (slot 0). Create your loop elements in the first scene row, then run arrange_song.');
    }
    const log = [];
    // Calculate total scenes needed (1 scene per section)
    const totalScenes = sections.length;
    log.push(`Creating ${totalScenes} scenes for ${sections.length} sections...`);
    // Ensure we have enough scenes
    await ensureScenes(osc, totalScenes);
    await sleep(300);
    // Name each scene and populate clips
    let currentSceneIndex = 0;
    for (const section of sections) {
        const sceneIdx = currentSceneIndex;
        // Name the scene
        osc.send('/live/scene/set/name', sceneIdx, `${section.name} [${section.bars}b]`);
        await sleep(50);
        // For scene 0 (the source), we don't duplicate — just adjust mutes/volumes.
        // For subsequent scenes, duplicate clips from slot 0.
        if (sceneIdx > 0) {
            for (const track of tracksWithClips) {
                await duplicateClipToSlot(osc, track.index, sceneIdx);
            }
            await sleep(150);
        }
        // Now set clip lengths for this section (loop length = section bars * 4 beats)
        const sectionBeats = section.bars * 4;
        for (const track of tracksWithClips) {
            try {
                // Check the clip exists in this slot before modifying
                const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                if (extractArgs(hasClip)[2]) {
                    // Set loop end to match section length (keep loop start at 0)
                    osc.send('/live/clip/set/loop_end', track.index, sceneIdx, sectionBeats);
                }
            }
            catch { /* skip if clip missing */ }
        }
        // Determine which tracks should be active vs muted in this section
        const activeRoles = section.active;
        for (const track of tracksWithClips) {
            const isActive = activeRoles === 'all' || activeRoles.includes(track.role);
            // We use clip deactivation rather than track muting so we don't
            // affect the source clips. Set the clip's mute state.
            try {
                const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                if (extractArgs(hasClip)[2]) {
                    if (!isActive) {
                        // Mute (deactivate) the clip — sets it to not play when scene launches
                        osc.send('/live/clip/set/muted', track.index, sceneIdx, 1);
                    }
                    else {
                        // Unmute (activate) the clip
                        osc.send('/live/clip/set/muted', track.index, sceneIdx, 0);
                    }
                }
            }
            catch { /* skip */ }
        }
        // Apply per-track volume overrides via clip gain
        // This lets us shape dynamics without destructively changing track volumes
        if (section.volumeOverrides) {
            for (const track of tracksWithClips) {
                const override = section.volumeOverrides[track.role];
                if (override !== undefined) {
                    try {
                        const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                        if (extractArgs(hasClip)[2]) {
                            // Clip gain is in dB: 0 dB = no change. Convert volume 0-1 to dB range.
                            // Simple linear mapping: 1.0 → 0 dB, 0.5 → -6 dB, 0.25 → -12 dB
                            const gainDb = override > 0 ? 20 * Math.log10(override) : -60;
                            osc.send('/live/clip/set/gain', track.index, sceneIdx, Math.max(-40, gainDb));
                        }
                    }
                    catch { /* skip */ }
                }
            }
        }
        // Apply energy-based master volume hint (set all active clips' gain)
        // Energy shapes the overall intensity of each section
        const energyGainDb = section.energy > 0 ? 20 * Math.log10(Math.max(0.1, section.energy)) : -40;
        // Only apply energy gain to tracks without explicit overrides
        for (const track of tracksWithClips) {
            const hasExplicitOverride = section.volumeOverrides?.[track.role] !== undefined;
            const isActive = activeRoles === 'all' || activeRoles.includes(track.role);
            if (isActive && !hasExplicitOverride) {
                try {
                    const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                    if (extractArgs(hasClip)[2]) {
                        // Blend base energy: full energy = 0 dB, low energy = attenuated
                        // Don't attenuate too aggressively — keep it musical
                        const blendedGain = Math.max(-12, energyGainDb * 0.5);
                        if (blendedGain < -1) {
                            osc.send('/live/clip/set/gain', track.index, sceneIdx, blendedGain);
                        }
                    }
                }
                catch { /* skip */ }
            }
        }
        // Apply fade in/out by adjusting first/last clips' gain
        if (section.fade === 'in') {
            // Reduce gain on this section's clips — the "fade in" is a quieter start
            for (const track of tracksWithClips) {
                const isActive = activeRoles === 'all' || activeRoles.includes(track.role);
                if (isActive) {
                    try {
                        const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                        if (extractArgs(hasClip)[2]) {
                            osc.send('/live/clip/set/gain', track.index, sceneIdx, -8); // -8 dB fade-in start
                        }
                    }
                    catch { /* skip */ }
                }
            }
        }
        else if (section.fade === 'out') {
            for (const track of tracksWithClips) {
                const isActive = activeRoles === 'all' || activeRoles.includes(track.role);
                if (isActive) {
                    try {
                        const hasClip = await osc.query('/live/clip_slot/get/has_clip', track.index, sceneIdx);
                        if (extractArgs(hasClip)[2]) {
                            osc.send('/live/clip/set/gain', track.index, sceneIdx, -10); // -10 dB fade-out
                        }
                    }
                    catch { /* skip */ }
                }
            }
        }
        const activeCount = tracksWithClips.filter(t => activeRoles === 'all' || activeRoles.includes(t.role)).length;
        const mutedCount = tracksWithClips.length - activeCount;
        log.push(`  Scene ${sceneIdx + 1}: **${section.name}** — ${section.bars} bars, ${activeCount} active, ${mutedCount} muted (energy: ${(section.energy * 100).toFixed(0)}%)`);
        currentSceneIndex++;
    }
    return log;
}
// ── Tool Registration ───────────────────────────────────────────────────────
export function registerArrangementEngine() {
    registerTool({
        name: 'arrange_song',
        description: [
            'Turn a loop into a full song arrangement in Ableton Live.',
            'Reads all tracks and clips in scene 1 (your loop), then builds a complete',
            'song structure by duplicating clips across scenes, muting/unmuting elements',
            'per section, and applying energy shaping.',
            '',
            'Workflow:',
            '  1. Create your loop elements in scene 1 (row 1) — drums, bass, melody, etc.',
            '  2. Name your tracks descriptively (e.g. "Drums", "808 Bass", "Melody", "Pad")',
            '  3. Run arrange_song to build the full arrangement',
            '  4. Launch scene 1 and let Follow Actions advance through the song',
            '',
            'Track names are classified by role (drums, bass, melody, chords, pad, vocal, perc, fx)',
            'and each section activates/deactivates roles according to the chosen style.',
        ].join('\n'),
        parameters: {
            style: {
                type: 'string',
                description: 'Song structure style: "trap" (verse/hook), "pop" (verse/chorus/bridge), "edm" (build/drop), "ambient" (textural evolution). Default: trap',
            },
            bars: {
                type: 'number',
                description: 'Total song length in bars. Default: 64 (~2 min at 140 BPM). Sections scale proportionally.',
            },
            energy_curve: {
                type: 'string',
                description: 'Global energy envelope: "build_drop" (rises then falls), "steady" (minimal variation), "wave" (two peaks), "climax_end" (builds to finale). Default: build_drop',
            },
        },
        tier: 'free',
        timeout: 60_000,
        async execute(args) {
            const style = String(args.style || 'trap').toLowerCase();
            const totalBars = Number(args.bars) || 64;
            const energyCurve = String(args.energy_curve || 'build_drop').toLowerCase();
            // Validate inputs
            if (!STRUCTURES[style]) {
                return `Unknown style "${style}". Options: ${Object.keys(STRUCTURES).join(', ')}`;
            }
            if (!['build_drop', 'steady', 'wave', 'climax_end'].includes(energyCurve)) {
                return `Unknown energy curve "${energyCurve}". Options: build_drop, steady, wave, climax_end`;
            }
            if (totalBars < 8 || totalBars > 512) {
                return `Bar count must be between 8 and 512. Got: ${totalBars}`;
            }
            try {
                const osc = await ensureAbleton();
                const lines = [];
                lines.push(`## Arrangement Engine`, '');
                lines.push(`- **Style**: ${style}`);
                lines.push(`- **Length**: ${totalBars} bars`);
                lines.push(`- **Energy curve**: ${energyCurve}`);
                lines.push('');
                // Step 1: Scan session
                lines.push('### Scanning session...');
                const tracks = await scanSession(osc);
                const tracksWithClips = tracks.filter(t => t.hasClipInSlot0);
                if (tracksWithClips.length === 0) {
                    return [
                        '## No clips found in scene 1',
                        '',
                        'The arrangement engine needs your loop elements in **scene 1** (the first row of clip slots).',
                        '',
                        'Setup:',
                        '  1. Create clips in scene 1 for each element (drums, bass, melody, etc.)',
                        '  2. Name tracks descriptively — the engine classifies by name',
                        '  3. Run `arrange_song` again',
                        '',
                        `Detected ${tracks.length} tracks: ${tracks.map(t => `${t.name} (${t.role})`).join(', ') || 'none'}`,
                    ].join('\n');
                }
                // Show discovered tracks
                lines.push('');
                lines.push('| Track | Role | Clip in Scene 1 |');
                lines.push('|-------|------|-----------------|');
                for (const track of tracks) {
                    const clipStatus = track.hasClipInSlot0 ? 'Yes' : '-';
                    lines.push(`| ${track.name} | ${track.role} | ${clipStatus} |`);
                }
                lines.push('');
                // Step 2: Generate structure
                let sections = STRUCTURES[style](totalBars);
                sections = applyEnergyCurve(sections, energyCurve);
                // Step 3: Build arrangement
                lines.push('### Building arrangement...');
                lines.push('');
                const buildLog = await buildArrangement(osc, tracks, sections);
                lines.push(...buildLog);
                lines.push('');
                // Summary
                const totalSectionBars = sections.reduce((sum, s) => sum + s.bars, 0);
                const tempoResult = await osc.query('/live/song/get/tempo');
                const bpm = Number(extractArgs(tempoResult)[0]) || 120;
                const durationSec = (totalSectionBars * 4 * 60) / bpm;
                const minutes = Math.floor(durationSec / 60);
                const seconds = Math.round(durationSec % 60);
                lines.push('### Summary');
                lines.push('');
                lines.push(`- **Sections**: ${sections.length}`);
                lines.push(`- **Total bars**: ${totalSectionBars}`);
                lines.push(`- **Duration**: ~${minutes}:${seconds.toString().padStart(2, '0')} at ${bpm} BPM`);
                lines.push(`- **Tracks used**: ${tracksWithClips.length} (with clips)`);
                lines.push('');
                lines.push('**Next steps:**');
                lines.push('- Launch **Scene 1** to start playback');
                lines.push('- Set up **Follow Actions** on each scene to auto-advance');
                lines.push('- Tweak individual clip gains or mutes to taste');
                lines.push('- Add FX automation (filter sweeps, reverb sends) for transitions');
                return lines.join('\n');
            }
            catch (err) {
                return `Arrangement failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
}
//# sourceMappingURL=arrangement-engine.js.map