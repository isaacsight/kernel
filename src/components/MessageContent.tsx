import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import Prism from 'prismjs'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-toml'
import { IconCheck, IconCopy, IconDownload, IconFileText, IconFileCode, IconFileSpreadsheet, IconFile, IconEye, IconCode, IconPackage } from './KernelIcons'
import { downloadFile, downloadAllFiles, LANG_EXT, getMimeType } from './ChatHelpers'

// ─── Prism language alias mapping ──────────────────────────

const PRISM_LANG: Record<string, string> = {
  js: 'javascript', javascript: 'javascript', ts: 'typescript', typescript: 'typescript',
  tsx: 'tsx', jsx: 'jsx', py: 'python', python: 'python',
  bash: 'bash', sh: 'bash', shell: 'bash',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  sql: 'sql', css: 'css', html: 'html', xml: 'markup',
  markdown: 'markdown', md: 'markdown',
  rust: 'rust', rs: 'rust', go: 'go', java: 'java',
  ruby: 'ruby', rb: 'ruby', swift: 'swift', kotlin: 'kotlin', kt: 'kotlin',
  c: 'c', cpp: 'cpp', 'c++': 'cpp',
}

function highlightCode(code: string, lang: string): string {
  const prismLang = PRISM_LANG[lang.toLowerCase()]
  const grammar = prismLang && Prism.languages[prismLang]
  if (grammar) {
    return Prism.highlight(code, grammar, prismLang)
  }
  return escapeHtml(code)
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
    return <IconFileCode size={16} aria-hidden="true" />
  }
  if (['.csv', '.json', '.xml', '.yml', '.yaml'].includes(ext)) {
    return <IconFileSpreadsheet size={16} aria-hidden="true" />
  }
  if (['.md', '.txt'].includes(ext)) {
    return <IconFileText size={16} aria-hidden="true" />
  }
  return <IconFile size={16} aria-hidden="true" />
}

// ─── CSV detection helper ──────────────────────────────────

/** Check if code content looks like CSV/TSV tabular data */
function isTabularData(code: string, lang: string): boolean {
  if (lang === 'csv' || lang === 'tsv') return true
  const lines = code.trim().split('\n')
  if (lines.length < 2) return false
  // Check if first few lines have consistent comma or tab delimiters
  const delim = lines[0].includes('\t') ? '\t' : ','
  const headerCols = lines[0].split(delim).length
  if (headerCols < 2) return false
  // Verify at least 2 data rows have similar column count
  let matching = 0
  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const cols = lines[i].split(delim).length
    if (Math.abs(cols - headerCols) <= 1) matching++
  }
  return matching >= 1
}

function downloadAsCsv(code: string, filename: string) {
  // If tab-separated, convert to comma-separated
  const lines = code.trim().split('\n')
  const isTab = lines[0].includes('\t')
  const csvContent = isTab
    ? lines.map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim()
        return trimmed.includes(',') || trimmed.includes('"')
          ? `"${trimmed.replace(/"/g, '""')}"`
          : trimmed
      }).join(',')).join('\n')
    : code

  const baseName = filename.replace(/\.[^.]+$/, '')
  const csvFilename = `${baseName}.csv`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = csvFilename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Code Block with copy + download ─────────────────────

function CodeBlock({ lang, code, ext, filename, t }: { lang: string; code: string; ext: string; filename: string; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => highlightCode(code, lang), [code, lang])
  const showCsvButton = useMemo(() => isTabularData(code, lang), [code, lang])
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
          <button className="ka-code-copy" onClick={handleCopy} aria-label={t('copy')}>
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {copied ? t('copied') : t('copy')}
          </button>
          {showCsvButton && (
            <button
              className="ka-code-download"
              onClick={() => downloadAsCsv(code, filename)}
              aria-label="Download as CSV"
            >
              <IconFileSpreadsheet size={13} />
              .csv
            </button>
          )}
          <button
            className="ka-code-download"
            onClick={() => downloadFile(code, filename)}
            aria-label={`${t('download')} ${filename}`}
          >
            <IconDownload size={13} />
            {ext}
          </button>
        </div>
      </div>
      <pre className="ka-code-pre"><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
  )
}

// ─── File Artifact Card ──────────────────────────────────

const PREVIEWABLE_EXTS = ['.html', '.htm', '.svg']

function ArtifactCard({ filename, lang, code, ext, title, t }: {
  filename: string
  lang: string
  code: string
  ext: string
  title?: string
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const canPreview = PREVIEWABLE_EXTS.includes(ext)
  const showCsvButton = useMemo(() => isTabularData(code, lang), [code, lang])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')
  const lineCount = lines.length
  const MAX_PREVIEW_LINES = 500
  const isTruncated = lineCount > MAX_PREVIEW_LINES
  const previewCode = isTruncated ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : code
  const highlighted = useMemo(() => highlightCode(previewCode, lang), [previewCode, lang])

  // For SVG, wrap in minimal HTML doc for iframe rendering
  const iframeSrc = useMemo(() => {
    if (!canPreview) return ''
    if (ext === '.svg') {
      return `<!DOCTYPE html><html style="height:100%"><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f8f6}svg{max-width:100%;height:auto}</style></head><body>${code}</body></html>`
    }
    return code
  }, [code, ext, canPreview])

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
          <span className="ka-artifact-lines">{lineCount === 1 ? t('line', { count: lineCount }) : t('lines', { count: lineCount })}</span>
          <span className="ka-artifact-lang">{lang}</span>
        </div>
      </div>
      <div className="ka-artifact-actions">
        <button className="ka-artifact-action" onClick={handleCopy} aria-label={t('copy')}>
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? t('copied') : t('copy')}
        </button>
        {canPreview && (
          <button
            className={`ka-artifact-action${showPreview ? ' ka-artifact-action--active' : ''}`}
            onClick={() => { setShowPreview(!showPreview); if (!expanded) setExpanded(true) }}
            aria-label={showPreview ? t('code') : t('preview')}
          >
            {showPreview ? <IconCode size={13} /> : <IconEye size={13} />}
            {showPreview ? t('code') : t('preview')}
          </button>
        )}
        {showCsvButton && (
          <button className="ka-artifact-action" onClick={() => downloadAsCsv(code, filename)} aria-label="Download as CSV">
            <IconFileSpreadsheet size={13} />
            .csv
          </button>
        )}
        <button className="ka-artifact-action ka-artifact-action--primary" onClick={() => downloadFile(code, filename)} aria-label={`${t('download')} ${filename}`}>
          <IconDownload size={13} />
          {t('download')}
        </button>
      </div>
      {expanded && (
        <>
          {showPreview && canPreview ? (
            <div className="ka-artifact-preview">
              <iframe
                srcDoc={iframeSrc}
                sandbox="allow-scripts"
                title={`Preview of ${filename}`}
                className="ka-artifact-iframe"
              />
            </div>
          ) : (
            <pre className="ka-code-pre"><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
          )}
          {!showPreview && isTruncated && (
            <div className="ka-artifact-truncated">
              {t('previewTruncated', { lines: MAX_PREVIEW_LINES })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Parse code fence header for language and filename ───
// Supports: ```python:filename.py or ```python filename.py

export function parseCodeFenceHeader(header: string): { lang: string; filename: string | null; title: string | null } {
  if (!header) return { lang: 'text', filename: null, title: null }

  // Check for title comment on next line (// Title: ... or # Title: ...)
  let title: string | null = null

  // Try lang:filename format (e.g. python:hello.py, c++:main.cpp) — filename must have extension, reject URLs (://)
  const colonMatch = header.match(/^([\w+\-#]+):(?!\/\/)(\S+\.\w+)$/)
  if (colonMatch) {
    return { lang: colonMatch[1], filename: colonMatch[2].trim(), title }
  }

  // Try lang filename format (e.g. python hello.py, c++ main.cpp)
  const spaceMatch = header.match(/^([\w+\-#]+)\s+(\S+\.\w+)$/)
  if (spaceMatch) {
    return { lang: spaceMatch[1], filename: spaceMatch[2].trim(), title }
  }

  // Try lang:filename-without-extension — infer extension from language
  const colonNoExtMatch = header.match(/^([\w+\-#]+):(?!\/\/)(\S+)$/)
  if (colonNoExtMatch) {
    const lang = colonNoExtMatch[1]
    const name = colonNoExtMatch[2].trim()
    const ext = LANG_EXT[lang.toLowerCase()]
    if (ext) {
      return { lang, filename: `${name}${ext}`, title }
    }
  }

  // Try lang filename-without-extension (space format)
  const spaceNoExtMatch = header.match(/^([\w+\-#]+)\s+(\S+)$/)
  if (spaceNoExtMatch) {
    const lang = spaceNoExtMatch[1]
    const name = spaceNoExtMatch[2].trim()
    const ext = LANG_EXT[lang.toLowerCase()]
    if (ext) {
      return { lang, filename: `${name}${ext}`, title }
    }
  }

  return { lang: header, filename: null, title }
}

// ─── Extract title from first line of code ───────────────

export function extractArtifactTitle(code: string, lang: string): { title: string | null; cleanCode: string } {
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

// ─── Auto-artifact: promote large code blocks to artifacts ─

const AUTO_ARTIFACT_MIN_LINES = 8

// Infer a descriptive filename from language when the model omits :filename.ext
const AUTO_FILENAMES: Record<string, string> = {
  html: 'index.html', htm: 'index.html',
  css: 'styles.css', scss: 'styles.scss', sass: 'styles.sass', less: 'styles.less',
  javascript: 'app.js', js: 'app.js',
  typescript: 'app.ts', ts: 'app.ts',
  jsx: 'App.jsx', tsx: 'App.tsx',
  python: 'main.py', py: 'main.py',
  json: 'data.json', yaml: 'config.yaml', yml: 'config.yaml', toml: 'config.toml',
  sql: 'query.sql',
  rust: 'main.rs', rs: 'main.rs',
  go: 'main.go',
  java: 'Main.java',
  ruby: 'main.rb', rb: 'main.rb',
  swift: 'main.swift',
  kotlin: 'Main.kt', kt: 'Main.kt',
  c: 'main.c', cpp: 'main.cpp', 'c++': 'main.cpp',
  bash: 'script.sh', sh: 'script.sh', shell: 'script.sh',
  markdown: 'document.md', md: 'document.md',
  svg: 'image.svg',
  csv: 'data.csv',
  xml: 'data.xml',
}

export function inferFilename(lang: string, usedNames: Set<string>): string | null {
  const base = AUTO_FILENAMES[lang.toLowerCase()]
  if (!base) return null
  // Avoid duplicate filenames — append a number if needed
  if (!usedNames.has(base)) {
    usedNames.add(base)
    return base
  }
  const dotIdx = base.lastIndexOf('.')
  const name = base.slice(0, dotIdx)
  const ext = base.slice(dotIdx)
  for (let i = 2; i <= 9; i++) {
    const candidate = `${name}${i}${ext}`
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate)
      return candidate
    }
  }
  return base
}

// ─── Message Content (markdown + code blocks + artifacts) ─

const CODE_BLOCK_REGEX = /```([^\n]*)\n([\s\S]*?)```/g

export function MessageContent({ text }: { text: string }) {
  const { t } = useTranslation('common')
  const parts: React.ReactNode[] = []
  const artifacts: { filename: string; content: string }[] = []
  const usedFilenames = new Set<string>()
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
    const lineCount = rawCode.split('\n').length

    // Auto-promote: if no filename but substantial code, infer filename and render as artifact
    const autoFilename = !filename && lineCount >= AUTO_ARTIFACT_MIN_LINES
      ? inferFilename(lang, usedFilenames)
      : null
    const resolvedFilename = filename || autoFilename

    if (resolvedFilename) {
      if (filename) usedFilenames.add(filename)
      // Render as a file artifact card
      const { title, cleanCode } = extractArtifactTitle(rawCode, lang)
      artifacts.push({ filename: resolvedFilename, content: cleanCode })
      parts.push(
        <ArtifactCard
          key={`a${blockIndex}`}
          filename={resolvedFilename}
          lang={lang}
          code={cleanCode}
          ext={ext}
          title={title || undefined}
          t={t}
        />
      )
    } else {
      // Standard code block (short snippets only)
      const defaultFilename = `kernel-export${ext}`
      parts.push(
        <CodeBlock key={`c${blockIndex}`} lang={lang} code={rawCode} ext={ext} filename={defaultFilename} t={t} />
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

  return (
    <>
      {parts}
      {artifacts.length >= 2 && (
        <button
          className="ka-artifact-download-all"
          onClick={() => downloadAllFiles(artifacts)}
          aria-label={t('downloadAllFiles', { count: artifacts.length })}
        >
          <IconPackage size={14} />
          {t('downloadAllFiles', { count: artifacts.length })}
        </button>
      )}
    </>
  )
}
