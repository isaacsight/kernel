import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { IconDownload, IconClose, IconSparkles, IconCopy, IconCheck } from './KernelIcons'
import { SPRING } from '../constants/motion'

/** Convert any image blob to PNG for clipboard (ClipboardItem requires image/png) */
function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

interface GeneratedImageCardProps {
  image?: string  // base64
  imageUrl?: string  // persistent storage URL
  mimeType: string
  prompt: string
  creditsRemaining?: number
  onRefine?: () => void
}

export function GeneratedImageCard({ image, imageUrl, mimeType, prompt, creditsRemaining, onRefine }: GeneratedImageCardProps) {
  const [lightbox, setLightbox] = useState(false)
  const [copied, setCopied] = useState(false)
  const src = imageUrl || (image ? `data:${mimeType};base64,${image}` : '')

  const getBlob = useCallback(async (): Promise<Blob> => {
    if (imageUrl) {
      const res = await fetch(imageUrl)
      return res.blob()
    }
    // base64 → blob
    const byteString = atob(image!)
    const bytes = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
    return new Blob([bytes], { type: mimeType })
  }, [image, imageUrl, mimeType])

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ext = mimeType.split('/')[1] || 'png'
    const filename = `kernel-image-${Date.now()}.${ext}`
    const link = document.createElement('a')
    link.style.display = 'none'
    document.body.appendChild(link)
    try {
      const blob = await getBlob()
      const blobUrl = URL.createObjectURL(blob)
      link.href = blobUrl
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch {
      if (imageUrl) window.open(imageUrl, '_blank')
    } finally {
      document.body.removeChild(link)
    }
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const blob = await getBlob()
      // ClipboardItem needs image/png — convert if needed
      const pngBlob = mimeType === 'image/png' ? blob : await convertToPng(blob)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: copy the URL/data-url as text
      try { await navigator.clipboard.writeText(src) } catch { /* ignore */ }
    }
  }

  return (
    <>
      <motion.div
        className="ka-gen-image"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.GENTLE}
      >
        <div className="ka-gen-image-header">
          <span className="ka-gen-image-label">Generated image</span>
          {creditsRemaining !== undefined && (
            <span className="ka-gen-image-credits">{creditsRemaining} credits left</span>
          )}
        </div>
        <div className="ka-gen-image-container" onClick={() => setLightbox(true)}>
          <img src={src} alt={prompt || 'AI-generated image'} className="ka-gen-image-img" />
          {onRefine && (
            <button className="ka-gen-image-refine" onClick={(e) => { e.stopPropagation(); onRefine() }} aria-label="Refine image">
              <IconSparkles size={16} />
            </button>
          )}
          <button className="ka-gen-image-download" onClick={handleDownload} aria-label="Download image">
            <IconDownload size={16} />
          </button>
        </div>
        {prompt && <p className="ka-gen-image-caption">{prompt}</p>}
      </motion.div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="ka-gen-image-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
          >
            <div className="ka-gen-image-lightbox-actions" onClick={e => e.stopPropagation()}>
              <button className="ka-gen-image-lightbox-btn" onClick={handleDownload} aria-label="Download image">
                <IconDownload size={20} />
              </button>
              <button className="ka-gen-image-lightbox-btn" onClick={handleCopy} aria-label="Copy image">
                {copied ? <IconCheck size={20} /> : <IconCopy size={20} />}
              </button>
              <button className="ka-gen-image-lightbox-btn" onClick={() => setLightbox(false)} aria-label="Close">
                <IconClose size={20} />
              </button>
            </div>
            <img
              src={src}
              alt={prompt || 'AI-generated image'}
              className="ka-gen-image-lightbox-img"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
