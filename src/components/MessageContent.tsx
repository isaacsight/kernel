import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
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
import {
  IconCheck, IconCopy, IconDownload, IconFileText, IconFileCode, IconFileSpreadsheet,
  IconFile, IconEye, IconCode, IconPackage, IconChevronDown, IconClose, IconAlertCircle,
  IconTerminal, IconMaximize, IconSmartphone, IconTablet, IconMonitor,
} from './KernelIcons'
import { downloadFile, downloadAllFiles, LANG_EXT } from './ChatHelpers'
import { DURATION, EASE } from '../constants/motion'
import { useOverlayHistory } from '../hooks/useOverlayHistory'

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

// ─── Console bridge injection ─────────────────────────────

const CONSOLE_BRIDGE_SCRIPT = `<script>
(function(){
  var orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  function send(level, args) {
    try {
      parent.postMessage({ type: 'kernel-console', level: level, args: Array.prototype.map.call(args, function(a) {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
      })}, '*');
    } catch(e) {}
  }
  console.log = function() { send('log', arguments); orig.log.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); orig.warn.apply(console, arguments); };
  console.error = function() { send('error', arguments); orig.error.apply(console, arguments); };
  console.info = function() { send('info', arguments); orig.info.apply(console, arguments); };
  window.onerror = function(msg, src, line, col) {
    send('error', [msg + ' (line ' + line + ')']);
  };
  window.addEventListener('load', function() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    parent.postMessage({ type: 'kernel-iframe-height', height: h }, '*');
  });
})();
</script>`

function injectConsoleBridge(html: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', CONSOLE_BRIDGE_SCRIPT + '</head>')
  }
  if (html.includes('<html')) {
    return html.replace('<html', CONSOLE_BRIDGE_SCRIPT + '<html')
  }
  return CONSOLE_BRIDGE_SCRIPT + html
}

// ─── Console entry types ──────────────────────────────────

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info'
  args: string[]
  id: number
}

// ─── Console Panel ────────────────────────────────────────

function ConsolePanel({ entries, t }: {
  entries: ConsoleEntry[]
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [open, setOpen] = useState(false)
  const errorCount = entries.filter(e => e.level === 'error').length

  if (entries.length === 0) return null

  return (
    <div className="ka-console">
      <button className="ka-console-toggle" onClick={() => setOpen(!open)}>
        <IconTerminal size={13} />
        <span>{t('console')} ({entries.length})</span>
        {errorCount > 0 && <span className="ka-console-errors">{errorCount} {t('errors')}</span>}
        <IconChevronDown size={12} className={`ka-combined-preview-chevron${open ? ' ka-combined-preview-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="ka-console-entries">
          {entries.slice(-100).map(e => (
            <div key={e.id} className={`ka-console-entry ka-console-entry--${e.level}`}>
              <span className="ka-console-level">{e.level}</span>
              <span className="ka-console-msg">{e.args.join(' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────

function PreviewLoading() {
  return (
    <div className="ka-artifact-loading">
      <div className="ka-skeleton-line ka-skeleton-line--long" />
      <div className="ka-skeleton-line ka-skeleton-line--short" />
      <div className="ka-skeleton-line ka-skeleton-line--long" />
    </div>
  )
}

// ─── Fullscreen Preview ───────────────────────────────────

type ViewportSize = 'mobile' | 'tablet' | 'desktop'

function PreviewFullscreen({ srcDoc, title, consoleEntries, t, onClose }: {
  srcDoc: string
  title: string
  consoleEntries: ConsoleEntry[]
  t: (key: string, opts?: Record<string, unknown>) => string
  onClose: () => void
}) {
  useOverlayHistory(true, onClose)
  const [viewportWidth, setViewportWidth] = useState<ViewportSize>('desktop')

  const maxWidth = viewportWidth === 'mobile' ? 375 : viewportWidth === 'tablet' ? 768 : undefined

  return (
    <motion.div
      className="ka-preview-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.OUT }}
    >
      <div className="ka-preview-fullscreen-header">
        <span className="ka-preview-fullscreen-title">{title}</span>
        <div className="ka-preview-fullscreen-actions">
          <div className="ka-preview-viewport-toggles">
            <button
              className={`ka-preview-viewport-btn${viewportWidth === 'mobile' ? ' ka-preview-viewport-btn--active' : ''}`}
              onClick={() => setViewportWidth('mobile')}
              aria-label={t('previewMobile')}
              title={t('previewMobile')}
            >
              <IconSmartphone size={14} />
            </button>
            <button
              className={`ka-preview-viewport-btn${viewportWidth === 'tablet' ? ' ka-preview-viewport-btn--active' : ''}`}
              onClick={() => setViewportWidth('tablet')}
              aria-label={t('previewTablet')}
              title={t('previewTablet')}
            >
              <IconTablet size={14} />
            </button>
            <button
              className={`ka-preview-viewport-btn${viewportWidth === 'desktop' ? ' ka-preview-viewport-btn--active' : ''}`}
              onClick={() => setViewportWidth('desktop')}
              aria-label={t('previewDesktop')}
              title={t('previewDesktop')}
            >
              <IconMonitor size={14} />
            </button>
          </div>
          <button className="ka-preview-fullscreen-close" onClick={onClose} aria-label={t('close')}>
            <IconClose size={16} />
          </button>
        </div>
      </div>
      <div className="ka-preview-fullscreen-body">
        <div className="ka-preview-fullscreen-frame" style={maxWidth ? { maxWidth, margin: '0 auto' } : undefined}>
          <iframe
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            title={title}
            className="ka-preview-fullscreen-iframe"
          />
        </div>
      </div>
      <ConsolePanel entries={consoleEntries} t={t} />
    </motion.div>
  )
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

// ─── Code Block with copy + download ─────────────────────

function CodeBlock({ lang, code, ext, filename, t }: { lang: string; code: string; ext: string; filename: string; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => highlightCode(code, lang), [code, lang])
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

// ─── useConsoleCapture hook ──────────────────────────────

function useConsoleCapture(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [renderFailed, setRenderFailed] = useState(false)
  const entryIdRef = useRef(0)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      if (e.data?.type === 'kernel-console') {
        setConsoleEntries(prev => {
          const next = [...prev, { level: e.data.level, args: e.data.args, id: entryIdRef.current++ }]
          return next.length > 100 ? next.slice(-100) : next
        })
      }
      if (e.data?.type === 'kernel-iframe-height') {
        setRenderFailed(e.data.height <= 10)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [iframeRef])

  const reset = useCallback(() => {
    setConsoleEntries([])
    setRenderFailed(false)
  }, [])

  return { consoleEntries, renderFailed, reset }
}

// ─── File Artifact Card ──────────────────────────────────

const PREVIEWABLE_EXTS = ['.html', '.htm', '.svg']

function ArtifactCard({ filename, lang, code, ext, title, t, autoPreview }: {
  filename: string
  lang: string
  code: string
  ext: string
  title?: string
  t: (key: string, opts?: Record<string, unknown>) => string
  autoPreview?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const canPreview = PREVIEWABLE_EXTS.includes(ext)
  const isSmallSvg = ext === '.svg' && code.split('\n').length < 5
  const shouldAutoPreview = canPreview && !!autoPreview && !isSmallSvg
  const [expanded, setExpanded] = useState(shouldAutoPreview)
  const [showPreview, setShowPreview] = useState(shouldAutoPreview)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { consoleEntries, renderFailed, reset } = useConsoleCapture(iframeRef)

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
      return injectConsoleBridge(`<!DOCTYPE html><html style="height:100%"><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f8f6}svg{max-width:100%;height:auto}</style></head><body>${code}</body></html>`)
    }
    return injectConsoleBridge(code)
  }, [code, ext, canPreview])

  const togglePreview = () => {
    const next = !showPreview
    setShowPreview(next)
    if (next) { setIframeLoaded(false); reset() }
    if (!expanded) setExpanded(true)
  }

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
            onClick={togglePreview}
            aria-label={showPreview ? t('code') : t('preview')}
          >
            {showPreview ? <IconCode size={13} /> : <IconEye size={13} />}
            {showPreview ? t('code') : t('preview')}
          </button>
        )}
        {canPreview && showPreview && expanded && (
          <button className="ka-artifact-action" onClick={() => setShowFullscreen(true)} aria-label={t('fullscreen')}>
            <IconMaximize size={13} />
            {t('fullscreen')}
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
              {!iframeLoaded && <PreviewLoading />}
              {renderFailed && iframeLoaded && (
                <div className="ka-artifact-fallback">
                  <IconAlertCircle size={14} />
                  <span>{t('previewFailed')}</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                srcDoc={iframeSrc}
                sandbox="allow-scripts"
                title={`Preview of ${filename}`}
                className="ka-artifact-iframe"
                style={!iframeLoaded ? { opacity: 0, height: 0, minHeight: 0 } : undefined}
                onLoad={() => setIframeLoaded(true)}
              />
              <ConsolePanel entries={consoleEntries} t={t} />
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
      <AnimatePresence>
        {showFullscreen && (
          <PreviewFullscreen
            srcDoc={iframeSrc}
            title={filename}
            consoleEntries={consoleEntries}
            t={t}
            onClose={() => setShowFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Combined multi-file preview ─────────────────────────

function CombinedPreview({ artifacts, t, defaultCollapsed }: {
  artifacts: { filename: string; content: string }[]
  t: (key: string, opts?: Record<string, unknown>) => string
  defaultCollapsed?: boolean
}) {
  const htmlFiles = artifacts.filter(a => /\.html?$/.test(a.filename))
  if (htmlFiles.length === 0) return null

  const cssFiles = artifacts.filter(a => /\.css$/.test(a.filename))
  const jsFiles = artifacts.filter(a => /\.(js|ts)$/.test(a.filename))

  const [collapsed, setCollapsed] = useState(!!defaultCollapsed)
  const [activeHtmlIndex, setActiveHtmlIndex] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { consoleEntries, renderFailed, reset } = useConsoleCapture(iframeRef)

  const activeHtml = htmlFiles[activeHtmlIndex] || htmlFiles[0]

  const combined = useMemo(() => {
    let doc = activeHtml.content
    if (cssFiles.length > 0) {
      const styles = cssFiles.map(f => `<style>/* ${f.filename} */\n${f.content}</style>`).join('\n')
      doc = doc.includes('</head>')
        ? doc.replace('</head>', `${styles}\n</head>`)
        : `${styles}\n${doc}`
    }
    if (jsFiles.length > 0) {
      const scripts = jsFiles.map(f => `<script>/* ${f.filename} */\n${f.content}</script>`).join('\n')
      doc = doc.includes('</body>')
        ? doc.replace('</body>', `${scripts}\n</body>`)
        : `${doc}\n${scripts}`
    }
    return injectConsoleBridge(doc)
  }, [activeHtml, cssFiles, jsFiles])

  const switchTab = (index: number) => {
    setActiveHtmlIndex(index)
    setIframeLoaded(false)
    reset()
  }

  return (
    <div className="ka-combined-preview">
      <div className="ka-combined-preview-header" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
        <IconEye size={14} />
        <span>{t('combinedPreview')}</span>
        <span className="ka-combined-preview-files">
          {artifacts.map(a => a.filename).join(' + ')}
        </span>
        {!collapsed && (
          <button
            className="ka-artifact-action"
            onClick={(e) => { e.stopPropagation(); setShowFullscreen(true) }}
            aria-label={t('fullscreen')}
            style={{ marginLeft: 'auto', marginRight: 4 }}
          >
            <IconMaximize size={12} />
          </button>
        )}
        <IconChevronDown size={14} className={`ka-combined-preview-chevron${!collapsed ? ' ka-combined-preview-chevron--open' : ''}`} />
      </div>
      {!collapsed && (
        <>
          {htmlFiles.length > 1 && (
            <div className="ka-combined-tabs">
              {htmlFiles.map((f, i) => (
                <button
                  key={f.filename}
                  className={`ka-combined-tab${i === activeHtmlIndex ? ' ka-combined-tab--active' : ''}`}
                  onClick={() => switchTab(i)}
                >
                  {f.filename}
                </button>
              ))}
            </div>
          )}
          {!iframeLoaded && <PreviewLoading />}
          {renderFailed && iframeLoaded && (
            <div className="ka-artifact-fallback">
              <IconAlertCircle size={14} />
              <span>{t('previewFailed')}</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={combined}
            sandbox="allow-scripts"
            title="Combined preview"
            className="ka-artifact-iframe ka-combined-iframe"
            style={!iframeLoaded ? { opacity: 0, height: 0, minHeight: 0 } : undefined}
            onLoad={() => setIframeLoaded(true)}
          />
          <ConsolePanel entries={consoleEntries} t={t} />
        </>
      )}
      <AnimatePresence>
        {showFullscreen && (
          <PreviewFullscreen
            srcDoc={combined}
            title={activeHtml.filename}
            consoleEntries={consoleEntries}
            t={t}
            onClose={() => setShowFullscreen(false)}
          />
        )}
      </AnimatePresence>
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

export function MessageContent({ text, isLatestMessage = false }: { text: string; isLatestMessage?: boolean }) {
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
          autoPreview={isLatestMessage && PREVIEWABLE_EXTS.includes(ext)}
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
      {artifacts.length >= 2 && artifacts.some(a => /\.html?$/.test(a.filename)) && (
        <CombinedPreview artifacts={artifacts} t={t} defaultCollapsed={!isLatestMessage} />
      )}
    </>
  )
}
