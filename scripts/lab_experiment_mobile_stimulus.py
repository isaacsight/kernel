"""
🧪 LAB EXPERIMENT: Mobile Stimulus & Swarm Activation
===================================================

Purpose:
To demonstrate the "Neural Link" between the Mac Controller and the Mobile App.
This script rapidly mutates the `agent_presence` state, simulating a high-activity
"Swarm Event".

User Instruction:
Open your mobile app. Watch the "Active Agent Swarm" dashboard.
It should light up like a Christmas tree.
"""

import sys
import os
import time
import random

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.agent_presence import get_agent_presence, AgentStatus

def swarm_stimulus():
    presence = get_agent_presence()
    
    print("🧪 INJECTING STIMULUS INTO SWARM BRAIN...")
    print("📱 WATCH YOUR PHONE DASHBOARD\n")

    agents = [
        "System Architect", "Research Assistant", "Creative Director", 
        "Alchemist", "Guardian", "Operator", "Visionary"
    ]
    
    tasks = [
        "Decrypting signal pattern...",
        "Optimizing neural pathways...",
        "Compiling research matrix...",
        "Synthesizing creative assets...",
        "Scanning for anomalies...",
        "Re-calibrating core loop...",
        "Syncing with remote node...",
        "Analyzing user biometric data...",
        "Generating holographic projection..."
    ]
    
    try:
        # Phase 1: Wake Up (All Active)
        print(">> PHASE 1: SYSTEM WAKE UP")
        for agent in agents:
            presence.update_presence(
                agent, 
                AgentStatus.WORKING, 
                current_task="INITIALIZING UPLINK...",
                progress=10
            )
            time.sleep(0.5) # Staggered wake up
            
        time.sleep(2)
        
        # Phase 2: Chaos / High Activity
        print(">> PHASE 2: SWARM ACTIVATION (Looping...)")
        print("(Press Ctrl+C to stop experiment)")
        
        while True:
            # Pick a random agent to update
            agent = random.choice(agents)
            task = random.choice(tasks)
            progress = random.randint(20, 99)
            
            presence.update_presence(
                agent, 
                AgentStatus.WORKING, 
                current_task=task,
                progress=progress
            )
            
            print(f"⚡ STIMULUS: {agent} -> {task} ({progress}%)")
            
            # Fast updates!
            time.sleep(0.8)

    except KeyboardInterrupt:
        print("\n\n🛑 EXPERIMENT HALTED.")
        print("Resetting swarm to idle...")
        for agent in agents:
            presence.update_presence(agent, AgentStatus.IDLE, progress=0)
        print("System normalized.")

if __name__ == "__main__":
    swarm_stimulus()
