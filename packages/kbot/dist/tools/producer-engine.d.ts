export interface GenrePreset {
    id: string;
    name: string;
    bpmRange: [number, number];
    preferredKeys: string[];
    preferredScales: string[];
    timeSignature: [number, number];
    feel: 'straight' | 'halftime' | 'shuffle' | 'swing';
    tracks: TrackSpec[];
    progressionStyle: ProgressionStyle;
    drumStyle: DrumStyle;
    mixTemplate: MixTemplate;
    productionNotes: string[];
}
export interface TrackSpec {
    name: string;
    role: 'drums' | 'bass' | 'harmony' | 'melody' | 'pad' | 'perc' | 'fx' | 'vocal';
    instrument: InstrumentChoice;
    midiContent: 'drum_pattern' | 'bass_line' | 'chord_progression' | 'melody' | 'pad_chords' | 'perc_pattern' | 'fx' | 'none';
    color: number;
}
export interface InstrumentChoice {
    primary: string;
    presetHint: string;
    rolandCloud?: string;
    uaAlternative?: string;
    rationale: string;
}
export interface ProgressionStyle {
    namedProgressions: string[];
    romanTemplates: string[];
    voicing: 'close' | 'open' | 'drop2' | 'drop3' | 'spread' | 'shell';
    chordRhythm: string;
    barsPerSection: number;
    octave: number;
}
export interface DrumStyle {
    basePattern: string;
    hihatVelocityCurve: 'flat' | 'accent_downbeat' | 'crescendo_roll' | 'random_humanize';
    ghostNotes: boolean;
    rollProbability: number;
    swing: number;
    layers: DrumLayer[];
}
export interface DrumLayer {
    instrument: string;
    positions: number[];
    velocity: number;
    probability: number;
}
export interface MixTemplate {
    volumes: Record<string, number>;
    panning: Record<string, number>;
    sends: SendConfig[];
    returns: ReturnTrack[];
    masterChain: string[];
    targetLUFS: number;
}
export interface SendConfig {
    fromRole: string;
    toReturn: number;
    level: number;
}
export interface ReturnTrack {
    name: string;
    device: string;
    presetHint: string;
}
export declare const GENRE_PRESETS: Record<string, GenrePreset>;
export declare function registerProducerEngine(): void;
//# sourceMappingURL=producer-engine.d.ts.map