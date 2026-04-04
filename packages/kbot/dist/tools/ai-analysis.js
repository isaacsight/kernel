// kbot AI Analysis & Interpretability Tools
//
// Inspired by Anthropic's circuit tracing research and Google's Bayesian teaching paper.
// Five tools for understanding, comparing, and reasoning about AI models and prompts:
//
//   1. model_compare    — Side-by-side comparison of two AI models on the same prompt
//   2. prompt_analyze   — Evaluate prompt clarity, ambiguity, and effectiveness
//   3. reasoning_chain  — Break complex questions into explicit chain-of-thought steps
//   4. bayesian_update  — Compute posterior probabilities via Bayes' theorem
//   5. bias_check       — Detect cognitive biases in text or arguments
//
// model_compare uses kbot's multi-provider auth system (20 providers).
// prompt_analyze, reasoning_chain, and bias_check use local Ollama ($0 cost).
// bayesian_update is pure math — no API calls.
import { registerTool } from './index.js';
import { getByokKey, getByokProvider, getProvider, estimateCost, isOllamaRunning, PROVIDERS, } from '../auth.js';
// ══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
/** Call a provider's chat completions API and return the raw response text + metadata. */
async function callProviderRaw(provider, model, systemPrompt, userPrompt, timeout = 120_000) {
    const p = getProvider(provider);
    const apiKey = getByokKey() || 'local';
    const start = Date.now();
    if (p.apiStyle === 'anthropic') {
        const res = await fetch(p.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
            signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) {
            const err = await res.text().catch(() => `HTTP ${res.status}`);
            throw new Error(`${p.name} API error: ${err}`);
        }
        const data = await res.json();
        const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        const u = data.usage || {};
        return {
            content: text,
            model: data.model || model,
            inputTokens: u.input_tokens || 0,
            outputTokens: u.output_tokens || 0,
            durationMs: Date.now() - start,
        };
    }
    if (p.apiStyle === 'google') {
        const url = `${p.apiUrl}/${model}:generateContent`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: { maxOutputTokens: 4096 },
            }),
            signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) {
            const err = await res.text().catch(() => `HTTP ${res.status}`);
            throw new Error(`${p.name} API error: ${err}`);
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
        const u = data.usageMetadata || {};
        return {
            content: text,
            model,
            inputTokens: u.promptTokenCount || 0,
            outputTokens: u.candidatesTokenCount || 0,
            durationMs: Date.now() - start,
        };
    }
    // OpenAI-compatible (works for OpenAI, Mistral, Groq, DeepSeek, Ollama, etc.)
    const messages = [];
    if (systemPrompt)
        messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'local') {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch(p.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, max_tokens: 4096, messages }),
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`${p.name} API error: ${err}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const u = data.usage || {};
    return {
        content: text,
        model: data.model || model,
        inputTokens: u.prompt_tokens || 0,
        outputTokens: u.completion_tokens || 0,
        durationMs: Date.now() - start,
    };
}
/** Resolve a model spec like "openai:gpt-4.1" or "ollama:gemma3:12b" into provider + model. */
function resolveModelSpec(spec) {
    // Check for "provider:model" format
    const colonIdx = spec.indexOf(':');
    if (colonIdx > 0) {
        const candidateProvider = spec.slice(0, colonIdx);
        if (candidateProvider in PROVIDERS) {
            return { provider: candidateProvider, model: spec.slice(colonIdx + 1) };
        }
    }
    // Check if spec matches a known model name in any provider
    for (const [pid, pConfig] of Object.entries(PROVIDERS)) {
        if (pConfig.models?.includes(spec) || pConfig.defaultModel === spec || pConfig.fastModel === spec) {
            return { provider: pid, model: spec };
        }
    }
    // Fall back to current BYOK provider
    return { provider: getByokProvider(), model: spec };
}
/** Call local Ollama for analysis tasks (zero cost). */
async function callOllama(prompt, systemPrompt, model, timeout = 120_000) {
    const running = await isOllamaRunning();
    if (!running) {
        return 'Error: Ollama is not running. Install and start Ollama: https://ollama.com';
    }
    const ollamaModel = model || 'gemma3:12b';
    const messages = [];
    if (systemPrompt)
        messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    try {
        const res = await fetch(`${OLLAMA_HOST}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ollamaModel, messages, stream: false }),
            signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) {
            const err = await res.text().catch(() => `HTTP ${res.status}`);
            return `Error: Ollama request failed — ${err}`;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response from Ollama.';
    }
    catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return `Error: Ollama timed out after ${timeout / 1000}s. Try a smaller model.`;
        }
        return `Error: Could not reach Ollama at ${OLLAMA_HOST}. Is it running?`;
    }
}
/** Format a duration in ms to human-readable. */
function fmtDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
/** Format a cost in USD. */
function fmtCost(usd) {
    if (usd === 0)
        return '$0.00 (local)';
    if (usd < 0.001)
        return `$${usd.toFixed(6)}`;
    if (usd < 0.01)
        return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(4)}`;
}
// ══════════════════════════════════════════════════════════════════════════════
// 1. MODEL COMPARE
// ══════════════════════════════════════════════════════════════════════════════
function registerModelCompare() {
    registerTool({
        name: 'model_compare',
        description: 'Compare two AI models side-by-side on the same prompt. ' +
            'Shows response quality, speed, token usage, and cost. ' +
            'Model format: "provider:model" (e.g., "openai:gpt-4.1", "ollama:gemma3:12b") ' +
            'or just a model name if unambiguous.',
        parameters: {
            prompt: { type: 'string', description: 'The prompt to send to both models', required: true },
            model_a: { type: 'string', description: 'First model (e.g., "openai:gpt-4.1" or "ollama:gemma3:12b")', required: true },
            model_b: { type: 'string', description: 'Second model (e.g., "anthropic:claude-sonnet-4-6")', required: true },
            system_prompt: { type: 'string', description: 'Optional system prompt for both models' },
        },
        tier: 'free',
        timeout: 300_000, // 5 min — models may be slow
        async execute(args) {
            const prompt = String(args.prompt);
            const specA = resolveModelSpec(String(args.model_a));
            const specB = resolveModelSpec(String(args.model_b));
            const systemPrompt = args.system_prompt ? String(args.system_prompt) : 'You are a helpful assistant. Answer concisely and accurately.';
            // Run both models in parallel
            const [resultA, resultB] = await Promise.allSettled([
                callProviderRaw(specA.provider, specA.model, systemPrompt, prompt),
                callProviderRaw(specB.provider, specB.model, systemPrompt, prompt),
            ]);
            const a = resultA.status === 'fulfilled' ? resultA.value : null;
            const b = resultB.status === 'fulfilled' ? resultB.value : null;
            const errA = resultA.status === 'rejected' ? resultA.reason.message : null;
            const errB = resultB.status === 'rejected' ? resultB.reason.message : null;
            const providerA = getProvider(specA.provider);
            const providerB = getProvider(specB.provider);
            const costA = a ? estimateCost(specA.provider, a.inputTokens, a.outputTokens) : 0;
            const costB = b ? estimateCost(specB.provider, b.inputTokens, b.outputTokens) : 0;
            // Build comparison output
            const lines = [
                '# Model Comparison',
                '',
                `**Prompt:** ${prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt}`,
                '',
                '---',
                '',
                '## Metrics',
                '',
                '| Metric | Model A | Model B |',
                '|--------|---------|---------|',
                `| Provider | ${providerA.name} | ${providerB.name} |`,
                `| Model | ${a?.model || specA.model} | ${b?.model || specB.model} |`,
                `| Status | ${a ? 'Success' : `Error: ${errA}`} | ${b ? 'Success' : `Error: ${errB}`} |`,
                `| Latency | ${a ? fmtDuration(a.durationMs) : 'N/A'} | ${b ? fmtDuration(b.durationMs) : 'N/A'} |`,
                `| Input tokens | ${a?.inputTokens ?? 'N/A'} | ${b?.inputTokens ?? 'N/A'} |`,
                `| Output tokens | ${a?.outputTokens ?? 'N/A'} | ${b?.outputTokens ?? 'N/A'} |`,
                `| Est. cost | ${a ? fmtCost(costA) : 'N/A'} | ${b ? fmtCost(costB) : 'N/A'} |`,
                `| Response length | ${a ? `${a.content.length} chars` : 'N/A'} | ${b ? `${b.content.length} chars` : 'N/A'} |`,
            ];
            // Speed comparison
            if (a && b) {
                const faster = a.durationMs < b.durationMs ? 'A' : 'B';
                const speedRatio = Math.max(a.durationMs, b.durationMs) / Math.max(1, Math.min(a.durationMs, b.durationMs));
                lines.push(`| Speed winner | ${faster === 'A' ? '<--' : ''} | ${faster === 'B' ? '<--' : ''} | (${speedRatio.toFixed(1)}x faster)`);
                const cheaper = costA < costB ? 'A' : costA > costB ? 'B' : 'tie';
                if (cheaper !== 'tie') {
                    lines.push(`| Cost winner | ${cheaper === 'A' ? '<--' : ''} | ${cheaper === 'B' ? '<--' : ''} |`);
                }
            }
            lines.push('', '---', '');
            // Model A response
            lines.push('## Model A Response', '');
            if (a) {
                lines.push(a.content);
            }
            else {
                lines.push(`*Error:* ${errA}`);
            }
            lines.push('', '---', '');
            // Model B response
            lines.push('## Model B Response', '');
            if (b) {
                lines.push(b.content);
            }
            else {
                lines.push(`*Error:* ${errB}`);
            }
            // Simple diff summary
            if (a && b) {
                lines.push('', '---', '', '## Quick Diff Summary', '');
                const wordsA = a.content.split(/\s+/).length;
                const wordsB = b.content.split(/\s+/).length;
                lines.push(`- Model A: ${wordsA} words | Model B: ${wordsB} words`);
                lines.push(`- Length ratio: ${(Math.max(wordsA, wordsB) / Math.max(1, Math.min(wordsA, wordsB))).toFixed(1)}x`);
                // Check for overlapping content (shared n-grams)
                const ngramsA = new Set();
                const tokensA = a.content.toLowerCase().split(/\s+/);
                for (let i = 0; i < tokensA.length - 2; i++) {
                    ngramsA.add(tokensA.slice(i, i + 3).join(' '));
                }
                const tokensB = b.content.toLowerCase().split(/\s+/);
                let shared = 0;
                for (let i = 0; i < tokensB.length - 2; i++) {
                    if (ngramsA.has(tokensB.slice(i, i + 3).join(' ')))
                        shared++;
                }
                const overlap = tokensB.length > 2 ? (shared / (tokensB.length - 2) * 100) : 0;
                lines.push(`- Content overlap (3-gram): ${overlap.toFixed(1)}%`);
            }
            return lines.join('\n');
        },
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// 2. PROMPT ANALYZE
// ══════════════════════════════════════════════════════════════════════════════
function registerPromptAnalyze() {
    registerTool({
        name: 'prompt_analyze',
        description: 'Analyze a prompt for clarity, ambiguity, and effectiveness. ' +
            'Uses local Ollama to evaluate instruction quality, identify potential misinterpretations, ' +
            'suggest improvements, and estimate token efficiency. Helps write better prompts.',
        parameters: {
            prompt: { type: 'string', description: 'The prompt to analyze', required: true },
            context: { type: 'string', description: 'Optional context about the intended use case' },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            const prompt = String(args.prompt);
            const context = args.context ? String(args.context) : '';
            const systemPrompt = 'You are a prompt engineering expert. Analyze the given prompt and return a structured evaluation. ' +
                'Be specific and actionable. Return your analysis in exactly this format:\n\n' +
                'CLARITY_SCORE: <1-10>\n' +
                'SPECIFICITY_SCORE: <1-10>\n' +
                'COMPLETENESS_SCORE: <1-10>\n' +
                'OVERALL_SCORE: <1-10>\n\n' +
                'AMBIGUITIES:\n- <list each ambiguity on its own line>\n\n' +
                'MISINTERPRETATIONS:\n- <list each potential misinterpretation>\n\n' +
                'IMPROVEMENTS:\n- <list each suggested improvement>\n\n' +
                'TOKEN_ANALYSIS:\n' +
                '- Estimated tokens: <number>\n' +
                '- Redundant tokens: <number>\n' +
                '- Efficiency: <percentage>\n\n' +
                'REWRITTEN_PROMPT:\n<the improved version of the prompt>';
            const userPrompt = context
                ? `Analyze this prompt (context: ${context}):\n\n---\n${prompt}\n---`
                : `Analyze this prompt:\n\n---\n${prompt}\n---`;
            const analysis = await callOllama(userPrompt, systemPrompt);
            if (analysis.startsWith('Error:'))
                return analysis;
            // Parse scores from the response
            const clarityMatch = analysis.match(/CLARITY_SCORE:\s*(\d+)/i);
            const specificityMatch = analysis.match(/SPECIFICITY_SCORE:\s*(\d+)/i);
            const completenessMatch = analysis.match(/COMPLETENESS_SCORE:\s*(\d+)/i);
            const overallMatch = analysis.match(/OVERALL_SCORE:\s*(\d+)/i);
            const clarity = clarityMatch ? parseInt(clarityMatch[1], 10) : null;
            const specificity = specificityMatch ? parseInt(specificityMatch[1], 10) : null;
            const completeness = completenessMatch ? parseInt(completenessMatch[1], 10) : null;
            const overall = overallMatch ? parseInt(overallMatch[1], 10) : null;
            // Build structured output
            const lines = [
                '# Prompt Analysis',
                '',
                `**Original prompt** (${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens):`,
                `> ${prompt.length > 300 ? prompt.slice(0, 300) + '...' : prompt}`,
                '',
            ];
            if (clarity !== null || overall !== null) {
                lines.push('## Scores', '');
                const bar = (score, label) => {
                    if (score === null)
                        return;
                    const filled = '\u2588'.repeat(score);
                    const empty = '\u2591'.repeat(10 - score);
                    lines.push(`${label.padEnd(16)} ${filled}${empty} ${score}/10`);
                };
                bar(clarity, 'Clarity');
                bar(specificity, 'Specificity');
                bar(completeness, 'Completeness');
                bar(overall, 'Overall');
                lines.push('');
            }
            lines.push('## Detailed Analysis', '', analysis);
            return lines.join('\n');
        },
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// 3. REASONING CHAIN
// ══════════════════════════════════════════════════════════════════════════════
function registerReasoningChain() {
    registerTool({
        name: 'reasoning_chain',
        description: 'Break a complex question into explicit reasoning steps using chain-of-thought. ' +
            'Shows each step with a confidence level and alternative paths. ' +
            'Uses local Ollama to generate a reasoning tree. ' +
            'Output as a structured chain with numbered steps.',
        parameters: {
            question: { type: 'string', description: 'The complex question to reason about', required: true },
            depth: { type: 'string', description: 'Reasoning depth: "shallow" (3-5 steps), "medium" (5-8 steps), or "deep" (8-12 steps). Default: medium' },
            domain: { type: 'string', description: 'Optional domain hint (e.g., "math", "code", "science", "business")' },
        },
        tier: 'free',
        timeout: 180_000,
        async execute(args) {
            const question = String(args.question);
            const depth = String(args.depth || 'medium');
            const domain = args.domain ? String(args.domain) : '';
            const depthRange = depth === 'shallow' ? '3-5' : depth === 'deep' ? '8-12' : '5-8';
            const systemPrompt = 'You are an expert reasoning engine. Given a question, decompose it into a chain of explicit reasoning steps. ' +
                'For each step, assign a confidence level (high/medium/low) and note any alternative reasoning paths.\n\n' +
                'Return your analysis in exactly this format:\n\n' +
                'QUESTION_TYPE: <classification of the question type>\n' +
                'COMPLEXITY: <1-10>\n\n' +
                'REASONING_CHAIN:\n\n' +
                'STEP 1: <description>\n' +
                'CONFIDENCE: <high|medium|low> (<0-100>%)\n' +
                'REASONING: <why this step follows>\n' +
                'ALTERNATIVES: <other approaches at this step, or "none">\n\n' +
                'STEP 2: ...\n' +
                '(continue for all steps)\n\n' +
                'CONCLUSION:\n<final answer or synthesis>\n' +
                'OVERALL_CONFIDENCE: <0-100>%\n\n' +
                'ASSUMPTIONS:\n- <list key assumptions made>\n\n' +
                'WEAKNESSES:\n- <list weaknesses in the reasoning chain>';
            const domainHint = domain ? ` (domain: ${domain})` : '';
            const userPrompt = `Decompose this question into ${depthRange} explicit reasoning steps${domainHint}:\n\n${question}`;
            const analysis = await callOllama(userPrompt, systemPrompt);
            if (analysis.startsWith('Error:'))
                return analysis;
            // Parse step count
            const stepMatches = analysis.match(/STEP\s+\d+/gi);
            const stepCount = stepMatches ? stepMatches.length : 0;
            // Parse overall confidence
            const confMatch = analysis.match(/OVERALL_CONFIDENCE:\s*(\d+)/i);
            const overallConf = confMatch ? parseInt(confMatch[1], 10) : null;
            // Parse complexity
            const complexityMatch = analysis.match(/COMPLEXITY:\s*(\d+)/i);
            const complexity = complexityMatch ? parseInt(complexityMatch[1], 10) : null;
            const lines = [
                '# Reasoning Chain Analysis',
                '',
                `**Question:** ${question.length > 200 ? question.slice(0, 200) + '...' : question}`,
                '',
            ];
            if (stepCount > 0 || overallConf !== null || complexity !== null) {
                lines.push('## Summary', '');
                if (complexity !== null)
                    lines.push(`- **Complexity:** ${complexity}/10`);
                lines.push(`- **Steps:** ${stepCount}`);
                lines.push(`- **Depth setting:** ${depth} (${depthRange} steps)`);
                if (overallConf !== null)
                    lines.push(`- **Overall confidence:** ${overallConf}%`);
                lines.push('');
            }
            lines.push('## Chain of Thought', '', analysis);
            return lines.join('\n');
        },
    });
}
function registerBayesianUpdate() {
    registerTool({
        name: 'bayesian_update',
        description: 'Compute posterior probability using Bayes\' theorem. ' +
            'Given a hypothesis, prior probability, and one or more pieces of evidence, ' +
            'computes the posterior step by step. Shows the full math. ' +
            'Handles sequential evidence updates. Pure math — no API calls.',
        parameters: {
            hypothesis: { type: 'string', description: 'The hypothesis being evaluated', required: true },
            prior: { type: 'string', description: 'Prior probability P(H), a number between 0 and 1', required: true },
            evidence: {
                type: 'array',
                description: 'Array of evidence objects. Each has: description (string), likelihood (number 0-1 = P(E|H)), likelihood_not (number 0-1 = P(E|~H))',
                required: true,
                items: {
                    type: 'object',
                    properties: {
                        description: { type: 'string' },
                        likelihood: { type: 'number' },
                        likelihood_not: { type: 'number' },
                    },
                },
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const hypothesis = String(args.hypothesis);
            const prior = parseFloat(String(args.prior));
            if (isNaN(prior) || prior < 0 || prior > 1) {
                return 'Error: prior must be a number between 0 and 1.';
            }
            // Parse evidence array
            const rawEvidence = args.evidence;
            if (!rawEvidence || !Array.isArray(rawEvidence) || rawEvidence.length === 0) {
                return 'Error: evidence must be a non-empty array of { description, likelihood, likelihood_not } objects.';
            }
            const evidence = [];
            for (const e of rawEvidence) {
                const desc = String(e.description || 'Evidence');
                const lik = parseFloat(String(e.likelihood));
                const likNot = parseFloat(String(e.likelihood_not));
                if (isNaN(lik) || lik < 0 || lik > 1) {
                    return `Error: likelihood for "${desc}" must be between 0 and 1. Got: ${e.likelihood}`;
                }
                if (isNaN(likNot) || likNot < 0 || likNot > 1) {
                    return `Error: likelihood_not for "${desc}" must be between 0 and 1. Got: ${e.likelihood_not}`;
                }
                evidence.push({ description: desc, likelihood: lik, likelihood_not: likNot });
            }
            // Compute sequential Bayesian updates
            const lines = [
                '# Bayesian Update',
                '',
                `**Hypothesis:** ${hypothesis}`,
                `**Prior probability:** P(H) = ${prior}`,
                `**Evidence items:** ${evidence.length}`,
                '',
                '---',
                '',
                '## Bayes\' Theorem',
                '',
                '```',
                '             P(E|H) * P(H)',
                'P(H|E) = ─────────────────────────',
                '         P(E|H)*P(H) + P(E|~H)*P(~H)',
                '```',
                '',
                '---',
                '',
            ];
            let currentPrior = prior;
            for (let i = 0; i < evidence.length; i++) {
                const e = evidence[i];
                const pH = currentPrior;
                const pNotH = 1 - pH;
                const pEgivenH = e.likelihood;
                const pEgivenNotH = e.likelihood_not;
                // Bayes' theorem
                const numerator = pEgivenH * pH;
                const denominator = pEgivenH * pH + pEgivenNotH * pNotH;
                const posterior = denominator === 0 ? 0 : numerator / denominator;
                // Likelihood ratio
                const likelihoodRatio = pEgivenNotH === 0 ? Infinity : pEgivenH / pEgivenNotH;
                // Log odds change
                const priorOdds = pNotH === 0 ? Infinity : pH / pNotH;
                const posteriorOdds = (1 - posterior) === 0 ? Infinity : posterior / (1 - posterior);
                lines.push(`## Update ${i + 1}: ${e.description}`, '', '**Given:**', `- P(H) = ${pH.toFixed(6)} (prior)`, `- P(~H) = ${pNotH.toFixed(6)}`, `- P(E|H) = ${pEgivenH.toFixed(4)} (likelihood if true)`, `- P(E|~H) = ${pEgivenNotH.toFixed(4)} (likelihood if false)`, '', '**Calculation:**', '', '```', `Numerator:   P(E|H) * P(H)    = ${pEgivenH.toFixed(4)} * ${pH.toFixed(6)} = ${numerator.toFixed(8)}`, `Denominator: P(E|H)*P(H) + P(E|~H)*P(~H)`, `           = ${pEgivenH.toFixed(4)}*${pH.toFixed(6)} + ${pEgivenNotH.toFixed(4)}*${pNotH.toFixed(6)}`, `           = ${numerator.toFixed(8)} + ${(pEgivenNotH * pNotH).toFixed(8)}`, `           = ${denominator.toFixed(8)}`, '', `P(H|E) = ${numerator.toFixed(8)} / ${denominator.toFixed(8)} = ${posterior.toFixed(6)}`, '```', '', `**Posterior:** P(H|E) = **${(posterior * 100).toFixed(2)}%**`, `**Likelihood ratio:** ${isFinite(likelihoodRatio) ? likelihoodRatio.toFixed(4) : 'Infinity'} (${likelihoodRatio > 1 ? 'evidence supports H' : likelihoodRatio < 1 ? 'evidence opposes H' : 'neutral'})`, `**Shift:** ${pH.toFixed(4)} -> ${posterior.toFixed(4)} (${posterior > pH ? '+' : ''}${((posterior - pH) * 100).toFixed(2)} pp)`, '');
                if (isFinite(priorOdds) && isFinite(posteriorOdds)) {
                    lines.push(`**Odds:** ${priorOdds.toFixed(4)} : 1 -> ${posteriorOdds.toFixed(4)} : 1`, '');
                }
                lines.push('---', '');
                currentPrior = posterior;
            }
            // Final summary
            const totalShift = currentPrior - prior;
            const direction = totalShift > 0 ? 'strengthened' : totalShift < 0 ? 'weakened' : 'unchanged';
            lines.push('## Final Result', '', `**Hypothesis:** ${hypothesis}`, `**Prior:** ${(prior * 100).toFixed(2)}%`, `**Posterior:** ${(currentPrior * 100).toFixed(2)}%`, `**Net shift:** ${totalShift > 0 ? '+' : ''}${(totalShift * 100).toFixed(2)} percentage points`, `**Verdict:** Evidence ${direction} the hypothesis.`, '');
            // Interpretation guide
            if (currentPrior >= 0.95) {
                lines.push('**Interpretation:** Very strong support for the hypothesis.');
            }
            else if (currentPrior >= 0.75) {
                lines.push('**Interpretation:** Moderate support for the hypothesis.');
            }
            else if (currentPrior >= 0.5) {
                lines.push('**Interpretation:** Slight lean toward the hypothesis, but not conclusive.');
            }
            else if (currentPrior >= 0.25) {
                lines.push('**Interpretation:** Slight lean against the hypothesis.');
            }
            else if (currentPrior >= 0.05) {
                lines.push('**Interpretation:** Moderate evidence against the hypothesis.');
            }
            else {
                lines.push('**Interpretation:** Very strong evidence against the hypothesis.');
            }
            return lines.join('\n');
        },
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// 5. BIAS CHECK
// ══════════════════════════════════════════════════════════════════════════════
const COGNITIVE_BIASES = [
    { name: 'Confirmation bias', description: 'Seeking/interpreting info that confirms existing beliefs' },
    { name: 'Anchoring bias', description: 'Over-relying on the first piece of information encountered' },
    { name: 'Survivorship bias', description: 'Focusing on successes while ignoring failures' },
    { name: 'Availability heuristic', description: 'Overweighting easily recalled examples' },
    { name: 'Dunning-Kruger effect', description: 'Overestimating competence in areas of limited knowledge' },
    { name: 'Sunk cost fallacy', description: 'Continuing an endeavor due to prior investment' },
    { name: 'Bandwagon effect', description: 'Adopting beliefs because many others hold them' },
    { name: 'Halo effect', description: 'Letting one positive trait influence overall judgment' },
    { name: 'Hindsight bias', description: 'Believing past events were predictable after they occurred' },
    { name: 'Appeal to authority', description: 'Accepting claims based on authority rather than evidence' },
    { name: 'False dichotomy', description: 'Presenting only two options when more exist' },
    { name: 'Ad hominem', description: 'Attacking the person rather than the argument' },
    { name: 'Slippery slope', description: 'Assuming one event will lead to extreme consequences' },
    { name: 'Cherry-picking', description: 'Selecting data that supports a conclusion while ignoring contradictions' },
    { name: 'Recency bias', description: 'Overweighting recent events or information' },
    { name: 'Status quo bias', description: 'Preferring the current state of affairs' },
    { name: 'Framing effect', description: 'Drawing different conclusions based on how information is presented' },
    { name: 'Optimism bias', description: 'Overestimating the likelihood of positive outcomes' },
    { name: 'Fundamental attribution error', description: 'Attributing others\' behavior to character rather than circumstances' },
    { name: 'Base rate neglect', description: 'Ignoring base rate probabilities in favor of specific information' },
];
function registerBiasCheck() {
    registerTool({
        name: 'bias_check',
        description: 'Analyze text or an argument for cognitive biases. ' +
            'Uses local Ollama to identify confirmation bias, anchoring, survivorship bias, ' +
            'and 17 other common cognitive biases. Returns biases found, severity, and a debiased alternative.',
        parameters: {
            text: { type: 'string', description: 'The text or argument to analyze for biases', required: true },
            focus: { type: 'string', description: 'Optional focus: "argument", "data", "decision", "narrative", or "all" (default: "all")' },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            const text = String(args.text);
            const focus = String(args.focus || 'all');
            const biasList = COGNITIVE_BIASES.map(b => `- ${b.name}: ${b.description}`).join('\n');
            const systemPrompt = 'You are a cognitive bias detection expert. Analyze the given text for cognitive biases.\n\n' +
                'Known biases to check for:\n' + biasList + '\n\n' +
                'For each bias found, return in exactly this format:\n\n' +
                'BIAS_FOUND: <bias name>\n' +
                'SEVERITY: <low|medium|high>\n' +
                'EVIDENCE: <specific quote or pattern from the text>\n' +
                'EXPLANATION: <why this constitutes this bias>\n\n' +
                '(repeat for each bias found)\n\n' +
                'BIAS_COUNT: <total number of biases found>\n\n' +
                'DEBIASED_VERSION:\n<rewritten version of the text with biases removed or mitigated>\n\n' +
                'RECOMMENDATIONS:\n- <list actionable recommendations for more balanced reasoning>';
            const focusHint = focus !== 'all' ? ` Focus on biases typical in ${focus} contexts.` : '';
            const userPrompt = `Analyze this text for cognitive biases.${focusHint}\n\n---\n${text}\n---`;
            const analysis = await callOllama(userPrompt, systemPrompt);
            if (analysis.startsWith('Error:'))
                return analysis;
            // Parse bias count
            const countMatch = analysis.match(/BIAS_COUNT:\s*(\d+)/i);
            const biasCount = countMatch ? parseInt(countMatch[1], 10) : null;
            // Parse individual biases found
            const biasMatches = analysis.match(/BIAS_FOUND:\s*(.+)/gi) || [];
            const biasNames = biasMatches.map(m => m.replace(/BIAS_FOUND:\s*/i, '').trim());
            // Parse severities
            const severityMatches = analysis.match(/SEVERITY:\s*(low|medium|high)/gi) || [];
            const severities = severityMatches.map(m => m.replace(/SEVERITY:\s*/i, '').trim().toLowerCase());
            const lines = [
                '# Cognitive Bias Analysis',
                '',
                `**Text analyzed:** ${text.length > 200 ? text.slice(0, 200) + '...' : text}`,
                `**Focus:** ${focus}`,
                '',
            ];
            if (biasNames.length > 0 || biasCount !== null) {
                lines.push('## Summary', '');
                lines.push(`- **Biases detected:** ${biasCount ?? biasNames.length}`);
                // Severity breakdown
                const highCount = severities.filter(s => s === 'high').length;
                const medCount = severities.filter(s => s === 'medium').length;
                const lowCount = severities.filter(s => s === 'low').length;
                if (highCount + medCount + lowCount > 0) {
                    lines.push(`- **Severity breakdown:** ${highCount} high, ${medCount} medium, ${lowCount} low`);
                }
                if (biasNames.length > 0) {
                    lines.push(`- **Biases:** ${biasNames.join(', ')}`);
                }
                // Overall rating
                if (highCount >= 3) {
                    lines.push('- **Rating:** Heavily biased - significant revision recommended');
                }
                else if (highCount >= 1 || medCount >= 3) {
                    lines.push('- **Rating:** Moderately biased - some revision recommended');
                }
                else if (medCount >= 1 || lowCount >= 2) {
                    lines.push('- **Rating:** Mildly biased - minor adjustments suggested');
                }
                else {
                    lines.push('- **Rating:** Relatively unbiased');
                }
                lines.push('');
            }
            lines.push('## Detailed Analysis', '', analysis);
            return lines.join('\n');
        },
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════
export function registerAIAnalysisTools() {
    registerModelCompare();
    registerPromptAnalyze();
    registerReasoningChain();
    registerBayesianUpdate();
    registerBiasCheck();
}
//# sourceMappingURL=ai-analysis.js.map