
from moviepy import TextClip, ColorClip, CompositeVideoClip

try:
    # Create a simple text clip
    txt_clip = TextClip(
        text="Hello World",
        font_size=70,
        color='yellow',
        stroke_color='black',
        stroke_width=2,
        font='Arial',
        method='caption',
        size=(500, 100),
        text_align='center'
    )
    txt_clip = txt_clip.with_duration(2)
    
    # Composite on a background
    bg = ColorClip(size=(600, 200), color=(0, 0, 255), duration=2)
    final = CompositeVideoClip([bg, txt_clip])
    
    # Write to file
    final.write_videofile("test_captions.mp4", fps=24)
    print("✅ TextClip works!")
    
except Exception as e:
    print(f"❌ TextClip failed: {e}")
