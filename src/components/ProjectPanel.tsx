// ─── ProjectPanel — Session File Persistence ─────────────────
//
// Bottom-sheet panel showing all generated files for the active conversation.
// Supports download individual, download all, and clear project.

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore, type ProjectFile } from '../stores/projectStore'
import { IconClose, IconFileCode, IconFile, IconDownload, IconTrash } from './KernelIcons'
import { downloadFile, downloadAllFiles } from './ChatHelpers'

interface ProjectPanelProps {
  conversationId: string | null
  onClose: () => void
}

const CODE_LANGUAGES = new Set([
  'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'rb',
  'swift', 'kt', 'html', 'css', 'sql', 'sh', 'bash', 'rust', 'python',
  'typescript', 'javascript', 'ruby', 'kotlin',
])

export function ProjectPanel({ conversationId, onClose }: ProjectPanelProps) {
  const { t } = useTranslation('common')
  // Select raw project record (referentially stable) instead of calling getFiles()
  // which creates a new array each time, causing infinite re-renders (React error #185).
  const project = useProjectStore(s => conversationId ? s.projects[conversationId] : undefined)
  const files = useMemo(() => {
    if (!project) return [] as ProjectFile[]
    return Object.values(project).sort((a, b) => a.createdAt - b.createdAt)
  }, [project])
  const removeFile = useProjectStore(s => s.removeFile)
  const clearProject = useProjectStore(s => s.clearProject)

  const filesWithContent = files.filter(f => f.content.length > 0)
  const totalSize = filesWithContent.reduce((sum, f) => sum + f.content.length, 0)
  const totalSizeStr = totalSize > 1000 ? `${(totalSize / 1000).toFixed(1)}KB` : `${totalSize}B`

  return (
    <div className="ka-project-panel">
      <div className="ka-project-panel-header">
        <h3 className="ka-project-panel-title">Project Files</h3>
        <span className="ka-project-panel-meta">
          {files.length} file{files.length !== 1 ? 's' : ''}{totalSize > 0 ? ` · ${totalSizeStr}` : ''}
        </span>
        <button className="ka-project-panel-close" onClick={onClose} aria-label={t('close')}>
          <IconClose size={16} />
        </button>
      </div>

      <div className="ka-project-panel-body">
        {files.length === 0 ? (
          <div className="ka-empty-state">
            <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-workflows.svg`} alt="" />
            <div className="ka-empty-state-title">No files generated yet</div>
            <div className="ka-empty-state-desc">Code artifacts will appear here as you build.</div>
          </div>
        ) : (
          <ul className="ka-project-file-list">
            {files.map(file => (
              <ProjectFileRow
                key={file.filename}
                file={file}
                hasContent={file.content.length > 0}
                onDownload={() => downloadFile(file.content, file.filename)}
                onRemove={() => conversationId && removeFile(conversationId, file.filename)}
              />
            ))}
          </ul>
        )}
      </div>

      {files.length > 0 && (
        <div className="ka-project-panel-footer">
          <button
            className="ka-project-action ka-project-action--primary"
            onClick={() => downloadAllFiles(filesWithContent.map(f => ({ filename: f.filename, content: f.content })))}
            disabled={filesWithContent.length === 0}
          >
            <IconDownload size={14} />
            Download all
          </button>
          <button
            className="ka-project-action ka-project-action--danger"
            onClick={() => { if (conversationId) { clearProject(conversationId); onClose() } }}
          >
            <IconTrash size={14} />
            Clear project
          </button>
        </div>
      )}
    </div>
  )
}

function ProjectFileRow({ file, hasContent, onDownload, onRemove }: {
  file: ProjectFile
  hasContent: boolean
  onDownload: () => void
  onRemove: () => void
}) {
  const isCode = CODE_LANGUAGES.has(file.language.toLowerCase())

  return (
    <li className="ka-project-file">
      <div className="ka-project-file-icon">
        {isCode ? <IconFileCode size={16} /> : <IconFile size={16} />}
      </div>
      <div className="ka-project-file-info">
        <span className="ka-project-file-name">{file.filename}</span>
        <span className="ka-project-file-meta">
          v{file.version} · {file.language}{hasContent ? ` · ${file.content.split('\n').length} lines` : ''}
        </span>
      </div>
      <div className="ka-project-file-actions">
        <button className="ka-project-file-btn" onClick={onDownload} disabled={!hasContent} aria-label={`Download ${file.filename}`}>
          <IconDownload size={13} />
        </button>
        <button className="ka-project-file-btn ka-project-file-btn--danger" onClick={onRemove} aria-label={`Remove ${file.filename}`}>
          <IconTrash size={13} />
        </button>
      </div>
    </li>
  )
}
