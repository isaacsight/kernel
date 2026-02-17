// ─── FilePreview ─────────────────────────────────────────
//
// Thumbnail/page-count preview for attached files before sending.

import { useState, useEffect } from 'react'
import { FileText, Image, File, X } from 'lucide-react'

interface FilePreviewProps {
  file: File
  onRemove: () => void
  disabled?: boolean
}

export function FilePreview({ file, onRemove, disabled }: FilePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  const sizeLabel = file.size < 1024
    ? `${file.size}B`
    : file.size < 1048576
      ? `${(file.size / 1024).toFixed(0)}KB`
      : `${(file.size / 1048576).toFixed(1)}MB`

  const icon = isImage ? <Image size={16} /> : isPdf ? <FileText size={16} /> : <File size={16} />

  return (
    <div className="ka-file-preview">
      <div className="ka-file-preview-thumb">
        {preview ? (
          <img
            src={preview}
            alt={file.name}
            className="ka-file-preview-img"
            onError={() => setPreview(null)}
          />
        ) : (
          <div className="ka-file-preview-icon">{icon}</div>
        )}
      </div>
      <div className="ka-file-preview-info">
        <span className="ka-file-preview-name">{file.name}</span>
        <span className="ka-file-preview-size">{sizeLabel}</span>
      </div>
      {!disabled && (
        <button type="button" className="ka-file-preview-remove" onClick={onRemove} aria-label="Remove file">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
