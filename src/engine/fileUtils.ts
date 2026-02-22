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
 * Compress an image file by resizing to fit within IMAGE_MAX_DIMENSION
 * and re-encoding as JPEG. Returns { base64, mediaType }.
 * GIFs are passed through without compression (may be animated).
 * Images already small enough are passed through unchanged.
 */
export function compressImage(
  file: File,
): Promise<{ base64: string; mediaType: string }> {
  // GIFs may be animated — pass through without compression
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
  if (isGif) {
    return fileToBase64(file).then(base64 => ({ base64, mediaType: 'image/gif' }))
  }

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
