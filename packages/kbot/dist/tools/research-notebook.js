// kbot Research Notebook — Reproducible computation tracking & shareable notebooks
// Tracks every research step for full provenance. Exports to Jupyter, R Markdown,
// Markdown, HTML, and LaTeX. Zero external deps.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { registerTool } from './index.js';
// ── Storage helpers ──────────────────────────────────────────────────────────
const NOTEBOOKS_DIR = join(homedir(), '.kbot', 'research-notebooks');
function ensureDir() {
    if (!existsSync(NOTEBOOKS_DIR)) {
        mkdirSync(NOTEBOOKS_DIR, { recursive: true });
    }
}
function notebookPath(id) {
    return join(NOTEBOOKS_DIR, `${id}.json`);
}
function loadNotebook(id) {
    const p = notebookPath(id);
    if (!existsSync(p))
        return null;
    try {
        return JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch {
        return null;
    }
}
function saveNotebook(nb) {
    ensureDir();
    writeFileSync(notebookPath(nb.id), JSON.stringify(nb, null, 2));
}
function loadAllNotebooks() {
    ensureDir();
    const files = readdirSync(NOTEBOOKS_DIR).filter(f => f.endsWith('.json'));
    const notebooks = [];
    for (const f of files) {
        try {
            const nb = JSON.parse(readFileSync(join(NOTEBOOKS_DIR, f), 'utf-8'));
            notebooks.push(nb);
        }
        catch { /* skip corrupt files */ }
    }
    return notebooks;
}
const VALID_STEP_TYPES = ['observation', 'hypothesis', 'experiment', 'analysis', 'result', 'conclusion', 'note'];
function extractReferences(nb) {
    const refs = [];
    const seen = new Set();
    for (const step of nb.steps) {
        const text = `${step.content} ${step.data || ''}`;
        // DOIs
        const doiMatches = text.match(/\b10\.\d{4,}\/[^\s,;]+/g) || [];
        for (const doi of doiMatches) {
            const cleaned = doi.replace(/[.)>\]]+$/, '');
            if (!seen.has(`doi:${cleaned}`)) {
                seen.add(`doi:${cleaned}`);
                refs.push({ type: 'doi', value: cleaned, stepId: step.id });
            }
        }
        // PMIDs
        const pmidMatches = text.match(/PMID[:\s]*(\d{6,})/gi) || [];
        for (const m of pmidMatches) {
            const id = m.replace(/PMID[:\s]*/i, '');
            if (!seen.has(`pmid:${id}`)) {
                seen.add(`pmid:${id}`);
                refs.push({ type: 'pmid', value: id, stepId: step.id });
            }
        }
        // URLs (non-DOI)
        const urlMatches = text.match(/https?:\/\/[^\s,;)>\]]+/g) || [];
        for (const url of urlMatches) {
            const cleaned = url.replace(/[.)>\]]+$/, '');
            if (!seen.has(`url:${cleaned}`) && !cleaned.includes('doi.org')) {
                seen.add(`url:${cleaned}`);
                refs.push({ type: 'url', value: cleaned, stepId: step.id });
            }
        }
    }
    return refs;
}
function formatCitation(ref, style, index) {
    const num = index + 1;
    switch (style) {
        case 'apa':
            if (ref.type === 'doi')
                return `[${num}] https://doi.org/${ref.value}`;
            if (ref.type === 'pmid')
                return `[${num}] PubMed ID: ${ref.value}. https://pubmed.ncbi.nlm.nih.gov/${ref.value}/`;
            return `[${num}] Retrieved from ${ref.value}`;
        case 'mla':
            if (ref.type === 'doi')
                return `${num}. Web. doi:${ref.value}.`;
            if (ref.type === 'pmid')
                return `${num}. PubMed, PMID ${ref.value}.`;
            return `${num}. Web. <${ref.value}>.`;
        case 'chicago':
            if (ref.type === 'doi')
                return `${num}. https://doi.org/${ref.value}.`;
            if (ref.type === 'pmid')
                return `${num}. PubMed PMID: ${ref.value}. https://pubmed.ncbi.nlm.nih.gov/${ref.value}/.`;
            return `${num}. ${ref.value}.`;
        case 'bibtex': {
            const key = ref.type === 'doi' ? ref.value.replace(/[^a-zA-Z0-9]/g, '_') : `ref_${num}`;
            if (ref.type === 'doi')
                return `@article{${key},\n  doi = {${ref.value}},\n  url = {https://doi.org/${ref.value}}\n}`;
            if (ref.type === 'pmid')
                return `@article{pmid_${ref.value},\n  note = {PMID: ${ref.value}},\n  url = {https://pubmed.ncbi.nlm.nih.gov/${ref.value}/}\n}`;
            return `@misc{${key},\n  url = {${ref.value}}\n}`;
        }
        case 'vancouver':
            if (ref.type === 'doi')
                return `${num}. doi: ${ref.value}.`;
            if (ref.type === 'pmid')
                return `${num}. PubMed PMID: ${ref.value}.`;
            return `${num}. Available from: ${ref.value}.`;
        default:
            return `[${num}] ${ref.value}`;
    }
}
// ── Export helpers ────────────────────────────────────────────────────────────
function stepIcon(type) {
    const icons = {
        observation: 'eye',
        hypothesis: 'lightbulb',
        experiment: 'flask',
        analysis: 'chart',
        result: 'check',
        conclusion: 'star',
        note: 'memo',
    };
    return icons[type] || 'dot';
}
function stepToMarkdown(step) {
    const lines = [];
    const ts = new Date(step.timestamp).toLocaleString();
    lines.push(`### ${step.type.charAt(0).toUpperCase() + step.type.slice(1)} — ${ts}`);
    if (step.toolUsed)
        lines.push(`> Tool: \`${step.toolUsed}\``);
    lines.push('');
    lines.push(step.content);
    if (step.data) {
        lines.push('');
        lines.push('```');
        lines.push(step.data);
        lines.push('```');
    }
    if (step.duration_ms != null) {
        lines.push(`\n*Duration: ${step.duration_ms}ms*`);
    }
    lines.push('');
    return lines.join('\n');
}
function isCodeStep(step) {
    return ['experiment', 'analysis'].includes(step.type) && !!step.toolUsed;
}
function stepToPythonCode(step) {
    const lines = [];
    lines.push(`# Step: ${step.type} — ${step.toolUsed || 'manual'}`);
    // Reconstruct plausible Python code from tool usage
    const tool = step.toolUsed || '';
    if (tool.includes('regression') || tool.includes('stats')) {
        lines.push('from scipy import stats');
        lines.push('import numpy as np');
        lines.push('');
        lines.push('# Recreating analysis step');
        if (step.data) {
            lines.push(`data = """${step.data.slice(0, 500)}"""`);
            lines.push('# Parse and analyze data');
        }
        lines.push(`# ${step.content}`);
    }
    else if (tool.includes('plot') || tool.includes('chart') || tool.includes('visual')) {
        lines.push('import matplotlib.pyplot as plt');
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.data) {
            lines.push(`data = """${step.data.slice(0, 500)}"""`);
        }
    }
    else if (tool.includes('fetch') || tool.includes('search') || tool.includes('web')) {
        lines.push('import requests');
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.toolArgs) {
            const argsStr = JSON.stringify(step.toolArgs, null, 2);
            lines.push(`# Tool arguments: ${argsStr}`);
        }
    }
    else if (tool.includes('bash') || tool.includes('shell')) {
        lines.push('import subprocess');
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.data) {
            lines.push(`result = """${step.data.slice(0, 500)}"""`);
        }
    }
    else {
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.toolArgs) {
            lines.push(`# Tool: ${tool}`);
            lines.push(`# Args: ${JSON.stringify(step.toolArgs)}`);
        }
        if (step.data) {
            lines.push(`data = """${step.data.slice(0, 500)}"""`);
        }
    }
    return lines.join('\n');
}
function stepToRCode(step) {
    const lines = [];
    lines.push(`# Step: ${step.type} — ${step.toolUsed || 'manual'}`);
    const tool = step.toolUsed || '';
    if (tool.includes('regression') || tool.includes('stats')) {
        lines.push('library(stats)');
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.data) {
            lines.push(`data_raw <- "${step.data.slice(0, 300)}"`);
            lines.push('# Parse and analyze data');
        }
    }
    else if (tool.includes('plot') || tool.includes('chart') || tool.includes('visual')) {
        lines.push('library(ggplot2)');
        lines.push('');
        lines.push(`# ${step.content}`);
    }
    else {
        lines.push('');
        lines.push(`# ${step.content}`);
        if (step.data) {
            lines.push(`data_raw <- "${step.data.slice(0, 300)}"`);
        }
    }
    return lines.join('\n');
}
function exportJupyter(nb) {
    const cells = [];
    // Title cell
    cells.push({
        cell_type: 'markdown',
        metadata: {},
        source: [
            `# ${nb.title}\n`,
            `\n`,
            `${nb.description}\n`,
            `\n`,
            `**Field**: ${nb.field || 'General'}\n`,
            `**Tags**: ${nb.tags.join(', ') || 'none'}\n`,
            `**Created**: ${nb.created}\n`,
            `**Modified**: ${nb.modified}\n`,
        ],
    });
    for (const step of nb.steps) {
        if (isCodeStep(step)) {
            // Markdown description
            cells.push({
                cell_type: 'markdown',
                metadata: {},
                source: [`## ${step.type.charAt(0).toUpperCase() + step.type.slice(1)}\n`, `\n`, `${step.content}\n`],
            });
            // Code cell
            const code = stepToPythonCode(step);
            cells.push({
                cell_type: 'code',
                metadata: {},
                source: code.split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l),
                execution_count: null,
                outputs: [],
            });
        }
        else {
            cells.push({
                cell_type: 'markdown',
                metadata: {},
                source: [
                    `## ${step.type.charAt(0).toUpperCase() + step.type.slice(1)}\n`,
                    `\n`,
                    `${step.content}\n`,
                    ...(step.data ? [`\n`, '```\n', `${step.data}\n`, '```\n'] : []),
                    ...(step.toolUsed ? [`\n`, `*Tool: ${step.toolUsed}*\n`] : []),
                ],
            });
        }
    }
    const ipynb = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {
            kernelspec: {
                display_name: 'Python 3',
                language: 'python',
                name: 'python3',
            },
            language_info: {
                name: 'python',
                version: '3.11.0',
            },
            kbot: {
                notebook_id: nb.id,
                exported: new Date().toISOString(),
            },
        },
        cells,
    };
    return JSON.stringify(ipynb, null, 2);
}
function exportRMarkdown(nb) {
    const lines = [];
    // YAML front matter
    lines.push('---');
    lines.push(`title: "${nb.title}"`);
    lines.push(`date: "${nb.created}"`);
    lines.push('output:');
    lines.push('  html_document:');
    lines.push('    toc: true');
    lines.push('    toc_float: true');
    if (nb.field)
        lines.push(`params:`);
    if (nb.field)
        lines.push(`  field: "${nb.field}"`);
    lines.push('---');
    lines.push('');
    lines.push(`# ${nb.title}`);
    lines.push('');
    lines.push(nb.description);
    lines.push('');
    for (const step of nb.steps) {
        const ts = new Date(step.timestamp).toLocaleString();
        lines.push(`## ${step.type.charAt(0).toUpperCase() + step.type.slice(1)} — ${ts}`);
        lines.push('');
        lines.push(step.content);
        lines.push('');
        if (isCodeStep(step)) {
            lines.push('```{r}');
            lines.push(stepToRCode(step));
            lines.push('```');
            lines.push('');
        }
        else if (step.data) {
            lines.push('```');
            lines.push(step.data);
            lines.push('```');
            lines.push('');
        }
        if (step.toolUsed) {
            lines.push(`*Tool: ${step.toolUsed}*`);
            lines.push('');
        }
    }
    return lines.join('\n');
}
function exportMarkdown(nb) {
    const lines = [];
    lines.push(`# ${nb.title}`);
    lines.push('');
    lines.push(nb.description);
    lines.push('');
    lines.push(`**Field**: ${nb.field || 'General'} | **Tags**: ${nb.tags.join(', ') || 'none'}`);
    lines.push(`**Created**: ${nb.created} | **Modified**: ${nb.modified}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    for (const step of nb.steps) {
        lines.push(stepToMarkdown(step));
    }
    return lines.join('\n');
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function exportHtml(nb) {
    const stepTypeColor = {
        observation: '#4a90d9',
        hypothesis: '#e8a838',
        experiment: '#7b68ee',
        analysis: '#50c878',
        result: '#ff6b6b',
        conclusion: '#6b5b95',
        note: '#999',
    };
    let stepsHtml = '';
    for (const step of nb.steps) {
        const ts = new Date(step.timestamp).toLocaleString();
        const color = stepTypeColor[step.type] || '#666';
        const label = step.type.charAt(0).toUpperCase() + step.type.slice(1);
        stepsHtml += `
    <div style="margin-bottom:24px;padding:16px;border-left:4px solid ${color};background:#fafafa;border-radius:0 6px 6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:bold;color:${color};font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</span>
        <span style="color:#888;font-size:12px;">${escapeHtml(ts)}</span>
      </div>
      <p style="margin:0 0 8px 0;line-height:1.6;">${escapeHtml(step.content)}</p>
      ${step.toolUsed ? `<div style="font-size:12px;color:#666;margin-top:4px;">Tool: <code>${escapeHtml(step.toolUsed)}</code></div>` : ''}
      ${step.data ? `<pre style="background:#f0f0f0;padding:12px;border-radius:4px;overflow-x:auto;font-size:13px;margin-top:8px;">${escapeHtml(step.data)}</pre>` : ''}
      ${step.duration_ms != null ? `<div style="font-size:11px;color:#aaa;margin-top:4px;">Duration: ${step.duration_ms}ms</div>` : ''}
    </div>`;
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(nb.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.6; }
    h1 { margin-bottom: 8px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <h1>${escapeHtml(nb.title)}</h1>
  <div class="meta">
    <span><strong>Field:</strong> ${escapeHtml(nb.field || 'General')}</span>
    <span><strong>Tags:</strong> ${escapeHtml(nb.tags.join(', ') || 'none')}</span>
    <span><strong>Steps:</strong> ${nb.steps.length}</span>
  </div>
  <p>${escapeHtml(nb.description)}</p>
  <hr>
  ${stepsHtml}
  <hr>
  <div style="font-size:12px;color:#aaa;text-align:center;margin-top:24px;">
    Generated by K:BOT Research Notebook &mdash; ${new Date().toISOString()}
  </div>
</body>
</html>`;
}
function escapeLatex(text) {
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/[&%$#_{}]/g, m => '\\' + m)
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}
function exportLatex(nb) {
    const lines = [];
    lines.push('\\documentclass[12pt,a4paper]{article}');
    lines.push('\\usepackage[utf8]{inputenc}');
    lines.push('\\usepackage[T1]{fontenc}');
    lines.push('\\usepackage{geometry}');
    lines.push('\\geometry{margin=1in}');
    lines.push('\\usepackage{hyperref}');
    lines.push('\\usepackage{listings}');
    lines.push('\\usepackage{xcolor}');
    lines.push('\\usepackage{graphicx}');
    lines.push('');
    lines.push('\\lstset{');
    lines.push('  basicstyle=\\ttfamily\\small,');
    lines.push('  breaklines=true,');
    lines.push('  frame=single,');
    lines.push('  backgroundcolor=\\color{gray!10}');
    lines.push('}');
    lines.push('');
    lines.push(`\\title{${escapeLatex(nb.title)}}`);
    lines.push(`\\date{${escapeLatex(nb.created)}}`);
    lines.push('');
    lines.push('\\begin{document}');
    lines.push('\\maketitle');
    lines.push('');
    lines.push('\\begin{abstract}');
    lines.push(escapeLatex(nb.description));
    lines.push('\\end{abstract}');
    lines.push('');
    if (nb.field || nb.tags.length > 0) {
        lines.push('\\noindent');
        if (nb.field)
            lines.push(`\\textbf{Field:} ${escapeLatex(nb.field)} \\\\`);
        if (nb.tags.length > 0)
            lines.push(`\\textbf{Tags:} ${escapeLatex(nb.tags.join(', '))} \\\\`);
        lines.push('');
    }
    lines.push('\\tableofcontents');
    lines.push('\\newpage');
    lines.push('');
    for (const step of nb.steps) {
        const ts = new Date(step.timestamp).toLocaleString();
        const label = step.type.charAt(0).toUpperCase() + step.type.slice(1);
        lines.push(`\\section{${escapeLatex(label)}}`);
        lines.push(`\\label{step:${step.id}}`);
        lines.push(`{\\small\\textit{${escapeLatex(ts)}}}`);
        lines.push('');
        lines.push(escapeLatex(step.content));
        lines.push('');
        if (step.toolUsed) {
            lines.push(`\\noindent\\textbf{Tool:} \\texttt{${escapeLatex(step.toolUsed)}}`);
            lines.push('');
        }
        if (step.data) {
            lines.push('\\begin{lstlisting}');
            lines.push(step.data);
            lines.push('\\end{lstlisting}');
            lines.push('');
        }
        if (step.duration_ms != null) {
            lines.push(`{\\footnotesize Duration: ${step.duration_ms}ms}`);
            lines.push('');
        }
    }
    lines.push('\\end{document}');
    return lines.join('\n');
}
function buildProvenanceDAG(nb) {
    const nodes = nb.steps.map(step => ({
        stepId: step.id,
        stepType: step.type,
        tool: step.toolUsed,
        inputsFrom: [],
        outputsTo: [],
        hasData: !!step.data,
        hasToolArgs: !!step.toolArgs && Object.keys(step.toolArgs).length > 0,
    }));
    // Build edges: experiments/analyses consume earlier observations/hypotheses/results
    // Results flow from experiments/analyses
    // Conclusions consume results
    const dataProducers = new Set();
    for (let i = 0; i < nb.steps.length; i++) {
        const step = nb.steps[i];
        const node = nodes[i];
        // Steps that produce data
        if (step.data && ['experiment', 'analysis', 'result', 'observation'].includes(step.type)) {
            dataProducers.add(step.id);
        }
        // Link experiments/analyses to prior observations/hypotheses
        if (['experiment', 'analysis'].includes(step.type)) {
            for (let j = i - 1; j >= 0; j--) {
                const prior = nb.steps[j];
                if (['observation', 'hypothesis'].includes(prior.type)) {
                    node.inputsFrom.push(prior.id);
                    nodes[j].outputsTo.push(step.id);
                }
                // Link to prior data-producing steps
                if (prior.data && dataProducers.has(prior.id) && prior.id !== step.id) {
                    if (!node.inputsFrom.includes(prior.id)) {
                        node.inputsFrom.push(prior.id);
                        nodes[j].outputsTo.push(step.id);
                    }
                }
            }
        }
        // Results consume experiments/analyses
        if (step.type === 'result') {
            for (let j = i - 1; j >= 0; j--) {
                const prior = nb.steps[j];
                if (['experiment', 'analysis'].includes(prior.type)) {
                    node.inputsFrom.push(prior.id);
                    nodes[j].outputsTo.push(step.id);
                    break; // link to most recent experiment/analysis
                }
            }
        }
        // Conclusions consume results
        if (step.type === 'conclusion') {
            for (let j = i - 1; j >= 0; j--) {
                const prior = nb.steps[j];
                if (prior.type === 'result') {
                    node.inputsFrom.push(prior.id);
                    nodes[j].outputsTo.push(step.id);
                }
            }
        }
    }
    return nodes;
}
// ── Tool Registration ────────────────────────────────────────────────────────
export function registerResearchNotebookTools() {
    // ── 1. notebook_create ─────────────────────────────────────────────────
    registerTool({
        name: 'notebook_create',
        description: 'Create a new research notebook for tracking computations, experiments, and findings. Returns a notebook ID for subsequent logging.',
        parameters: {
            title: { type: 'string', description: 'Title of the research notebook', required: true },
            description: { type: 'string', description: 'Description of the research purpose and scope', required: true },
            field: { type: 'string', description: 'Research field (e.g., biology, physics, data-science)' },
            tags: { type: 'string', description: 'Comma-separated tags for categorization' },
        },
        tier: 'free',
        async execute(args) {
            const title = String(args.title).trim();
            const description = String(args.description).trim();
            if (!title)
                return 'Error: title is required';
            if (!description)
                return 'Error: description is required';
            const now = new Date().toISOString();
            const id = randomUUID().slice(0, 8);
            const nb = {
                id,
                title,
                description,
                field: args.field ? String(args.field).trim() : undefined,
                tags: args.tags ? String(args.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
                created: now,
                modified: now,
                steps: [],
            };
            saveNotebook(nb);
            return [
                `## Notebook Created`,
                '',
                `**ID**: \`${id}\``,
                `**Title**: ${title}`,
                `**Description**: ${description}`,
                nb.field ? `**Field**: ${nb.field}` : '',
                nb.tags.length > 0 ? `**Tags**: ${nb.tags.join(', ')}` : '',
                '',
                `Use \`notebook_log\` with notebook_id \`${id}\` to record research steps.`,
            ].filter(Boolean).join('\n');
        },
    });
    // ── 2. notebook_log ────────────────────────────────────────────────────
    registerTool({
        name: 'notebook_log',
        description: 'Log a research step (observation, hypothesis, experiment, analysis, result, conclusion, or note) into a notebook. Timestamps every entry and tracks tool usage for reproducibility.',
        parameters: {
            notebook_id: { type: 'string', description: 'Notebook ID to log into', required: true },
            step_type: { type: 'string', description: 'Step type: observation, hypothesis, experiment, analysis, result, conclusion, or note', required: true },
            content: { type: 'string', description: 'Description of what was done or observed', required: true },
            tool_used: { type: 'string', description: 'Name of the tool used for this step (e.g., web_search, regression_analysis)' },
            data: { type: 'string', description: 'Raw data, output, or results to store for reproducibility' },
        },
        tier: 'free',
        async execute(args) {
            const notebookId = String(args.notebook_id).trim();
            const nb = loadNotebook(notebookId);
            if (!nb)
                return `Error: Notebook \`${notebookId}\` not found`;
            const stepType = String(args.step_type).trim().toLowerCase();
            if (!VALID_STEP_TYPES.includes(stepType)) {
                return `Error: Invalid step_type "${stepType}". Valid types: ${VALID_STEP_TYPES.join(', ')}`;
            }
            const content = String(args.content).trim();
            if (!content)
                return 'Error: content is required';
            const step = {
                id: randomUUID().slice(0, 8),
                timestamp: new Date().toISOString(),
                type: stepType,
                content,
                toolUsed: args.tool_used ? String(args.tool_used).trim() : undefined,
                data: args.data ? String(args.data) : undefined,
            };
            nb.steps.push(step);
            nb.modified = new Date().toISOString();
            saveNotebook(nb);
            const typeIcon = {
                observation: '[OBS]',
                hypothesis: '[HYP]',
                experiment: '[EXP]',
                analysis: '[ANA]',
                result: '[RES]',
                conclusion: '[CON]',
                note: '[NOTE]',
            };
            return [
                `${typeIcon[stepType]} Step logged to **${nb.title}**`,
                '',
                `**Step ID**: \`${step.id}\``,
                `**Type**: ${stepType}`,
                `**Content**: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`,
                step.toolUsed ? `**Tool**: ${step.toolUsed}` : '',
                step.data ? `**Data**: ${step.data.slice(0, 100)}${step.data.length > 100 ? '...' : ''}` : '',
                '',
                `Notebook now has ${nb.steps.length} step${nb.steps.length === 1 ? '' : 's'}.`,
            ].filter(Boolean).join('\n');
        },
    });
    // ── 3. notebook_list ───────────────────────────────────────────────────
    registerTool({
        name: 'notebook_list',
        description: 'List all research notebooks. Filter by field, sort by date or title.',
        parameters: {
            field: { type: 'string', description: 'Filter notebooks by research field' },
            sort: { type: 'string', description: 'Sort order: date (default) or title', default: 'date' },
        },
        tier: 'free',
        async execute(args) {
            let notebooks = loadAllNotebooks();
            if (notebooks.length === 0) {
                return 'No research notebooks found. Use `notebook_create` to start one.';
            }
            // Filter by field
            if (args.field) {
                const field = String(args.field).toLowerCase();
                notebooks = notebooks.filter(nb => nb.field?.toLowerCase().includes(field));
                if (notebooks.length === 0) {
                    return `No notebooks found in field "${args.field}".`;
                }
            }
            // Sort
            const sortBy = String(args.sort || 'date').toLowerCase();
            if (sortBy === 'title') {
                notebooks.sort((a, b) => a.title.localeCompare(b.title));
            }
            else {
                notebooks.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
            }
            const lines = ['## Research Notebooks', ''];
            lines.push(`| ID | Title | Steps | Field | Tags | Modified |`);
            lines.push(`|----|-------|-------|-------|------|----------|`);
            for (const nb of notebooks) {
                const modified = new Date(nb.modified).toLocaleDateString();
                lines.push(`| \`${nb.id}\` | ${nb.title} | ${nb.steps.length} | ${nb.field || '-'} | ${nb.tags.join(', ') || '-'} | ${modified} |`);
            }
            lines.push('');
            lines.push(`**Total**: ${notebooks.length} notebook${notebooks.length === 1 ? '' : 's'}`);
            return lines.join('\n');
        },
    });
    // ── 4. notebook_view ───────────────────────────────────────────────────
    registerTool({
        name: 'notebook_view',
        description: 'View a research notebook contents. Formats: full (all steps with data), summary (key findings only), timeline (chronological step list).',
        parameters: {
            notebook_id: { type: 'string', description: 'Notebook ID to view', required: true },
            format: { type: 'string', description: 'View format: full, summary, or timeline', default: 'full' },
        },
        tier: 'free',
        async execute(args) {
            const notebookId = String(args.notebook_id).trim();
            const nb = loadNotebook(notebookId);
            if (!nb)
                return `Error: Notebook \`${notebookId}\` not found`;
            const format = String(args.format || 'full').toLowerCase();
            const header = [
                `# ${nb.title}`,
                '',
                nb.description,
                '',
                `**Field**: ${nb.field || 'General'} | **Tags**: ${nb.tags.join(', ') || 'none'}`,
                `**Created**: ${nb.created} | **Steps**: ${nb.steps.length}`,
                '',
                '---',
                '',
            ].join('\n');
            if (nb.steps.length === 0) {
                return header + '\n*No steps recorded yet. Use `notebook_log` to add research steps.*';
            }
            if (format === 'summary') {
                // Show only observations, results, conclusions
                const keyTypes = ['observation', 'result', 'conclusion'];
                const keySteps = nb.steps.filter(s => keyTypes.includes(s.type));
                if (keySteps.length === 0) {
                    return header + '*No key findings yet (observations, results, or conclusions).*';
                }
                const lines = keySteps.map(step => {
                    const label = step.type.charAt(0).toUpperCase() + step.type.slice(1);
                    return `### ${label}\n${step.content}${step.data ? `\n\`\`\`\n${step.data}\n\`\`\`` : ''}\n`;
                });
                return header + lines.join('\n');
            }
            if (format === 'timeline') {
                const lines = nb.steps.map((step, i) => {
                    const ts = new Date(step.timestamp).toLocaleString();
                    const label = step.type.toUpperCase().padEnd(11);
                    const tool = step.toolUsed ? ` [${step.toolUsed}]` : '';
                    return `${String(i + 1).padStart(3)}. ${ts}  ${label}  ${step.content.slice(0, 80)}${step.content.length > 80 ? '...' : ''}${tool}`;
                });
                return header + lines.join('\n');
            }
            // Full view
            const stepsMarkdown = nb.steps.map(step => stepToMarkdown(step)).join('\n');
            return header + stepsMarkdown;
        },
    });
    // ── 5. notebook_export ─────────────────────────────────────────────────
    registerTool({
        name: 'notebook_export',
        description: 'Export a research notebook as a reproducible document. Formats: jupyter (.ipynb with Python code cells), rmarkdown (.Rmd with R code chunks), markdown, html (self-contained), latex (journal-ready).',
        parameters: {
            notebook_id: { type: 'string', description: 'Notebook ID to export', required: true },
            format: { type: 'string', description: 'Export format: jupyter, rmarkdown, markdown, html, or latex', required: true },
        },
        tier: 'free',
        async execute(args) {
            const notebookId = String(args.notebook_id).trim();
            const nb = loadNotebook(notebookId);
            if (!nb)
                return `Error: Notebook \`${notebookId}\` not found`;
            const format = String(args.format).toLowerCase().trim();
            const validFormats = ['jupyter', 'rmarkdown', 'markdown', 'html', 'latex'];
            if (!validFormats.includes(format)) {
                return `Error: Invalid format "${format}". Valid formats: ${validFormats.join(', ')}`;
            }
            if (nb.steps.length === 0) {
                return `Error: Notebook \`${notebookId}\` has no steps to export.`;
            }
            let content;
            let ext;
            switch (format) {
                case 'jupyter':
                    content = exportJupyter(nb);
                    ext = 'ipynb';
                    break;
                case 'rmarkdown':
                    content = exportRMarkdown(nb);
                    ext = 'Rmd';
                    break;
                case 'markdown':
                    content = exportMarkdown(nb);
                    ext = 'md';
                    break;
                case 'html':
                    content = exportHtml(nb);
                    ext = 'html';
                    break;
                case 'latex':
                    content = exportLatex(nb);
                    ext = 'tex';
                    break;
                default:
                    return `Error: Unknown format "${format}"`;
            }
            // Write the exported file next to the notebook
            const sanitizedTitle = nb.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
            const exportPath = join(NOTEBOOKS_DIR, `${sanitizedTitle}_${nb.id}.${ext}`);
            writeFileSync(exportPath, content);
            return [
                `## Notebook Exported`,
                '',
                `**Format**: ${format}`,
                `**File**: \`${exportPath}\``,
                `**Steps**: ${nb.steps.length}`,
                `**Size**: ${(content.length / 1024).toFixed(1)} KB`,
                '',
                format === 'jupyter' ? 'Open with `jupyter notebook` or JupyterLab to run the Python cells.' : '',
                format === 'rmarkdown' ? 'Open with RStudio or knit with `rmarkdown::render()`.' : '',
                format === 'html' ? 'Open in any web browser. Self-contained, no external dependencies.' : '',
                format === 'latex' ? 'Compile with `pdflatex` or `xelatex`. Suitable for journal submission.' : '',
                format === 'markdown' ? 'Compatible with any Markdown viewer or converter.' : '',
            ].filter(Boolean).join('\n');
        },
    });
    // ── 6. notebook_search ─────────────────────────────────────────────────
    registerTool({
        name: 'notebook_search',
        description: 'Search across all research notebooks for specific content, tools, or findings.',
        parameters: {
            query: { type: 'string', description: 'Search query', required: true },
            search_in: { type: 'string', description: 'Where to search: all, titles, content, tools, or tags', default: 'all' },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.query).toLowerCase().trim();
            if (!query)
                return 'Error: query is required';
            const searchIn = String(args.search_in || 'all').toLowerCase();
            const validTargets = ['all', 'titles', 'content', 'tools', 'tags'];
            if (!validTargets.includes(searchIn)) {
                return `Error: Invalid search_in "${searchIn}". Valid: ${validTargets.join(', ')}`;
            }
            const notebooks = loadAllNotebooks();
            if (notebooks.length === 0)
                return 'No notebooks to search.';
            const hits = [];
            for (const nb of notebooks) {
                // Search titles
                if ((searchIn === 'all' || searchIn === 'titles') && nb.title.toLowerCase().includes(query)) {
                    hits.push({
                        notebookId: nb.id,
                        notebookTitle: nb.title,
                        location: 'title',
                        match: nb.title,
                    });
                }
                // Search description
                if ((searchIn === 'all' || searchIn === 'content') && nb.description.toLowerCase().includes(query)) {
                    hits.push({
                        notebookId: nb.id,
                        notebookTitle: nb.title,
                        location: 'description',
                        match: nb.description.slice(0, 150),
                    });
                }
                // Search tags
                if ((searchIn === 'all' || searchIn === 'tags')) {
                    for (const tag of nb.tags) {
                        if (tag.toLowerCase().includes(query)) {
                            hits.push({
                                notebookId: nb.id,
                                notebookTitle: nb.title,
                                location: 'tag',
                                match: tag,
                            });
                            break;
                        }
                    }
                }
                // Search steps
                for (const step of nb.steps) {
                    // Content search
                    if ((searchIn === 'all' || searchIn === 'content') && step.content.toLowerCase().includes(query)) {
                        hits.push({
                            notebookId: nb.id,
                            notebookTitle: nb.title,
                            location: `step ${step.id} (${step.type})`,
                            match: step.content.slice(0, 150),
                        });
                    }
                    // Data search
                    if ((searchIn === 'all' || searchIn === 'content') && step.data?.toLowerCase().includes(query)) {
                        hits.push({
                            notebookId: nb.id,
                            notebookTitle: nb.title,
                            location: `step ${step.id} data`,
                            match: (step.data || '').slice(0, 150),
                        });
                    }
                    // Tool search
                    if ((searchIn === 'all' || searchIn === 'tools') && step.toolUsed?.toLowerCase().includes(query)) {
                        hits.push({
                            notebookId: nb.id,
                            notebookTitle: nb.title,
                            location: `step ${step.id}`,
                            match: `Tool: ${step.toolUsed}`,
                        });
                    }
                }
            }
            if (hits.length === 0) {
                return `No results for "${query}" in ${searchIn === 'all' ? 'any notebooks' : searchIn}.`;
            }
            // Group by notebook
            const grouped = new Map();
            for (const hit of hits) {
                const key = hit.notebookId;
                if (!grouped.has(key))
                    grouped.set(key, []);
                grouped.get(key).push(hit);
            }
            const lines = [
                `## Search Results for "${query}"`,
                '',
                `**Found**: ${hits.length} match${hits.length === 1 ? '' : 'es'} across ${grouped.size} notebook${grouped.size === 1 ? '' : 's'}`,
                '',
            ];
            for (const [nbId, nbHits] of grouped) {
                const title = nbHits[0].notebookTitle;
                lines.push(`### ${title} (\`${nbId}\`)`);
                for (const hit of nbHits.slice(0, 10)) {
                    lines.push(`- **${hit.location}**: ${hit.match}${hit.match.length >= 150 ? '...' : ''}`);
                }
                if (nbHits.length > 10) {
                    lines.push(`- *+${nbHits.length - 10} more matches*`);
                }
                lines.push('');
            }
            return lines.join('\n');
        },
    });
    // ── 7. notebook_cite ───────────────────────────────────────────────────
    registerTool({
        name: 'notebook_cite',
        description: 'Generate citations for papers and data sources referenced in a research notebook. Scans for DOIs, PMIDs, and URLs, then formats them in the requested citation style.',
        parameters: {
            notebook_id: { type: 'string', description: 'Notebook ID to generate citations for', required: true },
            style: { type: 'string', description: 'Citation style: apa, mla, chicago, bibtex, or vancouver', required: true },
        },
        tier: 'free',
        async execute(args) {
            const notebookId = String(args.notebook_id).trim();
            const nb = loadNotebook(notebookId);
            if (!nb)
                return `Error: Notebook \`${notebookId}\` not found`;
            const style = String(args.style).toLowerCase().trim();
            const validStyles = ['apa', 'mla', 'chicago', 'bibtex', 'vancouver'];
            if (!validStyles.includes(style)) {
                return `Error: Invalid style "${style}". Valid styles: ${validStyles.join(', ')}`;
            }
            const refs = extractReferences(nb);
            if (refs.length === 0) {
                return [
                    `## Citations — ${nb.title}`,
                    '',
                    'No DOIs, PMIDs, or URLs found in notebook steps.',
                    '',
                    'To generate citations, include references in your step content or data:',
                    '- DOIs: `10.1234/example.2024`',
                    '- PubMed IDs: `PMID: 12345678`',
                    '- URLs: `https://example.com/paper`',
                ].join('\n');
            }
            const lines = [
                `## References — ${nb.title}`,
                `**Style**: ${style.toUpperCase()} | **Sources found**: ${refs.length}`,
                '',
            ];
            if (style === 'bibtex') {
                lines.push('```bibtex');
                for (let i = 0; i < refs.length; i++) {
                    lines.push(formatCitation(refs[i], style, i));
                    lines.push('');
                }
                lines.push('```');
            }
            else {
                for (let i = 0; i < refs.length; i++) {
                    lines.push(formatCitation(refs[i], style, i));
                }
            }
            // Breakdown by type
            const dois = refs.filter(r => r.type === 'doi').length;
            const pmids = refs.filter(r => r.type === 'pmid').length;
            const urls = refs.filter(r => r.type === 'url').length;
            lines.push('');
            lines.push('---');
            lines.push(`**DOIs**: ${dois} | **PMIDs**: ${pmids} | **URLs**: ${urls}`);
            return lines.join('\n');
        },
    });
    // ── 8. notebook_provenance ─────────────────────────────────────────────
    registerTool({
        name: 'notebook_provenance',
        description: 'Generate a complete data provenance report for a research notebook. Traces every data input, transformation, and output. Builds a DAG of data flow and flags unlogged modifications.',
        parameters: {
            notebook_id: { type: 'string', description: 'Notebook ID to trace provenance for', required: true },
        },
        tier: 'free',
        async execute(args) {
            const notebookId = String(args.notebook_id).trim();
            const nb = loadNotebook(notebookId);
            if (!nb)
                return `Error: Notebook \`${notebookId}\` not found`;
            if (nb.steps.length === 0) {
                return `Notebook \`${notebookId}\` has no steps. Nothing to trace.`;
            }
            const dag = buildProvenanceDAG(nb);
            const lines = [
                `# Data Provenance Report`,
                `## ${nb.title}`,
                '',
                `**Notebook ID**: \`${nb.id}\``,
                `**Steps**: ${nb.steps.length}`,
                `**Period**: ${nb.created} to ${nb.modified}`,
                '',
                '---',
                '',
            ];
            // ── Tool Usage Summary ──
            const toolCounts = new Map();
            for (const step of nb.steps) {
                if (step.toolUsed) {
                    toolCounts.set(step.toolUsed, (toolCounts.get(step.toolUsed) || 0) + 1);
                }
            }
            lines.push('## Tool Usage');
            if (toolCounts.size === 0) {
                lines.push('No tools recorded in any steps.');
            }
            else {
                lines.push('| Tool | Uses | Steps |');
                lines.push('|------|------|-------|');
                const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]);
                for (const [tool, count] of sortedTools) {
                    const stepIds = nb.steps.filter(s => s.toolUsed === tool).map(s => s.id).join(', ');
                    lines.push(`| \`${tool}\` | ${count} | ${stepIds} |`);
                }
            }
            lines.push('');
            // ── Execution Order ──
            lines.push('## Execution Order');
            for (let i = 0; i < nb.steps.length; i++) {
                const step = nb.steps[i];
                const ts = new Date(step.timestamp).toLocaleString();
                const tool = step.toolUsed ? ` via \`${step.toolUsed}\`` : '';
                const data = step.data ? ' [has data]' : '';
                const duration = step.duration_ms != null ? ` (${step.duration_ms}ms)` : '';
                lines.push(`${i + 1}. **${step.type}** \`${step.id}\` — ${ts}${tool}${data}${duration}`);
            }
            lines.push('');
            // ── Data Flow DAG ──
            lines.push('## Data Flow (DAG)');
            lines.push('```');
            for (const node of dag) {
                const step = nb.steps.find(s => s.id === node.stepId);
                const label = `[${node.stepType}] ${step.content.slice(0, 40)}${step.content.length > 40 ? '...' : ''}`;
                if (node.inputsFrom.length === 0 && node.outputsTo.length === 0) {
                    lines.push(`  (${node.stepId}) ${label}  [isolated]`);
                }
                else {
                    if (node.inputsFrom.length > 0) {
                        for (const from of node.inputsFrom) {
                            lines.push(`  (${from}) --> (${node.stepId}) ${label}`);
                        }
                    }
                    if (node.outputsTo.length > 0 && node.inputsFrom.length === 0) {
                        lines.push(`  (${node.stepId}) ${label} --> [${node.outputsTo.join(', ')}]`);
                    }
                }
            }
            lines.push('```');
            lines.push('');
            // ── Data Lineage ──
            lines.push('## Data Lineage');
            const dataSteps = nb.steps.filter(s => s.data);
            if (dataSteps.length === 0) {
                lines.push('No data recorded in any steps.');
            }
            else {
                for (const step of dataSteps) {
                    const node = dag.find(n => n.stepId === step.id);
                    lines.push(`### Step \`${step.id}\` — ${step.type}`);
                    lines.push(`- **Data size**: ${step.data.length} chars`);
                    if (step.toolUsed)
                        lines.push(`- **Produced by**: \`${step.toolUsed}\``);
                    if (node.inputsFrom.length > 0)
                        lines.push(`- **Inputs from**: ${node.inputsFrom.map(id => `\`${id}\``).join(', ')}`);
                    if (node.outputsTo.length > 0)
                        lines.push(`- **Consumed by**: ${node.outputsTo.map(id => `\`${id}\``).join(', ')}`);
                    lines.push('');
                }
            }
            // ── Integrity Flags ──
            lines.push('## Integrity Flags');
            const flags = [];
            // Flag steps with data but no tool recorded
            const untrackedData = nb.steps.filter(s => s.data && !s.toolUsed);
            if (untrackedData.length > 0) {
                flags.push(`- **Untracked data source**: ${untrackedData.length} step(s) have data but no tool recorded: ${untrackedData.map(s => `\`${s.id}\``).join(', ')}`);
            }
            // Flag experiments/analyses without input links
            const orphanedAnalyses = dag.filter(n => ['experiment', 'analysis'].includes(n.stepType) && n.inputsFrom.length === 0);
            if (orphanedAnalyses.length > 0) {
                flags.push(`- **Orphaned analyses**: ${orphanedAnalyses.length} experiment/analysis step(s) have no traced inputs: ${orphanedAnalyses.map(n => `\`${n.stepId}\``).join(', ')}`);
            }
            // Flag conclusions without supporting results
            const unsupportedConclusions = dag.filter(n => n.stepType === 'conclusion' && n.inputsFrom.length === 0);
            if (unsupportedConclusions.length > 0) {
                flags.push(`- **Unsupported conclusions**: ${unsupportedConclusions.length} conclusion(s) have no linked results: ${unsupportedConclusions.map(n => `\`${n.stepId}\``).join(', ')}`);
            }
            // Flag large time gaps between consecutive steps
            for (let i = 1; i < nb.steps.length; i++) {
                const prev = new Date(nb.steps[i - 1].timestamp).getTime();
                const curr = new Date(nb.steps[i].timestamp).getTime();
                const gapHours = (curr - prev) / (1000 * 60 * 60);
                if (gapHours > 24) {
                    flags.push(`- **Time gap**: ${gapHours.toFixed(1)} hours between steps \`${nb.steps[i - 1].id}\` and \`${nb.steps[i].id}\` — potential unlogged work`);
                }
            }
            if (flags.length === 0) {
                lines.push('No integrity issues detected. All steps have proper provenance tracking.');
            }
            else {
                for (const flag of flags) {
                    lines.push(flag);
                }
            }
            lines.push('');
            lines.push('---');
            lines.push(`*Provenance report generated ${new Date().toISOString()}*`);
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=research-notebook.js.map