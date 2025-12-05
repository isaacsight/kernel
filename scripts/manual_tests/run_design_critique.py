
import os
import sys
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

# Configure logging
logging.basicConfig(level=logging.INFO)

from admin.engineers.visionary import Visionary

def run_critique():
    print("Initializing Visionary...")
    visionary = Visionary()
    
    print("Reading style.css...")
    try:
        with open("css/style.css", "r") as f:
            current_css = f.read()
    except FileNotFoundError:
        print("Error: css/style.css not found.")
        return

    print("\nRequesting Design Critique (this uses the LLM)...")
    # Using a 1500 char chunk to fit in context window if needed, 
    # though modern models handle much more. 
    # Focusing on the root variables and core typography/layout for the best critique.
    critique = visionary.critique_design(current_css[:2000], "<!-- No HTML context for this pure style critique -->")
    
    print("\n" + "="*40)
    print("DESIGN CRITIQUE REPORT")
    print("="*40 + "\n")
    print(critique)

if __name__ == "__main__":
    run_critique()
