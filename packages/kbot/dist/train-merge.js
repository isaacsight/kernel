// train-merge — model merging via MergeKit (TIES / SLERP / DARE).
// Also documents the MoE swap path (DeepSeek-V2-Lite-16B, Qwen3-MoE).
//
// MergeKit must be installed: pip install mergekit
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
function hasBin(bin) {
    try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function shell(cmd) {
    try {
        const out = execSync(cmd, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 100 * 1024 * 1024,
            timeout: 60 * 60 * 1000,
        });
        return { ok: true, output: out.toString() };
    }
    catch (err) {
        const e = err;
        return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') };
    }
}
/** Generate a MergeKit YAML config. */
function buildConfig(opts) {
    const method = opts.method ?? 'ties';
    const dtype = opts.dtype ?? 'bfloat16';
    const modelsYaml = opts.models.map(m => {
        const params = [];
        if (m.weight != null)
            params.push(`weight: ${m.weight}`);
        if (m.density != null)
            params.push(`density: ${m.density}`);
        const paramBlock = params.length > 0 ? `\n    parameters:\n      ${params.join('\n      ')}` : '';
        return `  - model: ${m.model}${paramBlock}`;
    }).join('\n');
    if (method === 'slerp') {
        // SLERP requires exactly 2 models and uses 't' parameter
        return [
            `slices:`,
            `  - sources:`,
            ...opts.models.map((m) => `      - model: ${m.model}\n        layer_range: [0, 32]`),
            `merge_method: slerp`,
            `base_model: ${opts.baseModel}`,
            `parameters:`,
            `  t:`,
            `    - filter: self_attn`,
            `      value: [0, 0.5, 0.3, 0.7, 1]`,
            `    - filter: mlp`,
            `      value: [1, 0.5, 0.7, 0.3, 0]`,
            `    - value: 0.5`,
            `dtype: ${dtype}`,
        ].join('\n');
    }
    return [
        `models:`,
        modelsYaml,
        `merge_method: ${method}`,
        `base_model: ${opts.baseModel}`,
        `parameters:`,
        `  normalize: true`,
        `dtype: ${dtype}`,
    ].join('\n');
}
export async function mergeModels(opts) {
    const outputName = opts.outputName ?? `kernel-merged-${Date.now()}`;
    const outputDir = opts.outputDir ?? join(homedir(), '.kbot', 'teacher', 'merges', outputName);
    if (!existsSync(outputDir))
        mkdirSync(outputDir, { recursive: true });
    const config = buildConfig(opts);
    const configPath = join(outputDir, 'merge-config.yaml');
    writeFileSync(configPath, config);
    if (!hasBin('mergekit-yaml')) {
        return {
            ok: false,
            output_dir: outputDir,
            config_path: configPath,
            log: 'mergekit not installed. Install: pip install mergekit',
        };
    }
    const cmd = `mergekit-yaml ${configPath} ${outputDir} --cuda 0 --copy-tokenizer`;
    const r = shell(cmd);
    let ollamaName;
    if (r.ok && opts.deploy && hasBin('ollama')) {
        const modelfile = [
            `FROM ${outputDir}`,
            `PARAMETER temperature 0.2`,
            `SYSTEM "Merged model: ${opts.models.map(m => m.model).join(' + ')} via ${opts.method ?? 'ties'}."`,
        ].join('\n');
        const modelfilePath = join(outputDir, 'Modelfile');
        writeFileSync(modelfilePath, modelfile);
        ollamaName = outputName;
        shell(`ollama create ${ollamaName} -f ${modelfilePath}`);
    }
    return {
        ok: r.ok,
        output_dir: outputDir,
        config_path: configPath,
        ollama_name: ollamaName,
        log: r.output.split('\n').slice(-15).join('\n'),
    };
}
/** Convenience: sensible default TIES blend for kbot. */
export async function mergeKbotDefault() {
    return mergeModels({
        method: 'ties',
        baseModel: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        models: [
            { model: 'Qwen/Qwen2.5-Coder-7B-Instruct', weight: 0.5, density: 0.5 },
            { model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', weight: 0.3, density: 0.5 },
            { model: 'mlx-community/kernel-coder-self-latest', weight: 0.2, density: 0.7 },
        ],
        outputName: 'kernel-triad-7b',
        deploy: true,
    });
}
// ── MoE swap path (documentation) ────────────────────────────────────
//
// To use DeepSeek-V2-Lite-16B (2.4B active params) as the base for train-self:
//   kbot train-self --base-model mlx-community/DeepSeek-V2-Lite-Chat-4bit --mode default
// Expected: fits 36GB unified, outperforms dense 7B on reasoning by ~5–8% on our bench.
//
// Or Qwen3-MoE-30B-A3B (3B active):
//   kbot train-self --base-model mlx-community/Qwen3-30B-A3B-Instruct-4bit --mode default
// Larger but still viable on 36GB. Prefer this for agent-trace mode.
export function formatMergeReport(r) {
    const lines = [
        'train-merge',
        '─'.repeat(40),
        `  Status:        ${r.ok ? 'OK' : 'FAIL'}`,
        `  Output dir:    ${r.output_dir}`,
        `  Config:        ${r.config_path}`,
    ];
    if (r.ollama_name)
        lines.push(`  Ollama:        ${r.ollama_name}`);
    lines.push('', 'Log (tail):', r.log);
    return lines.join('\n');
}
//# sourceMappingURL=train-merge.js.map