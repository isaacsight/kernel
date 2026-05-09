import { z } from 'zod';
import type { ToolDefinition } from './index.js';
export declare const imageThoughtfulInputSchema: z.ZodObject<{
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
export type ImageThoughtfulInput = z.infer<typeof imageThoughtfulInputSchema>;
export interface ImageThoughtfulOutput {
    url: string;
    plan: string;
    refinements: string[];
    final_prompt: string;
}
export declare function runImageThoughtful(rawInput: unknown, env?: NodeJS.ProcessEnv): Promise<ImageThoughtfulOutput>;
export declare const imageThoughtfulTool: ToolDefinition;
//# sourceMappingURL=image-thoughtful.d.ts.map