import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconDownload, IconClose, IconSparkles } from './KernelIcons'
import { SPRING } from '../constants/motion'

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
  const src = imageUrl || (image ? `data:${mimeType};base64,${image}` : '')

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ext = mimeType.split('/')[1] || 'png'
    const filename = `kernel-image-${Date.now()}.${ext}`
    const link = document.createElement('a')
    link.style.display = 'none'
    document.body.appendChild(link)
    try {
      if (imageUrl) {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        link.href = blobUrl
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      } else if (image) {
        link.href = `data:${mimeType};base64,${image}`
        link.download = filename
        link.click()
      }
    } catch {
      if (imageUrl) window.open(imageUrl, '_blank')
    } finally {
      document.body.removeChild(link)
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
