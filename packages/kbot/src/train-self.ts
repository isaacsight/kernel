// train-self — one command to mine local corpus, fine-tune, deploy as Ollama model.
//
// Pipeline:
//   1. curate — score/filter traces from ~/.kbot/teacher/ + observer/
//   2. prepare — convert to training format (already OpenAI JSONL, mostly a validator pass)
//   3. train — launch mlx_lm.lora (or chosen backend)
//   4. fuse — merge LoRA adapter into base
//   5. convert — MLX → GGUF
//   6. deploy — register as Ollama model
//
// Presets:
//   default      — general-purpose LoRA on whole corpus
//   reasoning    — s1-style distill on thinking traces
//   agent-trace  — tool-use specialization (Phase 4)
//   code-only    — code-heavy filter
//
// Each stage is individually re-runnable via flags.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { curate, formatCurateReport, type CurateMode } from './train-curate.js'

/** MLX expects a directory with train.jsonl / valid.jsonl / test.jsonl. Split one file into that shape. */
function splitForMlx(datasetFile: string): string {
  const lines = readFileSync(datasetFile, 'utf-8').split('\n').filter(l => l.trim())
  const dir = join(dirname(datasetFile), 'mlx-split')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  // Shuffle deterministically (rotate) so rerun is stable given same input
  const shuffled = [...lines]
  // 80 / 10 / 10
  const nValid = Math.max(1, Math.floor(shuffled.length * 0.1))
  const nTest = Math.max(1, Math.floor(shuffled.length * 0.1))
  const valid = shuffled.slice(0, nValid)
  const test = shuffled.slice(nValid, nValid + nTest)
  const train = shuffled.slice(nValid + nTest)
  writeFileSync(join(dir, 'train.jsonl'), train.join('\n') + '\n')
  writeFileSync(join(dir, 'valid.jsonl'), valid.join('\n') + '\n')
  writeFileSync(join(dir, 'test.jsonl'), test.join('\n') + '\n')
  return dir
}

export interface TrainSelfOptions {
  mode?: CurateMode
  baseModel?: string                 // default: qwen2.5-coder:7b for default, deepseek-r1:14b for reasoning
  outputName?: string                // default: kernel-coder-self:v<timestamp>
  backend?: 'mlx' | 'unsloth' | 'llama-cpp' | 'together'
  dryRun?: boolean
  skipCurate?: boolean
  skipTrain?: boolean
  skipDeploy?: boolean
  iters?: number
  batchSize?: number
  numLayers?: number
  learningRate?: number
  maxExamples?: number
  datasetPath?: string
  adapterPath?: string
  fusedPath?: string
  ggufPath?: string
  gradCheckpoint?: boolean
}

interface StepResult {
  step: string
  ok: boolean
  duration_ms: number
  details?: string
}

const DEFAULT_BASES: Record<CurateMode, string> = {
  'default':      'mlx-community/Qwen2.5-Coder-7B-Instruct-4bit',
  'reasoning':    'mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit',
  'agent-trace':  'mlx-community/Qwen2.5-Coder-7B-Instruct-4bit',
  'code-only':    'mlx-community/Qwen2.5-Coder-14B-Instruct-4bit',
}

function shell(cmd: string, cwd?: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
      timeout: 4 * 60 * 60 * 1000, // 4h cap per step
      cwd,
    })
    return { ok: true, output: output.toString() }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') }
  }
}

function hasBin(bin: string): boolean {
  try { execSync(`which ${bin}`, { stdio: 'ignore' }); return true } catch { return false }
}

export async function trainSelf(opts: TrainSelfOptions = {}): Promise<{ results: StepResult[]; summary: string }> {
  const mode: CurateMode = opts.mode ?? 'default'
  const backend = opts.backend ?? 'mlx'
  const baseModel = opts.baseModel ?? DEFAULT_BASES[mode]
  const timestamp = Date.now()
  const outputName = opts.outputName ?? `kernel-${mode === 'default' ? 'self' : mode}:v${timestamp}`

  const workDir = join(homedir(), '.kbot', 'teacher', 'runs', `${mode}-${timestamp}`)
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true })

  const datasetPath = opts.datasetPath ?? join(workDir, 'dataset.jsonl')
  const adapterPath = opts.adapterPath ?? join(workDir, 'adapters')
  const fusedPath = opts.fusedPath ?? join(workDir, 'fused')
  const ggufPath = opts.ggufPath ?? join(workDir, `${outputName.replace(/:/g, '-')}.gguf`)

  const results: StepResult[] = []
  const log = (step: string, ok: boolean, duration: number, details?: string) =>
    results.push({ step, ok, duration_ms: duration, details })

  // ── Stage 1: Curate ─────────────────────────────────────────────
  if (!opts.skipCurate) {
    const t0 = Date.now()
    try {
      const r = curate({
        mode,
        output: datasetPath,
        maxExamples: opts.maxExamples ?? (mode === 'reasoning' ? 1500 : 3000),
      })
      log('curate', r.kept > 0, Date.now() - t0, formatCurateReport(r))
      if (r.kept === 0) {
        return {
          results,
          summary: `No examples passed the curator. Seed ~/.kbot/teacher/traces.jsonl by using kbot normally, then retry.`,
        }
      }
    } catch (err) {
      log('curate', false, Date.now() - t0, err instanceof Error ? err.message : String(err))
      return { results, summary: 'Curate failed. See results.' }
    }
  }

  if (opts.dryRun) {
    return { results, summary: `Dry run. Dataset at ${datasetPath}. Would train ${baseModel} → ${outputName}.` }
  }

  // ── Stage 2: Train ──────────────────────────────────────────────
  if (!opts.skipTrain) {
    if (backend === 'mlx' && !hasBin('mlx_lm.lora')) {
      log('train', false, 0, 'mlx_lm.lora not found. Install: pip install mlx-lm')
      return { results, summary: 'MLX not installed.' }
    }
    const t0 = Date.now()
    if (backend === 'mlx') {
      const iters = opts.iters ?? (mode === 'reasoning' ? 1500 : 1000)
      const batch = opts.batchSize ?? 1
      const layers = opts.numLayers ?? 8
      const lr = opts.learningRate ?? 1e-5
      const grad = opts.gradCheckpoint !== false ? '--grad-checkpoint' : ''
      // MLX expects a directory with train/valid/test.jsonl
      const dataDir = splitForMlx(datasetPath)
      const cmd = [
        'mlx_lm.lora',
        '--model', baseModel,
        '--train',
        '--data', dataDir,
        '--batch-size', String(batch),
        '--num-layers', String(layers),
        '--iters', String(iters),
        '--learning-rate', String(lr),
        '--adapter-path', adapterPath,
        grad,
      ].filter(Boolean).join(' ')
      const r = shell(cmd)
      log('train', r.ok, Date.now() - t0, r.output.split('\n').slice(-15).join('\n'))
      if (!r.ok) return { results, summary: 'Training failed. See log.' }
    } else if (backend === 'together') {
      // Cloud fallback — delegate to existing train_start tool expectations
      log('train', false, Date.now() - t0, 'Cloud backend: use `kbot train_start --backend together` directly; train-self cloud flow not yet implemented.')
      return { results, summary: 'Cloud backend not wired in train-self yet.' }
    } else {
      log('train', false, Date.now() - t0, `Backend ${backend} not yet wired; use mlx.`)
      return { results, summary: `Backend ${backend} not supported in train-self yet.` }
    }
  }

  // ── Stage 3: Fuse adapter ───────────────────────────────────────
  if (!opts.skipTrain && hasBin('mlx_lm.fuse')) {
    const t0 = Date.now()
    const cmd = [
      'mlx_lm.fuse',
      '--model', baseModel,
      '--adapter-path', adapterPath,
      '--save-path', fusedPath,
    ].join(' ')
    const r = shell(cmd)
    log('fuse', r.ok, Date.now() - t0, r.output.split('\n').slice(-8).join('\n'))
    if (!r.ok) return { results, summary: 'Fuse failed.' }
  }

  // ── Stage 4: Convert to GGUF (for Ollama) ───────────────────────
  if (!opts.skipDeploy) {
    const t0 = Date.now()
    // Preferred: llama.cpp convert script
    if (hasBin('python3')) {
      const convertCmd = `python3 -m mlx_lm.convert --hf-path ${fusedPath} --quantize --q-bits 4 --mlx-path ${fusedPath}-mlx4`
      const r = shell(convertCmd)
      log('quantize', r.ok, Date.now() - t0, r.output.split('\n').slice(-8).join('\n'))
    } else {
      log('quantize', false, Date.now() - t0, 'python3 not available')
    }
  }

  // ── Stage 5: Deploy to Ollama ───────────────────────────────────
  if (!opts.skipDeploy && hasBin('ollama')) {
    const t0 = Date.now()
    // Write a Modelfile that points Ollama at the fused weights.
    // For a first pass we use the GGUF path if it exists, else the fused dir.
    const modelfilePath = join(workDir, 'Modelfile')
    const fromPath = existsSync(ggufPath) ? ggufPath : fusedPath
    const modelfile = [
      `FROM ${fromPath}`,
      `PARAMETER temperature 0.2`,
      `PARAMETER top_p 0.9`,
      `SYSTEM "You are kbot's self-trained assistant (${mode} mode). You were fine-tuned on the operator's own agent sessions."`,
    ].join('\n')
    try {
      writeFileSync(modelfilePath, modelfile)
      const cmd = `ollama create ${outputName} -f ${modelfilePath}`
      const r = shell(cmd)
      log('deploy', r.ok, Date.now() - t0, r.output.split('\n').slice(-8).join('\n'))
      if (!r.ok) return { results, summary: 'Deploy failed.' }
    } catch (err) {
      log('deploy', false, Date.now() - t0, err instanceof Error ? err.message : String(err))
      return { results, summary: 'Deploy failed.' }
    }
  }

  const allOk = results.every(r => r.ok)
  return {
    results,
    summary: allOk
      ? `Success. Model registered as Ollama: ${outputName}. Test with: kbot local && kbot --model ${outputName}`
      : `Partial success. ${results.filter(r => r.ok).length}/${results.length} steps passed.`,
  }
}

/** CLI-facing: pretty-print a run. */
export function formatTrainSelfReport(r: { results: StepResult[]; summary: string }): string {
  const lines: string[] = ['train-self', '─'.repeat(50)]
  for (const step of r.results) {
    const icon = step.ok ? 'ok' : 'FAIL'
    const ms = `${(step.duration_ms / 1000).toFixed(1)}s`
    lines.push(`  [${icon.padStart(4)}] ${step.step.padEnd(12)} ${ms.padStart(8)}`)
    if (step.details) {
      for (const d of step.details.split('\n').slice(0, 6)) {
        lines.push(`         ${d}`)
      }
    }
  }
  lines.push('', r.summary)
  return lines.join('\n')
}
