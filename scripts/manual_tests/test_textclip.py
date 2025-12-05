from moviepy import TextClip, ColorClip, CompositeVideoClip

try:
    # Create a simple text clip
    # In v2, TextClip might use different parameters or backends
    # Let's try standard usage
    txt_clip = TextClip(text="Hello World", font_size=70, color='white')
    txt_clip = txt_clip.with_duration(2)
    
    # Composite over a color background
    bg_clip = ColorClip(size=(640, 480), color=(0, 0, 255)).with_duration(2)
    video = CompositeVideoClip([bg_clip, txt_clip])
    
    video.write_videofile("test_text.mp4", fps=24)
    print("TextClip success!")
except Exception as e:
    print(f"TextClip failed: {e}")
    import traceback
    traceback.print_exc()
