export type ChannelKind = 'email' | 'linkedin' | 'bluesky' | 'mastodon' | 'x' | 'web' | 'other';
export type ChannelConfidence = 'verified' | 'medium' | 'low';
export interface ContactChannel {
    kind: ChannelKind;
    /** Email address (if kind=email), handle (linkedin/bluesky/mastodon/x), or URL (web/other). */
    value: string;
    /** How confident we are this channel actually reaches the person. */
    confidence?: ChannelConfidence;
    /** Free-text note (e.g., "best-guess; verify before sending"). */
    note?: string;
}
export interface Candidate {
    /** Human-readable name */
    name: string;
    /** Role + org context (e.g., "VP Content Strategy, O'Reilly Media") */
    role?: string;
    /** Tag set used for matching against an artifact's tag query */
    tags: string[];
    /** Contact channels, ordered preferred-first */
    channels: ContactChannel[];
    /** Reference to a pitch template defined in the same corpus */
    template: string;
    /** ISO date of last outreach to this person (for recency filtering) */
    last_pitched?: string;
    /** Free-text note for human reviewer */
    notes?: string;
}
export interface PitchTemplate {
    /** Subject-line template with {artifact_subject}, {recipient_beat}, etc. placeholders */
    subject: string;
    /** Body template with {name_first}, {artifact_path}, {artifact_link}, etc. placeholders */
    body: string;
    /** Default tier label this template produces (for filtering in the outreach pipeline) */
    tier?: string;
}
export interface CandidateCorpus {
    /** Schema version for forward compatibility */
    version: number;
    candidates: Candidate[];
    templates: Record<string, PitchTemplate>;
}
export declare function loadCorpus(path: string): CandidateCorpus;
export declare function validateCorpus(corpus: CandidateCorpus, source: string): void;
/** Return only emailable channels — used to know if outreach pipeline can act on them directly. */
export declare function preferredEmail(candidate: Candidate): ContactChannel | undefined;
/** Return the highest-confidence channel of any kind. */
export declare function bestChannel(candidate: Candidate): ContactChannel;
//# sourceMappingURL=corpus.d.ts.map