#!/usr/bin/env python3
"""
Instagram design-work post — kernel.chat editorial grammar.

A 1080x1080 square cover built in the magazine's design language:
warm cream stock, EB Garamond display + Courier Prime meta, tomato as
the single spot color, the asterisk (the) as the one recurring system
glyph, bracketed bilingual kicker, and a bottom-right issue monument.

Renders the SVG to PNG with cairosvg at 2x for crisp upload.

Tokens (from docs/design-language.md):
  cream   #F3E9D2   warm secondary stock (ground)
  ink     #1F1E1D   primary dark text
  coffee  #6B4E3D   warm brown / swash decks
  tomato  #E24E1B   the only spot color
"""
import cairosvg

CREAM  = "#F3E9D2"
INK    = "#1F1E1D"
COFFEE = "#6B4E3D"
TOMATO = "#E24E1B"

SERIF = "EB Garamond, Liberation Serif, serif"
# CJK-capable fallback so bilingual lockups render the JP glyphs
# (Courier Prime carries no kana/kanji; WenQuanYi picks them up per-glyph).
MONO  = "Courier Prime, WenQuanYi Zen Hei, DejaVu Sans Mono, monospace"
JP    = "WenQuanYi Zen Hei, Courier Prime, sans-serif"

W = H = 1080
M = 84  # outer editorial margin


def asterisk(cx, cy, r, color):
    """The single recurring system mark: a 6-spoke editorial asterisk
    (the project's PopIcon `asterisk`), drawn as three crossing strokes."""
    import math
    a = 0.8660254 * r  # cos(30) * r
    b = 0.5 * r        # sin(30) * r
    w = max(1.8, r * 0.32)
    lines = [
        (cx, cy - r, cx, cy + r),
        (cx - a, cy - b, cx + a, cy + b),
        (cx - a, cy + b, cx + a, cy - b),
    ]
    return "".join(
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="{color}" stroke-width="{w:.1f}" stroke-linecap="round"/>'
        for x1, y1, x2, y2 in lines
    )

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"
     viewBox="0 0 {W} {H}" font-kerning="normal">
  <!-- ground -->
  <rect width="{W}" height="{H}" fill="{CREAM}"/>
  <!-- printed-page keyline -->
  <rect x="40" y="40" width="{W-80}" height="{H-80}"
        fill="none" stroke="{INK}" stroke-opacity="0.16" stroke-width="1"/>

  <!-- ===== masthead strip ===== -->
  <text x="{M}" y="98" font-family="{MONO}" font-size="25" font-weight="700"
        fill="{INK}" letter-spacing="0.5">kernel.chat</text>
  {asterisk(748, 90, 7, TOMATO)}
  <text x="{W-M}" y="96" text-anchor="end" font-family="{MONO}" font-size="16.5"
        fill="{INK}" letter-spacing="1.8">ISSUE 375 &#183; JUN 2026</text>
  <line x1="{M}" y1="122" x2="{W-M}" y2="122" stroke="{INK}" stroke-opacity="0.22" stroke-width="1"/>

  <!-- ===== bracketed bilingual kicker ===== -->
  <text x="{M}" y="240" font-family="{MONO}" font-size="26" font-weight="700"
        fill="{TOMATO}" letter-spacing="3.5">[ DESIGN &#183; <tspan font-family="{JP}">&#35373;&#35336;</tspan> ]</text>
  <rect x="{M}" y="262" width="72" height="4" fill="{TOMATO}"/>

  <!-- ===== feature monument ===== -->
  <text x="{M-6}" y="430" font-family="{SERIF}" font-size="132" font-weight="600"
        fill="{INK}" letter-spacing="-1">Every release</text>
  <text x="{M-6}" y="560" font-family="{SERIF}" font-size="132" font-weight="600"
        fill="{INK}" letter-spacing="-1">is an <tspan font-style="italic" font-weight="500"
        fill="{TOMATO}">issue.</tspan></text>

  <!-- ===== deck (swash) ===== -->
  <text x="{M}" y="650" font-family="{SERIF}" font-size="37" font-style="italic"
        fill="{COFFEE}">Sixteen issues of evidence-cited editorial design &#8212;</text>
  <text x="{M}" y="698" font-family="{SERIF}" font-size="37" font-style="italic"
        fill="{COFFEE}">warm paper, one spot color, a single recurring mark.</text>

  <!-- ===== JP subtitle ===== -->
  <text x="{M}" y="772" font-family="{JP}" font-size="27" fill="{COFFEE}"
        letter-spacing="2">&#27598;&#21495;&#12364;&#12289;&#12402;&#12392;&#12388;&#12398;&#21495;&#12290;</text>

  <!-- ===== footer ===== -->
  <line x1="{M}" y1="876" x2="{W-M}" y2="876" stroke="{INK}" stroke-opacity="0.22" stroke-width="1"/>

  <text x="{M}" y="928" font-family="{MONO}" font-size="20" font-weight="700"
        fill="{INK}" letter-spacing="2">DESIGNED IN PUBLIC &#183; <tspan font-family="{JP}">&#20844;&#38283;&#35373;&#35336;</tspan></text>
  <text x="{M}" y="972" font-family="{MONO}" font-size="19" fill="{COFFEE}"
        letter-spacing="1">#editorialdesign  #typography  #designsystem</text>

  <!-- bottom-right issue monument -->
  <text x="{W-M}" y="912" text-anchor="end" font-family="{MONO}" font-size="19"
        font-weight="700" fill="{TOMATO}" letter-spacing="4">ISSUE</text>
  <text x="{W-M}" y="990" text-anchor="end" font-family="{SERIF}" font-size="94"
        font-weight="700" fill="{INK}">375</text>
  <text x="{W-M}" y="1016" text-anchor="end" font-family="{MONO}" font-size="16"
        fill="{COFFEE}" letter-spacing="2.5">THE SIX BORROWS</text>
</svg>'''

with open("post.svg", "w") as f:
    f.write(svg)

cairosvg.svg2png(bytestring=svg.encode(), write_to="kernel-design-post.png",
                 output_width=2160, output_height=2160)
print("wrote post.svg and kernel-design-post.png (2160x2160)")
