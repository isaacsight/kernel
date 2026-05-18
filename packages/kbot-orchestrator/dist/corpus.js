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
import { readFileSync, existsSync } from 'node:fs';
export function loadCorpus(path) {
    if (!existsSync(path)) {
        throw new Error(`Corpus file not found: ${path}`);
    }
    const text = readFileSync(path, 'utf-8');
    const raw = JSON.parse(text);
    // Filter out organizational section markers ({_section: "..."} entries used
    // for human readability inside the JSON file). These are not candidates.
    const candidates = (raw.candidates ?? []).filter((c) => {
        if (!c || typeof c !== 'object')
            return false;
        return 'name' in c && 'tags' in c && 'channels' in c;
    });
    const parsed = {
        version: raw.version,
        candidates,
        templates: raw.templates,
    };
    validateCorpus(parsed, path);
    return parsed;
}
export function validateCorpus(corpus, source) {
    if (corpus.version !== 1) {
        throw new Error(`${source}: unsupported corpus version ${corpus.version} (expected 1)`);
    }
    if (!Array.isArray(corpus.candidates)) {
        throw new Error(`${source}: candidates must be an array`);
    }
    if (!corpus.templates || typeof corpus.templates !== 'object') {
        throw new Error(`${source}: templates must be an object`);
    }
    for (const c of corpus.candidates) {
        if (!c.name)
            throw new Error(`${source}: candidate missing name`);
        if (!Array.isArray(c.tags))
            throw new Error(`${source}: ${c.name} missing tags`);
        if (!Array.isArray(c.channels) || c.channels.length === 0) {
            throw new Error(`${source}: ${c.name} must have at least one channel`);
        }
        if (!c.template)
            throw new Error(`${source}: ${c.name} missing template ref`);
        if (!corpus.templates[c.template]) {
            throw new Error(`${source}: ${c.name} references unknown template "${c.template}"`);
        }
    }
}
/** Return only emailable channels — used to know if outreach pipeline can act on them directly. */
export function preferredEmail(candidate) {
    return candidate.channels.find((c) => c.kind === 'email');
}
/** Return the highest-confidence channel of any kind. */
export function bestChannel(candidate) {
    const sorted = [...candidate.channels].sort((a, b) => {
        const order = { verified: 0, medium: 1, low: 2 };
        const av = order[a.confidence ?? 'medium'];
        const bv = order[b.confidence ?? 'medium'];
        return av - bv;
    });
    return sorted[0];
}
//# sourceMappingURL=corpus.js.map