// kbot Embedded Inference Engine
// Runs GGUF models directly via node-llama-cpp — no Ollama, no external service needed.
// GPU-accelerated on Mac (Metal), Linux (CUDA/Vulkan), Windows (CUDA/Vulkan).
//
// node-llama-cpp is an OPTIONAL dependency — kbot works fine without it.
// All imports are dynamic to avoid compile errors when it's not installed.
import { homedir, totalmem } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { getMachineProfile } from './machine.js';
const MODELS_DIR = join(homedir(), '.kbot', 'models');
// ── Dynamic import helper (avoids TS errors for optional dep) ──
// Use a variable to prevent TypeScript from resolving the optional module at compile time
const LLAMA_MODULE = 'node-llama-cpp';
async function importLlama() {
    try {
        return await import(LLAMA_MODULE);
    }
    catch {
        throw new Error('node-llama-cpp is not installed. Install it with:\n' +
            '  npm install -g node-llama-cpp\n' +
            'Or use Ollama instead: kbot local');
    }
}
// ── Default models for auto-download ──
export const DEFAULT_MODELS = {
    // ── Lightweight (2-4 GB, runs on anything) ──
    'gemma3-4b': {
        hf: 'hf:google/gemma-3-4b-it-qat-q4_0-gguf:gemma-3-4b-it-q4_0.gguf',
        description: 'Google Gemma 3 4B — fast and light, good for quick tasks and low-RAM machines',
        size: '~2.5 GB',
        tags: ['fast', 'lightweight', 'general'],
    },
    // ── Standard (4-6 GB, 8GB+ RAM) ──
    'llama3.3-8b': {
        hf: 'hf:mradermacher/Meta-Llama-3.3-8B-Instruct-GGUF:Q4_K_M',
        description: 'Meta Llama 3.3 8B — best overall starter model, largest open-weight ecosystem',
        size: '~4.9 GB',
        tags: ['general', 'recommended', 'community'],
    },
    'qwen3-7b': {
        hf: 'hf:Qwen/Qwen3-8B-GGUF:qwen3-8b-q4_k_m.gguf',
        description: 'Alibaba Qwen 3 7B — highest HumanEval score under 8B params, strong reasoning',
        size: '~4.9 GB',
        tags: ['coding', 'reasoning', 'recommended'],
    },
    'qwen2.5-coder-7b': {
        hf: 'hf:Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:qwen2.5-coder-7b-instruct-q4_k_m.gguf',
        description: 'Alibaba Qwen 2.5 Coder — purpose-built for code generation and editing',
        size: '~4.7 GB',
        tags: ['coding', 'specialized'],
    },
    'deepseek-r1-8b': {
        hf: 'hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q4_K_M',
        description: 'DeepSeek R1 8B — chain-of-thought reasoning, thinks before it answers',
        size: '~4.7 GB',
        tags: ['reasoning', 'chain-of-thought'],
    },
    'mistral-7b': {
        hf: 'hf:TheBloke/Mistral-7B-Instruct-v0.3-GGUF:mistral-7b-instruct-v0.3.Q4_K_M.gguf',
        description: 'Mistral 7B — fast inference, good instruction following, Apache 2.0 license',
        size: '~4.4 GB',
        tags: ['general', 'fast', 'permissive-license'],
    },
    // ── Heavy (8-16 GB, 16GB+ RAM, GPU recommended) ──
    'phi4-14b': {
        hf: 'hf:mradermacher/phi-4-GGUF:Q4_K_M',
        description: 'Microsoft Phi-4 14B — punches above its weight on reasoning benchmarks',
        size: '~8.4 GB',
        tags: ['reasoning', 'large'],
    },
    'codestral-22b': {
        hf: 'hf:mradermacher/Codestral-22B-v0.1-GGUF:Q4_K_M',
        description: 'Mistral Codestral 22B — dedicated code model, 32K context, FIM support',
        size: '~13 GB',
        tags: ['coding', 'large', 'fill-in-middle'],
    },
    'qwen3-14b': {
        hf: 'hf:Qwen/Qwen3-14B-GGUF:qwen3-14b-q4_k_m.gguf',
        description: 'Alibaba Qwen 3 14B — frontier-class reasoning in a local model',
        size: '~8.5 GB',
        tags: ['reasoning', 'large', 'recommended'],
    },
    // ── Frontier (32-64 GB, 64GB+ RAM, M4/M5 Ultra or multi-GPU) ──
    'llama3.3-70b': {
        hf: 'hf:mradermacher/Meta-Llama-3.3-70B-Instruct-GGUF:Q4_K_M',
        description: 'Meta Llama 3.3 70B — near-Sonnet quality, the gold standard open-weight model',
        size: '~40 GB',
        tags: ['general', 'frontier', 'recommended'],
    },
    'qwen3-72b': {
        hf: 'hf:Qwen/Qwen3-72B-GGUF:qwen3-72b-q4_k_m.gguf',
        description: 'Alibaba Qwen 3 72B — frontier reasoning, matches GPT-4 on many benchmarks',
        size: '~42 GB',
        tags: ['reasoning', 'frontier'],
    },
    'deepseek-v3-70b': {
        hf: 'hf:mradermacher/DeepSeek-V3-0324-GGUF:Q4_K_M',
        description: 'DeepSeek V3 70B — surpasses GPT-5 on reasoning benchmarks, open-weight king',
        size: '~40 GB',
        tags: ['reasoning', 'frontier', 'recommended'],
    },
    'codestral-mamba-7b': {
        hf: 'hf:mradermacher/codestral-mamba-7B-v0.1-GGUF:Q4_K_M',
        description: 'Mistral Codestral Mamba 7B — linear attention, infinite context, low memory',
        size: '~4.2 GB',
        tags: ['coding', 'fast', 'infinite-context'],
    },
    // ── Ultra (100+ GB, 192-512GB RAM, M4/M5 Ultra Mac Studio) ──
    'llama3.1-405b': {
        hf: 'hf:mradermacher/Meta-Llama-3.1-405B-Instruct-GGUF:Q2_K',
        description: 'Meta Llama 3.1 405B (Q2) — largest open model, needs 192GB+ RAM. Near-Claude quality.',
        size: '~150 GB',
        tags: ['frontier', 'ultra', 'near-claude'],
    },
    // ── Legacy (kept for existing users) ──
    'llama3.1-8b': {
        hf: 'hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M',
        description: 'Meta Llama 3.1 8B — previous generation, still solid for general use',
        size: '~4.9 GB',
        tags: ['general', 'legacy'],
    },
};
// ── Machine-aware model recommendations ──
/**
 * Recommend models that fit this machine's hardware.
 * Uses MachineProfile if available, falls back to os.totalmem().
 */
export function getRecommendedModels() {
    const profile = getMachineProfile();
    const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
    const maxModelGB = totalGB * 0.6;
    const gpuAccel = profile?.gpuAcceleration || 'cpu-only';
    return Object.entries(DEFAULT_MODELS).map(([name, info]) => {
        const sizeGB = parseFloat(info.size.replace(/[^0-9.]/g, ''));
        const fits = sizeGB <= maxModelGB;
        let reason;
        if (!fits) {
            reason = `Too large: needs ~${sizeGB}GB, you have ~${maxModelGB.toFixed(0)}GB available for models`;
        }
        else if (gpuAccel === 'cpu-only') {
            reason = `Fits in RAM but will run on CPU only (${sizeGB}GB model, ${gpuAccel})`;
        }
        else {
            reason = `Good fit: ${sizeGB}GB model, ${gpuAccel} acceleration, ${totalGB.toFixed(0)}GB total RAM`;
        }
        return { name, fits, reason };
    });
}
// ── Lazy-loaded engine state ──
let _llama = null;
let _model = null;
let _context = null;
let _session = null;
let _loadedModelPath = null;
let _loadedModelName = null;
// ── Ensure models directory exists ──
export function ensureModelsDir() {
    if (!existsSync(MODELS_DIR)) {
        mkdirSync(MODELS_DIR, { recursive: true });
    }
    return MODELS_DIR;
}
// ── Model management ──
export function listLocalModels() {
    ensureModelsDir();
    const files = readdirSync(MODELS_DIR).filter(f => f.endsWith('.gguf'));
    return files.map(f => {
        const fullPath = join(MODELS_DIR, f);
        const stat = statSync(fullPath);
        const sizeGB = (stat.size / (1024 * 1024 * 1024)).toFixed(1);
        return {
            name: f.replace('.gguf', ''),
            path: fullPath,
            size: `${sizeGB} GB`,
            modified: stat.mtime.toISOString().slice(0, 10),
        };
    });
}
export async function downloadModel(nameOrHf, onProgress) {
    const llama = await importLlama();
    const modelsDir = ensureModelsDir();
    // Check if it's a known preset
    const preset = DEFAULT_MODELS[nameOrHf];
    const hfUri = preset ? preset.hf : nameOrHf;
    const modelPath = await llama.resolveModelFile(hfUri, modelsDir, {
        onProgress: onProgress
            ? ({ downloadedSize, totalSize }) => {
                if (totalSize > 0)
                    onProgress(Math.round((downloadedSize / totalSize) * 100));
            }
            : undefined,
    });
    return modelPath;
}
export function removeModel(name) {
    const modelsDir = ensureModelsDir();
    const files = readdirSync(modelsDir).filter(f => f.endsWith('.gguf'));
    const match = files.find(f => f.toLowerCase().includes(name.toLowerCase()));
    if (match) {
        unlinkSync(join(modelsDir, match));
        return true;
    }
    return false;
}
// ── Engine lifecycle ──
export async function loadModel(modelPath) {
    const llama = await importLlama();
    // If same model is already loaded, skip
    if (_model && _loadedModelPath === modelPath)
        return;
    // Unload previous model if any
    await unloadModel();
    // Find model to load — machine-aware selection
    let pathToLoad = modelPath;
    if (!pathToLoad) {
        const models = listLocalModels();
        if (models.length === 0) {
            throw new Error('No models found. Run `kbot models pull llama3.1-8b` to download one.');
        }
        // Use machine profile to pick the best model that fits in memory
        const profile = getMachineProfile();
        const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
        // Reserve 40% for OS + apps; the rest is available for the model
        const maxModelGB = totalGB * 0.6;
        // Sort by file size descending
        const sorted = models.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
        // Pick largest model that fits within memory budget
        const fits = sorted.find(m => parseFloat(m.size) <= maxModelGB);
        pathToLoad = fits ? fits.path : sorted[sorted.length - 1].path; // fallback to smallest if nothing fits
    }
    _llama = await llama.getLlama();
    _model = await _llama.loadModel({ modelPath: pathToLoad });
    _context = await _model.createContext();
    _session = new llama.LlamaChatSession({ contextSequence: _context.getSequence() });
    _loadedModelPath = pathToLoad;
    _loadedModelName = basename(pathToLoad).replace('.gguf', '');
}
export async function unloadModel() {
    if (_context) {
        try {
            await _context.dispose();
        }
        catch { /* ignore */ }
    }
    if (_model) {
        try {
            await _model.dispose();
        }
        catch { /* ignore */ }
    }
    _llama = null;
    _model = null;
    _context = null;
    _session = null;
    _loadedModelPath = null;
    _loadedModelName = null;
}
export function getLoadedModelName() {
    return _loadedModelName;
}
export function isModelLoaded() {
    return _model !== null;
}
export async function chatCompletion(systemPrompt, messages, tools, onChunk) {
    if (!_session || !_model) {
        await loadModel();
    }
    // Build the prompt from messages
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMsg) {
        return {
            content: '',
            model: _loadedModelName || 'embedded',
            usage: { input_tokens: 0, output_tokens: 0 },
        };
    }
    const prompt = systemPrompt
        ? `${systemPrompt}\n\n${lastUserMsg.content}`
        : lastUserMsg.content;
    // Set up function calling if tools are provided
    let functions;
    if (tools && tools.length > 0) {
        const llama = await importLlama();
        functions = {};
        for (const tool of tools) {
            functions[tool.name] = llama.defineChatSessionFunction({
                description: tool.description,
                params: tool.input_schema,
                async handler(params) {
                    return JSON.stringify({ __kbot_tool_call: true, name: tool.name, arguments: params });
                },
            });
        }
    }
    let outputTokens = 0;
    const response = await _session.prompt(prompt, {
        maxTokens: 8192,
        functions,
        onTextChunk: onChunk
            ? (chunk) => {
                outputTokens += Math.ceil(chunk.length / 4);
                onChunk(chunk);
            }
            : undefined,
    });
    const inputTokens = Math.ceil(prompt.length / 4);
    if (!outputTokens)
        outputTokens = Math.ceil(response.length / 4);
    const result = {
        content: response,
        model: _loadedModelName || 'embedded',
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        stop_reason: 'end_turn',
    };
    // Parse tool calls from the response
    if (tools && tools.length > 0) {
        const toolCalls = parseToolCallsFromResponse(response, tools.map(t => t.name));
        if (toolCalls.length > 0) {
            result.tool_calls = toolCalls;
            result.content = response
                .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
                .replace(/\{[\s\S]*?"__kbot_tool_call"[\s\S]*?\}/g, '')
                .replace(/\{[\s\S]*?"name"\s*:\s*"[a-z_]+"[\s\S]*?\}/g, '')
                .trim();
        }
    }
    return result;
}
function parseToolCallsFromResponse(content, knownTools) {
    const calls = [];
    // Pattern 1: kbot-captured tool calls via handler
    const kbotPattern = /\{[^{}]*"__kbot_tool_call"\s*:\s*true[^{}]*\}/g;
    let match;
    while ((match = kbotPattern.exec(content)) !== null) {
        try {
            const obj = JSON.parse(match[0]);
            if (obj.name && knownTools.includes(obj.name)) {
                calls.push({
                    id: `emb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name: obj.name,
                    arguments: obj.arguments || {},
                });
            }
        }
        catch { /* skip */ }
    }
    if (calls.length > 0)
        return calls;
    // Pattern 2: Code blocks with JSON
    const codeBlockPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = codeBlockPattern.exec(content)) !== null) {
        try {
            const obj = JSON.parse(match[1]);
            const name = obj.name || obj.function?.name;
            if (name && knownTools.includes(name)) {
                const args = obj.arguments || obj.parameters || obj.input || {};
                calls.push({
                    id: `emb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name,
                    arguments: typeof args === 'string' ? JSON.parse(args) : args,
                });
            }
        }
        catch { /* skip */ }
    }
    if (calls.length > 0)
        return calls;
    // Pattern 3: Raw JSON with known tool names
    const rawPattern = /\{[^{}]*"name"\s*:\s*"([a-z_]+)"[^{}]*\}/g;
    while ((match = rawPattern.exec(content)) !== null) {
        if (knownTools.includes(match[1])) {
            try {
                const obj = JSON.parse(match[0]);
                calls.push({
                    id: `emb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name: obj.name,
                    arguments: obj.arguments || obj.parameters || {},
                });
            }
            catch { /* skip */ }
        }
    }
    return calls;
}
// ── Reset session ──
export async function resetSession() {
    if (_context && _model) {
        const llama = await importLlama();
        _session = new llama.LlamaChatSession({ contextSequence: _context.getSequence() });
    }
}
// ── Health check ──
export async function isEmbeddedAvailable() {
    try {
        await importLlama();
        return true;
    }
    catch {
        return false;
    }
}
// ── Model info ──
export function getModelInfo() {
    return {
        name: _loadedModelName,
        path: _loadedModelPath,
        modelsDir: MODELS_DIR,
        availableModels: listLocalModels().length,
    };
}
/** Estimate task complexity from user message */
export function estimateTaskComplexity(message) {
    const lower = message.toLowerCase();
    const wordCount = message.split(/\s+/).length;
    // Frontier — needs the biggest model
    if (wordCount > 200)
        return 'frontier';
    if (/\b(refactor|architect|design|migrate|rewrite)\b.*\b(entire|whole|complete|all)\b/i.test(lower))
        return 'frontier';
    if (/\b(security audit|threat model|pentest|vulnerability assessment)\b/i.test(lower))
        return 'frontier';
    if (/\b(analyze.*codebase|review.*architecture|plan.*migration)\b/i.test(lower))
        return 'frontier';
    // Complex — needs 14B+
    if (/\b(explain|why|how does|architecture|design pattern|trade-?off)\b/i.test(lower))
        return 'complex';
    if (/\b(debug|fix.*bug|error.*trace|stack.*trace)\b/i.test(lower) && wordCount > 50)
        return 'complex';
    if (/\b(write.*test|generate.*test|test.*coverage)\b/i.test(lower))
        return 'complex';
    if (/\b(multi.*file|across.*files|project.*wide)\b/i.test(lower))
        return 'complex';
    // Moderate — 7-8B handles well
    if (/\b(fix|update|change|modify|add|remove|rename)\b/i.test(lower))
        return 'moderate';
    if (/\b(write|create|generate|implement)\b/i.test(lower))
        return 'moderate';
    // Simple — smallest model is fine
    if (/\b(what|where|list|show|help|status|version)\b/i.test(lower))
        return 'simple';
    if (wordCount < 15)
        return 'simple';
    return 'moderate';
}
/** Get the best local model for a task */
export function selectModelForTask(complexity) {
    const models = listLocalModels();
    if (models.length === 0)
        return null;
    const profile = getMachineProfile();
    const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
    const maxModelGB = totalGB * 0.6;
    // Sort by size
    const sorted = models.sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
    const fits = sorted.filter(m => parseFloat(m.size) <= maxModelGB);
    if (fits.length === 0) {
        return { name: sorted[0].name, reason: `Only model that could load (${sorted[0].size})` };
    }
    // Map complexity to preferred size range
    const sizeTargets = {
        simple: { min: 0, max: 5 }, // 4B-7B
        moderate: { min: 3, max: 10 }, // 7B-14B
        complex: { min: 7, max: 50 }, // 14B-70B
        frontier: { min: 30, max: 999 }, // 70B+
    };
    const target = sizeTargets[complexity];
    const bestFit = fits
        .filter(m => {
        const size = parseFloat(m.size);
        return size >= target.min && size <= target.max;
    })
        .sort((a, b) => parseFloat(b.size) - parseFloat(a.size)); // prefer largest in range
    if (bestFit.length > 0) {
        return {
            name: bestFit[0].name,
            reason: `Best fit for ${complexity} task: ${bestFit[0].name} (${bestFit[0].size})`,
        };
    }
    // Fallback: largest model that fits
    const largest = fits[fits.length - 1];
    return {
        name: largest.name,
        reason: `Largest available: ${largest.name} (${largest.size}). Ideal size for ${complexity} not downloaded.`,
    };
}
const modelSlots = [
    { purpose: 'fast', modelName: null, loaded: false },
    { purpose: 'smart', modelName: null, loaded: false },
];
/** Configure multi-model setup based on available RAM */
export function getMultiModelConfig() {
    const profile = getMachineProfile();
    const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
    // Need at least 32GB to run two models
    const canMultiModel = totalGB >= 32;
    const recommended = [];
    if (totalGB >= 192) {
        // Ultra tier: 70B + 7B
        recommended.push({ slot: 'smart', model: 'llama3.3-70b', size: '~40 GB' });
        recommended.push({ slot: 'fast', model: 'gemma3-4b', size: '~2.5 GB' });
    }
    else if (totalGB >= 64) {
        // Pro tier: 14B + 4B
        recommended.push({ slot: 'smart', model: 'qwen3-14b', size: '~8.5 GB' });
        recommended.push({ slot: 'fast', model: 'gemma3-4b', size: '~2.5 GB' });
    }
    else if (totalGB >= 32) {
        // Standard tier: 8B + 4B
        recommended.push({ slot: 'smart', model: 'qwen3-7b', size: '~4.9 GB' });
        recommended.push({ slot: 'fast', model: 'gemma3-4b', size: '~2.5 GB' });
    }
    return { canMultiModel, recommended, totalRAM: Math.round(totalGB) };
}
export const QUANT_OPTIONS = [
    { name: 'Q2_K', suffix: 'Q2_K', description: 'Smallest — fastest, lowest quality. For 405B on 192GB.', sizeMultiplier: 0.5 },
    { name: 'Q3_K_M', suffix: 'Q3_K_M', description: 'Small — good balance for very large models.', sizeMultiplier: 0.75 },
    { name: 'Q4_K_M', suffix: 'Q4_K_M', description: 'Standard — best balance of size and quality. Default.', sizeMultiplier: 1.0 },
    { name: 'Q5_K_M', suffix: 'Q5_K_M', description: 'High — noticeably better quality, ~25% larger.', sizeMultiplier: 1.25 },
    { name: 'Q6_K', suffix: 'Q6_K', description: 'Very high — near-original quality, ~50% larger.', sizeMultiplier: 1.5 },
    { name: 'Q8_0', suffix: 'Q8_0', description: 'Maximum — negligible quality loss, 2x size of Q4.', sizeMultiplier: 2.0 },
    { name: 'F16', suffix: 'f16', description: 'Full precision — original model weights. 4x size of Q4.', sizeMultiplier: 4.0 },
];
/** Recommend quantization based on available RAM and model size */
export function recommendQuantization(modelBaseGB) {
    const profile = getMachineProfile();
    const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
    const availableGB = totalGB * 0.6;
    // Try highest quality that fits
    for (const quant of [...QUANT_OPTIONS].reverse()) {
        const actualSize = modelBaseGB * quant.sizeMultiplier;
        if (actualSize <= availableGB)
            return quant;
    }
    // Default to smallest
    return QUANT_OPTIONS[0];
}
export function detectHardwareTier() {
    const profile = getMachineProfile();
    const totalGB = profile ? profile.memory.totalBytes / (1024 ** 3) : totalmem() / (1024 ** 3);
    const gpuAccel = profile?.gpuAcceleration || 'cpu-only';
    const gpuCores = profile?.gpu?.[0]?.cores || 0;
    if (totalGB >= 192) {
        return {
            tier: 'ultra',
            description: `${Math.round(totalGB)}GB RAM, ${gpuAccel}, ${gpuCores} GPU cores — frontier-class`,
            maxModelParams: '405B (Q2) / 120B (Q4) / 70B (Q8)',
            recommendations: [
                'kbot models pull llama3.3-70b',
                'kbot models pull deepseek-v3-70b',
                'kbot models pull llama3.1-405b  # needs 150GB+',
                'Enable multi-model: fast (4B) + smart (70B) running simultaneously',
            ],
        };
    }
    if (totalGB >= 64) {
        return {
            tier: 'pro',
            description: `${Math.round(totalGB)}GB RAM, ${gpuAccel}, ${gpuCores} GPU cores — pro-class`,
            maxModelParams: '70B (Q3) / 30B (Q4) / 14B (Q8)',
            recommendations: [
                'kbot models pull qwen3-14b',
                'kbot models pull codestral-22b',
                'kbot models pull llama3.3-70b  # tight fit, Q3 quantization',
                'Enable multi-model: fast (4B) + smart (14B)',
            ],
        };
    }
    if (totalGB >= 16) {
        return {
            tier: 'standard',
            description: `${Math.round(totalGB)}GB RAM, ${gpuAccel} — standard`,
            maxModelParams: '14B (Q4) / 8B (Q8)',
            recommendations: [
                'kbot models pull qwen3-7b  # recommended',
                'kbot models pull deepseek-r1-8b  # reasoning',
                totalGB >= 32 ? 'kbot models pull qwen3-14b  # if you close other apps' : '',
            ].filter(Boolean),
        };
    }
    return {
        tier: 'basic',
        description: `${Math.round(totalGB)}GB RAM, ${gpuAccel} — basic`,
        maxModelParams: '7B (Q4) / 4B (Q8)',
        recommendations: [
            'kbot models pull gemma3-4b  # lightweight, fits anywhere',
            'kbot models pull qwen3-7b  # if you have 8GB+ free',
        ],
    };
}
//# sourceMappingURL=inference.js.map