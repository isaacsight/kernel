import { Command } from 'commander';
export interface RecordFrame {
    /** Time offset from recording start, in seconds */
    time: number;
    /** Raw terminal output data */
    data: string;
}
export interface Recording {
    /** Unique recording ID */
    id: string;
    /** Recording title */
    title: string;
    /** ISO timestamp of when the recording started */
    startedAt: string;
    /** Total duration in seconds */
    duration: number;
    /** Terminal columns */
    cols: number;
    /** Terminal rows */
    rows: number;
    /** Captured frames */
    frames: RecordFrame[];
    /** Environment info */
    env: {
        shell: string;
        term: string;
        platform: string;
    };
}
export interface RecordOptions {
    /** Output file path (determines format from extension) */
    output?: string;
    /** Recording title */
    title?: string;
    /** Terminal columns override */
    cols?: number;
    /** Terminal rows override */
    rows?: number;
    /** Shell to spawn (defaults to $SHELL or /bin/bash) */
    shell?: string;
}
export interface SVGOptions {
    /** Color theme */
    theme?: 'dark' | 'light' | 'monokai' | 'dracula';
    /** Terminal width in columns */
    cols?: number;
    /** Terminal height in rows */
    rows?: number;
    /** Font size in pixels */
    fontSize?: number;
    /** Window title */
    title?: string;
    /** Include terminal chrome (title bar, dots) */
    chrome?: boolean;
    /** Playback speed multiplier */
    speed?: number;
    /** Loop animation */
    loop?: boolean;
}
export interface GIFOptions {
    /** Frames per second */
    fps?: number;
    /** Terminal width in columns */
    cols?: number;
    /** Terminal height in rows */
    rows?: number;
    /** Font size in pixels */
    fontSize?: number;
    /** Color theme */
    theme?: 'dark' | 'light' | 'monokai' | 'dracula';
    /** Playback speed multiplier */
    speed?: number;
}
/**
 * Start recording the terminal session.
 *
 * Uses the `script` command (POSIX) to capture all terminal output
 * with timing data. Works on macOS and Linux.
 */
export declare function startRecording(options?: RecordOptions): {
    success: boolean;
    message: string;
    id?: string;
};
/**
 * Stop an active recording session.
 */
export declare function stopRecording(): {
    success: boolean;
    message: string;
    recording?: Recording;
    outputPath?: string;
};
/**
 * Convert a recording to an animated SVG.
 *
 * Produces a self-contained SVG with CSS keyframe animations that
 * replays the terminal session. Compatible with GitHub READMEs,
 * browsers, and any SVG viewer.
 */
export declare function toSVG(recording: Recording, options?: SVGOptions): string;
/**
 * Convert a recording to an animated GIF.
 *
 * Shells out to ImageMagick (`convert`) or `ffmpeg` if available.
 * Falls back to SVG if no image tools are installed.
 *
 * @returns The output file path, or undefined if generation failed.
 */
export declare function toGIF(recording: Recording, outputPath: string, options?: GIFOptions): string | undefined;
/**
 * Convert a recording to asciinema v2 format (.cast).
 *
 * Produces a file compatible with the asciinema player and asciinema.org.
 * Format spec: https://docs.asciinema.org/manual/asciicast/v2/
 */
export declare function toAsciicast(recording: Recording): string;
/**
 * Create a recording programmatically from an array of frames.
 * Useful for generating demo recordings without actually running a shell.
 */
export declare function createRecording(frames: RecordFrame[], options?: {
    title?: string;
    cols?: number;
    rows?: number;
}): Recording;
/**
 * Load a recording by ID or file path.
 */
export declare function loadRecording(idOrPath: string): Recording | null;
/**
 * List all saved recordings.
 */
export declare function listRecordings(): Array<{
    id: string;
    title: string;
    date: string;
    duration: number;
    frames: number;
    size: string;
}>;
/**
 * Delete a recording by ID.
 */
export declare function deleteRecording(id: string): boolean;
/**
 * Replay a recording in the terminal with original timing.
 *
 * @param recording The recording to play back
 * @param speed Playback speed multiplier (2 = double speed)
 * @returns A promise that resolves when playback is complete,
 *          and an abort function to stop early.
 */
export declare function replayInTerminal(recording: Recording, speed?: number): {
    promise: Promise<void>;
    abort: () => void;
};
/**
 * Convert a recording file to a different format.
 */
export declare function convertRecording(inputPath: string, outputPath: string, options?: SVGOptions & GIFOptions): string | undefined;
/**
 * Register the `kbot record` command group with the CLI.
 *
 * Subcommands:
 *   kbot record start [--output <file>] [--title <title>]
 *   kbot record stop
 *   kbot record list
 *   kbot record replay <file> [--speed <multiplier>]
 *   kbot record convert <input> <output> [--theme <theme>]
 *   kbot record delete <id>
 */
export declare function registerRecordCommand(program: Command): void;
//# sourceMappingURL=record.d.ts.map