from moviepy import VideoFileClip
import os

def inspect_video():
    # Try to find it based on previous find command or just check likely spots
    paths = [
        "static/videos/the-engine-and-the-gallery.mp4",
        "admin/static/videos/the-engine-and-the-gallery.mp4"
    ]
    video_path = None
    for p in paths:
        if os.path.exists(p):
            video_path = p
            break
            
    if not video_path:
        print(f"Video not found in {paths}")
        return
        
    print(f"Inspecting: {video_path}")

    try:
        clip = VideoFileClip(video_path)
        print(f"Video Duration: {clip.duration}")
        if clip.audio:
            print(f"Audio Found: Yes")
            print(f"Audio Duration: {clip.audio.duration}")
            # Try to get max volume to see if it's silent
            # This might be slow for a long video, so just check first chunk
            chunk = clip.audio.subclipped(0, 5).to_soundarray()
            print(f"Audio Max Amplitude (first 5s): {chunk.max()}")
        else:
            print("Audio Found: No")
            
        clip.close()
    except Exception as e:
        print(f"Error inspecting video: {e}")

if __name__ == "__main__":
    inspect_video()
