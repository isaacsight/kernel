
import sys
import os
import logging

# Add project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from admin.heartbeat import heartbeat

# Configure logging to show up in terminal
logging.basicConfig(level=logging.INFO)

print("⚡️ Forcing System Pulse...")
try:
    heartbeat.pulse()
    print("✅ Pulse Successful")
except Exception as e:
    print(f"❌ Pulse Failed: {e}")
