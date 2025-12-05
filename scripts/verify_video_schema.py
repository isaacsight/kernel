import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.video.schema import Movie, Scene, Element
from admin.engineers.video.renderer import VideoRenderer

logging.basicConfig(level=logging.INFO)

def verify_video_schema():
    print("=== Verifying Video Schema Pipeline ===")
    
    # 1. Create Movie
    movie = Movie(width=720, height=1280, fps=24, background_color="#111111")
    
    # 2. Create Scene 1: Intro
    scene1 = Scene(duration=3.0, background_color="#222222")
    
    # Add Red Box (Element)
    elem_box = Element(
        type="color",
        content="#FF0000",
        width=500,
        height=500,
        position="center",
        start=0.5,
        duration=2.0,
        z_index=1,
        animation="fade_in"
    )
    
    # Add Text
    elem_text = Element(
        type="text",
        content="HELLO WORLD",
        style={"fontsize": 50, "color": "white", "stroke_width": 2},
        position={"x": "center", "y": 200},
        start=0,
        duration=3.0,
        z_index=2
    )
    
    scene1.add_element(elem_box)
    scene1.add_element(elem_text)
    movie.add_scene(scene1)
    
    # 3. Create Scene 2: Transition
    scene2 = Scene(duration=2.0, background_color="#000044")
    elem_text2 = Element(
        type="text",
        content="Testing Schema...",
        style={"fontsize": 40, "color": "yellow"},
        position="center",
        start=0,
        duration=2.0
    )
    scene2.add_element(elem_text2)
    movie.add_scene(scene2)
    
    # 4. Save JSON for inspection
    json_path = "static/videos/test_schema.json"
    os.makedirs("static/videos", exist_ok=True)
    movie.save_json(json_path)
    print(f"Movie JSON saved to {json_path}")
    
    # 5. Render
    renderer = VideoRenderer(output_dir="static/videos")
    output_path = renderer.render(movie, "test_schema_render.mp4")
    
    if output_path and os.path.exists(output_path):
        print(f"SUCCESS: Video rendered to {output_path}")
    else:
        print("FAILURE: Video rendering failed.")

if __name__ == "__main__":
    verify_video_schema()
