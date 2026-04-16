// kbot Image Variation Tool — Generates variations of an image.
import { registerTool } from './index.js';
export function registerImageVariationTools() {
    registerTool({
        name: 'image_variation',
        description: 'Generate variations of an image using a URL. Supports different sizes and formats.',
        parameters: {
            image_url: { type: 'string', description: 'URL of the image to generate variations for', required: true },
            width: { type: 'integer', description: 'Width of the generated image in pixels (optional)', default: 256 },
            height: { type: 'integer', description: 'Height of the generated image in pixels (optional)', default: 256 },
            format: { type: 'string', description: 'Format of the generated image (jpg, png, webp) (optional)', default: 'jpg' },
        },
        tier: 'pro',
        async execute(args) {
            const imageUrl = String(args.image_url);
            const width = Number(args.width) || 256;
            const height = Number(args.height) || 256;
            const format = String(args.format).toLowerCase() || 'jpg';
            try {
                const url = `https://api.imgproxy.net/kbot/resize?width=${width}&height=${height}&format=${format}&url=${encodeURIComponent(imageUrl)}`;
                const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
                const imageBuffer = await res.arrayBuffer();
                return `data:image/${format};base64,${Buffer.from(imageBuffer).toString('base64')}`;
            }
            catch (error) {
                return `Error generating image variation: ${error}`;
            }
        },
    });
}
//# sourceMappingURL=image-variation.js.map