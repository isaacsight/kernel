/** Content block types for multimodal messages */
export interface TextBlock {
    type: 'text';
    text: string;
}
export interface ImageBlock {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}
export type ContentBlock = TextBlock | ImageBlock;
/** Result of parsing a message for multimodal content */
export interface ParsedMessage {
    /** Clean text message with image paths removed */
    text: string;
    /** Content blocks for the API (text + images interleaved) */
    blocks: ContentBlock[];
    /** Number of images found */
    imageCount: number;
    /** Whether the message has multimodal content */
    isMultimodal: boolean;
}
/** Check if a file path looks like an image */
export declare function isImagePath(path: string): boolean;
/** Encode an image file to a base64 content block */
export declare function encodeImage(filePath: string): ImageBlock | null;
/**
 * Parse a user message for embedded image paths.
 *
 * Detects patterns like:
 *   "what's in ./screenshot.png"
 *   "describe /path/to/img.jpg and compare with other.png"
 *   "analyze these: img1.png img2.webp"
 */
export declare function parseMultimodalMessage(message: string): ParsedMessage;
/**
 * Read image data from stdin pipe.
 * Used for: cat image.png | kbot -p "what's this?"
 */
export declare function readStdinImage(): Promise<ImageBlock | null>;
/**
 * Convert ParsedMessage blocks to Anthropic Messages API format.
 * Returns the content array for the user message.
 */
export declare function toAnthropicContent(parsed: ParsedMessage): Array<Record<string, unknown>>;
/**
 * Convert ParsedMessage to OpenAI Vision API format.
 */
export declare function toOpenAIContent(parsed: ParsedMessage): Array<Record<string, unknown>>;
/**
 * Convert ParsedMessage to Google Gemini API format.
 */
export declare function toGeminiParts(parsed: ParsedMessage): Array<Record<string, unknown>>;
/**
 * Render an image inline in the terminal if the terminal supports it.
 * Supports Kitty graphics protocol and iTerm2 inline images.
 * Returns the escape sequence string, or null if unsupported.
 */
export declare function renderImageInTerminal(imagePath: string): Promise<string | null>;
//# sourceMappingURL=multimodal.d.ts.map