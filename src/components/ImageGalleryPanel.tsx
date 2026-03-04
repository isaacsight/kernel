// ─── ImageGalleryPanel — Browse Past Generated Images ─────────────
//
// Bottom-sheet panel showing all generated images for the current user.
// Grid of thumbnails with lightbox view, prompt text, and "Use as starting point" for refinement.

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '../constants/motion'
import { supabase } from '../engine/SupabaseClient'
import { IconClose, IconImage, IconSparkles } from './KernelIcons'

interface GalleryImage {
  id: string
  prompt: string
  storage_path: string
  mime_type: string
  created_at: string
  signedUrl?: string
}

interface ImageGalleryPanelProps {
  userId: string
  onClose: () => void
  onUseAsStartingPoint?: (imageUrl: string, mimeType: string, prompt: string) => void
}

export function ImageGalleryPanel({ userId, onClose, onUseAsStartingPoint }: ImageGalleryPanelProps) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null)

  const loadImages = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('generated_images')
      .select('id, prompt, storage_path, mime_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[ImageGallery] Failed to load images:', error)
      setLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setImages([])
      setLoading(false)
      return
    }

    // Get signed URLs for all images
    const paths = data.map(d => d.storage_path)
    const { data: signedData } = await supabase.storage
      .from('generated-images')
      .createSignedUrls(paths, 60 * 60) // 1 hour expiry

    const withUrls = data.map((img, i) => ({
      ...img,
      signedUrl: signedData?.[i]?.signedUrl || undefined,
    }))

    setImages(withUrls)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadImages() }, [loadImages])

  const handleUseAsStartingPoint = useCallback(async (img: GalleryImage) => {
    if (!img.signedUrl || !onUseAsStartingPoint) return
    onUseAsStartingPoint(img.signedUrl, img.mime_type, img.prompt)
    setLightboxImage(null)
    onClose()
  }, [onUseAsStartingPoint, onClose])

  return (
    <div className="ka-gallery-panel">
      <div className="ka-gallery-header">
        <div className="ka-gallery-header-left">
          <IconImage size={18} />
          <h3 className="ka-gallery-title">Image Gallery</h3>
          <span className="ka-gallery-count">{images.length} image{images.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="ka-gallery-close" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      {loading ? (
        <div className="ka-gallery-loading">
          <div className="ka-gallery-loading-dots">
            <span /><span /><span />
          </div>
        </div>
      ) : images.length === 0 ? (
        <div className="ka-empty-state">
          <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-briefings.svg`} alt="" />
          <div className="ka-empty-state-title">No images generated yet</div>
          <div className="ka-empty-state-desc">Ask Kernel to generate an image to get started.</div>
        </div>
      ) : (
        <div className="ka-gallery-grid">
          {images.map(img => (
            <motion.div
              key={img.id}
              className="ka-gallery-thumb"
              onClick={() => setLightboxImage(img)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING.GENTLE}
            >
              {img.signedUrl ? (
                <img src={img.signedUrl} alt={img.prompt} className="ka-gallery-thumb-img" loading="lazy" />
              ) : (
                <div className="ka-gallery-thumb-placeholder"><IconImage size={24} /></div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            className="ka-gallery-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
          >
            <div className="ka-gallery-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="ka-gallery-lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Close">
                <IconClose size={20} />
              </button>
              {lightboxImage.signedUrl && (
                <img
                  src={lightboxImage.signedUrl}
                  alt={lightboxImage.prompt}
                  className="ka-gallery-lightbox-img"
                />
              )}
              <div className="ka-gallery-lightbox-info">
                <p className="ka-gallery-lightbox-prompt">{lightboxImage.prompt}</p>
                <p className="ka-gallery-lightbox-date">
                  {new Date(lightboxImage.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {onUseAsStartingPoint && lightboxImage.signedUrl && (
                  <button className="ka-gallery-use-btn" onClick={() => handleUseAsStartingPoint(lightboxImage)}>
                    <IconSparkles size={14} />
                    Use as starting point
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
