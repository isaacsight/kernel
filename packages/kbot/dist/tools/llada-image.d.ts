import { z } from 'zod';
import type { ToolDefinition } from './index.js';
import { LLaDAClient } from '../providers/llada.js';
export declare const lladaImageInputSchema: z.ZodObject<{
    prompt: z.ZodString;
    aspect_ratio: z.ZodDefault<z.ZodOptional<z.ZodEnum<["1:1", "16:9", "9:16", "4:3", "3:4"]>>>;
    thinking_steps: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    style_hints: z.ZodOptional<z.ZodString>;
    reference_image_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    thinking_steps: number;
    aspect_ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    style_hints?: string | undefined;
    reference_image_url?: string | undefined;
}, {
    prompt: string;
    thinking_steps?: number | undefined;
    aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | undefined;
    style_hints?: string | undefined;
    reference_image_url?: string | undefined;
}>;
export type LLaDAImageInput = z.infer<typeof lladaImageInputSchema>;
export interface LLaDAImageThoughtfulOutput {
    url: string;
    plan: string;
    refinements: string[];
    final_prompt: string;
    /** Optional reasoning trace surfaced by LLaDA's `thinking` mode. */
    thinking?: string;
}
export interface RunLLaDAImageOptions {
    /** Inject a client (for tests). Defaults to a fresh LLaDAClient(). */
    client?: LLaDAClient;
}
export declare function runLLaDAImageThoughtful(rawInput: unknown, opts?: RunLLaDAImageOptions): Promise<LLaDAImageThoughtfulOutput>;
export declare const lladaImageTool: ToolDefinition;
//# sourceMappingURL=llada-image.d.ts.map