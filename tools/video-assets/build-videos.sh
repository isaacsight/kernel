#!/bin/bash
# Build YouTube (16:9) and TikTok (9:16) videos from demo GIFs
# Uses ImageMagick for title cards + ffmpeg for composition
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

FONT="/Users/isaachernandez/Library/Fonts/CourierPrime-Regular.ttf"
FONTB="/Users/isaachernandez/Library/Fonts/CourierPrime-Bold.ttf"

echo "=== Building kbot promo videos ==="

# ── Step 1: Convert GIFs to MP4 clips ──
echo "Converting GIFs to MP4..."
for gif in demo-hero.gif demo-learning.gif demo-agents.gif demo-defense.gif demo-local-ai.gif; do
  name="${gif%.gif}"
  ffmpeg -y -i "$gif" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${name}.mp4" 2>/dev/null
  echo "  ✓ ${name}.mp4"
done

# ── Step 2: Create title card PNGs with ImageMagick ──
echo "Creating title cards..."

# Title 1: The Kernel Stack
magick -size 1920x1080 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 72 -fill '#FAF9F6' -gravity center -annotate +0-60 'The Kernel Stack' \
  -font "$FONT" -pointsize 28 -fill '#6B5B95' -annotate +0+30 'Claude thinks. kbot acts. Both learn.' \
  -font "$FONT" -pointsize 20 -fill '#888888' -annotate +0+80 '350+ tools · 26 agents · 20 providers · $0 local' \
  title-intro.png
echo "  ✓ title-intro.png"

# Title 2: It learns
magick -size 1920x1080 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 52 -fill '#28c840' -gravity center -annotate +0-20 'It learns from every session.' \
  -font "$FONT" -pointsize 24 -fill '#888888' -annotate +0+40 'No other AI tool does this.' \
  title-learns.png
echo "  ✓ title-learns.png"

# Title 3: 26 Agents
magick -size 1920x1080 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 52 -fill '#6B5B95' -gravity center -annotate +0-20 '26 specialist agents.' \
  -font "$FONT" -pointsize 24 -fill '#888888' -annotate +0+40 'Auto-routed by intent.' \
  title-agents.png
echo "  ✓ title-agents.png"

# Title 4: $0 Local
magick -size 1920x1080 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 52 -fill '#28c840' -gravity center -annotate +0-20 '$0. Runs on your machine.' \
  -font "$FONT" -pointsize 24 -fill '#888888' -annotate +0+40 'No API key. No data leaves. Ever.' \
  title-local.png
echo "  ✓ title-local.png"

# Title 5: CTA
magick -size 1920x1080 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 40 -fill '#28c840' -gravity center -annotate +0-50 'npm install -g @kernel.chat/kbot' \
  -font "$FONT" -pointsize 26 -fill '#6B5B95' -annotate +0+20 'github.com/isaacsight/kernel' \
  -font "$FONT" -pointsize 20 -fill '#888888' -annotate +0+70 'MIT Licensed · kernel.chat' \
  title-cta.png
echo "  ✓ title-cta.png"

# ── Step 3: Convert PNGs to video clips ──
echo "Converting title cards to video..."
for png in title-intro title-learns title-agents title-local; do
  dur=3
  [ "$png" = "title-intro" ] && dur=4
  ffmpeg -y -loop 1 -i "${png}.png" -t $dur -c:v libx264 -pix_fmt yuv420p -r 25 "${png}.mp4" 2>/dev/null
  echo "  ✓ ${png}.mp4 (${dur}s)"
done
ffmpeg -y -loop 1 -i title-cta.png -t 5 -c:v libx264 -pix_fmt yuv420p -r 25 title-cta.mp4 2>/dev/null
echo "  ✓ title-cta.mp4 (5s)"

# ── Step 4: Scale demo clips to 1920x1080 ──
echo "Scaling demo clips to 1080p..."
for clip in demo-hero.mp4 demo-learning.mp4 demo-agents.mp4 demo-defense.mp4 demo-local-ai.mp4; do
  name="${clip%.mp4}"
  ffmpeg -y -i "$clip" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0d0d0d,setsar=1" \
    -c:v libx264 -pix_fmt yuv420p -r 25 "${name}-1080.mp4" 2>/dev/null
  echo "  ✓ ${name}-1080.mp4"
done

# ── Step 5: Build YouTube video (16:9) ──
echo "Building YouTube video..."

cat > concat-youtube.txt << 'CONCAT'
file 'title-intro.mp4'
file 'demo-hero-1080.mp4'
file 'title-learns.mp4'
file 'demo-learning-1080.mp4'
file 'title-agents.mp4'
file 'demo-agents-1080.mp4'
file 'title-local.mp4'
file 'demo-local-ai-1080.mp4'
file 'title-cta.mp4'
CONCAT

ffmpeg -y -f concat -safe 0 -i concat-youtube.txt \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart \
  kbot-youtube.mp4 2>/dev/null
echo "  ✓ kbot-youtube.mp4"

# ── Step 6: Build TikTok video (9:16, 1080x1920) ──
echo "Building TikTok video..."

# Vertical title cards
magick -size 1080x1920 xc:'#0d0d0d' \
  -font "$FONTB" -pointsize 64 -fill '#FAF9F6' -gravity center -annotate +0-120 'This AI agent' \
  -font "$FONTB" -pointsize 64 -fill '#28c840' -annotate +0-40 'learns from you.' \
  -font "$FONTB" -pointsize 48 -fill '#6B5B95' -annotate +0+60 "And it's free." \
  tiktok-intro.png

magick -size 1080x1920 xc:'#0d0d0d' \
  -font "$FONT" -pointsize 40 -fill '#888888' -gravity center -annotate +0-80 'npm i -g' \
  -font "$FONTB" -pointsize 48 -fill '#28c840' -annotate +0-10 '@kernel.chat/kbot' \
  -font "$FONT" -pointsize 28 -fill '#6B5B95' -annotate +0+60 '350+ tools · 26 agents' \
  -font "$FONT" -pointsize 24 -fill '#888888' -annotate +0+120 'Link in bio' \
  tiktok-cta.png

ffmpeg -y -loop 1 -i tiktok-intro.png -t 3 -c:v libx264 -pix_fmt yuv420p -r 25 tiktok-intro.mp4 2>/dev/null
ffmpeg -y -loop 1 -i tiktok-cta.png -t 4 -c:v libx264 -pix_fmt yuv420p -r 25 tiktok-cta.mp4 2>/dev/null
echo "  ✓ tiktok title cards"

# Scale demo clips to vertical
for clip in demo-hero.mp4 demo-agents.mp4 demo-local-ai.mp4; do
  name="${clip%.mp4}"
  ffmpeg -y -i "$clip" \
    -vf "scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0d0d0d,setsar=1" \
    -c:v libx264 -pix_fmt yuv420p -r 25 "${name}-vert.mp4" 2>/dev/null
  echo "  ✓ ${name}-vert.mp4"
done

cat > concat-tiktok.txt << 'CONCAT'
file 'tiktok-intro.mp4'
file 'demo-hero-vert.mp4'
file 'demo-agents-vert.mp4'
file 'demo-local-ai-vert.mp4'
file 'tiktok-cta.mp4'
CONCAT

ffmpeg -y -f concat -safe 0 -i concat-tiktok.txt \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart \
  kbot-tiktok.mp4 2>/dev/null
echo "  ✓ kbot-tiktok.mp4"

# ── Cleanup ──
echo "Cleaning up temp files..."
rm -f concat-youtube.txt concat-tiktok.txt
rm -f title-intro.mp4 title-learns.mp4 title-agents.mp4 title-local.mp4 title-cta.mp4
rm -f title-intro.png title-learns.png title-agents.png title-local.png title-cta.png
rm -f tiktok-intro.mp4 tiktok-cta.mp4 tiktok-intro.png tiktok-cta.png
rm -f demo-hero-1080.mp4 demo-learning-1080.mp4 demo-agents-1080.mp4 demo-defense-1080.mp4 demo-local-ai-1080.mp4
rm -f demo-hero-vert.mp4 demo-agents-vert.mp4 demo-local-ai-vert.mp4
rm -f demo-hero.mp4 demo-learning.mp4 demo-agents.mp4 demo-defense.mp4 demo-local-ai.mp4

echo ""
echo "=== Done ==="
echo ""
ls -lh kbot-youtube.mp4 kbot-tiktok.mp4
echo ""
echo "YouTube: kbot-youtube.mp4 (16:9, 1920x1080)"
echo "TikTok:  kbot-tiktok.mp4  (9:16, 1080x1920)"
