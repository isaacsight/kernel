import { describe, it, expect } from 'vitest'
import { parseCodeFenceHeader, extractArtifactTitle } from './MessageContent'
import { getMimeType, LANG_EXT } from './ChatHelpers'

describe('parseCodeFenceHeader', () => {
  it('returns text for empty header', () => {
    expect(parseCodeFenceHeader('')).toEqual({ lang: 'text', filename: null, title: null })
  })

  it('parses plain language', () => {
    expect(parseCodeFenceHeader('python')).toEqual({ lang: 'python', filename: null, title: null })
  })

  it('parses lang:filename format', () => {
    expect(parseCodeFenceHeader('python:scraper.py')).toEqual({ lang: 'python', filename: 'scraper.py', title: null })
  })

  it('parses lang:filename with path', () => {
    expect(parseCodeFenceHeader('typescript:src/utils.ts')).toEqual({ lang: 'typescript', filename: 'src/utils.ts', title: null })
  })

  it('parses lang filename (space) format', () => {
    expect(parseCodeFenceHeader('json config.json')).toEqual({ lang: 'json', filename: 'config.json', title: null })
  })

  it('does not match http: as artifact', () => {
    expect(parseCodeFenceHeader('http://example.com')).toEqual({ lang: 'http://example.com', filename: null, title: null })
  })

  it('parses csv:data.csv', () => {
    expect(parseCodeFenceHeader('csv:data.csv')).toEqual({ lang: 'csv', filename: 'data.csv', title: null })
  })

  it('parses markdown:report.md', () => {
    expect(parseCodeFenceHeader('markdown:report.md')).toEqual({ lang: 'markdown', filename: 'report.md', title: null })
  })

  // ── C++/ObjC/C# regex fix ─────────────────────────────────

  it('parses c++:main.cpp', () => {
    expect(parseCodeFenceHeader('c++:main.cpp')).toEqual({ lang: 'c++', filename: 'main.cpp', title: null })
  })

  it('parses objective-c:app.m', () => {
    expect(parseCodeFenceHeader('objective-c:app.m')).toEqual({ lang: 'objective-c', filename: 'app.m', title: null })
  })

  it('parses c#:Program.cs', () => {
    expect(parseCodeFenceHeader('c#:Program.cs')).toEqual({ lang: 'c#', filename: 'Program.cs', title: null })
  })

  it('parses f#:Main.fs', () => {
    expect(parseCodeFenceHeader('f#:Main.fs')).toEqual({ lang: 'f#', filename: 'Main.fs', title: null })
  })

  it('parses c++ main.cpp (space format)', () => {
    expect(parseCodeFenceHeader('c++ main.cpp')).toEqual({ lang: 'c++', filename: 'main.cpp', title: null })
  })

  // ── Extension inference from language ──────────────────────

  it('infers .py for python:config (no extension)', () => {
    expect(parseCodeFenceHeader('python:config')).toEqual({ lang: 'python', filename: 'config.py', title: null })
  })

  it('infers .js for javascript:utils (no extension, colon format)', () => {
    expect(parseCodeFenceHeader('javascript:utils')).toEqual({ lang: 'javascript', filename: 'utils.js', title: null })
  })

  it('infers .cpp for c++:solver (no extension)', () => {
    expect(parseCodeFenceHeader('c++:solver')).toEqual({ lang: 'c++', filename: 'solver.cpp', title: null })
  })

  it('infers .ts for typescript handler (space format, no extension)', () => {
    expect(parseCodeFenceHeader('typescript handler')).toEqual({ lang: 'typescript', filename: 'handler.ts', title: null })
  })

  it('does not infer for unknown language', () => {
    expect(parseCodeFenceHeader('brainfuck:hello')).toEqual({ lang: 'brainfuck:hello', filename: null, title: null })
  })
})

describe('extractArtifactTitle', () => {
  it('returns null for code without title comment', () => {
    const code = 'print("hello")\nprint("world")'
    expect(extractArtifactTitle(code, 'python')).toEqual({ title: null, cleanCode: code })
  })

  it('extracts // Title: comment', () => {
    const code = '// Title: Web Scraper\nimport requests'
    expect(extractArtifactTitle(code, 'python')).toEqual({ title: 'Web Scraper', cleanCode: 'import requests' })
  })

  it('extracts # Title: comment', () => {
    const code = '# File: Config Generator\ndata = {}'
    expect(extractArtifactTitle(code, 'python')).toEqual({ title: 'Config Generator', cleanCode: 'data = {}' })
  })

  it('extracts -- Title: comment (SQL style)', () => {
    const code = '-- Artifact: User Migration\nCREATE TABLE users'
    expect(extractArtifactTitle(code, 'sql')).toEqual({ title: 'User Migration', cleanCode: 'CREATE TABLE users' })
  })

  it('extracts /* Title: ... */ comment', () => {
    const code = '/* Title: CSS Reset */\n* { margin: 0; }'
    expect(extractArtifactTitle(code, 'css')).toEqual({ title: 'CSS Reset', cleanCode: '* { margin: 0; }' })
  })

  it('extracts markdown heading as title without removing it', () => {
    const code = '# Project README\n\nThis is a project.'
    const result = extractArtifactTitle(code, 'md')
    expect(result.title).toBe('Project README')
    expect(result.cleanCode).toBe(code)
  })

  it('does not extract heading for non-markdown', () => {
    const code = '# This is a comment\nprint("hi")'
    expect(extractArtifactTitle(code, 'python')).toEqual({ title: null, cleanCode: code })
  })

  it('is case-insensitive for title keyword', () => {
    const code = '// title: lowercase title\nconst x = 1'
    expect(extractArtifactTitle(code, 'javascript')).toEqual({ title: 'lowercase title', cleanCode: 'const x = 1' })
  })
})

describe('getMimeType', () => {
  it('returns text/html for .html', () => {
    expect(getMimeType('page.html')).toBe('text/html')
  })

  it('returns application/json for .json', () => {
    expect(getMimeType('data.json')).toBe('application/json')
  })

  it('returns image/svg+xml for .svg', () => {
    expect(getMimeType('icon.svg')).toBe('image/svg+xml')
  })

  it('returns text/css for .css', () => {
    expect(getMimeType('styles.css')).toBe('text/css')
  })

  it('returns text/csv for .csv', () => {
    expect(getMimeType('export.csv')).toBe('text/csv')
  })

  it('returns text/plain for unknown extension', () => {
    expect(getMimeType('code.rs')).toBe('text/plain')
  })

  it('is case-insensitive', () => {
    expect(getMimeType('page.HTML')).toBe('text/html')
  })
})

describe('LANG_EXT coverage', () => {
  it('maps c++ to .cpp', () => {
    expect(LANG_EXT['c++']).toBe('.cpp')
  })

  it('maps c# to .cs', () => {
    expect(LANG_EXT['c#']).toBe('.cs')
  })

  it('maps objective-c to .m', () => {
    expect(LANG_EXT['objective-c']).toBe('.m')
  })

  it('maps tsx and jsx', () => {
    expect(LANG_EXT['tsx']).toBe('.tsx')
    expect(LANG_EXT['jsx']).toBe('.jsx')
  })

  it('maps svg', () => {
    expect(LANG_EXT['svg']).toBe('.svg')
  })

  it('maps toml', () => {
    expect(LANG_EXT['toml']).toBe('.toml')
  })
})
