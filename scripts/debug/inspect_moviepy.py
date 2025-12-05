import moviepy
print(f"MoviePy Version: {moviepy.__version__}")
print("Attributes:")
for attr in dir(moviepy):
    if "concat" in attr.lower():
        print(attr)
