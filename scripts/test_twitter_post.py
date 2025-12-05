
import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from admin.engineers.broadcaster import Broadcaster

# Configure logging
logging.basicConfig(level=logging.INFO)

def main():
    print("Testing Twitter Distribution...")
    broadcaster = Broadcaster()
    
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    test_data = {
        "tweet_count": 2,
        "total_characters": 50,
        "tweets": [
            f"🧪 Studio OS Integration Test at {timestamp}\n\nVerifying autonomous posting capabilities.",
            "If you are reading this, the system is fully operational. 🚀 #StudioOS #AI"
        ]
    }
    
    print("Attempting to distribute to Twitter...")
    if broadcaster.distribute_to_twitter(test_data):
        print("✅ Distribution function returned True.")
    else:
        print("❌ Distribution function returned False.")

if __name__ == "__main__":
    main()
