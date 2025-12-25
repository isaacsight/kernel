import os
import sys
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.config import config
from admin.infrastructure.openrouter import OpenRouterClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OR_Test")

def test_openrouter_free():
    api_key = config.OPENROUTER_API_KEY
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not found in environment.")
        return

    client = OpenRouterClient(api_key)
    
    # Test with a free model
    model = config.OR_FREE_MISTRAL
    print(f"Testing OpenRouter with model: {model}...")
    
    messages = [
        {"role": "user", "content": "Hello! Say 'OpenRouter integration is active' and nothing else."}
    ]
    
    response = client.chat_completion(model, messages)
    text = client.extract_text(response)
    
    if "integration is active" in text.lower():
        print(f"✅ Success! Response: {text}")
    else:
        print(f"❌ Failed. Response: {text}")
        if "error" in response:
            print(f"Details: {response}")

if __name__ == "__main__":
    test_openrouter_free()
