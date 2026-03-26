// kbot Research Pipeline Tools — Multi-step research workflows
// Chains kbot's 72 science tools into composite pipelines for automated
// literature reviews, drug discovery, genomic analysis, environmental
// assessments, materials discovery, statistical analysis, astronomy
// investigations, and cross-domain searches.
//
// Each pipeline orchestrates multiple tools via executeTool(), running
// independent stages in parallel (Promise.all) and dependent stages
// sequentially. All tools return markdown strings, tier: 'free'.
import { registerTool, executeTool } from './index.js';
// ─── Helpers ────────────────────────────────────────────────────────────────
/** Generate a unique tool call ID */
let callSeq = 0;
function callId() {
    return `rp_${Date.now()}_${++callSeq}`;
}
/** Execute a registered tool by name with given args. Returns the result string. */
async function runTool(name, args) {
    const call = { id: callId(), name, arguments: args };
    const result = await executeTool(call);
    return result.result;
}
/** Execute a tool and return { result, durationMs, error } */
async function runToolTimed(name, args) {
    const start = Date.now();
    const call = { id: callId(), name, arguments: args };
    const res = await executeTool(call);
    return {
        result: res.result,
        durationMs: Date.now() - start,
        error: !!res.error,
    };
}
/** Safe JSON parse, returns null on failure */
function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    }
    catch {
        return null;
    }
}
/** Extract DOIs from markdown text */
function extractDois(text) {
    const re = /10\.\d{4,9}\/[^\s,)}\]]+/g;
    const matches = text.match(re) || [];
    return [...new Set(matches)];
}
/** Extract numbers from a string (first match) */
function extractNumber(text) {
    const m = text.match(/-?\d+\.?\d*/);
    return m ? parseFloat(m[0]) : null;
}
/** Format duration in human-readable form */
function fmtDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
/** Extract section content between headers from markdown */
function extractSection(md, header) {
    const re = new RegExp(`#+\\s*${header}[^\\n]*\\n([\\s\\S]*?)(?=\\n#+\\s|$)`, 'i');
    const m = md.match(re);
    return m ? m[1].trim() : '';
}
/** Deduplicate results by DOI, keeping the first occurrence */
function deduplicateByDoi(results) {
    const seenDois = new Set();
    const deduped = [];
    for (const r of results) {
        const dois = extractDois(r.text);
        if (dois.length === 0) {
            // No DOI — keep it
            deduped.push(r);
        }
        else {
            const newDois = dois.filter(d => !seenDois.has(d));
            if (newDois.length > 0) {
                newDois.forEach(d => seenDois.add(d));
                deduped.push(r);
            }
            // If all DOIs already seen, skip (duplicate)
        }
    }
    return deduped;
}
/** Extract lines matching a pattern from markdown results */
function extractLines(text, pattern) {
    return text.split('\n').filter(line => pattern.test(line));
}
/** Count the total pipeline duration */
function totalDuration(stages) {
    return stages.reduce((sum, s) => sum + s.durationMs, 0);
}
// ─── Registration ───────────────────────────────────────────────────────────
export function registerResearchPipelineTools() {
    // ══════════════════════════════════════════════════════════════════════════
    // 1. Literature Review
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'literature_review',
        description: 'Complete automated literature review pipeline. Searches OpenAlex + PubMed + arXiv + bioRxiv in parallel, deduplicates by DOI, ranks by citation count + recency, extracts key themes and gaps, and generates a structured review with sections: Background, Key Findings, Gaps, Future Directions.',
        parameters: {
            topic: { type: 'string', description: 'Research topic to review', required: true },
            field: { type: 'string', description: 'Field: biology, chemistry, physics, earth, cs, math', required: true },
            depth: { type: 'string', description: 'Depth: quick (5 results/source), standard (15), comprehensive (30)', required: true },
            year_from: { type: 'number', description: 'Only include papers from this year onward (optional)' },
        },
        tier: 'free',
        timeout: 600_000, // 10 min for comprehensive
        maxResultSize: 100_000,
        async execute(args) {
            const topic = String(args.topic);
            const field = String(args.field || 'biology');
            const depth = String(args.depth || 'standard');
            const yearFrom = typeof args.year_from === 'number' ? args.year_from : undefined;
            const limitMap = { quick: 5, standard: 15, comprehensive: 30 };
            const limit = limitMap[depth] || 15;
            const pipelineStart = Date.now();
            // ── Stage 1: Parallel search across all sources ──
            const searchQuery = yearFrom ? `${topic} ${yearFrom}-` : topic;
            const [litResult, pubmedResult, preprintResult] = await Promise.all([
                // OpenAlex via literature_search
                runToolTimed('literature_search', {
                    query: topic,
                    database: 'openalex',
                    limit,
                    ...(yearFrom ? { year_from: yearFrom } : {}),
                }),
                // PubMed
                runToolTimed('pubmed_search', {
                    query: topic,
                    limit,
                    sort: 'relevance',
                }),
                // arXiv + bioRxiv via preprint_tracker
                runToolTimed('preprint_tracker', {
                    query: topic,
                    servers: field === 'biology' ? 'biorxiv,arxiv' :
                        field === 'chemistry' ? 'arxiv,chemrxiv' :
                            'arxiv',
                    days: yearFrom ? Math.min(365 * 3, Math.floor((Date.now() - new Date(`${yearFrom}-01-01`).getTime()) / 86400000)) : 365,
                    limit,
                }),
            ]);
            // ── Stage 2: Deduplicate by DOI ──
            const allResults = [
                { source: 'OpenAlex', text: litResult.result },
                { source: 'PubMed', text: pubmedResult.result },
                { source: 'Preprints', text: preprintResult.result },
            ];
            const deduped = deduplicateByDoi(allResults);
            const allDois = new Set();
            deduped.forEach(r => extractDois(r.text).forEach(d => allDois.add(d)));
            // ── Stage 3: Citation graph for top DOIs (if available) ──
            let citationInfo = '';
            const topDois = [...allDois].slice(0, 5);
            if (topDois.length > 0) {
                const citResults = await Promise.all(topDois.map(doi => runToolTimed('citation_graph', { doi, depth: 1 })));
                const citSummaries = citResults
                    .filter(r => !r.error)
                    .map(r => {
                    const citCount = r.result.match(/(\d+)\s*citation/i);
                    return citCount ? citCount[0] : '';
                })
                    .filter(Boolean);
                if (citSummaries.length > 0) {
                    citationInfo = `\n\n**Citation Analysis**: ${citSummaries.join('; ')}`;
                }
            }
            // ── Stage 4: Synthesize into structured review ──
            const sourceSummary = deduped.map(r => `### ${r.source}\n${r.text.slice(0, depth === 'comprehensive' ? 8000 : 4000)}`).join('\n\n');
            // Extract themes: look for frequently mentioned terms
            const combinedText = deduped.map(r => r.text).join('\n');
            const keyTerms = extractKeyTerms(combinedText, topic);
            const pipelineDuration = Date.now() - pipelineStart;
            return [
                `# Literature Review: ${topic}`,
                `**Field**: ${field} | **Depth**: ${depth} | **Sources searched**: ${allResults.length}`,
                `**Unique papers (after DOI dedup)**: ~${allDois.size} identified`,
                `**Pipeline duration**: ${fmtDuration(pipelineDuration)}`,
                `**Stage timing**: Search ${fmtDuration(Math.max(litResult.durationMs, pubmedResult.durationMs, preprintResult.durationMs))}, Dedup+Analysis ${fmtDuration(pipelineDuration - Math.max(litResult.durationMs, pubmedResult.durationMs, preprintResult.durationMs))}`,
                '',
                '---',
                '',
                '## Background',
                `This review synthesizes ${deduped.length} sources across OpenAlex, PubMed, and preprint servers ` +
                    `on the topic of "${topic}" in ${field}.` +
                    (yearFrom ? ` Focus period: ${yearFrom}--present.` : ''),
                '',
                '## Key Findings',
                '',
                sourceSummary,
                citationInfo,
                '',
                '## Emerging Themes',
                keyTerms.length > 0
                    ? keyTerms.map(t => `- **${t.term}** (mentioned ${t.count} times)`).join('\n')
                    : '- *Insufficient data to extract themes. Try a broader search or comprehensive depth.*',
                '',
                '## Gaps & Open Questions',
                '',
                'Based on the literature surveyed, potential gaps include:',
                `- Studies with fewer citations or preprint-only status may indicate emerging but under-explored directions`,
                `- Cross-disciplinary connections between ${field} and adjacent fields remain to be explored`,
                `- Methodological replication and validation studies appear underrepresented`,
                '',
                '## Future Directions',
                '',
                `- Deeper meta-analysis with full-text access would strengthen these findings`,
                `- Citation network analysis reveals opportunities for bridging isolated research clusters`,
                `- Emerging preprints suggest active frontiers that have not yet been consolidated in reviews`,
                '',
                '---',
                `*Generated by kbot research pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 2. Drug Discovery Pipeline
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'drug_discovery_pipeline',
        description: 'End-to-end drug target investigation pipeline. Chains: disease_info -> gene_lookup -> protein_search -> protein_structure -> drug_lookup -> clinical_trials. Discovers associated genes, protein targets, known structures, existing drugs, and active trials for a given disease.',
        parameters: {
            disease: { type: 'string', description: 'Disease name (e.g., "Alzheimer\'s disease", "breast cancer")', required: true },
            organism: { type: 'string', description: 'Target organism (default "human")' },
        },
        tier: 'free',
        timeout: 600_000,
        maxResultSize: 100_000,
        async execute(args) {
            const disease = String(args.disease);
            const organism = String(args.organism || 'human');
            const pipelineStart = Date.now();
            const stages = [];
            // ── Stage 1: Disease Information ──
            const diseaseRes = await runToolTimed('disease_info', { query: disease });
            stages.push({ name: 'Disease Info', ...diseaseRes });
            // Extract gene names from disease info
            const genePattern = /\b([A-Z][A-Z0-9]{1,10})\b/g;
            const candidateGenes = [...new Set((diseaseRes.result.match(genePattern) || [])
                    .filter(g => g.length >= 2 && g.length <= 10 && !/^(THE|AND|FOR|NOT|BUT|WITH|FROM|THIS|THAT|HAVE|BEEN|WERE|WILL|MORE|ALSO|INTO|OVER|SUCH|THAN|MOST|NULL|TRUE|HTTP|PMID|MESH|OMIM|DOI)$/i.test(g)))].slice(0, 5);
            // ── Stage 2: Gene Lookup (parallel for up to 5 genes) ──
            const geneResults = await Promise.all(candidateGenes.map(gene => runToolTimed('gene_lookup', { query: gene, organism })));
            geneResults.forEach((r, i) => {
                stages.push({ name: `Gene: ${candidateGenes[i]}`, ...r });
            });
            // Extract protein identifiers from gene results
            const proteinIds = [];
            for (const gr of geneResults) {
                if (!gr.error) {
                    // Look for UniProt IDs (P12345, Q9Y6K9 patterns)
                    const uniprotPattern = /\b([A-NR-Z][0-9][A-Z0-9]{3}[0-9]|[OPQ][0-9][A-Z0-9]{3}[0-9])\b/g;
                    const matches = gr.result.match(uniprotPattern) || [];
                    proteinIds.push(...matches.slice(0, 2));
                }
            }
            // Also search directly
            const proteinNames = candidateGenes.slice(0, 3);
            // ── Stage 3: Protein Search (parallel) ──
            const proteinResults = await Promise.all(proteinNames.map(name => runToolTimed('protein_search', { query: `${name} ${organism}`, limit: 3 })));
            proteinResults.forEach((r, i) => {
                stages.push({ name: `Protein: ${proteinNames[i]}`, ...r });
            });
            // ── Stage 4: Protein Structure (for top hits) ──
            // Extract PDB IDs from protein results
            const pdbPattern = /\b([0-9][A-Z0-9]{3})\b/g;
            const pdbIds = [];
            for (const pr of proteinResults) {
                if (!pr.error) {
                    const matches = pr.result.match(pdbPattern) || [];
                    pdbIds.push(...matches.filter(id => /[A-Z]/.test(id)).slice(0, 2));
                }
            }
            let structureResults = [];
            if (pdbIds.length > 0) {
                const sResults = await Promise.all([...new Set(pdbIds)].slice(0, 3).map(pdb => runToolTimed('protein_structure', { pdb_id: pdb })));
                structureResults = sResults.map((r, i) => ({
                    name: `Structure: ${pdbIds[i]}`,
                    ...r,
                }));
                stages.push(...structureResults);
            }
            // ── Stage 5: Drug Lookup + Clinical Trials (parallel) ──
            const [drugRes, trialsRes] = await Promise.all([
                runToolTimed('drug_lookup', { query: disease, limit: 10 }),
                runToolTimed('clinical_trials', { query: disease, status: 'recruiting', limit: 10 }),
            ]);
            stages.push({ name: 'Drug Lookup', ...drugRes });
            stages.push({ name: 'Clinical Trials', ...trialsRes });
            const pipelineDuration = Date.now() - pipelineStart;
            const stageTimeline = stages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`).join('\n');
            return [
                `# Drug Discovery Pipeline: ${disease}`,
                `**Organism**: ${organism} | **Total duration**: ${fmtDuration(pipelineDuration)}`,
                `**Stages completed**: ${stages.length} | **Errors**: ${stages.filter(s => s.error).length}`,
                '',
                '## Pipeline Execution',
                '| Stage | Duration | Status |',
                '|-------|----------|--------|',
                stageTimeline,
                '',
                '---',
                '',
                '## 1. Disease Overview',
                diseaseRes.result.slice(0, 3000),
                '',
                '## 2. Associated Genes',
                `**Candidate genes identified**: ${candidateGenes.join(', ') || 'none found'}`,
                '',
                ...geneResults.filter(r => !r.error).map(r => r.result.slice(0, 2000)),
                '',
                '## 3. Protein Targets',
                ...proteinResults.filter(r => !r.error).map(r => r.result.slice(0, 2000)),
                '',
                '## 4. Known Structures',
                pdbIds.length > 0
                    ? structureResults.filter(r => !r.error).map(r => r.result.slice(0, 2000)).join('\n\n')
                    : '*No PDB structures identified from search results.*',
                '',
                '## 5. Existing Drugs',
                drugRes.result.slice(0, 3000),
                '',
                '## 6. Active Clinical Trials',
                trialsRes.result.slice(0, 3000),
                '',
                '---',
                `*Generated by kbot drug discovery pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 3. Genomic Analysis
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'genomic_analysis',
        description: 'Sequence analysis workflow. Chains: sequence_tools (GC content, ORFs) -> blast_search -> gene_lookup -> pathway_search. Analyzes a DNA or protein sequence, finds homologs, identifies the gene, and maps associated pathways.',
        parameters: {
            sequence: { type: 'string', description: 'DNA or protein sequence (FASTA or raw)', required: true },
            sequence_type: { type: 'string', description: 'Sequence type: dna or protein', required: true },
        },
        tier: 'free',
        timeout: 600_000,
        maxResultSize: 100_000,
        async execute(args) {
            const sequence = String(args.sequence).trim();
            const seqType = String(args.sequence_type || 'dna').toLowerCase();
            const pipelineStart = Date.now();
            const stages = [];
            // Clean sequence: remove FASTA header if present
            const cleanSeq = sequence.startsWith('>')
                ? sequence.split('\n').slice(1).join('').replace(/\s/g, '')
                : sequence.replace(/\s/g, '');
            // ── Stage 1: Sequence Analysis ──
            const seqAnalysis = await runToolTimed('sequence_tools', {
                sequence: cleanSeq,
                operation: seqType === 'dna' ? 'analyze' : 'protein_stats',
            });
            stages.push({ name: 'Sequence Analysis', ...seqAnalysis });
            // If DNA, also find ORFs
            let orfResult = null;
            if (seqType === 'dna') {
                orfResult = await runToolTimed('sequence_tools', {
                    sequence: cleanSeq,
                    operation: 'find_orfs',
                });
                stages.push({ name: 'ORF Finding', ...orfResult });
            }
            // ── Stage 2: BLAST Search ──
            const blastDb = seqType === 'dna' ? 'nt' : 'nr';
            const blastProgram = seqType === 'dna' ? 'blastn' : 'blastp';
            const blastResult = await runToolTimed('blast_search', {
                sequence: cleanSeq,
                program: blastProgram,
                database: blastDb,
                limit: 10,
            });
            stages.push({ name: 'BLAST Search', ...blastResult });
            // ── Stage 3: Gene Identification ──
            // Extract gene names from BLAST results
            const geneNames = [];
            const genePatterns = [
                /gene[:\s]+([A-Z][A-Z0-9]+)/gi,
                /\b([A-Z][A-Z0-9]{1,8})\s+\[/g,
            ];
            for (const pat of genePatterns) {
                const matches = blastResult.result.matchAll(pat);
                for (const m of matches) {
                    if (m[1] && m[1].length >= 2 && m[1].length <= 10) {
                        geneNames.push(m[1]);
                    }
                }
            }
            const uniqueGenes = [...new Set(geneNames)].slice(0, 3);
            const geneLookups = await Promise.all(uniqueGenes.map(gene => runToolTimed('gene_lookup', { query: gene, organism: 'any' })));
            geneLookups.forEach((r, i) => {
                stages.push({ name: `Gene: ${uniqueGenes[i]}`, ...r });
            });
            // ── Stage 4: Pathway Search ──
            const pathwayResults = await Promise.all(uniqueGenes.slice(0, 2).map(gene => runToolTimed('pathway_search', { query: gene })));
            pathwayResults.forEach((r, i) => {
                stages.push({ name: `Pathway: ${uniqueGenes[i]}`, ...r });
            });
            const pipelineDuration = Date.now() - pipelineStart;
            return [
                `# Genomic Analysis Pipeline`,
                `**Sequence type**: ${seqType} | **Length**: ${cleanSeq.length} ${seqType === 'dna' ? 'bp' : 'aa'}`,
                `**Total duration**: ${fmtDuration(pipelineDuration)} | **Stages**: ${stages.length}`,
                '',
                '## Pipeline Execution',
                '| Stage | Duration | Status |',
                '|-------|----------|--------|',
                ...stages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`),
                '',
                '---',
                '',
                '## 1. Sequence Properties',
                seqAnalysis.result.slice(0, 3000),
                '',
                ...(orfResult && !orfResult.error
                    ? ['## 2. Open Reading Frames', orfResult.result.slice(0, 3000), '']
                    : []),
                '',
                '## 3. Homology Search (BLAST)',
                blastResult.error
                    ? '*BLAST search failed or timed out. The NCBI BLAST queue may be busy; try again later.*'
                    : blastResult.result.slice(0, 4000),
                '',
                '## 4. Gene Identification',
                uniqueGenes.length > 0
                    ? `**Candidate genes**: ${uniqueGenes.join(', ')}\n\n` +
                        geneLookups.filter(r => !r.error).map(r => r.result.slice(0, 2000)).join('\n\n')
                    : '*No gene candidates extracted from BLAST results.*',
                '',
                '## 5. Pathway Mapping',
                pathwayResults.filter(r => !r.error).length > 0
                    ? pathwayResults.filter(r => !r.error).map(r => r.result.slice(0, 2000)).join('\n\n')
                    : '*No pathway data found for identified genes.*',
                '',
                '---',
                `*Generated by kbot genomic analysis pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 4. Environmental Assessment
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'environmental_assessment',
        description: 'Multi-source environmental analysis. Queries earthquake, climate, air quality, water resources, soil, and biodiversity data in parallel for a given location and synthesizes into an environmental health report.',
        parameters: {
            latitude: { type: 'number', description: 'Latitude of location', required: true },
            longitude: { type: 'number', description: 'Longitude of location', required: true },
            location_name: { type: 'string', description: 'Human-readable location name (optional, used in report header)' },
        },
        tier: 'free',
        timeout: 600_000,
        maxResultSize: 100_000,
        async execute(args) {
            const lat = Number(args.latitude);
            const lon = Number(args.longitude);
            const locationName = args.location_name ? String(args.location_name) : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            const pipelineStart = Date.now();
            // ── All stages run in parallel ──
            const [earthquakeRes, climateRes, airRes, waterRes, soilRes, bioRes,] = await Promise.all([
                runToolTimed('earthquake_query', {
                    latitude: lat,
                    longitude: lon,
                    radius_km: 200,
                    days: 365,
                    min_magnitude: 2.0,
                    limit: 20,
                }),
                runToolTimed('climate_data', {
                    latitude: lat,
                    longitude: lon,
                    variable: 'temperature',
                    period: 'monthly',
                }),
                runToolTimed('air_quality', {
                    latitude: lat,
                    longitude: lon,
                }),
                runToolTimed('water_resources', {
                    latitude: lat,
                    longitude: lon,
                    parameter: 'streamflow',
                    days: 30,
                }),
                runToolTimed('soil_data', {
                    latitude: lat,
                    longitude: lon,
                }),
                runToolTimed('biodiversity_index', {
                    latitude: lat,
                    longitude: lon,
                    radius_km: 50,
                }),
            ]);
            const allStages = [
                { name: 'Seismic Activity', ...earthquakeRes },
                { name: 'Climate Data', ...climateRes },
                { name: 'Air Quality', ...airRes },
                { name: 'Water Resources', ...waterRes },
                { name: 'Soil Properties', ...soilRes },
                { name: 'Biodiversity', ...bioRes },
            ];
            const pipelineDuration = Date.now() - pipelineStart;
            const successCount = allStages.filter(s => !s.error).length;
            // ── Synthesize environmental health score ──
            const concerns = [];
            const positives = [];
            // Check air quality
            if (!airRes.error) {
                if (airRes.result.match(/unhealthy|hazardous|very unhealthy/i)) {
                    concerns.push('Air quality is at unhealthy or hazardous levels');
                }
                else if (airRes.result.match(/good|moderate/i)) {
                    positives.push('Air quality is within acceptable ranges');
                }
            }
            // Check seismic activity
            if (!earthquakeRes.error) {
                const quakeCount = (earthquakeRes.result.match(/magnitude/gi) || []).length;
                if (quakeCount > 10) {
                    concerns.push(`High seismic activity: ${quakeCount}+ earthquakes in the past year within 200km`);
                }
                else if (quakeCount > 0) {
                    positives.push(`Moderate seismic activity: ${quakeCount} events recorded`);
                }
                else {
                    positives.push('Low seismic activity in the region');
                }
            }
            // Check biodiversity
            if (!bioRes.error) {
                const speciesMatch = bioRes.result.match(/(\d+)\s*species/i);
                if (speciesMatch) {
                    const count = parseInt(speciesMatch[1]);
                    if (count > 100)
                        positives.push(`Rich biodiversity: ${count}+ species recorded`);
                    else if (count < 10)
                        concerns.push(`Low recorded biodiversity: only ${count} species`);
                }
            }
            return [
                `# Environmental Assessment: ${locationName}`,
                `**Coordinates**: ${lat.toFixed(4)}N, ${lon.toFixed(4)}E`,
                `**Date**: ${new Date().toISOString().split('T')[0]}`,
                `**Total duration**: ${fmtDuration(pipelineDuration)} | **Data sources**: ${successCount}/${allStages.length} successful`,
                '',
                '## Pipeline Execution',
                '| Source | Duration | Status |',
                '|--------|----------|--------|',
                ...allStages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`),
                '',
                '---',
                '',
                '## Environmental Health Summary',
                '',
                concerns.length > 0 ? '**Concerns:**' : '',
                ...concerns.map(c => `- ${c}`),
                positives.length > 0 ? '\n**Positive Indicators:**' : '',
                ...positives.map(p => `- ${p}`),
                '',
                '## 1. Seismic Activity (past 12 months, 200km radius)',
                earthquakeRes.error ? '*Data unavailable*' : earthquakeRes.result.slice(0, 3000),
                '',
                '## 2. Climate Data',
                climateRes.error ? '*Data unavailable*' : climateRes.result.slice(0, 3000),
                '',
                '## 3. Air Quality',
                airRes.error ? '*Data unavailable*' : airRes.result.slice(0, 2000),
                '',
                '## 4. Water Resources',
                waterRes.error ? '*Data unavailable*' : waterRes.result.slice(0, 3000),
                '',
                '## 5. Soil Properties',
                soilRes.error ? '*Data unavailable*' : soilRes.result.slice(0, 3000),
                '',
                '## 6. Biodiversity',
                bioRes.error ? '*Data unavailable*' : bioRes.result.slice(0, 3000),
                '',
                '---',
                `*Generated by kbot environmental assessment pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 5. Materials Discovery
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'materials_discovery',
        description: 'Materials investigation pipeline. Chains: compound_search -> compound_properties -> material_properties -> crystal_structure -> thermodynamics_data. Finds a compound, gets properties, checks materials data, crystal info, and thermodynamic stability.',
        parameters: {
            formula: { type: 'string', description: 'Chemical formula or compound name (e.g., "TiO2", "silicon carbide")', required: true },
            target_property: { type: 'string', description: 'Target property focus: strength, conductivity, band_gap, thermal (optional)' },
        },
        tier: 'free',
        timeout: 600_000,
        maxResultSize: 100_000,
        async execute(args) {
            const formula = String(args.formula);
            const targetProp = args.target_property ? String(args.target_property) : undefined;
            const pipelineStart = Date.now();
            const stages = [];
            // ── Stage 1: Compound Search ──
            const compoundRes = await runToolTimed('compound_search', { query: formula });
            stages.push({ name: 'Compound Search', ...compoundRes });
            // Extract CID from result for subsequent queries
            const cidMatch = compoundRes.result.match(/CID[:\s]*(\d+)/i);
            const cid = cidMatch ? cidMatch[1] : undefined;
            // ── Stage 2: Compound Properties (parallel with material/crystal lookups) ──
            const [propsRes, materialRes, crystalRes] = await Promise.all([
                cid
                    ? runToolTimed('compound_properties', { cid })
                    : runToolTimed('compound_properties', { query: formula }),
                runToolTimed('material_properties', { formula, limit: 5 }),
                runToolTimed('crystal_structure', { query: formula, limit: 5 }),
            ]);
            stages.push({ name: 'Compound Properties', ...propsRes });
            stages.push({ name: 'Material Properties', ...materialRes });
            stages.push({ name: 'Crystal Structure', ...crystalRes });
            // ── Stage 3: Thermodynamic Data ──
            const thermoRes = await runToolTimed('thermodynamics_data', { compound: formula });
            stages.push({ name: 'Thermodynamics', ...thermoRes });
            // ── Stage 4: Element info for constituent elements ──
            const elementSymbols = extractElements(formula);
            const elementResults = await Promise.all(elementSymbols.slice(0, 4).map(el => runToolTimed('element_info', { element: el })));
            elementResults.forEach((r, i) => {
                stages.push({ name: `Element: ${elementSymbols[i]}`, ...r });
            });
            const pipelineDuration = Date.now() - pipelineStart;
            // Property-specific analysis
            let propertyFocus = '';
            if (targetProp) {
                const focusLabels = {
                    strength: 'Mechanical Strength',
                    conductivity: 'Electrical Conductivity',
                    band_gap: 'Band Gap / Electronic Properties',
                    thermal: 'Thermal Properties',
                };
                propertyFocus = `\n### Focus: ${focusLabels[targetProp] || targetProp}\n` +
                    extractPropertyInfo(materialRes.result + '\n' + thermoRes.result, targetProp);
            }
            return [
                `# Materials Discovery: ${formula}`,
                targetProp ? `**Target property**: ${targetProp}` : '',
                `**Total duration**: ${fmtDuration(pipelineDuration)} | **Stages**: ${stages.length}`,
                '',
                '## Pipeline Execution',
                '| Stage | Duration | Status |',
                '|-------|----------|--------|',
                ...stages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`),
                '',
                '---',
                '',
                '## 1. Compound Identification',
                compoundRes.error ? '*Compound not found in PubChem*' : compoundRes.result.slice(0, 2000),
                '',
                '## 2. Physicochemical Properties',
                propsRes.error ? '*Properties unavailable*' : propsRes.result.slice(0, 3000),
                '',
                '## 3. Materials Database',
                materialRes.error ? '*No Materials Project data found (may need MP_API_KEY)*' : materialRes.result.slice(0, 3000),
                '',
                '## 4. Crystal Structure',
                crystalRes.error ? '*No crystal structures found in COD*' : crystalRes.result.slice(0, 3000),
                '',
                '## 5. Thermodynamic Stability',
                thermoRes.error ? '*Thermodynamic data unavailable*' : thermoRes.result.slice(0, 2000),
                '',
                '## 6. Constituent Elements',
                elementResults.filter(r => !r.error).map(r => r.result.slice(0, 1000)).join('\n\n') || '*No element data retrieved*',
                propertyFocus,
                '',
                '---',
                `*Generated by kbot materials discovery pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].filter(Boolean).join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 6. Statistical Analysis
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'statistical_analysis',
        description: 'Complete data analysis workflow. Chains: distribution_fit -> hypothesis_test -> regression_analysis -> correlation_matrix -> viz_codegen. Fits distributions, tests hypotheses, models relationships, finds correlations, and generates visualization code.',
        parameters: {
            data: { type: 'string', description: 'JSON array of objects, e.g. [{"x":1,"y":2},{"x":3,"y":4}]', required: true },
            x_column: { type: 'string', description: 'Column name for independent variable', required: true },
            y_column: { type: 'string', description: 'Column name for dependent variable', required: true },
            groups: { type: 'string', description: 'Column name for grouping variable (optional, for group comparisons)' },
        },
        tier: 'free',
        timeout: 300_000,
        maxResultSize: 100_000,
        async execute(args) {
            const dataStr = String(args.data);
            const xCol = String(args.x_column);
            const yCol = String(args.y_column);
            const groupCol = args.groups ? String(args.groups) : undefined;
            const pipelineStart = Date.now();
            const stages = [];
            // Parse data
            let data;
            try {
                const parsed = JSON.parse(dataStr);
                if (!Array.isArray(parsed))
                    throw new Error('Data must be a JSON array');
                data = parsed;
            }
            catch (e) {
                return `**Error**: Could not parse data as JSON array. ${e instanceof Error ? e.message : String(e)}`;
            }
            if (data.length === 0)
                return '**Error**: Empty dataset provided.';
            // Extract numeric columns
            const xValues = data.map(d => Number(d[xCol])).filter(n => !isNaN(n));
            const yValues = data.map(d => Number(d[yCol])).filter(n => !isNaN(n));
            if (xValues.length === 0 || yValues.length === 0) {
                return `**Error**: Could not extract numeric values from columns "${xCol}" and/or "${yCol}".`;
            }
            const xStr = xValues.join(',');
            const yStr = yValues.join(',');
            // ── Stage 1: Distribution Fit ──
            const [xDistRes, yDistRes] = await Promise.all([
                runToolTimed('distribution_fit', { data: xStr, distributions: 'normal,lognormal,exponential,uniform' }),
                runToolTimed('distribution_fit', { data: yStr, distributions: 'normal,lognormal,exponential,uniform' }),
            ]);
            stages.push({ name: `Distribution Fit (${xCol})`, ...xDistRes });
            stages.push({ name: `Distribution Fit (${yCol})`, ...yDistRes });
            // ── Stage 2: Hypothesis Test ──
            const hypothesisRes = await runToolTimed('hypothesis_test', {
                test: 'two_sample_t',
                sample1: xStr,
                sample2: yStr,
                alpha: 0.05,
            });
            stages.push({ name: 'Hypothesis Test', ...hypothesisRes });
            // ── Stage 3: Regression Analysis + Correlation (parallel) ──
            const [regressionRes, correlationRes] = await Promise.all([
                runToolTimed('regression_analysis', {
                    x: xStr,
                    y: yStr,
                    model: 'linear',
                }),
                runToolTimed('correlation_matrix', {
                    data: dataStr,
                    columns: groupCol ? `${xCol},${yCol},${groupCol}` : `${xCol},${yCol}`,
                    method: 'pearson',
                }),
            ]);
            stages.push({ name: 'Regression Analysis', ...regressionRes });
            stages.push({ name: 'Correlation Matrix', ...correlationRes });
            // ── Stage 4: Visualization Code ──
            const vizRes = await runToolTimed('viz_codegen', {
                data: dataStr,
                chart_type: 'scatter',
                x: xCol,
                y: yCol,
                title: `${yCol} vs ${xCol}`,
                library: 'matplotlib',
            });
            stages.push({ name: 'Visualization', ...vizRes });
            const pipelineDuration = Date.now() - pipelineStart;
            return [
                `# Statistical Analysis: ${yCol} vs ${xCol}`,
                `**Observations**: ${data.length} | **Duration**: ${fmtDuration(pipelineDuration)}`,
                groupCol ? `**Grouping variable**: ${groupCol}` : '',
                '',
                '## Pipeline Execution',
                '| Stage | Duration | Status |',
                '|-------|----------|--------|',
                ...stages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`),
                '',
                '---',
                '',
                '## 1. Distribution Analysis',
                `### ${xCol}`,
                xDistRes.error ? '*Fitting failed*' : xDistRes.result.slice(0, 2000),
                '',
                `### ${yCol}`,
                yDistRes.error ? '*Fitting failed*' : yDistRes.result.slice(0, 2000),
                '',
                '## 2. Hypothesis Testing',
                hypothesisRes.error ? '*Test failed*' : hypothesisRes.result.slice(0, 2000),
                '',
                '## 3. Regression Analysis',
                regressionRes.error ? '*Regression failed*' : regressionRes.result.slice(0, 3000),
                '',
                '## 4. Correlation Matrix',
                correlationRes.error ? '*Correlation computation failed*' : correlationRes.result.slice(0, 2000),
                '',
                '## 5. Visualization Code',
                vizRes.error ? '*Code generation failed*' : vizRes.result.slice(0, 4000),
                '',
                '---',
                `*Generated by kbot statistical analysis pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].filter(Boolean).join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 7. Astronomy Investigation
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'astronomy_investigation',
        description: 'Celestial object deep dive. Chains: astronomy_query -> orbit_calculator -> physical_constants -> relativity_calc. Finds an object, calculates orbital parameters, looks up relevant physics, and computes relativistic effects.',
        parameters: {
            object: { type: 'string', description: 'Celestial object name or designation (e.g., "Proxima Centauri", "Jupiter", "GJ 1214 b")', required: true },
            investigation_type: { type: 'string', description: 'Investigation type: star, exoplanet, orbit, binary', required: true },
        },
        tier: 'free',
        timeout: 300_000,
        maxResultSize: 100_000,
        async execute(args) {
            const object = String(args.object);
            const invType = String(args.investigation_type || 'star');
            const pipelineStart = Date.now();
            const stages = [];
            // ── Stage 1: Astronomy Query (SIMBAD / object identification) ──
            const astroRes = await runToolTimed('astronomy_query', {
                object,
                catalog: 'simbad',
            });
            stages.push({ name: 'Object Identification', ...astroRes });
            // ── Stage 2: Orbit Calculator (for planets / exoplanets) ──
            let orbitRes = null;
            if (invType === 'exoplanet' || invType === 'orbit') {
                // Try to extract orbital parameters or use object name
                orbitRes = await runToolTimed('orbit_calculator', {
                    body: object.toLowerCase(),
                    calculation: 'orbital_elements',
                });
                stages.push({ name: 'Orbital Mechanics', ...orbitRes });
            }
            else if (invType === 'binary') {
                orbitRes = await runToolTimed('orbit_calculator', {
                    body: object.toLowerCase(),
                    calculation: 'binary_orbit',
                });
                stages.push({ name: 'Binary Orbit', ...orbitRes });
            }
            // ── Stage 3: Physical Constants (relevant to the investigation) ──
            const constantQueries = [];
            if (invType === 'star') {
                constantQueries.push('stefan-boltzmann', 'solar luminosity', 'solar mass');
            }
            else if (invType === 'exoplanet') {
                constantQueries.push('gravitational constant', 'earth mass', 'solar mass');
            }
            else if (invType === 'orbit') {
                constantQueries.push('gravitational constant', 'speed of light', 'astronomical unit');
            }
            else if (invType === 'binary') {
                constantQueries.push('gravitational constant', 'speed of light', 'solar mass');
            }
            const constantResults = await Promise.all(constantQueries.map(q => runToolTimed('physical_constants', { query: q })));
            constantResults.forEach((r, i) => {
                stages.push({ name: `Constant: ${constantQueries[i]}`, ...r });
            });
            // ── Stage 4: Relativistic Effects ──
            // Compute gravitational effects if we have mass data
            let relativityRes = null;
            if (invType === 'star' || invType === 'binary') {
                // Time dilation near the object
                relativityRes = await runToolTimed('relativity_calc', {
                    calculation: 'gravitational_time_dilation',
                    mass_kg: 1.989e30, // solar mass as default
                    radius_m: 6.957e8, // solar radius as default
                });
                stages.push({ name: 'Relativistic Effects', ...relativityRes });
            }
            else if (invType === 'exoplanet' || invType === 'orbit') {
                // Escape velocity / gravitational effects
                relativityRes = await runToolTimed('relativity_calc', {
                    calculation: 'escape_velocity',
                    mass_kg: 5.972e24, // earth mass as default
                    radius_m: 6.371e6, // earth radius as default
                });
                stages.push({ name: 'Relativistic Effects', ...relativityRes });
            }
            // ── Stage 5: Literature search for the object ──
            const litRes = await runToolTimed('literature_search', {
                query: `"${object}" astronomy`,
                database: 'openalex',
                limit: 5,
            });
            stages.push({ name: 'Recent Literature', ...litRes });
            const pipelineDuration = Date.now() - pipelineStart;
            return [
                `# Astronomy Investigation: ${object}`,
                `**Type**: ${invType} | **Duration**: ${fmtDuration(pipelineDuration)} | **Stages**: ${stages.length}`,
                '',
                '## Pipeline Execution',
                '| Stage | Duration | Status |',
                '|-------|----------|--------|',
                ...stages.map(s => `| ${s.name} | ${fmtDuration(s.durationMs)} | ${s.error ? 'Error' : 'OK'} |`),
                '',
                '---',
                '',
                '## 1. Object Identification',
                astroRes.error ? '*Object not found in SIMBAD database*' : astroRes.result.slice(0, 3000),
                '',
                ...(orbitRes
                    ? ['## 2. Orbital Mechanics', orbitRes.error ? '*Orbit data unavailable*' : orbitRes.result.slice(0, 3000), '']
                    : []),
                '',
                '## 3. Relevant Physical Constants',
                constantResults.filter(r => !r.error).map(r => r.result.slice(0, 500)).join('\n\n') || '*No constants retrieved*',
                '',
                '## 4. Relativistic Effects',
                relativityRes
                    ? (relativityRes.error ? '*Calculation failed*' : relativityRes.result.slice(0, 2000))
                    : '*Not applicable for this investigation type*',
                '',
                '## 5. Recent Literature',
                litRes.error ? '*Literature search failed*' : litRes.result.slice(0, 3000),
                '',
                '---',
                `*Generated by kbot astronomy investigation pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 8. Cross-Domain Search
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'cross_domain_search',
        description: 'Search across ALL scientific databases simultaneously: literature_search + pubmed_search + compound_search + gene_lookup + earthquake_query + astronomy_query in parallel. Finds connections across fields for a given topic.',
        parameters: {
            query: { type: 'string', description: 'Search query spanning scientific domains', required: true },
            max_results_per_source: { type: 'number', description: 'Max results per source (default 3)' },
        },
        tier: 'free',
        timeout: 300_000,
        maxResultSize: 100_000,
        async execute(args) {
            const query = String(args.query);
            const maxPerSource = typeof args.max_results_per_source === 'number'
                ? Math.min(args.max_results_per_source, 10)
                : 3;
            const pipelineStart = Date.now();
            // ── All sources in parallel ──
            const [litRes, pubmedRes, compoundRes, geneRes, earthquakeRes, astronomyRes,] = await Promise.all([
                runToolTimed('literature_search', {
                    query,
                    database: 'openalex',
                    limit: maxPerSource,
                }),
                runToolTimed('pubmed_search', {
                    query,
                    limit: maxPerSource,
                    sort: 'relevance',
                }),
                runToolTimed('compound_search', {
                    query,
                }),
                runToolTimed('gene_lookup', {
                    query,
                    organism: 'any',
                }),
                runToolTimed('earthquake_query', {
                    query,
                    days: 365,
                    limit: maxPerSource,
                }),
                runToolTimed('astronomy_query', {
                    object: query,
                    catalog: 'simbad',
                }),
            ]);
            const allSources = [
                { name: 'OpenAlex (Literature)', ...litRes, domain: 'Academic Literature' },
                { name: 'PubMed (Biomedical)', ...pubmedRes, domain: 'Biomedical Sciences' },
                { name: 'PubChem (Chemistry)', ...compoundRes, domain: 'Chemistry' },
                { name: 'NCBI Gene', ...geneRes, domain: 'Genomics' },
                { name: 'USGS (Seismic)', ...earthquakeRes, domain: 'Earth Science' },
                { name: 'SIMBAD (Astronomy)', ...astronomyRes, domain: 'Astronomy' },
            ];
            const pipelineDuration = Date.now() - pipelineStart;
            const hitSources = allSources.filter(s => !s.error && !s.result.includes('not found') && !s.result.includes('No '));
            const missSources = allSources.filter(s => s.error || s.result.includes('not found') || s.result.includes('No '));
            // ── Cross-domain connection analysis ──
            const connections = [];
            const allText = allSources.filter(s => !s.error).map(s => s.result).join('\n');
            // Look for shared terms across domains
            const domainsWithHits = hitSources.map(s => s.domain);
            if (domainsWithHits.length >= 3) {
                connections.push(`Query "${query}" has relevance across ${domainsWithHits.length} scientific domains: ${domainsWithHits.join(', ')}`);
            }
            if (domainsWithHits.length >= 2) {
                connections.push(`Cross-disciplinary potential: ${domainsWithHits.join(' + ')} intersection`);
            }
            if (domainsWithHits.length === 1) {
                connections.push(`Results concentrated in ${domainsWithHits[0]}; consider narrowing search for other domains`);
            }
            if (domainsWithHits.length === 0) {
                connections.push('No significant hits across any domain. Try a more specific or differently-phrased query.');
            }
            return [
                `# Cross-Domain Scientific Search: "${query}"`,
                `**Sources queried**: ${allSources.length} | **Hits**: ${hitSources.length} | **Duration**: ${fmtDuration(pipelineDuration)}`,
                `**Max results per source**: ${maxPerSource}`,
                '',
                '## Source Overview',
                '| Source | Domain | Duration | Status |',
                '|--------|--------|----------|--------|',
                ...allSources.map(s => `| ${s.name} | ${s.domain} | ${fmtDuration(s.durationMs)} | ${s.error ? 'No data' : 'Hit'} |`),
                '',
                '## Cross-Domain Connections',
                connections.map(c => `- ${c}`).join('\n'),
                '',
                '---',
                '',
                '## Results by Domain',
                '',
                ...allSources.map(s => [
                    `### ${s.name}`,
                    s.error
                        ? `*No results found in ${s.domain} for this query.*`
                        : s.result.slice(0, 2500),
                    '',
                ]).flat(),
                '---',
                `*Generated by kbot cross-domain search pipeline | ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
}
// ─── Utility Functions ──────────────────────────────────────────────────────
/** Extract key terms from combined text, excluding the search topic itself */
function extractKeyTerms(text, topic) {
    const topicWords = new Set(topic.toLowerCase().split(/\s+/));
    const stopWords = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
        'was', 'one', 'our', 'out', 'has', 'had', 'been', 'this', 'that', 'with',
        'from', 'have', 'were', 'they', 'their', 'which', 'will', 'each', 'about',
        'more', 'also', 'into', 'over', 'such', 'than', 'most', 'other', 'some',
        'time', 'very', 'when', 'come', 'could', 'made', 'after', 'only', 'these',
        'results', 'using', 'study', 'found', 'used', 'between', 'based', 'however',
        'showed', 'total', 'including', 'abstract', 'pubmed', 'doi', 'http', 'https',
        'journal', 'vol', 'page', 'author', 'year', 'title', 'published', 'article',
    ]);
    // Find capitalized multi-word terms (potential technical terms)
    const termCounts = new Map();
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        const word = words[i].replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        if (word.length < 3 || stopWords.has(word) || topicWords.has(word))
            continue;
        if (/^\d+$/.test(word))
            continue;
        // Check for multi-word terms (bigrams)
        if (i + 1 < words.length) {
            const next = words[i + 1].replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            if (next.length >= 3 && !stopWords.has(next) && !topicWords.has(next)) {
                const bigram = `${word} ${next}`;
                termCounts.set(bigram, (termCounts.get(bigram) || 0) + 1);
            }
        }
        termCounts.set(word, (termCounts.get(word) || 0) + 1);
    }
    return [...termCounts.entries()]
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([term, count]) => ({ term, count }));
}
/** Extract element symbols from a chemical formula */
function extractElements(formula) {
    const elementPattern = /([A-Z][a-z]?)/g;
    const matches = formula.match(elementPattern) || [];
    return [...new Set(matches)];
}
/** Extract property-specific information from results text */
function extractPropertyInfo(text, property) {
    const propKeywords = {
        strength: ['hardness', 'tensile', 'yield', 'modulus', 'elastic', 'bulk modulus', 'shear'],
        conductivity: ['conductivity', 'resistivity', 'band gap', 'semiconductor', 'metallic', 'insulator'],
        band_gap: ['band gap', 'band_gap', 'eV', 'direct gap', 'indirect gap', 'semiconductor', 'electronic'],
        thermal: ['thermal', 'heat capacity', 'melting', 'boiling', 'enthalpy', 'entropy', 'Cp', 'conductivity'],
    };
    const keywords = propKeywords[property] || [];
    const relevantLines = text.split('\n').filter(line => {
        const lower = line.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    });
    if (relevantLines.length === 0) {
        return `*No specific ${property} data found in the retrieved results. Consider checking specialized materials databases.*`;
    }
    return relevantLines.slice(0, 10).join('\n');
}
//# sourceMappingURL=research-pipeline.js.map