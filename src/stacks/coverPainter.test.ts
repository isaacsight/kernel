import { describe, it, expect } from 'vitest'
import { paintCover, type CoverSurface, type CoverTheme } from './coverPainter'
import type { IssueRecord } from '../content/issues/schema'

function recorder(width = 512, height = 720) {
  const ops: Array<Record<string, unknown>> = []
  const surface: CoverSurface = {
    width, height,
    fillStyle: '', font: '', textAlign: 'left',
    fillRect(x, y, w, h) { ops.push({ op: 'rect', x, y, w, h, fill: this.fillStyle }) },
    fillText(text, x, y) { ops.push({ op: 'text', text, x, y, fill: this.fillStyle, font: this.font }) },
  }
  return { surface, ops }
}

const theme: CoverTheme = {
  stock: 'var-stock', ink: 'var-ink', accent: 'var-accent',
  serif: 'TestSerif', mono: 'TestMono',
}

const issue = {
  number: '427', month: 'FEB', year: '2027', price: '¥0',
  featureJp: 'モートは現実',
  headline: { prefix: 'The moat', emphasis: 'is reality', suffix: '.', swash: '' },
} as IssueRecord

describe('paintCover', () => {
  it('grounds the sheet in the stock colour, full bleed', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    expect(ops[0]).toMatchObject({ op: 'rect', x: 0, y: 0, w: 512, h: 720, fill: 'var-stock' })
  })

  it('sets the emphasis word in the accent, the rest in ink', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text')
    expect(texts.find((o) => o.text === 'is reality')?.fill).toBe('var-accent')
    expect(texts.find((o) => o.text === 'The moat')?.fill).toBe('var-ink')
  })

  it('carries the folio: catalogue number, dateline, and the JP feature line', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text').map((o) => o.text)
    expect(texts).toContain('N°427')
    expect(texts).toContain('FEB 2027 · ¥0')
    expect(texts).toContain('モートは現実')
  })

  it('uses the mono family for folio rows and the serif for the headline', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text')
    expect(String(texts.find((o) => o.text === 'N°427')?.font)).toContain('TestMono')
    expect(String(texts.find((o) => o.text === 'The moat')?.font)).toContain('TestSerif')
  })
})
