// Max raw file size for native PDF document blocks (base64 adds ~33% overhead).
// Above this, we extract text instead.
export const PDF_NATIVE_MAX_BYTES = 3.5 * 1024 * 1024

/**
 * Extract text content from a PDF file using pdf.js.
 * Dynamically imports pdfjs-dist to avoid bundling it in the main chunk.
 * Returns concatenated page text with page markers.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    if (text.trim()) {
      pages.push(`[Page ${i}]\n${text.trim()}`)
    }
  }

  return pages.join('\n\n')
}

// Convert a File to base64 (strips the data URL prefix)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
  })
}

// Maximum dimension (longest side) for images sent to Claude.
// Claude recommends 1568px max — larger images get downscaled anyway.
const IMAGE_MAX_DIMENSION = 1568
const IMAGE_JPEG_QUALITY = 0.80

/**
 * Detect whether a GIF is animated by scanning for multiple image frames.
 * Reads the raw bytes looking for the GIF frame separator (0x00 0x21 0xF9).
 */
async function isAnimatedGif(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let frameCount = 0
  // Scan for Graphic Control Extension blocks (0x21 0xF9) which precede each frame
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
      frameCount++
      if (frameCount > 1) return true
    }
  }
  return false
}

/**
 * Compress an image file by resizing to fit within IMAGE_MAX_DIMENSION
 * and re-encoding as JPEG. Returns { base64, mediaType }.
 * Animated GIFs are passed through without compression.
 * Static GIFs are compressed like other images.
 * Images already small enough are passed through unchanged.
 */
export function compressImage(
  file: File,
): Promise<{ base64: string; mediaType: string }> {
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')

  if (isGif) {
    // Only skip compression for animated GIFs — static GIFs get compressed
    return isAnimatedGif(file).then(animated => {
      if (animated) {
        return fileToBase64(file).then(base64 => ({ base64, mediaType: 'image/gif' }))
      }
      // Static GIF — compress like any other image
      return compressViaCanvas(file)
    })
  }

  return compressViaCanvas(file)
}

function compressViaCanvas(
  file: File,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { naturalWidth: w, naturalHeight: h } = img
      const longest = Math.max(w, h)

      // If image is already small and file is under 200KB, skip compression
      if (longest <= IMAGE_MAX_DIMENSION && file.size < 200 * 1024) {
        fileToBase64(file).then(base64 => {
          resolve({ base64, mediaType: file.type || 'image/jpeg' })
        }).catch(reject)
        return
      }

      // Calculate new dimensions preserving aspect ratio
      let newW = w
      let newH = h
      if (longest > IMAGE_MAX_DIMENSION) {
        const scale = IMAGE_MAX_DIMENSION / longest
        newW = Math.round(w * scale)
        newH = Math.round(h * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = newW
      canvas.height = newH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Fallback to raw base64 if canvas unavailable
        fileToBase64(file).then(base64 => {
          resolve({ base64, mediaType: file.type || 'image/jpeg' })
        }).catch(reject)
        return
      }

      ctx.drawImage(img, 0, 0, newW, newH)

      // Encode as JPEG (best compression for photos)
      const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY)
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mediaType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image: ${file.name}`))
    }

    img.src = url
  })
}
