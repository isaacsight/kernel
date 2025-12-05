import logging
logging.basicConfig(level=logging.DEBUG)

from moviepy import TextClip, ColorClip, CompositeVideoClip

# Test simple TextClip with caption settings
try:
    txt_clip = TextClip(
        text="Hello World Test Caption",
        font_size=40,
        color='yellow',
        stroke_color='black',
        stroke_width=2,
        font='/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        method='caption',
        size=(640 * 0.9, None),
        text_align='center'
    )
    txt_clip = txt_clip.with_start(0).with_duration(2)
    txt_clip = txt_clip.with_position(('center', 0.8), relative=True)
    
    bg_clip = ColorClip(size=(640, 480), color=(0, 0, 255)).with_duration(2)
    video = CompositeVideoClip([bg_clip, txt_clip])
    
    video.write_videofile("test_caption.mp4", fps=24)
    print("Caption test SUCCESS!")
except Exception as e:
    print(f"Caption test FAILED: {e}")
    import traceback
    traceback.print_exc()
