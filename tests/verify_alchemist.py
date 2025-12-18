
import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.alchemist import Alchemist

def verify_alchemist():
    print("=== Verifying Alchemist (Data-Driven) ===\n")
    
    try:
        alchemist = Alchemist()
        print(f"✅ Instantiated Alchemist: {alchemist.name}")
        
        # Verify Profile Loading
        print(f"Role: {alchemist.role}")
        if alchemist.system_prompt and "The Alchemist" in alchemist.system_prompt:
             print("✅ System prompt loaded from PROFILE.md")
        else:
             print("❌ System prompt missing or incorrect.")
             
        # Verify Skills Loading
        print(f"Enabled Skills: {alchemist.enabled_skills}")
        if "web-scout" in alchemist.enabled_skills and "filesystem" in alchemist.enabled_skills:
            print("✅ SKILLS.yaml loaded correctly.")
        else:
            print("❌ SKILLS.yaml not loaded correctly.")
            
        # Verify System Prompt Construction
        full_prompt = alchemist.get_system_prompt()
        if "ENABLED SKILLS" in full_prompt and "web-scout" in full_prompt:
            print("✅ Full system prompt constructed with skills.")
        else:
             print("❌ Full system prompt missing skill section.")

    except Exception as e:
        print(f"❌ Failed to instantiate: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_alchemist()
