/**
 * kbot-auto-mixer.js -- Node for Max auto-mix analysis engine
 *
 * Runs inside Ableton on the Master track. Periodically analyzes all tracks
 * and provides mix recommendations to kbot via the bridge WebSocket.
 *
 * This Node for Max script handles:
 *   - Periodic meter polling (configurable interval)
 *   - Frequency collision detection heuristics
 *   - LUFS estimation from peak/RMS data
 *   - Sidechain recommendation logic
 *   - Communication with kbot-bridge.js (same WebSocket, namespaced actions)
 *
 * The actual LOM access (reading meters, setting EQ params) happens in
 * kbot-bridge-lom.js via the mixerAnalyze/mixerAutoMix actions.
 * This script adds higher-level analysis on top.
 */

const maxApi = require("max-api");

// ── Configuration ──────────────────────────────────────────────────────────

const ANALYSIS_INTERVAL = 2000;  // ms between analysis cycles (when active)
const METER_SMOOTHING = 0.3;     // EMA smoothing factor for meter readings
const COLLISION_THRESHOLD = 6;   // dB above which two tracks "collide"

// ── State ──────────────────────────────────────────────────────────────────

let isActive = false;
let analysisTimer = null;
let trackHistory = new Map();  // track_index -> { meterHistory: [], avgRms: number }
let mode = "passive";          // "passive" | "active"
let targetLufs = -14;          // streaming default

// ── Mix Analysis Engine ────────────────────────────────────────────────────

/**
 * Frequency role classification based on track name heuristics.
 * Since we can't do real FFT in Node for Max (no audio access),
 * we classify tracks by name and apply genre-aware EQ rules.
 */
const ROLE_PATTERNS = {
    kick:    /kick|kik|bd|bassdrum/i,
    bass:    /bass|808|sub|low/i,
    snare:   /snare|snr|sd|clap/i,
    hihat:   /hi.?hat|hh|hat|cymbal|ride/i,
    drums:   /drum|perc|kit/i,
    vocal:   /vox|vocal|voice|acapella/i,
    melody:  /melody|mel|lead|synth/i,
    pad:     /pad|atmosphere|ambient|atmo/i,
    keys:    /piano|keys|organ|rhodes|wurlitzer/i,
    guitar:  /guitar|gtr|guit/i,
    fx:      /fx|effect|riser|impact|sweep/i
};

function classifyTrack(name) {
    var nameLower = name.toLowerCase();
    for (var role in ROLE_PATTERNS) {
        if (ROLE_PATTERNS[role].test(nameLower)) {
            return role;
        }
    }
    return "other";
}

/**
 * Frequency ranges where each role lives.
 * Used for collision detection.
 */
const ROLE_FREQUENCY_RANGES = {
    kick:    { low: 30,  high: 120,  peak: 60  },
    bass:    { low: 30,  high: 200,  peak: 80  },
    snare:   { low: 150, high: 5000, peak: 200 },
    hihat:   { low: 3000,high: 16000,peak: 8000},
    drums:   { low: 30,  high: 16000,peak: 500 },
    vocal:   { low: 80,  high: 8000, peak: 2000},
    melody:  { low: 200, high: 8000, peak: 1000},
    pad:     { low: 100, high: 8000, peak: 500 },
    keys:    { low: 100, high: 8000, peak: 1000},
    guitar:  { low: 80,  high: 6000, peak: 800 },
    fx:      { low: 200, high: 16000,peak: 4000},
    other:   { low: 20,  high: 20000,peak: 1000}
};

/**
 * Recommended HP filter frequencies by role.
 */
const HP_FILTER_RECOMMENDATIONS = {
    kick:    20,   // Don't filter kick
    bass:    20,   // Don't filter bass
    snare:   100,
    hihat:   500,
    drums:   20,
    vocal:   80,
    melody:  120,
    pad:     100,
    keys:    80,
    guitar:  80,
    fx:      200,
    other:   60
};

/**
 * Detect frequency collisions between track pairs.
 * Returns an array of collision descriptions.
 */
function detectCollisions(tracks) {
    var collisions = [];

    for (var i = 0; i < tracks.length; i++) {
        for (var j = i + 1; j < tracks.length; j++) {
            var roleA = classifyTrack(tracks[i].name);
            var roleB = classifyTrack(tracks[j].name);

            var rangeA = ROLE_FREQUENCY_RANGES[roleA];
            var rangeB = ROLE_FREQUENCY_RANGES[roleB];

            // Check for overlap
            var overlapLow  = Math.max(rangeA.low, rangeB.low);
            var overlapHigh = Math.min(rangeA.high, rangeB.high);

            if (overlapLow < overlapHigh) {
                // There's frequency overlap
                var overlapRatio = (overlapHigh - overlapLow) / Math.min(rangeA.high - rangeA.low, rangeB.high - rangeB.low);

                // Both tracks are loud -> collision
                if (tracks[i].rms_db > -20 && tracks[j].rms_db > -20 && overlapRatio > 0.3) {
                    var severity = "low";
                    if (overlapRatio > 0.6 && Math.abs(tracks[i].rms_db - tracks[j].rms_db) < 6) {
                        severity = "high";
                    } else if (overlapRatio > 0.4) {
                        severity = "medium";
                    }

                    collisions.push({
                        track_a: { index: tracks[i].index, name: tracks[i].name, role: roleA },
                        track_b: { index: tracks[j].index, name: tracks[j].name, role: roleB },
                        frequency_range: overlapLow + "-" + overlapHigh + " Hz",
                        severity: severity,
                        suggestion: getSuggestion(roleA, roleB, overlapLow, overlapHigh)
                    });
                }
            }
        }
    }

    return collisions;
}

function getSuggestion(roleA, roleB, freqLow, freqHigh) {
    // Kick + Bass collision
    if ((roleA === "kick" && roleB === "bass") || (roleA === "bass" && roleB === "kick")) {
        return "Sidechain compress the bass to the kick, or cut bass at kick fundamental (" + freqLow + "-" + Math.min(freqHigh, 120) + " Hz)";
    }
    // Vocal + melody collision
    if ((roleA === "vocal" && roleB === "melody") || (roleA === "melody" && roleB === "vocal")) {
        return "Cut melody at 2-4 kHz to make room for vocals, or automate melody volume down during vocal phrases";
    }
    // Generic
    return "EQ carve: cut " + roleB + " at " + Math.round((freqLow + freqHigh) / 2) + " Hz to make room for " + roleA;
}

/**
 * Generate HP filter recommendations for each track.
 */
function getHPRecommendations(tracks) {
    var recs = [];
    for (var i = 0; i < tracks.length; i++) {
        var role = classifyTrack(tracks[i].name);
        var hpFreq = HP_FILTER_RECOMMENDATIONS[role];

        if (hpFreq > 20 && !tracks[i].mute) {
            recs.push({
                track: tracks[i].index,
                name: tracks[i].name,
                role: role,
                hp_frequency: hpFreq,
                reason: "Remove sub-bass rumble below " + hpFreq + " Hz (not needed for " + role + " role)"
            });
        }
    }
    return recs;
}

/**
 * Estimate LUFS from peak meter values.
 * This is a rough approximation -- real LUFS requires integrated loudness measurement
 * over time, which we can't do from LOM meter values alone.
 */
function estimateLufs(peakDb) {
    // Rough mapping: Ableton's meter is peak, LUFS is integrated.
    // Typically LUFS is 8-12 dB below peak for dynamic music.
    // For compressed modern music, gap is smaller (3-6 dB).
    return peakDb - 8;  // Conservative estimate
}

// ── Communication with kbot-bridge ─────────────────────────────────────────

/**
 * Request analysis data from kbot-bridge-lom.js.
 * Sends a message to Max outlet, which gets routed to the bridge.
 */
function requestAnalysis() {
    maxApi.outlet("analyze_request");
}

/**
 * Receive analysis data from kbot-bridge-lom.js.
 */
maxApi.addHandler("analysis_data", (dataJson) => {
    try {
        var data = JSON.parse(dataJson);
        processAnalysis(data);
    } catch (e) {
        maxApi.post("kbot auto-mixer: analysis parse error: " + e.message);
    }
});

function processAnalysis(data) {
    if (!data || !data.tracks) return;

    var tracks = data.tracks;

    // Classify tracks
    for (var i = 0; i < tracks.length; i++) {
        tracks[i].role = classifyTrack(tracks[i].name);
    }

    // Detect collisions
    var collisions = detectCollisions(tracks);

    // HP filter recommendations
    var hpRecs = getHPRecommendations(tracks);

    // LUFS estimation
    var masterDb = data.master ? data.master.rms_db : -100;
    var estimatedLufs = estimateLufs(masterDb);
    var lufsCorrection = targetLufs - estimatedLufs;

    // Build full report
    var report = {
        tracks: tracks.map(function(t) {
            return {
                index: t.index,
                name: t.name,
                role: t.role,
                volume: t.volume,
                rms_db: t.rms_db,
                mute: t.mute,
                solo: t.solo,
                issues: t.issues || []
            };
        }),
        collisions: collisions,
        hp_recommendations: hpRecs,
        master: {
            rms_db: masterDb,
            estimated_lufs: Math.round(estimatedLufs * 10) / 10,
            target_lufs: targetLufs,
            lufs_correction_db: Math.round(lufsCorrection * 10) / 10
        },
        mode: mode,
        summary: buildSummary(collisions, hpRecs, lufsCorrection)
    };

    // Send report to Max (which forwards to kbot-bridge for WebSocket delivery)
    maxApi.outlet("mix_report", JSON.stringify(report));

    // In active mode, apply automatic corrections
    if (mode === "active") {
        applyCorrections(report);
    }
}

function buildSummary(collisions, hpRecs, lufsCorrection) {
    var lines = [];

    if (collisions.length > 0) {
        var highCount = collisions.filter(function(c) { return c.severity === "high"; }).length;
        lines.push(collisions.length + " frequency collisions detected" + (highCount > 0 ? " (" + highCount + " severe)" : ""));
    }

    if (hpRecs.length > 0) {
        lines.push(hpRecs.length + " tracks need HP filters");
    }

    if (Math.abs(lufsCorrection) > 2) {
        if (lufsCorrection < 0) {
            lines.push("Master is " + Math.abs(Math.round(lufsCorrection)) + " dB above target LUFS -- reduce levels");
        } else {
            lines.push("Master is " + Math.round(lufsCorrection) + " dB below target LUFS -- boost levels");
        }
    }

    if (lines.length === 0) {
        lines.push("Mix looks clean -- no major issues detected");
    }

    return lines;
}

function applyCorrections(report) {
    // In active mode, send correction commands back through the bridge
    // This would set EQ parameters, adjust volumes, etc.
    // For safety, we only make gentle corrections (< 3dB per cycle)

    var corrections = [];

    // LUFS correction (gentle)
    if (Math.abs(report.master.lufs_correction_db) > 2) {
        var correction = Math.max(-3, Math.min(3, report.master.lufs_correction_db * 0.3));
        corrections.push({
            action: "adjust_master_volume",
            correction_db: correction
        });
    }

    if (corrections.length > 0) {
        maxApi.outlet("apply_corrections", JSON.stringify(corrections));
    }
}

// ── Control Messages ───────────────────────────────────────────────────────

maxApi.addHandler("set_mode", (newMode) => {
    mode = newMode;
    maxApi.post("kbot auto-mixer: mode set to " + mode);
    if (mode === "active" && !analysisTimer) {
        startAnalysisLoop();
    }
});

maxApi.addHandler("set_target_lufs", (lufs) => {
    targetLufs = Number(lufs);
    maxApi.post("kbot auto-mixer: target LUFS set to " + targetLufs);
});

maxApi.addHandler("start", () => {
    isActive = true;
    startAnalysisLoop();
    maxApi.post("kbot auto-mixer: analysis started");
});

maxApi.addHandler("stop", () => {
    isActive = false;
    if (analysisTimer) {
        clearInterval(analysisTimer);
        analysisTimer = null;
    }
    maxApi.post("kbot auto-mixer: analysis stopped");
});

function startAnalysisLoop() {
    if (analysisTimer) clearInterval(analysisTimer);
    analysisTimer = setInterval(() => {
        if (isActive) requestAnalysis();
    }, ANALYSIS_INTERVAL);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

maxApi.post("kbot auto-mixer: Node for Max script loaded");
maxApi.outlet("status", "ready");
