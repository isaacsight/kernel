// LLaDA2.0-Uni provider client
//
// LLaDA2.0-Uni (Inclusion AI, ArXiv:2604.20796, 2026-04-22) is a unified
// discrete-diffusion LLM that does multimodal *understanding* AND text-to-image
// generation in a single MoE model. It pairs a SigLIP-VQ semantic tokenizer
// with a diffusion decoder for high-fidelity 8-step image inference.
//
// Local serving status (as of 2026-04-25):
//   The official repo (https://github.com/inclusionAI/LLaDA2.0-Uni) currently
//   ships only Python inference scripts (`scripts/t2i_generate.py`,
//   `scripts/mmu_understand.py`, `scripts/image_edit.py`) using the HF
//   transformers loader. SGLang serving is on the README's TODO list but not
//   yet released. Most users will wrap the Python entrypoints behind a small
//   OpenAI-compatible FastAPI shim, or wait for the SGLang adapter.
//
// SPEC: refine when LLaDA's API stabilizes — currently assumes OpenAI-compatible
// shape on http://localhost:8000 (the conventional vllm / TGI / SGLang layout).
// All endpoints below are speculative until the upstream serving surface lands.
const DEFAULT_BASE_URL = process.env.KBOT_LLADA_URL || 'http://localhost:8000';
const DEFAULT_MODEL = 'llada2.0-uni';
/** Typed client for a LLaDA2.0-Uni HTTP server (OpenAI-compatible shape). */
export class LLaDAClient {
    baseUrl;
    apiKey;
    timeoutMs;
    fetchImpl;
    constructor(opts = {}) {
        this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.apiKey = opts.apiKey;
        this.timeoutMs = opts.timeoutMs ?? 60_000;
        // Bind so `this` in node's global fetch stays right.
        this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    }
    /** Build standard headers — Authorization only attached when an apiKey is set. */
    headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.apiKey)
            h.Authorization = `Bearer ${this.apiKey}`;
        return h;
    }
    async post(path, body) {
        const url = `${this.baseUrl}${path}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            const res = await this.fetchImpl(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(`LLaDA ${path} failed: ${res.status} ${res.statusText} ${txt}`.trim());
            }
            return (await res.json());
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** Quick health probe. Resolves true when the server responds with 2xx. */
    async isReachable() {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2000);
            try {
                // SPEC: refine when LLaDA's API stabilizes — try /v1/models, fall back to /health.
                const res = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
                    method: 'GET',
                    signal: ctrl.signal,
                });
                if (res.ok)
                    return true;
                const res2 = await this.fetchImpl(`${this.baseUrl}/health`, {
                    method: 'GET',
                    signal: ctrl.signal,
                });
                return res2.ok;
            }
            finally {
                clearTimeout(timer);
            }
        }
        catch {
            return false;
        }
    }
    /**
     * Text chat — OpenAI-compatible POST /v1/chat/completions.
     * SPEC: refine when LLaDA's API stabilizes — currently assumes OpenAI-compatible shape.
     */
    async chat(req) {
        const body = {
            model: req.model || DEFAULT_MODEL,
            messages: req.messages,
            temperature: req.temperature ?? 0.7,
        };
        if (req.maxTokens !== undefined)
            body.max_tokens = req.maxTokens;
        if (req.thinkingSteps !== undefined) {
            // LLaDA exposes `mode: "thinking"` + `thinking_steps` in its native API.
            // We pass them as extra fields; servers that don't recognize them ignore.
            body.mode = 'thinking';
            body.thinking_steps = req.thinkingSteps;
        }
        const data = await this.post('/v1/chat/completions', body);
        const text = data.choices?.[0]?.message?.content ?? '';
        if (!text)
            throw new Error('LLaDA chat returned no content');
        const thinking = data.choices?.[0]?.message?.thinking ?? data.thinking;
        return { text, thinking, raw: data };
    }
    /**
     * Image generation. The native LLaDA call is `model.generate_image(...)`;
     * we expose it via a POST /v1/images/generations shim that accepts the
     * extra LLaDA-specific knobs (`steps`, `cfg_scale`, `thinking`).
     * SPEC: refine when LLaDA's API stabilizes — assumes OpenAI-compatible shape.
     */
    async generateImage(req) {
        const size = req.size || '1024x1024';
        const [w, h] = parseSize(size);
        const body = {
            model: DEFAULT_MODEL,
            prompt: req.prompt,
            size,
            n: 1,
            // LLaDA-native fields (ignored by stricter OpenAI servers):
            image_w: w,
            image_h: h,
            steps: req.steps ?? 8,
            cfg_scale: req.cfgScale ?? 2.0,
        };
        if (req.thinking) {
            body.mode = 'thinking';
            body.thinking_steps = 32;
        }
        if (req.refImage) {
            // SPEC: LLaDA uses `image_tokens` for editing. The likely server shim accepts
            // either `input_image` (URL/data URL) or `image` and tokenizes server-side.
            body.input_image = req.refImage;
            body.image = req.refImage;
        }
        const data = await this.post('/v1/images/generations', body);
        const item = data.data?.[0];
        if (!item)
            throw new Error('LLaDA image returned no data');
        let url = item.url;
        if (!url && item.b64_json)
            url = `data:image/png;base64,${item.b64_json}`;
        if (!url)
            throw new Error('LLaDA image returned neither url nor b64_json');
        const thinking = item.thinking ?? data.thinking;
        return { url, thinking, raw: data };
    }
    /**
     * Multimodal understanding: chat with an image attached.
     * SPEC: refine when LLaDA's API stabilizes — uses OpenAI-vision content blocks.
     */
    async understand(req) {
        if (!req.imageUrl && !req.imageData) {
            throw new Error('LLaDA.understand requires imageUrl or imageData');
        }
        const imageUrl = req.imageUrl
            ? req.imageUrl
            : req.imageData.startsWith('data:')
                ? req.imageData
                : `data:image/png;base64,${req.imageData}`;
        const messages = [
            {
                role: 'user',
                content: [
                    { type: 'text', text: req.prompt },
                    { type: 'image_url', image_url: { url: imageUrl } },
                ],
            },
        ];
        const out = await this.chat({
            model: req.model,
            messages,
            maxTokens: req.maxTokens ?? 1024,
            temperature: 0.2,
        });
        return { text: out.text, raw: out.raw };
    }
}
function parseSize(size) {
    const m = /^(\d+)\s*x\s*(\d+)$/i.exec(size.trim());
    if (!m)
        return [1024, 1024];
    return [Number(m[1]), Number(m[2])];
}
/** Convenience factory mirroring the rest of kbot's local-provider style. */
export function createLLaDAClient(opts = {}) {
    return new LLaDAClient(opts);
}
//# sourceMappingURL=llada.js.map