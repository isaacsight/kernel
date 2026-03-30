// kbot Lab — Interactive Science REPL
//
// A specialized REPL mode for scientific research. Manages lab sessions
// with domain-specific system prompts, automatic citation extraction,
// variable tracking, and notebook export.
//
// Usage:
//   $ kbot lab                    # Start a general science lab
//   $ kbot lab --domain physics   # Start in physics domain
//   $ kbot lab --resume <id>      # Resume a previous session
//   $ kbot lab --name "QFT Notes" # Start a named session
//
// REPL commands:
//   /domain <name>      — Switch scientific domain
//   /notebook            — Show the current notebook
//   /export [format]     — Export as markdown, latex, or json
//   /cite <doi>          — Add a citation
//   /hypothesis <text>   — Record a hypothesis
//   /note <text>         — Add a research note
//   /variables           — Show stored variables
//   /set <name> <value>  — Store a variable
//   /history             — List past lab sessions
//   /resume <id>         — Resume a previous session
//   /clear               — Clear current session
//   /help                — Show lab commands
//   /quit                — Exit the lab
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, } from 'node:fs';
import chalk from 'chalk';
import { runAgent } from './agent.js';
import { gatherContext } from './context.js';
import { printError, printInfo } from './ui.js';
// ── Constants ──
const LAB_DIR = join(homedir(), '.kbot', 'lab', 'sessions');
const MAX_LAB_SESSIONS = 100;
// ── Domain Configuration ──
const DOMAIN_LABELS = {
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
    math: 'Mathematics',
    neuro: 'Neuroscience',
    earth: 'Earth Science',
    social: 'Social Science',
    humanities: 'Humanities',
    health: 'Health & Medicine',
    general: 'General Science',
};
const DOMAIN_ICONS = {
    physics: '\u269B\uFE0F', // atom
    chemistry: '\u2697\uFE0F', // alembic
    biology: '\uD83E\uDDEC', // dna
    math: '\uD83D\uDCD0', // triangular ruler
    neuro: '\uD83E\uDDE0', // brain
    earth: '\uD83C\uDF0D', // globe
    social: '\uD83D\uDC65', // people
    humanities: '\uD83D\uDCDA', // books
    health: '\u2695\uFE0F', // medical
    general: '\uD83D\uDD2C', // microscope
};
const DOMAIN_COLORS = {
    physics: '#60A5FA', // blue
    chemistry: '#4ADE80', // green
    biology: '#A78BFA', // violet
    math: '#FBBF24', // amber
    neuro: '#F472B6', // pink
    earth: '#34D399', // emerald
    social: '#FB923C', // orange
    humanities: '#E879F9', // fuchsia
    health: '#F87171', // red
    general: '#67E8F9', // cyan
};
const DOMAIN_AGENTS = {
    physics: 'researcher',
    chemistry: 'researcher',
    biology: 'researcher',
    math: 'analyst',
    neuro: 'researcher',
    earth: 'researcher',
    social: 'analyst',
    humanities: 'writer',
    health: 'researcher',
    general: 'researcher',
};
/** Build a domain-specific system prompt that primes the agent for scientific work */
function buildDomainPrompt(domain, session) {
    const base = `You are a scientific research assistant operating in kbot lab mode.
Domain: ${DOMAIN_LABELS[domain]}
Session: "${session.name}" (started ${new Date(session.startedAt).toLocaleDateString()})

IMPORTANT CONVENTIONS:
- Always cite sources with DOIs or arXiv IDs when referencing specific findings
- Use precise scientific terminology appropriate to ${DOMAIN_LABELS[domain]}
- When presenting numeric results, include units and significant figures
- Distinguish between established findings, recent results, and speculative claims
- Format mathematical expressions using standard notation
- When computations are performed, show the work step by step
- If you reference a paper, include: authors, year, title, journal/source, and DOI if known`;
    const domainSpecific = {
        physics: `
PHYSICS-SPECIFIC GUIDANCE:
- Use SI units by default; convert to natural units when appropriate for HEP/QFT
- For quantum mechanics: use Dirac notation where helpful
- For classical mechanics: specify coordinate systems and reference frames
- Dimensional analysis should accompany any derived formula
- Preferred tools: symbolic computation, unit conversion, physics constants lookup
- When discussing experiments, note the energy scale, detector type, and statistical significance`,
        chemistry: `
CHEMISTRY-SPECIFIC GUIDANCE:
- Use IUPAC nomenclature for compounds
- Include molecular formulas, structural info when relevant
- For reactions: balance equations, specify conditions (temperature, pressure, catalyst)
- Note safety considerations (GHS hazard codes) for hazardous substances
- Preferred tools: compound search, reaction lookup, stoichiometry calc, spectroscopy data
- For organic chemistry: specify stereochemistry where relevant`,
        biology: `
BIOLOGY-SPECIFIC GUIDANCE:
- Use standard gene/protein nomenclature (HGNC for human genes, italic for genes)
- For sequences: specify organism, accession numbers
- For ecology: note sample sizes, confidence intervals, effect sizes
- For cell biology: specify cell type, organism, culture conditions
- Preferred tools: gene lookup, BLAST search, pathway search, taxonomy lookup
- Always distinguish in vitro, in vivo, and in silico results`,
        math: `
MATHEMATICS-SPECIFIC GUIDANCE:
- State theorems precisely with all hypotheses
- Distinguish between definitions, lemmas, theorems, corollaries, and conjectures
- Provide proofs or proof sketches when asked
- Use standard notation (LaTeX-compatible) for expressions
- Preferred tools: symbolic computation, OEIS lookup, number theory, graph theory
- For applied math: connect abstractions to concrete applications`,
        neuro: `
NEUROSCIENCE-SPECIFIC GUIDANCE:
- Specify brain regions using standard atlases (MNI, Talairach coordinates)
- For neuroimaging: note modality (fMRI, EEG, MEG), preprocessing pipeline
- Use standard neurotransmitter and receptor nomenclature
- For behavioral experiments: specify paradigm, n, statistical tests
- Preferred tools: brain atlas, neurotransmitter lookup, connectome query, EEG analysis
- Distinguish between correlation and causation in neuroimaging findings`,
        earth: `
EARTH SCIENCE-SPECIFIC GUIDANCE:
- Specify temporal scales (geological time) and spatial scales
- Use standard geological time periods and epoch names
- For climate data: note data source, temporal resolution, spatial coverage
- For seismology: specify magnitude type (Mw, ML), depth, focal mechanism
- Preferred tools: climate data, earthquake query, ocean data, geological query
- Always note measurement uncertainties and model limitations`,
        social: `
SOCIAL SCIENCE-SPECIFIC GUIDANCE:
- Report effect sizes alongside p-values
- Specify methodology: qualitative, quantitative, mixed methods
- Note sample demographics and potential selection biases
- For surveys: report response rate, sampling method
- Preferred tools: statistical analysis, demographic model, survey design, sentiment analysis
- Distinguish between causal claims and correlational findings
- Note WEIRD (Western, Educated, Industrialized, Rich, Democratic) sampling biases`,
        humanities: `
HUMANITIES-SPECIFIC GUIDANCE:
- Cite primary sources with full bibliographic detail
- Distinguish between historical fact, interpretation, and historiographic debate
- For textual analysis: note edition, translation, original language
- For philosophical arguments: reconstruct in premise-conclusion form when helpful
- Preferred tools: archival search, historical timeline, philosophical concepts, corpus analysis
- Engage with multiple interpretive frameworks rather than privileging one`,
        health: `
HEALTH & MEDICINE-SPECIFIC GUIDANCE:
- Use standard medical terminology (ICD codes, MeSH terms) where appropriate
- For clinical studies: specify study design (RCT, cohort, case-control), CONSORT/STROBE compliance
- Note levels of evidence (systematic review > RCT > observational)
- For drug information: include mechanism of action, pharmacokinetics, contraindications
- Preferred tools: PubMed search, clinical trials, drug lookup, epidemiology calc
- Always include appropriate medical disclaimers for clinical information
- Specify NNT (number needed to treat) and NNH where relevant`,
        general: `
GENERAL SCIENCE GUIDANCE:
- Adapt terminology and rigor to the specific scientific question
- Cross-reference multiple domains when the question spans fields
- Use tools from any scientific domain as appropriate
- Prioritize systematic reviews and meta-analyses for evidence claims`,
    };
    // Build variable context if any are set
    let variableContext = '';
    const varEntries = Object.entries(session.variables);
    if (varEntries.length > 0) {
        variableContext = '\n\nACTIVE VARIABLES:\n' +
            varEntries.map(([k, v]) => `  ${k} = ${JSON.stringify(v)}`).join('\n') +
            '\nYou may reference these variables in computations.';
    }
    // Build citation context
    let citationContext = '';
    if (session.citations.length > 0) {
        citationContext = '\n\nSESSION CITATIONS:\n' +
            session.citations.map((c, i) => `  [${i + 1}] ${c.authors.join(', ')} (${c.year}). ${c.title}. ${c.source}${c.doi ? ` DOI: ${c.doi}` : ''}`).join('\n');
    }
    return base + domainSpecific[domain] + variableContext + citationContext;
}
// ── Storage ──
function ensureLabDir() {
    if (!existsSync(LAB_DIR))
        mkdirSync(LAB_DIR, { recursive: true });
}
function sessionPath(id) {
    return join(LAB_DIR, `${id}.json`);
}
function generateSessionId() {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6);
    return `lab-${date}-${rand}`;
}
function generateEntryId() {
    return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}
function saveLabSession(session) {
    ensureLabDir();
    session.lastActiveAt = new Date().toISOString();
    writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}
function loadLabSession(id) {
    ensureLabDir();
    const path = sessionPath(id);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
/** List all lab sessions, newest first */
export function listLabSessions() {
    ensureLabDir();
    const files = readdirSync(LAB_DIR).filter(f => f.endsWith('.json'));
    const sessions = [];
    for (const file of files) {
        try {
            const data = readFileSync(join(LAB_DIR, file), 'utf-8');
            sessions.push(JSON.parse(data));
        }
        catch {
            continue;
        }
    }
    return sessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
}
/** Get a specific lab session by ID */
export function getLabSession(id) {
    return loadLabSession(id);
}
/** Prune oldest sessions beyond the limit */
function pruneLabSessions() {
    const sessions = listLabSessions();
    if (sessions.length <= MAX_LAB_SESSIONS)
        return;
    const toRemove = sessions.slice(MAX_LAB_SESSIONS);
    for (const s of toRemove) {
        const path = sessionPath(s.id);
        if (existsSync(path))
            unlinkSync(path);
    }
}
// ── Notebook Management ──
function addEntry(session, type, content, metadata) {
    const entry = {
        id: generateEntryId(),
        type,
        content,
        timestamp: new Date().toISOString(),
        metadata,
    };
    session.notebook.push(entry);
    return entry;
}
function formatNotebook(session) {
    const domainColor = chalk.hex(DOMAIN_COLORS[session.domain]);
    const dim = chalk.dim;
    const lines = [
        '',
        domainColor(`  ${DOMAIN_ICONS[session.domain]}  Lab Notebook: ${session.name}`),
        dim(`  Domain: ${DOMAIN_LABELS[session.domain]}  |  Started: ${new Date(session.startedAt).toLocaleString()}`),
        dim(`  Entries: ${session.notebook.length}  |  Variables: ${Object.keys(session.variables).length}  |  Citations: ${session.citations.length}`),
        dim('  ' + '\u2500'.repeat(60)),
        '',
    ];
    if (session.notebook.length === 0) {
        lines.push(dim('  (empty notebook — start asking questions)'));
        return lines.join('\n');
    }
    const TYPE_BADGES = {
        query: chalk.hex('#60A5FA')(' Q '),
        result: chalk.hex('#4ADE80')(' R '),
        computation: chalk.hex('#FBBF24')(' C '),
        note: chalk.hex('#67E8F9')(' N '),
        citation: chalk.hex('#FB923C')(' @ '),
        hypothesis: chalk.hex('#E879F9')(' H '),
        figure: chalk.hex('#F472B6')(' F '),
    };
    for (const entry of session.notebook) {
        const badge = TYPE_BADGES[entry.type] || dim(` ${entry.type} `);
        const time = dim(new Date(entry.timestamp).toLocaleTimeString());
        const preview = entry.content.length > 120
            ? entry.content.slice(0, 120) + '...'
            : entry.content;
        // For multi-line content, only show first line in overview
        const firstLine = preview.split('\n')[0];
        lines.push(`  ${badge} ${time}  ${firstLine}`);
    }
    lines.push('');
    return lines.join('\n');
}
// ── Citation Extraction ──
/** Regex patterns for common citation identifiers */
const DOI_PATTERN = /\b(10\.\d{4,}\/[^\s,;)\]]+)/g;
const ARXIV_PATTERN = /\barXiv:(\d{4}\.\d{4,5}(?:v\d+)?)/g;
const PMID_PATTERN = /\bPMID:?\s*(\d{7,8})/g;
/** Extract citation references from AI response text */
function extractCitations(text) {
    const found = [];
    const seen = new Set();
    let match;
    // DOIs
    DOI_PATTERN.lastIndex = 0;
    while ((match = DOI_PATTERN.exec(text)) !== null) {
        const id = match[1];
        if (!seen.has(id)) {
            seen.add(id);
            found.push({ type: 'doi', id });
        }
    }
    // arXiv IDs
    ARXIV_PATTERN.lastIndex = 0;
    while ((match = ARXIV_PATTERN.exec(text)) !== null) {
        const id = match[1];
        if (!seen.has(id)) {
            seen.add(id);
            found.push({ type: 'arxiv', id });
        }
    }
    // PMIDs
    PMID_PATTERN.lastIndex = 0;
    while ((match = PMID_PATTERN.exec(text)) !== null) {
        const id = match[1];
        if (!seen.has(id)) {
            seen.add(id);
            found.push({ type: 'pmid', id });
        }
    }
    return found;
}
/** Convert extracted citation references to Citation objects */
function refsToStubCitations(refs) {
    return refs.map(ref => {
        const citeId = `cite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`;
        switch (ref.type) {
            case 'doi':
                return {
                    id: citeId,
                    doi: ref.id,
                    title: `[DOI: ${ref.id}]`,
                    authors: [],
                    year: 0,
                    source: `https://doi.org/${ref.id}`,
                };
            case 'arxiv':
                return {
                    id: citeId,
                    title: `[arXiv: ${ref.id}]`,
                    authors: [],
                    year: parseInt(ref.id.slice(0, 2), 10) + 2000,
                    source: `https://arxiv.org/abs/${ref.id}`,
                };
            case 'pmid':
                return {
                    id: citeId,
                    title: `[PMID: ${ref.id}]`,
                    authors: [],
                    year: 0,
                    source: `https://pubmed.ncbi.nlm.nih.gov/${ref.id}/`,
                };
        }
    });
}
// ── Variable Extraction ──
/** Patterns for numeric results that might be worth storing */
const NUMERIC_RESULT_PATTERNS = [
    /(?:result|answer|value|equals?|=)\s*[:=]?\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*([a-zA-Z/^*]+)?/gi,
    /(?:approximately|roughly|about|~)\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*([a-zA-Z/^*]+)?/gi,
];
/** Extract named numeric results from AI response */
function extractNumericResults(text) {
    const results = [];
    // Look for explicit assignments like "F = 9.8 N" or "result: 42.5 km"
    const assignmentPattern = /\b([A-Za-z_]\w*)\s*[=:]\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*([a-zA-Z/^*\u00B0\u00B2\u00B3]+)?/g;
    let match;
    assignmentPattern.lastIndex = 0;
    while ((match = assignmentPattern.exec(text)) !== null) {
        const name = match[1];
        const value = parseFloat(match[2]);
        const unit = match[3];
        // Skip common false positives
        const skipNames = new Set(['the', 'and', 'for', 'with', 'from', 'http', 'https', 'www', 'doi', 'ref', 'fig', 'table', 'step', 'line', 'page']);
        if (skipNames.has(name.toLowerCase()))
            continue;
        if (isNaN(value))
            continue;
        results.push({ name, value, unit });
    }
    return results;
}
// ── Export ──
/** Export the notebook in the requested format */
export function exportNotebook(session, format = 'markdown') {
    switch (format) {
        case 'json':
            return JSON.stringify({
                session: {
                    id: session.id,
                    name: session.name,
                    domain: session.domain,
                    startedAt: session.startedAt,
                    lastActiveAt: session.lastActiveAt,
                },
                notebook: session.notebook,
                variables: session.variables,
                citations: session.citations,
            }, null, 2);
        case 'latex':
            return exportAsLatex(session);
        case 'markdown':
        default:
            return exportAsMarkdown(session);
    }
}
function exportAsMarkdown(session) {
    const lines = [
        `# Lab Notebook: ${session.name}`,
        '',
        `**Domain:** ${DOMAIN_LABELS[session.domain]}`,
        `**Started:** ${new Date(session.startedAt).toLocaleString()}`,
        `**Last Active:** ${new Date(session.lastActiveAt).toLocaleString()}`,
        '',
        '---',
        '',
    ];
    // Variables section
    const varEntries = Object.entries(session.variables);
    if (varEntries.length > 0) {
        lines.push('## Variables', '');
        lines.push('| Name | Value |');
        lines.push('|------|-------|');
        for (const [name, value] of varEntries) {
            lines.push(`| \`${name}\` | ${JSON.stringify(value)} |`);
        }
        lines.push('');
    }
    // Notebook entries
    lines.push('## Entries', '');
    for (const entry of session.notebook) {
        const time = new Date(entry.timestamp).toLocaleString();
        const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
        switch (entry.type) {
            case 'hypothesis':
                lines.push(`### Hypothesis (${time})`, '', `> ${entry.content}`, '');
                break;
            case 'citation':
                lines.push(`### Citation (${time})`, '', `- ${entry.content}`, '');
                break;
            case 'note':
                lines.push(`### Note (${time})`, '', entry.content, '');
                break;
            case 'query':
                lines.push(`### Query (${time})`, '', `**Q:** ${entry.content}`, '');
                break;
            case 'result':
                lines.push(`### Result (${time})`, '', entry.content, '');
                break;
            case 'computation':
                lines.push(`### Computation (${time})`, '', '```', entry.content, '```', '');
                break;
            case 'figure':
                lines.push(`### Figure (${time})`, '', entry.content, '');
                break;
            default:
                lines.push(`### ${typeLabel} (${time})`, '', entry.content, '');
        }
    }
    // Citations section
    if (session.citations.length > 0) {
        lines.push('## References', '');
        for (let i = 0; i < session.citations.length; i++) {
            const c = session.citations[i];
            const authors = c.authors.length > 0 ? c.authors.join(', ') : 'Unknown';
            const year = c.year > 0 ? ` (${c.year})` : '';
            const doi = c.doi ? ` DOI: ${c.doi}` : '';
            lines.push(`${i + 1}. ${authors}${year}. *${c.title}*. ${c.source}${doi}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function exportAsLatex(session) {
    const lines = [
        '\\documentclass{article}',
        '\\usepackage[utf8]{inputenc}',
        '\\usepackage{amsmath,amssymb}',
        '\\usepackage{hyperref}',
        '\\usepackage{booktabs}',
        '',
        `\\title{Lab Notebook: ${escapeLatex(session.name)}}`,
        `\\date{${new Date(session.startedAt).toLocaleDateString()}}`,
        '',
        '\\begin{document}',
        '\\maketitle',
        '',
    ];
    // Variables
    const varEntries = Object.entries(session.variables);
    if (varEntries.length > 0) {
        lines.push('\\section{Variables}', '');
        lines.push('\\begin{tabular}{ll}', '\\toprule', 'Name & Value \\\\', '\\midrule');
        for (const [name, value] of varEntries) {
            lines.push(`\\texttt{${escapeLatex(name)}} & ${escapeLatex(String(value))} \\\\`);
        }
        lines.push('\\bottomrule', '\\end{tabular}', '');
    }
    // Entries
    lines.push('\\section{Notebook}', '');
    for (const entry of session.notebook) {
        const time = new Date(entry.timestamp).toLocaleString();
        switch (entry.type) {
            case 'hypothesis':
                lines.push(`\\subsection*{Hypothesis (${escapeLatex(time)})}`);
                lines.push(`\\begin{quote}${escapeLatex(entry.content)}\\end{quote}`);
                break;
            case 'query':
                lines.push(`\\subsection*{Query (${escapeLatex(time)})}`);
                lines.push(`\\textbf{Q:} ${escapeLatex(entry.content)}`);
                break;
            case 'result':
                lines.push(`\\subsection*{Result (${escapeLatex(time)})}`);
                lines.push(escapeLatex(entry.content));
                break;
            case 'computation':
                lines.push(`\\subsection*{Computation (${escapeLatex(time)})}`);
                lines.push('\\begin{verbatim}');
                lines.push(entry.content);
                lines.push('\\end{verbatim}');
                break;
            default:
                lines.push(`\\subsection*{${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} (${escapeLatex(time)})}`);
                lines.push(escapeLatex(entry.content));
        }
        lines.push('');
    }
    // References
    if (session.citations.length > 0) {
        lines.push('\\section{References}', '', '\\begin{enumerate}');
        for (const c of session.citations) {
            const authors = c.authors.length > 0 ? c.authors.join(', ') : 'Unknown';
            const year = c.year > 0 ? ` (${c.year})` : '';
            const doi = c.doi ? ` \\texttt{${escapeLatex(c.doi)}}` : '';
            lines.push(`\\item ${escapeLatex(authors)}${year}. \\textit{${escapeLatex(c.title)}}. ${escapeLatex(c.source)}${doi}`);
        }
        lines.push('\\end{enumerate}');
    }
    lines.push('', '\\end{document}');
    return lines.join('\n');
}
function escapeLatex(text) {
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/[&%$#_{}]/g, m => '\\' + m)
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}
function parseDOICitation(doiOrUrl) {
    // Accept bare DOI or full URL
    const doi = doiOrUrl.replace(/^https?:\/\/doi\.org\//, '').trim();
    return {
        id: `cite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
        doi,
        title: `[DOI: ${doi}]`,
        authors: [],
        year: 0,
        source: `https://doi.org/${doi}`,
    };
}
function handleCommand(input, session) {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = trimmed.slice(parts[0].length).trim();
    switch (cmd) {
        case '/help':
            return { continue: true, message: formatHelpText() };
        case '/domain': {
            if (!rest) {
                const domains = Object.keys(DOMAIN_LABELS).map(d => `  ${d === session.domain ? chalk.green('*') : ' '} ${d} — ${DOMAIN_LABELS[d]}`).join('\n');
                return { continue: true, message: `\nActive domain: ${chalk.bold(DOMAIN_LABELS[session.domain])}\n\n${domains}\n` };
            }
            const newDomain = rest.toLowerCase();
            if (!(newDomain in DOMAIN_LABELS)) {
                return { continue: true, message: chalk.red(`Unknown domain: ${rest}. Use /domain to see available domains.`) };
            }
            session.domain = newDomain;
            addEntry(session, 'note', `Domain switched to ${DOMAIN_LABELS[newDomain]}`);
            saveLabSession(session);
            const color = chalk.hex(DOMAIN_COLORS[newDomain]);
            return { continue: true, message: color(`\n  ${DOMAIN_ICONS[newDomain]}  Switched to ${DOMAIN_LABELS[newDomain]}\n`) };
        }
        case '/notebook':
            return { continue: true, message: formatNotebook(session) };
        case '/export': {
            const fmt = (rest.toLowerCase() || 'markdown');
            if (!['markdown', 'latex', 'json'].includes(fmt)) {
                return { continue: true, message: chalk.red('Format must be one of: markdown, latex, json') };
            }
            const exported = exportNotebook(session, fmt);
            const ext = fmt === 'markdown' ? 'md' : fmt === 'latex' ? 'tex' : 'json';
            const outPath = join(process.cwd(), `${session.id}.${ext}`);
            try {
                writeFileSync(outPath, exported);
                return { continue: true, message: chalk.green(`  Exported to ${outPath}`) };
            }
            catch (err) {
                return { continue: true, message: chalk.red(`Export failed: ${err}`) };
            }
        }
        case '/cite': {
            if (!rest) {
                return { continue: true, message: chalk.red('Usage: /cite <doi or url>') };
            }
            const citation = parseDOICitation(rest);
            session.citations.push(citation);
            addEntry(session, 'citation', `Added citation: ${citation.doi || rest}`);
            saveLabSession(session);
            return { continue: true, message: chalk.hex('#FB923C')(`  Added citation: ${citation.doi || rest}`) };
        }
        case '/hypothesis': {
            if (!rest) {
                return { continue: true, message: chalk.red('Usage: /hypothesis <your hypothesis>') };
            }
            addEntry(session, 'hypothesis', rest);
            saveLabSession(session);
            return { continue: true, message: chalk.hex('#E879F9')(`  Hypothesis recorded: "${rest.slice(0, 80)}${rest.length > 80 ? '...' : ''}"`) };
        }
        case '/note': {
            if (!rest) {
                return { continue: true, message: chalk.red('Usage: /note <your note>') };
            }
            addEntry(session, 'note', rest);
            saveLabSession(session);
            return { continue: true, message: chalk.hex('#67E8F9')(`  Note added.`) };
        }
        case '/variables': {
            const vars = Object.entries(session.variables);
            if (vars.length === 0) {
                return { continue: true, message: chalk.dim('  No variables stored. Use /set <name> <value> to store one.') };
            }
            const varLines = vars.map(([k, v]) => `  ${chalk.cyan(k)} = ${chalk.white(JSON.stringify(v))}`);
            return { continue: true, message: `\n  ${chalk.bold('Variables')} (${vars.length})\n${varLines.join('\n')}\n` };
        }
        case '/set': {
            const setParts = rest.split(/\s+/);
            if (setParts.length < 2) {
                return { continue: true, message: chalk.red('Usage: /set <name> <value>') };
            }
            const varName = setParts[0];
            const varValueStr = setParts.slice(1).join(' ');
            // Try to parse as number, then boolean, then keep as string
            let varValue;
            const num = Number(varValueStr);
            if (!isNaN(num) && varValueStr.trim() !== '') {
                varValue = num;
            }
            else if (varValueStr === 'true') {
                varValue = true;
            }
            else if (varValueStr === 'false') {
                varValue = false;
            }
            else {
                // Try JSON parse for objects/arrays
                try {
                    varValue = JSON.parse(varValueStr);
                }
                catch {
                    varValue = varValueStr;
                }
            }
            session.variables[varName] = varValue;
            saveLabSession(session);
            return { continue: true, message: chalk.cyan(`  ${varName} = ${JSON.stringify(varValue)}`) };
        }
        case '/history': {
            const sessions = listLabSessions();
            if (sessions.length === 0) {
                return { continue: true, message: chalk.dim('  No lab sessions found.') };
            }
            const histLines = sessions.slice(0, 20).map(s => {
                const date = new Date(s.lastActiveAt).toLocaleDateString();
                const icon = DOMAIN_ICONS[s.domain];
                const entries = s.notebook.length;
                const isCurrent = s.id === session.id ? chalk.green(' (current)') : '';
                return `  ${chalk.dim(s.id)}  ${icon} ${DOMAIN_LABELS[s.domain].padEnd(14)} ${date}  ${entries} entries  "${s.name}"${isCurrent}`;
            });
            return { continue: true, message: `\n  ${chalk.bold('Lab Sessions')} (${sessions.length} total)\n\n${histLines.join('\n')}\n` };
        }
        case '/resume': {
            if (!rest) {
                return { continue: true, message: chalk.red('Usage: /resume <session-id>') };
            }
            // Resuming is handled by the main loop — signal intent via metadata
            return { continue: true, message: `__RESUME__:${rest}` };
        }
        case '/clear': {
            session.notebook = [];
            session.variables = {};
            session.citations = [];
            saveLabSession(session);
            return { continue: true, message: chalk.dim('  Session cleared.') };
        }
        case '/quit':
        case '/exit':
        case '/q':
            return { continue: false, message: undefined };
        default:
            return { continue: true, message: chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`) };
    }
}
function formatHelpText() {
    const h = chalk.hex('#A78BFA');
    const d = chalk.dim;
    return `
  ${h('Lab Commands')}

  ${h('/domain')} ${d('[name]')}       Switch scientific domain (or list domains)
  ${h('/notebook')}              Show the current session notebook
  ${h('/export')} ${d('[format]')}     Export notebook (markdown, latex, json)
  ${h('/cite')} ${d('<doi>')}          Add a citation by DOI
  ${h('/hypothesis')} ${d('<text>')}   Record a hypothesis
  ${h('/note')} ${d('<text>')}         Add a research note
  ${h('/variables')}             Show stored variables
  ${h('/set')} ${d('<name> <value>')}  Store a variable for reuse
  ${h('/history')}               List past lab sessions
  ${h('/resume')} ${d('<id>')}         Resume a previous session
  ${h('/clear')}                 Clear current session
  ${h('/help')}                  Show this help
  ${h('/quit')}                  Exit the lab
`;
}
// ── Lab Banner ──
function printLabBanner(session) {
    const domainColor = chalk.hex(DOMAIN_COLORS[session.domain]);
    const dim = chalk.dim;
    const banner = `
${domainColor('  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510')}
${domainColor('  \u2502')}  ${DOMAIN_ICONS[session.domain]}  ${chalk.bold('kbot lab')} ${dim('— Interactive Science REPL')}     ${domainColor('\u2502')}
${domainColor('  \u2502')}                                                ${domainColor('\u2502')}
${domainColor('  \u2502')}  Domain:  ${domainColor(DOMAIN_LABELS[session.domain].padEnd(16))}                   ${domainColor('\u2502')}
${domainColor('  \u2502')}  Session: ${dim(session.name.slice(0, 30).padEnd(30))}           ${domainColor('\u2502')}
${domainColor('  \u2502')}                                                ${domainColor('\u2502')}
${domainColor('  \u2502')}  ${dim('Type /help for commands, or ask a question.')}     ${domainColor('\u2502')}
${domainColor('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518')}
`;
    console.error(banner);
}
// ── Prompt Builder ──
function buildLabPrompt(session) {
    const domainColor = chalk.hex(DOMAIN_COLORS[session.domain]);
    const dim = chalk.dim;
    const icon = DOMAIN_ICONS[session.domain];
    const domainShort = session.domain === 'general' ? 'sci' : session.domain.slice(0, 4);
    // Status indicators
    const varCount = Object.keys(session.variables).length;
    const citeCount = session.citations.length;
    const statusParts = [];
    if (varCount > 0)
        statusParts.push(dim(`${varCount}v`));
    if (citeCount > 0)
        statusParts.push(dim(`${citeCount}c`));
    const status = statusParts.length > 0 ? ` ${dim('[')}${statusParts.join(dim('|'))}${dim(']')}` : '';
    return `${icon} ${domainColor(`lab:${domainShort}`)}${status}${domainColor('>')} `;
}
// ── Main Entry Point ──
/**
 * Start the interactive science lab REPL.
 *
 * @param opts.domain - Initial scientific domain (default: 'general')
 * @param opts.resume - Session ID to resume
 * @param opts.name   - Name for the new session
 */
export async function startLab(opts) {
    const domain = opts?.domain || 'general';
    let session;
    // Resume existing session or create new one
    if (opts?.resume) {
        const existing = loadLabSession(opts.resume);
        if (!existing) {
            // Try fuzzy match
            const allSessions = listLabSessions();
            const match = allSessions.find(s => s.id.includes(opts.resume) || s.name.toLowerCase().includes(opts.resume.toLowerCase()));
            if (match) {
                session = match;
                printInfo(`Resumed lab session: ${session.name} (${session.id})`);
            }
            else {
                printError(`Lab session not found: ${opts.resume}`);
                printInfo('Use /history to see available sessions.');
                return;
            }
        }
        else {
            session = existing;
            printInfo(`Resumed lab session: ${session.name} (${session.id})`);
        }
    }
    else {
        const id = generateSessionId();
        const name = opts?.name || `${DOMAIN_LABELS[domain]} Lab — ${new Date().toLocaleDateString()}`;
        session = {
            id,
            name,
            domain,
            notebook: [],
            variables: {},
            citations: [],
            startedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
        };
        saveLabSession(session);
    }
    // Display banner
    printLabBanner(session);
    // Gather project context for the agent (non-blocking, best-effort)
    let projectContext;
    try {
        projectContext = await gatherContext();
    }
    catch {
        // Context gathering is optional — lab works without it
    }
    // Create readline interface
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr, // Prompt goes to stderr (clig.dev convention)
        prompt: buildLabPrompt(session),
        terminal: true,
    });
    rl.prompt();
    // Main REPL loop using event-driven readline
    const handleLine = async (line) => {
        const input = line.trim();
        // Empty input — just re-prompt
        if (!input) {
            rl.prompt();
            return;
        }
        // Handle slash commands
        if (input.startsWith('/')) {
            const result = handleCommand(input, session);
            // Handle /resume with session switching
            if (result.message?.startsWith('__RESUME__:')) {
                const resumeId = result.message.slice('__RESUME__:'.length);
                const resumeSession = loadLabSession(resumeId);
                if (!resumeSession) {
                    // Fuzzy match
                    const all = listLabSessions();
                    const match = all.find(s => s.id.includes(resumeId) || s.name.toLowerCase().includes(resumeId.toLowerCase()));
                    if (match) {
                        Object.assign(session, match);
                        printInfo(`Resumed: ${session.name}`);
                        printLabBanner(session);
                    }
                    else {
                        console.error(chalk.red(`  Session not found: ${resumeId}`));
                    }
                }
                else {
                    Object.assign(session, resumeSession);
                    printInfo(`Resumed: ${session.name}`);
                    printLabBanner(session);
                }
                rl.setPrompt(buildLabPrompt(session));
                rl.prompt();
                return;
            }
            if (result.message) {
                console.error(result.message);
            }
            if (!result.continue) {
                rl.close();
                return;
            }
            // Update prompt (domain may have changed)
            rl.setPrompt(buildLabPrompt(session));
            rl.prompt();
            return;
        }
        // Regular query — send to the agent
        // Log the query to the notebook
        addEntry(session, 'query', input);
        // Build system prompt with domain context
        const systemPrompt = buildDomainPrompt(session.domain, session);
        // Determine the best agent for this domain
        const agent = DOMAIN_AGENTS[session.domain];
        // Prepare agent options
        const agentOpts = {
            agent,
            stream: true,
            context: projectContext,
        };
        try {
            // Show thinking indicator
            const domainColor = chalk.hex(DOMAIN_COLORS[session.domain]);
            console.error(domainColor('  ...'));
            // Wrap the user message with the lab system prompt context
            const augmentedMessage = `[Lab System Prompt — do not repeat this to the user]\n${systemPrompt}\n[End Lab System Prompt]\n\nUser query: ${input}`;
            const response = await runAgent(augmentedMessage, agentOpts);
            // Log the result to the notebook
            addEntry(session, 'result', response.content, {
                agent: response.agent,
                model: response.model,
                toolCalls: response.toolCalls,
                tokens: response.usage,
            });
            // Auto-extract citations from the response
            const citationRefs = extractCitations(response.content);
            if (citationRefs.length > 0) {
                const newCitations = refsToStubCitations(citationRefs);
                // Deduplicate against existing citations
                for (const c of newCitations) {
                    const alreadyExists = session.citations.some(existing => (existing.doi && c.doi && existing.doi === c.doi) ||
                        existing.source === c.source);
                    if (!alreadyExists) {
                        session.citations.push(c);
                        addEntry(session, 'citation', `Auto-detected: ${c.doi || c.source}`, { auto: true });
                    }
                }
                if (newCitations.length > 0) {
                    const newCount = newCitations.filter(c => !session.citations.some(existing => existing.id !== c.id &&
                        ((existing.doi && c.doi && existing.doi === c.doi) || existing.source === c.source))).length;
                    if (newCount > 0) {
                        console.error(chalk.dim(`  [${newCount} citation(s) auto-detected]`));
                    }
                }
            }
            // Auto-extract and store numeric results
            const numericResults = extractNumericResults(response.content);
            let storedVarCount = 0;
            for (const nr of numericResults) {
                // Only auto-store if the variable name looks intentional (2+ chars, not common words)
                if (nr.name.length >= 2 && !session.variables[nr.name]) {
                    const value = nr.unit ? `${nr.value} ${nr.unit}` : nr.value;
                    session.variables[nr.name] = value;
                    storedVarCount++;
                }
            }
            if (storedVarCount > 0) {
                console.error(chalk.dim(`  [${storedVarCount} variable(s) auto-stored]`));
            }
            // Print the response if it wasn't streamed already
            if (!response.streamed) {
                console.log();
                console.log(response.content);
                console.log();
            }
            // Save session state
            saveLabSession(session);
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            printError(`Lab agent error: ${errorMsg}`);
            addEntry(session, 'note', `Error: ${errorMsg}`, { error: true });
            saveLabSession(session);
        }
        // Update prompt and continue
        rl.setPrompt(buildLabPrompt(session));
        rl.prompt();
    };
    // Wire up the readline events
    rl.on('line', (line) => {
        // Pause readline during async processing to avoid prompt duplication
        rl.pause();
        handleLine(line).then(() => {
            rl.resume();
        }).catch((err) => {
            printError(`Unexpected error: ${err}`);
            rl.resume();
            rl.prompt();
        });
    });
    rl.on('close', () => {
        // Final save
        saveLabSession(session);
        pruneLabSessions();
        const domainColor = chalk.hex(DOMAIN_COLORS[session.domain]);
        const entries = session.notebook.length;
        const vars = Object.keys(session.variables).length;
        const cites = session.citations.length;
        console.error('');
        console.error(domainColor(`  ${DOMAIN_ICONS[session.domain]}  Lab session saved.`));
        console.error(chalk.dim(`  ID: ${session.id}`));
        console.error(chalk.dim(`  ${entries} entries, ${vars} variables, ${cites} citations`));
        console.error(chalk.dim(`  Resume with: kbot lab --resume ${session.id}`));
        console.error('');
    });
    // Handle SIGINT gracefully (Ctrl+C)
    rl.on('SIGINT', () => {
        rl.close();
    });
    // Return a promise that resolves when the REPL closes
    return new Promise((resolve) => {
        rl.on('close', () => resolve());
    });
}
//# sourceMappingURL=lab.js.map