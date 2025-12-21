
import os
print(f"GEMINI: {os.environ.get('GEMINI_API_KEY') is not None}")
print(f"GOOGLE: {os.environ.get('GOOGLE_API_KEY') is not None}")
