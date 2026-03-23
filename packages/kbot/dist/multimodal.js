// kbot Multimodal Input — Accept images, PDFs, and binary files in CLI
//
// Detects image paths in user messages, encodes them to base64,
// and builds content blocks for vision-capable providers.
//
// Supported:
//   kbot "what's in this image?" ./screenshot.png
//   kbot "describe this" /path/to/photo.jpg
//   cat image.png | kbot -p "what's this?"
//   kbot "compare these" img1.png img2.png
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { detectTerminalCapabilities } from './terminal-caps.js';
/** MIME types for supported image formats */
const IMAGE_MIMES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
};
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB per image
/** Check if a file path looks like an image */
export function isImagePath(path) {
    const ext = extname(path).toLowerCase();
    return ext in IMAGE_MIMES;
}
/** Encode an image file to a base64 content block */
export function encodeImage(filePath) {
    const absPath = resolve(filePath);
    if (!existsSync(absPath))
        return null;
    const stat = statSync(absPath);
    if (stat.size > MAX_IMAGE_SIZE)
        return null;
    if (stat.isDirectory())
        return null;
    const ext = extname(absPath).toLowerCase();
    const mime = IMAGE_MIMES[ext];
    if (!mime)
        return null;
    const data = readFileSync(absPath).toString('base64');
    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: mime,
            data,
        },
    };
}
/**
 * Parse a user message for embedded image paths.
 *
 * Detects patterns like:
 *   "what's in ./screenshot.png"
 *   "describe /path/to/img.jpg and compare with other.png"
 *   "analyze these: img1.png img2.webp"
 */
export function parseMultimodalMessage(message) {
    // Match file paths that look like images
    // Patterns: ./file.png, /abs/path.jpg, relative/path.webp, ~/path.gif
    const pathRegex = /(?:^|\s)((?:\.{0,2}\/|~\/|[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|gif|webp|bmp|svg))(?:\s|$)/gi;
    const images = [];
    const foundPaths = [];
    let match;
    while ((match = pathRegex.exec(message)) !== null) {
        const filePath = match[1].trim();
        const encoded = encodeImage(filePath);
        if (encoded) {
            images.push(encoded);
            foundPaths.push(filePath);
        }
    }
    if (images.length === 0) {
        return {
            text: message,
            blocks: [{ type: 'text', text: message }],
            imageCount: 0,
            isMultimodal: false,
        };
    }
    // Remove image paths from the text message
    let cleanText = message;
    for (const p of foundPaths) {
        cleanText = cleanText.replace(p, '').trim();
    }
    // Clean up double spaces
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();
    if (!cleanText)
        cleanText = 'Describe this image.';
    // Build interleaved content blocks: text first, then images
    const blocks = [
        { type: 'text', text: cleanText },
        ...images,
    ];
    return {
        text: cleanText,
        blocks,
        imageCount: images.length,
        isMultimodal: true,
    };
}
/**
 * Read image data from stdin pipe.
 * Used for: cat image.png | kbot -p "what's this?"
 */
export async function readStdinImage() {
    if (process.stdin.isTTY)
        return null;
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    if (data.length === 0)
        return null;
    // Detect image type from magic bytes
    const mime = detectMimeFromBytes(data);
    if (!mime)
        return null;
    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: mime,
            data: data.toString('base64'),
        },
    };
}
/** Detect image MIME type from file magic bytes */
function detectMimeFromBytes(data) {
    if (data.length < 4)
        return null;
    // PNG: 89 50 4E 47
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        return 'image/png';
    }
    // JPEG: FF D8 FF
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
        return 'image/jpeg';
    }
    // GIF: 47 49 46
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
        return 'image/gif';
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data.length > 11 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
        return 'image/webp';
    }
    // BMP: 42 4D
    if (data[0] === 0x42 && data[1] === 0x4D) {
        return 'image/bmp';
    }
    return null;
}
/**
 * Convert ParsedMessage blocks to Anthropic Messages API format.
 * Returns the content array for the user message.
 */
export function toAnthropicContent(parsed) {
    return parsed.blocks.map(block => {
        if (block.type === 'text') {
            return { type: 'text', text: block.text };
        }
        return {
            type: 'image',
            source: block.source,
        };
    });
}
/**
 * Convert ParsedMessage to OpenAI Vision API format.
 */
export function toOpenAIContent(parsed) {
    return parsed.blocks.map(block => {
        if (block.type === 'text') {
            return { type: 'text', text: block.text };
        }
        return {
            type: 'image_url',
            image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`,
            },
        };
    });
}
/**
 * Convert ParsedMessage to Google Gemini API format.
 */
export function toGeminiParts(parsed) {
    return parsed.blocks.map(block => {
        if (block.type === 'text') {
            return { text: block.text };
        }
        return {
            inline_data: {
                mime_type: block.source.media_type,
                data: block.source.data,
            },
        };
    });
}
// ── Inline Image Rendering ──
// Render images directly in terminals that support it (Kitty, iTerm2).
// Returns null if the terminal has no inline image support.
/**
 * Render an image inline in the terminal if the terminal supports it.
 * Supports Kitty graphics protocol and iTerm2 inline images.
 * Returns the escape sequence string, or null if unsupported.
 */
export async function renderImageInTerminal(imagePath) {
    const caps = detectTerminalCapabilities();
    if (!caps.kittyGraphics && !caps.iterm2Images && !caps.sixel) {
        return null; // Terminal doesn't support inline images
    }
    const absPath = resolve(imagePath);
    if (!existsSync(absPath))
        return null;
    const data = await readFile(absPath);
    const base64 = data.toString('base64');
    if (caps.kittyGraphics) {
        // Kitty graphics protocol
        // \x1b_Ga=T,f=100,<more params>;<base64 data>\x1b\\
        // Chunk the base64 data (4096 bytes per chunk)
        const chunks = [];
        for (let i = 0; i < base64.length; i += 4096) {
            const chunk = base64.slice(i, i + 4096);
            const isLast = i + 4096 >= base64.length;
            if (chunks.length === 0) {
                chunks.push(`\x1b_Ga=T,f=100,m=${isLast ? 0 : 1};${chunk}\x1b\\`);
            }
            else {
                chunks.push(`\x1b_Gm=${isLast ? 0 : 1};${chunk}\x1b\\`);
            }
        }
        return chunks.join('');
    }
    if (caps.iterm2Images) {
        // iTerm2 inline image protocol
        const params = `size=${data.length};inline=1`;
        return `\x1b]1337;File=${params}:${base64}\x07`;
    }
    // Sixel would require pixel-to-sixel conversion — skip for now
    return null;
}
//# sourceMappingURL=multimodal.js.map