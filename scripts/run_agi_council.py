import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.council import GrandCouncil
from admin.engineers.universal_specialist import UniversalSpecialist

def main():
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    
    print("\n🧠 Initializing AGI Council (Phase 2)...")
    council = GrandCouncil()
    
    # 1. Summon Diverse Experts (The "Mixture of Experts")
    # We choose fields that are orthogonal to find non-obvious synthesis
    experts = [
        UniversalSpecialist("Evolutionary Biology"),
        UniversalSpecialist("Military Strategy"),
        UniversalSpecialist("Behavioral Economics")
    ]
    
    for expert in experts:
        council.register_agent(expert.name, expert)
        
    # 2. Define a Complex, Abstract Topic
    topic = "How should 'Studio OS' handle the tradeoff between Innovation and Reliability? We need a policy."
    
    print(f"\n📢 Topic: {topic}")
    print("--------------------------------------------------")
    
    # 3. Deliberate
    # The Council will now ask the Biologist, Strategist, and Economist for inputs
    # And then Synthesize a "Grand Unified" policy.
    result = council.deliberate(topic, {"project_phase": "growth"})
    
    # 4. Output the Result
    print("\n\n🏛️ === GRAND COUNCIL DECREE === 🏛️\n")
    print(result['council_output'])
    
    # Save a record
    import datetime
    filename = f"agi_council_session_{datetime.datetime.now().strftime('%Y%m%d')}.md"
    with open(filename, "w") as f:
        f.write(f"# AGI Council Session\nTopic: {topic}\n\n")
        f.write(f"## Intelligence Reports\n{result['intelligence']}\n\n")
        f.write(f"## Final Decree\n{result['council_output']}")
    
    print(f"\n✅ Session Record Saved: {filename}")

if __name__ == "__main__":
    main()
