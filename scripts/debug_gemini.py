import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.environ.get("GEMINI_API_KEY")
print(f"Testing API Key: {api_key[:5]}...{api_key[-5:] if api_key else 'NONE'}")

if not api_key:
    print("Error: No API key found in environment.")
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    response = model.generate_content("Hello, system check. Reply with 'OK' if you see this.")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error calling Gemini: {e}")
