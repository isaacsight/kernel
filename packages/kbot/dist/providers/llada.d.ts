export interface LLaDAClientOptions {
    baseUrl?: string;
    apiKey?: string;
    /** Default request timeout in ms. */
    timeoutMs?: number;
    /** Optional fetch override (used by tests). */
    fetchImpl?: typeof fetch;
}
export interface LLaDAChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{
        type: 'text';
        text: string;
    } | {
        type: 'image_url';
        image_url: {
            url: string;
        };
    }>;
}
export interface LLaDAChatRequest {
    messages: LLaDAChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** Optional thinking budget — LLaDA supports `mode: "thinking"` with `thinking_steps`. */
    thinkingSteps?: number;
}
export interface LLaDAChatResponse {
    text: string;
    /** When `thinkingSteps` is set, LLaDA returns the reasoning trace. */
    thinking?: string;
    raw?: unknown;
}
export interface LLaDAImageRequest {
    prompt: string;
    /** Either "1024x1024" / "WxH" — converted to image_h/image_w server-side. */
    size?: string;
    /** Optional reference image (URL or base64 data URL) for image editing. */
    refImage?: string;
    /** Diffusion sampling steps (LLaDA defaults to 8 with the turbo decoder). */
    steps?: number;
    cfgScale?: number;
    /** Enable LLaDA's interleaved thinking-then-generate mode. */
    thinking?: boolean;
}
export interface LLaDAImageResponse {
    /** A URL or `data:image/png;base64,...` payload. */
    url: string;
    /** Reasoning trace, only present when `thinking: true`. */
    thinking?: string;
    raw?: unknown;
}
export interface LLaDAUnderstandRequest {
    prompt: string;
    /** Pass exactly one of imageUrl or imageData (base64). */
    imageUrl?: string;
    imageData?: string;
    model?: string;
    maxTokens?: number;
}
export interface LLaDAUnderstandResponse {
    text: string;
    raw?: unknown;
}
/** Typed client for a LLaDA2.0-Uni HTTP server (OpenAI-compatible shape). */
export declare class LLaDAClient {
    readonly baseUrl: string;
    readonly apiKey: string | undefined;
    private readonly timeoutMs;
    private readonly fetchImpl;
    constructor(opts?: LLaDAClientOptions);
    /** Build standard headers — Authorization only attached when an apiKey is set. */
    private headers;
    private post;
    /** Quick health probe. Resolves true when the server responds with 2xx. */
    isReachable(): Promise<boolean>;
    /**
     * Text chat — OpenAI-compatible POST /v1/chat/completions.
     * SPEC: refine when LLaDA's API stabilizes — currently assumes OpenAI-compatible shape.
     */
    chat(req: LLaDAChatRequest): Promise<LLaDAChatResponse>;
    /**
     * Image generation. The native LLaDA call is `model.generate_image(...)`;
     * we expose it via a POST /v1/images/generations shim that accepts the
     * extra LLaDA-specific knobs (`steps`, `cfg_scale`, `thinking`).
     * SPEC: refine when LLaDA's API stabilizes — assumes OpenAI-compatible shape.
     */
    generateImage(req: LLaDAImageRequest): Promise<LLaDAImageResponse>;
    /**
     * Multimodal understanding: chat with an image attached.
     * SPEC: refine when LLaDA's API stabilizes — uses OpenAI-vision content blocks.
     */
    understand(req: LLaDAUnderstandRequest): Promise<LLaDAUnderstandResponse>;
}
/** Convenience factory mirroring the rest of kbot's local-provider style. */
export declare function createLLaDAClient(opts?: LLaDAClientOptions): LLaDAClient;
//# sourceMappingURL=llada.d.ts.map