import { describe, it, expect } from 'vitest'
import { parseCodeFenceHeader, extractArtifactTitle } from './MessageContent'

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
    // Paths with slashes won't match \S+\.\w+ because slash is allowed in \S
    expect(parseCodeFenceHeader('typescript:src/utils.ts')).toEqual({ lang: 'typescript', filename: 'src/utils.ts', title: null })
  })

  it('parses lang filename (space) format', () => {
    expect(parseCodeFenceHeader('json config.json')).toEqual({ lang: 'json', filename: 'config.json', title: null })
  })

  it('does not match http: as artifact', () => {
    // http: should not be treated as lang:filename since "//example.com" has no extension
    expect(parseCodeFenceHeader('http://example.com')).toEqual({ lang: 'http://example.com', filename: null, title: null })
  })

  it('does not match lang:text-without-extension', () => {
    expect(parseCodeFenceHeader('python:noext')).toEqual({ lang: 'python:noext', filename: null, title: null })
  })

  it('parses csv:data.csv', () => {
    expect(parseCodeFenceHeader('csv:data.csv')).toEqual({ lang: 'csv', filename: 'data.csv', title: null })
  })

  it('parses markdown:report.md', () => {
    expect(parseCodeFenceHeader('markdown:report.md')).toEqual({ lang: 'markdown', filename: 'report.md', title: null })
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
    expect(result.cleanCode).toBe(code) // heading is kept
  })

  it('does not extract heading for non-markdown', () => {
    const code = '# This is a comment\nprint("hi")'
    // # is also a Python/bash comment — should match "# Title:" pattern only
    expect(extractArtifactTitle(code, 'python')).toEqual({ title: null, cleanCode: code })
  })

  it('is case-insensitive for title keyword', () => {
    const code = '// title: lowercase title\nconst x = 1'
    expect(extractArtifactTitle(code, 'javascript')).toEqual({ title: 'lowercase title', cleanCode: 'const x = 1' })
  })
})
