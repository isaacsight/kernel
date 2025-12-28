
import sys
import os

# Add project root to path
sys.path.insert(0, os.getcwd())

from admin.brain.agent_base import BaseAgent

# Initialize a dummy agent (or use existing 'alchemist')
# We need to ensure the agent folder exists
agent_id = 'alchemist' 

try:
    print(f"Initializing {agent_id}...")
    agent = BaseAgent(agent_id)
    prompt = agent.get_system_prompt()
    
    print("\n--- SYSTEM PROMPT SNIPPET ---\n")
    print(prompt[-3000:]) # Print the end where context is injected
    print("\n-----------------------------\n")
    
    if "PROJECT GLOBAL CONTEXT" in prompt:
        print("SUCCESS: Global Context found in prompt.")
    else:
        print("FAILURE: Global Context NOT found.")
        
except Exception as e:
    print(f"Error: {e}")
