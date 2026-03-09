import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '../constants/motion'
import { useUserFiles, type UserFile, type UserFileFolder } from '../hooks/useUserFiles'
import { isSystemFolder } from '../engine/chatFolderAutoSave'
import {
  IconClose, IconPlus, IconTrash, IconFolder, IconImage, IconFileText,
  IconDownload, IconChevronRight, IconAlertCircle,
} from './KernelIcons'

// ─── Helpers ────────────────────────────────────────

function isImage(mime: string) {
  return mime.startsWith('image/')
}

function isVideo(mime: string) {
  return mime.startsWith('video/')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime: string) {
  if (isImage(mime)) return <IconImage size={20} />
  return <IconFileText size={20} />
}

// ─── Component ──────────────────────────────────────

interface FilesPanelProps {
  userId: string
  onClose: () => void
}

export function FilesPanel({ userId, onClose }: FilesPanelProps) {
  const uf = useUserFiles(userId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [previewFile, setPreviewFile] = useState<UserFile | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ fileId: string; x: number; y: number } | null>(null)
  const [moveTarget, setMoveTarget] = useState<string | null>(null)

  // ── Upload handler ─────────────────────────────────

  const handleUpload = useCallback((files: FileList | File[]) => {
    uf.uploadFiles(Array.from(files))
  }, [uf])

  // ── Drag & drop ────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }, [handleUpload])

  // ── Create folder ──────────────────────────────────

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim()
    if (!name) return
    uf.createFolder(name)
    setNewFolderName('')
    setShowNewFolder(false)
  }, [newFolderName, uf])

  // ── Download file ──────────────────────────────────

  const handleDownload = useCallback((file: UserFile) => {
    if (!file.url) return
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.filename
    a.click()
  }, [])

  return (
    <div className="ka-files-panel">
      <div className="ka-files-panel-header">
        <h2 className="ka-panel-title">Files</h2>
        <div className="ka-files-panel-actions">
          <button
            className="ka-files-action-btn"
            onClick={() => setShowNewFolder(true)}
            title="New folder"
          >
            <IconFolder size={16} />
            <IconPlus size={10} />
          </button>
          <button
            className="ka-files-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload files"
          >
            <IconPlus size={16} />
          </button>
          <button className="ka-project-panel-close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          className="ka-attach-input"
          onChange={e => {
            if (e.target.files) handleUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Breadcrumbs */}
      {uf.breadcrumbs.length > 1 && (
        <div className="ka-files-breadcrumbs">
          {uf.breadcrumbs.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="ka-files-breadcrumb">
              {i > 0 && <IconChevronRight size={12} />}
              <button
                className={`ka-files-breadcrumb-btn${i === uf.breadcrumbs.length - 1 ? ' ka-files-breadcrumb-btn--active' : ''}`}
                onClick={() => uf.navigateToBreadcrumb(i)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* New folder input */}
      <AnimatePresence>
        {showNewFolder && (
          <motion.div
            className="ka-files-new-folder"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <IconFolder size={16} />
            <input
              className="ka-gate-input ka-files-new-folder-input"
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setShowNewFolder(false)
              }}
              placeholder="Folder name"
              autoFocus
            />
            <button className="ka-files-action-btn" onClick={handleCreateFolder}>
              <IconPlus size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {uf.error && (
        <div className="ka-files-error">
          <IconAlertCircle size={14} /> {uf.error}
        </div>
      )}

      {/* Drop zone / content area */}
      <div
        className={`ka-files-body${dragOver ? ' ka-files-body--dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => setContextMenu(null)}
      >
        {uf.loading ? (
          <div className="ka-files-loading">Loading...</div>
        ) : uf.folders.length === 0 && uf.files.length === 0 ? (
          <div className="ka-files-empty">
            <IconFileText size={32} />
            <p>No files yet</p>
            <p className="ka-files-empty-hint">
              Upload files or drag & drop them here
            </p>
          </div>
        ) : (
          <div className="ka-files-grid">
            {/* Folders first */}
            {uf.folders.map((folder: UserFileFolder) => (
              <div
                key={folder.id}
                className="ka-files-item ka-files-item--folder"
                onClick={() => uf.navigateIntoFolder(folder.id, folder.name)}
              >
                <div className="ka-files-item-icon">
                  <IconFolder size={28} />
                </div>
                <span className="ka-files-item-name">{folder.name}</span>
                {isSystemFolder(folder.name) ? null : deleteConfirm === folder.id ? (
                  <div className="ka-files-item-confirm" onClick={e => e.stopPropagation()}>
                    <button
                      className="ka-files-delete-yes"
                      onClick={() => {
                        uf.deleteFolder(folder.id)
                        setDeleteConfirm(null)
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="ka-files-delete-no"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="ka-files-item-action"
                    onClick={e => {
                      e.stopPropagation()
                      setDeleteConfirm(folder.id)
                    }}
                    title="Delete folder"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* Files */}
            {uf.files.map((file: UserFile) => (
              <div
                key={file.id}
                className={`ka-files-item${isImage(file.mime_type) ? ' ka-files-item--image' : ''}`}
                onClick={() => {
                  if (isImage(file.mime_type) || isVideo(file.mime_type)) {
                    setPreviewFile(file)
                  } else {
                    handleDownload(file)
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault()
                  setContextMenu({ fileId: file.id, x: e.clientX, y: e.clientY })
                }}
              >
                {isImage(file.mime_type) && file.url ? (
                  <div className="ka-files-item-thumb">
                    <img src={file.url} alt={file.filename} loading="lazy" />
                  </div>
                ) : isVideo(file.mime_type) && file.url ? (
                  <div className="ka-files-video-thumb">
                    <video src={file.url} muted preload="metadata" />
                  </div>
                ) : (
                  <div className="ka-files-item-icon">
                    {fileIcon(file.mime_type)}
                  </div>
                )}
                <span className="ka-files-item-name" title={file.filename}>
                  {file.filename}
                </span>
                <span className="ka-files-item-meta">
                  {formatSize(file.size_bytes)}
                </span>
                <div className="ka-files-item-actions">
                  <button
                    className="ka-files-item-action"
                    onClick={e => { e.stopPropagation(); handleDownload(file) }}
                    title="Download"
                  >
                    <IconDownload size={14} />
                  </button>
                  {deleteConfirm === file.id ? (
                    <div className="ka-files-item-confirm" onClick={e => e.stopPropagation()}>
                      <button
                        className="ka-files-delete-yes"
                        onClick={() => {
                          uf.deleteFile(file.id)
                          setDeleteConfirm(null)
                        }}
                      >
                        Delete
                      </button>
                      <button
                        className="ka-files-delete-no"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="ka-files-item-action"
                      onClick={e => {
                        e.stopPropagation()
                        setDeleteConfirm(file.id)
                      }}
                      title="Delete"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload indicator */}
        {uf.uploading && (
          <div className="ka-files-uploading">
            Uploading...
          </div>
        )}

        {/* Drag overlay */}
        {dragOver && (
          <div className="ka-files-drop-overlay">
            <IconPlus size={32} />
            <span>Drop files here</span>
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="ka-files-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {uf.folders.length > 0 && (
              <>
                <div className="ka-files-context-label">Move to folder</div>
                {uf.folders.map(f => (
                  <button
                    key={f.id}
                    className="ka-files-context-item"
                    onClick={() => {
                      uf.moveFile(contextMenu.fileId, f.id)
                      setContextMenu(null)
                    }}
                  >
                    <IconFolder size={14} /> {f.name}
                  </button>
                ))}
                {uf.currentFolderId && (
                  <button
                    className="ka-files-context-item"
                    onClick={() => {
                      uf.moveFile(contextMenu.fileId, null)
                      setContextMenu(null)
                    }}
                  >
                    <IconFolder size={14} /> Move to root
                  </button>
                )}
                <div className="ka-files-context-divider" />
              </>
            )}
            <button
              className="ka-files-context-item"
              onClick={() => {
                const file = uf.files.find(f => f.id === contextMenu.fileId)
                if (file) handleDownload(file)
                setContextMenu(null)
              }}
            >
              <IconDownload size={14} /> Download
            </button>
            <button
              className="ka-files-context-item ka-files-context-item--danger"
              onClick={() => {
                uf.deleteFile(contextMenu.fileId)
                setContextMenu(null)
              }}
            >
              <IconTrash size={14} /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview lightbox */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            className="ka-files-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              className="ka-files-lightbox-content"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              {isVideo(previewFile.mime_type) ? (
                <video src={previewFile.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 'var(--radius-md)' }} />
              ) : (
                <img src={previewFile.url} alt={previewFile.filename} />
              )}
              <div className="ka-files-lightbox-info">
                <span>{previewFile.filename}</span>
                <span>{formatSize(previewFile.size_bytes)}</span>
              </div>
              <div className="ka-files-lightbox-actions">
                <button onClick={() => handleDownload(previewFile)}>
                  <IconDownload size={16} /> Download
                </button>
                <button onClick={() => setPreviewFile(null)}>
                  <IconClose size={16} /> Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
