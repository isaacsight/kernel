import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconDownload, IconClose } from './KernelIcons'
import { SPRING } from '../constants/motion'

interface GeneratedImageCardProps {
  image?: string  // base64
  imageUrl?: string  // persistent storage URL
  mimeType: string
  prompt: string
  creditsRemaining?: number
}

export function GeneratedImageCard({ image, imageUrl, mimeType, prompt, creditsRemaining }: GeneratedImageCardProps) {
  const [lightbox, setLightbox] = useState(false)
  const src = imageUrl || (image ? `data:${mimeType};base64,${image}` : '')

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ext = mimeType.split('/')[1] || 'png'
    const link = document.createElement('a')
    if (imageUrl) {
      // For remote URLs, fetch as blob to trigger download
      try {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        link.href = URL.createObjectURL(blob)
        link.download = `kernel-image-${Date.now()}.${ext}`
        link.click()
        URL.revokeObjectURL(link.href)
      } catch {
        // Fallback: open in new tab
        window.open(imageUrl, '_blank')
      }
    } else if (image) {
      link.href = `data:${mimeType};base64,${image}`
      link.download = `kernel-image-${Date.now()}.${ext}`
      link.click()
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
            <button className="ka-gen-image-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">
              <IconClose size={20} />
            </button>
            <img
              src={src}
              alt={prompt || 'AI-generated image'}
              className="ka-gen-image-lightbox-img"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
