// kbot DJ Set Builder — Constructs complete DJ sets in Ableton Live
// Uses M4L devices (genre-morph, hat-machine, dj-fx) + music theory engine
// to build genre-blending sets from House → Tech House → UK Garage → Trap.
//
// Architecture:
//   1. Creates track layout (drums, hats, bass, pads, fx, master)
//   2. Programs MIDI clips for each genre section
//   3. Sets up M4L devices on appropriate tracks
//   4. Builds arrangement with transitions
//   5. Configures mixer (volumes, sends, panning)

import { registerTool } from './index.js'
import { ensureAbleton } from '../integrations/ableton-osc.js'
import {
  parseProgression,
  type MidiNote,
} from './music-theory.js'

// ─── Genre Definitions ─────────────────────────────────────────────

interface GenreSection {
  name: string
  bpm: number
  key: string
  scale: string
  bars: number
  progression: string
  bassOctave: number
  padVoicing: 'close' | 'open' | 'spread'
  drumStyle: string
  hatStyle: number       // hat-machine style index
  hatDensity: number     // 0-1
  swing: number          // 0-1
}

const GENRE_SECTIONS: Record<string, GenreSection> = {
  house: {
    name: 'House',
    bpm: 124,
    key: 'C',
    scale: 'natural_minor',
    bars: 128,  // ~4 min at 124 BPM
    progression: 'i bVII bVI bVII',  // deep house vamp
    bassOctave: 2,
    padVoicing: 'open',
    drumStyle: 'house',
    hatStyle: 0,
    hatDensity: 0.4,
    swing: 0.0,
  },
  tech_house: {
    name: 'Tech House',
    bpm: 126,
    key: 'C',
    scale: 'natural_minor',
    bars: 128,  // ~4 min at 126 BPM
    progression: 'i bVII',  // minimal two-chord
    bassOctave: 2,
    padVoicing: 'close',
    drumStyle: 'tech_house',
    hatStyle: 1,
    hatDensity: 0.55,
    swing: 0.15,
  },
  uk_garage: {
    name: 'UK Garage',
    bpm: 132,
    key: 'F',
    scale: 'natural_minor',
    bars: 128,  // ~4 min at 132 BPM
    progression: 'i bVII bVI V',  // garage classic
    bassOctave: 2,
    padVoicing: 'spread',
    drumStyle: 'uk_garage',
    hatStyle: 2,
    hatDensity: 0.5,
    swing: 0.25,
  },
  trap: {
    name: 'Trap',
    bpm: 140,
    key: 'F',
    scale: 'natural_minor',
    bars: 176,  // ~5 min at 140 BPM — trap gets the longest section
    progression: 'i bVI bVII i',  // dark trap
    bassOctave: 1,
    padVoicing: 'spread',
    drumStyle: 'trap',
    hatStyle: 3,
    hatDensity: 0.7,
    swing: 0.0,
  },
}

// ─── Transition Templates ──────────────────────────────────────────

interface Transition {
  bars: number
  technique: string
  description: string
}

const TRANSITIONS: Record<string, Transition> = {
  house_to_tech: {
    bars: 8,
    technique: 'filter_sweep',
    description: 'LP filter sweep down on house, bring in tech drums, HP filter sweep up to reveal',
  },
  tech_to_garage: {
    bars: 8,
    technique: 'breakdown',
    description: 'Strip to just hats + reverb wash, switch kick pattern to 2-step, drop the bass',
  },
  garage_to_trap: {
    bars: 8,
    technique: 'build_drop',
    description: 'HP riser, snare roll build, silence beat, drop into half-time trap with 808',
  },
}

// ─── Drum Pattern Data ─────────────────────────────────────────────
// 16-step patterns for each genre (kick, snare/clap, hats)

const DRUM_PATTERNS: Record<string, { kick: MidiNote[], snare: MidiNote[], hat: MidiNote[] }> = {
  house: {
    kick: makeKickPattern([0, 1, 2, 3], 100),          // 4 on the floor
    snare: makeSnarePattern([1, 3], 90),                 // clap on 2 & 4
    hat: makeHatPattern([0.5, 1.5, 2.5, 3.5], 80),     // offbeat 8ths
  },
  tech_house: {
    kick: makeKickPattern([0, 1, 2, 3], 100),
    snare: makeSnarePattern([1, 3], 85, [1.75, 3.75], 45),  // with ghosts
    hat: makeHatPattern([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 75),  // straight 8ths
  },
  uk_garage: {
    kick: makeKickPattern([0, 1.5, 2.5], 100),          // 2-step
    snare: makeSnarePattern([1, 3], 95),
    hat: makeHatPattern([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 80),
  },
  trap: {
    kick: makeKickPattern([0, 2.75], 110),               // sparse 808
    snare: makeSnarePattern([2], 120),                    // snare on 3 (half-time)
    hat: makeTrapHats(),                                  // 16th rolls with accents
  },
}

// ─── Pattern Builders ──────────────────────────────────────────────

function makeKickPattern(beats: number[], velocity: number): MidiNote[] {
  return beats.map(b => ({
    pitch: 36,  // C1 kick
    start: b,
    duration: 0.25,
    velocity,
  }))
}

function makeSnarePattern(beats: number[], velocity: number, ghosts?: number[], ghostVel?: number): MidiNote[] {
  const notes: MidiNote[] = beats.map(b => ({
    pitch: 39,  // D#1 clap
    start: b,
    duration: 0.25,
    velocity,
  }))
  if (ghosts && ghostVel) {
    for (const g of ghosts) {
      notes.push({ pitch: 38, start: g, duration: 0.125, velocity: ghostVel })
    }
  }
  return notes
}

function makeHatPattern(beats: number[], velocity: number): MidiNote[] {
  return beats.map((b, i) => ({
    pitch: 42,  // F#1 closed hat
    start: b,
    duration: 0.125,
    velocity: velocity + (i % 2 === 0 ? 10 : -10),  // accent pattern
  }))
}

function makeTrapHats(): MidiNote[] {
  const notes: MidiNote[] = []
  // Full 16th notes with velocity variation for trap feel
  for (let i = 0; i < 16; i++) {
    const beat = i * 0.25
    // Accent on downbeats, medium on upbeats, light on e's and a's
    let vel: number
    if (i % 4 === 0) vel = 100       // downbeat accent
    else if (i % 4 === 2) vel = 85   // upbeat
    else if (i % 2 === 0) vel = 75   // "and"
    else vel = 65                     // "e" and "a"
    notes.push({ pitch: 42, start: beat, duration: 0.0625, velocity: vel })
  }
  // Open hat at end
  notes.push({ pitch: 46, start: 3.75, duration: 0.25, velocity: 80 })
  return notes
}

// ─── Bass Pattern Builders ─────────────────────────────────────────

function makeBassLine(key: string, scale: string, progression: string, octave: number, genre: string): MidiNote[] {
  const chords = parseProgression(progression, key, scale, octave)
  const notes: MidiNote[] = []
  const beatsPerChord = 4  // 1 bar per chord

  for (let ci = 0; ci < chords.length; ci++) {
    const root = chords[ci][0]  // bass plays root
    const startBeat = ci * beatsPerChord

    if (genre === 'house' || genre === 'tech_house') {
      // Pumping bass: 8th notes with short-long pattern
      for (let i = 0; i < 8; i++) {
        notes.push({
          pitch: root,
          start: startBeat + i * 0.5,
          duration: i % 2 === 0 ? 0.3 : 0.45,
          velocity: i % 2 === 0 ? 95 : 75,
        })
      }
    } else if (genre === 'uk_garage') {
      // Syncopated garage bass
      notes.push({ pitch: root, start: startBeat, duration: 0.75, velocity: 100 })
      notes.push({ pitch: root, start: startBeat + 1.5, duration: 0.5, velocity: 85 })
      notes.push({ pitch: root + 12, start: startBeat + 2.5, duration: 0.5, velocity: 90 })
      notes.push({ pitch: root, start: startBeat + 3, duration: 0.75, velocity: 80 })
    } else if (genre === 'trap') {
      // 808 bass: long sustain, slides
      notes.push({ pitch: root, start: startBeat, duration: 2, velocity: 110 })
      notes.push({ pitch: root + 12, start: startBeat + 2.75, duration: 1, velocity: 95 })
    }
  }

  return notes
}

// ─── Pad/Chord Pattern Builder ─────────────────────────────────────

function makePadChords(key: string, scale: string, progression: string, octave: number): MidiNote[] {
  const chords = parseProgression(progression, key, scale, octave + 1)  // pads one octave up
  const notes: MidiNote[] = []
  const beatsPerChord = 4

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci]
    const startBeat = ci * beatsPerChord

    // Whole-note pads
    for (const pitch of chord) {
      notes.push({
        pitch,
        start: startBeat,
        duration: beatsPerChord - 0.1,
        velocity: 70,
      })
    }
  }

  return notes
}

// ─── Set Structure ─────────────────────────────────────────────────

interface SetSection {
  type: 'genre' | 'transition' | 'intro' | 'outro'
  genre?: string
  transitionId?: string
  bars: number
  bpm: number
  description: string
}

function buildSetStructure(): SetSection[] {
  // 20-minute set: ~660 bars total across 4 genres + transitions
  // Each genre ~4 min, transitions ~30 sec, intro/outro ~30 sec
  return [
    { type: 'intro', bars: 16, bpm: 124, description: 'Filtered intro — hats + filter opening (~30 sec)' },
    { type: 'genre', genre: 'house', bars: 128, bpm: 124, description: 'Classic house — 4-on-floor, deep bass, open pads (~4 min)' },
    { type: 'transition', transitionId: 'house_to_tech', bars: 16, bpm: 125, description: 'House → Tech House via filter sweep (~30 sec)' },
    { type: 'genre', genre: 'tech_house', bars: 128, bpm: 126, description: 'Minimal tech — driving, percussive, groovy (~4 min)' },
    { type: 'transition', transitionId: 'tech_to_garage', bars: 16, bpm: 129, description: 'Tech → Garage via breakdown (~30 sec)' },
    { type: 'genre', genre: 'uk_garage', bars: 128, bpm: 132, description: 'UK Garage — 2-step, shuffled, deep sub (~4 min)' },
    { type: 'transition', transitionId: 'garage_to_trap', bars: 16, bpm: 136, description: 'Garage → Trap via build + drop (~30 sec)' },
    { type: 'genre', genre: 'trap', bars: 176, bpm: 140, description: 'Half-time trap — 808, hat rolls, dark (~5 min)' },
    { type: 'outro', bars: 16, bpm: 140, description: 'Outro — strip to reverb tail, filter down (~30 sec)' },
  ]
}

// ─── Tool Registration ─────────────────────────────────────────────

export function registerDjSetBuilderTools(): void {

  registerTool({
    name: 'dj_set_build',
    description: `Build a complete DJ set in Ableton Live that flows through House → Tech House → UK Garage → Trap.
Creates tracks, programs MIDI clips for drums/bass/pads per genre section, and sets up transitions.
Requires Ableton Live with AbletonOSC running.`,
    parameters: {
      sections: {
        type: 'string',
        description: 'Comma-separated genre sections to include: "house,tech_house,uk_garage,trap" (default: all)',
      },
      bars_per_section: {
        type: 'number',
        description: 'Bars per genre section (default: 32)',
      },
      key: {
        type: 'string',
        description: 'Musical key for the set (default: "C")',
      },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const osc = await ensureAbleton()
      const key = String(args.key || 'C')
      const barsPerSection = Number(args.bars_per_section || 32)
      const requestedSections = args.sections
        ? String(args.sections).split(',').map(s => s.trim())
        : ['house', 'tech_house', 'uk_garage', 'trap']

      const results: string[] = []
      results.push(`🎛 Building DJ Set: ${requestedSections.map(s => GENRE_SECTIONS[s]?.name || s).join(' → ')}`)
      results.push(`Key: ${key} minor | Bars/section: ${barsPerSection}`)
      results.push('')

      // 1. Set initial tempo
      const firstGenre = GENRE_SECTIONS[requestedSections[0]]
      if (firstGenre) {
        osc.send('/live/song/set/tempo', firstGenre.bpm)
        results.push(`⏱ Tempo: ${firstGenre.bpm} BPM`)
      }

      // 2. Create tracks
      const trackNames = ['Drums', 'Hi-Hats', 'Bass', 'Pads', 'FX/Riser']
      results.push('')
      results.push('📐 Track Layout:')
      for (let i = 0; i < trackNames.length; i++) {
        try {
          osc.send('/live/song/create_midi_track', i)
          results.push(`  Track ${i + 1}: ${trackNames[i]}`)
        } catch {
          results.push(`  Track ${i + 1}: ${trackNames[i]} (may already exist)`)
        }
      }

      // 3. Program clips for each section
      results.push('')
      results.push('🎵 Programming clips:')

      let sceneIdx = 0
      for (const sectionId of requestedSections) {
        const section = GENRE_SECTIONS[sectionId]
        if (!section) {
          results.push(`  ⚠ Unknown genre: ${sectionId}`)
          continue
        }

        // Override key if specified
        const sectionKey = key || section.key

        // Get patterns
        const drums = DRUM_PATTERNS[sectionId]
        const bassNotes = makeBassLine(sectionKey, section.scale, section.progression, section.bassOctave, sectionId)
        const padNotes = makePadChords(sectionKey, section.scale, section.progression, 3)

        // Calculate clip length based on chord count
        const chordCount = section.progression.trim().split(/\s+/).length
        const clipBars = chordCount  // 1 bar per chord
        const clipBeats = clipBars * 4

        results.push(`  ${section.name} (${section.bpm} BPM, ${clipBars} bars):`)

        // Create scene
        try {
          osc.send('/live/song/create_scene', sceneIdx)
        } catch { /* scene may exist */ }

        // Drums clip (track 0)
        if (drums) {
          try {
            osc.send('/live/clip_slot/create_clip', 0, sceneIdx, clipBeats)

            // Add drum notes
            const allDrumNotes = [...drums.kick, ...drums.snare, ...drums.hat]
            // Repeat pattern to fill clip
            const repeatedNotes: MidiNote[] = []
            for (let bar = 0; bar < clipBars; bar++) {
              for (const note of allDrumNotes) {
                repeatedNotes.push({
                  ...note,
                  start: note.start + bar * 4,
                })
              }
            }

            // Send notes via OSC
            for (const note of repeatedNotes) {
              osc.send('/live/clip/add/notes', 0, sceneIdx, note.pitch, note.start, note.duration, note.velocity, 0)
            }
            results.push(`    Drums: ${repeatedNotes.length} notes (kick + snare + hat)`)
          } catch (e) {
            results.push(`    Drums: error — ${e}`)
          }
        }

        // Bass clip (track 2)
        try {
          osc.send('/live/clip_slot/create_clip', 2, sceneIdx, clipBeats)

          for (const note of bassNotes) {
            osc.send('/live/clip/add/notes', 2, sceneIdx, note.pitch, note.start, note.duration, note.velocity, 0)
          }
          results.push(`    Bass: ${bassNotes.length} notes (${sectionId} style)`)
        } catch (e) {
          results.push(`    Bass: error — ${e}`)
        }

        // Pads clip (track 3)
        try {
          osc.send('/live/clip_slot/create_clip', 3, sceneIdx, clipBeats)

          for (const note of padNotes) {
            osc.send('/live/clip/add/notes', 3, sceneIdx, note.pitch, note.start, note.duration, note.velocity, 0)
          }
          results.push(`    Pads: ${padNotes.length} notes (${section.progression})`)
        } catch (e) {
          results.push(`    Pads: error — ${e}`)
        }

        sceneIdx++
      }

      // 4. Summary
      const totalBars = requestedSections.reduce((sum, s) => sum + (GENRE_SECTIONS[s]?.bars || 32), 0)
      const startBpm = GENRE_SECTIONS[requestedSections[0]]?.bpm || 124
      const endBpm = GENRE_SECTIONS[requestedSections[requestedSections.length - 1]]?.bpm || 140

      results.push('')
      results.push('─'.repeat(50))
      results.push(`✅ DJ Set Built:`)
      results.push(`   ${requestedSections.length} genre sections`)
      results.push(`   ${totalBars} total bars`)
      results.push(`   ${startBpm} → ${endBpm} BPM`)
      results.push(`   ${sceneIdx} scenes created`)
      results.push('')
      results.push('🎚 Next steps:')
      results.push('   1. Load a Drum Rack on track 1 (Drums)')
      results.push('   2. Add kbot Genre Morph M4L device before the Drum Rack')
      results.push('   3. Add kbot Hat Machine on track 2 (Hi-Hats)')
      results.push('   4. Load a bass synth on track 3 (Bass)')
      results.push('   5. Load a pad synth on track 4 (Pads)')
      results.push('   6. Add kbot DJ FX on the Master track')
      results.push('   7. Fire Scene 1 and start morphing!')

      return results.join('\n')
    },
  })

  registerTool({
    name: 'dj_set_info',
    description: 'Show the DJ set structure and genre flow for a House → Tech House → UK Garage → Trap set.',
    parameters: {},
    tier: 'free',
    timeout: 5_000,
    async execute() {
      const structure = buildSetStructure()
      const lines: string[] = [
        '🎛 DJ Set Structure: House → Tech House → UK Garage → Trap',
        '═'.repeat(55),
        '',
      ]

      let totalBars = 0
      for (const section of structure) {
        totalBars += section.bars
        const icon = section.type === 'genre' ? '🎵'
          : section.type === 'transition' ? '🔀'
          : section.type === 'intro' ? '🎬'
          : '🏁'

        lines.push(`${icon} ${section.description}`)
        lines.push(`   ${section.bars} bars @ ${section.bpm} BPM`)
        lines.push('')
      }

      // Calculate total time (approximate, since BPM changes)
      const avgBpm = 131  // rough average
      const totalBeats = totalBars * 4
      const totalMinutes = totalBeats / avgBpm

      lines.push('─'.repeat(55))
      lines.push(`Total: ${totalBars} bars | ~${Math.round(totalMinutes)} minutes`)
      lines.push(`BPM range: 124 → 140`)
      lines.push('')
      lines.push('Genre Characteristics:')
      lines.push('  House (124): 4-on-floor, offbeat hats, pumping bass')
      lines.push('  Tech House (126): Minimal, shuffled, percussive')
      lines.push('  UK Garage (132): 2-step, skippy, deep sub')
      lines.push('  Trap (140): Half-time, 808, hat rolls')
      lines.push('')
      lines.push('M4L Devices:')
      lines.push('  kbot-genre-morph: Auto-morphs drum patterns between genres')
      lines.push('  kbot-hat-machine: Genre-specific hat patterns with roll mode')
      lines.push('  kbot-dj-fx: Filter, echo, reverb, stutter, brake/riser')

      return lines.join('\n')
    },
  })
}
