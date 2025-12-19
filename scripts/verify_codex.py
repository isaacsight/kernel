import asyncio
import logging
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.architect import Architect
from admin.engineers.librarian import Librarian

async def test_codex_integration():
    logging.basicConfig(level=logging.INFO)
    
    print("🚀 Testing Codex CLI Integration...")
    
    # 1. Test Librarian Code Query
    print("\n--- Testing Librarian Code Query ---")
    lib = Librarian()
    try:
        res = await lib.query_code_with_codex("What is the primary role of the Architect agent?")
        print("Librarian Result:", res.get("answer", "No answer"))
    except Exception as e:
        print("Librarian Query Failed:", e)

    # 2. Test Architect Blueprint Execution
    print("\n--- Testing Architect Blueprint Execution ---")
    arch = Architect()
    blueprint = {
        "plan_summary": "Add a test marker to a file",
        "changes": [
            {
                "file": "CODEX_TEST.txt",
                "action": "create",
                "content": "This file was created by Codex via the Architect agent."
            }
        ]
    }
    
    try:
        res = arch.implement_blueprint(blueprint)
        print("Architect Result:", res)
        
        # Verify file creation
        if os.path.exists("CODEX_TEST.txt"):
            print("✅ Verification Successful: CODEX_TEST.txt created.")
            os.remove("CODEX_TEST.txt")
        else:
            print("❌ Verification Failed: CODEX_TEST.txt NOT created.")
            
    except Exception as e:
        print("Architect Execution Failed:", e)

if __name__ == "__main__":
    asyncio.run(test_codex_integration())
