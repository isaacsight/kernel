
import sys
import os

# Add project root to path
sys.path.insert(0, os.getcwd())

from admin.brain.agent_base import BaseAgent

# Initialize a dummy agent
agent_id = 'alchemist' 

try:
    print(f"Initializing {agent_id} with Visual Cortex...")
    agent = BaseAgent(agent_id)
    
    # Create a dummy image file for testing
    dummy_image = "test_image.png"
    with open(dummy_image, "w") as f:
        f.write("fake image data")
        
    print("\n--- TEST: SEEING IMAGE ---\n")
    # Call the .see() method provided by VisualCortexMixin
    result = agent.see(os.path.abspath(dummy_image), "What does this architectual diagram show?")
    print(result)
    print("\n--------------------------\n")
    
    # Cleanup
    os.remove(dummy_image)
    
    if "[Visual Cortex" in result:
        print("SUCCESS: Visual Cortex activated.")
    else:
        print("FAILURE: Visual Cortex did not respond correctly.")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
