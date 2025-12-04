from moviepy import ColorClip, AudioFileClip, CompositeVideoClip
import os

def test_audio_mix():
    try:
        print("Testing audio mixing...")
        audio_path = "admin/static/audio/lofi_beat.mp3"
        if not os.path.exists(audio_path):
            print(f"Audio file not found at {audio_path}")
            return

        # Create a simple 5-second video
        video = ColorClip(size=(640, 480), color=(255, 0, 0), duration=5)
        
        # Load audio
        print(f"Loading audio from {audio_path}")
        audio = AudioFileClip(audio_path)
        print(f"Audio duration: {audio.duration}")
        
        # Subclip audio to 5 seconds
        audio = audio.subclipped(0, 5)
        
        # Set audio
        video.audio = audio
        
        output_path = "debug_audio_test.mp4"
        print(f"Writing video to {output_path}")
        video.write_videofile(output_path, fps=24, audio_codec='aac')
        
        print("Done.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_audio_mix()
