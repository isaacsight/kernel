import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("❌ Error: GOOGLE_API_KEY environment variable not set.")
        return

    client = genai.Client(api_key=api_key)

    veo_candidates = [m.name for m in client.models.list(config={"query_base": True}) if "veo" in m.name.lower()]
    print(f"Found Veo models: {veo_candidates}")
    
    prompt = "A cinematic drone shot of a futuristic cyberpunk city with neon lights and rain, realistic, 4k"

    # Prioritize them. Let's try to reverse sort to get newer ones, but if 3.1 fails, fall back.
    # Actually, let's manual sort: 2.0 might be safer for quota? Or 3.0.
    # We will try them in a loop.
    priority_order = [
        "models/veo-2.0-generate-001",
        "models/veo-3.0-fast-generate-001", 
        "models/veo-3.1-fast-generate-preview"
    ]
    
    # Filter candidates to only those that exist
    candidates_to_try = [c for c in priority_order if c in veo_candidates]
    # Add any others found that weren't in our hardcoded list
    for c in veo_candidates:
        if c not in candidates_to_try:
            candidates_to_try.append(c)

    if not candidates_to_try:
        print("❌ No Veo models found in your account.")
        return

    for model_name in candidates_to_try:
        print(f"\n🎬 Attempting generation with: {model_name}")
        try:
            response = client.models.generate_videos(
                model=model_name,
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    number_of_videos=1,
                )
            )
            if response.generated_videos:
                video = response.generated_videos[0]
                print(f"✅ Video generated successfully with {model_name}!")
                output_file = f"veo_output_{model_name.split('/')[-1]}.mp4"
                with open(output_file, "wb") as f:
                    f.write(video.video_bytes)
                print(f"💾 Saved to {output_file}")
                return # Exit on success
            else:
                print("❌ No video content returned.")
                
        except Exception as e:
            print(f"❌ Failed with {model_name}: {e}")
            if "429" in str(e):
                print("   (Quota/Rate Limit hit)")

    print("\n❌ All attempts failed.")

if __name__ == "__main__":
    main()
