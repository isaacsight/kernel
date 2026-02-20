import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, ClipboardCopy, Download, FileText, FileCode, FileSpreadsheet, File } from 'lucide-react'
import { downloadFile, LANG_EXT } from './ChatHelpers'

// ─── Linkify helper ─────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s)<>]+(?:\([^\s)<>]*\))?[^\s)<>,."']*)/g

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_REGEX)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="ka-msg-link">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ─── File icon helper ────────────────────────────────────

function getFileIcon(ext: string) {
  if (['.py', '.js', '.ts', '.tsx', '.jsx', '.rs', '.go', '.java', '.c', '.cpp', '.rb', '.php', '.swift', '.kt', '.sh', '.html', '.css', '.sql'].includes(ext)) {
    return <FileCode size={16} />
  }
  if (['.csv', '.json', '.xml', '.yml', '.yaml'].includes(ext)) {
    return <FileSpreadsheet size={16} />
  }
  if (['.md', '.txt'].includes(ext)) {
    return <FileText size={16} />
  }
  return <File size={16} />
}

// ─── Code Block with copy + download ─────────────────────

function CodeBlock({ lang, code, ext, filename }: { lang: string; code: string; ext: string; filename: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="ka-code-block">
      <div className="ka-code-header">
        <span className="ka-code-lang">{lang}</span>
        <div className="ka-code-actions">
          <button className="ka-code-copy" onClick={handleCopy} aria-label="Copy code">
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="ka-code-download"
            onClick={() => downloadFile(code, filename)}
            aria-label={`Download as ${filename}`}
          >
            <Download size={13} />
            {ext}
          </button>
        </div>
      </div>
      <pre className="ka-code-pre"><code>{code}</code></pre>
    </div>
  )
}

// ─── File Artifact Card ──────────────────────────────────

function ArtifactCard({ filename, lang, code, ext, title }: {
  filename: string
  lang: string
  code: string
  ext: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lineCount = code.split('\n').length

  return (
    <div className="ka-artifact">
      <div className="ka-artifact-header" onClick={() => setExpanded(!expanded)}>
        <div className="ka-artifact-file-info">
          {getFileIcon(ext)}
          <div className="ka-artifact-meta">
            <span className="ka-artifact-filename">{filename}</span>
            {title && <span className="ka-artifact-title">{title}</span>}
          </div>
        </div>
        <div className="ka-artifact-stats">
          <span className="ka-artifact-lines">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
          <span className="ka-artifact-lang">{lang}</span>
        </div>
      </div>
      <div className="ka-artifact-actions">
        <button className="ka-artifact-action" onClick={handleCopy} aria-label="Copy file content">
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="ka-artifact-action ka-artifact-action--primary" onClick={() => downloadFile(code, filename)} aria-label={`Download ${filename}`}>
          <Download size={13} />
          Download
        </button>
      </div>
      {expanded && (
        <pre className="ka-code-pre"><code>{code}</code></pre>
      )}
    </div>
  )
}

// ─── Parse code fence header for language and filename ───
// Supports: ```python:filename.py or ```python filename.py

function parseCodeFenceHeader(header: string): { lang: string; filename: string | null; title: string | null } {
  if (!header) return { lang: 'text', filename: null, title: null }

  // Check for title comment on next line (// Title: ... or # Title: ...)
  let title: string | null = null

  // Try lang:filename format (e.g. python:hello.py)
  const colonMatch = header.match(/^(\w+):(.+)$/)
  if (colonMatch) {
    return { lang: colonMatch[1], filename: colonMatch[2].trim(), title }
  }

  // Try lang filename format (e.g. python hello.py)
  const spaceMatch = header.match(/^(\w+)\s+(\S+\.\w+)$/)
  if (spaceMatch) {
    return { lang: spaceMatch[1], filename: spaceMatch[2].trim(), title }
  }

  return { lang: header, filename: null, title }
}

// ─── Extract title from first line of code ───────────────

function extractArtifactTitle(code: string, lang: string): { title: string | null; cleanCode: string } {
  const lines = code.split('\n')
  if (lines.length === 0) return { title: null, cleanCode: code }

  const firstLine = lines[0].trim()

  // Match comment-style titles: // Title: ..., # Title: ..., -- Title: ..., /* Title: ... */
  const titlePatterns = [
    /^\/\/\s*(?:Title|File|Artifact):\s*(.+)$/i,
    /^#\s*(?:Title|File|Artifact):\s*(.+)$/i,
    /^--\s*(?:Title|File|Artifact):\s*(.+)$/i,
    /^\/\*\s*(?:Title|File|Artifact):\s*(.+?)\s*\*\/$/i,
  ]

  for (const pattern of titlePatterns) {
    const match = firstLine.match(pattern)
    if (match) {
      return { title: match[1].trim(), cleanCode: lines.slice(1).join('\n') }
    }
  }

  // For markdown files, use the first heading as the title
  if (['md', 'markdown'].includes(lang.toLowerCase())) {
    const headingMatch = firstLine.match(/^#+\s+(.+)$/)
    if (headingMatch) {
      return { title: headingMatch[1].trim(), cleanCode: code }
    }
  }

  return { title: null, cleanCode: code }
}

// ─── Message Content (markdown + code blocks + artifacts) ─

const CODE_BLOCK_REGEX = /```([^\n]*)\n([\s\S]*?)```/g

export function MessageContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockIndex = 0

  const mdComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ka-msg-link">{children}</a>,
    code: ({ children }: { children?: React.ReactNode }) => <code className="ka-inline-code">{children}</code>,
  }

  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0

  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    // Markdown text before code block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      parts.push(
        <ReactMarkdown key={`t${blockIndex}`} components={mdComponents}>{before}</ReactMarkdown>
      )
    }

    const rawHeader = match[1].trim()
    const rawCode = match[2]
    const { lang, filename } = parseCodeFenceHeader(rawHeader)
    const ext = LANG_EXT[lang.toLowerCase()] || '.txt'

    if (filename) {
      // Render as a file artifact card
      const { title, cleanCode } = extractArtifactTitle(rawCode, lang)
      parts.push(
        <ArtifactCard
          key={`a${blockIndex}`}
          filename={filename}
          lang={lang}
          code={cleanCode}
          ext={ext}
          title={title || undefined}
        />
      )
    } else {
      // Standard code block
      const defaultFilename = `kernel-export${ext}`
      parts.push(
        <CodeBlock key={`c${blockIndex}`} lang={lang} code={rawCode} ext={ext} filename={defaultFilename} />
      )
    }

    lastIndex = match.index + match[0].length
    blockIndex++
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    parts.push(
      <ReactMarkdown key={`t${blockIndex}`} components={mdComponents}>{remaining}</ReactMarkdown>
    )
  }

  return <>{parts}</>
}
