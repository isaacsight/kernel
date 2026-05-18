import { type Candidate } from './corpus.js';
export interface ArtifactContext {
    /** Path to the artifact on disk (used in placeholders) */
    path: string;
    /** Display path used in the briefing (often the GitHub link) */
    link: string;
    /** Subject phrase describing the artifact ("the agentic engineering field map") */
    subject: string;
    /** License string ("CC BY 4.0", "MIT", etc.) */
    license: string;
    /** Free-form context for templates that need extra prose */
    context?: string;
}
export interface ExploreOptions {
    corpusPath: string;
    artifact: ArtifactContext;
    outputPath: string;
    /** Match candidates whose tags overlap with any of these. */
    tags: string[];
    /** Don't include candidates pitched within this many days (default 14). */
    recencyDays?: number;
    /** Override the date used for recency comparison (default: now). Useful in tests. */
    now?: Date;
    /** Optional tier label to assign to every candidate in the produced briefing. */
    tier?: string;
    /** Optional briefing title override; default derives from artifact name + date. */
    briefingTitle?: string;
}
export interface ExploreResult {
    /** Candidates considered after tag + recency filtering */
    considered: Candidate[];
    /** Candidates excluded by recency window */
    excludedByRecency: Candidate[];
    /** Candidates with no matching tags */
    excludedByTags: Candidate[];
    /** Path the briefing was written to */
    briefingPath: string;
}
export declare function explore(options: ExploreOptions): ExploreResult;
//# sourceMappingURL=explore.d.ts.map