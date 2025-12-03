
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def list_models():
    try:
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
        print("Listing available models...")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
