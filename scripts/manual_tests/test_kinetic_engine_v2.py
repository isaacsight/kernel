import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin.engineers.kinetic_text import KineticTextEngine

def test_engine():
    engine = KineticTextEngine()
    
    # Create dummy VTT
    vtt_content = """WEBVTT

00:00:01,000 --> 00:00:03,000
Hello World

00:00:03,500 --> 00:00:05,000
Kinetic Text
"""
    with open("test.vtt", "w") as f:
        f.write(vtt_content)
        
    print("Testing KineticTextEngine...")
    try:
        clips = engine.generate_kinetic_captions("test.vtt", 1080, 1920)
        print(f"Generated {len(clips)} clips.")
        
        if len(clips) == 2:
            print("SUCCESS: Clips generated.")
        else:
            print("FAILURE: Incorrect clip count.")
            
    except Exception as e:
        print(f"FAILURE: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        if os.path.exists("test.vtt"):
            os.remove("test.vtt")

if __name__ == "__main__":
    test_engine()
