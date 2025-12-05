import moviepy.audio
print("MoviePy Audio:")
print(dir(moviepy.audio))
try:
    import moviepy.audio.fx
    print("\nMoviePy Audio FX:")
    print(dir(moviepy.audio.fx))
except ImportError:
    print("\nNo moviepy.audio.fx module")
