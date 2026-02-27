// GeneratedImageCard — Artifact-style card for AI-generated images
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconDownload, IconClose } from './KernelIcons'
import { SPRING } from '../constants/motion'

interface GeneratedImageCardProps {
  images: { data: string; mimeType: string }[]
  text?: string
}

export function GeneratedImageCard({ images, text }: GeneratedImageCardProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const handleDownload = useCallback((data: string, mimeType: string, index: number) => {
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const link = document.createElement('a')
    link.href = `data:${mimeType};base64,${data}`
    link.download = `kernel-image-${Date.now()}-${index}.${ext}`
    link.click()
  }, [])

  return (
    <>
      <motion.div
        className="ka-generated-image"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.GENTLE}
      >
        <div className="ka-generated-image-header">
          <span className="ka-generated-image-label">Generated Image</span>
        </div>
        <div className="ka-generated-image-grid">
          {images.map((img, i) => (
            <div key={i} className="ka-generated-image-wrap">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={text || 'AI-generated image'}
                className="ka-generated-image-img"
                onClick={() => setLightboxIndex(i)}
              />
              <button
                className="ka-generated-image-download"
                onClick={() => handleDownload(img.data, img.mimeType, i)}
                aria-label="Download image"
              >
                <IconDownload size={14} />
              </button>
            </div>
          ))}
        </div>
        {text && <p className="ka-generated-image-caption">{text}</p>}
      </motion.div>

      <AnimatePresence>
        {lightboxIndex !== null && images[lightboxIndex] && (
          <motion.div
            className="ka-generated-image-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIndex(null)}
          >
            <button
              className="ka-generated-image-lightbox-close"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close lightbox"
            >
              <IconClose size={20} />
            </button>
            <img
              src={`data:${images[lightboxIndex].mimeType};base64,${images[lightboxIndex].data}`}
              alt={text || 'AI-generated image'}
              className="ka-generated-image-lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
