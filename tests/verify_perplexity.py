import sys
import os
import logging
import asyncio

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.infrastructure.perplexity import PerplexityClient
from admin.brain.model_router import get_model_router, TaskType
from admin.engineers.copilot import Copilot
from admin.engineers.web_scout import get_web_scout

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerifyPerplexity")


async def verify_perplexity():
    print("=== Perplexity Integration Verification ===\n")

    # 1. Check Infrastructure Client
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        print("⚠️ PERPLEXITY_API_KEY not found in environment. Mocking results for validation.")
        client = PerplexityClient("mock_key")
    else:
        print("✅ PERPLEXITY_API_KEY found.")
        client = PerplexityClient(api_key)

    # 2. Check Model Router
    router = get_model_router()
    ppx_models = [m for m, d in router.models.items() if d["provider"] == "perplexity"]
    print(f"✅ Model Router registered Perplexity models: {ppx_models}")

    # 3. Check Copilot Integration
    try:
        copilot = Copilot()
        if copilot.ppx_client:
            print("✅ Copilot initialized with Perplexity Client.")
        else:
            print("⚠️ Copilot missing Perplexity Client (check API key).")
    except Exception as e:
        print(f"❌ Copilot initialization failed: {e}")

    # 4. Check Web Scout Integration
    try:
        scout = get_web_scout()
        if scout.ppx_client:
            print("✅ Web Scout initialized with Perplexity Client.")
        else:
            print("⚠️ Web Scout missing Perplexity Client.")
    except Exception as e:
        print(f"❌ Web Scout initialization failed: {e}")

    print("\n=== Verification Complete ===")


if __name__ == "__main__":
    asyncio.run(verify_perplexity())
