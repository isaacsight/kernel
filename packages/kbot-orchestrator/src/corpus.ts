// Candidate registry — the seed data for the explore pipeline.
//
// A registry is a JSON document with two top-level keys: `candidates` and
// `templates`. Each candidate has a name, an org/role, a set of tags
// describing their domain, one or more contact channels, and a reference
// to a pitch template the explore pipeline uses to compose a briefing
// entry for them.
//
// The intelligence lives in the corpus curation, not in the agent. The
// agent's job is to assemble briefings from the corpus deterministically.
// True discovery (finding NEW candidates on the public internet) is v0.3+
// work; v0.2 ships the assembler.

import { readFileSync, existsSync } from 'node:fs'

export type ChannelKind = 'email' | 'linkedin' | 'bluesky' | 'mastodon' | 'x' | 'web' | 'other'
export type ChannelConfidence = 'verified' | 'medium' | 'low'

export interface ContactChannel {
  kind: ChannelKind
  /** Email address (if kind=email), handle (linkedin/bluesky/mastodon/x), or URL (web/other). */
  value: string
  /** How confident we are this channel actually reaches the person. */
  confidence?: ChannelConfidence
  /** Free-text note (e.g., "best-guess; verify before sending"). */
  note?: string
}

export interface Candidate {
  /** Human-readable name */
  name: string
  /** Role + org context (e.g., "VP Content Strategy, O'Reilly Media") */
  role?: string
  /** Tag set used for matching against an artifact's tag query */
  tags: string[]
  /** Contact channels, ordered preferred-first */
  channels: ContactChannel[]
  /** Reference to a pitch template defined in the same corpus */
  template: string
  /** ISO date of last outreach to this person (for recency filtering) */
  last_pitched?: string
  /** Free-text note for human reviewer */
  notes?: string
}

export interface PitchTemplate {
  /** Subject-line template with {artifact_subject}, {recipient_beat}, etc. placeholders */
  subject: string
  /** Body template with {name_first}, {artifact_path}, {artifact_link}, etc. placeholders */
  body: string
  /** Default tier label this template produces (for filtering in the outreach pipeline) */
  tier?: string
}

export interface CandidateCorpus {
  /** Schema version for forward compatibility */
  version: number
  candidates: Candidate[]
  templates: Record<string, PitchTemplate>
}

export function loadCorpus(path: string): CandidateCorpus {
  if (!existsSync(path)) {
    throw new Error(`Corpus file not found: ${path}`)
  }
  const text = readFileSync(path, 'utf-8')
  const parsed = JSON.parse(text) as CandidateCorpus
  validateCorpus(parsed, path)
  return parsed
}

export function validateCorpus(corpus: CandidateCorpus, source: string): void {
  if (corpus.version !== 1) {
    throw new Error(`${source}: unsupported corpus version ${corpus.version} (expected 1)`)
  }
  if (!Array.isArray(corpus.candidates)) {
    throw new Error(`${source}: candidates must be an array`)
  }
  if (!corpus.templates || typeof corpus.templates !== 'object') {
    throw new Error(`${source}: templates must be an object`)
  }
  for (const c of corpus.candidates) {
    if (!c.name) throw new Error(`${source}: candidate missing name`)
    if (!Array.isArray(c.tags)) throw new Error(`${source}: ${c.name} missing tags`)
    if (!Array.isArray(c.channels) || c.channels.length === 0) {
      throw new Error(`${source}: ${c.name} must have at least one channel`)
    }
    if (!c.template) throw new Error(`${source}: ${c.name} missing template ref`)
    if (!corpus.templates[c.template]) {
      throw new Error(`${source}: ${c.name} references unknown template "${c.template}"`)
    }
  }
}

/** Return only emailable channels — used to know if outreach pipeline can act on them directly. */
export function preferredEmail(candidate: Candidate): ContactChannel | undefined {
  return candidate.channels.find((c) => c.kind === 'email')
}

/** Return the highest-confidence channel of any kind. */
export function bestChannel(candidate: Candidate): ContactChannel {
  const sorted = [...candidate.channels].sort((a, b) => {
    const order = { verified: 0, medium: 1, low: 2 } as const
    const av = order[a.confidence ?? 'medium']
    const bv = order[b.confidence ?? 'medium']
    return av - bv
  })
  return sorted[0]!
}
