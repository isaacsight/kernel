import numpy as np
from moviepy import AudioClip
import os

def make_pop_sound(duration=0.1, freq=200):
    # Short beep/pop
    make_frame = lambda t: np.sin(2 * np.pi * freq * t) * np.exp(-10*t)
    clip = AudioClip(make_frame, duration=duration, fps=44100)
    
    output_dir = os.path.join(os.path.dirname(__file__), "../static/audio")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_path = os.path.join(output_dir, "pop.mp3")
    clip.write_audiofile(output_path, logger=None)
    print(f"Generated {output_path}")

if __name__ == "__main__":
    make_pop_sound()
