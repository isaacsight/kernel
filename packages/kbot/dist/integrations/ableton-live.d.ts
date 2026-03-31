/**
 * ableton-live.ts — kbot ↔ Ableton Live via AbletonOSC (UDP)
 *
 * Provides full Ableton control:
 *   - Transport (play, stop, tempo)
 *   - Tracks (create, name, volume, pan, mute, solo)
 *   - Devices (load any instrument/effect by name)
 *   - Clips (create, add notes, fire, stop)
 *   - Mixing (volume, sends)
 *   - Exec (arbitrary Python inside Ableton's runtime)
 *
 * Requires AbletonOSC installed: kbot ableton setup
 */
export declare class AbletonLive {
    private static instance;
    private socket;
    private connected;
    static getInstance(): AbletonLive;
    connect(): Promise<boolean>;
    disconnect(): void;
    get isConnected(): boolean;
    /** Send OSC message, no response expected. */
    send(addr: string, ...args: (number | string)[]): void;
    /** Send OSC message and wait for response. */
    query(addr: string, ...args: (number | string)[]): Promise<{
        address: string;
        args: (number | string)[];
    }>;
    getTempo(): Promise<number>;
    setTempo(bpm: number): void;
    play(): void;
    stop(): void;
    getTrackCount(): Promise<number>;
    createMidiTrack(name: string): Promise<number>;
    loadDevice(track: number, searchTerm: string): Promise<string>;
    setVolume(track: number, volume: number): void;
    createClip(track: number, slot: number, length: number, name: string): Promise<void>;
    addNote(track: number, slot: number, pitch: number, start: number, duration: number, velocity: number): void;
    fireClip(track: number, slot: number): void;
    /** Execute arbitrary Python in Ableton's runtime. */
    exec(code: string): Promise<string>;
    /** Delete all tracks for a clean slate. */
    clearAllTracks(): Promise<void>;
    /** Get all track names and devices. */
    getSessionInfo(): Promise<Array<{
        index: number;
        name: string;
        devices: string[];
    }>>;
}
export declare function ensureAbleton(): Promise<AbletonLive>;
//# sourceMappingURL=ableton-live.d.ts.map