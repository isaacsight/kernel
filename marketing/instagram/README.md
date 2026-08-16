# Instagram — design-work post

A square (1080×1080) Instagram post built in the kernel.chat editorial
design language (`docs/design-language.md`): warm cream stock, EB
Garamond display + Courier Prime meta, tomato as the only spot color,
the asterisk as the single recurring system mark, a bracketed bilingual
kicker, and a bottom-right issue monument.

## Files

| File | What it is |
|---|---|
| `build_post.py` | Generator — writes the SVG and rasterizes it to PNG with cairosvg |
| `post.svg` | Vector source (scalable, editable) |
| `kernel-design-post.png` | 2160×2160 export, ready to upload (Instagram downsamples to 1080) |

## Rebuild

```sh
pip install cairosvg fonttools brotli
# Real brand fonts (EB Garamond + Courier Prime) via Fontsource on npm,
# converted woff2 -> ttf and installed for fontconfig. WenQuanYi Zen Hei
# (system) covers the Japanese glyphs in the bilingual lockups.
python3 build_post.py
```

To edit copy (headline, deck, issue number, hashtags), change the
strings in `build_post.py` and re-run.

## Suggested caption

> Every release is an issue. Sixteen issues of evidence-cited editorial
> design — warm paper, one spot color, a single recurring mark. Built in
> public.
>
> #editorialdesign #typography #designsystem #graphicdesign #magazine
