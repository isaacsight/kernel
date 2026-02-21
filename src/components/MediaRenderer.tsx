import { motion } from 'framer-motion'
import type { MediaAttachment } from '../types'

interface MediaRendererProps {
  content: string
  isStreaming?: boolean
  attachments?: MediaAttachment[]
}

// Regex patterns for different media types
const IMAGE_REGEX = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)/gi
const VIDEO_REGEX = /(https?:\/\/[^\s]+\.(?:mp4|webm|mov)(?:\?[^\s]*)?)/gi
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi
const VIMEO_REGEX = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/gi

interface MediaItem {
  type: 'image' | 'video' | 'youtube' | 'vimeo' | 'link'
  url: string
  embedId?: string
}

function extractMedia(content: string): { text: string; media: MediaItem[] } {
  const media: MediaItem[] = []
  let text = content

  // Extract YouTube
  const youtubeMatches = [...content.matchAll(YOUTUBE_REGEX)]
  youtubeMatches.forEach(match => {
    media.push({ type: 'youtube', url: match[0], embedId: match[1] })
    text = text.replace(match[0], '')
  })

  // Extract Vimeo
  const vimeoMatches = [...content.matchAll(VIMEO_REGEX)]
  vimeoMatches.forEach(match => {
    media.push({ type: 'vimeo', url: match[0], embedId: match[1] })
    text = text.replace(match[0], '')
  })

  // Extract images
  const imageMatches = [...content.matchAll(IMAGE_REGEX)]
  imageMatches.forEach(match => {
    media.push({ type: 'image', url: match[0] })
    text = text.replace(match[0], '')
  })

  // Extract videos
  const videoMatches = [...content.matchAll(VIDEO_REGEX)]
  videoMatches.forEach(match => {
    media.push({ type: 'video', url: match[0] })
    text = text.replace(match[0], '')
  })

  return { text: text.trim(), media }
}

export function MediaRenderer({ content, isStreaming, attachments }: MediaRendererProps) {
  const { text, media } = extractMedia(content)

  // Combine extracted media from URLs with explicit attachments
  const allMedia = [...media]

  return (
    <div className="ka-media-stack">
      {/* Uploaded media attachments */}
      {attachments && attachments.length > 0 && (
        <div className="ka-media-attachments">
          {attachments.map((att, idx) => (
            <motion.div
              key={`attachment-${idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ka-media-thumb"
            >
              {att.type === 'image' ? (
                <img
                  src={att.url}
                  alt="Shared image"
                  className="ka-media-img"
                />
              ) : (
                <video
                  src={att.url}
                  controls
                  className="ka-media-video"
                />
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Text content */}
      {text && (
        <div>
          {text}
          {isStreaming && <span className="ka-media-cursor" />}
        </div>
      )}

      {/* Media embeds */}
      {media.length > 0 && (
        <div className="ka-media-stack">
          {media.map((item, index) => (
            <motion.div
              key={`${item.url}-${index}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="ka-media-thumb"
            >
              {item.type === 'image' && (
                <img
                  src={item.url}
                  alt="Shared image"
                  className="ka-media-embed-img"
                  loading="lazy"
                />
              )}

              {item.type === 'video' && (
                <video
                  src={item.url}
                  controls
                  className="ka-media-embed-video"
                  preload="metadata"
                />
              )}

              {item.type === 'youtube' && item.embedId && (
                <div className="ka-media-aspect">
                  <iframe
                    src={`https://www.youtube.com/embed/${item.embedId}`}
                    title="YouTube video"
                    className="ka-media-iframe"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {item.type === 'vimeo' && item.embedId && (
                <div className="ka-media-aspect">
                  <iframe
                    src={`https://player.vimeo.com/video/${item.embedId}`}
                    title="Vimeo video"
                    className="ka-media-iframe"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Streaming cursor when no text but streaming */}
      {!text && isStreaming && <span className="ka-media-cursor" />}
    </div>
  )
}
