/* THE STACKS — typographic cover painter.
   Issues have no image covers; the cover IS type on stock. This
   paints that grammar onto any 2D surface (a CanvasTexture at
   runtime, a recorder in tests). Colors and font families arrive
   resolved in the theme — this module never names a hex. */
import type { IssueRecord } from '../content/issues/schema'

export interface CoverTheme {
  stock: string
  ink: string
  accent: string
  serif: string
  mono: string
}

export interface CoverSurface {
  width: number
  height: number
  fillStyle: string
  font: string
  textAlign: CanvasTextAlign
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
}

export function paintCover(issue: IssueRecord, s: CoverSurface, t: CoverTheme): void {
  const u = s.width / 100 // layout unit

  // Ground: full-bleed stock.
  s.fillStyle = t.stock
  s.fillRect(0, 0, s.width, s.height)

  // Folio row — mono caps.
  s.font = `${3 * u}px ${t.mono}`
  s.textAlign = 'left'
  s.fillStyle = t.ink
  s.fillText('kernel.chat', 6 * u, 9 * u)
  s.fillText(`N°${issue.number}`, 6 * u, 14 * u)
  s.textAlign = 'right'
  s.fillText(`${issue.month} ${issue.year} · ${issue.price}`, 94 * u, 9 * u)

  // Headline — serif, emphasis word in the issue accent.
  s.textAlign = 'left'
  s.font = `700 ${9 * u}px ${t.serif}`
  const baseline = s.height * 0.52
  s.fillStyle = t.ink
  s.fillText(issue.headline.prefix, 6 * u, baseline)
  s.fillStyle = t.accent
  s.fillText(issue.headline.emphasis, 6 * u, baseline + 11 * u)
  s.fillStyle = t.ink
  s.fillText(issue.headline.suffix, 6 * u, baseline + 22 * u)

  // JP feature line — mono, under the headline block.
  s.font = `${3.4 * u}px ${t.mono}`
  s.fillText(issue.featureJp, 6 * u, baseline + 30 * u)
}
