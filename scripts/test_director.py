
import sys
import os
import json
import logging

# Setup path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.director import get_director
from admin.config import config

# Mock Doctrine for test
def mock_get_doctrine():
    return "Philosophy: Be honest, clear, and kind. Avoid hype. Embrace 'Cyber-Zen'."

# Monkey patch if needed, or just rely on the real one if accessible
# For this test, we assume the real one works or we mock it.
# Let's trust the real get_doctrine import inside director.check_alignment

def test_director():
    director = get_director()
    print(f"Director Online: {director.name}")
    
    # Test Case 1: Bad Content (Hype)
    bad_content = """
    OMG you guys! This new AI tool is going to CHANGE EVERYTHING!!! 
    It's literally 100x better than GPT-4 and will make you a MILLIONAIRE overnight!
    Don't sleep on this! 🚀🚀🚀 #Hustle #AI #Money
    """
    
    print("\n--- Testing Bad Content (Hype) ---")
    result_bad = director.check_alignment(bad_content, context="Test Context")
    print(json.dumps(result_bad, indent=2))
    
    if result_bad.get("veto"):
        print("✅ Correctly VETOED bad content.")
    else:
        print("❌ FAILED to veto bad content.")

    # Test Case 2: Good Content (Zen)
    good_content = """
    We often mistake speed for progress. 
    True automation isn't about moving faster; it's about slowing down enough to see where you're going.
    The goal is not to remove the human, but to remove the noise.
    """
    
    print("\n--- Testing Good Content (Zen) ---")
    result_good = director.check_alignment(good_content, context="Test Context")
    print(json.dumps(result_good, indent=2))
    
    if not result_good.get("veto"):
        print("✅ Correctly ALLOWED good content.")
    else:
        print("❌ FALSE POSITIVE on good content.")

if __name__ == "__main__":
    test_director()
