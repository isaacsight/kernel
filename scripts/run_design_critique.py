import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from admin.engineers.contrarian import Contrarian

def main():
    try:
        print("Initializing Contrarian...")
        c = Contrarian()
        
        thesis = "Adopting 'Liquid Interfaces' (Eco/Spatial modes) and 'Spatial Agent Galaxy' views improves Studio OS usability and aligns with 2026 trends."
        print(f"Challenging Thesis: {thesis}")
        
        result = c.challenge_thesis(thesis)
        
        print("\n--- CONTRARIAN DISSENT ---")
        print(result['dissent'])
        print("\n--- EVIDENCE ---")
        # Handle evidence list safely
        evidence = result.get('evidence', [])
        if isinstance(evidence, list):
            for e in evidence:
                print(f"- {e}")
        else:
            print(evidence)
            
    except Exception as e:
        print(f"Error running Contrarian: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
