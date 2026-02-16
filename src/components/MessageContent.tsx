import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, ClipboardCopy, Download } from 'lucide-react'
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

// ─── Message Content (markdown + code blocks) ────────────

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g

export function MessageContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockIndex = 0

  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0

  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    // Markdown text before code block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      parts.push(
        <ReactMarkdown key={`t${blockIndex}`} components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ka-msg-link">{children}</a>,
          code: ({ children }) => <code className="ka-inline-code">{children}</code>,
        }}>{before}</ReactMarkdown>
      )
    }

    const lang = match[1] || 'text'
    const code = match[2]
    const ext = LANG_EXT[lang.toLowerCase()] || '.txt'
    const filename = `kernel-export${ext}`

    parts.push(
      <CodeBlock key={`c${blockIndex}`} lang={lang} code={code} ext={ext} filename={filename} />
    )

    lastIndex = match.index + match[0].length
    blockIndex++
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    parts.push(
      <ReactMarkdown key={`t${blockIndex}`} components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ka-msg-link">{children}</a>,
        code: ({ children }) => <code className="ka-inline-code">{children}</code>,
      }}>{remaining}</ReactMarkdown>
    )
  }

  return <>{parts}</>
}
